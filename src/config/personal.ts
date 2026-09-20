/**
 * The half of a boss that is not the business.
 *
 * The largest untouched pillar of the Mafia-boss vision, and the one the audit
 * was most honest about: **no measurement supports it.** A search of the whole
 * source tree for wife, home, dinner or personal life returned nothing, and no
 * blind round has ever asked for any of it. It is here because the brief asks
 * for it, and it is deliberately the smallest version that is not decoration.
 *
 * What that means in practice, and what it rules out:
 *
 * **No second roster.** The household is three or four people with a name, a
 * relation and how close they are — not `Npc`s. An `Npc` is somebody the game
 * assigns to jobs, pays a wage, tracks skill and courage for, and lists on the
 * crew sheet, and none of that is true of a brother-in-law. Reusing the type
 * would have put them all on the payroll, which is the duplicate-system
 * failure the brief bans wearing a costume of reuse.
 *
 * **One consequence, and it is a real one.** Neglect makes the boss easier to
 * depose. That is not a metaphor: a man who is only ever seen in the back room
 * is a man whose own people know him only as the work, and when the room turns
 * there is nobody in it with a personal reason to stand with him. It plugs
 * into `tickDeposition`, which the succession file calls *"the only way out of
 * the chair that is entirely the player's own work"* — which is exactly what
 * this is.
 *
 * **And it asks rather than nags** — but the player can also just go.
 *
 * The first version had no button anywhere. The pull toward home arrived only
 * as a memo, on a weighted draw, on a day the authored pool had nothing, and
 * round 15 waited **233 days** for it while the daily card counted upward at
 * them the whole time:
 *
 *   *"For 230 days the game showed me a rising counter I had no way to act on.
 *   I assumed for most of the run that I was missing a screen."*
 *
 * That was a tax with a name on it, which is precisely what the paragraph
 * above said not to build. The memo stays — it is the part that has a person
 * in it and arrives when the simulation chose — and there is now a plain
 * button on the Yourself screen, because a boss deciding to go home should not
 * have to be invited.
 */

export interface RelationDef {
  id: string;
  /** How the boss would refer to them. */
  label: string;
  /** What they ask for, in the memo. */
  asks: string;
}

/*
   None of these say what anybody is.

   The first version had "your wife", "your son", "your mother" — and the name
   pool in `config/npcs.ts` is deliberately mixed, because nothing in this
   game's state has ever recorded a gender. The live screen duly read
   **"Carla, your son"**. `voice.test.ts` did not catch it: that check hunts
   gendered *pronouns*, and these were nouns.

   So the labels say the relation instead of the person, which is both correct
   and better writing — "the one you married" is how somebody in this game
   would say it anyway.
*/
export const RELATIONS: RelationDef[] = [
  {
    id: 'spouse',
    label: 'the one you married',
    asks: 'would like one evening that is not about anybody else',
  },
  {
    id: 'parent',
    label: 'the one who raised you',
    asks: 'has asked twice now whether you are eating',
  },
  { id: 'eldest', label: 'your eldest', asks: 'has a thing at the school on Thursday' },
  {
    id: 'youngest',
    label: 'your youngest',
    asks: 'has started answering questions the way you do',
  },
  {
    id: 'sibling',
    label: 'the one you grew up with',
    asks: 'wants to talk about something that is not work',
  },
  { id: 'elder', label: 'the oldest of them', asks: 'is old, and is asking after you' },
];

/**
 * Only `eldest` and `youngest` can start the game below adulthood — the
 * other four relations (`spouse`, `parent`, `sibling`, `elder`) are already
 * grown, and giving them a base age would be flavour with no mechanic
 * behind it. `memberAge` returns `null` for a relation with no entry here,
 * which is how `gen_family_crossroads`/`teen_trouble`'s gating knows to
 * skip a household that has neither child in it (see `sim/personal.ts` and
 * `CLAUDE.md`'s point about a household holding only 3 of 6 relations).
 *
 * The director's own figures for this milestone.
 */
export const CHILD_START_AGES: Record<string, { min: number; max: number }> = {
  eldest: { min: 14, max: 16 },
  youngest: { min: 8, max: 11 },
};

export type LifeStageId = 'child' | 'teen' | 'young_adult' | 'adult';

export interface LifeStageDef {
  id: LifeStageId;
  label: string;
  minAge: number;
  maxAge: number;
  /** The longer read, same role `HomeTier.blurb` plays for neglect. */
  blurb: string;
}

