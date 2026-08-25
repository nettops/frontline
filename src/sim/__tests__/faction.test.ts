/**
 * Rival AI.
 *
 * The claim being tested is that the families *decide* rather than follow a
 * script: the same code produces different behaviour when the board differs,
 * and different behaviour per family when only the personality weights differ.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { runDaysSolvent } from './helpers';
import {
  contestedWith,
  factionInfluence,
  factionIntel,
  mostHostile,
  noteInfluenceTaken,
  readFaction,
  relationshipLabel,
  rivals,
  tickFactions,
} from '../faction';
import { playerInfluence, territoryList } from '../territory';
import { relationship, setRelationship } from '../diplomacy';
import { HOME_TERRITORY } from '../../config/territories';
import {
  FACTION_DECISION_INTERVAL_DAYS,
  RIVAL_IDS,
  type FactionId,
  type FactionPersonality,
} from '../../config/factions';
import { leaderPersonality } from '../leaders';
import type { FactionActionKind, GameState } from '../types';

function fresh(seed = 909): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

/**
 * Runs `weeks` of faction decisions and nothing else.
 * Days must land on the decision interval or the loop never fires.
 */
function runFactions(state: GameState, weeks: number): void {
  const rng = new Rng(state.rng);
  for (let i = 1; i <= weeks; i++) {
    state.day = i * FACTION_DECISION_INTERVAL_DAYS;
    tickFactions(state, rng);
  }
}

function actionCounts(state: GameState, id: string): Record<FactionActionKind, number> {
  const counts: Record<FactionActionKind, number> = {
    expand: 0,
    pressure: 0,
    invest: 0,
    consolidate: 0,
    diplomacy: 0,
    poach: 0,
  };
  for (const action of state.factions[id].history) counts[action.kind] += 1;
  return counts;
}

// ------------------------------------------------------------------ setup ---

describe('faction setup', () => {
  it('creates the three rival families with their config baselines', () => {
    const state = fresh();
    expect(rivals(state)).toHaveLength(3);
    for (const id of RIVAL_IDS) {
      expect(state.factions[id].wealth).toBeGreaterThan(0);
      expect(relationship(state, 'player', id)).toBe(0);
    }
  });

  it('does not put the player in the faction table', () => {
    const state = fresh();
    expect(state.factions['player']).toBeUndefined();
  });
});

// -------------------------------------------------------------- decisions ---

