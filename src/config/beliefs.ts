/**
 * What the other families think happened.
 *
 * Every piece of fog in this game pointed at the player. `perceive` blurs an
 * NPC, `factionIntel` blurs a family, `caseIntel` blurs an investigation, the
 * `observed` flag decides what reaches the log — and behind all of it the AI
 * read true state and was never wrong about anything. A family that loses
 * ground knew, instantly and correctly, exactly whose people had taken it.
 *
 * That is the difference between an opponent who *knows* and one who is
 * reasoning. This file is the second kind. When a family is harmed it works
 * out who did it, and how well it works that out depends on how much of the
 * district it was standing in and how carefully the job was done. When it
 * cannot tell, it blames somebody plausible — somebody present, somebody it
 * already dislikes, somebody with the muscle to have done it.
 *
 * The consequences are not scripted anywhere. Relationships already drive the
 * `ruin` agenda, pressure targeting and war declarations, so a family that
 * blames the wrong party redirects months of hostility at them without a
 * single new line in the AI. Two families can go to war over something the
 * player did in a district neither of them was watching closely.
 */

/** What kind of harm a family is trying to explain. */
export type IncidentKind = 'ground' | 'pressure' | 'violence';

export const INCIDENT_TEXT: Record<IncidentKind, string> = {
  ground: 'losing ground',
  pressure: 'being leaned on',
  violence: 'blood in the street',
};

export const ATTRIBUTION = {
  /**
   * How clearly they can see, before anything about the situation.
   *
   * Low on purpose. The default state of a 1978 city is that somebody moved
   * on you and nobody will say who — a family that is right by default has no
   * belief system, it has a lookup.
   */
  baseClarity: 0.28,

  /**
   * Standing in the district is the main thing that buys certainty. At 100
   * influence this alone is +0.55: you find out what happens on your own
   * street.
   */
  clarityPerPresence: 0.0055,

  /**
   * ...and being careful is what takes it away. Supplied by the caller as a
   * 0..1 measure of how quietly the thing was done — for the player that is
   * the discipline of the crew who did it and whatever their traits do to how
   * much they leave behind.
   */
  clarityFromCare: 0.34,

  min: 0.05,
  max: 0.95,

  /**
   * When they cannot tell, who gets blamed.
   *
   * These weight the candidates. Somebody standing in the district is the
   * obvious suspect; somebody they already dislike is the comfortable one;
   * somebody strong enough to have done it is the credible one. All three are
   * how people actually reason about a thing they did not witness, and none of
   * them is evidence.
   */
  plausibilityPresence: 1.0,
  plausibilityHostility: 0.85,
  plausibilityCapability: 0.45,
  /** Everybody in the frame keeps a small chance, or blame is deterministic. */
  plausibilityFloor: 0.15,

  /**
   * Influence a party needs in the district before they are even a candidate.
   *
   * You cannot be blamed for something you could not have done, and without
   * this the model was much worse than that suggests: hostility is the second
   * heaviest term, so anybody the victim already disliked collected blame for
   * everything that happened anywhere. A player at -50 became the whole city's
   * explanation for its own problems and spiralled — precisely the runaway the
   * relationship system was tuned to avoid years ago.
   *
   * Gating on presence also puts the mechanic somewhere the player can use it.
   * Misattribution now happens where districts are genuinely contested, which
   * makes *where* you work a decision about who gets blamed for it.
   */
  plausibleFrom: 5,

  /**
   * Somebody standing in the next district is also in the frame.
   *
   * Without this the mechanic was real and almost never fired: most districts
   * on this map have exactly two parties in them, so a family that could not
   * tell what happened had nobody to blame but the party that actually did it,
   * and "guessed" its way to the right answer. Measured at one or two
   * misattributions in twenty years.
   *
   * Adjacency is the natural frame — it is already what decides who can reach
   * a district at all — and it makes a neighbour a standing suspect for
   * everything that happens on the other side of the line, which is roughly
   * how neighbours work.
   */
  plausibilityAdjacent: 0.45,

  /**
   * How sure they are, which is separate from whether they are right.
   *
   * A family can be confidently wrong and tentatively correct, and the
   * confidence is what the player can eventually read off them — not the
   * truth of it.
   */
  confidenceWhenSeen: [0.7, 1] as [number, number],
  confidenceWhenGuessing: [0.25, 0.6] as [number, number],

  /** Relationship damage scales with how sure they are. */
  minDamageShare: 0.35,

  /** Suspicions kept per family, newest first. */
  kept: 12,
  /** After this long it is not something anybody brings up. */
  memoryDays: 240,
  /** Certainty fades with time even when the grudge does not. */
  confidenceDecayPerWeek: 0.015,

  /**
   * A second incident naming the same party hardens the first.
   *
   * This is what turns a guess into a conviction: nobody changes their mind
   * about who is doing this to them, they accumulate reasons.
   */
  corroborationConfidence: 0.12,
} as const;

/** How the player reads what a family believes, once they can read it at all. */
export const SUSPICION_BANDS: [number, string][] = [
  [0.75, 'They are certain'],
  [0.45, 'They are fairly sure'],
  [0, 'They have a theory'],
];
