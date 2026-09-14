/**
 * What a real, sustained gap in whose pitches keep getting approved does to
 * the capo the boss has been comparatively ignoring.
 *
 * `capoPitches.ts` already keeps a permanent, growing record of every pitch
 * ever offered, per capo, with a verdict — `state.capoPitches`. That is the
 * whole signal this reads: each real capo's share of his own settled
 * pitches (`approved`, `rejected`, or `expired` — `open` has no verdict yet)
 * that came back `approved`. No new stored state for the history itself, the
 * same way `capoTension.ts` spends nothing new reading `capoStanding`.
 *
 * Promotions among a capo's own reports (`Npc.reportsTo`) were the brief's
 * other suggested signal, and were deliberately left out rather than folded
 * in: a promotion count is a small integer with no natural 0..1 scale, and
 * combining it with an approved share would mean inventing a weight nobody
 * has measured — exactly the kind of number `capoStanding.ts`'s own header
 * declines to invent for a different reason. Reported here as a considered
 * gap rather than built reflexively.
 *
 * Two more consequences the design brief names — other capos growing wary of
 * the favored one, and the favored one himself growing entitled or dependent
 * — are also not built here. The first would need a second, three-way
 * comparison this phase's own brief did not ask for; the second has no
 * existing "entitlement" concept anywhere in the game to hang a cheap read
 * off, unlike `grievance`/`respectForBoss` for the capo on the losing end.
 * Both are named findings for a later phase, not silent omissions.
 *
 * No dice anywhere in this file: a share either clears the gap or it does
 * not, and where two or more capos would qualify as disfavored in the same
 * week, they are all handled in `activeCapos`' own stable order — never a
 * pick among them.
 *
 * `isPitchDisfavored`, below, closes a third consequence the design brief
 * names — "he stops bringing you his best" — once a capo has registered as
 * disfavored `CAPO_FAVORITISM.pitchDisfavorAfter` times (`seedFollowup`,
 * util.ts). `capoPitches.ts` reads it to skew his own attribution weight
 * down for as long as it holds, distinct in kind from the grievance/respect
 * tick `applyFavoritism` already charges: that is a stat cost on the man
 * himself, this is a change in what the organization gets from him.
 */

import type { GameState, Id, Npc } from './types';
import { clamp } from './rng';
import { addNote } from './npc';
import { remember } from './memory';
import { seedFollowup } from './util';
import { activeCapos } from './capoTension';
import { PROMOTION } from '../config/npcs';
import { CAPO_FAVORITISM } from '../config/capoFavoritism';

/** `state.flags` key `seedFollowup` counts a capo's own disfavor streak under. */
function pitchDisfavorKey(capoId: Id): string {
  return `capo_pitch_disfavor:${capoId}`;
}

/**
 * Whether this capo has registered as disfavored often enough, recently
 * enough, that `capoPitches.ts` should read him as bringing less.
 *
 * Combines two things that already exist rather than storing a third:
 * `favoritismNoticedDay` for recency — the identical `cooldownDays` window
 * `applyFavoritism` itself gates its own refiring on, so the read lapses on
 * its own once the gap stops recurring — and `seedFollowup`'s own count on
 * `state.flags`, incremented once per real notice below. The consequence
 * fires later, in a different file; this is only the read.
 */
export function isPitchDisfavored(state: GameState, capoId: Id): boolean {
  const npc = state.npcs[capoId];
  if (!npc || npc.favoritismNoticedDay === undefined) return false;
  if (state.day - npc.favoritismNoticedDay >= CAPO_FAVORITISM.cooldownDays) return false;
  return (state.flags[pitchDisfavorKey(capoId)] ?? 0) >= CAPO_FAVORITISM.pitchDisfavorAfter;
}

interface CapoFavor {
  capoId: Id;
  approvedShare: number;
}

