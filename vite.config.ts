import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
let modulesReal = root;
try {
  modulesReal = realpathSync(new URL('./node_modules', import.meta.url));
} catch {
  /* node_modules not present yet */
}

export const IMAGE_CACHE = 'smrt-images-v1';

// A relative base keeps every asset, the manifest and the service worker working
// when the app is served from https://<user>.github.io/<repo>/.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'SMRT Speech',
        short_name: 'SMRT Speech',
        description: 'Word-level language therapy toolkit for use by a speech and language therapist.',
        lang: 'en-GB',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#563B59',
        background_color: '#FAF5F2',
        icons: [
          { src: 'smrt-assets/branding/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'smrt-assets/branding/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The visual asset pack (icons, artwork, shell backgrounds) is precached with the app shell.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,json,webmanifest}'],
        globIgnores: ['images/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // The first install takes control of the open page straight away, so the app is
        // offline-capable from the first load. Updates still wait for the user's go-ahead.
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/images/') && url.pathname.endsWith('.webp'),
            handler: 'CacheFirst',
            options: { cacheName: IMAGE_CACHE, matchOptions: { ignoreSearch: true } },
          },
        ],
      },
    }),
  ],
  server: { fs: { allow: [root, modulesReal] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
