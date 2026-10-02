import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/app-consulta-nutricional/',
  plugins: [react()],
  clearScreen: false,
  server: {
    host: true,
  }
})
