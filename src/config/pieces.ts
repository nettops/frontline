/**
 * What went out with them.
 *
 * Three acts in this game leave a body — `silence`, a mark landing, and
 * accusing one of your own — and all three filed the same `source: 'violence'`
 * trace at the same strength whatever the family actually owned. The arms
 * trade next door is a full system (crates, workshops, suppliers, strength in
 * a war, seizure) and none of it ever reached the one night it should have.
 *
 * This is the missing question and nothing else. A piece has two facts.
 *
 * ## Not a catalogue
 *
 * The obvious build is `prototypes/pixel-arms.html`'s thirty-one pieces as
 * items with cost, heat and odds columns. That is thirty-one rows of
 * near-identical numbers, one of which dominates each situation, and the
 * choice collapses after the first career. The sheet says so itself, about its
 * own reference:
 *
 *     the finishes here are the reference's trick pointed at something the
 *     game already has an opinion about. Not rarity — provenance.
 *
 * So the roster below carries a name, a class and the sheet's own `leaves`
 * line, and no balance figures at all. Every one of the thirty-one has a
 * picture and a place on the panel. None of them has a price.
 *
 * ## The two facts
 *
 * **Class** is how much of a street knows. Up the scale it buys odds and costs
 * attention, which is the same trade `OPERATIONS` runs, pointed at one night.
 *
 * **Provenance** is where it came from, and it is the whole system: what the
 * piece leaves behind when it is used, and whether you can afford for that to
 * be nothing.
 *
 * ## The early game, which this was nearly wrong about
 *
 * A boss does not send his people out unarmed. So a piece is never something
 * you acquire before you may act, the shelf is never empty, and no act can be
 * blocked or worsened for want of one. That is `work_it_yourself`'s stance
 * about work — the answer is never nothing — and `__tests__/pieces.test.ts`
 * puts it first because it would be the worst thing here to get wrong.
 *
 * Day one the family owns what it owns. The system at that point is a
 * **readout, not a shop**: no crates, no cash, nobody selling to you, and the
 * only live lever is which of the four you send out. It widens on its own as a
 * career does — the street door opens with money, the crate door with the
 * trade, and the gift door with diplomacy.
 *
 * ---------------------------------------------------------------------------
 * The same limit `contraband.ts` sets and the prototype sheet repeats: these
 * are objects with a provenance, and nothing here describes how anything is
 * made, modified or concealed in the real world. Nothing that does may be
 * added.
 * ---------------------------------------------------------------------------
 */

/** How much of the cell it fills, which is how much of the street knows. */
export type PieceClass = 'pocket' | 'coat' | 'long';

/**
 * Where it came from, which is the whole system.
 *
 * The finish is the prototype sheet's own recolouring trick and carries no
 * number — `house` and `crate` share one because a serial is a serial. What
 * separates them is whose paper trail it is, and yours is worse.
 */
export type Provenance = 'house' | 'cold' | 'crate' | 'given';

/** The sheet's second sort. Flavour here; see the note on charges below. */
export type PieceKind = 'firearm' | 'blade' | 'blunt' | 'fire' | 'charge';

export interface PieceDef {
  id: string;
  name: string;
  cls: PieceClass;
  kind: PieceKind;
  /** The sheet's own line, which is the log copy. */
  leaves: string;
}

export const PIECE_CLASSES: PieceClass[] = ['pocket', 'coat', 'long'];

