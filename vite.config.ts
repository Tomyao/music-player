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
        // vite-plugin-pwa defaults this to 'index.html', which makes workbox
        // register a NavigationRoute ahead of runtimeCaching and win for every
        // navigation unconditionally (bypassing the network-first route
        // below even when online). Explicitly unset it — Object.assign copies
        // this key's `undefined` over that default — so navigation is only
        // ever handled by the runtimeCaching NetworkFirst route below.
        navigateFallback: undefined,
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
            // NetworkFirst (rather than `navigateFallback`, which registers its
            // NavigationRoute ahead of runtimeCaching routes and would win for
            // every navigation unconditionally, serving offline.html even when
            // online) tries the network first so refreshes get the live app;
            // `handlerDidError` only serves offline.html once both the network
            // and the pages-cache have failed for this exact URL.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              plugins: [
                {
                  // Precached HTML is stored under a cache-busting
                  // `?__WB_REVISION__=` query param (it has no content hash in
                  // its filename), so an exact-URL caches.match would always
                  // miss — ignoreSearch is required to actually find it.
                  handlerDidError: async () => caches.match('offline.html', { ignoreSearch: true }),
                },
              ],
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
