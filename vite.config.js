import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const copyLogoPlugin = () => ({
    name: 'copy-logo',
    generateBundle() {
      // Fixed: Use process.cwd() because __dirname is not available in ESM modules
      const logoPath = path.resolve(process.cwd(), 'logo.png');
      
      if (fs.existsSync(logoPath)) {
        const source = fs.readFileSync(logoPath);
        this.emitFile({
          type: 'asset',
          fileName: 'icon-v4.png',
          source: source
        });
      } else {
        console.warn('Warning: logo.png not found in project root. PWA icon will be missing.');
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
        includeAssets: ['icon-v4.png'],
        manifestFilename: 'manifest.json',
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,ico,svg,png}'],
          ignoreURLParametersMatching: [/^v$/]
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
          id: "/",
          icons: [
            {
              "src": "/icon-v4.png",
              "sizes": "192x192",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/icon-v4.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/icon-v4.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "maskable"
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