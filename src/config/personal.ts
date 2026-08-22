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
 * **And it asks rather than nags.** The pull toward home arrives as a memo
 * through the generative event system, at a moment the simulation chose,
 * carrying a name. A panel that quietly accrued a penalty while the player
 * looked at other screens would be a tax, not a life.
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

export const HOME = {
  /** Everybody forms an opinion once a week, like the rest of the game. */
  intervalDays: 7,
  /** How many people are in the house. Small on purpose. */
  household: 3,

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

/** What the number is called on the screen. */
export const HOME_LABEL: [number, string][] = [
  [75, 'They have stopped expecting you'],
  [50, 'You are not around much'],
  [25, 'You are missed'],
  [0, 'You have been home'],
];
