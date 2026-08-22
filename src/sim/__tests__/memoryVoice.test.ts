/**
 * Every memory line is rendered after the word "They".
 *
 * `CrewPanel` prefixes each one with "They " or "Years ago they ", so the text
 * has to agree with a plural subject. Round 11 caught "They **has** been the one
 * you send" — and it is not one line, it is ten of fourteen: eight of them start
 * "was", which reads "They was arrested on a job you sent them on".
 *
 * The crew detail panel is the one screen in this game that makes a person out
 * of a row. It is the wrong place to be ungrammatical.
 */
import { describe, expect, it } from 'vitest';

import { MEMORIES } from '../../config/memories';

/** Verb forms that only agree with a singular subject. */
const SINGULAR_OPENERS = /^(has|was|is|does|goes|knows|takes|gets|makes|says)\b/;

describe('memory lines', () => {
  it('agree with the plural subject the screen puts in front of them', () => {
    const offenders = Object.values(MEMORIES)
      .filter((m) => SINGULAR_OPENERS.test(m.text))
      .map((m) => `${m.kind}: "They ${m.text}"`);

    expect(offenders).toEqual([]);
  });

  it('read as a sentence after both prefixes the panel uses', () => {
    for (const memory of Object.values(MEMORIES)) {
      for (const prefix of ['They ', 'Years ago they ']) {
        const line = `${prefix}${memory.text}.`;
        // No double spacing, no leading capital mid-sentence, ends cleanly.
        expect(line).not.toMatch(/\s{2,}/);
        expect(memory.text[0]).toBe(memory.text[0].toLowerCase());
        expect(memory.text.endsWith('.')).toBe(false);
      }
    }
  });
});