/**
 * What each class buys and what it costs.
 *
 * Both numbers move together or the class is a slider rather than a decision,
 * and `__tests__/pieces.test.ts` asserts exactly that.
 *
 * Anchored against the act it modifies rather than picked to look reasonable.
 * `SILENCE.base` is 0.72 and clamps at 0.92, so `long`'s +0.10 takes an
 * ordinary target from a coin flip weighted your way to something you would
 * commit to — a real step, and still not a formality.
 *
 * ## Measured, and the measurement corrected the paragraph that was here
 *
 * This comment used to argue that `long`'s 1.75 puts a successful killing at
 * 15.75 against `SILENCE.heatOnFailure` of 13, and concluded that the loud way
 * that works costs more than the quiet way that does not. That is true of one
 * night and **false over a career**, which is the only scale that matters.
 *
 * `ladder.probe`'s `what the family carries` arm, 36 careers of the bot that
 * deals with its worst men, carrying long against carrying pocket:
 *
 *     landed            67% against 59%
 *     heat-weeks        2,283 against 2,420
 *     violence on books 729 against 846
 *     estate            p25 −$278,139 · median +$31,553 · p75 +$977,098
 *     careers ahead     19 of 36
 *
 * The loud gun is *quieter over a career*, and the reason is `marks.ts`: a
 * botched attempt leaves a man who is talking for months, and every week of
 * that costs `MARK.talksHeat` on the inside channel plus `heatPerTry` on the
 * street. Landing eight points more often buys more silence than 75% more
 * noise costs. The per-night arithmetic was right and the conclusion drawn
 * from it was wrong.
 *
 * 19 of 36 is what keeps it a decision — a shade over a coin flip, with a p25
 * of −$278,139 for the careers where the extra attention arrived at the wrong
 * moment. The arm bundles the purchase, because a boss who decides his people
 * carry rifles has to buy rifles and those come cold; it answers "is deciding
 * this worth it", not "what do the two multipliers do in isolation".
 *
 * `pocket` is deliberately the identity. Every balance figure in this game was
 * measured before any of this existed, and the default policy has to leave
 * those measurements standing.
 */
export const CLASS: Record<
  PieceClass,
  { name: string; odds: number; heat: number; blurb: string }
> = {
  pocket: {
    name: 'Pocket',
    odds: 0,
    heat: 1,
    blurb: 'Goes anywhere. Nothing about carrying it is a decision.',
  },
  coat: {
    name: 'Coat',
    odds: 0.05,
    heat: 1.3,
    blurb: 'Concealable while standing still. Not while running.',
  },
  long: {
    name: 'Long',
    odds: 0.1,
    heat: 1.75,
    blurb: 'Cannot be carried down a street without the street knowing.',
  },
};

/**
 * What each provenance leaves behind, as a share of the trace the act was
 * going to file anyway.
 *
 * `SILENCE.evidenceStrength` is 19, which is the figure to read these against:
 *
 *     cold    19 → 10   under what a *dismissal* files, which is the purchase
 *     house   19 → 19   the measured game, unchanged
 *     crate   19 → 28   above a seizure, because the serial is yours
 *
 * `crate` being the worst of them is the point of the late game. The trade
 * that made you rich is the trade with your name on the paperwork, and
 * `ARMS_SALE` already says the same thing pointing outward — sell crates and
 * you arm the people you will fight. This is that edge turned around.
 *
 * `given` sits at house because a gift has somebody else's trail on it. What
 * it costs is not evidence; it is that the family who handed it over now holds
 * something, which is a bond movement rather than a number here.
 */
export const PROVENANCE: Record<
  Provenance,
  {
    name: string;
    finish: 'blued' | 'blacked' | 'nickel';
    evidence: number;
    /**
     * How careful the job looks to somebody trying to work out who did it.
     *
     * Fed straight to `beliefs.ts:attribute` as its `care` argument, which
     * subtracts `ATTRIBUTION.clarityFromCare` at 1 and nothing at 0. This is
     * the second half of provenance and the more interesting one: on the three
     * acts that already existed, a cold piece bought a smaller trace and
     * nothing else, and `ladder.probe` reported that as barely worth $3,400.
     * On a contract it buys the chance that the family blames the Kestler.
     */
    care: number;
    blurb: string;
  }
> = {
  house: {
    /*
       Kind-neutral copy, deliberately. The sheet's own line for `blued` is
       about factory finish and serials, and it was wrong on three of the first
       four things a career sees — a family cupboard holds a razor and a sap,
       and neither has a serial on it. What is true of all of them is that
       somebody else had it first.
    */
    name: 'The family had it',
    finish: 'blued',
    evidence: 1,
    care: 0.4,
    blurb: 'Somebody else had it first, and whatever it did then is still attached to it.',
  },
  cold: {
    name: 'Cold',
    finish: 'blacked',
    evidence: 0.55,
    // The purchase. Nothing on it is the difference between a family that
    // knows and a family that has a theory.
    care: 0.95,
    blurb: 'Nothing on it and nothing behind it. You paid for that.',
  },
  crate: {
    name: 'Out of your own crates',
    finish: 'blued',
    evidence: 1.45,
    // Worst of the four, and the late game's joke. What you left behind has
    // your paperwork on it.
    care: 0.05,
    blurb: 'A serial you put on it yourself, and it points at the workshop.',
  },
  given: {
    name: 'A gift',
    finish: 'nickel',
    evidence: 1,
    // Somebody else's trail, which cuts both ways: it is not yours, and it is
    // very much theirs.
    care: 0.55,
    blurb: 'Worth more than the job, and impossible to sell without saying who from.',
  },
};

