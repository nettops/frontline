/**
 * When the list says something is going wrong.
 *
 * `sim/attention.ts` was built for the recurring loop — men idle, groundwork
 * waiting — and every bar here belongs to the half added later, which says
 * that something is *developing* rather than that something is available.
 *
 * The numbers are all chosen against one property, and it is the same one the
 * file's own cap of six was chosen against: **most weeks, most of these are
 * silent.** A line that is always present is not a warning, it is furniture,
 * and a player learns to read past furniture inside a week.
 */
export const ATTENTION = {
  /**
   * Days after a case changes stage that the move is still news.
   *
   * Gated on the move rather than on the case, because a case exists for most
   * of a career — a permanent line saying so would be the wallpaper the cap
   * was written against. A fortnight is roughly how long the counterplay for
   * a stage stays worth doing.
   */
  caseMovedWithin: 14,

  /**
   * Health at which a front is going under rather than merely doing badly.
   *
   * Deliberately close to the floor. A shop at half health is a shop having a
   * bad quarter and the player does not need telling; a shop at this level is
   * one that closes if nobody goes and deals with it, which is a decision
   * rather than a reading.
   */
  frontFailingAt: 25,
} as const;
