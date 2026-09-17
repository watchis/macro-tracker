import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyStoredTheme } from './theme/useTheme';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Avoids a light-theme flash before React mounts.
applyStoredTheme();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
