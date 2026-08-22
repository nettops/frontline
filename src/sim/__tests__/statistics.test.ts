/**
 * Statistical validation and anomaly detection.
 *
 * Every other test file in this project asserts something about one world. That
 * is the right shape for an invariant and the wrong shape for a *distribution*,
 * and the difference is not academic: every finding in the audit that produced
 * this file — $137M of unspendable rival wealth, three families pegged at
 * strength 100, zero wars in thirty years, every seed producing the same city —
 * was invisible to two hundred passing single-world tests. None of them was a
 * broken invariant. All of them were the simulation being *boring* in a way no
 * assertion was looking for.
 *
 * So this file runs many worlds, aggregates, and asserts on the aggregate. The
 * anomaly list below is deliberately written as the failure modes actually
 * observed rather than as a generic sanity check.
 *
 * Set PROBE=1 to print the full distribution when tuning:
 *   PROBE=1 npx vitest run statistics
 */

import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { advanceDays } from '../clock';
import { runDaysSolvent } from './helpers';
import { activeWars } from '../diplomacy';
import { districtOwner, territoryList } from '../territory';
import { crewList } from '../npc';
import { canRecruit, recruit } from '../crew';
import { mistakenBeliefs } from '../beliefs';
import { RIVAL_IDS } from '../../config/factions';
import type { GameState } from '../types';

