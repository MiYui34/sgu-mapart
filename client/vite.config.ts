import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared') },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  server: {
    port: 6789,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3011', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3011', changeOrigin: true },
    },
  },
})
