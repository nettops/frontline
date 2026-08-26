/**
 * What a district pays the man who owns it.
 *
 * Three things were wrong, and together they are why holding ground felt
 * unrewarding:
 *
 * 1. **Control was invisible.** `districtWorth` read raw influence on a
 *    straight line. Crossing from a foothold into control — the word on the
 *    screen changing, the thing the whole territory system is *about* —
 *    changed the money by a fraction and nothing else. `controlLevel` did not
 *    appear anywhere in `delegation.ts`.
 *
 * 2. **The man was invisible.** Nothing in the payout read leadership,
 *    discipline or loyalty. A trustworthy, capable steward and a useless one
 *    returned the identical multiplier for the identical action; his stats
 *    only chose *which* action he took. Being good at running a district was
 *    worth nothing.
 *
 * 3. **Money vanished for no reason.** The best honest action, `work`, had
 *    `earn: 0.9` — ten per cent gone with nobody taking it. The ledger showed
 *    a shrinkage no character caused, which makes the one instrument the
 *    player has for catching a thief lie to them by default.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { districtWorth, putInCharge, stewardReturn } from '../delegation';
import { STEWARD_ACTION_BY_ID } from '../../config/delegation';
import type { GameState, Npc } from '../types';

function game(seed = 6): GameState {
  const state = newGame({ name: 'Ground', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 8) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  return state;
}

function at(state: GameState, influence: number) {
  const t = state.territories['northside'];
  t.influence.player = influence;
  t.prosperity = 60;
  return t;
}

function man(state: GameState, leadership: number, discipline: number): Npc {
  const npc = crewList(state).find((n) => n.status === 'active' && n.role === 'soldier')!;
  npc.stats.leadership = leadership;
  npc.stats.discipline = discipline;
  npc.stats.loyalty = 80;
  return npc;
}

describe('what the ground is worth', () => {
  it('pays more for a district you control than one you have a toe in', () => {
    const state = game();
    const foothold = districtWorth(at(state, 30));
    const control = districtWorth(at(state, 55));
    const dominance = districtWorth(at(state, 85));

    expect(control).toBeGreaterThan(foothold);
    expect(dominance).toBeGreaterThan(control);
  });

  /*
     A step at the threshold, not just a slope.

     Influence already moved the money on a straight line, so "more influence
     pays more" was true before any of this and is not what was missing. What
     was missing is that the *word on the screen* means something: the jump
     from foothold to control has to be felt, or the control tiers are
     decoration.
  */
  it('makes crossing into control a step rather than a slope', () => {
    const state = game();
    const justUnder = districtWorth(at(state, 49));
    const justOver = districtWorth(at(state, 51));
    const slope = districtWorth(at(state, 47)) - districtWorth(at(state, 45));

    expect(
      justOver - justUnder,
      'crossing into control paid no more than any other two points of influence',
    ).toBeGreaterThan(slope * 2);
  });
});

describe('what the man is worth', () => {
  it('returns more under somebody who can actually run a place', () => {
    const state = game();
    at(state, 60);
    const able = man(state, 85, 85);
    putInCharge(state, able.id, 'northside');
    const good = stewardReturn(state, state.territories['northside'], STEWARD_ACTION_BY_ID['work']);

    const other = game();
    at(other, 60);
    const poor = man(other, 15, 15);
    putInCharge(other, poor.id, 'northside');
    const bad = stewardReturn(other, other.territories['northside'], STEWARD_ACTION_BY_ID['work']);

    expect(good, 'a capable steward returned no more than a useless one').toBeGreaterThan(bad);
  });

  /*
     And nothing disappears on its own.

     `work` used to return 0.9 — a tenth of the money gone with nobody taking
     it. Skimming is how money goes missing in this game, and an unexplained
     shrinkage on top of it makes the ledger useless as the instrument for
     catching a thief.
  */
  it('hands over everything when nobody is stealing', () => {
    expect(
      STEWARD_ACTION_BY_ID['work'].earn,
      'the honest action still loses money to nobody',
    ).toBeGreaterThanOrEqual(1);
    expect(STEWARD_ACTION_BY_ID['work'].takes).toBe(0);
  });

  it('still loses you what a thief takes', () => {
    const skim = STEWARD_ACTION_BY_ID['skim'];
    expect(skim.takes).toBeGreaterThan(0);
    expect(skim.earn * (1 - skim.takes)).toBeLessThan(STEWARD_ACTION_BY_ID['work'].earn);
  });
});

describe('whether it is worth a man at all', () => {
  /*
     The complaint that started this, as arithmetic.

     A steward is a man off the board and a wage on the books. If the district
     pays less than his wage, handing it over is a donation — and at
     `worthPerWeek: 420` a district at good influence returned about $370 a week
     against a soldier's $300, which is why it never felt worth doing.
  */
  it('pays a controlled district more than the man running it costs', () => {
    const state = game();
    at(state, 70);
    const npc = man(state, 70, 70);
    putInCharge(state, npc.id, 'northside');

    const weekly = stewardReturn(state, state.territories['northside'], STEWARD_ACTION_BY_ID['work']);
    expect(
      weekly,
      'a district you control pays less than the wage of the man watching it',
    ).toBeGreaterThan(npc.wage);
  });
});
