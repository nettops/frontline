/**
 * Running the fronts has to make you better at running fronts.
 *
 * The Yourself panel says attributes improve by use. Measured against that,
 * round 11 finished a 303-day career at **Business 1/20** having owned and
 * operated five fronts for 265 days, and Influence 2/20. Every
 * `trainAttribute` call in the game is inside `events.ts` — attributes were
 * trained by answering memos and by nothing else, while Business and Influence
 * gate the laundering cut, the police contacts and city hall.
 *
 * Sized for a career a person actually plays, which is the correction iterations
 * 1 and 2 both needed: `attributeProgressNeeded` is 3 + level * 1.6, so 22
 * points of progress reaches Business 4. A boss washing money most weeks for
 * 38 weeks — round 11's five fronts over 265 days — should land about there,
 * not at 1.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { tickBusinesses } from '../business';
import { BUSINESS_FROM } from '../../config/businesses';
import { attributeProgressNeeded } from '../../config/economy';

describe('learning the legitimate trade', () => {
  it('is sized so a working laundry reaches a useful level inside a career', () => {
    // 38 weeks is round 11's five fronts over 265 days.
    const earned = BUSINESS_FROM.launderingPerWeek * 38;
    let level = 0;
    let left = earned;
    while (left >= attributeProgressNeeded(level)) {
      left -= attributeProgressNeeded(level);
      level += 1;
    }
    expect(level).toBeGreaterThanOrEqual(3);
    expect(level).toBeLessThanOrEqual(6);
  });

  it('teaches nothing to a family that owns no fronts', () => {
    /*
       A first version asserted the starting Business attribute was 0. It is 1 —
       my assumption about the game, not the game. The property worth asserting
       is that a payday with nothing owned moves nothing, which is what
       "improve by use" means.
    */
    const state = newGame({ name: 'Wash', difficulty: 'normal', seed: 9 });
    const before = state.player.attributes.business;
    const progressBefore = state.player.attributeProgress.business;

    const rng = new Rng(state.rng);
    tickBusinesses(state, rng);

    expect(state.player.attributes.business).toBe(before);
    expect(state.player.attributeProgress.business).toBe(progressBefore);
  });
});
