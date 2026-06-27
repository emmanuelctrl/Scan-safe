import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During local development, proxy /api requests to the Express backend so the
// browser talks to a single origin (avoids CORS headaches in dev).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
