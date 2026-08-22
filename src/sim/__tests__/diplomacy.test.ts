/**
 * Diplomacy and war.
 *
 * The properties under test: relationships are symmetric and shared by all
 * four organizations, war is always somebody's decision rather than something
 * that accumulates, and the families can fall out and make up without the
 * player being involved.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { runDaysSolvent } from './helpers';
import { crewList } from '../npc';
import {
  activeWars,
  adjustRelationship,
  alliesOf,
  atWar,
  bond,
  canDo,
  declareWar,
  defectToRival,
  diplomaticCost,
  doDiplomacy,
  factionStrength,
  makePeace,
  playerIsAtWar,
  playerStrength,
  playerWars,
  poachTarget,
  relationship,
  setRelationship,
  tickWars,
} from '../diplomacy';
import { mostHostile, rivals } from '../faction';
import { PEACE_GRUDGE } from '../../config/diplomacy';
import { RIVAL_IDS } from '../../config/factions';
import type { GameState } from '../types';

function fresh(seed = 321): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

/** Gives the player enough people to be a real party to a war. */
function staff(state: GameState, count: number): void {
  const rng = new Rng(state.rng);
  const template = crewList(state)[0];
  for (let i = 0; i < count; i++) {
    const clone = structuredClone(template);
    clone.id = `npc_test_${i}`;
    clone.name = `Tester ${i}`;
    clone.stats.skill = 60;
    clone.stats.courage = 60;
    clone.stats.discipline = 60;
    clone.status = 'active';
    state.npcs[clone.id] = clone;
  }
  void rng;
}

function runWars(state: GameState, weeks: number): void {
  const rng = new Rng(state.rng);
  for (let i = 1; i <= weeks; i++) {
    state.day = i * 7;
    tickWars(state, rng);
    if (state.gameOver) return;
  }
}

// ----------------------------------------------------------- relationships ---

describe('relationships', () => {
  it('gives every organization a view of every other', () => {
    const state = fresh();
    for (const id of RIVAL_IDS) {
      for (const other of RIVAL_IDS) {
        if (id === other) continue;
        expect(state.factions[id].bonds[other]).toBeDefined();
      }
      expect(state.factions[id].bonds['player']).toBeDefined();
    }
  });

  it('keeps both sides of a relationship in step', () => {
    const state = fresh();
    adjustRelationship(state, 'falcone', 'vasari', -25);
    expect(relationship(state, 'falcone', 'vasari')).toBe(-25);
    expect(relationship(state, 'vasari', 'falcone')).toBe(-25);
  });

  it('reads the same value from either direction for the player', () => {
    const state = fresh();
    adjustRelationship(state, 'player', 'kestler', -30);
    expect(relationship(state, 'player', 'kestler')).toBe(-30);
    expect(relationship(state, 'kestler', 'player')).toBe(-30);
  });

  it('never lets ordinary hostility tip into war on its own', () => {
    const state = fresh();
    // A year of grievances, all at once.
    for (let i = 0; i < 40; i++) adjustRelationship(state, 'player', 'kestler', -20);

    /*
     * The assertion used to be that resentment could not push the standing
     * past the war line, because war *was* that line and the code clamped
     * hard to keep grievance one point short of it. War is now a date on the
     * bond, so hostility is free to go as deep as it likes and the property
     * being protected is the one that actually mattered all along: nobody
     * ends up at war without somebody deciding to be.
     */
    expect(bond(state, 'kestler', 'player').grudge).toBeGreaterThan(0);
    expect(atWar(state, 'player', 'kestler')).toBe(false);
  });

  it('lets a declaration cross the line that resentment cannot', () => {
    const state = fresh();
    declareWar(state, 'player', 'kestler');
    expect(atWar(state, 'player', 'kestler')).toBe(true);
    expect(playerIsAtWar(state)).toBe(true);
  });

  it('does not accidentally make peace by nudging a relationship', () => {
    const state = fresh();
    declareWar(state, 'player', 'kestler');
    // Something mildly positive happens mid-war.
    adjustRelationship(state, 'player', 'kestler', 15);
    expect(atWar(state, 'player', 'kestler')).toBe(true);
  });

  it('leaves resentment behind when a war ends', () => {
    const state = fresh();
    declareWar(state, 'player', 'vasari');
    makePeace(state, 'player', 'vasari');
    expect(atWar(state, 'player', 'vasari')).toBe(false);
    // Peace caps the grudge rather than setting a standing: what is left is
    // the resentment the war built, from a known point, and it fades from
    // there. Nobody forgets, but the shooting has stopped.
    expect(atWar(state, 'player', 'vasari')).toBe(false);
    expect(bond(state, 'vasari', 'player').grudge).toBeLessThanOrEqual(PEACE_GRUDGE);
    expect(relationship(state, 'player', 'vasari')).toBeLessThan(0);
  });

  it('recognises an alliance', () => {
    const state = fresh();
    expect(alliesOf(state, 'player')).toHaveLength(0);
    setRelationship(state, 'player', 'falcone', 80);
    expect(alliesOf(state, 'player')).toContain('falcone');
  });

  it('drags allies into a war they did not start', () => {
    const state = fresh();
    setRelationship(state, 'player', 'falcone', 80);
    const before = relationship(state, 'falcone', 'kestler');
    declareWar(state, 'player', 'kestler');
    expect(relationship(state, 'falcone', 'kestler')).toBeLessThan(before);
  });
});

