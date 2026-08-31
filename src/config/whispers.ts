/**
 * What you hear, and how much of it is true.
 *
 * Round 14's second MUST FIX: "The memo pool exhausts, and after Capo it is the
 * only source of new content. One memo fired six times with identical text and
 * options; between day 180 and day 300 the tester met exactly one memo it had
 * not seen before."
 *
 * A memo is authored, so there is a finite number of them. A whisper is
 * generated out of what is actually happening — a man whose loyalty is going,
 * a case putting on weight, a rival who has started counting your districts —
 * so the supply is the simulation itself and it does not run out.
 *
 * **The rule that makes this worth having: a whisper can be wrong.**
 *
 * Everything else in this game that reports on the world is true and merely
 * blurred — `perceive` adds noise to a real stat and never invents a man.
 * Intelligence is different, and `beliefs.ts` already does the honest version
 * of it for the other families: they attribute incidents to whoever they find
 * plausible and are sometimes simply mistaken, with a confidence that hardens
 * on corroboration and decays on silence.
 *
 * This is that, pointed at the player. A feed of true statements with a number
 * next to each is a stats panel wearing a hat; a feed you have to decide
 * whether to act on is the thing the boss fantasy is actually made of.
 */

/** What a whisper is about. Each one is generated from real state. */
export type WhisperKind =
  /** Somebody in the family is talking to the law. */
  | 'somebody_talking'
  /** A named person is unhappy enough to move. */
  | 'losing_somebody'
  /** An agency is building something. */
  | 'they_are_building'
  /** Another family is interested in ground you hold. */
  | 'they_want_the_ground'
  /** Somebody is taking more than their share. */
  | 'skimming';

export interface WhisperKindDef {
  kind: WhisperKind;
  /** Weight in the draw. Rarer things should be rarer. */
  weight: number;
  /**
   * Chance the whisper is simply wrong when it fires, 0..1.
   *
   * Not uniform. A rumour that somebody is talking is the one people invent
   * about each other constantly and the one it hurts most to act on wrongly,
   * so it is the least reliable in the game — and killing the wrong man is
   * already the worst outcome `informants.ts` can produce.
   */
  wrongChance: number;
}

export const WHISPER_KINDS: WhisperKindDef[] = [
  { kind: 'somebody_talking', weight: 20, wrongChance: 0.45 },
  { kind: 'losing_somebody', weight: 26, wrongChance: 0.25 },
  { kind: 'they_are_building', weight: 22, wrongChance: 0.15 },
  { kind: 'they_want_the_ground', weight: 20, wrongChance: 0.3 },
  { kind: 'skimming', weight: 12, wrongChance: 0.35 },
];

export const WHISPERS = {
  /** How often anybody brings you anything. */
  intervalDays: 7,

  /**
   * Chance per interval that something reaches you at all.
   *
   * Not every week. A feed that produces an item on a fixed schedule is a
   * schedule, and the player learns to read the calendar instead of the
   * content.
   */
  chancePerInterval: 0.55,

  /** Kept at once. A ring buffer, oldest dropped. */
  kept: 14,

  /** Days after which a whisper is old news and stops being shown. */
  staleAfterDays: 45,

  /**
   * Confidence the source puts on it, before your own intelligence is applied.
   *
   * Two bands rather than one, and they overlap on purpose. A true whisper is
   * usually more confident than a false one and *not always*, because a
   * threshold the player can learn — "anything over 70 is true" — deletes the
   * decision this system exists to create.
   */
  confidenceWhenTrue: [0.45, 0.95] as [number, number],
  confidenceWhenWrong: [0.3, 0.8] as [number, number],

  /**
   * How much a second whisper about the same subject hardens the first.
   *
   * Corroboration is the only honest way to tell true from false here, which
   * makes waiting a real strategy and makes acting early a real risk.
   */
  corroboration: 0.15,
} as const;

/**
 * How confidence is said out loud.
 *
 * A percentage, unlike everything else in this game, and deliberately. Every
 * other reading is banded because it describes a fact the player is not
 * entitled to know precisely. This describes *how sure somebody else is*,
 * which is a thing a person can be told exactly — and the number is the whole
 * decision.
 */
export const WHISPER_CONFIDENCE_LABEL: [number, string][] = [
  [0.85, 'They would swear to it'],
  [0.6, 'They believe it'],
  [0.4, 'They heard it from somebody'],
  [0, 'They are guessing'],
];

/**
 * Going and finding out, which is the decision the feed never offered.
 *
 * A whisper could be read and corroborated by waiting, and that was all. The
 * player's only move against a rumour was patience, so the feed was a thing
 * that happened to them rather than a thing they worked.
 *
 * What this adds is a *second opinion*, and deliberately not an answer. The
 * contact you ask is a person with their own reach and their own reasons, and
 * `WHISPERS.wrongChance` already establishes that this game's information is
 * fallible on the way in. It would be a strange system that made it infallible
 * on the way back.
 *
 * So asking hardens or undermines the confidence and never touches `truth`.
 * The player still decides, which is the whole mechanic — the difference is
 * that they can now spend something to decide sooner.
 */
export const LOOK_INTO = {
  /**
   * How often the contact is right about what they went and found.
   *
   * Above a coin and well below certainty. At 0.75 a single opinion is worth
   * having and two agreeing opinions are worth acting on, which is the shape
   * the corroboration mechanic already had and this is meant to accelerate
   * rather than replace.
   */
  contactIsRight: 0.75,

  /** What agreement adds to how sure the room is, and disagreement takes. */
  agreesConfidence: 0.2,
  disagreesConfidence: -0.25,

  /**
   * Days after it arrived that a rumour is still worth a favour.
   *
   * Shorter than `staleAfterDays`, because a fortnight-old rumour is still
   * worth reading and is no longer worth spending a favour on: whatever it was
   * about has either happened or has not.
   */
  worthCheckingWithin: 21,
} as const;
