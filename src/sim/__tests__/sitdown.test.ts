/**
 * The sit-down.
 *
 * These pin the three rules that stop it collapsing into either a lookup table
 * or a free lunch. They are written against the machine rather than the prose,
 * so rewriting any line of dialogue in config leaves them alone.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList } from '../npc';
import {
  availableRegisters,
  canSitDownWith,
  chooseRegister,
  clearSitdown,
  houseRead,
  houseStats,
  leaveSitdown,
  openSitdown,
  sitdownOptions,
} from '../sitdown';
import { bond } from '../diplomacy';
import { SITDOWN } from '../../config/sitdown';
import type { GameState, Npc } from '../types';

function game(seed = 4): GameState {
  return newGame({ name: 'Sit', difficulty: 'normal', seed });
}

function first(state: GameState): Npc {
  return crewList(state)[0];
}

/** Puts a man in a state where `listen` is certain to land. */
function aggrieved(npc: Npc): Npc {
  npc.stats.grievance = 80;
  return npc;
}

describe('the sit-down', () => {
  it('will not start two conversations at once', () => {
    const state = game();
    const npc = first(state);
    expect(openSitdown(state, 'crew', npc.id, 'settle').ok).toBe(true);
    expect(openSitdown(state, 'crew', npc.id, 'settle').ok).toBe(false);
  });

  it('will not sit down with the same man twice in a row', () => {
    const state = game();
    const npc = first(state);
    openSitdown(state, 'crew', npc.id, 'settle');
    leaveSitdown(state);
    clearSitdown(state);

    expect(canSitDownWith(state, npc.id).ok).toBe(false);
    state.day += SITDOWN.cooldownDays;
    expect(canSitDownWith(state, npc.id).ok).toBe(true);
  });

  it('ends after three exchanges', () => {
    const state = game();
    const rng = new Rng(state.rng);
    state.org.dirtyCash = 200_000;
    openSitdown(state, 'crew', first(state).id, 'settle');

    for (let i = 0; i < SITDOWN.beats; i++) {
      const options = availableRegisters(state);
      expect(options.length, `nothing to say at beat ${i + 1}`).toBeGreaterThan(0);
      chooseRegister(state, rng, options[0].id);
    }
    expect(state.sitdown?.done).toBe(true);
    expect(availableRegisters(state)).toHaveLength(0);
  });

  it('never offers the same register twice', () => {
    const state = game();
    const rng = new Rng(state.rng);
    openSitdown(state, 'crew', aggrieved(first(state)).id, 'settle');

    chooseRegister(state, rng, 'listen');
    expect(availableRegisters(state).some((r) => r.id === 'listen')).toBe(false);
  });

  // -- the rules -----------------------------------------------------------

  it('only puts the unlocked moves on the table once they are earned', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const npc = aggrieved(first(state));
    openSitdown(state, 'crew', npc.id, 'settle');

    // `name_it` needs the grievance to have surfaced.
    expect(availableRegisters(state).some((r) => r.id === 'name_it')).toBe(false);
    chooseRegister(state, rng, 'listen');
    expect(state.sitdown?.revealed).toContain('grievance');
    expect(availableRegisters(state).some((r) => r.id === 'name_it')).toBe(true);
  });

  it('does not unlock anything from a register that missed', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const npc = first(state);
    // Nothing to say and no grudge to say it about.
    npc.stats.grievance = 0;
    npc.stats.respectForBoss = 0;
    state.player.attributes.leadership = 0;
    openSitdown(state, 'crew', npc.id, 'settle');

    chooseRegister(state, rng, 'listen');
    expect(state.sitdown?.beats[0].landed).toBe(false);
    expect(state.sitdown?.revealed).toHaveLength(0);
    expect(availableRegisters(state).some((r) => r.id === 'name_it')).toBe(false);
  });

  it('teaches you something even when you read him wrong', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const npc = first(state);
    npc.stats.grievance = 0;
    npc.stats.respectForBoss = 0;
    state.player.attributes.leadership = 0;
    const before = npc.familiarity;

    openSitdown(state, 'crew', npc.id, 'settle');
    chooseRegister(state, rng, 'listen');

    expect(state.sitdown?.beats[0].landed).toBe(false);
    expect(npc.familiarity).toBeGreaterThan(before);
  });

  it('teaches you more when you read him right', () => {
    const missRun = game();
    const hitRun = game();
    const rngA = new Rng(missRun.rng);
    const rngB = new Rng(hitRun.rng);

    const miss = first(missRun);
    miss.stats.grievance = 0;
    miss.stats.respectForBoss = 0;
    missRun.player.attributes.leadership = 0;
    const missBefore = miss.familiarity;

    const hit = aggrieved(first(hitRun));
    const hitBefore = hit.familiarity;

    openSitdown(missRun, 'crew', miss.id, 'settle');
    chooseRegister(missRun, rngA, 'listen');
    openSitdown(hitRun, 'crew', hit.id, 'settle');
    chooseRegister(hitRun, rngB, 'listen');

    expect(hit.familiarity - hitBefore).toBeGreaterThan(miss.familiarity - missBefore);
  });

  it('reads the true stat, not the one the player can see', () => {
    // Two men with identical low familiarity — the player's read of them is
    // equally vague — but opposite grievances. The outcomes must differ.
    const state = game();
    const rng = new Rng(state.rng);
    const [a, b] = crewList(state).slice(0, 2);
    if (!b) return;
    a.familiarity = 5;
    b.familiarity = 5;
    a.stats.grievance = 90;
    b.stats.grievance = 0;
    b.stats.respectForBoss = 0;
    state.player.attributes.leadership = 0;

    openSitdown(state, 'crew', a.id, 'settle');
    chooseRegister(state, rng, 'listen');
    const landedOnA = state.sitdown!.beats[0].landed;
    leaveSitdown(state);
    clearSitdown(state);

    openSitdown(state, 'crew', b.id, 'settle');
    chooseRegister(state, rng, 'listen');
    const landedOnB = state.sitdown!.beats[0].landed;

    expect(landedOnA).toBe(true);
    expect(landedOnB).toBe(false);
  });

  it('makes a man with a grudge harder to reach any other way', () => {
    const calm = game();
    const sore = game();
    const rngA = new Rng(calm.rng);
    const rngB = new Rng(sore.rng);

    // Same regard, same boss, only the grudge differs.
    const c = first(calm);
    const s = first(sore);
    c.stats.respectForBoss = 46;
    s.stats.respectForBoss = 46;
    c.stats.grievance = 0;
    s.stats.grievance = 100;
    calm.player.attributes.leadership = 0;
    sore.player.attributes.leadership = 0;

    openSitdown(calm, 'crew', c.id, 'settle');
    chooseRegister(calm, rngA, 'level');
    openSitdown(sore, 'crew', s.id, 'settle');
    chooseRegister(sore, rngB, 'level');

    expect(calm.sitdown!.beats[0].landed).toBe(true);
    expect(sore.sitdown!.beats[0].landed).toBe(false);
  });

  // -- payouts -------------------------------------------------------------

  it('settles the grudge when that is what you came for and got', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const npc = aggrieved(first(state));
    const grievanceBefore = npc.stats.grievance;
    const loyaltyBefore = npc.stats.loyalty;

    openSitdown(state, 'crew', npc.id, 'settle');
    chooseRegister(state, rng, 'listen');
    chooseRegister(state, rng, 'name_it');
    leaveSitdown(state);

    expect(state.sitdown?.done).toBe(true);
    expect(npc.stats.grievance).toBeLessThan(grievanceBefore);
    expect(npc.stats.loyalty).toBeGreaterThan(loyaltyBefore);
  });

  it('pays nothing but the read when you do not get what you came for', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const npc = first(state);
    npc.stats.grievance = 0;
    npc.stats.respectForBoss = 0;
    state.player.attributes.leadership = 0;
    const loyaltyBefore = npc.stats.loyalty;

    openSitdown(state, 'crew', npc.id, 'settle');
    chooseRegister(state, rng, 'listen');
    leaveSitdown(state);

    expect(npc.stats.loyalty).toBe(loyaltyBefore);
    expect(state.sitdown?.outcome).toBeTruthy();
  });

  it('charges for a register that costs money whether or not it works', () => {
    const state = game();
    const rng = new Rng(state.rng);
    state.org.dirtyCash = 50_000;
    const before = state.org.dirtyCash;

    openSitdown(state, 'crew', first(state).id, 'settle');
    chooseRegister(state, rng, 'offer');
    expect(state.org.dirtyCash).toBeLessThan(before);
  });

  it('shows a register you cannot pay for rather than hiding it', () => {
    const state = game();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    openSitdown(state, 'crew', first(state).id, 'settle');

    const offer = sitdownOptions(state).find((o) => o.def.id === 'offer');
    expect(offer, 'the offer should still be listed').toBeTruthy();
    expect(offer!.disabledReason).toBeTruthy();
    expect(availableRegisters(state).some((r) => r.id === 'offer')).toBe(false);
  });

  it('keeps a locked register off the table entirely', () => {
    const state = game();
    openSitdown(state, 'crew', first(state).id, 'settle');
    // Not greyed out — absent. A disabled row would give away that there is
    // something to find.
    expect(sitdownOptions(state).some((o) => o.def.id === 'name_it')).toBe(false);
  });

  it('will not let you say something you cannot afford', () => {
    const state = game();
    const rng = new Rng(state.rng);
    state.org.cash = 0;
    state.org.dirtyCash = 0;

    openSitdown(state, 'crew', first(state).id, 'settle');
    const said = chooseRegister(state, rng, 'offer');
    expect(said.ok).toBe(false);
    expect(state.sitdown?.beats).toHaveLength(0);
  });

  // -- rivals --------------------------------------------------------------

  it('reads a house off its leader rather than off stored stats', () => {
    const state = game();
    const faction = state.factions['falcone'];
    if (!faction?.leader) return;

    faction.leader.bias.commerce = 1;
    const greedy = houseStats(state, 'falcone').greed;
    faction.leader.bias.commerce = -1;
    const stingy = houseStats(state, 'falcone').greed;

    expect(greedy).toBeGreaterThan(stingy);
  });

  it('moves a bond rather than a loyalty when it is a house', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const faction = state.factions['falcone'];
    if (!faction?.leader) return;

    // Make the two rival registers this needs certain to land.
    faction.bonds['player'] = { grudge: 0, respect: 60, trust: 0, warSince: null };
    faction.leader.bias.commerce = 1;
    state.org.dirtyCash = 200_000;

    const before = bond(state, 'player', 'falcone').trust;
    openSitdown(state, 'rival', 'falcone', 'deal');
    chooseRegister(state, rng, 'complain');
    expect(state.sitdown?.revealed).toContain('aired');
    chooseRegister(state, rng, 'terms');
    leaveSitdown(state);

    expect(bond(state, 'player', 'falcone').trust).toBeGreaterThan(before);
  });

  it('offers rival registers to a house and crew registers to a man', () => {
    const state = game();
    openSitdown(state, 'rival', 'falcone', 'intentions');
    const rivalIds = availableRegisters(state).map((r) => r.id);
    expect(rivalIds).toContain('sound_out');
    expect(rivalIds).not.toContain('listen');
    clearSitdown(state);

    openSitdown(state, 'crew', first(state).id, 'settle');
    const crewIds = availableRegisters(state).map((r) => r.id);
    expect(crewIds).toContain('listen');
    expect(crewIds).not.toContain('sound_out');
  });

  // -- saves ---------------------------------------------------------------

  it('survives a round trip through JSON', () => {
    const state = game();
    const rng = new Rng(state.rng);
    openSitdown(state, 'crew', aggrieved(first(state)).id, 'settle');
    chooseRegister(state, rng, 'listen');

    const back = JSON.parse(JSON.stringify(state)) as GameState;
    expect(back.sitdown?.beats).toHaveLength(1);
    expect(availableRegisters(back).some((r) => r.id === 'name_it')).toBe(true);
  });

  it('reads an absent field as nobody in the room', () => {
    const state = game();
    delete state.sitdown;
    expect(availableRegisters(state)).toHaveLength(0);
    expect(canSitDownWith(state, first(state).id).ok).toBe(true);
  });
});

