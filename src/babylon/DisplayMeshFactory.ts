import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Vector3,
  Color3 as BABYLON_Color3,
  type Mesh,
} from '@babylonjs/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { icons } from 'lucide-react';
import type { DisplayAnimation, DisplayConfig, HAState } from '../types';
import type { Observer } from '@babylonjs/core';

export interface DisplayMeshEntry {
  plane: Mesh;
  texture: DynamicTexture;
  material: StandardMaterial;
  config: DisplayConfig;
  /** Cache last drawn text to avoid unnecessary redraws. */
  lastText: string;
  /** Active animation state. */
  _anim?: {
    type: DisplayAnimation;
    observer: Observer<Scene>;
    t: number;
    baseScale: Vector3;
    baseAlpha: number;
  };
}

export type DisplayMeshMap = Record<string, DisplayMeshEntry>;

/**
 * Scene units per texture pixel.
 * At PX_TO_SCENE = 1/512, a 64px font ≈ 0.125 scene units tall.
 */
const PX_TO_SCENE = 1 / 512;
const LINE_SPACING = 1.4;
const H_PADDING = 0.6; // extra width factor (chars are ~0.6× their height)

/**
 * Measure the texture size in pixels needed to fit all sources,
 * using an offscreen canvas for accurate text measurement.
 */
function measureTextureSize(
  cfg: DisplayConfig,
  mockTexts: string[],
): { texW: number; texH: number; sceneW: number; sceneH: number } {
  const sources = cfg.sources || [];
  const defaultFontSize = cfg.fontSize ?? 64;

  // Use an offscreen canvas to measure text widths
  const measure = document.createElement('canvas').getContext('2d')!;
  let maxTextWidth = 0;
  let totalH = 0;

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const fs = src.fontSize ?? defaultFontSize;
    const fw = src.fontWeight ?? 'bold';
    const text = mockTexts[i] ?? '—';
    measure.font = `${fw} ${fs}px "DM Mono", monospace`;
    const w = measure.measureText(text).width;
    if (w > maxTextWidth) maxTextWidth = w;
    totalH += fs * LINE_SPACING;
  }

  if (sources.length === 0) {
    maxTextWidth = defaultFontSize * 4;
    totalH = defaultFontSize * LINE_SPACING;
  }

  // Add padding — more if there's a background panel
  const hasBg = !!(cfg.backgroundColor && cfg.backgroundColor !== 'transparent');
  const padX = hasBg ? defaultFontSize * 1.0 : defaultFontSize * H_PADDING;
  const padY = hasBg ? defaultFontSize * 0.7 : defaultFontSize * 0.3;
  const texW = Math.round(maxTextWidth + padX);
  const texH = Math.round(totalH + padY);

  return {
    texW: Math.max(texW, 64),
    texH: Math.max(texH, 32),
    sceneW: Math.max(texW, 64) * PX_TO_SCENE,
    sceneH: Math.max(texH, 32) * PX_TO_SCENE,
  };
}

export function createDisplayMesh(
  scene: Scene,
  cfg: DisplayConfig,
): DisplayMeshEntry {
  // Pre-measure with placeholder texts to get initial size
  const sources = cfg.sources || [];
  const defaultFontSize = cfg.fontSize ?? 64;
  const placeholderTexts = sources.map((src) => {
    const label = src.label ? `${src.label} ` : '';
    const unit = src.unit ?? '';
    return `${label}00.0${unit}`;
  });
  const { texW, texH, sceneW, sceneH } = measureTextureSize(cfg, placeholderTexts);

  const w = cfg.width || sceneW;
  const h = cfg.height || sceneH;

  const plane = MeshBuilder.CreatePlane(`display_${cfg.id}`, { width: w, height: h }, scene);

  const normal = new Vector3(cfg.normal.x, cfg.normal.y, cfg.normal.z).normalize();
  plane.position = new Vector3(
    cfg.position.x + normal.x * 0.005,
    cfg.position.y + normal.y * 0.005,
    cfg.position.z + normal.z * 0.005,
  );

  const lookTarget = plane.position.add(normal);
  plane.lookAt(lookTarget);

  const texture = new DynamicTexture(`displayTex_${cfg.id}`, { width: texW, height: texH }, scene, true);
  texture.hasAlpha = true;

  const material = new StandardMaterial(`displayMat_${cfg.id}`, scene);

  const hasCondBg = cfg.sources?.some((s) => s.conditions?.some((c) => c.backgroundColor));
  const hasBg = !!(cfg.backgroundColor && cfg.backgroundColor !== 'transparent') || hasCondBg;
  if (hasBg) {
    // Panel mode: react to scene lighting for realism, slight emissive for readability
    material.disableLighting = false;
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.emissiveColor = new BABYLON_Color3(0.15, 0.15, 0.15);
    material.specularColor = new BABYLON_Color3(0.03, 0.03, 0.03);
  } else {
    // Transparent mode: fully emissive (text painted on wall)
    material.disableLighting = true;
    material.emissiveTexture = texture;
  }
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  material.alpha = cfg.opacity ?? 0.95;
  plane.material = material;

  plane.metadata = { displayId: cfg.id };
  plane.isPickable = false;
  plane.applyFog = false;

  return { plane, texture, material, config: cfg, lastText: '' };
}