/**
 * A piece used twice.
 *
 * The decision the whole system exists for. Keeping a piece is free, and the
 * next body joins the last one — one thread tying two nights together, which
 * is the thing a player will remember about this feature.
 *
 * Capped, for the reason every cap in this project exists: without one, a gun
 * kept for a decade is an unbounded number and the answer to it is a rule
 * rather than a decision.
 */
export const JOIN = {
  /** Strength per earlier body, filed as a second `violence` trace. */
  perBody: 9,
  /** Earlier bodies past this one stop adding. */
  cap: 3,
};

/**
 * Getting rid of it, which is neither free nor certain.
 *
 * Shaped on `DISPOSAL` in `config/scores.ts` on purpose — the score already
 * has this exact beat, down to the copy about the river, and a second system
 * for the same act would be a second set of numbers saying the same thing.
 * Rolled against control where you live, because getting rid of something is
 * easier on ground your own people watch.
 *
 * The cost of dumping is not money. It is the piece, which early in a career
 * is a quarter of everything the family owns.
 */
export const DUMP = {
  base: 0.7,
  /** Added at full influence in the district you sit in. */
  perControl: 0.25,
  /** What it files when it turns up. `source: 'disposal'`, like the gear. */
  strength: 14,
};

/*
   Measured, and the finding is about *who* it pays for rather than whether.

   `ladder.probe`, 36 careers each, dumping against keeping. Two populations,
   because the answer is different for each and that difference is the design:

       killing freely (19 a career)     joins 321 → 30, 23 of 36 ahead,
                                        median +$379,264
       killing sparingly (3 a career)   joins 22 → 6, 15 of 36 ahead,
                                        median −$119,909
       carrying long as well            18 of 36, median +$2,063

   So getting rid of the piece pays for a boss who kills constantly — and this
   file's neighbour has already shown that boss is losing on every other axis.
   For the boss who uses the act three times in four years it is a bill for
   almost nothing: with three killings a piece is rarely reused, so there is
   barely a chain to break, and the cold pieces are paid for anyway.

   Nothing was tuned off these readings, and that is deliberate. Moving 23 of
   36 down to something tidier would be raising a threshold until an arm comes
   out the way it was wanted, which is DIRECTOR §5 and which the arm next door
   names in as many words. A policy that helps you only once you are already
   playing badly is a decision with a real shape, not a defect.
*/

/**
 * What the family already owns, on the first morning.
 *
 * Four, because that is enough that dumping one is a decision and few enough
 * that it is a real one. Weighted to `pocket` — a family that has not started
 * anything yet does not keep rifles.
 *
 * `oldBody` is the thing that teaches the system with no tutorial. A gun that
 * has been in a house for years has been out before, so some of these already
 * carry somebody else's body and the first silencing can come back heavier
 * than expected. That must be a reading and never a trap: the panel says the
 * piece has been in the family a long time, which is `perceive()`'s stance
 * everywhere else — you are told there is something to know, and not the
 * number.
 */
export const HOUSE = {
  count: 4,
  /** Share of them that have already been out. */
  oldBody: 0.34,
};

/**
 * The street door. Opens with money and nothing else.
 *
 * Priced against the other door on purpose. One crate is worth $16,500 and
 * breaks into `CRATE_BREAK.pieces`, so a crate-piece and a cold piece cost
 * almost exactly the same money — and leave 1.45 against 0.55. That is the
 * whole middle-to-late game in one comparison: identical price, opposite
 * paperwork.
 *
 * Out of reach on day one, which is correct. The early game is not supposed to
 * have this choice; it is supposed to be the reason you want it.
 */
export const COLD = {
  cost: 3_400,
};

/** One crate, broken out. See `COLD` for why this many. */
export const CRATE_BREAK = {
  pieces: 5,
};

