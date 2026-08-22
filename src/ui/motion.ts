/**
 * Motion helpers.
 *
 * The one thing the interface animates for its own sake is numbers, and it
 * does that for a reason: pressing "+1 week" changes eight figures at once, and
 * a figure that changes instantly is a figure you did not see change. Counting
 * it toward the new value is what makes the week legible in the stat bar
 * instead of only in the log.
 *
 * Everything here checks the reduced-motion preference at the moment it runs
 * rather than at import, so a player who changes the system setting mid-game
 * gets the new behaviour on the next tick without reloading.
 */

import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export type Direction = 'up' | 'down' | null;

/** How long the colour of a change lingers after the count has finished. */
const FLASH_MS = 900;

/**
 * Counts toward a new value and reports which way it went.
 *
 * The direction outlives the count on purpose. The count tells you a number
 * moved; the colour tells you whether that was good news, and you need a beat
 * longer to read the second thing than the first.
 */
/**
 * How long a number takes to travel to its new value.
 *
 * Exported because anything reading the stat bar programmatically has to wait
 * this out. The dev harness read a balance 32ms after a payment and reported
 * $2,400 for a figure that was $700 — a true number, in flight.
 */
export const COUNTER_MS = 420;

export function useCounter(target: number, ms = COUNTER_MS): { value: number; dir: Direction } {
  const [value, setValue] = useState(target);
  const [dir, setDir] = useState<Direction>(null);
  const shown = useRef(target);

  useEffect(() => {
    const from = shown.current;
    if (from === target) return;
    setDir(target > from ? 'up' : 'down');
    const clearFlash = window.setTimeout(() => setDir(null), FLASH_MS);

    if (prefersReducedMotion()) {
      shown.current = target;
      setValue(target);
      return () => window.clearTimeout(clearFlash);
    }

    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      // Ease out: most of the distance early, so the number settles rather
      // than crawling. A linear count reads like a slot machine.
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * eased;
      shown.current = next;
      setValue(next);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    /*
     * Land on the truth even if no frames ever arrive.
     *
     * A browser suspends requestAnimationFrame entirely for a page it is not
     * compositing — a background tab, an occluded window. Without this the
     * count never runs, and the stat bar goes on displaying the figures from
     * before the turn: not un-animated, actually wrong. Caught exactly that
     * way, showing $2.4K clean when the player had nothing.
     *
     * Timers are throttled in the background but they do still fire, so this
     * is the one guarantee available. The animation is decoration; the number
     * being right is not.
     */
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      shown.current = target;
      setValue(target);
    }, ms + 120);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.clearTimeout(clearFlash);
    };
  }, [target, ms]);

  return { value, dir };
}
