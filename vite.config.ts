import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/paper-bard/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Paper Bard',
        short_name: 'Paper Bard',
        description: 'Offline-Soundboard für Pen-&-Paper-Sessions',
        lang: 'de',
        theme_color: '#171712',
        background_color: '#f4f0e5',
        display: 'standalone',
        orientation: 'any',
        start_url: '/paper-bard/#/session',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ]
})
