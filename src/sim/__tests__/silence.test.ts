/**
 * The other way somebody leaves.
 *
 * The organization screen has had one answer to a man who keeps costing you
 * money: `dismiss`, which puts him on the street knowing everything he knows.
 * That already files evidence against you — `source: 'informant'`, scaled by
 * how well he knew the operation — so cutting a bad earner loose has always
 * been a real cost rather than a tidy-up.
 *
 * What was missing is the answer the setting actually implies. A boss in this
 * world does not only have the option of a handshake, and the game only ever
 * offered a killing through `accuse`, which refuses unless something has
 * already leaked: *"Nothing has come back to you yet."* So a man could botch
 * six jobs in a row and the only thing you could do about it was hand the
 * Bureau a witness.
 *
 * **This is deliberately not gated.** Any man, any day. What restrains you is
 * the bill, not a rule — and the bill is the whole design:
 *
 * 1. **It can go wrong**, and going wrong is worse than never trying. He lives,
 *    he leaves, and he now knows exactly what you attempted.
 * 2. **It buys real silence** when it works — no informant evidence, ever.
 *    That is the thing you are paying for.
 * 3. **The room finds out.** Loyalty falls among the men who knew him, and
 *    fear rises across everybody. You buy obedience and spend affection.
 * 4. **His people remember**, through `lost_a_friend`, which fades over years
 *    and never reaches zero.
 *
 * The instrument bar for all of it: dismissal and silencing must not be
 * orderable. If one is simply better, the screen has two buttons and one
 * decision.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { recordTie } from '../ties';
import { canSilence, silence } from '../silence';
import { dismiss } from '../crew';
import { SILENCE } from '../../config/silence';
import type { GameState, Npc } from '../types';

function game(seed = 5): GameState {
  const state = newGame({ name: 'Boss', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 10) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 200_000;
  return state;
}

/** Somebody who is not the boss and is standing about. */
function target(state: GameState): Npc {
  return crewList(state).find((n) => n.status === 'active')!;
}

/** Force the roll, so the two outcomes can be tested separately. */
function rigged(state: GameState, win: boolean): Rng {
  const rng = new Rng(state.rng);
  rng.chance = () => win;
  return rng;
}

describe('deciding somebody has to go', () => {
  it('is offered against anybody, because the cost is the restraint', () => {
    const state = game();
    const man = target(state);
    expect(canSilence(state, man.id).ok).toBe(true);
  });

  it('will not reach a man who is out on a job', () => {
    const state = game();
    const man = target(state);
    man.status = 'busy';
    expect(canSilence(state, man.id).ok).toBe(false);
  });

  it('will not reach somebody already gone', () => {
    const state = game();
    const man = target(state);
    man.status = 'dead';
    expect(canSilence(state, man.id).ok).toBe(false);
  });
});

describe('when it is done properly', () => {
  it('leaves nobody to talk to anybody', () => {
    const state = game();
    const man = target(state);
    silence(state, rigged(state, true), man.id);

    expect(man.status).toBe('dead');
    const against = Object.values(state.evidence).filter((e) => e.npcIds.includes(man.id));
    expect(
      against.some((e) => e.source === 'informant'),
      'a silenced man still filed an informant trace, which is the thing being bought',
    ).toBe(false);
    expect(against.some((e) => e.source === 'violence')).toBe(true);
  });

  it('costs attention on the street', () => {
    const state = game();
    const before = state.org.heat;
    silence(state, rigged(state, true), target(state).id);
    expect(state.org.heat).toBeGreaterThan(before);
  });

  /*
     The half of the price that is not a number on the org sheet.

     Fear and loyalty already drive wages, defection and informing, so this
     couples through paths that exist rather than inventing a morale stat.
  */
  it('is noticed by everybody, and resented by the ones who knew him', () => {
    const state = game();
    const man = target(state);
    const friend = crewList(state).find(
      (n) => n.id !== man.id && n.status === 'active',
    )!;
    recordTie(state.day, friend, man, 'saved_him', 4);
    friend.familiarity = 80;

    const fearBefore = state.org.fear;
    const loyaltyBefore = friend.stats.loyalty;

    silence(state, rigged(state, true), man.id);

    expect(state.org.fear, 'burying one of your own frightened nobody').toBeGreaterThan(fearBefore);
    expect(friend.stats.loyalty, 'the man who was close to him did not mind').toBeLessThan(
      loyaltyBefore,
    );
    expect(friend.memories.some((m) => m.kind === 'lost_a_friend')).toBe(true);
  });

  it('is not resented by somebody who never knew him', () => {
    const state = game();
    const man = target(state);
    const stranger = crewList(state).find(
      (n) => n.id !== man.id && n.status === 'active',
    )!;
    stranger.familiarity = 0;
    stranger.ties = [];

    silence(state, rigged(state, true), man.id);
    expect(stranger.memories.some((m) => m.kind === 'lost_a_friend')).toBe(false);
  });
});