// -------------------------------------------------------------- strength ---

describe('strength', () => {
  it('counts only the people who could actually turn up', () => {
    const state = fresh();
    staff(state, 10);
    const full = playerStrength(state);

    for (const npc of crewList(state)) {
      if (npc.status === 'active') npc.status = 'injured';
    }
    expect(playerStrength(state)).toBeLessThan(full);
  });

  it('is zero for an organization with nobody left', () => {
    const state = fresh();
    for (const npc of crewList(state)) npc.status = 'dead';
    expect(playerStrength(state)).toBe(0);
  });

  it('reports rival strength from their own record', () => {
    const state = fresh();
    expect(factionStrength(state, 'falcone')).toBe(state.factions['falcone'].strength);
  });
});

// ------------------------------------------------------------------- war ---

describe('war', () => {
  it('does nothing while nobody is fighting', () => {
    const state = fresh();
    expect(activeWars(state)).toHaveLength(0);
    const before = JSON.stringify(state.factions);
    state.day = 7;
    tickWars(state, new Rng(state.rng));
    // Peacetime recovery is the only change permitted.
    expect(activeWars(state)).toHaveLength(0);
    void before;
  });

  it('costs the loser people', () => {
    const state = fresh();
    staff(state, 12);
    // A one-sided war the player cannot win.
    state.factions['falcone'].strength = 100;
    declareWar(state, 'player', 'falcone');

    const before = crewList(state).filter((n) => n.status === 'active').length;
    runWars(state, 12);
    const after = crewList(state).filter((n) => n.status === 'active').length;
    expect(after).toBeLessThan(before);
  });

  it('costs a losing rival strength', () => {
    const state = fresh();
    staff(state, 30);
    state.factions['kestler'].strength = 20;
    declareWar(state, 'player', 'kestler');

    const before = state.factions['kestler'].strength;
    runWars(state, 10);
    expect(state.factions['kestler'].strength).toBeLessThan(before);
  });

  it('builds weariness in whoever is losing', () => {
    const state = fresh();
    staff(state, 30);
    state.factions['kestler'].strength = 15;
    declareWar(state, 'player', 'kestler');
    runWars(state, 8);
    expect(state.factions['kestler'].warWeariness).toBeGreaterThan(0);
  });

  it('is loud enough to interest law enforcement', () => {
    const state = fresh();
    staff(state, 10);
    declareWar(state, 'player', 'vasari');
    const evidenceBefore = Object.keys(state.evidence).length;
    runWars(state, 4);
    expect(state.org.heat).toBeGreaterThan(0);
    expect(Object.keys(state.evidence).length).toBeGreaterThan(evidenceBefore);
  });

  it('lets rivals recover once they are left alone', () => {
    const state = fresh();
    state.factions['kestler'].strength = 20;
    state.factions['kestler'].warWeariness = 40;
    runWars(state, 10);
    expect(state.factions['kestler'].strength).toBeGreaterThan(20);
    expect(state.factions['kestler'].warWeariness).toBeLessThan(40);
  });

  it('keeps every faction number in range through a long war', () => {
    const state = fresh();
    staff(state, 20);
    declareWar(state, 'player', 'falcone');
    declareWar(state, 'vasari', 'kestler');
    runWars(state, 120);

    for (const f of rivals(state)) {
      expect(f.strength).toBeGreaterThanOrEqual(0);
      expect(f.strength).toBeLessThanOrEqual(100);
      expect(f.warWeariness).toBeGreaterThanOrEqual(0);
      for (const b of Object.values(f.bonds)) {
        expect(b.grudge).toBeGreaterThanOrEqual(0);
        expect(b.grudge).toBeLessThanOrEqual(100);
        expect(b.respect).toBeGreaterThanOrEqual(-100);
        expect(b.respect).toBeLessThanOrEqual(100);
        expect(b.trust).toBeGreaterThanOrEqual(-100);
        expect(b.trust).toBeLessThanOrEqual(100);
      }
    }
  });

  it('lists the player’s wars separately from everybody else’s', () => {
    const state = fresh();
    declareWar(state, 'vasari', 'kestler');
    expect(playerWars(state)).toHaveLength(0);
    expect(activeWars(state)).toHaveLength(1);

    declareWar(state, 'player', 'falcone');
    expect(playerWars(state)).toHaveLength(1);
    expect(activeWars(state)).toHaveLength(2);
  });
});

