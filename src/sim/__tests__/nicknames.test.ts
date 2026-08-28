/**
 * What the street decides to call you.
 *
 * The properties:
 *
 * 1. **You cannot be given a name you did not earn.** The roll draws only from
 *    entries whose condition the career actually meets, so a boss who never
 *    hurt anybody can never come out of this called The Hammer however the
 *    dice fall. That is the whole design — a nickname is other people's
 *    opinion, and their opinion is about something that happened.
 * 2. **It arrives late and unpredictably**, so it reads as a comment on a
 *    career rather than a starting bonus or a countdown.
 * 3. **It cannot break the ceiling.** A granted point is worth a great deal —
 *    `BUILD.startingPoints` is 14 and a verb costs three to six above the
 *    floor — but a reward that ignores the cap every other rule respects would
 *    make the build stop meaning anything.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { earnedNames, nicknameOf, statBonus, earningsBonus, tickNickname } from '../nicknames';
import { NICKNAME, NICKNAMES } from '../../config/nicknames';
import { BUILD } from '../../config/build';
import { spendPoint, statLevel } from '../build';
import type { GameState } from '../types';

function game(seed = 12): GameState {
  const state = newGame({ name: 'Named', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 6) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  return state;
}

/*
   Old enough and known enough for anybody to have an opinion.

   Landed on a multiple of `everyDays`, because the tick only runs on the
   week's turn the way `tickFear` and every other weekly thing here does. The
   first version of this helper set day 150, which is 3 mod 7, so a loop adding
   seven at a time never once hit the check and the test read as the feature
   being broken.
*/
function known(state: GameState): void {
  const from = NICKNAME.notBeforeDay + 30;
  state.day = from + ((NICKNAME.everyDays - (from % NICKNAME.everyDays)) % NICKNAME.everyDays);
  state.org.respect = NICKNAME.respectFrom + 100;
}

describe('being given a name', () => {
  it('has none at the start, and nothing to say about it', () => {
    const state = game();
    expect(nicknameOf(state)).toBeNull();
    expect(statBonus(state, 'muscle')).toBe(0);
    expect(earningsBonus(state)).toBe(0);
  });

  it('offers nothing to a career nobody has heard of', () => {
    const state = game();
    state.day = NICKNAME.notBeforeDay + 30;
    state.org.respect = 10;
    expect(earnedNames(state)).toHaveLength(0);
  });

  /*
     The property. A name is about something that happened, so the pool is
     never the catalogue — it is the subset of it the career has actually
     lived.
  */
  it('will not offer a name the career did not earn', () => {
    const state = game();
    known(state);
    state.org.fear = 0;

    const ids = earnedNames(state).map((n) => n.id);
    expect(ids, 'a family that never frightened anybody is being called The Hammer').not.toContain(
      'the_hammer',
    );
  });

  it('offers the violent one to a family that was violent', () => {
    const state = game();
    known(state);
    state.org.fear = 70;
    expect(earnedNames(state).map((n) => n.id)).toContain('the_hammer');
  });

  it('never lands before the street has had time to decide', () => {
    const state = game();
    state.day = NICKNAME.notBeforeDay - 1;
    state.org.respect = 900;
    state.org.fear = 90;
    for (let i = 0; i < 200; i++) tickNickname(state);
    expect(nicknameOf(state), 'a name arrived in the first months').toBeNull();
  });

  it('lands eventually once it could', () => {
    const state = game();
    known(state);
    state.org.fear = 80;
    for (let i = 0; i < 400 && !nicknameOf(state); i++) {
      state.day += NICKNAME.everyDays;
      tickNickname(state);
    }
    expect(nicknameOf(state), 'nobody was ever called anything').toBeTruthy();
  });
});

describe('what a name is worth', () => {
  function name(state: GameState, id: string): void {
    state.player.nickname = { id, since: state.day };
  }

  it('adds its point to the stat it is about', () => {
    const state = game();
    name(state, 'the_hammer');
    expect(statBonus(state, 'muscle')).toBe(1);
    expect(statBonus(state, 'ledger'), 'it paid a stat it has nothing to do with').toBe(0);
  });

  it('pays a share of what comes in when that is what it grants', () => {
    const state = game();
    name(state, 'the_landlord');
    expect(earningsBonus(state)).toBeGreaterThan(0);
    expect(statBonus(state, 'muscle')).toBe(0);
  });

  /*
     A granted point counts toward the verb, which is the strongest thing any
     reward in this game could do — see the note in `config/nicknames.ts`.
  */
  it('counts toward the thing the points were for', () => {
    const state = game();
    state.player.points = 99;
    while (statLevel(state, 'muscle') < 5) spendPoint(state, 'muscle');
    const before = statLevel(state, 'muscle');
    name(state, 'the_hammer');
    expect(statLevel(state, 'muscle')).toBe(before + 1);
  });

  it('will not push anything past the ceiling', () => {
    const state = game();
    state.player.points = 99;
    while (statLevel(state, 'muscle') < BUILD.max) spendPoint(state, 'muscle');
    name(state, 'the_hammer');
    expect(statLevel(state, 'muscle')).toBe(BUILD.max);
  });
});

describe('the catalogue', () => {
  it('grants exactly one thing per name, and nothing grants nothing', () => {
    for (const def of NICKNAMES) {
      const isStat = 'stat' in def.grants;
      const isMoney = 'earnings' in def.grants;
      expect(isStat !== isMoney, `${def.id} grants both or neither`).toBe(true);
    }
  });

  /*
     Reachability, guarded the way the possessions catalogue was not. Content
     nobody can meet is content nobody will see, and the way this project finds
     that out has historically been a blind round two hundred days in.
  */
  it('has something for a family that only ever did one thing', () => {
    const shapes: [string, (s: GameState) => void][] = [
      ['violent', (s) => { s.org.fear = 80; }],
      ['quiet', (s) => { s.city!.notoriety = 5; s.player.opsCompleted = 90; }],
      ['rich', (s) => { s.org.record = { ...(s.org.record ?? { respect: 0, crew: 0, estate: 0, ops: 0, districts: 0, opsSeen: 0 }), estate: 4_000_000 }; s.city!.notoriety = 20; }],
    ];
    for (const [what, make] of shapes) {
      const state = game();
      known(state);
      make(state);
      expect(earnedNames(state).length, `a ${what} career earned no name at all`).toBeGreaterThan(0);
    }
  });
});
