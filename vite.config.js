
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const copyLogoPlugin = () => ({
    name: 'copy-logo',
    generateBundle() {
      const logoPath = path.resolve(process.cwd(), 'logo.png');
      if (fs.existsSync(logoPath)) {
        const source = fs.readFileSync(logoPath);
        // Emit as logo.png (used by manifest and HTML)
        this.emitFile({
          type: 'asset',
          fileName: 'logo.png',
          source: source
        });
        // Also emit as apple-touch-icon.png (standard iOS fallback)
        this.emitFile({
          type: 'asset',
          fileName: 'apple-touch-icon.png',
          source: source
        });
      }
    }
  });
  
  return {
    base: '/',
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
    plugins: [
      copyLogoPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['logo.png', 'apple-touch-icon.png'],
        manifestFilename: 'manifest.json',
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,ico,svg,png}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'weather-api-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 // 1 hour
                }
              }
            }
          ]
        },
        manifest: {
          name: "Commute IQ",
          short_name: "Commute IQ",
          description: "Smart cycling intelligence for commuters.",
          theme_color: "#05070a",
          background_color: "#05070a",
          display: "standalone",
          orientation: "portrait",
          display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
          categories: ["navigation", "health", "fitness", "lifestyle"],
          scope: "/",
          start_url: "/",
          id: "commute-iq-pwa-stable-v2",
          launch_handler: {
            client_mode: "navigate-existing"
          },
          icons: [
            {
              "src": "/logo.png",
              "sizes": "192x192",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/logo.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/logo.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "maskable"
            }
          ],
          shortcuts: [
            {
              "name": "Daily Commute",
              "url": "/?mode=daily",
              "description": "Check your daily commute status"
            },
            {
              "name": "Training Mode",
              "url": "/?mode=training",
              "description": "Plan your training session"
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
