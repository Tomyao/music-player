import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from '@/App';
import { PlayerProvider } from '@/hooks/usePlayer';
import { ToastProvider } from '@/hooks/useToast';
import '@/styles/tailwind.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
