/**
 * When somebody decides to come and find you.
 *
 * Every number here is a bar for a hidden stat, and the whole set is tuned
 * against one property rather than against each other: **most people, most
 * weeks, are not at your door.** A crew of twelve where three are waiting is a
 * bad month and reads as one. A crew of twelve where nine are waiting is a
 * screen the player learns to scroll past, and the same screen tells them the
 * simulation is shouting rather than speaking.
 *
 * So the bars are deliberately high — above the point where a stat is merely
 * elevated, at the point where a person would actually do something about it
 * — and the cooldown is long enough that being seen counts for something.
 *
 * The stats these read are the same ones `perceive()` blurs, and the reason
 * that is allowed is written at the top of `sim/approaches.ts`: the man is
 * telling you. Nothing here may put a number on a screen.
 */
export const APPROACH = {
  /**
   * Three at the outside.
   *
   * `attention.ts` caps its own list at six and says why: a list that is
   * always full is wallpaper. A queue of people is worse than a list of
   * chores at the same length, because each one has a name and reads as an
   * obligation — so this cap is half of that one.
   */
  most: 3,

  /**
   * Days after a room before the same man will ask for another.
   *
   * Longer than `SITDOWN.cooldownDays`, and that gap is deliberate. The
   * sit-down's cooldown governs what the *player* may do; this governs what a
   * man will ask for, and somebody who has just been heard does not come back
   * the moment he is technically allowed to. Without this, anybody over a bar
   * stands in the doorway every single day until the bar comes down, which is
   * a nag rather than a person.
   */
  quietDaysAfterMeeting: 21,

  /**
   * Grievance at which he stops waiting to be asked.
   *
   * Set above the point where the crew sheet would already be describing him
   * as difficult. Below this he is unhappy and gets on with it, which is most
   * unhappy people most of the time.
   */
  grievanceAsksAbove: 55,
  /** ...and where it has stopped being something that resolves itself. */
  grievanceUrgentAbove: 75,

  /**
   * Ambition at which watching somebody else go up is worth a conversation.
   *
   * Paired with a `passed_over` memory rather than standing alone, so this is
   * a man with a specific thing to point at rather than every ambitious man
   * on the payroll.
   */
  ambitionAsksAbove: 60,

  /**
   * Fear at which he comes looking for reassurance.
   *
   * Being frightened was the one pressure in this game with no answer at all
   * until `reassure` was added — heat has laying low, a grudge has the
   * conversation, being broke has the job board. This is the other half of
   * that repair: the register exists, and now the man it is for can ask.
   */
  fearAsksAbove: 65,

  /** How recent a memory has to be to still be the thing he leads with. */
  memoryFreshDays: 30,

  /**
   * Days left on a promise at which he stops asking politely.
   *
   * Inside `PROMISE.urgentWithin`, which is when the crew sheet starts saying
   * it in a warmer colour — so the man turns up while the sheet is already
   * warning, not instead of it.
   */
  promiseNowWithin: 3,
} as const;
