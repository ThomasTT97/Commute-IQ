
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Native Service Worker Registration for reliable auto-updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then((registration) => {
        console.log('Commute IQ: ServiceWorker registered');

        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Check for updates when the app is focused/visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update();
          }
        });

        // Handle the case where an update is found and installed
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.onstatechange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available; notify the UI via custom event
                window.dispatchEvent(new CustomEvent('commute-iq-update-ready', { detail: newWorker }));
              }
            };
          }
        };
      })
      .catch((error) => {
        console.error('Commute IQ: ServiceWorker registration failed:', error);
      });
  });

  // Listener to reload when the new Service Worker becomes active
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      window.location.reload();
      refreshing = true;
    }
  });
}

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
