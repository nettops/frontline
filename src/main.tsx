import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './styles/theme.css';

/*
   There is one skin, and it is the ledger.

   The terminal skin is built and parked: `styles/crt.css` and `ui/skin.ts` are
   both still on disk and neither is imported, so Vite emits neither. Turning
   it back on is three lines — the two imports above and an `applySkin()` call
   here — plus a switch somewhere a player can reach. `ui/__tests__/skin.test.ts`
   guards the parked state and will fail the moment any of that comes back,
   which is the point: it should be a decision, not a merge.
*/

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