describe('reading a house across a table', () => {
  it('gives the player something to choose against', () => {
    const state = newGame({ name: 'Sit', difficulty: 'normal', seed: 4 });
    const read = houseRead(state, 'falcone');
    expect(read.length).toBeGreaterThan(0);
    for (const chip of read) {
      expect(chip.text).toBeTruthy();
      // The whole point: words, never numbers.
      expect(chip.text).not.toMatch(/\d/);
    }
  });

  it('says something different about a different house', () => {
    const state = newGame({ name: 'Sit', difficulty: 'normal', seed: 4 });
    const falcone = state.factions['falcone'];
    const vasari = state.factions['vasari'];
    if (!falcone?.leader || !vasari?.leader) return;

    falcone.leader.bias.commerce = 1;
    vasari.leader.bias.commerce = -1;
    expect(houseRead(state, 'falcone')[0].text).not.toBe(houseRead(state, 'vasari')[0].text);
  });
});

/**
 * Telling a frightened man he is covered.
 *
 * `reassure` reads "tell them they are covered" and its landed line says some
 * of it goes out of their shoulders. It reduced grievance, because it reveals
 * `settled` like every closing register and settling is written in terms of a
 * grudge. A frightened man is not an aggrieved one.
 *
 * That gap was the only pressure in the game with no answer to it. Heat has
 * laying low and distance; a grudge has this conversation; being broke has the
 * job board. Measurement put heat-fear at -1.16 loyalty per crew-week — the
 * second largest force pulling a crew apart — and nothing addressed it.
 */
