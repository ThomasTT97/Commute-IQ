
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Automatically update the service worker when a new one is found.
// This is critical for iOS home screen PWAs which often get stuck on old versions.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Force a full reload to ensure the new assets from the updated service worker are active
    if (confirm("A new version is available. Update now?")) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log('Commute IQ: System ready for offline operation.');
  },
});

// Periodically check for updates every hour
setInterval(() => {
  updateSW();
}, 60 * 60 * 1000);

// Also check for updates when the app becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateSW();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
