/**
 * The two frictions round 29 reported, and the guards that keep them shut.
 *
 * Pacing 7, Difficulty 7, and both scores came off the same two shapes of
 * complaint. The first was a poverty trap: a boss holding $451 was shown a
 * sick parent whose every answer cost money, and a loan shark whose smallest
 * advance was $4,000 against a $350-a-week collection. Being broke is meant to
 * be a hard place, not a sealed one — every lever out of it was priced above
 * what being broke means.
 *
 * The second was repetition. Past day 180 the authored pool is largely spent
 * and five generated shapes on eight-to-ten day cooldowns carried the rest of
 * the career between them, arriving inside the same case and the same custody
 * they had already been answered about.
 *
 * Each assertion below was seen red against the values it replaced.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { borrow, loans, quoteLoan, weeklyRepayment } from '../market';
import { totalFunds } from '../economy';
import { home } from '../personal';
import { GEN_DEFS } from '../eventgen';
import { crewList } from '../npc';
import { resolveEvent } from '../events';
import { REPAYMENT_MINIMUM, REPAYMENT_SHARE } from '../../config/market';
import { FAMILY_DILEMMAS } from '../../config/personal';
import { GEN_SHAPES } from '../../config/eventgen';
import type { GameState, Investigation, Npc, PendingEvent } from '../types';

function broke(seed = 401): GameState {
  const state = newGame({ name: 'Famine', difficulty: 'normal', seed });
  state.org.cash = 0;
  state.org.dirtyCash = 0;
  state.org.holdings = 0;
  return state;
}

// ------------------------------------------------ 1. emergency credit ------

describe('the man on Delacroix will advance a small sum on terms a broke boss can carry', () => {
  it('scales the weekly collection with the balance instead of the flat minimum', () => {
    const state = broke();
    const quote = quoteLoan(state, 'shark', 500);
    expect(quote, 'the shark would not quote $500 at all').not.toBeNull();
    // A tenth of the balance, which on a $500 advance is tens of dollars.
    expect(quote!.weekly).toBe(Math.round(quote!.owed * 0.1));
    expect(quote!.weekly).toBeLessThan(100);
    expect(quote!.weekly).toBeLessThan(REPAYMENT_MINIMUM);
  });

  it('never collects more in a week than the whole debt', () => {
    const state = broke(402);
    const quote = quoteLoan(state, 'shark', 500)!;
    expect(quote.weekly).toBeLessThanOrEqual(quote.owed);
  });

  it('still holds the flat minimum against a balance large enough to outlast it', () => {
    const state = broke(403);
    const quote = quoteLoan(state, 'shark', 5_000)!;
    // Big enough that a tenth clears the floor, small enough that the share
    // does not — the one window where REPAYMENT_MINIMUM is what binds.
    expect(Math.round(quote.owed * 0.1)).toBeGreaterThan(REPAYMENT_MINIMUM);
    expect(Math.round(quote.owed * REPAYMENT_SHARE)).toBeLessThan(REPAYMENT_MINIMUM);
    expect(quote.weekly).toBe(REPAYMENT_MINIMUM);
  });

  it('leaves a large loan exactly where it was — the share, untouched', () => {
    const state = broke(404);
    const quote = quoteLoan(state, 'shark', 40_000)!;
    expect(quote.weekly).toBe(Math.round(quote.owed * REPAYMENT_SHARE));
    expect(quote.weekly).toBeGreaterThan(REPAYMENT_MINIMUM);
  });

  it('books the small loan at the figure it quoted', () => {
    const state = broke(405);
    const quote = quoteLoan(state, 'shark', 500)!;
    borrow(state, 'shark', 500);
    expect(loans(state)).toHaveLength(1);
    expect(weeklyRepayment(state)).toBe(quote.weekly);
    // And it is money a boss with nothing can actually reach.
    expect(totalFunds(state)).toBeGreaterThanOrEqual(500);
  });
});

// --------------------------------------------- 2. the sick relative --------

describe('being in the room costs the evening, not the money', () => {
  it('asks nothing to attend a sick relative', () => {
    const sick = FAMILY_DILEMMAS.find((d) => d.id === 'sick_relative')!;
    expect(sick.attendCost).toBe(0);
    // The doctor sent from a distance is still the paid answer.
    expect(sick.sendCost).toBeGreaterThan(0);
  });

  it('offers the visit as an enabled choice to a boss holding nothing', () => {
    const state = broke(406);
    home(state).people[0].relationId = 'parent';
    const def = GEN_DEFS.find((d) => d.id === 'gen_family_dilemma')!;
    const built = def.build(state, new Rng(state.rng), {
      atHome: true,
      familyDilemmaId: 'sick_relative',
    });
    const attend = built.choices.find((c) => c.id === 'attend')!;
    expect(totalFunds(state)).toBe(0);
    expect(attend.disabledReason, 'a broke boss was refused the room').toBeUndefined();
    expect(attend.cost ?? 0).toBe(0);
  });
});

// ------------------------------------------------- 3. the five shapes ------

describe('the five shapes that carried the late career are further apart', () => {
  const expected: Record<string, number> = {
    gen_somebody_inside: 18,
    gen_paper_moving: 20,
    gen_a_name_came_up: 18,
    gen_wants_a_word: 16,
    gen_the_take_is_short: 18,
  };

  it('holds each one past a case or a custody window', () => {
    for (const [id, days] of Object.entries(expected)) {
      const def = GEN_SHAPES.find((s) => s.id === id);
      expect(def, `${id} is not in the catalogue`).toBeTruthy();
      expect(def!.cooldownDays, `${id} still repeats inside a fortnight`).toBe(days);
    }
  });

  it('puts none of them under a fortnight', () => {
    for (const id of Object.keys(expected)) {
      expect(GEN_SHAPES.find((s) => s.id === id)!.cooldownDays).toBeGreaterThanOrEqual(16);
    }
  });
});

// ------------------------------------- 4. the affordable custody answer ----

describe('somebody inside, and a boss who cannot make bail', () => {
  function inside(seed: number, funds: number): { state: GameState; npc: Npc } {
    const state = newGame({ name: 'Cell', difficulty: 'normal', seed });
    const npc = crewList(state)[0];
    npc.status = 'arrested';
    npc.unavailableUntilDay = state.day + 40;
    state.org.cash = funds;
    state.org.dirtyCash = 0;
    state.org.holdings = 0;
    return { state, npc };
  }

  function memo(state: GameState, npc: Npc): PendingEvent {
    const def = GEN_DEFS.find((d) => d.id === 'gen_somebody_inside')!;
    const built = def.build(state, new Rng(state.rng), { npc });
    const pending = { ...built, id: 'evt_test', day: state.day };
    state.pendingEvents.push(pending);
    return pending;
  }

  it('offers commissary money when there is nowhere near enough for a lawyer', () => {
    const { state, npc } = inside(411, 186);
    expect(memo(state, npc).choices.map((c) => c.id)).toEqual(['bail', 'word', 'wait']);
  });

  it('does not clutter a solvent boss with it', () => {
    const { state, npc } = inside(412, 500_000);
    expect(memo(state, npc).choices.map((c) => c.id)).toEqual(['bail', 'wait']);
  });

  it('steadies him rather than losing him, and it is not free', () => {
    const { state, npc } = inside(413, 400);
    const event = memo(state, npc);
    const before = npc.stats.loyalty;

    resolveEvent(state, new Rng(state.rng), event.id, 'word');

    expect(npc.stats.loyalty, 'word and money left him no better off').toBeGreaterThan(before);
    expect(totalFunds(state), 'the grease cost nothing').toBeLessThan(400);
    expect(totalFunds(state)).toBeGreaterThanOrEqual(0);
  });

  it('hands nothing over when the money is not there', () => {
    const { state, npc } = inside(414, 0);
    const event = memo(state, npc);
    const word = event.choices.find((c) => c.id === 'word')!;
    expect(word.disabledReason, 'an unaffordable answer rendered enabled').toBeTruthy();

    const before = npc.stats.loyalty;
    resolveEvent(state, new Rng(state.rng), event.id, 'word');
    expect(npc.stats.loyalty, 'the gesture landed without being paid for').toBe(before);
  });
});

// --------------------------------------------------- 5. the prose pool -----

/**
 * Put the world in the one state each shape needs, directly.
 *
 * `applies` for these four wants a live case with no lawyer, a man in a cell,
 * a sore crew member, or a corroborated whisper — none of which a fresh game
 * has. Building the context by hand keeps this a test of the prose pool
 * rather than a second test of the trigger conditions.
 */
