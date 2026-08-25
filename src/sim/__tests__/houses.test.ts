/**
 * The draw that decides who is in the city.
 *
 * config/houses.ts carries a warning in a comment — "two families that are
 * both cautious and commercial produce a quiet city where nothing happens, and
 * a draw that can produce one is a draw that will" — and nothing was checking
 * it. Adding two houses to the pool is exactly the change that can break it
 * silently: the temperament groups are hand-maintained, so a house can be
 * written, added to HOUSES, and left out of HOUSE_GROUPS, at which point it is
 * simply never drawn and nobody finds out.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { drawHouses } from '../houses';
import { HOUSES, HOUSE_GROUPS, SEATS } from '../../config/houses';
import { LEADER_FIRST_NAMES } from '../../config/factionLeaders';
import { RIVAL_IDS } from '../../config/factions';

const SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i);

describe('the house pool', () => {
  it('can draw every house that exists, and draws nothing that does not', () => {
    const grouped = HOUSE_GROUPS.flat();
    expect(new Set(grouped).size, 'a house is in two temperament groups').toBe(grouped.length);
    expect([...grouped].sort()).toEqual(HOUSES.map((h) => h.id).sort());
  });

  it('has enough groups to seat three families from three temperaments', () => {
    expect(HOUSE_GROUPS.length).toBeGreaterThanOrEqual(3);
    for (const group of HOUSE_GROUPS) expect(group.length).toBeGreaterThan(0);
    expect(SEATS.length).toBeGreaterThan(RIVAL_IDS.length);
  });

  it('actually reaches every house over a run of seeds', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      for (const draw of drawHouses(new Rng({ seed, calls: 0 }), RIVAL_IDS.length)) seen.add(draw.house.id);
    }
    // Not a statistical claim about the distribution — just that no house was
    // written and then left unreachable.
    expect([...seen].sort()).toEqual(HOUSES.map((h) => h.id).sort());
  });

  it('never seats two families of the same temperament, or two in one corner', () => {
    for (const seed of SEEDS) {
      const draws = drawHouses(new Rng({ seed, calls: 0 }), RIVAL_IDS.length);
      expect(draws).toHaveLength(RIVAL_IDS.length);

      const groups = draws.map((d) =>
        HOUSE_GROUPS.findIndex((g) => g.includes(d.house.id)),
      );
      expect(new Set(groups).size, `seed ${seed} drew two of the same temperament`).toBe(
        draws.length,
      );
      expect(new Set(draws.map((d) => d.seat.id)).size, `seed ${seed} double-seated`).toBe(
        draws.length,
      );
    }
  });

  /*
     The warning in the config file, as an assertion.

     Stated about the board rather than about any one house, because that is
     how it fails: no single personality is wrong, but a pool can grow a third
     quiet earner and start producing cities where the player is the only
     party who does anything. The bar is deliberately low — one family in three
     willing to lean on somebody is the difference between a city and a
     spreadsheet.
  */
  it('never draws a city with nobody in it willing to move', () => {
    for (const seed of SEEDS) {
      const draws = drawHouses(new Rng({ seed, calls: 0 }), RIVAL_IDS.length);
      const hottest = Math.max(...draws.map((d) => d.house.personality.aggression));
      expect(hottest, `seed ${seed}: ${draws.map((d) => d.house.shortName).join(', ')}`)
        .toBeGreaterThanOrEqual(0.6);
    }
  });
});

describe('what a boss is called', () => {
  it('names him out of his own house list when it keeps one', () => {
    /*
       Checked against the drawn house rather than against a fixed seed: which
       houses are in a given city is the whole point of the draw, so a test
       that named one would be testing the seed.
    */
    const withOwnList = HOUSES.filter((h) => h.firstNames?.length);
    expect(withOwnList.length, 'nothing in the pool keeps its own names').toBeGreaterThan(0);

    let checkedOwn = 0;
    let checkedDefault = 0;

    for (const seed of SEEDS.slice(0, 60)) {
      const state = newGame({ name: 'Test Boss', difficulty: 'normal', seed });
      for (const id of RIVAL_IDS) {
        const faction = state.factions[id];
        const given = faction.leader!.name.split(' ')[0];
        const pool = faction.firstNames ?? LEADER_FIRST_NAMES;
        expect(pool, `${faction.shortName} boss "${faction.leader!.name}"`).toContain(given);
        if (faction.firstNames) checkedOwn += 1;
        else checkedDefault += 1;
      }
    }

    // Both branches were exercised, or the assertion above proves nothing.
    expect(checkedOwn).toBeGreaterThan(0);
    expect(checkedDefault).toBeGreaterThan(0);
  });

  it('gives him the family surname about half the time', () => {
    let family = 0;
    let total = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      const state = newGame({ name: 'Test Boss', difficulty: 'normal', seed });
      for (const id of RIVAL_IDS) {
        const faction = state.factions[id];
        total += 1;
        if (faction.leader!.name.endsWith(` ${faction.shortName}`)) family += 1;
      }
    }
    // The coin is 0.55. Wide bars — this is here to catch the surname being
    // wired to the wrong thing, not to re-measure the constant.
    expect(family / total).toBeGreaterThan(0.35);
    expect(family / total).toBeLessThan(0.75);
  });
});
