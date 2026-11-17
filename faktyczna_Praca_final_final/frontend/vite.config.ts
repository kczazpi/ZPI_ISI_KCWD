import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Proxy API calls to backend during development
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Ensure WASM files are handled correctly
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
  optimizeDeps: {
    // hash-wasm uses WebAssembly, exclude from optimization
    exclude: ['hash-wasm'],
  },
})
