import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  // Vitest transforms JSX with esbuild (plugin-react's babel transform only
  // runs in serve/build) — use the automatic runtime so component tests work.
  // Scoped to test mode so the production build pipeline is untouched.
  esbuild: mode === 'test' ? { jsx: 'automatic' } : undefined,
  test: {
    exclude: [
      ...configDefaults.exclude,
      // plain `node` assert script (run directly), not a vitest suite
      'src/lib/contactSheet.test.mjs',
      // firestore-rules test needs the emulator — run via `npm run test:rules`
      'tests/**',
    ],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'קהילת שחף',
        short_name: 'שחף',
        description: 'הפלטפורמה הקהילתית של קהילת שחף',
        theme_color: '#2563EB',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'he',
        dir: 'rtl',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Firestore/Auth use a real-time WebChannel — a service worker intercepting
        // those requests (even with NetworkFirst) can silently break the channel.
        // Never cache or intercept them; only cache static Google Fonts.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}))