/** The director's own bands and copy. */
export const LIFE_STAGES: LifeStageDef[] = [
  {
    id: 'child',
    label: 'Child',
    minAge: 0,
    maxAge: 12,
    blurb: 'Still young enough to believe whatever you tell them.',
  },
  {
    id: 'teen',
    label: 'Teenager',
    minAge: 13,
    maxAge: 17,
    blurb: 'Has started noticing the men parked down the block.',
  },
  {
    id: 'young_adult',
    label: 'Young Adult',
    minAge: 18,
    maxAge: 22,
    blurb: 'Standing at the doorway of their own life.',
  },
  {
    id: 'adult',
    label: 'Adult',
    minAge: 23,
    maxAge: 100,
    blurb: 'Out in the world with your last name.',
  },
];

export const HOME = {
  /** Everybody forms an opinion once a week, like the rest of the game. */
  intervalDays: 7,
  /** How many people are in the house. Small on purpose. */
  household: 3,
  /**
   * How close a household member's 18th birthday has to be before the
   * PlayerPanel says anything about it. See `memberAge`/`daysUntilAdult` in
   * `sim/personal.ts` — the same "a heads-up, not a schedule" register
   * `familyHorizon` already uses, just for a date that is actually knowable
   * in advance rather than one that depends on a later day's draw.
   */
  comingOfAgeWithinDays: 30,

  /**
   * Neglect gained each week you are not seen at home, 0..100.
   *
   * Sized so that a boss who never goes home is in real trouble inside a
   * season and a boss who goes occasionally is fine. Thirteen weeks at 3.5 is
   * 45, which is where the deposition multiplier starts to bite.
   */
  perWeekAway: 3.5,
  /** ...and what one evening actually clears. */
  clearedByVisit: 22,

  /**
   * Days before going home again is worth anything.
   *
   * Not a cooldown on the button so much as on the *effect*: an evening at
   * home is worth an evening, and standing in the doorway four times on a
   * Tuesday is not worth four. Without this the panel control would be a bar
   * to top up, which is the failure the header describes.
   */
  visitAgainAfterDays: 7,

  /**
   * Where the multiplier on being deposed starts, and where it ends up.
   *
   * Below the first number nothing happens at all — a boss who sees his family
   * most months is not carrying this risk, and a penalty that applies to
   * everybody is a tax rather than a decision. Above it the multiplier walks
   * to `atWorst`.
   */
  depositionFrom: 45,
  depositionAtWorst: 1.9,
} as const;

/**
 * The four bars neglect is read against, and the one thing each is worth
 * saying about it.
 *
 * One table rather than two: this used to be a `[number, string][]` of bar
 * and label alone, and Milestone 2 needed a longer blurb and a tone for the
 * same four breakpoints. A second, separately-worded `HOME_CLIMATE` table on
 * the same 75/50/25/0 bars would drift from this one the first time either
 * got edited alone, which is the exact mistake `CLAUDE.md` calls out under
 * "reach for a derived read... no second copy to drift" — so the existing
 * table grew the fields instead of getting a sibling.
 */
export interface HomeTier {
  /** Neglect at or above this bar is in this tier. Checked highest-first. */
  bar: number;
  /** Stable id, for anything that needs to gate on a tier by name. */
  id: string;
  /** What the number is called on the screen. */
  label: string;
  /** The longer read, for a screen with room to say more than the label. */
  blurb: string;
  /** Reuses `KeyValue`'s own tone vocabulary rather than inventing a new one. */
  tone?: 'hot' | 'brass';
}

export const HOME_LABEL: HomeTier[] = [
  {
    bar: 75,
    id: 'estranged',
    label: 'They have stopped expecting you',
    blurb:
      'The house has stopped waiting on you. An evening here does not land the way it used to.',
    tone: 'hot',
  },
  {
    bar: 50,
    id: 'distant',
    label: 'You are not around much',
    blurb: 'You are noticeably gone, and it is starting to be counted.',
    tone: 'hot',
  },
  {
    bar: 25,
    id: 'missed',
    label: 'You are missed',
    blurb: 'An ordinary stretch away. Nothing is wrong yet.',
    tone: 'brass',
  },
  {
    bar: 0,
    id: 'present',
    label: 'You have been home',
    blurb: 'The house has no complaint.',
  },
];

