import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4318,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: false,
        headers: { host: '127.0.0.1:4318' },
      },
    },
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
})