describe('rival decisions', () => {
  it('acts on its own initiative without the player doing anything', () => {
    const state = fresh();
    runFactions(state, 30);
    const total = rivals(state).reduce((sum, f) => sum + f.history.length, 0);
    expect(total).toBeGreaterThan(10);
  });

  it('only decides on its own schedule', () => {
    const state = fresh();
    const rng = new Rng(state.rng);
    state.day = 3; // not a decision day
    tickFactions(state, rng);
    expect(rivals(state).every((f) => f.history.length === 0)).toBe(true);
  });

  it('goes quiet when its own heat gets dangerous', () => {
    const state = fresh();
    // Same board, but every family is under pressure.
    for (const f of rivals(state)) f.heat = 95;
    runFactions(state, 6);

    for (const f of rivals(state)) {
      const counts = actionCounts(state, f.id);
      expect(counts.consolidate).toBeGreaterThan(0);
      // And heat should be coming down as a result.
      expect(f.heat).toBeLessThan(95);
    }
  });

  it('never spends money it does not have', () => {
    const state = fresh();
    for (const f of rivals(state)) f.wealth = 0;

    // They earn each week, so the guarantee is not "a broke family does
    // nothing" — it is that nobody ever goes into the red to act.
    const rng = new Rng(state.rng);
    for (let week = 1; week <= 60; week++) {
      state.day = week * FACTION_DECISION_INTERVAL_DAYS;
      tickFactions(state, rng);
      for (const f of rivals(state)) {
        expect(f.wealth, `${f.id} went into the red`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('does not reach for an expensive move while broke', () => {
    const state = fresh();
    // Strip the income that would refill them before they decide.
    for (const f of rivals(state)) {
      f.wealth = 0;
      f.heat = 0;
    }
    const rng = new Rng(state.rng);
    state.day = FACTION_DECISION_INTERVAL_DAYS;
    tickFactions(state, rng);

    // One week's income cannot cover a move against somebody.
    for (const f of rivals(state)) {
      expect(actionCounts(state, f.id).pressure).toBe(0);
    }
  });

  it('reaches a different decision when the board changes', () => {
    // Identical seed and family; only the situation differs.
    const calm = fresh(555);
    const threatened = fresh(555);

    // In one world that family is frightened of its own heat.
    const who = mostAggressive(calm);
    threatened.factions[who].heat = 90;

    runFactions(calm, 4);
    runFactions(threatened, 4);

    const calmKinds = calm.factions[who].history.map((h) => h.kind);
    const threatenedKinds = threatened.factions[who].history.map((h) => h.kind);
    expect(calmKinds).not.toEqual(threatenedKinds);
  });

  it('picks on somebody weaker rather than attacking into strength', () => {
    const state = fresh();
    // Give the most aggressive family a commanding position next to a weak
    // player. Which slot that is depends on the draw.
    const who = mostAggressive(state);
    const t = state.territories['rail_yards'];
    /*
     * Just the two of them there. The draw can seat a third family in the
     * yards, and a rival holding 50 is a better-scoring target than a player
     * holding 15 — `significance` says somebody barely present is not worth
     * the trip, which is the intended behaviour and not what this test is
     * about. Clearing the street makes the fixture match the sentence above.
     */
    for (const other of RIVAL_IDS) {
      if (other !== who) t.influence[other] = 0;
    }
    t.influence[who] = 80;
    t.influence.player = 15;
    state.factions[who].wealth = 2_000_000;
    state.factions[who].heat = 0;

    runFactions(state, 12);

    const attacks = state.factions[who].history.filter(
      (h) => h.kind === 'pressure' && h.targetFactionId === 'player',
    );
    expect(attacks.length).toBeGreaterThan(0);
    // The player should have actually lost ground there.
    expect(playerInfluence(state.territories['rail_yards'])).toBeLessThan(15);
  });

  it('will not move on somebody it is evenly matched with', () => {
    const state = fresh();
    const who = mostAggressive(state);
    const t = state.territories['rail_yards'];
    // Evenly matched — no lead to exploit.
    t.influence[who] = 40;
    t.influence.player = 40;
    for (const other of territoryList(state)) {
      if (other.id === 'rail_yards') continue;
      other.influence[who] = 0;
    }
    state.factions[who].wealth = 5_000_000;

    // One decision, before they have had a chance to build a lead. Over more
    // weeks they legitimately expand first and *then* attack, which is the
    // behaviour we want — it just is not what this test is about.
    const rng = new Rng(state.rng);
    state.day = FACTION_DECISION_INTERVAL_DAYS;
    tickFactions(state, rng);

    const attacks = state.factions[who].history.filter(
      (h) => h.kind === 'pressure' && h.territoryId === 'rail_yards',
    );
    expect(attacks).toHaveLength(0);
  });
});

/*
 * Which slot holds which kind of family is drawn per seed now, so a test about
 * temperament has to find the temperament rather than name a slot.
 *
 * It has to find it the way the AI does, too: this read the *house* personality
 * at first, which is only half of what the scoring pass sees. A boss can be
 * enough of a departure from his family to invert the order — an aggressive
 * house under a careful man scores below a middling house under a hothead — and
 * when the pool changed, `mostAggressive` duly picked a family that then sat
 * there investing while a nominally calmer one took the yards off the player.
 * The test was right about the behaviour and wrong about who. `leaderPersonality`
 * is the quantity every decision in faction.ts is actually weighted by.
 */
function byTemperament(
  state: GameState,
  pick: (p: FactionPersonality) => number,
): FactionId {
  return rivals(state)
    .slice()
    .sort(
      (a, b) =>
        pick(leaderPersonality(state, b)) - pick(leaderPersonality(state, a)),
    )[0].id;
}

const mostAggressive = (s: GameState) => byTemperament(s, (p) => p.aggression);
const mostCommercial = (s: GameState) => byTemperament(s, (p) => p.commerce - p.aggression);
const mostCautious = (s: GameState) => byTemperament(s, (p) => p.caution);
const leastCautious = (s: GameState) => byTemperament(s, (p) => -p.caution);

// ------------------------------------------------------------ personality ---

describe('personality', () => {
  it('makes the aggressive family fight and the commercial one trade', () => {
    // Same board, same seed, same code path — only the weights differ.
    const state = fresh(1234);
    for (const f of rivals(state)) {
      f.wealth = 3_000_000;
      f.heat = 0;
    }
    // Keep a weaker target permanently available to everybody. Without the
    // top-up, a few weeks of pressure wipes the player off the board and every
    // family falls back on investing — which would measure target supply
    // rather than personality.
    const rng = new Rng(state.rng);
    for (let week = 1; week <= 40; week++) {
      for (const t of territoryList(state)) t.influence.player = 10;
      for (const f of rivals(state)) f.wealth = 3_000_000;
      state.day = week * FACTION_DECISION_INTERVAL_DAYS;
      tickFactions(state, rng);
    }

    const kestler = actionCounts(state, mostAggressive(state));
    const vasari = actionCounts(state, mostCommercial(state));

    /*
     * Compared as shares of each family's own activity, not raw counts.
     * Absolute counts measure opportunity as much as temperament — the
     * families start in different positions, and a family that spends weeks
     * cooling off simply acts less. The share is what personality controls.
     */
    const share = (c: Record<FactionActionKind, number>, kind: FactionActionKind) =>
      c[kind] / Math.max(1, c.expand + c.pressure + c.invest + c.consolidate);

    const total = (c: Record<FactionActionKind, number>) =>
      Math.max(1, c.expand + c.pressure + c.invest + c.consolidate + c.diplomacy + c.poach);

    // Kestler: aggression 1.0 against Vasari 0.4.
    expect(share(kestler, 'pressure')).toBeGreaterThan(share(vasari, 'pressure'));

    /*
     * And the trader spends most of its time not fighting.
     *
     * Compared as "everything that is not an attack" rather than investing
     * alone: a commercial family with room to grow spends its weeks expanding
     * instead, so the two end up investing equally often while behaving
     * completely differently.
     */
    const peaceful = (c: Record<FactionActionKind, number>) =>
      (c.expand + c.invest + c.consolidate) / total(c);
    expect(peaceful(vasari)).toBeGreaterThan(peaceful(kestler));
  });

  /*
   * Across seeds, not on one.
   *
   * This ran on a single world for a long time and passed, which was luck: a
   * cautious family consolidates once or twice in thirty weeks, the leader
   * bias is jittered on top of the family personality, and one seed is not
   * enough signal to separate 0.9 from 0.3. It failed the first time anything
   * upstream shifted the RNG stream, which is exactly the failure mode a
   * single-world assertion has.
   */
  it('makes the cautious family go quiet sooner than the reckless one', () => {
    let cautious = 0;
    let reckless = 0;
    for (const seed of [4321, 4322, 4323, 4324, 4325, 4326]) {
      const state = fresh(seed);
      for (const f of rivals(state)) {
        f.wealth = 1_500_000;
        f.heat = 55; // uncomfortable, not yet alarming
      }
      runFactions(state, 30);
      cautious += actionCounts(state, mostCautious(state)).consolidate;
      reckless += actionCounts(state, leastCautious(state)).consolidate;
    }
    expect(cautious).toBeGreaterThan(reckless);
  });
});

// ---------------------------------------------------------- relationships ---

describe('relationships', () => {
  it('sours when the player takes ground a family is watching closely', () => {
    const state = fresh();
    // Standing heavily in the district is what buys certainty about who did
    // it — see clarityFor. A family with a toe-hold may well blame somebody
    // else, which is the whole of the belief system and is tested separately.
    state.territories[HOME_TERRITORY].influence.vasari = 90;
    const before = relationship(state, 'player', 'vasari');
    const rng = new Rng(state.rng);
    for (let i = 0; i < 10; i++) noteInfluenceTaken(state, rng, HOME_TERRITORY, 5);
    expect(relationship(state, 'player', 'vasari')).toBeLessThan(before);
  });

  it('ignores families with no stake in the district', () => {
    const state = fresh();
    const before = relationship(state, 'player', 'kestler');
    // Kestler have nothing in Little Sicily. They are still a candidate for
    // the *blame* — anybody can be — but they do not go looking.
    noteInfluenceTaken(state, new Rng(state.rng), HOME_TERRITORY, 50);
    expect(state.factions.kestler.suspicions).toHaveLength(0);
    void before;
  });

  it('drifts back toward indifference when nothing is happening', () => {
    const state = fresh();
    setRelationship(state, 'player', 'falcone', -50);
    runFactions(state, 10);
    expect(relationship(state, 'player', 'falcone')).toBeGreaterThan(-50);
  });

  it('keeps relationship inside its bounds under sustained provocation', () => {
    const state = fresh();
    const rng = new Rng(state.rng);
    for (let i = 0; i < 500; i++) noteInfluenceTaken(state, rng, HOME_TERRITORY, 100);
    for (const f of rivals(state)) {
      const standing = relationship(state, 'player', f.id);
      expect(standing).toBeGreaterThanOrEqual(-100);
      expect(standing).toBeLessThanOrEqual(100);
    }
  });

  it('names every relationship band', () => {
    for (const value of [-100, -80, -50, -20, 0, 20, 50, 90]) {
      expect(relationshipLabel(value)).toBeTruthy();
    }
  });

  it('surfaces the angriest family once somebody is actually hostile', () => {
    const state = fresh();
    expect(mostHostile(state)).toBeNull();
    setRelationship(state, 'player', 'kestler', -60);
    expect(mostHostile(state)?.id).toBe('kestler');
  });
});

// ------------------------------------------------------------------ intel ---

describe('what the player can see', () => {
  it('tells you nothing concrete about a family you have never met', () => {
    const state = fresh();
    const read = readFaction(state, state.factions['kestler']);
    expect(read.intel).toBe(0);
    expect(read.wealth).toBe('unknown');
    expect(read.objective).toMatch(/no idea/i);
  });

  it('sharpens as you come to share ground with them', () => {
    const state = fresh();
    // Seated explicitly: which corner a family starts in is drawn per seed.
    for (const id of ['downtown', 'the_heights', 'old_quarter', 'northside']) {
      state.territories[id].influence.falcone = 45;
    }
    const before = factionIntel(state, 'falcone');

    for (const id of ['downtown', 'the_heights', 'old_quarter', 'northside']) {
      state.territories[id].influence.player = 40;
    }
    const after = factionIntel(state, 'falcone');
    expect(after).toBeGreaterThan(before);

    const read = readFaction(state, state.factions['falcone']);
    expect(read.wealth).not.toBe('unknown');
  });

  it('only reports actions the player was close enough to witness', () => {
    const state = fresh();
    runFactions(state, 20);
    for (const f of rivals(state)) {
      const read = readFaction(state, f);
      expect(read.known.every((a) => a.observed)).toBe(true);
      expect(read.known.length).toBeLessThanOrEqual(f.history.length);
    }
  });

  it('lists the districts you and a family are both standing in', () => {
    const state = fresh();
    for (const t of Object.values(state.territories)) t.influence.falcone = 0;
    state.territories['downtown'].influence.falcone = 50;
    expect(contestedWith(state, 'falcone')).toHaveLength(0);
    state.territories['downtown'].influence.player = 30;
    expect(contestedWith(state, 'falcone').map((t) => t.id)).toEqual(['downtown']);
  });
});

// ------------------------------------------------------------- invariants ---

describe('rivals do not break the world', () => {
  it('keeps every faction number in range across a long game', () => {
    const state = fresh(777);
    runDaysSolvent(state, 500);

    for (const f of rivals(state)) {
      expect(Number.isFinite(f.wealth)).toBe(true);
      expect(f.wealth).toBeGreaterThanOrEqual(0);
      expect(f.heat).toBeGreaterThanOrEqual(0);
      expect(f.heat).toBeLessThanOrEqual(100);
      const standing = relationship(state, 'player', f.id);
      expect(standing).toBeGreaterThanOrEqual(-100);
      expect(standing).toBeLessThanOrEqual(100);
      expect(f.businessCount).toBeGreaterThanOrEqual(0);
    }
    for (const t of territoryList(state)) {
      for (const id of RIVAL_IDS) {
        expect(factionInfluence(t, id)).toBeGreaterThanOrEqual(0);
        expect(factionInfluence(t, id)).toBeLessThanOrEqual(100);
      }
    }
  });

  it('does not let rivals take the whole map from an idle player', () => {
    // The player does nothing for two years. That should cost them, but the
    // city should not be a single colour — the families check each other.
    const state = fresh(31337);
    runDaysSolvent(state, 730);

    const dominated = territoryList(state).filter((t) =>
      RIVAL_IDS.some((id) => factionInfluence(t, id) >= 95),
    );
    expect(dominated.length).toBeLessThan(territoryList(state).length);

    // And no single family should own the entire board.
    for (const id of RIVAL_IDS) {
      const held = territoryList(state).filter((t) => factionInfluence(t, id) >= 50);
      expect(held.length).toBeLessThan(territoryList(state).length);
    }
  });

  it('gives the player something legible to read after a long game', () => {
    // What the Rivals panel would actually show. Guards against the panel
    // being correct but empty — fog that never lifts is not a mechanic.
    const state = fresh(4040);
    // A player who has worked their way across a few districts.
    for (const id of ['little_sicily', 'riverside', 'the_docks', 'old_quarter']) {
      state.territories[id].influence.player = 45;
    }
    runDaysSolvent(state, 400);
    // Still standing on that ground at the end — influence decays for a player
    // who runs nothing, and this test is about the readout, not about decay.
    for (const id of ['little_sicily', 'riverside', 'the_docks', 'old_quarter']) {
      state.territories[id].influence.player = 45;
    }

    const reads = rivals(state).map((f) => readFaction(state, f));
    const informed = reads.filter((r) => r.intel > 0);
    expect(informed.length).toBeGreaterThan(0);

    // Somebody you share this much ground with should be readable.
    const best = reads.sort((a, b) => b.intel - a.intel)[0];
    expect(best.wealth).not.toBe('unknown');
    expect(best.objective).not.toMatch(/no idea/i);

    const verbose = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.PROBE;
    if (verbose) {
      for (const r of reads) {
        console.log(
          `  ${r.faction.id}: intel ${Math.round(r.intel)}% | ${relationshipLabel(
            relationship(state, 'player', r.faction.id),
          )} | money ${r.wealth} | ${r.objective} | witnessed ${r.known.length}`,
        );
      }
    }
  });

  it('stays deterministic with rivals active', () => {
    const a = fresh(2468);
    const b = fresh(2468);
    runDaysSolvent(a, 120);
    runDaysSolvent(b, 120);
    expect(JSON.stringify(a.factions)).toEqual(JSON.stringify(b.factions));
  });
});
