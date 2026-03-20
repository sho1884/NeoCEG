import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// PWA: Check for service worker updates on startup and reload if updated
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.update().then(() => {
      if (registration.waiting) {
        // New SW is waiting — tell it to activate immediately
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });
  // When a new SW takes over, reload to use updated assets
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