/**
 * Doing it with a charge instead.
 *
 * The sheet parked these with a promise it could not keep: *"Not a crime the
 * city handles. Everything here escalates who is looking."* `EvidenceSource`
 * was a five-way union that every agency's `focus` read, so there was no way
 * to say that — a charge could only ever have been a bigger number, and a
 * bigger number is not what the line means.
 *
 * `ordnance` is that sixth source, and the whole design is **who reads the
 * file**. City Police work violence, operations and disposal, and their
 * ceiling is `arrests` — they can ruin a month and cannot end you. They do not
 * work this. Neither does Financial Crimes. What is left is the Task Force and
 * the Bureau, whose ceilings are `indictment` and `trial`.
 *
 * So the decision is not "how loud". It is: take the certainty, and hand the
 * case to the two people in the city who can finish you.
 *
 * Only on a contract. A charge is a thing you leave under a car belonging to
 * somebody with an address you know, which is a rival — there is no version of
 * this aimed at a man of your own sitting in a room, and `silence` is not
 * getting a bomb.
 */
export const CHARGE = {
  /**
   * Added to the odds. A charge does not miss the way a man with a gun does.
   *
   * Sized above `CLASS.long.odds` of 0.10, because the whole trade is that it
   * buys more certainty than any gun and costs something no gun costs.
   */
  odds: 0.18,
  /** Multiplies the heat. A crater is not a shooting. */
  heat: 2.4,
  /** ...and the trace, which is filed as `ordnance` rather than `violence`. */
  evidence: 1.3,
  /**
   * What the neighbourhood takes from it.
   *
   * The second cost and the one a player will feel later. Sentiment gates
   * businesses, operation success and eventually whether anybody will sell to
   * you — and a street that has had a car go up on it does not forget which
   * family that was about.
   */
  sentiment: -14,
  /**
   * How careful it looks to somebody working out who did it.
   *
   * Low whatever the piece was. Provenance is about an object left behind and
   * a charge does not leave one; what it leaves is a very short list of people
   * with a reason. This overrides the piece's own `care`.
   */
  care: 0.15,
} as const;

/**
 * The rack.
 *
 * Ported name-for-name from `prototypes/pixel-arms.html`, including its
 * `leaves` lines, which are the log copy. Order is the sheet's.
 *
 * `fire` and `charge` are here because they are drawn and they are part of
 * what the family owns, and they are **not carried** on any of the three acts
 * — see `CARRIED` below. Charges in particular stay parked: the sheet's own
 * promise is that they hand the case to somebody with their own investigators,
 * and `EvidenceSource` is a five-way union that every agency's `focus` reads.
 * Widening it is a law-system change and not an armoury one.
 */
