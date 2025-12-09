import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/oam-api': {
        target: 'https://api.openaerialmap.org', 
        changeOrigin: true, 
        rewrite: (path) => path.replace(/^\/oam-api/, ''),
        secure: true,
      }
    }
  }
})
