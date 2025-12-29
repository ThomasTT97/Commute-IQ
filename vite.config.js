
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // Ensure the app works from the root path
    base: '/',
    define: {
      // Specifically define the API key from the build environment
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto', // Automatically injects the SW registration script into index.html
        includeAssets: ['logo.png'],
        manifestFilename: 'manifest.json',
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true
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
              src: "/logo.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "/logo.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
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
