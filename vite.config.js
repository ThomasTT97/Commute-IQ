import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base path to ensure the app works regardless of the hosting subfolder
  base: './',
  define: {
    // Specifically define the API key and a fallback process object to prevent 'process is not defined' errors
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    host: true,
    port: 3000,
  }
});