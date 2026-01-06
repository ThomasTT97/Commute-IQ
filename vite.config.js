
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const copyLogoPlugin = () => ({
    name: 'copy-logo',
    generateBundle() {
      const logoPath = path.resolve('logo.png');
      
      if (fs.existsSync(logoPath)) {
        const source = fs.readFileSync(logoPath);
        this.emitFile({
          type: 'asset',
          fileName: 'logo.png',
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
        strategies: 'injectManifest',
        srcDir: '.',
        filename: 'sw.js',
        injectManifest: {
          // Source is uniquely named to avoid collisions
          swSrc: 'service-worker-src.js',
          // Built output will go to dist/sw.js
          swDest: 'dist/sw.js',
          injectionPoint: 'self.__WB_MANIFEST',
        },
        registerType: 'autoUpdate',
        injectRegister: false,
        manifest: {
          name: "Commute IQ",
          short_name: "Commute IQ",
          description: "Smart cycling intelligence for commuters.",
          theme_color: "#05070a",
          background_color: "#05070a",
          display: "standalone",
          display_override: ["standalone", "window-controls-overlay"],
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          id: "com.commuteiq.app",
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