describe('when it goes wrong', () => {
  it('leaves a man on the street who knows what you tried', () => {
    const state = game();
    const man = target(state);
    silence(state, rigged(state, false), man.id);

    expect(man.status).toBe('defected');
    const against = Object.values(state.evidence).filter((e) => e.npcIds.includes(man.id));
    expect(against.some((e) => e.source === 'informant')).toBe(true);
  });

  /*
     The bar that makes trying a real risk rather than a free reroll.

     If a botched silencing cost the same as never having tried, the correct
     play would be to attempt it on everybody and shrug at the failures.
  */
  it('is worse than having simply let him go', () => {
    const botched = game();
    const a = target(botched);
    silence(botched, rigged(botched, false), a.id);
    const botchedStrength = Object.values(botched.evidence)
      .filter((e) => e.npcIds.includes(a.id))
      .reduce((sum, e) => sum + e.strength, 0);

    const letGo = game();
    const b = target(letGo);
    dismiss(letGo, b.id);
    const dismissedStrength = Object.values(letGo.evidence)
      .filter((e) => e.npcIds.includes(b.id))
      .reduce((sum, e) => sum + e.strength, 0);

    expect(botchedStrength).toBeGreaterThan(dismissedStrength);
  });

  it('still frightens the room, because they all heard about it', () => {
    const state = game();
    const before = state.org.fear;
    silence(state, rigged(state, false), target(state).id);
    expect(state.org.fear).toBeGreaterThan(before);
  });
});

describe('the choice between the two', () => {
  /*
     Neither may dominate. Dismissal is cheap, certain, and leaves a witness;
     silencing is expensive, uncertain, and leaves nobody. A player who can
     always name the better one is not making a decision.
  */
  it('does not make one of them simply better', () => {
    const quiet = game();
    const q = target(quiet);
    dismiss(quiet, q.id);

    const loud = game();
    const l = target(loud);
    silence(loud, rigged(loud, true), l.id);

    // Dismissal is the cheap one on attention and leaves the witness.
    expect(loud.org.heat).toBeGreaterThan(quiet.org.heat);
    expect(q.status).toBe('defected');
    // And silencing is the one that buys the silence.
    expect(
      Object.values(quiet.evidence).some(
        (e) => e.npcIds.includes(q.id) && e.source === 'informant',
      ),
    ).toBe(true);
    expect(
      Object.values(loud.evidence).some((e) => e.npcIds.includes(l.id) && e.source === 'informant'),
    ).toBe(false);
  });

  it('is worth more against a man who knows everything than a stranger', () => {
    // Dismissal scales its trace on familiarity, so what silencing saves you
    // scales with it too. That is what makes this a decision about *who*.
    const state = game();
    const known = target(state);
    known.familiarity = 100;
    dismiss(state, known.id);
    const rich = Object.values(state.evidence)
      .filter((e) => e.npcIds.includes(known.id))
      .reduce((sum, e) => sum + e.strength, 0);

    const other = game();
    const barely = target(other);
    barely.familiarity = 0;
    dismiss(other, barely.id);
    const thin = Object.values(other.evidence)
      .filter((e) => e.npcIds.includes(barely.id))
      .reduce((sum, e) => sum + e.strength, 0);

    expect(rich).toBeGreaterThan(thin);
  });
});

describe('the odds of it going right', () => {
  it('are worse against somebody careful than somebody sloppy', () => {
    const state = game();
    const careful = target(state);
    careful.stats.discipline = 95;
    careful.stats.skill = 95;
    const sloppy = crewList(state).find(
      (n) => n.id !== careful.id && n.status === 'active',
    )!;
    sloppy.stats.discipline = 5;
    sloppy.stats.skill = 5;

    expect(SILENCE.base).toBeGreaterThan(0);
    expect(canSilence(state, careful.id).chance).toBeLessThan(
      canSilence(state, sloppy.id).chance!,
    );
  });

  it('never becomes certain, and never becomes hopeless', () => {
    const state = game();
    const man = target(state);
    man.stats.discipline = 100;
    man.stats.skill = 100;
    expect(canSilence(state, man.id).chance).toBeGreaterThan(0);

    man.stats.discipline = 0;
    man.stats.skill = 0;
    expect(canSilence(state, man.id).chance).toBeLessThan(1);
  });
});