/** His own settled track record, or `null` if there is not yet enough of it to read. */
function favorRead(state: GameState, capoId: Id): CapoFavor | null {
  const settled = (state.capoPitches ?? []).filter(
    (p) => p.capoId === capoId && p.status !== 'open',
  );
  if (settled.length < CAPO_FAVORITISM.minSettled) return null;

  const approved = settled.filter((p) => p.status === 'approved').length;
  return { capoId, approvedShare: approved / settled.length };
}

/**
 * Lands the gap on the ignored capo, unless he already registered it inside
 * `CAPO_FAVORITISM.cooldownDays` — read straight off his own
 * `favoritismNoticedDay`, the same idiom `capoVouches.ts`'s cooldown reads
 * `vouchDeferredDay` instead of a second, parallel schedule.
 *
 * Magnitudes are `PROMOTION`'s own, run in reverse: being passed over for
 * recognition is the mirror of being promoted for it, and `PROMOTION` already
 * sizes both the grievance a boss's notice relieves and the respect it buys.
 */
function applyFavoritism(state: GameState, disfavored: Npc, favored: Npc): void {
  if (
    disfavored.favoritismNoticedDay !== undefined &&
    state.day - disfavored.favoritismNoticedDay < CAPO_FAVORITISM.cooldownDays
  ) {
    return;
  }

  disfavored.stats.grievance = clamp(
    disfavored.stats.grievance + PROMOTION.grievanceRelief,
    0,
    100,
  );
  disfavored.stats.respectForBoss = clamp(
    disfavored.stats.respectForBoss - PROMOTION.respectForBossGain,
    0,
    100,
  );
  disfavored.favoritismNoticedDay = state.day;

  // Counts this notice toward `isPitchDisfavored`, above — the same
  // "tolerated twice" shape `events.ts`'s skimming ripple and `eventgen.ts`'s
  // short-take ripple already use, applied here to a capo's own disfavor
  // streak. Ignores the return: nothing acts on it here, since the
  // consequence (capoPitches.ts skewing his weight) is read independently.
  seedFollowup(state, pitchDisfavorKey(disfavored.id), CAPO_FAVORITISM.pitchDisfavorAfter);

  // Reuses `left_on_the_bench` rather than inventing a memory kind — it
  // already reads as "watched the work go to other people", which is exactly
  // what a run of approved pitches going somewhere else is, and it already
  // feeds `standing.ts`'s own bench mark, arcs, goals, and the `handled`
  // promise's `brokenBy` list, so this plugs into four existing consumers
  // instead of needing a fifth.
  remember(disfavored, state.day, 'left_on_the_bench');
  addNote(
    disfavored,
    state.day,
    `Watched ${favored.name} get the nod again. It is always him lately.`,
    'bad',
  );
}

/**
 * Weekly pass over every real capo with enough settled pitches to have a
 * track record: whoever has the best approval share this week is the
 * favored man, and anyone far enough behind him by `CAPO_FAVORITISM.shareGap`
 * carries it as a real grudge against the boss. Wired into `advanceDay`
 * right after `checkCapoPowerImbalance` — the identical weekly slot, for the
 * identical reason.
 */
export function checkCapoFavoritism(state: GameState): void {
  if (state.day % CAPO_FAVORITISM.checkIntervalDays !== 0) return;

  const reads = activeCapos(state)
    .map((c) => favorRead(state, c.id))
    .filter((r): r is CapoFavor => r !== null);
  if (reads.length < 2) return;

  const favored = reads.reduce((best, r) => (r.approvedShare > best.approvedShare ? r : best));
  const favoredNpc = state.npcs[favored.capoId];
  if (!favoredNpc) return;

  for (const r of reads) {
    if (r.capoId === favored.capoId) continue;
    if (favored.approvedShare - r.approvedShare < CAPO_FAVORITISM.shareGap) continue;
    const npc = state.npcs[r.capoId];
    if (npc) applyFavoritism(state, npc, favoredNpc);
  }
}
