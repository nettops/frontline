/**
 * The Why page shows the dice.
 *
 * Round 30's tester could not tell a run of bad luck from a rigged table and said
 * so: "a per-roll log in Why would settle it." The record lives on the finished
 * job (`sim/__tests__/rolls.test.ts`); this holds that the page reads it and
 * puts the comparison in front of the player — the shown odds, the roll, and the
 * sum of the odds against what actually went right.
 */
import { describe, expect, it } from 'vitest';
import why from '../panels/DebugPanel.tsx?raw';

const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const WHY = code(why).replace(/\s+/g, ' ');

describe('the dice on the Why page', () => {
  it('reads the record through rollRead, not a second copy of the arithmetic', () => {
    expect(WHY).toMatch(/rollRead\(state\)/);
  });

  it('puts the roll beside the odds it was against, for each job', () => {
    expect(WHY).toMatch(/Rolled/);
    expect(WHY).toMatch(/needed/);
    expect(WHY).toMatch(/row\.roll/);
    expect(WHY).toMatch(/row\.chance/);
  });

  it('adds the shown odds up against what went right', () => {
    expect(WHY).toMatch(/read\.expected/);
    expect(WHY).toMatch(/read\.got/);
  });

  it('says so when earlier jobs have no dice on file', () => {
    expect(WHY).toMatch(/read\.unrecorded/);
  });
});
