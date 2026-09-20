/**
 * The banner over "What you are made of" and the page under it must agree.
 *
 * Round 30: the coach said the unspent points "lift your odds on every job you
 * run", and the panel it points at said, a screen further down, "not the odds
 * on tonight's job, which come from doing the work". Both cannot be true, and
 * the panel is: `sim/build.ts` and `config/build.ts` are explicit that a point
 * unlocks a verb and changes how the city treats you, that it is not a
 * multiplier, and that nothing about it is luck. `buildPointsAndOdds.test.ts`
 * holds that as a property; this holds the sentence.
 */
import { describe, expect, it } from 'vitest';
import player from '../panels/PlayerPanel.tsx?raw';

const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const PLAYER = code(player).replace(/\s+/g, ' ');

describe('the unspent-points banner', () => {
  it('does not promise better odds on every job', () => {
    expect(PLAYER).not.toMatch(/lifts your odds on every job/);
    expect(PLAYER).not.toMatch(/lift your odds/i);
  });

  it('says what a point does buy: a verb, and how the city treats you', () => {
    expect(PLAYER).toMatch(/unlock verbs and shape how the city treats you/);
  });

  it('agrees with the panel it points at', () => {
    expect(PLAYER).toMatch(/not the odds on tonight's job/);
  });
});
