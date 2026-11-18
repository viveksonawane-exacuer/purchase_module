import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Dev: `npm run dev` proxies API calls to the bench webserver.
export default defineConfig({
  plugins: [vue()],
  base: '/assets/purchase_module/procure/',
  build: {
    outDir: '../purchase_module/public/procure',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    port: 8080,
    proxy: {
      '^/(api|assets|files|private|login)': {
        target: 'http://purchase.module:8003',
        changeOrigin: false,
      },
    },
  },
})
