/**
 * How an order gets from the boss's mouth to the man who carries it out.
 *
 * Until now there was no such thing. An order was a function call: the player
 * clicked, the crew went, and the only question the game asked was whether the
 * job came off. That left the single most famous piece of tradecraft in this
 * world — the fact that talking is itself the dangerous part — as flavour text
 * nothing implemented.
 *
 * Two ways to say it, and the trade is the whole feature:
 *
 * **The walk.** Nobody can put a microphone on a sidewalk that has not been
 * picked yet. It is immune to the wire, it leaks nothing into a file, and it
 * cannot be misheard, because the man is looking at your face. What it costs
 * is the evening — the same evening `goHome`, `visitConfidant`,
 * `consultDoctor` and `visitPetProject` all charge against, which is the only
 * genuinely scarce resource the boss has. An order given on foot is a night
 * not spent at home, and the household keeps its own book about that.
 *
 * **The phone.** Free, instant, and it works every time — right up until
 * somebody is listening, at which point it is the cheapest evidence a
 * prosecutor ever collected. And even when nobody is listening it can go
 * wrong on its own: a man who has to be told in metaphor is a man who can
 * take the metaphor the wrong way.
 *
 * Neither dominates, which is the property that matters. The walk is always
 * safe and always expensive; the phone is always free and only sometimes
 * catastrophic. A boss with nothing on him and no van outside has no reason
 * to spend a night, and that is correct — the tradecraft is supposed to start
 * mattering the week the file does.
 */

/** The two ways to say it. */
export type TransmissionMethod = 'walk_and_talk' | 'phone_euphemism';

export const TRADECRAFT = {
  /**
   * Whether the walk spends the boss's evening (`went_home_day`).
   *
   * A flag rather than a number because there is no partial version of this:
   * he is either out walking somebody round a block for an hour or he is
   * somewhere else. Kept in config rather than hard-coded so the one thing
   * that prices the safe option can be read next to what the unsafe one costs.
   */
  walkAndTalkEveningCost: true,

  /**
   * What a wire hears, in evidence, when the order goes down a phone line.
   *
   * Sized against `CONFIDANT.wiretapEvidenceWeekly` (2.0) and `SUBURBS`'s
   * panicked-neighbour statement — the same order of magnitude as the other
   * two things that feed a file from outside the agency's own work. A shade
   * above the wiretap's weekly figure because this is not ambient chatter
   * picked up over seven days; it is the boss on a tape ordering a specific
   * thing on a specific night.
   */
  wiretapInterceptionEvidence: 2.5,

  /**
   * How often a man takes the euphemism the wrong way, before anything about
   * him is taken into account.
   *
   * Low on purpose. At 15% the phone is still the obviously convenient choice
   * for an ordinary crew on an ordinary week — the feature is not "the phone
   * is bad", it is "the phone is bad *with this man*, on the week they are
   * listening". Multiplied up by who is carrying it, below.
   */
  misfireBaseChance: 0.15,

  /**
   * Below this, a man cannot reliably hold a sentence that means something
   * other than what it says.
   *
   * Same bar `SILENCE` and `CREW_SKILL_VS_DISCIPLINE` treat as the line
   * between a careful man and a liability, and deliberately above the middle
   * of the generation range — more than half the roster is fine on the phone,
   * which is what keeps this a fact about a person rather than a tax.
   */
  misfireDisciplineBelow: 45,

  /** What being below that bar multiplies the misfire chance by. */
  misfireDisciplineMultiplier: 2,

  /**
   * Traits that mishear an instruction for reasons discipline does not cover.
   * `hot_headed` hears permission to escalate in anything; `sloppy` simply
   * does not listen properly the first time.
   */
  misfireTraits: ['hot_headed', 'sloppy'] as readonly string[],

  /** What one of those traits multiplies the misfire chance by. */
  misfireTraitMultiplier: 1.8,

  /**
   * Heat from a misfire.
   *
   * The whole cost of getting it wrong, and it is street heat rather than
   * evidence: a man who did more than he was asked did it in public. Sized
   * against `SILENCE.heat` and the operations layer's own worst outcomes —
   * expensive enough to notice on the same week, not enough to end a career
   * on its own.
   */
  misfireHeat: 12,
} as const;
