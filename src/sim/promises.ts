/**
 * Keeping your word, or not.
 *
 * The design lives in `config/promises.ts`. This is the machine: it records
 * what was said, notices when it was honoured, and settles the ones that ran
 * out of time.
 *
 * It deliberately owns no consequence of its own. Breaking a promise writes a
 * memory, and the memory system already feeds the informant gate, the poaching
 * gate and the succession claim — so a man who was lied to becomes reachable by
 * a rival and useful to an investigator without this file knowing that either
 * of those systems exists.
 */

import { clamp } from './rng';
import type { GameState, Id, Promised } from './types';
import { PROMISE, PROMISES, type PromiseKind } from '../config/promises';
import { addLog } from './util';
import { addNote } from './npc';
import { remember } from './memory';

function list(state: GameState): Promised[] {
  if (!state.promises) state.promises = [];
  return state.promises;
}

/** Everything still outstanding to this man. */
export function promisesTo(state: GameState, npcId: Id): Promised[] {
  return (state.promises ?? []).filter((p) => p.npcId === npcId);
}

export function daysLeft(state: GameState, promise: Promised): number {
  return Math.max(0, promise.dueDay - state.day);
}

/**
 * You said it. It is on the books now.
 *
 * Saying the same thing twice does not stack — it extends. A man who is told
 * again that he has the next one hears one promise, not two, and the second
 * telling is what resets his patience.
 */
export function makePromise(state: GameState, npcId: Id, kind: PromiseKind): void {
  const def = PROMISES[kind];
  if (!def) return;
  const all = list(state);
  const existing = all.find((p) => p.npcId === npcId && p.kind === kind);
  if (existing) {
    existing.madeDay = state.day;
    existing.dueDay = state.day + def.days;
    return;
  }
  all.push({ npcId, kind, madeDay: state.day, dueDay: state.day + def.days });
}

/**
 * He got what he was told he would get.
 *
 * Called from wherever the keeping act happens — putting him on a job, in the
 * one case that exists — rather than inferred here, because the act is the
 * promise and only the caller knows it took place.
 */
export function keepPromise(state: GameState, npcId: Id, kind: PromiseKind): boolean {
  const all = list(state);
  const at = all.findIndex((p) => p.npcId === npcId && p.kind === kind);
  if (at === -1) return false;
  all.splice(at, 1);
  settle(state, npcId, kind, true);
  return true;
}

function settle(state: GameState, npcId: Id, kind: PromiseKind, kept: boolean): void {
  const npc = state.npcs[npcId];
  if (!npc) return;
  if (npc.status === 'dead' || npc.status === 'defected') return;

  if (kept) {
    npc.stats.loyalty = clamp(npc.stats.loyalty + PROMISE.keptLoyalty, 0, 100);
    npc.stats.grievance = clamp(npc.stats.grievance + PROMISE.keptGrievance, 0, 100);
    remember(npc, state.day, 'word_kept');
    addNote(npc, state.day, 'You said a thing and then it happened.', 'good');
    addLog(state, `${npc.name} got what they were told they would get.`, 'crew');
    return;
  }

  npc.stats.loyalty = clamp(npc.stats.loyalty + PROMISE.brokenLoyalty, 0, 100);
  npc.stats.grievance = clamp(npc.stats.grievance + PROMISE.brokenGrievance, 0, 100);
  npc.stats.respectForBoss = clamp(npc.stats.respectForBoss + PROMISE.brokenRespect, 0, 100);
  remember(npc, state.day, 'word_broken');
  addNote(npc, state.day, PROMISES[kind].broken, 'bad');
  addLog(state, `${npc.name} ${PROMISES[kind].brokenLog}`, 'crew');
}

/**
 * The deadline passing, and the things that go wrong before it.
 *
 * Which way a lapse goes is the promise's own business — see `keptByDoing`. A
 * promise of an act fails on silence; a promise of protection is *kept* by a
 * month in which nothing happened, and the only reason it is still on the books
 * at all is that nothing did.
 *
 * "Nothing happened" is read off his memories rather than hooked into the
 * dozen paths that could hurt a man. Those paths already write down what they
 * did to him — an arrest, an injury, a week he was not paid — and reading that
 * record here means a route added next year breaks the promise without knowing
 * promises exist. It also keeps this module below the memory system rather than
 * tangled into it.
 */
export function tickPromises(state: GameState): void {
  const all = list(state);
  if (all.length === 0) return;

  const remaining: Promised[] = [];
  for (const promise of all) {
    const npc = state.npcs[promise.npcId];
    if (!npc || npc.status === 'dead' || npc.status === 'defected') continue;

    /*
       The promises kept by an absence, broken early by the thing happening.

       `brokenBy` used to be a constant in this file naming three memory kinds,
       which was right while `covered` was the only promise of its shape. It is
       the table's business now: "you are covered" fails when something happens
       to him, "I will handle it" fails when what he complained about happens
       again, and this loop does not need to know the difference.
    */
    const breaks = PROMISES[promise.kind].brokenBy;
    if (
      breaks &&
      npc.memories.some((m) => m.day >= promise.madeDay && breaks.includes(m.kind))
    ) {
      settle(state, promise.npcId, promise.kind, false);
      continue;
    }

    if (state.day < promise.dueDay) {
      remaining.push(promise);
      continue;
    }
    settle(state, promise.npcId, promise.kind, !PROMISES[promise.kind].keptByDoing);
  }
  state.promises = remaining;
}
