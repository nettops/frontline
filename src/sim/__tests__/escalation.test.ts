/**
 * Events that remember what you did last time.
 *
 * A playtester saw "somebody tested your name in public" three times across a
 * session and called it filler by the third — on a build where it already had
 * three titles and three bodies, added the previous round specifically because
 * an earlier tester had complained about repetition.
 *
 * That is the whole lesson of this file. Variants are dressing. What made the
 * third one feel like the first was that the event did not escalate and did not
 * know what had been answered, so no amount of new prose could have fixed it.
 * `arrest_pressure` was given real staging for the same complaint and has not
 * been raised by anybody since.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { EVENT_DEF_BY_ID, resolveEvent } from '../events';
import { crewList } from '../npc';
import { pushEvent } from '../util';
import type { GameState } from '../types';

function game(seed = 5): GameState {
  const state = newGame({ name: 'Voice', difficulty: 'normal', seed });
  state.org.respect = 60;
  return state;
}

/** Raises the event, answers it the given way, and hands back what was shown. */
function challenge(state: GameState, answer: 'violence' | 'talk' | 'ignore') {
  const rng = new Rng(state.rng);
  const def = EVENT_DEF_BY_ID['respect_challenge'];
  const ctx = def.applies(state, rng);
  if (!ctx) throw new Error('respect_challenge does not apply — the setup is wrong');

  const built = def.build(state, rng, ctx);
  pushEvent(state, built);
  const queued = state.pendingEvents[state.pendingEvents.length - 1];
  const shown = {
    title: queued.title,
    body: queued.body,
    stage: queued.data.stage as number,
  };
  resolveEvent(state, rng, queued.id, answer);
  return shown;
}

describe('being spoken about', () => {
  it('arrives further along each time it is ignored', () => {
    const state = game();
    const first = challenge(state, 'ignore');
    const second = challenge(state, 'ignore');
    const third = challenge(state, 'ignore');

    expect(first.stage).toBe(0);
    expect(second.stage).toBe(1);
    expect(third.stage).toBe(2);

    // ...and it is not the same page with a different number on it.
    expect(new Set([first.body, second.body, third.body]).size).toBe(3);
    expect(new Set([first.title, second.title, third.title]).size).toBe(3);
  });

  it('costs more the further along it gets', () => {
    const state = game();
    const before = state.org.respect;
    challenge(state, 'ignore');
    const afterOne = state.org.respect;
    challenge(state, 'ignore');
    const afterTwo = state.org.respect;

    const firstCost = before - afterOne;
    const secondCost = afterOne - afterTwo;
    expect(secondCost).toBeGreaterThan(firstCost);
  });

  it('turns the crew against you once they have watched it twice', () => {
    /*
       The consequence that makes the third one land. It is not a bigger number
       on the standing meter — it is the men who work for you drawing the
       obvious conclusion about what standing next to you is worth.
    */
    const state = game();
    const regard = () =>
      crewList(state).reduce((s, n) => s + n.stats.respectForBoss, 0) / crewList(state).length;

    challenge(state, 'ignore');
    const afterOne = regard();
    challenge(state, 'ignore');
    challenge(state, 'ignore');

    expect(regard()).toBeLessThan(afterOne);
  });

  it('settles when you answer it, and starts over', () => {
    const state = game();
    challenge(state, 'ignore');
    challenge(state, 'ignore');
    expect(state.flags['let_it_go']).toBe(2);

    challenge(state, 'violence');
    expect(state.flags['let_it_go']).toBe(0);

    // The next one is a fresh matter rather than a fourth instalment.
    const next = challenge(state, 'ignore');
    expect(next.stage).toBe(0);
  });

  it('settles when it is handled quietly and you can actually talk', () => {
    const state = game();
    state.player.attributes.negotiation = 20;
    challenge(state, 'ignore');
    challenge(state, 'talk');
    expect(state.flags['let_it_go']).toBe(0);
  });

  it('holds, rather than escalating, when the quiet word does not land', () => {
    /*
       The third outcome, and the test that got this rule right by being wrong
       first. A failed attempt was asserted to settle it; it does not, and it
       should not — nothing was resolved and the room saw that. But it does not
       advance either, because the player did not ignore it. Trying and failing
       holds the line, which is what makes negotiation worth having without
       making a bad roll feel like a punishment for acting.
    */
    const state = game();
    state.player.attributes.negotiation = 0;
    challenge(state, 'ignore');
    expect(state.flags['let_it_go']).toBe(1);

    challenge(state, 'talk');
    expect(state.flags['let_it_go']).toBe(1);
  });
});
