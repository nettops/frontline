/**
 * Remembering specific things.
 *
 * A leaf module: it takes an Npc and a day and nothing else, so every system
 * that causes something memorable — operations, the economy, crew management,
 * investigations, war — can record one without importing anything that imports
 * back.
 *
 * The rule that keeps this honest is that recording a memory has no immediate
 * effect. The event that caused it already charged for itself when it
 * happened; what a memory adds is the ability of a *later* decision to look
 * back and find a specific reason, which is the thing a grievance score could
 * never do.
 */

import { clamp } from './rng';
import type { Id, Memory, Npc } from './types';
import { MAX_MEMORIES, MEMORIES, RECALL, type MemoryKind } from '../config/memories';
import { DAYS_PER_YEAR } from '../config/economy';

/**
 * What a memory is worth today.
 *
 * Fades toward a floor rather than to nothing. That gap is the difference
 * between forgetting and forgiving: eight years on, a man who was left inside
 * for three months is no longer angry about it and has still not forgotten it,
 * and the fraction that remains is enough to tip a close decision.
 */
export function weightOf(memory: Memory, day: number): number {
  const def = MEMORIES[memory.kind];
  if (!def) return 0;
  const years = Math.max(0, (day - memory.day) / DAYS_PER_YEAR);
  return Math.max(def.floor, memory.weight - years * def.fadePerYear);
}

/**
 * Records that something happened to him.
 *
 * `about` is the other person involved, where there was one — the man who got
 * the promotion, the friend who was killed. It is what lets a memory be *about*
 * somebody rather than merely bad.
 */
export function remember(
  npc: Npc,
  day: number,
  kind: MemoryKind,
  about: Id | null = null,
  scale = 1,
): void {
  const def = MEMORIES[kind];
  if (!def) return;

  npc.memories.unshift({
    kind,
    day,
    aboutId: about,
    weight: clamp(def.weight * scale, 0, 100),
  });

  if (npc.memories.length > MAX_MEMORIES) {
    // Drop the faintest rather than the oldest. A twelve-year-old betrayal is
    // exactly the one worth keeping; last month's missed payday is not.
    npc.memories.sort((a, b) => weightOf(b, day) - weightOf(a, day));
    npc.memories.length = MAX_MEMORIES;
  }
}

/** Everything he is carrying, on the day it is being asked about. */
export function ledger(npc: Npc, day: number): { good: number; bad: number } {
  let good = 0;
  let bad = 0;
  for (const memory of npc.memories) {
    const weight = weightOf(memory, day);
    if (MEMORIES[memory.kind]?.tone === 'good') good += weight;
    else bad += weight;
  }
  return { good, bad };
}

/**
 * The ledger as a single number, -1..1.
 *
 * Negative is a man with reasons. Positive is a man who has been looked after
 * and knows it. Zero is most people most of the time, and is not the same as
 * a man with nothing on either side — it is a man with something on both.
 */
export function balance(npc: Npc, day: number): number {
  const { good, bad } = ledger(npc, day);
  return clamp((good - bad) / RECALL.fullAt, -1, 1);
}

/** Whether he is carrying a specific kind of thing, and how heavily. */
export function recalls(npc: Npc, day: number, kind: MemoryKind): number {
  return npc.memories
    .filter((m) => m.kind === kind)
    .reduce((sum, m) => sum + weightOf(m, day), 0);
}

/** ...and whether any of it is about one particular person. */
export function recallsAbout(npc: Npc, day: number, aboutId: Id): number {
  return npc.memories
    .filter((m) => m.aboutId === aboutId)
    .reduce(
      (sum, m) => sum + weightOf(m, day) * (MEMORIES[m.kind]?.tone === 'good' ? 1 : -1),
      0,
    );
}

// ------------------------------------------------------------- the reads ---

function between(value: number, atWorst: number, atBest: number): number {
  // value is -1..1; map onto the two ends with 1 in the middle.
  return value < 0 ? 1 + -value * (atWorst - 1) : 1 + value * (atBest - 1);
}

/** How much easier or harder his history makes him to buy. */
export function poachableFromMemory(npc: Npc, day: number): number {
  return between(balance(npc, day), RECALL.poachableAtWorst, RECALL.poachableAtBest);
}

/**
 * How much likelier his history makes him to talk.
 *
 * The most dangerous read in the file, and the one that makes the whole system
 * worth having: an investigator sitting across a table from somebody you left
 * inside for three months is having a very different conversation from one
 * sitting across from somebody whose family you paid for.
 */
export function informFromMemory(npc: Npc, day: number): number {
  return between(balance(npc, day), RECALL.informAtWorst, RECALL.informAtBest);
}

/** What the room remembers of him, when it is choosing who is next. */
export function claimFromMemory(npc: Npc, day: number): number {
  return balance(npc, day) * RECALL.claimSwing;
}

// ------------------------------------------------------------ perception ---

export interface MemoryRead {
  text: string;
  tone: 'good' | 'bad';
  day: number;
  /** True while it is still heavy enough to be driving anything. */
  raw: boolean;
}

/**
 * What he would tell you about, if you knew him well enough to ask.
 *
 * Gated high on purpose. This is the most intimate thing the crew sheet
 * shows — not what he is like, but what has been done to him — and a man does
 * not list his grievances for somebody he has known a fortnight.
 */
export function readMemories(npc: Npc, day: number, limit = 4): MemoryRead[] {
  if (npc.familiarity < RECALL.visibleAbove) return [];

  return [...npc.memories]
    .sort((a, b) => weightOf(b, day) - weightOf(a, day))
    .slice(0, limit)
    .map((memory) => {
      const def = MEMORIES[memory.kind];
      const weight = weightOf(memory, day);
      return {
        text: def.text,
        tone: def.tone,
        day: memory.day,
        // Still at more than half of what it started as: he has not moved on.
        raw: weight > def.weight * 0.5,
      };
    });
}