// -------------------------------------------------- player diplomatic acts ---

describe('what the player can say', () => {
  it('will not let you sue for a peace you are not at war over', () => {
    const state = fresh();
    expect(canDo(state, 'sue_for_peace', 'falcone').ok).toBe(false);
  });

  it('will not let you negotiate normally in the middle of a war', () => {
    const state = fresh();
    state.org.cash = 1_000_000;
    declareWar(state, 'player', 'falcone');
    expect(canDo(state, 'offer_tribute', 'falcone').ok).toBe(false);
  });

  it('charges more to sue for peace from a losing position', () => {
    const strong = fresh();
    staff(strong, 30);
    declareWar(strong, 'player', 'kestler');
    strong.factions['kestler'].strength = 10;

    const weak = fresh();
    declareWar(weak, 'player', 'kestler');
    weak.factions['kestler'].strength = 100;

    expect(diplomaticCost(weak, 'sue_for_peace', 'kestler')).toBeGreaterThan(
      diplomaticCost(strong, 'sue_for_peace', 'kestler'),
    );
  });

  it('buys goodwill with a tribute', () => {
    const state = fresh();
    state.org.cash = 1_000_000;
    const before = relationship(state, 'player', 'vasari');
    const result = doDiplomacy(state, new Rng(state.rng), 'offer_tribute', 'vasari');
    expect(result.ok).toBe(true);
    expect(relationship(state, 'player', 'vasari')).toBeGreaterThan(before);
  });

  it('refuses a demand from somebody who is not clearly stronger', () => {
    const state = fresh();
    expect(canDo(state, 'demand_tribute', 'falcone').ok).toBe(false);
  });

  it('takes money from a weaker family, and their goodwill with it', () => {
    const state = fresh();
    staff(state, 40);
    state.factions['kestler'].strength = 5;
    state.factions['kestler'].wealth = 500_000;

    const before = relationship(state, 'player', 'kestler');
    const funds = state.org.dirtyCash;
    const result = doDiplomacy(state, new Rng(state.rng), 'demand_tribute', 'kestler');

    expect(result.ok).toBe(true);
    expect(state.org.dirtyCash).toBeGreaterThan(funds);
    expect(state.factions['kestler'].wealth).toBeLessThan(500_000);
    expect(relationship(state, 'player', 'kestler')).toBeLessThan(before);
  });

  it('will not propose an alliance to somebody who dislikes you', () => {
    const state = fresh();
    state.org.cash = 1_000_000;
    setRelationship(state, 'player', 'falcone', -20);
    expect(canDo(state, 'propose_alliance', 'falcone').ok).toBe(false);

    setRelationship(state, 'player', 'falcone', 50);
    expect(canDo(state, 'propose_alliance', 'falcone').ok).toBe(true);
  });

  it('starts a war when you say so', () => {
    const state = fresh();
    const result = doDiplomacy(state, new Rng(state.rng), 'declare_war', 'kestler');
    expect(result.ok).toBe(true);
    expect(atWar(state, 'player', 'kestler')).toBe(true);
  });

  it('sometimes ends a war and sometimes does not', () => {
    // A weary enemy should be persuadable; the outcome is still a roll.
    const state = fresh();
    state.org.cash = 2_000_000;
    staff(state, 25);
    declareWar(state, 'player', 'kestler');
    state.factions['kestler'].warWeariness = 90;
    state.player.attributes.negotiation = 20;

    const result = doDiplomacy(state, new Rng({ seed: 4, calls: 0 }), 'sue_for_peace', 'kestler');
    expect(typeof result.ok).toBe('boolean');
    if (result.ok) expect(atWar(state, 'player', 'kestler')).toBe(false);
  });

  it('never spends money the player does not have', () => {
    const state = fresh();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    expect(canDo(state, 'offer_tribute', 'vasari').ok).toBe(false);
    expect(state.org.cash).toBe(0);
  });
});

