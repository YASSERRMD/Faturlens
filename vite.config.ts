import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Faturlens',
        short_name: 'Faturlens',
        description: 'Browser-native invoice OCR. Fully client-side.',
        display: 'standalone',
        background_color: '#161616',
        theme_color: '#1a7f37',
        icons: [
          { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only. The model is handled by the Cache API
        // layer, and the giant ORT WASM is fetched on demand — keep both out of
        // the precache.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['**/*.wasm'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // The service worker must NOT intercept Hugging Face CDN requests.
        navigateFallbackDenylist: [/^https:\/\/huggingface\.co/],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
