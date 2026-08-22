/**
 * The whole state layer.
 *
 * State is one mutable object; React is told to re-render by bumping a version
 * counter. That is all a game like this needs — the simulation already owns
 * its own consistency, and immutable copies of a state containing thousands of
 * NPCs would be pure waste.
 */

import { useSyncExternalStore } from 'react';
import type { GameState } from './sim/types';
import { AUTOSAVE_SLOT, saveGame } from './sim/save';

let state: GameState | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): GameState | null {
  return state;
}

export function setGame(next: GameState | null): void {
  state = next;
  emit();
}

/**
 * Runs a simulation function against the live state and re-renders.
 * Every player action goes through here, so there is exactly one place where
 * the game changes and one place that decides to autosave.
 */
export function mutate<T>(fn: (state: GameState) => T, autosave = false): T | undefined {
  if (!state) return undefined;
  const result = fn(state);
  if (autosave) saveGame(state, AUTOSAVE_SLOT);
  emit();
  return result;
}

/** Re-renders on every state change. Reads the live object. */
export function useGame(): GameState {
  useSyncExternalStore(subscribe, () => version, () => version);
  if (!state) throw new Error('useGame called with no game loaded');
  return state;
}

/** For the shell, which renders before a game exists. */
export function useOptionalGame(): GameState | null {
  useSyncExternalStore(subscribe, () => version, () => version);
  return state;
}