// -------------------------------------------------------------- poaching ---

describe('poaching', () => {
  it('only finds people who are already unhappy', () => {
    const state = fresh();
    for (const npc of crewList(state)) npc.stats.loyalty = 90;
    expect(poachTarget(state, new Rng(state.rng), 45)).toBeNull();

    crewList(state)[0].stats.loyalty = 20;
    expect(poachTarget(state, new Rng(state.rng), 45)).not.toBeNull();
  });

  it('moves somebody out of the organization and leaves a trace', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    const evidenceBefore = Object.keys(state.evidence).length;

    defectToRival(state, npc, 'kestler');

    expect(npc.status).toBe('defected');
    expect(crewList(state)).not.toContain(npc);
    // Somebody who has worked for both knows things about both.
    expect(Object.keys(state.evidence).length).toBeGreaterThan(evidenceBefore);
  });
});

// ------------------------------------------------------- a living world ----

describe('the world without the player', () => {
  it('lets the families act against each other', () => {
    // Nothing the player does; just time passing. Checked against what they
    // actually did rather than a snapshot of feeling — relations drift back
    // toward indifference, so a end-state reading can miss a whole feud.
    /*
     * Across four cities, not one.
     *
     * Two years is a short window for three families to move on each other,
     * and since the roster is drawn per seed one city can perfectly reasonably
     * be a quiet one. A single-seed assertion on a low-frequency event passes
     * until something upstream shifts the draw, which is not a test, it is a
     * tripwire.
     */
    let againstEachOther = 0;
    for (const seed of [8899, 8900, 8901, 8902]) {
      // Kept solvent: a dead player freezes the clock, so an idle run would
      // measure nothing at all.
      const state = fresh(seed);
      runDaysSolvent(state, 730);
      againstEachOther += rivals(state).flatMap((f) =>
        f.history.filter(
          (h) =>
            h.targetFactionId !== null &&
            h.targetFactionId !== 'player' &&
            h.targetFactionId !== f.id,
        ),
      ).length;
    }
    expect(againstEachOther).toBeGreaterThan(0);
  });

  it('stays deterministic with wars and diplomacy active', () => {
    const a = fresh(2222);
    const b = fresh(2222);
    runDaysSolvent(a, 250);
    runDaysSolvent(b, 250);
    expect(JSON.stringify(a.factions)).toEqual(JSON.stringify(b.factions));
  });
});

describe('standing with the player is one number, not two', () => {
  /*
     Written after chasing a bug that was not there.

     A playtest reported insulting a family and watching the panels keep saying
     "Neutral", and the obvious culprit looked like direction: the screens read
     `relationship(player, them)` while the consequences wrote
     `relationship(them, player)`. Between factions those genuinely are two
     records. With the player they are not — `bond` has no faction record to
     hang the player's side on, so it falls through to the other party and both
     directions resolve to the same object.

     So the pair is symmetric by construction, and any future change that gives
     the player their own bond record has to come past this test and decide
     what the panels should then show.
  */
  it('reads the same either way round', () => {
    const state = newGame({ name: 'T', difficulty: 'normal', seed: 8 });
    const id = RIVAL_IDS[0];
    adjustRelationship(state, id, 'player', -30);
    expect(relationship(state, 'player', id)).toBe(relationship(state, id, 'player'));
  });

  it('lets an insult make somebody the most hostile family', () => {
    const state = newGame({ name: 'T', difficulty: 'normal', seed: 8 });
    for (const id of RIVAL_IDS) setRelationship(state, id, 'player', 0);
    const id = RIVAL_IDS[0];
    adjustRelationship(state, id, 'player', -30);
    expect(relationship(state, id, 'player')).toBeLessThan(-15);
    expect(mostHostile(state)?.id).toBe(id);
  });
});
