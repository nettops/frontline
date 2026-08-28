/**
 * What the ground you hold is actually for.
 *
 * A leaf module: it reads what territory and delegation already keep, derives
 * everything on read, and imports nothing that imports it back. There is no
 * state here and no tick — a yield is a fact about the map this morning, not a
 * thing that accumulates.
 *
 * The complaint that started this was that the territory screen "just tells
 * you what and who" — twelve districts that are mechanically one object with
 * different numbers on it, some slots and a discount on heat. Every blurb in
 * `config/territories.ts` has been saying what its place is for since the day
 * it was written, and nothing ever read them. Now something does.
 *
 * **Holding is not the same as having the use of it.** A district with nobody
 * standing in it keeps its influence and yields nothing. That is the whole
 * reason you will not end up holding the map: every district you want the use
 * of costs you a man, permanently, out of the same crew your jobs are drawn
 * from. Hold everything and nobody is earning.
 *
 * Said plainly because it was asked for: **you are not supposed to hold
 * everything.** The old design got that result by apathy — nothing rewarded
 * expanding and nothing punished sitting still. This gets it by making each
 * district a thing you wanted for a reason, with the reasons competing for the
 * same men.
 */

import type { GameState } from './types';
import { controlLevel, territoryList } from './territory';
import { DISTRICT_YIELD, HOLDING, YIELDS, type YieldKind } from '../config/holdings';

/** What that place gives, whether or not you hold it. */
export function yieldOf(territoryId: string): YieldKind | undefined {
  return DISTRICT_YIELD[territoryId];
}

/**
 * Ground you hold outright *and* have somebody running.
 *
 * Both halves are load-bearing. `control` is the bar because a foothold is not
 * the place being yours in any sense the street would recognise, and a steward
 * is the bar because an empty district is a line on a map.
 */
export function workingHoldings(state: GameState) {
  return territoryList(state).filter((t) => {
    if (!t.stewardId) return false;
    const level = controlLevel(t);
    return level === 'control' || level === 'dominance';
  });
}

/** Every kind you have the use of today. */
export function yieldsHeld(state: GameState): YieldKind[] {
  const out = new Set<YieldKind>();
  for (const t of workingHoldings(state)) {
    const kind = yieldOf(t.id);
    if (kind) out.add(kind);
  }
  return [...out];
}

/**
 * What this kind is worth to you right now, as a share.
 *
 * The first district of a kind pays `HOLDING.share`; each one after it pays a
 * fraction of that. Without the taper the answer is always "take the two
 * cheapest of whichever yield you like best" and the map stops being a set of
 * choices — you would simply pick a favourite and double it.
 *
 * A share rather than a flat figure because the six land on six systems with
 * six different scales, and every consumer multiplies it into a quantity it
 * already understands rather than having a number handed to it from here.
 */
export function holdingShare(state: GameState, kind: YieldKind): number {
  const held = workingHoldings(state).filter((t) => yieldOf(t.id) === kind).length;
  if (held === 0) return 0;
  return HOLDING.share * (1 + (held - 1) * HOLDING.secondShare);
}

/** The label and the sentence, for a panel that wants to say what a place is for. */
export function yieldRead(territoryId: string) {
  const kind = yieldOf(territoryId);
  return kind ? YIELDS[kind] : undefined;
}