// Read without pulling in @types/node just for one env lookup — same idiom as
// the balance probe next door.
const PROBE = !!(globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.PROBE;

/** Worlds per run. Enough to see a distribution, fast enough to run on save. */
const WORLDS = 24;
const YEARS = 12;

interface WorldStats {
  seed: number;
  warWeeks: number;
  maxWealth: number;
  minStrength: number;
  maxStrength: number;
  businesses: number[];
  owners: Record<string, number>;
  leaderChanges: number;
  suspicions: number;
  mistaken: number;
  outrage: number;
  pressure: number;
  stories: number;
}

function runWorld(seed: number): WorldStats {
  const s = newGame({ name: '', difficulty: 'normal', mode: 'simulation', seed });
  const startingLeaders = RIVAL_IDS.map((id) => s.factions[id].leader.name);
  let warWeeks = 0;

  for (let w = 0; w < 52 * YEARS; w++) {
    advanceDays(s, 7);
    if (activeWars(s).length > 0) warWeeks += 1;
  }

  const owners: Record<string, number> = {};
  for (const t of territoryList(s)) {
    const owner = districtOwner(t) ?? 'contested';
    owners[owner] = (owners[owner] ?? 0) + 1;
  }

  const strengths = RIVAL_IDS.map((id) => s.factions[id].strength);
  return {
    seed,
    warWeeks,
    maxWealth: Math.max(...RIVAL_IDS.map((id) => s.factions[id].wealth)),
    minStrength: Math.min(...strengths),
    maxStrength: Math.max(...strengths),
    businesses: RIVAL_IDS.map((id) => s.factions[id].businessCount),
    owners,
    leaderChanges: RIVAL_IDS.filter(
      (id, i) => s.factions[id].leader.name !== startingLeaders[i],
    ).length,
    suspicions: RIVAL_IDS.reduce((n, id) => n + s.factions[id].suspicions.length, 0),
    mistaken: mistakenBeliefs(s),
    outrage: s.city.outrage,
    pressure: s.city.pressure,
    stories: s.city.stories.length,
  };
}

describe('the city, across many worlds', () => {
  const worlds = Array.from({ length: WORLDS }, (_, i) => runWorld(1000 + i * 37));

  if (PROBE) {
    for (const w of worlds) {
      console.log(
        `seed ${w.seed}: wars ${w.warWeeks}w | wealth ${Math.round(w.maxWealth / 1000)}k`,
        `| str ${Math.round(w.minStrength)}-${Math.round(w.maxStrength)}`,
        `| biz ${w.businesses.join('/')} | bosses ${w.leaderChanges}/3`,
        `| beliefs ${w.suspicions} (${w.mistaken} wrong)`,
        `| outrage ${Math.round(w.outrage)} pressure ${Math.round(w.pressure)}`,
        `| owners ${JSON.stringify(w.owners)}`,
      );
    }
  }

  /*
   * The finding this file was written for.
   *
   * Zero wars in thirty years across six seeds, because three evenly matched
   * families could never reach the strength lead that declaring one required.
   * Not every world needs a war — a peaceful decade is a legitimate outcome —
   * but a *simulation* in which war is unreachable is a different thing from
   * one in which it is rare.
   */
  it('produces wars between the families without a player involved', () => {
    const withWar = worlds.filter((w) => w.warWeeks > 0);
    const totalWeeks = worlds.reduce((sum, w) => sum + w.warWeeks, 0);
    // Deliberately not a percentage anybody designed. The finding was *zero*,
    // across every seed, forever; what is guarded here is that war is
    // reachable and that it happens at a scale worth simulating.
    expect(withWar.length).toBeGreaterThan(3);
    expect(totalWeeks).toBeGreaterThan(60);
  });

  /** ...and does not descend into permanent warfare either. */
  it('does not leave the city permanently at war', () => {
    const alwaysFighting = worlds.filter((w) => w.warWeeks > 52 * YEARS * 0.8);
    expect(alwaysFighting.length).toBeLessThan(WORLDS * 0.2);
  });

  /*
   * Measured at $137,000,000 before the upkeep existed. Nothing in the game
   * could read a number that large meaningfully, and it meant money stopped
   * constraining any rival decision after about year three.
   */
  it('never lets a family accumulate money nothing can constrain', () => {
    for (const w of worlds) {
      expect(w.maxWealth).toBeLessThan(5_000_000);
    }
  });

  /*
   * Every family sat at exactly 100 forever, because peacetime recovery was
   * unconditional. A stat that is the same for everybody at all times is not a
   * stat, and this one gates every war in the game.
   */
  it('produces families that differ in strength', () => {
    const spread = worlds.filter((w) => w.maxStrength - w.minStrength > 10);
    expect(spread.length).toBeGreaterThan(2);
  });

  /*
   * Business counts were identical on every seed, wealth within 3%, and the
   * final map was 4/3/5 in all six measured worlds. The people were procedural
   * and the city they operated in was not.
   */
  it('produces a different city from a different seed', () => {
    const shapes = new Set(
      worlds.map((w) => `${w.businesses.join('/')}|${JSON.stringify(w.owners)}`),
    );
    expect(shapes.size).toBeGreaterThan(WORLDS * 0.4);
  });

  /** Nobody should ever hold the whole board. */
  it('never lets one family take the entire map', () => {
    for (const w of worlds) {
      for (const [owner, count] of Object.entries(w.owners)) {
        if (owner === 'contested') continue;
        expect(count).toBeLessThan(territoryList(newGame({ name: '', difficulty: 'normal', seed: 1 })).length);
      }
    }
  });

  /** Bosses are mortal, and over twelve years that has to show. */
  it('changes who is in charge over a long game', () => {
    const changed = worlds.filter((w) => w.leaderChanges > 0);
    expect(changed.length).toBeGreaterThan(WORLDS * 0.4);
  });

  /*
   * The families reason rather than know.
   *
   * Two properties, and the second is the one worth having: they form beliefs
   * about who is doing this to them at all, and some of those beliefs are
   * wrong. A belief system that is always correct is a lookup table with extra
   * steps — which is exactly what the AI had before, and the reason this whole
   * layer exists.
   */
  it('leaves the families holding beliefs about who is doing this to them', () => {
    const holding = worlds.filter((w) => w.suspicions > 0);
    expect(holding.length).toBeGreaterThan(WORLDS * 0.5);
  });

  it('lets them be wrong about it', () => {
    const wrong = worlds.filter((w) => w.mistaken > 0);
    expect(wrong.length).toBeGreaterThan(3);
  });

  /** ...but not so wrong that blame is noise. */
  it('does not make blame meaningless', () => {
    for (const w of worlds) {
      if (w.suspicions === 0) continue;
      expect(w.mistaken / w.suspicions).toBeLessThan(0.7);
    }
  });

  /*
   * The three dimensions have to actually diverge, or they are three names for
   * one number and the refactor bought nothing. Measured across the worlds:
   * somewhere in the city, somebody holds a grievance against a party they
   * still take seriously, or trusts one they have nothing against.
   */
  it('keeps the three dimensions from collapsing into one', () => {
    const s = newGame({ name: '', difficulty: 'normal', mode: 'simulation', seed: 4040 });
    for (let w = 0; w < 52 * 10; w++) advanceDays(s, 7);

    let diverged = 0;
    for (const id of RIVAL_IDS) {
      for (const b of Object.values(s.factions[id].bonds)) {
        // A grievance against somebody respected, or trust with no warmth
        // behind it. Either means the numbers are moving independently.
        if (b.grudge > 15 && b.respect > 30) diverged += 1;
        if (b.trust > 15 && b.grudge > 15) diverged += 1;
      }
    }
    expect(diverged).toBeGreaterThan(0);
  });

  /** The city has a view, and it is not stuck at either end. */
  it('keeps public opinion in a live range', () => {
    for (const w of worlds) {
      expect(w.outrage).toBeGreaterThanOrEqual(0);
      expect(w.outrage).toBeLessThan(100);
      expect(w.pressure).toBeLessThanOrEqual(w.outrage + 5);
    }
    expect(worlds.some((w) => w.stories > 0)).toBe(true);
  });
});

// ------------------------------------------------------------- anomalies ---

/**
 * Things that should be impossible, checked on a played world rather than an
 * observed one. These are cheap and they are the ones that would corrupt a
 * save rather than merely make the game dull.
 */
describe('anomaly detection', () => {
  function played(seed: number): GameState {
    const s = newGame({
      name: 'Stats',
      difficulty: 'normal',
      mode: 'sandbox',
      sandboxStart: 'established',
      seed,
    });
    runDaysSolvent(s, 365 * 6);
    return s;
  }

  const worlds = [played(7001), played(7002), played(7003)];

  it('produces no impossible numbers anywhere', () => {
    for (const s of worlds) {
      expect(Number.isFinite(s.org.cash)).toBe(true);
      expect(Number.isFinite(s.org.dirtyCash)).toBe(true);
      expect(s.org.heat).toBeGreaterThanOrEqual(0);
      expect(s.org.heat).toBeLessThanOrEqual(100);
      expect(s.org.fear).toBeGreaterThanOrEqual(0);
      expect(s.org.fear).toBeLessThanOrEqual(100);
      expect(s.city.outrage).toBeGreaterThanOrEqual(0);
      expect(s.city.outrage).toBeLessThanOrEqual(100);

      for (const npc of Object.values(s.npcs)) {
        expect(npc.age).toBeGreaterThan(0);
        expect(npc.age).toBeLessThan(120);
        for (const value of Object.values(npc.stats)) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
        // Every tie must point at somebody who exists, or a save reloads into
        // a crew sheet full of undefined.
        for (const tie of npc.ties) {
          expect(s.npcs[tie.id]).toBeDefined();
        }
      }
    }
  });

  /** Nothing may grow without bound, or a long game eventually stops saving. */
  it('keeps every collection bounded', () => {
    for (const s of worlds) {
      expect(s.log.length).toBeLessThanOrEqual(400);
      expect(s.operationHistory.length).toBeLessThanOrEqual(200);
      expect(s.trace.length).toBeLessThanOrEqual(200);
      expect(s.city.stories.length).toBeLessThanOrEqual(30);
      for (const id of RIVAL_IDS) {
        expect(s.factions[id].suspicions.length).toBeLessThanOrEqual(12);
        for (const b of Object.values(s.factions[id].bonds)) {
          expect(b.grudge).toBeGreaterThanOrEqual(0);
          expect(b.grudge).toBeLessThanOrEqual(100);
          expect(Number.isFinite(b.respect)).toBe(true);
          expect(Number.isFinite(b.trust)).toBe(true);
          if (b.warSince !== null) expect(b.warSince).toBeLessThanOrEqual(s.day);
        }
      }
      for (const npc of Object.values(s.npcs)) {
        expect(npc.notes.length).toBeLessThanOrEqual(40);
        expect(npc.ties.length).toBeLessThanOrEqual(8);
      }
      // The whole thing has to stay something a browser will put in localStorage.
      expect(JSON.stringify(s).length).toBeLessThan(2_000_000);
    }
  });

  it('ages everybody, and only within reason', () => {
    for (const s of worlds) {
      const ages = Object.values(s.npcs).map((n) => n.age);
      expect(Math.max(...ages)).toBeGreaterThan(19);
    }
  });

  /** Fear and standing must remain separable, not two names for one number. */
  it('does not collapse fear back into standing', () => {
    const s = worlds.find((w) => w.org.fear > 0 || w.org.respect > 0);
    expect(s).toBeDefined();
    if (s) expect(s.org.fear).not.toBe(s.org.respect);
  });

  /*
     Moved out of the simulation worlds above, because it was never a statement
     about them.

     `advanceDay` skips `refreshRecruits` in Simulation on purpose — its own
     comment says there is no player to recruit for — so the pool is empty from
     the first week and nobody can ever be hired. Twelve years of `aging.ts`
     then retires or buries the two men the game starts you with, and the
     answer is zero crew in every world. It is arithmetic, not a finding.

     It passed anyway for as long as personal fear ratcheted to 90 and pinned
     men above `informantFearAbove`, because `driftNpcs` will not let an
     informant defect — what he is selling is access, and it stops being worth
     anything the day he walks out. The crews in these worlds were being held
     together by the men who had started talking to the Bureau. Giving fear a
     way back down removed that, and this assertion is what noticed.

     So it now runs where an organization actually exists: Career mode, paid,
     hiring when there is somebody to hire, over the same twelve years. That is
     the question the name asks.
  */
  it('leaves the crew a functioning organization rather than a graveyard', () => {
    let alive = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const s = newGame({ name: '', difficulty: 'normal', mode: 'career', seed });
      for (let w = 0; w < 52 * YEARS; w++) {
        for (const id of Object.keys(s.recruits)) {
          if (canRecruit(s, id).ok) {
            recruit(s, id);
            break;
          }
        }
        if (runDaysSolvent(s, 7) < 7) break;
      }
      if (crewList(s).length > 0) alive += 1;
    }
    expect(alive).toBeGreaterThan(0);
  });
});
