import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logoprotecaocivil.png'],
      manifest: {
        name: 'Proteção Civil Leiria',
        short_name: 'PCLeiria',
        description: 'Localização de operacionais',
        theme_color: '#174A68',
        icons: [
          {
            src: 'logoprotecaocivil.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'logoprotecaocivil.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