describe('a man who is frightened rather than owed', () => {
  it('is calmed by being told he is covered', () => {
    const state = game();
    const npc = crewList(state)[0];
    npc.stats.fear = 80;
    npc.stats.loyalty = 90;
    npc.stats.discipline = 5;
    npc.stats.grievance = 0;

    const before = npc.stats.fear;
    openSitdown(state, 'crew', npc.id, 'settle');
    // Straight to it: the register is only on the table once he is read as
    // afraid, so the reveal is forced rather than played for.
    state.sitdown!.revealed.push('afraid');
    const ok = chooseRegister(state, new Rng(state.rng), 'reassure');

    expect(ok.ok, ok.message).toBe(true);
    expect(npc.stats.fear).toBeLessThan(before);
  });

  it('does not calm anybody when the words do not land', () => {
    /*
       The register is a bet like every other one. A man who does not believe
       you is not less frightened for having been told, and his own line says
       so: "they say they know. They do not know."
    */
    const state = game();
    const npc = crewList(state)[0];
    npc.stats.fear = 1;
    npc.stats.discipline = 95;
    npc.stats.respectForBoss = 0;
    npc.stats.grievance = 90;
    state.player.attributes.leadership = 0;

    const before = npc.stats.fear;
    openSitdown(state, 'crew', npc.id, 'settle');
    state.sitdown!.revealed.push('afraid');
    chooseRegister(state, new Rng(state.rng), 'reassure');

    expect(npc.stats.fear).toBe(before);
  });
});
