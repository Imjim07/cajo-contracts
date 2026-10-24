import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // ethers is large and changes rarely; keep it in its own cacheable chunk.
      output: { manualChunks: { ethers: ['ethers'] } },
    },
  },
})