/**
 * The calendar's own reasons to go home, as opposed to the house simply
 * having noticed you are never in it.
 *
 * `gen_asked_for_you` and `gen_home_or_business` (see `config/eventgen.ts`)
 * are both gated on neglect crossing a bar, which is right for "the house has
 * noticed" and wrong for a school play -- nobody's kid waits for a stat to
 * cross a bar before performing in one. These four are reachable regardless
 * of neglect; see `gen_family_dilemma` in `sim/eventgen.ts` for the gate that
 * replaces it (only that somebody in the house fits the occasion, and the
 * boss is not already spoken for tonight).
 *
 * Each is tagged to whichever `RELATIONS` id it is naturally about.
 * `celebration` is tagged to all of them on purpose -- a household that
 * happens not to include a sibling should not lose a quarter of the pool,
 * and "somebody had something to celebrate" is true of any of the six.
 */
export interface FamilyDilemmaDef {
  id: string;
  /** Which household relation(s) this occasion fits. */
  relationIds: string[];
  /**
   * Which life stage(s) (`LifeStageId`, above) the matching member has to be
   * in, for an occasion that only makes sense at one age. Undefined for the
   * four original entries — they fit a relation regardless of age, and
   * giving them all `'any'` would be a call site nobody asked to touch.
   */
  stages?: LifeStageId[];
  /** Names the occasion, for the title and the career record. */
  occasion: string;
  /** The memo's own words, third person implied -- for `oneOf()`. */
  bodies: string[];
  /** What showing up costs beyond the evening itself. 0 when presence is the whole ask. */
  attendCost: number;
  /** What sending something in your place costs. */
  sendCost: number;
  /** What gets sent, said the way the boss would put it. */
  sendGesture: string;
  /**
   * Overrides for this occasion alone — undefined on the four milestone 1-3
   * entries, which share `GEN_EFFECT.familyDilemmaAttendExtraClear`/
   * `familyDilemmaSendNeglect`/`familyDilemmaStayNeglect` uniformly. Only
   * `teen_trouble` sets these: the director's own figures for "settle it
   * with the sergeant" are a different shape than a nice evening at home,
   * clearing *less* than an ordinary visit and drawing heat besides, so the
   * shared constants (tuned for a school play or a sickbed) do not apply.
   */
  attendNeglectClear?: number;
  /** Extra heat picked up when *attending* means dealing with the law rather
   * than a school or a sickbed. Undefined everywhere but `teen_trouble`. */
  attendHeat?: number;
  /** Overrides `GEN_EFFECT.familyDilemmaSendNeglect` for this occasion alone. */
  sendNeglect?: number;
  /** Overrides `GEN_EFFECT.familyDilemmaStayNeglect` for this occasion alone. */
  stayNeglect?: number;
}

export const FAMILY_DILEMMAS: FamilyDilemmaDef[] = [
  {
    id: 'school_event',
    relationIds: ['eldest', 'youngest'],
    occasion: 'the school thing',
    bodies: [
      'has a thing at the school this week, the kind with an empty chair if you do not fill it',
      'already told somebody at the school that you would be there',
      'has a school thing coming up, and has stopped asking whether you are coming',
    ],
    attendCost: 0,
    sendCost: 200,
    sendGesture: 'a note and something from the good store, delivered instead of you',
  },
  {
    id: 'quiet_evening',
    relationIds: ['spouse'],
    occasion: 'one evening',
    bodies: [
      'wants one evening. Not a trip, not an occasion, just a night in the same room, awake',
      'asked for tonight specifically. Not next week. Tonight',
      'has stopped suggesting an evening and started just naming one',
    ],
    attendCost: 0,
    sendCost: 250,
    sendGesture: 'something from a jeweler, sent round with an excuse',
  },
  {
    id: 'sick_relative',
    relationIds: ['parent', 'elder'],
    occasion: 'being there',
    bodies: [
      'is not well, the kind of not well where somebody should be in the room',
      'took a turn, and the doctor is asking who is coming',
      'is in bed and asking for you by name, which has not happened before',
    ],
    /*
       Free, the same as `school_event`, `quiet_evening` and `teen_trouble`.

       It was 600, and round 29 met it holding $451, with both answers priced
       above that — $604 to go and $453 for the doctor. The only enabled
       button was "Not this time", and the tester's own words for it were
       *"which I did not choose at all — the game chose it for me."* A refusal
       the state forces is not a decision, and this one is the memo the same
       report called the best thing in the game.

       Sitting in the room is presence and an evening, not an expense. The
       bill is the doctor you send when you will not go yourself, which
       `sendCost` still charges at exactly what it charged before.
    */
    attendCost: 0,
    sendCost: 450,
    sendGesture: 'a doctor sent in your name, and the bill settled from a distance',
  },
  {
    id: 'celebration',
    relationIds: RELATIONS.map((r) => r.id),
    occasion: 'the celebration',
    bodies: [
      'has something worth celebrating, and wants you at it rather than told about it after',
      'is putting something together for a reason that will not come round again this year',
      'wants you at the table for once, not just the envelope',
    ],
    attendCost: 300,
    sendCost: 200,
    sendGesture: 'a gift, sent round with your name on the card',
  },
  /*
     Milestone 4. The only entry in this table gated on age rather than only
     on relation — a teenager is a different occasion than a child at the
     same school, and `gen_family_dilemma`'s own `applies`/`build` now check
     `stages` alongside `relationIds` for exactly that reason. `attendCost`
     is 0, the same as `quiet_evening` -- intervening personally costs the
     evening and nothing else; `sendCost` (800) is a lawyer, handled without
     you, matching this milestone's own figure.
  */
  {
    id: 'teen_trouble',
    relationIds: ['eldest', 'youngest'],
    stages: ['teen'],
    occasion: 'trouble with the law',
    bodies: [
      'was caught joyriding with friends in a precinct where the sergeant recognized your last name',
      'spent the night in a holding cell, and the desk sergeant already knew exactly whose kid it was',
      'got pulled in with friends who somehow found the one precinct where somebody still remembers you',
    ],
    attendCost: 0,
    sendCost: 800,
    sendGesture: 'a lawyer, quietly, so the paperwork disappears without you ever showing your face',
    // The director's own exact deltas: settling it personally clears less
    // than an ordinary visit (-20, not the usual -33) and costs +3 heat;
    // the lawyer nudges neglect +3 rather than the shared +2; letting him
    // spend the night spikes neglect +12 rather than the shared ~8.75.
    attendNeglectClear: 20,
    attendHeat: 3,
    sendNeglect: 3,
    stayNeglect: 12,
  },
];

