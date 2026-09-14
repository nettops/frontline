/**
 * Phase 19 (the design brief's own §18 testing pass): the two of its seven
 * scenarios whose existing coverage is unit-level only, exercised here as one
 * real chain each, crossing the files that actually have to cooperate.
 *
 * The other five scenarios are already proven this way by earlier phases —
 * see the Phase 19 audit in `docs/findings/director-log.md` for the
 * citations. These two are the genuine gaps: a powerful capo's standing
 * actually reaching the Boss as a memo (rather than the tie being written
 * directly, as every `capoPoliticalTension.test.ts` case does), and an
 * Underboss's standing actually climbing off a real, repeated count of
 * quietly-handled tension rather than a `remember()` call injected once.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { GOAL_CERTAIN_ABOVE } from '../../config/goals';
import { CAPO_TENSION } from '../../config/capoTension';
import { UNDERBOSS_FILTER } from '../../config/underboss';
import { capoStanding } from '../capoStanding';
import { checkCapoPowerImbalance } from '../capoTension';
import { underbossStanding } from '../officers';
import { EVENT_DEF_BY_ID, resolveEvent } from '../events';
import { pushEvent } from '../util';
import type { GameState, Npc, Tie } from '../types';

function game(seed: number): GameState {
  return newGame({ name: 'OrgPoliticsIntegration', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 3131, calls }), role);
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

const DEF = EVENT_DEF_BY_ID['capo_political_tension'];

describe('scenario 1 — a powerful capo, end to end', () => {
  it('capoStanding\'s own real gap becomes the tie, the tie raises the memo, and the Boss can act on it — with no arbitrary crisis', () => {
    const state = game(19001);

    // A capo with the title and nothing else, next to one who has actually
    // built something — headcount, a district of his own, a chain earning on
    // its own. Nothing here writes a tie directly; the gap is entirely real,
    // the same construction capoStanding.test.ts and capoTension.test.ts use
    // separately for their own narrower questions.
    const weak = hire(state, 'capo', 1);
    weak.familiarity = GOAL_CERTAIN_ABOVE;
    weak.stats.leadership = 5;

    const strong = hire(state, 'capo', 10);
    strong.familiarity = GOAL_CERTAIN_ABOVE;
    strong.stats.leadership = 90;
    for (let i = 0; i < 2; i++) {
      const soldier = hire(state, 'soldier', 11 + i);
      soldier.reportsTo = strong.id;
      soldier.opsCompleted = 8;
    }
    Object.values(state.territories)[0].stewardId = strong.id;

    const gap = capoStanding(state, strong.id)!.tier - capoStanding(state, weak.id)!.tier;
    expect(gap).toBeGreaterThanOrEqual(CAPO_TENSION.gapTiers);
    expect(weak.ties.find((t) => t.id === strong.id)).toBeUndefined();

    // The weekly organizational pass writes the fact onto the weaker man's
    // own tie — no dice, and only in that direction.
    state.day = CAPO_TENSION.checkIntervalDays;
    checkCapoPowerImbalance(state);
    const tie = weak.ties.find((t) => t.id === strong.id);
    expect(tie).toBeDefined();
    expect(tie!.cause).toBe('lost_the_room');
    expect(strong.ties.find((t) => t.id === weak.id)).toBeUndefined();

    // The event this whole pass built to surface that tie finds this exact
    // pair, with nothing else on the context invented.
    const ctx = DEF.applies(state, new Rng({ seed: 1, calls: 0 }));
    expect(ctx).not.toBeNull();
    expect(ctx!.npc!.id).toBe(weak.id);
    expect(ctx!.other!.id).toBe(strong.id);

    const built = DEF.build(state, new Rng({ seed: 2, calls: 0 }), ctx!);
    expect(built.title + built.body).toContain(weak.name);
    expect(built.title + built.body).toContain(strong.name);
    // No arbitrary crisis on a first, real occurrence — a warning the Boss
    // can act on, not a forced danger state.
    expect(built.severity).toBe('warning');

    // The Boss did receive it, and acting on it is real: addressing it moves
    // the exact tie the weekly pass wrote.
    const resentmentBefore = tie!.resentment;
    const e = pushEvent(state, built);
    resolveEvent(state, new Rng(state.rng), e.id, 'address');
    expect(weak.ties.find((t) => t.id === strong.id)!.resentment).toBeLessThan(resentmentBefore);
  });
});

describe('scenario 5 — a powerful Underboss, standing grown from a real handled-count', () => {
  it('underbossStanding climbs only once repeated real quiet handling actually accumulates — not headcount, tenure or a single injected memory', () => {
    const state = game(19002);

    const weaker = hire(state, 'capo', 1);
    const stronger = hire(state, 'capo', 5);
    const tie: Tie = { id: stronger.id, trust: 0, resentment: 40, debt: 0, cause: 'lost_the_room', since: state.day };
    weaker.ties.push(tie);

    const boss = hire(state, 'underboss', 20);
    boss.familiarity = GOAL_CERTAIN_ABOVE;
    // Leadership fixed at a middle band, headcount and tenure both held at
    // zero/low — the two other signals `underbossStanding` reads are pinned
    // so the only thing that can move the tier across this test is the
    // handled-count itself.
    boss.stats.leadership = 50;
    boss.daysInCrew = 10;
    // The weaker capo's own tie to the Underboss — underbossFields reads it
    // off him, not the other way round.
    weaker.ties.push({
      id: boss.id,
      trust: UNDERBOSS_FILTER.trustAbove + 10,
      resentment: UNDERBOSS_FILTER.resentmentBelow - 10,
      debt: 0,
      cause: 'worked_together',
      since: 0,
    });

    const baseline = underbossStanding(state)!.tier;

    // Each real call is the Underboss actually fielding this pair's tension
    // quietly — the identical mechanism `capoPoliticalTension.test.ts` proves
    // fires `handled_it_quietly` once. Repeated here, on a live event def
    // rather than a synthetic `remember()`, to watch the tier move as the
    // count genuinely accrues.
    const tiers: number[] = [baseline];
    for (let i = 0; i < 4; i++) {
      const ctx = DEF.applies(state, new Rng({ seed: 1, calls: i }));
      expect(ctx).toBeNull(); // fielded quietly every time — never reaches the Boss as a memo
      tiers.push(underbossStanding(state)!.tier);
    }

    // Flat while the count is still building, then a real jump once it
    // crosses the threshold — a genuine progression read at each step, not
    // one before/after snapshot.
    const firstRise = tiers.findIndex((t, i) => i > 0 && t > tiers[i - 1]);
    expect(firstRise).toBeGreaterThan(0);
    expect(tiers.slice(0, firstRise)).toEqual(tiers.slice(0, firstRise).map(() => baseline));
    expect(tiers[tiers.length - 1]).toBeGreaterThan(baseline);

    // Nothing about this is a forced consequence: no betrayal or coup
    // mechanic exists anywhere in this codebase off `underbossStanding` (grep
    // confirms — "betray" is exclusively `diplomacy.ts`'s rival-faction
    // mechanic). The read stays descriptive: the boss's own role and loyalty
    // are untouched by his own standing climbing.
    expect(boss.role).toBe('underboss');
  });
});
