/**
 * How hard you lean on a front.
 *
 * The vision asks for a business to be an operating concern rather than a
 * number that pays out — legitimate revenue, gambling in the back, the wash,
 * inspections, the staff, somebody talking. That is a lot of systems, and most
 * of them already exist somewhere else in this game wearing different names:
 * exposure is the investigators' interest, health is whether it is a going
 * concern, sentiment is the neighbourhood, and `informants.ts` is somebody
 * talking.
 *
 * So rather than build a second copy of all of it per front, there is one
 * dial, and it is the question the vision actually poses: *how dirty do I want
 * this business?*
 *
 * Everything else is a consequence. Lean hard and it washes more, earns more,
 * and is visibly a front — worse health, faster exposure, and a licence
 * somebody eventually looks at. Keep it clean and it is a restaurant that
 * happens to be yours, which is worth something to the only reading in the
 * game that measures what you look like from outside.
 *
 * One mechanic, four existing systems, no new subsystem. A front you never
 * touch behaves exactly as it did before this file existed.
 */

export type PressureId = 'clean' | 'normal' | 'hard';

export interface PressureDef {
  id: PressureId;
  name: string;
  /**
   * The label on the button.
   *
   * Separate from `name` because the control sits in a table that was already
   * full: adding this column pushed it 236px into horizontal overflow and took
   * the row to 118px, with "Keep it clean" stacking over three lines. Measured
   * rather than eyeballed, and the same defect round 14 reported on the crew
   * roster.
   */
  short: string;
  blurb: string;
  /** Multiplier on how much dirty money the front can move in a week. */
  launder: number;
  /** Multiplier on takings. Leaning harder does make more. */
  revenue: number;
  /** Added to weekly exposure growth — how interesting it looks. */
  exposure: number;
  /** Added to weekly health wear. Negative means it recovers better. */
  wear: number;
  /** Chance a week that somebody official takes an interest. */
  inspectionChance: number;
}

export const PRESSURES: PressureDef[] = [
  {
    id: 'clean',
    name: 'Keep it clean',
    short: 'Clean',
    blurb: 'It is a business. It makes less and nobody has any reason to look at it.',
    launder: 0.25,
    revenue: 0.85,
    exposure: -0.6,
    wear: -0.8,
    inspectionChance: 0,
  },
  {
    id: 'normal',
    name: 'The usual',
    short: 'Usual',
    blurb: 'Books that mostly add up, and a back room that mostly does not.',
    launder: 1,
    revenue: 1,
    exposure: 0,
    wear: 0,
    inspectionChance: 0.004,
  },
  {
    id: 'hard',
    name: 'Lean on it',
    short: 'Lean',
    blurb:
      'Everything through the till and the staff told not to ask. It moves real money and it looks like exactly what it is.',
    launder: 1.9,
    revenue: 1.25,
    exposure: 1.4,
    wear: 1.1,
    inspectionChance: 0.022,
  },
];

export const PRESSURE_BY_ID: Record<PressureId, PressureDef> = Object.fromEntries(
  PRESSURES.map((p) => [p.id, p]),
) as Record<PressureId, PressureDef>;

/**
 * Saves written before the dial existed have none, and read as `normal`.
 *
 * The old behaviour is the middle setting exactly — every multiplier on it is
 * 1 or 0 — so an existing front is untouched by this and an existing career
 * plays identically until somebody turns a dial.
 */
export const DEFAULT_PRESSURE: PressureId = 'normal';

export const INSPECTION = {
  /** Health taken when one goes badly. */
  healthCost: 22,
  /** Exposure added, because now there is a file with an address on it. */
  exposureCost: 12,
  /**
   * Health above which an inspection is survived quietly.
   *
   * A well-run front passes. This is the part that makes "keep it clean" a
   * real strategy rather than a slower one — the risk is not a dice roll you
   * cannot affect, it is a dice roll you have already decided the outcome of.
   */
  survivesAbove: 65,
} as const;
