import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Chemins relatifs : le site fonctionne dans un sous-dossier (https://<user>.github.io/trading-journal/) comme en local.
  base: './',
  server: { port: 3000 },
  preview: { port: 3000 },
  build: { chunkSizeWarningLimit: 1000 },
})
