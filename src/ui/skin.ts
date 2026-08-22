/**
 * Which skin the interface is wearing.
 *
 * Two, and the default is the one the game was designed in: warm tobacco-dark,
 * brass used sparingly, paper reserved for the one document the game hands you.
 * The other is `crt` — an IBM DOS terminal, CGA grey on black, behind a
 * phosphor tube.
 *
 * The whole switch is one attribute on `<html>`. Everything downstream of it
 * lives in styles/crt.css and is expressed as token overrides, because
 * theme.css uses `var(--…)` 238 times against ten hardcoded colours and that is
 * exactly the property a second skin needs it to have. Nothing in the
 * simulation knows this file exists.
 *
 * Same shape as audio.ts on purpose: a module-level value, a localStorage key,
 * a getter and a setter. There is no settings object and no context provider,
 * because there are two settings in this entire game and both of them are a
 * boolean.
 */

import { KEYS, read as readKey, write } from '../storage';

export type Skin = 'ledger' | 'crt';

const STORAGE_KEY = KEYS.skin;

let skin: Skin = read();

function read(): Skin {
  return readKey(STORAGE_KEY) === 'crt' ? 'crt' : 'ledger';
}

export function currentSkin(): Skin {
  return skin;
}

export function setSkin(next: Skin): void {
  skin = next;
  apply();
  write(STORAGE_KEY, next);
}

/**
 * Puts the attribute on the document, and makes sure the glass exists.
 *
 * Called once at startup before React mounts, and again on every change. On
 * `<html>` rather than on the app root so the page background, the scrollbars
 * and the fixed tube overlay are all inside it — a CRT with a warm brown
 * gutter down the side is not a CRT.
 */
export function apply(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.skin = skin;
  ensureTube();
}

/**
 * The tube, as one inert DOM node beside the React root.
 *
 * Not a component, on purpose. App has three separate return branches — title
 * screen, game over, and the game — and the glass has to sit above all three
 * plus the memo modal, so as a component it would have to be threaded through
 * every one of them and kept above a stacking context it does not own. It also
 * never re-renders and holds no state: it is a property of the skin, which is
 * what this file is.
 *
 * CSS hides it whenever the skin is not `crt`, so it costs a `display: none`
 * div the rest of the time.
 */
function ensureTube(): void {
  if (document.querySelector('.tube')) return;
  const tube = document.createElement('div');
  tube.className = 'tube';
  tube.setAttribute('aria-hidden', 'true');
  const roll = document.createElement('div');
  roll.className = 'tube-roll';
  tube.appendChild(roll);
  document.body.appendChild(tube);
}
