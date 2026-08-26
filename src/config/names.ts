/**
 * Given names, and the one thing about them the game is allowed to know.
 *
 * WHY THIS EXISTS
 *
 * The portraits derive a face from a hash, and until now they had no way to
 * know whether the person they were drawing was a man or a woman — so
 * `ui/art/look.ts` carried a comment saying the art must not assert what the
 * simulation does not know, and drew facial hair on everybody with equal
 * probability. That comment was right about the principle and wrong about the
 * consequences: refusing to assert produced a boss named Antoinette with a
 * full beard, which asserts something far louder than the thing it was
 * avoiding.
 *
 * The fix is not for the art to guess. It is for the name pools to carry the
 * fact, because that is where it was always known — `config/npcs.ts` has
 * thirty-two men's names followed by sixteen women's and has had since it was
 * written; the information was in the ordering and nowhere a program could
 * read it.
 *
 * WHAT IT IS AND IS NOT FOR
 *
 * This is a fact about a *name*, used to draw a face. It is not a simulation
 * quantity. Nothing scores on it, nobody is hired or promoted or paid
 * differently for it, and it is deliberately not stored on an Npc or a
 * FactionLeader — it is looked up from the name when a portrait is drawn, so
 * a save written before this existed gets the same treatment as a new one.
 * See sim/names.ts for the lookup.
 *
 * The household in config/personal.ts stays as it is: "the one you married"
 * and "the one who raised you" are written without a sex on purpose, and that
 * is a better answer than flagging them would be.
 */

/** A name, and whether it reads as a man's or a woman's in 1978. */
export interface GivenName {
  name: string;
  sex: 'm' | 'f';
}

/**
 * The names out of a pool, in order.
 *
 * Every consumer of these pools draws with `rng.pick`, which is exactly one
 * call on the seeded stream regardless of the list's length or shape. Keeping
 * the flat array derived rather than hand-maintained is what guarantees that
 * adding the flag changed no draw anywhere: same names, same order, same
 * index, same man.
 */
export const namesOf = (pool: readonly GivenName[]): string[] => pool.map((n) => n.name);

/** Shorthand so a pool reads as a list of names rather than as a data structure. */
export const m = (...names: string[]): GivenName[] =>
  names.map((name) => ({ name, sex: 'm' as const }));
export const f = (...names: string[]): GivenName[] =>
  names.map((name) => ({ name, sex: 'f' as const }));
