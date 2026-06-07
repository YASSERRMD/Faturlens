import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { DeviceProfileProvider } from './capability/useDeviceProfile.tsx';
import { ErrorBoundary } from './ui/ErrorBoundary.tsx';
import './ui/tokens.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <DeviceProfileProvider>
        <App />
      </DeviceProfileProvider>
    </ErrorBoundary>
  </StrictMode>,
);
