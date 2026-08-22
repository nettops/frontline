/**
 * Everything this game puts in the browser, in one place.
 *
 * There are four keys and they were declared in three files: `mafia:save:<n>`
 * in sim/save.ts, `mafia:muted` in ui/audio.ts, `mafia:skin` in ui/skin.ts.
 * Four string literals in three modules is the shape a namespace collision
 * arrives in — and, more immediately, it meant nobody could answer "what does
 * this game store" without grepping for a colon.
 *
 * The prefix deliberately does **not** change. Renaming it would orphan every
 * save anybody already has, and a save file is the one thing in a game nobody
 * gets to be tidy about. What changes is that there is now exactly one place
 * that knows the name, so the next person who wants to rename it has one edit
 * and an obvious place to write the migration.
 *
 * Reads and writes are wrapped because localStorage throws rather than failing
 * quietly in a private window and on a full disk, and a settings toggle must
 * not be able to take down the page.
 */

/**
 * The namespace, and the one thing that is allowed to change it.
 *
 * `mafia` for every ordinary run, so no save anybody has is orphaned. A
 * harnessed playtest starts Vite with `VITE_RUN_ID` set, and everything it
 * writes lands under `mafia:run-<id>:` instead — a different port alone is not
 * isolation, because two dev servers on the same host share an origin's
 * storage often enough to matter, and because a tester who opens the wrong
 * port should find an empty menu rather than somebody's career.
 *
 * This exists because a real save was nearly overwritten during round 7: the
 * brief asked politely for a backup, which is not a mechanism.
 */
const RUN = import.meta.env.VITE_RUN_ID?.trim();
const PREFIX = RUN ? `mafia:run-${RUN}` : 'mafia';

/** Which storage namespace this page is using, for the harness to report. */
export const NAMESPACE = PREFIX;

export const KEYS = {
  save: (slot: string) => `${PREFIX}:save:${slot}`,
  muted: `${PREFIX}:muted`,
  skin: `${PREFIX}:skin`,
} as const;

export function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to be done and nothing worth saying.
  }
}
