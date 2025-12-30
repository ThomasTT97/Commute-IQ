import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: '/',
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifestFilename: 'manifest.json',
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // Prevent build failure if logo.png is missing
          globPatterns: ['**/*.{js,css,html,ico,svg}'] 
        },
        manifest: {
          name: "Commute IQ",
          short_name: "Commute IQ",
          description: "Smart cycling intelligence for commuters.",
          theme_color: "#05070a",
          background_color: "#05070a",
          display: "standalone",
          scope: "/",
          start_url: "/",
          icons: [
            {
              "src": "https://cdn-icons-png.flaticon.com/512/3112/3112946.png",
              "sizes": "192x192",
              "type": "image/png"
            }
          ]
        }
      })
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      host: true,
      port: 3000,
    }
  };
});