/**
 * Cache of pre-rendered Lucide icon images keyed by "iconName|color|size".
 * Icons are rendered as SVG → data URL → HTMLImageElement.
 */
const iconImageCache = new Map<string, HTMLImageElement | null>();

function getLucideIconImage(
  name: string,
  color: string,
  size: number,
): HTMLImageElement | null {
  const key = `${name}|${color}|${size}`;
  if (iconImageCache.has(key)) return iconImageCache.get(key)!;

  const IconComponent = icons[name as keyof typeof icons];
  if (!IconComponent) {
    iconImageCache.set(key, null);
    return null;
  }

  const svg = renderToStaticMarkup(
    createElement(IconComponent, { size, color, strokeWidth: 2 }),
  );
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  img.src = dataUrl;
  // Store immediately — the image may not be decoded yet on first call,
  // but will be ready on subsequent redraws.
  iconImageCache.set(key, img);
  return img;
}

/** Resolved per-source rendering info. */
interface SourceRenderInfo {
  text: string;
  icon?: string;
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
}

/**
 * Redraw display texture with current HA state values.
 * `states` is a map of entityId → HAState.
 */
export function updateDisplayTexture(
  entry: DisplayMeshEntry,
  states: Record<string, HAState>,
): void {
  const cfg = entry.config;
  const sources = cfg.sources || [];
  const defaultFontSize = cfg.fontSize ?? 64;
  const defaultFontWeight = cfg.fontWeight ?? 'bold';
  const defaultColor = cfg.color ?? '#38bdf8';
  const align = cfg.textAlign ?? 'center';

  // Build per-source render info
  const items: SourceRenderInfo[] = [];
  let conditionalBg: string | undefined;
  for (const src of sources) {
    const ha = states[src.entityId];
    let valueStr: string;
    if (!ha) {
      valueStr = '—';
    } else {
      const num = parseFloat(ha.state);
      if (isNaN(num)) {
        valueStr = ha.state;
      } else {
        valueStr = num.toFixed(src.precision ?? 0);
      }
    }

    // Evaluate conditions against entity state or attribute
    let condColor: string | undefined;
    let condLabel: string | undefined;
    let condIcon: string | undefined;
    if (ha && src.conditions?.length) {
      // Check attribute-based conditions first (more specific), then state-based
      const sorted = [...src.conditions].sort((a, b) => (a.attribute ? 0 : 1) - (b.attribute ? 0 : 1));
      const match = sorted.find((c) => {
        const actual = c.attribute
          ? String(ha.attributes[c.attribute] ?? '')
          : ha.state;
        return actual === c.state;
      });
      if (match) {
        condColor = match.color;
        condLabel = match.label;
        condIcon = match.icon;
        if (match.backgroundColor) conditionalBg = match.backgroundColor;
      }
    }

    const hasOverride = condLabel != null || condIcon != null;
    const label = condLabel ?? (src.label ? `${src.label} ` : '');
    const unit = hasOverride ? '' : (src.unit ?? '');
    const text = condIcon ? '' : (hasOverride ? (condLabel ?? '') : `${label}${valueStr}${unit}`);
    items.push({
      text,
      icon: condIcon,
      color: condColor ?? src.color ?? defaultColor,
      fontSize: src.fontSize ?? defaultFontSize,
      fontWeight: src.fontWeight ?? defaultFontWeight,
    });
  }

  // Build a cache key from all rendered text + styles
  const cacheKey = items.map((it) => `${it.text}|${it.icon ?? ''}|${it.color}|${it.fontSize}|${it.fontWeight}`).join('||') + `||bg:${conditionalBg ?? ''}`;
  if (cacheKey === entry.lastText) return;
  entry.lastText = cacheKey;

  const ctx = entry.texture.getContext() as unknown as CanvasRenderingContext2D;
  const texW = entry.texture.getSize().width;
  const texH = entry.texture.getSize().height;

  // Clear
  ctx.clearRect(0, 0, texW, texH);

  // Draw background panel if configured (conditional bg overrides)
  const bgColor = conditionalBg ?? cfg.backgroundColor;
  if (bgColor && bgColor !== 'transparent') {
    const radius = Math.min(texW, texH) * 0.08; // rounded corners
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(texW - radius, 0);
    ctx.quadraticCurveTo(texW, 0, texW, radius);
    ctx.lineTo(texW, texH - radius);
    ctx.quadraticCurveTo(texW, texH, texW - radius, texH);
    ctx.lineTo(radius, texH);
    ctx.quadraticCurveTo(0, texH, 0, texH - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Apply mirror transforms
  const mH = cfg.mirrorH ?? false;
  const mV = cfg.mirrorV ?? false;
  if (mH || mV) {
    ctx.save();
    ctx.translate(mH ? texW : 0, mV ? texH : 0);
    ctx.scale(mH ? -1 : 1, mV ? -1 : 1);
  }

  // Compute text X position based on alignment
  const padding = 12;
  let textX: number;
  if (align === 'left') textX = padding;
  else if (align === 'right') textX = texW - padding;
  else textX = texW / 2;

  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  // Helper to draw text with a subtle shadow for depth
  const drawText = (text: string, x: number, y: number, color: string) => {
    // Soft shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  // Helper to draw a Lucide icon centered at (cx, cy)
  let needsAsyncRedraw = false;
  const drawIcon = (iconName: string, cx: number, cy: number, color: string, size: number) => {
    const img = getLucideIconImage(iconName, color, size);
    if (!img) return;
    if (!img.complete) {
      needsAsyncRedraw = true;
      return;
    }
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  };

  // Draw item (text or icon) at position
  const drawItem = (it: SourceRenderInfo, x: number, y: number) => {
    if (it.icon) {
      drawIcon(it.icon, x, y, it.color, it.fontSize);
    } else {
      ctx.font = `${it.fontWeight} ${it.fontSize}px "DM Mono", monospace`;
      drawText(it.text, x, y, it.color);
    }
  };

  // For icon items, use center alignment for x positioning
  const itemX = (it: SourceRenderInfo) => it.icon ? texW / 2 : textX;

  if (items.length === 0) {
    ctx.font = `${defaultFontWeight} ${defaultFontSize}px "DM Mono", monospace`;
    drawText('—', textX, texH / 2, defaultColor);
  } else if (items.length === 1) {
    const it = items[0];
    drawItem(it, itemX(it), texH / 2);
  } else {
    // Multiple sources — stack vertically, each with own style
    const lineHeights = items.map((it) => it.fontSize * LINE_SPACING);
    const totalHeight = lineHeights.reduce((a, b) => a + b, 0);
    let y = (texH - totalHeight) / 2 + lineHeights[0] / 2;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      drawItem(it, itemX(it), y);
      if (i < items.length - 1) {
        y += lineHeights[i] / 2 + lineHeights[i + 1] / 2;
      }
    }
  }

  // If an icon image wasn't loaded yet, schedule a redraw once it's ready
  if (needsAsyncRedraw) {
    entry.lastText = ''; // invalidate cache so redraw actually runs
    requestAnimationFrame(() => updateDisplayTexture(entry, states));
  }

  if (mH || mV) ctx.restore();

  entry.texture.update();
}

export function removeDisplayMesh(map: DisplayMeshMap, id: string): void {
  const entry = map[id];
  if (!entry) return;
  entry.texture.dispose();
  entry.material.dispose();
  entry.plane.dispose();
  delete map[id];
}

export function rebuildAllDisplayMeshes(
  scene: Scene,
  map: DisplayMeshMap,
  configs: DisplayConfig[],
): void {
  Object.keys(map).forEach((id) => removeDisplayMesh(map, id));
  for (const cfg of configs) {
    map[cfg.id] = createDisplayMesh(scene, cfg);
  }
}

/** Well-known mockup values for common sensor types. */
const MOCKUP_VALUES: Record<string, string> = {
  temperature: '21.3',
  humidity: '54',
  pressure: '1013',
  co2: '420',
  illuminance: '350',
  battery: '87',
  power: '145',
  energy: '3.2',
  voltage: '230',
  current: '0.63',
};

/** Well-known mockup values for non-sensor entity domains. */
const DOMAIN_MOCKUP_VALUES: Record<string, string> = {
  climate: 'heat',
  switch: 'on',
  binary_sensor: 'on',
  light: 'on',
  fan: 'on',
  cover: 'open',
  lock: 'locked',
  media_player: 'playing',
};

/**
 * Build fake HAState records for editor preview so displays show
 * realistic placeholder values instead of "—".
 */
export function buildMockupStates(configs: DisplayConfig[]): Record<string, HAState> {
  const states: Record<string, HAState> = {};
  for (const cfg of configs) {
    for (const src of cfg.sources) {
      if (states[src.entityId]) continue;
      // Try to guess a sensible value from the entity ID
      const lower = src.entityId.toLowerCase();
      const domain = lower.split('.')[0];
      let value = '42';
      // Check domain-level mockups first (climate, switch, etc.)
      if (DOMAIN_MOCKUP_VALUES[domain]) {
        // If source has conditions, use the first condition's state for preview
        value = src.conditions?.length ? src.conditions[0].state : DOMAIN_MOCKUP_VALUES[domain];
      } else {
        for (const [key, val] of Object.entries(MOCKUP_VALUES)) {
          if (lower.includes(key)) { value = val; break; }
        }
      }
      states[src.entityId] = { entity_id: src.entityId, state: value, attributes: {} };
    }
  }
  return states;
}

/* ─── Display Animation Engine ─── */

const ANIM_SPEED = 0.04;

export function clearDisplayAnimation(entry: DisplayMeshEntry): void {
  if (!entry._anim) return;
  const scene = entry.plane.getScene();
  scene.onBeforeRenderObservable.remove(entry._anim.observer);
  // Reset to base values
  entry.plane.scaling.copyFrom(entry._anim.baseScale);
  entry.material.alpha = entry._anim.baseAlpha;
  entry._anim = undefined;
}

export function setDisplayAnimation(
  entry: DisplayMeshEntry,
  animation: DisplayAnimation | undefined,
): void {
  // Same animation already running — skip
  if (entry._anim?.type === animation) return;
  clearDisplayAnimation(entry);
  if (!animation) return;

  const scene = entry.plane.getScene();
  const baseScale = entry.plane.scaling.clone();
  const baseAlpha = entry.material.alpha;
  let t = 0;

  const observer = scene.onBeforeRenderObservable.add(() => {
    t += ANIM_SPEED;
    const sin = Math.sin(t);
    const abs = Math.abs(sin);

    switch (animation) {
      case 'spin':
        entry.plane.rotation.z += 0.02;
        break;
      case 'pulse': {
        const s = 1 + 0.08 * sin;
        entry.plane.scaling.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);
        break;
      }
      case 'glow':
        entry.material.alpha = baseAlpha * (0.5 + 0.5 * abs);
        entry.material.emissiveColor = new BABYLON_Color3(
          0.15 + 0.35 * abs,
          0.15 + 0.35 * abs,
          0.15 + 0.35 * abs,
        );
        break;
      case 'bounce': {
        const offset = 0.03 * sin;
        // Bounce along the plane's local up (Y in world for wall-mounted)
        entry.plane.position.y = (entry.config.position.y + entry.config.normal.y * 0.005) + offset;
        break;
      }
      case 'flash':
        entry.material.alpha = sin > 0 ? baseAlpha : 0.1;
        break;
    }
  });

  entry._anim = { type: animation, observer, t, baseScale, baseAlpha };
}

/**
 * Resolve which animation should be active for a display given current HA states.
 * Condition animations override the display-level default.
 */
export function resolveDisplayAnimation(
  cfg: DisplayConfig,
  states: Record<string, HAState>,
): DisplayAnimation | undefined {
  // Check conditions for animation overrides
  for (const src of cfg.sources) {
    const ha = states[src.entityId];
    if (!ha || !src.conditions?.length) continue;
    const sorted = [...src.conditions].sort((a, b) => (a.attribute ? 0 : 1) - (b.attribute ? 0 : 1));
    const match = sorted.find((c) => {
      const actual = c.attribute
        ? String(ha.attributes[c.attribute] ?? '')
        : ha.state;
      return actual === c.state;
    });
    if (match?.animation) return match.animation;
  }
  return cfg.animation;
}
