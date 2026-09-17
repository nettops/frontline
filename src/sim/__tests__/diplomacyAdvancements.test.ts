/**
 * Five relationship mechanisms, each closing a real gap named against
 * WorldBox's diplomacy system while tracing F5 (rivals go inert once
 * matched) and F17 (the player always trails, so both paid and
 * strength-gated routes to a rival's goodwill stay locked). None of these
 * are probe-measured constants yet — every new BOND field is deliberately
 * conservative and flagged as such in config/diplomacy.ts.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { bond, canDo, declareWar, makePeace, tickBonds } from '../diplomacy';
import { BOND } from '../../config/diplomacy';
import type { GameState } from '../types';

function freshState(seed = 1): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

describe('tall poppy', () => {
  it('the strongest of three rivals draws extra grudge from the others', () => {
    // Territory influence is cleared so the unrelated contested-ground term
    // (also new this pass) cannot contribute and mask a mutation here.
    const state = freshState();
    state.factions.falcone.strength = 90;
    state.factions.vasari.strength = 40;
    state.factions.kestler.strength = 40;
    for (const t of Object.values(state.territories)) {
      t.influence.falcone = 0;
      t.influence.vasari = 0;
      t.influence.kestler = 0;
    }
    const before = bond(state, 'vasari', 'falcone').grudge;
    tickBonds(state, () => 0);
    expect(bond(state, 'vasari', 'falcone').grudge).toBeGreaterThan(before);
  });

  it('does not fire with only two organizations in play', () => {
    // Guards the >=3 gate: two evenly matched sides should not accrue this
    // term at all, since "the strongest of three" does not describe a pair.
    // Territory influence is cleared too, so the unrelated contested-ground
    // term (also new this pass) cannot contribute and confound the read.
    const state = freshState();
    state.factions.falcone.strength = 90;
    state.factions.vasari.strength = 40;
    delete (state.factions as Record<string, unknown>).kestler;
    for (const t of Object.values(state.territories)) {
      t.influence.falcone = 0;
      t.influence.vasari = 0;
    }
    tickBonds(state, () => 0);
    expect(bond(state, 'vasari', 'falcone').grudge).toBe(0);
  });
});

describe('common enemy', () => {
  it('two factions fighting the same third party build trust faster than an unrelated pair', () => {
    // Ordinary peaceful trust growth (BOND.trustPerPeacefulWeek) applies to
    // every peaceful pair regardless, so the read has to be the *difference*
    // between a pair with a shared enemy and one without — not just whether
    // trust went up at all.
    const state = freshState();
    declareWar(state, 'player', 'kestler');
    declareWar(state, 'falcone', 'kestler');
    const sharedBefore = bond(state, 'player', 'falcone').trust;
    const unrelatedBefore = bond(state, 'player', 'vasari').trust;
    tickBonds(state, () => 0);
    const sharedGain = bond(state, 'player', 'falcone').trust - sharedBefore;
    const unrelatedGain = bond(state, 'player', 'vasari').trust - unrelatedBefore;
    expect(sharedGain).toBeGreaterThan(unrelatedGain);
  });
});

describe('contested ground friction', () => {
  it('two factions holding the same district accrue ambient grudge with nothing else happening', () => {
    const state = freshState();
    state.territories['downtown'].influence.falcone = 40;
    state.territories['downtown'].influence.vasari = 30;
    const before = bond(state, 'falcone', 'vasari').grudge;
    tickBonds(state, () => 0);
    expect(bond(state, 'falcone', 'vasari').grudge).toBeGreaterThan(before);
  });
});

describe('respect from the strength gap', () => {
  it('the same target reads more respect from somebody far weaker than from somebody nearly equal', () => {
    // Falcone's own absolute strength — and so the old formula's entire
    // contribution — is identical in both readings. Only the *gap* differs:
    // kestler is far below falcone, vasari is close to it. The old formula
    // (target's absolute strength alone) would read these two identically.
    const state = freshState();
    state.factions.falcone.strength = 60;
    state.factions.vasari.strength = 55;
    state.factions.kestler.strength = 10;
    for (let i = 0; i < 30; i++) tickBonds(state, () => 0);
    const fromFarBelow = bond(state, 'kestler', 'falcone').respect;
    const fromNearlyEqual = bond(state, 'vasari', 'falcone').respect;
    expect(fromFarBelow).toBeGreaterThan(fromNearlyEqual);
  });
});

describe('truce timer', () => {
  it('refuses a fresh war on somebody peace was just made with, even at maximum grudge', () => {
    const state = freshState();
    declareWar(state, 'player', 'falcone');
    makePeace(state, 'player', 'falcone');
    bond(state, 'player', 'falcone').grudge = 100; // furious does not lift the truce
    const result = canDo(state, 'declare_war', 'falcone');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/peace/i);
  });

  it('the AI path is blocked the same way, silently, so no war starts under truce', () => {
    const state = freshState();
    declareWar(state, 'player', 'falcone');
    makePeace(state, 'player', 'falcone');
    declareWar(state, 'player', 'falcone');
    expect(bond(state, 'player', 'falcone').warSince).toBeNull();
  });

  it('allows a fresh war once the truce has run out', () => {
    const state = freshState();
    declareWar(state, 'player', 'falcone');
    makePeace(state, 'player', 'falcone');
    state.day += BOND.truceDays + 1;
    const result = canDo(state, 'declare_war', 'falcone');
    expect(result.ok).toBe(true);
  });
});
