import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { apply as applySkin } from './ui/skin';
import './styles/theme.css';
import './styles/crt.css';

// Before the first paint, so a player who chose the terminal does not get one
// frame of the ledger on the way in.
applySkin();

/*
   The script-driver's harness, in dev only.

   `import.meta.env.DEV` is a literal Vite replaces at build time, so the
   dynamic import below is dead code in a production bundle and the module is
   never emitted. Nothing about the shipped game knows this file exists.
*/
if (import.meta.env.DEV) {
  void import('./dev/harness').then((h) => h.mount());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
