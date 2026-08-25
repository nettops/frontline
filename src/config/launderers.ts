/**
 * Somebody who handles it, and what they charge for knowing you.
 *
 * `LAUNDER_CUT_BASE` in `config/businesses.ts` is 0.24, and it used to be what
 * laundering costs. Measured across 36 careers of 300 days it was the single
 * most punitive charge in the game and the only one that buys nothing — stock
 * buys units, wages buy people, upkeep buys premises, and this evaporated:
 *
 *     trading arm   sold $1,632,268
 *                   - stock       694,777
 *                   - payroll     105,821
 *                   - the cut     156,255
 *                   = net         675,415   ...for $41,146 of estate.
 *
 * So 24% is no longer what laundering costs. It is **what a stranger charges**,
 * and this file is the alternative: somebody who does it for you, charges less
 * for it, charges less again the longer you keep them, and can stop taking your
 * calls.
 *
 * The shape is `SUPPLIERS` and `SUPPLY_TRUST` from `config/contraband.ts`,
 * deliberately, because it is the same idea: a flat number is not a
 * relationship. Cheap in and thin, dear in and fat, and the discount is only
 * worth having if you keep them — which means keeping quiet, because heat holds
 * trust at nothing however long you have been paying.
 *
 * ---------------------------------------------------------------------------
 * As with the rest of the laundering economy, this is deliberately abstract.
 * Rates, retainers, fees, exposure, and how long somebody has known you.
 * Nothing here describes how anything is concealed in the real world, and
 * nothing here should be added that does.
 * ---------------------------------------------------------------------------
 */

export interface LaundererDef {
  id: string;
  name: string;
  blurb: string;
  /** The share they take on the day you hire them. */
  cut: number;
  /** The best they will ever do, for somebody they have known a long time. */
  bestCut: number;
  /** What it costs to put them on a retainer. */
  retainer: number;
  /** Weekly, whether or not a dollar moves. */
  fee: number;
  /** Evidence a week, by existing. A name appears on things. */
  exposure: number;
  /** Chance a week the arrangement simply ends, before any relationship. */
  failureChancePerWeek: number;
}

/**
 * Three of them, and the prices are off a plotted distribution.
 *
 * Peak funds over 36 careers on `ladder.probe`'s bot:
 *
 *     by day 100   p10 10,026   p25 18,528   median 39,310    p75 156,053
 *     by day 200   p10 15,635   p25 34,051   median 125,927   p75 232,915
 *
 * DIRECTOR §5 puts a bar between the median and the 75th. The cheapest is
 * sized against day 100 because somebody keeping your books is an early-career
 * fixture rather than a late luxury; the other two against day 200, with the
 * best rate in the game landing between that distribution's 75th and 90th.
 *
 * The fees are sized against measured volume rather than by eye. A trading
 * career washes a median $17,410 a week, so each tier is roughly break-even on
 * the day you hire them and clearly worth it once they have known you a year.
 * That is the point: you are not buying a rate, you are buying a rate that
 * improves.
 *
 * ## Why the opening rates carry most of the value
 *
 * The first pass put the cheapest at 20% against a stranger's 24% and left the
 * rest of the benefit in the relationship. Measured, that was the wrong split:
 * this bot hires on a median day 133 of 300 and its **best standing across the
 * whole population is a median of 3 out of 100**, because weekly heat sits at
 * a median of 81 and trust needs quiet. The relationship is real and a careful
 * player will have it; an ordinary career will not, and pricing the feature on
 * a curve nobody in the sample reaches is the `PATRON` shape wearing an
 * accountant's suit.
 *
 * So the opening rate is where the money is — 24% to 16% on the day you sign —
 * and the relationship is upside on top of it rather than the whole of it.
 */
