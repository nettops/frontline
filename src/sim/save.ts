/**
 * Save and load.
 *
 * State is plain JSON by construction, so this is stringify/parse plus a
 * version check and enough metadata to render a load screen. No migration
 * framework until there is a real save worth migrating.
 */

import type { GameMode, GameState } from './types';
import { SAVE_VERSION } from './state';
import { rankNow } from './rank';
import { DIFFICULTY_BY_ID } from '../config/difficulty';
import { crewList } from './npc';
import { formatShortDay } from './util';
import { KEYS, read as readKey, remove as removeKey, write as writeKey } from '../storage';

// The key name lives in storage.ts, which is the only module that knows what
// this game is called as far as the browser is concerned.
const key = (slot: SlotId) => KEYS.save(slot);
export const SLOTS = ['1', '2', '3'] as const;
export const AUTOSAVE_SLOT = 'auto';
export type SlotId = (typeof SLOTS)[number] | typeof AUTOSAVE_SLOT;

export interface SaveMeta {
  slot: SlotId;
  name: string;
  rank: string;
  difficulty: string;
  /** Which of the three this save belongs to — a Simulation save otherwise
   *  reads as a career that went catastrophically wrong on day one. */
  mode: GameMode;
  day: number;
  date: string;
  cash: number;
  crew: number;
  heat: number;
  savedAt: number;
}

interface SaveFile {
  meta: SaveMeta;
  state: GameState;
}

function buildMeta(state: GameState, slot: SlotId): SaveMeta {
  return {
    slot,
    name: state.player.name,
    /*
       The live reading, not the stored field.

       This row was the only place in the entire interface that printed a
       rank, and it printed `player.rank` — which nothing ever assigns, so it
       said Street Criminal for the life of every career. Round 16 had three
       testers find that independently and all three filed it as the thing
       that broke their sense of progress.
    */
    rank: rankNow(state).name,
    difficulty: DIFFICULTY_BY_ID[state.difficulty].name,
    mode: state.mode,
    day: state.day,
    date: formatShortDay(state.day),
    cash: Math.round(state.org.cash + state.org.dirtyCash),
    crew: crewList(state).length,
    heat: Math.round(state.org.heat),
    savedAt: Date.now(),
  };
}

export function saveGame(state: GameState, slot: SlotId): { ok: boolean; error?: string } {
  try {
    const file: SaveFile = { meta: buildMeta(state, slot), state };
    if (!writeKey(key(slot), JSON.stringify(file))) {
      return { ok: false, error: 'Could not write save. Storage is full or unavailable.' };
    }
    return { ok: true };
  } catch (err) {
    // Quota exceeded or storage unavailable (private mode). Both are real and
    // the player needs to know the save did not happen.
    return { ok: false, error: err instanceof Error ? err.message : 'Could not write save.' };
  }
}

export function loadGame(slot: SlotId): { ok: true; state: GameState } | { ok: false; error: string } {
  const raw = readKey(key(slot));
  if (!raw) return { ok: false, error: 'That slot is empty.' };

  let file: SaveFile;
  try {
    file = JSON.parse(raw) as SaveFile;
  } catch {
    return { ok: false, error: 'That save is corrupted and cannot be read.' };
  }

  const version = file.state?.version;
  if (version !== SAVE_VERSION) {
    return {
      ok: false,
      error: `That save is from an incompatible version (save v${version ?? '?'}, game v${SAVE_VERSION}).`,
    };
  }
  if (!validate(file.state)) {
    return { ok: false, error: 'That save is missing data and cannot be loaded.' };
  }

  return { ok: true, state: file.state };
}

/** Cheap shape check — catches truncated writes and hand-edited files. */
function validate(state: GameState): boolean {
  return (
    typeof state.day === 'number' &&
    typeof state.nextId === 'number' &&
    !!state.player &&
    !!state.org &&
    !!state.rng &&
    typeof state.rng.seed === 'number' &&
    typeof state.rng.calls === 'number' &&
    !!state.npcs &&
    !!state.activeOperations &&
    !!state.territories &&
    !!state.businesses &&
    !!state.factions &&
    !!state.law &&
    !!state.law.investigations &&
    Array.isArray(state.log) &&
    Array.isArray(state.pendingEvents)
  );
}

function readMeta(slot: SlotId): SaveMeta | null {
  const raw = readKey(key(slot));
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as SaveFile).meta ?? null;
  } catch {
    return null;
  }
}

export function allMeta(): Record<SlotId, SaveMeta | null> {
  const out = {} as Record<SlotId, SaveMeta | null>;
  for (const slot of [...SLOTS, AUTOSAVE_SLOT] as SlotId[]) {
    out[slot] = readMeta(slot);
  }
  return out;
}

export function deleteSave(slot: SlotId): void {
  removeKey(key(slot));
}
