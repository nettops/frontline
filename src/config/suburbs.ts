/**
 * The four houses on either side, and what they cost.
 *
 * A boss who has moved out of the neighbourhood lives among people who are
 * not in the life and have never been asked to be. They are useful — a
 * physician, a lawyer, a developer all control something no soldier can reach
 * — and they are the single most fragile thing in the organization, because
 * none of them took an oath and all of them have children and a mortgage.
 *
 * That is the whole design. A favour is cheap, it is legal, it moves public
 * standing rather than money, and every one of them puts a civilian on the
 * list of people a federal agent will eventually sit across a table from.
 * Omertà is a thing crews have. Neighbours have lawyers who advise them to
 * cooperate.
 */

export interface SuburbanNeighbourDef {
  id: string;
  name: string;
  /** Who they are, said the way the boss would say it. */
  what: string;
  /**
   * The civic figure their word carries with — the favour's standing lands on
   * that figure's existing bar rather than on a new meter, so "legitimacy"
   * here is the same `publicStanding` every other system already reads.
   */
  figureId: string;
  /** Which of the favours below this one can actually arrange. */
  favours: string[];
}

export interface SuburbanFavourDef {
  id: string;
  name: string;
  blurb: string;
  /** What arranging it costs, before `priced()`. Small: this is not a job. */
  cost: number;
  /** Standing it moves on the neighbour's figure. */
  standing: number;
  /**
   * How much deeper it pulls the civilian in — added to their `exposure`, the
   * number the panic roll reads. A stolen car in their driveway compromises a
   * man far more than a letter to an admissions office does.
   */
  exposure: number;
  /** Days before the same neighbour is worth asking again. */
  cooldownDays: number;
}

export const SUBURBAN_NEIGHBOURS: SuburbanNeighbourDef[] = [
  {
    id: 'cusamano',
    name: 'Dr. Cusamano',
    what: 'The physician two doors down. Golf on Saturdays, and a wife who organises the block.',
    figureId: 'judge',
    favours: ['stolen_luxury_car', 'private_school_recommendation'],
  },
  {
    id: 'neighbour_lawyer',
    name: 'Alan Ginsberg',
    what: 'Estate law, three towns over. He has never once asked what you do.',
    figureId: 'alderman',
    favours: ['predatory_contractor', 'private_school_recommendation'],
  },
  {
    id: 'developer',
    name: 'Vic Cardone',
    what: 'Puts up half the strip malls in the county and wants to be seen with somebody.',
    figureId: 'captain',
    favours: ['zoning_variance', 'predatory_contractor'],
  },
];

export const SUBURBAN_FAVOURS: SuburbanFavourDef[] = [
  {
    id: 'stolen_luxury_car',
    name: 'A car at cost',
    blurb:
      'He mentioned wanting one. It arrives on a Tuesday, off a container, for a third of the sticker. ' +
      'He does not ask, and that is the part that ties him to you.',
    cost: 1_200,
    standing: 6,
    exposure: 22,
    cooldownDays: 45,
  },
  {
    id: 'predatory_contractor',
    name: 'A contractor who finishes',
    blurb:
      'His extension has been half-built for eight months. Two of your people visit the contractor, ' +
      'and the work is done by the end of the month.',
    cost: 800,
    standing: 5,
    exposure: 16,
    cooldownDays: 45,
  },
  {
    id: 'private_school_recommendation',
    name: 'A letter to the school',
    blurb:
      'He writes to the admissions office about your daughter. It costs him nothing and it is the ' +
      'most respectable thing anybody has ever done for you.',
    cost: 400,
    standing: 9,
    exposure: 8,
    cooldownDays: 60,
  },
  {
    id: 'zoning_variance',
    name: 'A variance on the parcel',
    blurb:
      'The board meets on the second Thursday. He knows all four of them and the vote goes the way ' +
      'he says it will go.',
    cost: 2_500,
    standing: 11,
    exposure: 26,
    cooldownDays: 60,
  },
];

export const SUBURBS = {
  /**
   * Heat at which agents start knocking on ordinary doors.
   *
   * Either this or a case that has reached `surveillance` is enough — a van
   * outside means they are already building a list of everybody the boss
   * talks to, and the neighbours are on it whether the number is 40 or not.
   */
  panicHeatFloor: 40,

  /**
   * Weekly chance a compromised civilian folds, per point of their exposure.
   *
   * Deliberately small. At the worst single favour (`zoning_variance`, 26)
   * this is 1.3% a week — a neighbour who did you one favour is a risk you
   * can carry for a year. A boss who has three of them each carrying three
   * favours is not, and that is the line the feature is drawing.
   */
  panicChancePerExposure: 0.0005,

  /**
   * What a panicked civilian is worth to the file.
   *
   * Counted as `absorbed` rather than as agency work, for the same reason
   * the wiretap is — see `tribute.ts`'s `wireIsLive` and the note in
   * `tickInvestigations`: `absorbed > 0` is what keeps a case warm, and the
   * bite of this layer is a file that stays alive on a quiet month because
   * of somebody who was never in the family at all.
   */
  panicEvidence: 1.5,

  /** Ceiling on a civilian's exposure, so favours do not compound forever. */
  maxExposure: 100,
} as const;

export const SUBURBAN_NEIGHBOUR_BY_ID: Record<string, SuburbanNeighbourDef> =
  Object.fromEntries(SUBURBAN_NEIGHBOURS.map((n) => [n.id, n]));

export const SUBURBAN_FAVOUR_BY_ID: Record<string, SuburbanFavourDef> = Object.fromEntries(
  SUBURBAN_FAVOURS.map((f) => [f.id, f]),
);
