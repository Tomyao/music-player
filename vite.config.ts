import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually in src/main.tsx via virtual:pwa-register
      includeAssets: ['icons/*.svg', 'icons/*.png', 'offline.html'],
      manifest: false, // we ship our own public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // artwork & audio blobs are served from object URLs (blob:) created
            // from IndexedDB data, not the network, so this only covers any
            // same-origin image assets (e.g. placeholder art, icons).
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'artwork-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      // The dev server has no built assets for the SW to precache, and
      // registerType: 'autoUpdate' force-reloads the page whenever a new SW
      // takes control — under HMR that fires repeatedly and silently kills
      // whatever's mid-playback. Test the real service worker with
      // `npm run build && npm run preview` instead (see README).
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    sourcemap: true,
  },
});