export const PIECES: Record<string, PieceDef> = {
  snub: { id: 'snub', name: 'Snub .38', cls: 'pocket', kind: 'firearm', leaves: 'a body, and a neighbour who heard it' },
  auto32: { id: 'auto32', name: 'Flat .32', cls: 'pocket', kind: 'firearm', leaves: 'a body and a casing' },
  razor: { id: 'razor', name: 'Razor', cls: 'pocket', kind: 'blade', leaves: 'a body, and nothing that traces back' },
  switch: { id: 'switch', name: 'Switchblade', cls: 'pocket', kind: 'blade', leaves: 'a body, and something easy to lose' },
  pick: { id: 'pick', name: 'Ice pick', cls: 'pocket', kind: 'blade', leaves: 'a body, and a tool that looks like a tool' },
  sap: { id: 'sap', name: 'Sap', cls: 'pocket', kind: 'blunt', leaves: 'someone who wakes up, and remembers' },
  knuckles: { id: 'knuckles', name: 'Knuckles', cls: 'pocket', kind: 'blunt', leaves: 'a beating and no object left behind' },
  garrote: { id: 'garrote', name: 'Garrote', cls: 'pocket', kind: 'blade', leaves: 'a body, and nothing dropped at all' },
  bottle: { id: 'bottle', name: 'Bottle', cls: 'pocket', kind: 'fire', leaves: "a fire, and the fire marshal's own people" },
  tin: { id: 'tin', name: 'A tin', cls: 'pocket', kind: 'charge', leaves: 'nothing, until it is found in your workshop' },
  auto45: { id: 'auto45', name: 'Service .45', cls: 'coat', kind: 'firearm', leaves: 'a body, and casings nobody picked up' },
  magnum: { id: 'magnum', name: 'Long .357', cls: 'coat', kind: 'firearm', leaves: 'a body, and a street that heard it' },
  quiet: { id: 'quiet', name: 'Quiet .22', cls: 'coat', kind: 'firearm', leaves: 'a body, and nobody who knows when' },
  lupara: { id: 'lupara', name: 'Sawn-off', cls: 'coat', kind: 'firearm', leaves: 'a body, and a message nobody misses' },
  mac: { id: 'mac', name: 'Machine pistol', cls: 'coat', kind: 'firearm', leaves: 'more than one body, and federal interest' },
  cleaver: { id: 'cleaver', name: 'Cleaver', cls: 'coat', kind: 'blade', leaves: 'a body, and a kitchen that needs explaining' },
  hammer: { id: 'hammer', name: 'Claw hammer', cls: 'coat', kind: 'blunt', leaves: 'a body, and a tool from a toolbox' },
  bar: { id: 'bar', name: 'Tire iron', cls: 'coat', kind: 'blunt', leaves: 'a beating, and a witness who recovers' },
  pipe: { id: 'pipe', name: 'Length of pipe', cls: 'coat', kind: 'blunt', leaves: 'a beating, and a pipe in a river' },
  chain: { id: 'chain', name: 'Chain', cls: 'coat', kind: 'blunt', leaves: 'a beating, and a crowd that saw it' },
  stick: { id: 'stick', name: 'A stick', cls: 'coat', kind: 'charge', leaves: 'a crater, and three agencies' },
  bundle: { id: 'bundle', name: 'A bundle', cls: 'coat', kind: 'charge', leaves: 'a building, and a federal case' },
  charge: { id: 'charge', name: 'A capped pipe', cls: 'coat', kind: 'charge', leaves: 'a car, and a federal case' },
  pump: { id: 'pump', name: 'Pump gun', cls: 'long', kind: 'firearm', leaves: 'a body, and the street it happened on' },
  double: { id: 'double', name: 'Double gun', cls: 'long', kind: 'firearm', leaves: 'a body, and a shot heard a block away' },
  bolt: { id: 'bolt', name: 'Scoped rifle', cls: 'long', kind: 'firearm', leaves: 'a body, and nobody nearby at all' },
  heirloom: { id: 'heirloom', name: 'The heirloom', cls: 'long', kind: 'firearm', leaves: 'a body, and a gun older than you' },
  bat: { id: 'bat', name: 'Bat', cls: 'long', kind: 'blunt', leaves: 'a hospital, and someone who can testify' },
  can: { id: 'can', name: 'A can', cls: 'long', kind: 'fire', leaves: 'a fire, and an insurance investigator' },
  box: { id: 'box', name: 'A box', cls: 'long', kind: 'charge', leaves: 'nothing alone, and everything if it is found' },
};

/**
 * The ones that go out on a night that leaves a body.
 *
 * Fire and charges are neither — an arson and a bombing are different acts
 * against different targets and the game does not model either. They stay on
 * the panel, drawn, as part of what the family owns.
 */
export const CARRIED: PieceDef[] = Object.values(PIECES).filter(
  (p) => p.kind === 'firearm' || p.kind === 'blade' || p.kind === 'blunt',
);

export const CARRIED_BY_CLASS: Record<PieceClass, PieceDef[]> = {
  pocket: CARRIED.filter((p) => p.cls === 'pocket'),
  coat: CARRIED.filter((p) => p.cls === 'coat'),
  long: CARRIED.filter((p) => p.cls === 'long'),
};

/**
 * What the two doors actually hand over.
 *
 * Firearms only, and it is a fiction correction rather than a balance one. A
 * man selling cold pieces out of a car is not selling you a claw hammer, and a
 * crate out of an arms workshop does not break into razors. The family
 * cupboard is the one place the whole rack belongs, because a cupboard is
 * where a sap ends up.
 */
export const BOUGHT_BY_CLASS: Record<PieceClass, PieceDef[]> = {
  pocket: CARRIED_BY_CLASS.pocket.filter((p) => p.kind === 'firearm'),
  coat: CARRIED_BY_CLASS.coat.filter((p) => p.kind === 'firearm'),
  long: CARRIED_BY_CLASS.long.filter((p) => p.kind === 'firearm'),
};
