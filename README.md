# 3Dash

A 3D floorplan dashboard for [Home Assistant](https://www.home-assistant.io/). Load your own 3D model, map it to your smart home entities, and control everything from an interactive view in your browser.

## Features

- **3D floorplan** -- load a custom `.glb` model of your home and navigate it freely
- **Light control** -- toggle, dim, and color-pick lights directly from the 3D scene (supports on/off, dimmable, RGB, RGBW, and IR remote types)
- **Wall displays** -- render live sensor data (temperature, humidity, energy, etc.) on surfaces inside the model
- **Network tubes** -- animated tubes that visualize real-time network throughput
- **Sun and weather** -- sun position tracks your real location; optional rain/snow particle effects
- **Side panel** -- configurable cards for scripts, indicators, and graphs
- **Config editor** -- define lights, displays, shadow walls, and tubes from a built-in UI
- **Onboarding wizard** -- guided setup for first-time users
- **Backup / restore** -- export and import your full configuration as a ZIP
- **Demo mode** -- explore the dashboard without a Home Assistant instance
- **PWA** -- installable as a progressive web app with offline support
- **Dark and light themes**

## Tech stack

React, TypeScript, Babylon.js, Vite, Home Assistant WebSocket API.

## Getting started

### Option 1 -- GitHub hosted version

Use the hosted version directly at **https://kdcius.github.io/3Dash_webapp/**.

No installation required. Your Home Assistant instance must be accessible over HTTPS for the WebSocket connection to work from the hosted page.

### Option 2 -- Home Assistant add-on

The easiest way to self-host. Runs on the same machine as your Home Assistant instance.

[![Add repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fkdcius%2F3Dash_webapp)

Or manually:

1. In Home Assistant, go to **Settings > Add-ons > Add-on Store**.
2. Open the overflow menu and select **Repositories**.
3. Add `https://github.com/kdcius/3Dash_webapp`.
4. Install **3Dash** from the store and start it.
5. Open `https://<your-ha-ip>:8099` in your browser.

> The add-on serves over HTTPS with a self-signed certificate (enables PWA install). Your browser will show a certificate warning on first visit -- accept it to proceed.

### Option 3 -- Self-host on any machine

For advanced users who want to build and serve 3Dash themselves.

```bash
git clone https://github.com/kdcius/3Dash_webapp.git
cd 3Dash_webapp
npm ci
npm run build
```

Serve the `dist/` directory with any static file server (Nginx, Caddy, etc.). For development with hot reload, use `npm run dev` instead.

## Configuration

All configuration happens in the browser -- no config files to edit manually.

| What | Where |
|---|---|
| Home Assistant URL, port, and token | Onboarding wizard or Settings |
| Location (for sun tracking) | Onboarding wizard or Settings |
| Theme, rendering, camera | Settings modal |
| Lights, displays, shadow walls, tubes | Config editor |

Configuration is persisted in `localStorage`. The 3D model is stored in `IndexedDB`.

## Project structure

```
src/
  babylon/       3D scene, model loading, lights, displays, tubes, sun, weather
  components/    React UI (HUD, modals, side panel, cards, forms, guided tour)
  pages/         Dashboard, config editor, onboarding
  services/      HA WebSocket client, config/settings persistence, storage
  contexts/      React contexts (demo mode, camera, theme)
  types/         TypeScript type definitions
  utils/         Color conversion helpers
public/          Static assets (default 3D model, fonts, icons, PWA manifests)
3dash-addon/     Home Assistant add-on (Dockerfile, nginx config, run script)
```

## License

This project is provided as-is. See the repository for license details.
