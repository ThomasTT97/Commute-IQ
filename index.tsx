
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// vite-plugin-pwa handles the service worker registration automatically via 'injectRegister: auto' in vite.config.js
// We do not need to manually register /sw.js here as it conflicts with the generated worker.

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