export const LAUNDERERS: LaundererDef[] = [
  {
    id: 'bookkeeper',
    name: 'A bookkeeper with several clients',
    blurb:
      'Does the same for four other people and none of you have met. Cheap to start, and the other four are the problem.',
    cut: 0.16,
    bestCut: 0.1,
    retainer: 45_000,
    fee: 250,
    exposure: 1.2,
    failureChancePerWeek: 0.04,
  },
  {
    id: 'accountant',
    name: 'An accountant of your own',
    blurb:
      'One office, one client, and a practice they would rather keep. Steadier than the alternative and they know exactly what they are.',
    cut: 0.13,
    bestCut: 0.07,
    retainer: 140_000,
    fee: 700,
    exposure: 0.7,
    failureChancePerWeek: 0.02,
  },
  {
    id: 'firm',
    name: 'A firm downtown',
    blurb:
      'Partners, a lobby, and letterhead. The best terms anybody in this city will give you, and the largest name to appear beside yours if it ever comes apart.',
    cut: 0.1,
    bestCut: 0.04,
    retainer: 260_000,
    fee: 1_400,
    exposure: 0.35,
    failureChancePerWeek: 0.01,
  },
];

export const LAUNDERER_BY_ID: Record<string, LaundererDef> = Object.fromEntries(
  LAUNDERERS.map((l) => [l.id, l]),
);

/**
 * What somebody who has kept you thinks of you.
 *
 * The same figures `SUPPLY_TRUST` uses, and the same reasoning, because the
 * quantity underneath is the same one: time kept, gated on how much attention
 * you are drawing. They are not copied for convenience — the supplier numbers
 * were sized against measured arrangement lifetimes, and until a career has
 * actually kept a launderer for a while there is no separate distribution to
 * size these against. When there is, re-plot them; do not assume they stayed
 * right because they started matching.
 *
 * Trust only ever helps. A loud career earns none and pays close to what a
 * stranger charges, which is the price of being loud rather than a penalty
 * handed to somebody for playing normally.
 */
export const LAUNDER_TRUST = {
  /** Weeks of an unbroken, quiet arrangement to reach the best rate. */
  weeksToFull: 12,
  /** The most trust can cut the weekly chance they walk. */
  maxReduction: 0.8,
  /**
   * The band quiet is measured across, and both ends are off a plotted
   * distribution rather than off an intuition.
   *
   * Weekly heat over 36 trading careers: **p10 37, p25 62, median 81, p75 100**.
   * So a family at or above the median week earns nothing, and one down at the
   * tenth percentile — which takes deliberately laying low — earns the lot.
   * In between it scales.
   *
   * The first version used a single ceiling of 60 with `1 - heat / 60`, copied
   * from `SUPPLY_TRUST`. Against that distribution a *quiet* week at heat 50
   * scored 0.17 and the median week scored zero, so the whole population
   * gained about 0.3 a week against 1.2 of decay and the probe reported a best
   * standing of 0/100 across all 36 careers. A ratio to a ceiling is not a
   * band, and this needed a band.
   */
  quietBelow: 40,
  heatCeiling: 80,
  /** Points trust gains in a fully quiet week. */
  driftPerWeek: 10,
  /**
   * Points trust loses in a fully loud one — and the reason this is a separate
   * figure rather than the same drift running backwards.
   *
   * `SUPPLY_TRUST` drifts toward a target of `100 * kept * quiet`, which
   * collapses to **zero** on any week over the heat ceiling. Measured across
   * 36 careers: mean heat is 77 and only 21% of weeks sit under 60, so the
   * target is zero four weeks in five and trust drifts down 10 for every 10 it
   * gained. The first version of this file copied that and the probe reported
   * a best standing of **0/100 across the entire population** — a relationship
   * system that no career in the game could ever have a relationship with.
   *
   * So heat gates the *gain* rather than dictating the *level*. A quiet week
   * builds at `driftPerWeek`; a loud one erodes at this, which is deliberately
   * a fraction of it. A year of ordinary play accumulates something. A year of
   * sirens does not, and a relationship built over a quiet year survives three
   * bad weeks — which is what a relationship is.
   *
   * `SUPPLY_TRUST` has the same defect and is deliberately not touched here.
   * Changing it would reshuffle every seeded population in the project on a
   * measurement about a different system.
   */
  hotDecayPerWeek: 1.5,
  /** Trust lost outright when a warrant lands. */
  seizureCost: 35,
} as const;
