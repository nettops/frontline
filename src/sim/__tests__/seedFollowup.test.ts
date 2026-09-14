/**
 * One thing seeding a different, later thing, instead of resolving as a
 * one-shot.
 *
 * `heir_gone` (npc.ts) and the collective-defection cascade (`followDeparture`,
 * ties.ts) already have this shape: a state change elsewhere in the tick
 * ripples forward rather than stopping at the man it happened to.
 * `seedFollowup` (util.ts) is that shape pulled out and applied to two more
 * places that had it and were not using it — a capo forgiven for skimming,
 * and a steward whose short take was let go, should each be capable of
 * seeding it worse, on somebody else, later.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { resolveEvent, EVENT_DEF_BY_ID } from '../events';
import { GEN_DEFS } from '../eventgen';
import { pushEvent, seedFollowup } from '../util';
import { territoryList } from '../territory';
import type { GameState, Npc, PendingEvent } from '../types';

function game(seed = 21): GameState {
  return newGame({ name: 'Followup', difficulty: 'normal', seed });
}

function withCrew(state: GameState, extra: number): Npc[] {
  const made: Npc[] = [];
  for (let i = 0; i < extra; i++) {
    const npc = generateNpc(state, new Rng({ seed: 555, calls: i * 30 }), 'soldier');
    state.npcs[npc.id] = npc;
    made.push(npc);
  }
  return made;
}

describe('seedFollowup', () => {
  it('counts, and only says yes once the count is enough', () => {
    const state = game();
    expect(seedFollowup(state, 'test_key', 3)).toBe(false);
    expect(seedFollowup(state, 'test_key', 3)).toBe(false);
    expect(seedFollowup(state, 'test_key', 3)).toBe(true);
    // And it keeps counting rather than resetting, so a caller that never
    // consumes the true can still notice it happened again.
    expect(seedFollowup(state, 'test_key', 3)).toBe(true);
  });

  it('keys are independent', () => {
    const state = game();
    expect(seedFollowup(state, 'a', 1)).toBe(true);
    expect(seedFollowup(state, 'b', 2)).toBe(false);
  });
});

describe('a capo forgiven for skimming, twice', () => {
  function put(state: GameState, npc: Npc): PendingEvent {
    const rng = new Rng({ seed: 3, calls: 0 });
    return pushEvent(state, EVENT_DEF_BY_ID['skim_discovered'].build(state, rng, { npc }));
  }

  it('spreads to somebody else on the crew once tolerated enough', () => {
    const state = game();
    const [skimmer, clean] = withCrew(state, 2);
    skimmer.isSkimming = true;
    skimmer.skimTotal = 5_000;
    expect(clean.isSkimming).toBe(false);

    const rng = new Rng({ seed: 4, calls: 0 });
    resolveEvent(state, rng, put(state, skimmer).id, 'watch');
    // Tolerated once: nothing has spread yet.
    expect(crewList(state).some((n) => n.id !== skimmer.id && n.isSkimming)).toBe(false);

    resolveEvent(state, rng, put(state, skimmer).id, 'watch');
    // Tolerated twice: somebody else on the crew starts too, worse.
    const spread = crewList(state).find((n) => n.id !== skimmer.id && n.isSkimming);
    expect(spread, 'nobody else started skimming after two tolerances').toBeTruthy();
    expect(spread!.skimTotal).toBeGreaterThan(skimmer.skimTotal);
  });
});

describe('a steward whose short take was let go, twice', () => {
  function put(state: GameState, npc: Npc, territoryId: string): PendingEvent {
    const rng = new Rng({ seed: 5, calls: 0 });
    const def = GEN_DEFS.find((d) => d.id === 'gen_the_take_is_short')!;
    const t = state.territories[territoryId];
    return pushEvent(state, def.build(state, rng, { npc, territory: t }));
  }

  it('spreads to a different steward once let go enough', () => {
    const state = game();
    const [bent, otherSteward] = withCrew(state, 2);
    bent.isSkimming = true;
    bent.skimTotal = 2_000;
    otherSteward.isSkimming = false;

    const territories = territoryList(state);
    territories[0].stewardId = bent.id;
    territories[1].stewardId = otherSteward.id;

    const rng = new Rng({ seed: 6, calls: 0 });
    resolveEvent(state, rng, put(state, bent, territories[0].id).id, 'let_it_go');
    expect(otherSteward.isSkimming).toBe(false);

    resolveEvent(state, rng, put(state, bent, territories[0].id).id, 'let_it_go');
    expect(otherSteward.isSkimming, 'a different steward should have started too').toBe(true);
  });
});
