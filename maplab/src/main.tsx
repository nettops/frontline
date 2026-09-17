import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MapLabApp from './MapLabApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MapLabApp />
  </StrictMode>,
);