/**
 * The body the rest of this file's argument keeps calling "the resource."
 *
 * Neglect above is the one consequence of not going home. Stress is the same
 * idea turned outward: what running two wars, carrying real heat, owing your
 * own men and being estranged from your own house does to the man doing it,
 * all at once. Every driver below reads a fact another system already tracks
 * — `playerWars`, `org.heat`, `home().neglect`, `org.wagesOwed` — rather than
 * inventing a second ledger of its own, for the same reason `neglect` reads
 * real visits instead of a mood somebody rolled.
 *
 * One number, not ten. The brief that asked for this named panic attacks,
 * sleep, collapse and the need for private counsel as symptoms of a single
 * condition, not four separate meters, and `config/personal.ts`'s own header
 * already argues against a second roster's worth of stats for a layer no
 * measurement has ever asked for twice.
 */
export const STRESS = {
  max: 100,
  /** Stress gained weekly per active war. Wars are the loudest, most sustained pressure the game already tracks. */
  perWar: 3.5,
  /** Stress gained weekly once federal attention is real rather than background. */
  highHeat: 3.0,
  /** Stress gained weekly once the house has crossed from "missed" into "distant" — the same bar `HOME_LABEL`'s 50 tier reads. */
  domesticStrain: 2.5,
  /** Stress gained weekly with any payroll shortfall carried — the men are not the only ones aggrieved by it. */
  wageArrears: 3.0,
  /**
   * Stress lost weekly with nothing above firing — no war, heat under 30,
   * neglect under 25. A boss who is not actually under pressure recovers;
   * one who is stays where he is rather than sliding further on a system he
   * cannot see, the same "no tax that applies whatever you do" rule `HOME`
   * follows for `depositionFrom`.
   */
  naturalRecovery: 2.0,
  /** What a discreet consultation costs before `priced()` — see `personal.ts`'s `canConsult`/`consultDoctor`. */
  consultCost: 350,
  /** What one consultation clears. Roughly two months of quiet accrual at the worst single driver above, so it is worth doing and not worth doing weekly. */
  consultRecovery: 28,
  /** Days before another consultation is worth anything — same idiom as `HOME.visitAgainAfterDays`. */
  consultCooldownDays: 7,
  /**
   * Where a register read against the true `leadership` stat starts paying
   * for it — see `sim/sitdown.ts`'s `lands()`. Only the worst tier bites, for
   * the reason `HOME.depositionFrom` only starts penalising neglect once it
   * is real: a penalty that starts at the first bar is a tax on every career
   * that ever fights a war, which is most of them.
   */
  criticalLeadershipPenalty: 0.75,
  /**
   * The extra dulling `gen_panic_episode`'s sedatives choice leaves behind
   * for a week — see the `sedated_until_day` flag. Independent of the tier
   * penalty above and stacks with it, because taking the pills is supposed
   * to cost something even once they have done their job and stress itself
   * has dropped clear of `critical`.
   */
  sedatedLeadershipPenalty: 0.85,
  /** Sedatives dull perception for this many days — see `gen_panic_episode`. */
  sedatedDays: 7,
  /** Heat at or above which a consultation risks being noticed and recorded — see `consultDoctor`. */
  secrecyRiskHeat: 60,
  /** Threshold where panic attacks become possible. See `gen_panic_episode` in `sim/eventgen.ts`. */
  panicThreshold: 75,
} as const;

