import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.HD_API_URL || 'http://localhost:9000',
        changeOrigin: true,
      },
      '/healthz': {
        target: process.env.HD_API_URL || 'http://localhost:9000',
        changeOrigin: true,
      },
    },
  },
})
