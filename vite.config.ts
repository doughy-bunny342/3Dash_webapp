import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const basePath = mode === 'addon' ? './' : '/3Dash_webapp/';

  return {
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use the existing manifest.json in public/
      manifest: false,
      workbox: {
        // Precache all built assets (JS, CSS, HTML)
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Babylon.js bundle is ~7MB — allow precaching since this is a local app
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Runtime caching for heavy assets and API calls
        runtimeCaching: [
          {
            // Cache images/icons
            urlPattern: /\.(?:png|jpg|jpeg|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: `${basePath}index.html`,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-babylon': [
            '@babylonjs/core',
            '@babylonjs/loaders',
            '@babylonjs/materials',
          ],
          'vendor-react': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
        },
      },
    },
  },
  server: {
    host: true,
  },
};
});
