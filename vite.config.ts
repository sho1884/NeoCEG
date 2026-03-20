import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NeoCEG - Cause-Effect Graph Test Design Tool',
        short_name: 'NeoCEG',
        description: 'Modern cause-effect graph test design tool based on Myers method',
        theme_color: '#6d4c41',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png?v=2',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(
      new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T')
    ),
  },
})
