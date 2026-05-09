import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const parseBool = (value) => String(value).toLowerCase() === 'true'
const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const listenAll = parseBool(process.env.VITE_DEV_LISTEN_ALL)
const allowedHosts = parseCsv(process.env.VITE_ALLOWED_HOSTS)

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: {
    ...(listenAll ? { host: '0.0.0.0' } : {}),
    ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
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
