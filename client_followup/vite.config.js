import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite Config - App 2: App de Seguimiento Nutricional y Bio-Auditoría
export default defineConfig({
  base: '/',
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5174,
    host: true,
  }
})