function subject(state: GameState, id: string, rng: Rng): Record<string, unknown> | null {
  const npc = crewList(state).find((n) => n.status !== 'dead');
  if (!npc) return null;
  switch (id) {
    case 'gen_paper_moving': {
      const investigation: Investigation = {
        id: 'case_prose',
        agencyId: rng.pick(['city_police', 'state_taskforce', 'treasury']),
        stage: 'suspicion',
        openedDay: 1,
        stageSince: 1,
        strength: rng.int(55, 95),
        suspectIds: [],
        businessIds: [],
        lastProgressDay: state.day,
        status: 'open',
        verdict: null,
        verdictDay: null,
        history: [],
      };
      state.law.investigations[investigation.id] = investigation;
      return { investigation };
    }
    case 'gen_somebody_inside':
      npc.status = 'arrested';
      npc.unavailableUntilDay = state.day + 30;
      return { npc };
    case 'gen_wants_a_word':
      npc.stats.grievance = 90;
      return { npc };
    case 'gen_a_name_came_up':
      return { npc };
    default:
      return null;
  }
}

describe('the repeating shapes have more than one way of saying it', () => {
  /*
     Four shapes, three hundred days, and a cooldown that still lets each one
     round eight or ten times. Two variants is the same paragraph four times a
     career; four is the floor that makes the pool worth having at all.
  */
  const pooled = [
    'gen_paper_moving',
    'gen_somebody_inside',
    'gen_wants_a_word',
    'gen_a_name_came_up',
  ];

  it('draws each one from at least four bodies', () => {
    for (const id of pooled) {
      const def = GEN_DEFS.find((d) => d.id === id)!;
      const seen = new Set<string>();
      for (let seed = 1; seed <= 80; seed++) {
        const state = newGame({ name: 'Prose', difficulty: 'normal', seed });
        state.org.cash = 60_000;
        const rng = new Rng({ seed: seed * 977, calls: 0 });
        const ctx = subject(state, id, rng);
        if (!ctx) continue;
        // The name and the tenure vary with the seed, so the shape of the
        // sentence is what is counted rather than the finished string.
        seen.add(def.build(state, rng, ctx).body.replace(/[A-Z][a-z]+|\d+/g, '#'));
      }
      expect(seen.size, `${id} has too few ways of saying it`).toBeGreaterThanOrEqual(4);
    }
  });
});
