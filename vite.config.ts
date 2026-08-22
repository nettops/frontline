import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  /*
     Bound to every interface rather than to localhost, so the game can be
     opened on a phone on the same network — the only way to find out what the
     layout does below 400px is to hold it. Dev only; the production build is
     static files and does not read this.
  */
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
