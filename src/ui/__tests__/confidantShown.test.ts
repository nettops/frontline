/**
 * The private life, on the page, with both refusals visible.
 *
 * Same discipline `refusalShown.test.ts` documents at length: a disabled
 * control whose reason lives only in a `title` has failed rule 4 four
 * separate times in this project's history, and a tooltip is not on the
 * screen. This layer ships two buttons that can both be refused for the same
 * reason (an empty wallet) and one that can be refused on its own (a night
 * already given to the house), so the panel has to render whichever ones
 * apply rather than only the first.
 *
 * Source-text assertions rather than a render, matching every other file in
 * this directory — there is no DOM harness here, and what these guard is
 * that the wiring exists at all, which is exactly the class of fault a
 * missing panel produces.
 */
import { describe, expect, it } from 'vitest';
import player from '../panels/PlayerPanel.tsx?raw';

describe('the address across the river, on the screen', () => {
  it('reads the sim rather than the raw state', () => {
    // `state.confidant` is optional with a lazy initialiser; a panel reaching
    // past `confidant()` would read `undefined` on every save written before
    // Milestone 6.
    expect(player).toContain('confidant(state)');
    expect(player).not.toMatch(/state\.confidant/);
  });

  it('offers both ways of paying for it', () => {
    expect(player).toContain('visitConfidant');
    expect(player).toContain('payConfidantAllowance');
  });

  it('shows the meter as a number, beside what the number does', () => {
    expect(player).toContain('Discretion ');
    expect(player).toContain('CONFIDANT.wiretapDiscretionThreshold');
    expect(player).toContain('CONFIDANT.discoveryDiscretionThreshold');
  });

  /*
     Round 21's fault in its exact shape: the reason rendered only for one of
     the controls, so the other's blocker lived in a `title` nobody hovers.
     Both `canVisitConfidant` and `canPayAllowance` have refusals the other
     does not.
  */
  it('prints every live refusal in the body, not only the first', () => {
    // The call site, not the import block at the top of the file.
    const at = player.indexOf('visitConfidant(g)');
    expect(at, 'the control is gone or renamed').toBeGreaterThan(-1);
    const nearby = player.slice(at, at + 2000);
    /*
       Named as a pair, not merely mentioned. The first draft of this guard
       asserted the two words appeared somewhere nearby and passed with
       `allowance` dropped from the list — `allowanceCash` and
       `payConfidantAllowance` are both in the same block, so the word was
       there whether or not the check was. This is the difference between a
       test that has been seen to fail and one that has not.
    */
    expect(nearby).toContain('[visiting, allowance]');
    expect(nearby).toMatch(/<p[^>]*>\s*\{reason\}/);
  });
});
