
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
        strategies: 'injectManifest',
        srcDir: '.',
        filename: 'sw.js',
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        devOptions: {
          enabled: true, // Allow testing PWA features in development
          type: 'module'
        },
        manifest: {
          name: "Commute IQ",
          short_name: "Commute IQ",
          description: "Smart cycling intelligence for commuters.",
          theme_color: "#05070a",
          background_color: "#05070a",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          id: "com.commuteiq.pulse",
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
