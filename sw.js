
/**
 * Commute IQ Service Worker Legacy
 * Note: This file is now redundant as vite-plugin-pwa manages the active service-worker.js.
 * We keep this file to ensure any old registrations are correctly overtaken by the new system.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
