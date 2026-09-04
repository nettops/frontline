/**
 * What a JSON tuning file gives up, and how it is bought back.
 *
 * Moving a table out of TypeScript and into JSON costs exactly one thing: the
 * compiler stops checking the *ids*. `DifficultyDef.id` is
 * `'easy' | 'normal' | 'hard' | 'brutal'`, but an imported JSON string is
 * `string`, so the assertion that lands the data in its declared type will
 * accept `"esay"` without a word — and the failure surfaces far away, as a
 * `DIFFICULTY_BY_ID[...]` that is `undefined` halfway through a career.
 *
 * Every other guarantee survives the move. A missing key, a number written as
 * a string, a whole section deleted: `resolveJsonModule` infers the shape of
 * the file and the declared type rejects it at build time, exactly as a
 * literal would have been rejected.
 *
 * So this closes the one hole rather than re-checking what is already checked.
 * It runs at module load, which means `npm test` and `npm run build` both hit
 * it, and a bad id is a loud failure at the point of the edit instead of a
 * quiet `undefined` an hour into a game.
 *
 * **When player-supplied overrides arrive, this is the seam they go through**,
 * and the throw becomes a fall back to the shipped defaults with a warning —
 * a file somebody typed by hand must never be able to stop the game booting.
 * Bundled data is different: it is ours, it is in the repository, and if it is
 * wrong the build is the right place to find out.
 */

/** Every id in `ids` is expected, and every expected id is present, once. */
export function checkIds(file: string, field: string, ids: readonly string[], expected: readonly string[]): void {
  const seen = new Set(ids);
  const want = new Set(expected);

  const unknown = ids.filter((id) => !want.has(id));
  const missing = expected.filter((id) => !seen.has(id));
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);

  const faults = [
    unknown.length ? `unknown ${field}: ${unknown.join(', ')}` : '',
    missing.length ? `missing ${field}: ${missing.join(', ')}` : '',
    duplicated.length ? `duplicate ${field}: ${[...new Set(duplicated)].join(', ')}` : '',
  ].filter(Boolean);

  if (faults.length) {
    throw new Error(`${file}: ${faults.join('; ')}`);
  }
}

/**
 * The tiers of a band table must cover the scale without a gap or an overlap.
 *
 * `heatTier` takes the last tier whose floor a reading has passed, so a gap
 * cannot make it return nothing — but it can silently widen a band, which is
 * how the meter reported *Quiet* at 25.6 for the life of the project. An
 * ordered, abutting table is the property that bug violated, so it is the one
 * worth asserting when the table becomes editable.
 */
export function checkBands(file: string, bands: readonly { min: number; max: number }[]): void {
  if (!bands.length) throw new Error(`${file}: no bands`);
  if (bands[0].min !== 0) throw new Error(`${file}: bands must start at 0, not ${bands[0].min}`);

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (b.max < b.min) throw new Error(`${file}: band ${i} ends (${b.max}) before it starts (${b.min})`);
    const next = bands[i + 1];
    if (next && next.min !== b.max + 1) {
      throw new Error(
        `${file}: band ${i} ends at ${b.max} and band ${i + 1} starts at ${next.min} — bands must abut`,
      );
    }
  }
}
