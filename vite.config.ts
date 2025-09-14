import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Zahlenspiel',
    short_name: 'Zahlenspiel',
    description: 'Ein kleines Zahlenlernspiel für Kinder',
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/zahlenspiel/',
    scope: '/zahlenspiel/',
    icons: [
      {
        src: '/zahlenspiel/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/zahlenspiel/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: '/zahlenspiel/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ]
  }
})
  ],
  base: '/zahlenspiel/', // wichtig für GitHub Pages
})