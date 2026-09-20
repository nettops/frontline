/**
 * Which earlier row already said this.
 *
 * For each entry, the index of the first entry with the same text, or null when
 * it is the first or has nothing to say. A list of refusals that repeat — a
 * district with no room refuses every business in it in the same words — reads
 * as a wall when each says it in full, and as a hole when only one does; this
 * lets the rest point at the one that did. See `BusinessesPanel`.
 */
export function firstWithSameReason(reasons: (string | undefined)[]): (number | null)[] {
  const first = new Map<string, number>();
  return reasons.map((reason, i) => {
    if (reason === undefined) return null;
    const seen = first.get(reason);
    if (seen === undefined) {
      first.set(reason, i);
      return null;
    }
    return seen;
  });
}
