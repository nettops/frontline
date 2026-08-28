/**
 * What wants you today.
 *
 * A manual playthrough found the game fun and the handling tedious, and one of
 * the four things named was moving between panels: the recurring loop touches
 * Operations, Organization and Territory, and nothing said which of them had
 * something waiting.
 *
 * The rule this file guards is the Rail's own, written where the three badges
 * live: **a badge is a demand for attention with no statement of what would
 * satisfy it.** A playtester carried the succession "!" for a hundred days
 * without knowing what it wanted. So every line here has to name the thing it
 * wants done, and every line has to be able to *not* be there — a list that is
 * always full is wallpaper, and a player learns to stop reading it in a week.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { attention } from '../attention';
import { crewList, generateNpc } from '../npc';
import { openScore } from '../scores';
import { startTraining } from '../training';
import { setStanding } from '../standingOrders';
import { HOME_TERRITORY } from '../../config/territories';
import { PATTERN } from '../../config/standingOrders';
import { territoryList } from '../territory';
import { DELEGATION } from '../../config/delegation';
import type { GameState } from '../types';

function game(seed = 3): GameState {
  const state = newGame({ name: 'Boss', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 10) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 400_000;
  return state;
}

describe('what wants you today', () => {
  /*
     The instrument first. A list that is never empty cannot be read, and a
     list that is never full is not reading anything.
  */
  it('is quiet when there is nothing to do about anything', () => {
    const state = newGame({ name: 'Boss', difficulty: 'normal', seed: 3 });
    // Nobody spare, nothing held, nothing running.
    for (const npc of crewList(state)) npc.status = 'busy';
    expect(attention(state)).toHaveLength(0);
  });

  it('says every line in terms of what would satisfy it', () => {
    const state = game();
    for (const t of territoryList(state)) {
      t.influence.player = DELEGATION.promptAboveInfluence + 10;
    }
    const lines = attention(state);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.text.length).toBeGreaterThan(0);
      expect(line.panel.length).toBeGreaterThan(0);
      // The Rail's rule: it has to name the thing, not just demand a look.
      expect(line.text).not.toMatch(/^(Attention|Something|Check)/i);
    }
  });

  it('names people standing about when there is work they could do', () => {
    const state = game();
    const lines = attention(state);
    expect(lines.some((l) => l.id === 'idle')).toBe(true);
    expect(lines.find((l) => l.id === 'idle')!.panel).toBe('operations');
  });

  it('stops naming them once nobody is spare', () => {
    const state = game();
    for (const npc of crewList(state)) npc.status = 'busy';
    expect(attention(state).some((l) => l.id === 'idle')).toBe(false);
  });

  it('names a district with nobody running it', () => {
    const state = game();
    for (const t of territoryList(state)) {
      t.influence.player = DELEGATION.promptAboveInfluence + 10;
    }
    const line = attention(state).find((l) => l.id === 'steward');
    expect(line).toBeTruthy();
    expect(line!.panel).toBe('territory');
  });

  it('names a score with groundwork still to do', () => {
    const state = game();
    const all = territoryList(state);
    all[0].influence.player = 60;
    all[1].influence.player = 60;
    const man = crewList(state).find((n) => n.status === 'active')!;
    const score = openScore(state, 'call_in_tribute', all[0].id, man.id);
    expect(score).toBeTruthy();

    const line = attention(state).find((l) => l.id === 'setups');
    expect(line).toBeTruthy();
    expect(line!.panel).toBe('operations');
  });

  /*
     The line that makes the pattern playable rather than an ambush.

     A cost you only find out about by opening the assemble panel and reading
     an odds row is a cost most players meet for the first time as a bad night.
     This says it once, above the level it starts to be felt, and it names the
     answer — somewhere else — because the Rail's rule is that a demand for
     attention with no statement of what would satisfy it is worthless.
  */
  it('says nothing about a standing order that has not settled into a routine', () => {
    const state = game();
    setStanding(state, 'corner_shakedown', HOME_TERRITORY, 'best');
    expect(attention(state).some((l) => l.id === 'pattern')).toBe(false);
  });

  it('names an order that has worn a groove, and what would quieten it', () => {
    const state = game();
    const order = setStanding(state, 'corner_shakedown', HOME_TERRITORY, 'best')!;
    order.pattern = PATTERN.noticeAbove + 5;

    const line = attention(state).find((l) => l.id === 'pattern');
    expect(line).toBeTruthy();
    expect(line!.panel).toBe('operations');
    expect(line!.text, 'it demanded a look without naming the answer').toMatch(/somewhere else/i);
  });

  it('does not name a pairing that is still running', () => {
    const state = game();
    const crew = crewList(state).filter((n) => n.status === 'active');
    crew[0].stats.skill = 80;
    crew[1].stats.skill = 20;
    startTraining(state, crew[0].id, crew[1].id);
    expect(attention(state).some((l) => l.id === 'teaching')).toBe(false);
  });

  it('keeps the list short enough to read', () => {
    const state = game();
    for (const t of territoryList(state)) {
      t.influence.player = DELEGATION.promptAboveInfluence + 10;
    }
    expect(attention(state).length).toBeLessThanOrEqual(6);
  });
});
