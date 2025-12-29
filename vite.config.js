
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  define: {
    // This allows the code to use process.env.API_KEY in the browser
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    host: true,
    port: 3000,
  }
});
