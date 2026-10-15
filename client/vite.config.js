import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Caminho base do site. No GitHub Pages o site fica em /<nome-do-repositorio>/
  // (a publicação automática define VITE_BASE). Localmente é "/".
  base: process.env.VITE_BASE || '/',
  build: { chunkSizeWarningLimit: 800 },
  server: {
    port: 5173,
    // Em desenvolvimento, chamadas para /api vão para o back-end local
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
