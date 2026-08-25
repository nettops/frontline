/**
 * What the family is worth, as against what is in its wallet today.
 *
 * The seven ranks were gated on clean cash *held*, and a family earns $184,077
 * of it across four years and never holds more than $24,908 at once — because
 * clean is the pool every cost falls back on the moment dirty runs out. So the
 * ladder was measuring a seventh of an economy that is otherwise four times
 * profitable, and Capo arrived in one career out of thirty-six.
 *
 * The thing a family actually builds is not a balance. It is a restaurant on
 * one street and an auto shop on another and two districts that answer when
 * called, and none of that counted for anything. This is the number that counts
 * it.
 *
 * Derived on demand and stored nowhere, in keeping with `sim/standing.ts`: it
 * is a reading of the world rather than a fact about it, and a stored copy is
 * a second thing to keep true.
 *
 * A leaf module by necessity as well as by taste. `business.ts` imports
 * `economy.ts` for `spend` and `earnClean`, so an `economy.ts` that reached
 * back into `business.ts` to value a front would be a cycle.
 */

import type { GameState } from './types';
import { acquisitionCost, businessDef, ownedBusinesses } from './business';
import { possessionsVisible, possessionsWorth } from './possessions';

export interface Estate {
  /** Clean money in the wallet. */
  cash: number;
  /** Clean money put where it cannot be spent. */
  holdings: number;
  /** What the businesses would fetch, in the condition they are in. */
  fronts: number;
  /** What the ground is worth to whoever holds it. */
  ground: number;
  /**
   * The boss's own things, at face.
   *
   * Counted the same way `holdings` is, and for the same reason: buying one is
   * not supposed to move rank in either direction. What it moves is what you
   * can do tomorrow. See `config/possessions.ts`.
   */
  possessions: number;
  total: number;
  /**
   * How much of the total is out where people can see it.
   *
   * Lives here rather than in `legacy.ts` because it is a fact about what the
   * family owns, and `legitimacy` had been computing its own version from two
   * of the four fields above — which meant adding a fifth field silently
   * lowered legitimacy for everybody who used it, by growing the denominator
   * and not the numerator.
   */
  visible: number;
}

/**
 * A front is worth what it would cost to buy today, in the state it is in.
 *
 * `acquisitionCost` already prices a business into this year's money and this
 * district's wealth, so reusing it means the value of a front and the price of
 * one cannot drift apart. Scaling by health is what makes the difference
 * between a going concern and a shop that is three bad weeks from closing —
 * and it gives the health system a consequence for standing, which it has
 * never had. A shuttered front is worth nothing at all; `ownedBusinesses`
 * filters those out before this sees them.
 */
function frontValue(state: GameState, businessId: string): number {
  const business = state.businesses[businessId];
  if (!business) return 0;
  const t = state.territories[business.territoryId];
  if (!t) return 0;
  const condition = Math.max(0, Math.min(100, business.health)) / 100;
  return Math.round(acquisitionCost(state, businessDef(business), t) * condition);
}

export function estate(state: GameState): Estate {
  const cash = Math.max(0, Math.floor(state.org.cash));
  const holdings = Math.max(0, Math.floor(state.org.holdings ?? 0));

  const fronts = ownedBusinesses(state).reduce(
    (sum, b) => sum + frontValue(state, b.id),
    0,
  );

  /*
     What the place is worth, not what you have wrung out of it.

     Two goes at this, and the second is the one the tests allowed.

     `districtWorth` is what passes through a steward's hands in a week, and
     the estate wants a valuation rather than a yield — so the obvious move was
     to capitalise it at thirty weeks, which is what every front in the
     catalogue pays back in. That priced a district at $12,600 instead of $258
     and looked right.

     It failed `balance > lets careful play build a bigger organization`:
     careful 1.50 against greedy 1.71, where careful has always won. The reason
     is in the formula — `districtWorth` scales with your influence, influence
     comes from running operations, so capitalising it made "run every job you
     can" the fastest route to standing and handed the game to the reckless
     bot. A valuation that rewards grinding is not a valuation.

     So a district is priced by what it is rather than by what you have taken
     from it: the weekly figure a place of that prosperity yields, capitalised
     the same thirty weeks, with the influence term dropped. You either hold it
     or you do not, and holding it at 51 is holding it.

     `controlledTerritories` is the same set the rank table's "Districts held"
     row counts, so a district cannot be worth something here and not exist
     there.
  */
  /*
     Ground is not in here, and that took three attempts to conclude.

     It looked obviously right: a family that holds two districts has built
     something, and `districtWorth` was sitting there waiting to be used. Three
     versions, each failing `balance > lets careful play build a bigger
     organization`, which has held since long before any of this:

       weekly figure, capitalised 30x        careful 1.50, greedy 1.71
       ...with the influence term dropped    careful 1.50, greedy 1.71
       ...discounted by neighbourhood mood   careful 1.50, greedy 1.63

     The reason is structural rather than a matter of the multiplier. Districts
     are taken by running operations, and running every operation available is
     the entire definition of the greedy bot. Any valuation of ground large
     enough to be worth showing hands standing to the grinder, and the harder
     the estate leans on it the worse the inversion gets — 1.63 was three goes
     of trying to buy it back.

     And it was double-counting from the start. The rank table already asks for
     districts by name, on its own line, with its own count. Ground appearing
     in the money line as well meant taking a district moved a family twice on
     one requirement and once on another — which is not a valuation, it is a
     thumb on the scale.

     So the estate is what a family *bought*: cash, what it put away, and the
     businesses it owns. What it *took* is counted where it was always counted,
     as districts held.
  */
  const ground = 0;

  /*
     Dirty cash is not in here, and that is not an oversight.

     It is not standing — it is exposure sitting in a room, which is what the
     Finances panel has told the player since the beginning. A family whose
     entire worth is a suitcase nobody can explain has not built anything.
  */
  const owned = possessionsWorth(state);

  return {
    cash,
    holdings,
    fronts,
    ground,
    possessions: owned,
    total: cash + holdings + fronts + ground + owned,
    // A watch under a cuff is a drawer. Only the seen share counts as seen.
    visible: fronts + ground + possessionsVisible(state),
  };
}