export interface StressTierDef {
  bar: number;
  id: 'calm' | 'strained' | 'overloaded' | 'critical';
  label: string;
  blurb: string;
  tone?: 'hot' | 'brass';
}

/** The same four-bar shape `HOME_LABEL` uses, checked highest-first. */
export const STRESS_TIERS: StressTierDef[] = [
  {
    bar: 80,
    id: 'critical',
    label: 'Critical',
    blurb: 'Chest tightens without warning. Breath will not come all the way down.',
    tone: 'hot',
  },
  {
    bar: 55,
    id: 'overloaded',
    label: 'Overloaded',
    blurb: 'Constant tension. Sleep is broken and short.',
    tone: 'brass',
  },
  {
    bar: 25,
    id: 'strained',
    label: 'Strained',
    blurb: 'Carrying the weight of the street and the house.',
  },
  {
    bar: 0,
    id: 'calm',
    label: 'Measured',
    blurb: 'Mind is clear. Decisions come without hesitation.',
  },
];

// ------------------------------------------------------------ confidant ---

/**
 * The half of a boss that is not the household either.
 *
 * `HOME` above is the life a boss is supposed to have. This is the one he
 * actually keeps — an apartment nobody in the family knows the address of,
 * and somebody in it who wants nothing from the organization. It relieves
 * exactly the pressure `STRESS` accumulates, and it is the only relief in
 * this file that carries its own risk rather than just a price.
 *
 * **Discretion is the whole mechanic, and it does three things.** Below
 * `wiretapDiscretionThreshold` a federal case already at `surveillance`
 * starts absorbing evidence it did not have to work for
 * (`sim/investigation.ts`). Below `discoveryDiscretionThreshold` the
 * kitchen finds out (`gen_affair_fallout`, `sim/eventgen.ts`). And keeping
 * it up costs money on a schedule, which is the third. A meter that only
 * fed the first would be a second heat bar; a meter that only fed the
 * third would be an upkeep line.
 *
 * **It decays faster in a house that is already cold.** `neglectDecayMultiplier`
 * is the one coupling between this and `HOME`, and it runs the direction the
 * fiction does: a spouse who has not seen you in two months is a spouse who
 * has started counting the evenings.
 *
 * Figures are the brief's own.
 */
export const CONFIDANT = {
  /** What a lounge singer, a curator or a nurse is doing when you are not there. */
  roles: ['Lounge Singer', 'Art Gallery Curator', 'Boutique Manager', 'Hospital Nurse'],
  initialDiscretion: 75,
  weeklyDiscretionDecay: 3,
  /** Extra decay once `home().neglect` is at or past the domestic-strain bar. */
  neglectDecayMultiplier: 1.5,
  /** Matches `STRESS.domesticStrain`'s own bar rather than a second number for the same idea. */
  neglectDecayFrom: 50,
  /** An evening. Priced well under `STRESS.consultCost` — this is not a doctor. */
  visitCost: 250,
  visitDiscretionGain: 15,
  visitStressRelief: 12,
  /** Money instead of time: rent, a dressmaker, somebody who does not ask. */
  allowanceCost: 500,
  allowanceDiscretionGain: 25,
  /** Below this, a case at `surveillance` or past it starts hearing things. */
  wiretapDiscretionThreshold: 45,
  wiretapEvidenceWeekly: 1.5,
  /** How long the intercept beat stays quiet before it is worth saying again. */
  wiretapBeatEveryDays: 28,
  /** Below this, the kitchen finds out — see `gen_affair_fallout`. */
  discoveryDiscretionThreshold: 30,
  /** Or a house this cold works it out on its own, whatever the discretion says. */
  discoveryNeglect: 75,
  /** Ending it: the house still counts the fact that there was something to end. */
  falloutBreakNeglect: 10,
  falloutBreakStress: 20,
  /** Denying it: free, and the most expensive answer in the room. */
  falloutDenyNeglect: 35,
  falloutDenyDiscretion: 40,
  /** Buying it back: real money, and it does not end anything. */
  falloutPeaceCost: 5000,
  falloutPeaceNeglectClear: 15,
  falloutPeaceDiscretion: 60,
} as const;
