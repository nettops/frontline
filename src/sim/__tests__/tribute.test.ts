/**
 * The envelopes, and the three ways of answering a light one.
 *
 * What is worth pinning down here is not the arithmetic — it is the four
 * facts the design rests on:
 *
 * 1. **The tick is weekly and it pays.** An envelope that never arrives is a
 *    system that exists only on a panel.
 * 2. **A skimmer is short every week; an honest capo is short rarely.** The
 *    cooldown is what makes a bad month read as an event rather than weather,
 *    and `isSkimming` is what makes it not apply.
 * 3. **Each answer costs something different, and the audit costs most when
 *    the man was honest.** That asymmetry is the decision.
 * 4. **A job the boss never touched pays him less and leaves nothing on him.**
 *    The cut and the insulation are the two halves of what delegation buys.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc, crewList } from '../npc';
import { confidant, setDiscretion } from '../personal';
import { territoryList } from '../territory';
import { launchOperation, tickOperations } from '../operations';
import { delegatePitchAutonomous } from '../capoPitches';
import { advanceDay } from '../clock';
import { TRIBUTE } from '../../config/tribute';
import {
  capoEarnerStatus,
  capoTributeEstimate,
  capoTributeLeaderboard,
  insulateCommand,
  pendingEnvelopes,
  resolveLightEnvelope,
  tickWeeklyTribute,
  tributeState,
} from '../tribute';
import type { GameState, Npc } from '../types';

function game(seed = 909): GameState {
  return newGame({ name: 'Envelope', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 4242, calls }), role);
  npc.status = 'active';
  npc.isSkimming = false;
  state.npcs[npc.id] = npc;
  return npc;
}

/**
 * Put an organization of a stated size on the board — the same helper
 * `rank.test.ts` uses, and for the same reason: it reaches through to the
 * quantities `opsBoard` actually reads rather than faking the board.
 */
function build(state: GameState, districts: number, fronts: number, crew: number): void {
  const ts = territoryList(state);
  for (let i = 0; i < districts && i < ts.length; i++) {
    ts[i].influence = { ...ts[i].influence, player: 95 };
  }
  state.businesses = {};
  for (let i = 0; i < fronts; i++) {
    state.businesses[`b${i}`] = {
      id: `b${i}`,
      defId: 'laundromat',
      territoryId: ts[0].id,
      purchasedDay: 1,
      exposure: 0,
      revenueTotal: 0,
      launderedTotal: 0,
      lastLaundered: 0,
      health: 100,
      status: 'operating',
    } as unknown as (typeof state.businesses)[string];
  }
  const have = crewList(state);
  const src = have[0];
  for (let i = have.length; i < crew; i++) {
    state.npcs[`n${i}`] = { ...src, id: `n${i}`, name: `Hand ${i}`, status: 'active' };
  }
}

/** Money in the drawer, so nothing below fails on affordability by accident. */
function fund(state: GameState, amount: number): void {
  state.org.dirtyCash = amount;
  state.org.cash = 0;
}

/**
 * A stream whose next `chance(lightEnvelopeBaseChance)` lands, or does not.
 *
 * Found by scanning rather than hard-coded, so a change to the base chance
 * moves the test with it instead of silently inverting what it asserts.
 */
function rngWhere(fires: boolean): Rng {
  for (let calls = 0; calls < 5000; calls++) {
    if (new Rng({ seed: 77, calls }).chance(TRIBUTE.lightEnvelopeBaseChance) === fires) {
      return new Rng({ seed: 77, calls });
    }
  }
  throw new Error('no such stream');
}

describe('the weekly envelope', () => {
  it('collects nothing off the seven-day cadence', () => {
    const state = game();
    hire(state, 'capo', 1);
    fund(state, 0);
    state.day = 6;

    tickWeeklyTribute(state, rngWhere(false));

    expect(tributeState(state).history).toHaveLength(0);
    expect(state.org.dirtyCash).toBe(0);
  });

  it('collects a full envelope from every capo on payday', () => {
    const state = game();
    const a = hire(state, 'capo', 1);
    const b = hire(state, 'capo', 20);
    fund(state, 0);
    state.day = 7;

    tickWeeklyTribute(state, rngWhere(false));

    const book = tributeState(state);
    expect(book.history.map((r) => r.capoId).sort()).toEqual([a.id, b.id].sort());
    expect(book.history.every((r) => r.status === 'paid' && r.shortage === 0)).toBe(true);
    expect(state.org.dirtyCash).toBe(
      capoTributeEstimate(state, a.id) + capoTributeEstimate(state, b.id),
    );
    expect(pendingEnvelopes(state)).toHaveLength(0);
  });

  it('raises a light envelope when the week rolls one, and pays what was offered', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    fund(state, 0);
    state.day = 7;
    const expected = capoTributeEstimate(state, capo.id);

    tickWeeklyTribute(state, rngWhere(true));

    const open = pendingEnvelopes(state);
    expect(open).toHaveLength(1);
    expect(open[0].capoId).toBe(capo.id);
    expect(open[0].expected).toBe(expected);
    expect(open[0].shortage).toBeGreaterThan(0);
    expect(open[0].offered).toBe(expected - open[0].shortage);
    expect(open[0].excuse).not.toBe('');
    // What he handed over is in the drawer. The shortage is not.
    expect(state.org.dirtyCash).toBe(open[0].offered);
    // Nothing is written to the book until the boss answers it.
    expect(tributeState(state).history).toHaveLength(0);
  });

  it('holds an honest capo to the cooldown, however the week rolls', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    fund(state, 0);
    state.day = 7;
    state.flags[`light_envelope_day_${capo.id}`] = state.day - 1;

    tickWeeklyTribute(state, rngWhere(true));

    expect(pendingEnvelopes(state)).toHaveLength(0);
    expect(tributeState(state).history[0].status).toBe('paid');
  });

  it('does not hold a skimmer to it — he is short every week until somebody looks', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    capo.isSkimming = true;
    fund(state, 0);
    state.day = 7;
    state.flags[`light_envelope_day_${capo.id}`] = state.day - 1;

    tickWeeklyTribute(state, rngWhere(false));

    expect(pendingEnvelopes(state)).toHaveLength(1);
  });

  it('is actually wired into the week — the clock collects it', () => {
    const state = game(505);
    const capo = hire(state, 'capo', 1);
    state.day = 6;

    advanceDay(state);

    expect(state.day).toBe(7);
    // Either he paid and it is in the book, or he came up short and it is on
    // the desk. Which one is the week's own roll; that one of them happened
    // is the wiring.
    const booked = tributeState(state).history.filter((r) => r.capoId === capo.id).length;
    const open = pendingEnvelopes(state).filter((d) => d.capoId === capo.id).length;
    expect(booked + open).toBe(1);
  });

  it('never stacks two open questions on the same man', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    capo.isSkimming = true;
    fund(state, 0);
    state.day = 7;
    tickWeeklyTribute(state, rngWhere(true));
    expect(pendingEnvelopes(state)).toHaveLength(1);

    state.day = 14;
    tickWeeklyTribute(state, rngWhere(true));

    expect(pendingEnvelopes(state)).toHaveLength(1);
    // He paid in full this week. Last week's envelope is still the question.
    expect(tributeState(state).history.filter((r) => r.status === 'paid')).toHaveLength(1);
  });
});

/** A capo with one light envelope open, and the boss holding `cash`. */
function shortWeek(cash: number, skimming = false): { state: GameState; capo: Npc } {
  const state = game(31);
  const capo = hire(state, 'capo', 1);
  capo.isSkimming = skimming;
  capo.stats.loyalty = 50;
  capo.stats.grievance = 20;
  state.org.respect = 50;
  fund(state, 0);
  state.day = 7;
  tickWeeklyTribute(state, rngWhere(true));
  fund(state, cash);
  return { state, capo };
}

describe('answering a light envelope', () => {
  it('lets it slide: the man is warmer, the room thinks less of you', () => {
    const { state, capo } = shortWeek(0);
    const dilemma = pendingEnvelopes(state)[0];

    const out = resolveLightEnvelope(state, capo.id, 'let_it_slide');

    expect(out.ok).toBe(true);
    expect(state.org.respect).toBe(50 - TRIBUTE.letSlideRespectHit);
    expect(capo.stats.loyalty).toBe(50 + TRIBUTE.letSlideLoyaltyBonus);
    expect(state.org.dirtyCash).toBe(0);
    const record = tributeState(state).history.at(-1)!;
    expect(record.status).toBe('slid');
    expect(record.paid).toBe(dilemma.offered);
    expect(pendingEnvelopes(state)).toHaveLength(0);
  });

  it('squeezes: the balance arrives and so does the grudge', () => {
    const { state, capo } = shortWeek(0);
    const dilemma = pendingEnvelopes(state)[0];

    const out = resolveLightEnvelope(state, capo.id, 'squeeze');

    expect(out.ok).toBe(true);
    expect(state.org.dirtyCash).toBe(dilemma.shortage);
    expect(capo.stats.grievance).toBe(20 + TRIBUTE.squeezeGrievance);
    expect(capo.stats.loyalty).toBe(50 + TRIBUTE.squeezeLoyaltyHit);
    const record = tributeState(state).history.at(-1)!;
    expect(record.status).toBe('squeezed');
    // The week reads "short, then collected in full" rather than never light.
    expect(record.paid).toBe(dilemma.expected);
    expect(record.shortage).toBe(dilemma.shortage);
  });

  it('audits a thief: double back, the skim stops, and he knows you know', () => {
    const { state, capo } = shortWeek(10_000, true);
    const dilemma = pendingEnvelopes(state)[0];

    const out = resolveLightEnvelope(state, capo.id, 'audit');

    expect(out.ok).toBe(true);
    expect(capo.isSkimming).toBe(false);
    expect(state.org.dirtyCash).toBe(10_000 - TRIBUTE.auditCost + dilemma.shortage * 2);
    expect(capo.stats.grievance).toBe(20 + 15);
    expect(tributeState(state).history.at(-1)!.status).toBe('audited_guilty');
  });

  it('audits an honest man: nothing comes back and the insult stays', () => {
    const { state, capo } = shortWeek(10_000);

    const out = resolveLightEnvelope(state, capo.id, 'audit');

    expect(out.ok).toBe(true);
    expect(state.org.dirtyCash).toBe(10_000 - TRIBUTE.auditCost);
    expect(capo.stats.loyalty).toBe(50 - 15);
    expect(capo.stats.grievance).toBe(20 + 20);
    expect(tributeState(state).history.at(-1)!.status).toBe('audited_clean');
  });

  it('refuses the audit it cannot pay for, and leaves the question open', () => {
    const { state, capo } = shortWeek(TRIBUTE.auditCost - 1, true);

    const out = resolveLightEnvelope(state, capo.id, 'audit');

    expect(out.ok).toBe(false);
    expect(out.message).not.toBe('');
    expect(pendingEnvelopes(state)).toHaveLength(1);
    expect(capo.isSkimming).toBe(true);
    expect(state.org.dirtyCash).toBe(TRIBUTE.auditCost - 1);
  });

  it('has nothing to answer when nobody is short', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    expect(resolveLightEnvelope(state, capo.id, 'squeeze').ok).toBe(false);
  });
});

describe('the earner board', () => {
  it('counts ground and recent work, and nothing older than the window', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    state.day = 100;
    const bare = capoTributeEstimate(state, capo.id);
    expect(bare).toBe(TRIBUTE.baseEnvelope);

    territoryList(state)[0].stewardId = capo.id;
    expect(capoTributeEstimate(state, capo.id)).toBe(
      TRIBUTE.baseEnvelope + TRIBUTE.perControlledDistrict,
    );

    const soldier = hire(state, 'soldier', 40);
    soldier.reportsTo = capo.id;
    state.operationHistory.push(
      { day: 99, crewIds: [soldier.id] } as never,
      // Outside `earnerHistoryDays`, so it counts for nothing.
      { day: 100 - TRIBUTE.earnerHistoryDays - 1, crewIds: [capo.id] } as never,
      // Somebody else's man.
      { day: 99, crewIds: ['stranger'] } as never,
    );
    expect(capoTributeEstimate(state, capo.id)).toBe(
      TRIBUTE.baseEnvelope + TRIBUTE.perControlledDistrict + TRIBUTE.perRecentOpVolume,
    );
  });

  it('reads a man with two districts as a top earner, one as steady, and none as dead weight', () => {
    const state = game();
    const big = hire(state, 'capo', 1);
    const mid = hire(state, 'capo', 10);
    const small = hire(state, 'capo', 20);
    territoryList(state)[0].stewardId = big.id;
    territoryList(state)[1].stewardId = big.id;
    territoryList(state)[2].stewardId = mid.id;

    expect(capoTributeEstimate(state, big.id)).toBeGreaterThanOrEqual(
      TRIBUTE.topEarnerWeeklyThreshold,
    );
    expect(capoEarnerStatus(state, big.id)).toBe('top_earner');
    expect(capoEarnerStatus(state, mid.id)).toBe('steady_earner');
    expect(capoEarnerStatus(state, small.id)).toBe('dead_weight');
  });

  it('sorts the board by what a week is worth, and totals what each man has paid', () => {
    const state = game();
    const big = hire(state, 'capo', 1);
    const small = hire(state, 'capo', 20);
    territoryList(state)[0].stewardId = big.id;
    territoryList(state)[1].stewardId = big.id;
    state.day = 7;
    tickWeeklyTribute(state, rngWhere(false));
    tickWeeklyTribute(state, rngWhere(false)); // same day, so two full weeks booked

    const board = capoTributeLeaderboard(state);
    expect(board.map((r) => r.capoId)).toEqual([big.id, small.id]);
    expect(board[0].weeklyEstimate).toBeGreaterThan(board[1].weeklyEstimate);
    expect(board[0].totalTributePaid).toBe(capoTributeEstimate(state, big.id) * 2);
    expect(board[0].status).toBe('top_earner');
    expect(board[1].status).toBe('dead_weight');
  });
});

/**
 * One job, launched by hand and then flipped, so the only difference between
 * the two runs is the two flags `resolveOperation` reads.
 */
function oneJob(opts: { autonomous: boolean; succeeds: boolean; seed: number }) {
  const state = game(41);
  const ts = territoryList(state);
  ts[0].influence = { ...ts[0].influence, player: 95 };
  const capo = hire(state, 'capo', 1);
  const hand = hire(state, 'soldier', 40);
  fund(state, 5_000);

  const op = launchOperation(state, 'freelance_muscle', [hand.id], ts[0].id)!;
  op.successChance = opts.succeeds ? 1 : 0;
  op.endDay = state.day;
  if (opts.autonomous) {
    op.autonomous = true;
    op.capoId = capo.id;
  }
  const before = state.org.dirtyCash;
  tickOperations(state, new Rng({ seed: opts.seed, calls: 0 }));
  return { state, capo, hand, took: state.org.dirtyCash - before };
}

describe('a job the boss never touched', () => {
  it('pays the family its cut and leaves the rest with the crew', () => {
    const own = oneJob({ autonomous: false, succeeds: true, seed: 5 });
    const his = oneJob({ autonomous: true, succeeds: true, seed: 5 });

    expect(own.took).toBeGreaterThan(0);
    expect(his.took).toBe(Math.round(own.took * TRIBUTE.bossAutonomousCut));
    expect(his.state.operationHistory[0].payout).toBe(his.took);
    // And the log says where the rest went, rather than the number just
    // coming in low with no explanation.
    expect(his.state.log.some((l) => l.text.includes(`${his.capo.name}'s crew kept`))).toBe(true);
  });

  it('keeps what a bad night left off the family and on the capo', () => {
    // A failure that produces a trace at all is a roll of the consequence
    // table, so the seed is found rather than assumed.
    let seed = -1;
    for (let s = 1; s < 400 && seed < 0; s++) {
      if (Object.keys(oneJob({ autonomous: false, succeeds: false, seed: s }).state.evidence).length > 0) {
        seed = s;
      }
    }
    expect(seed).toBeGreaterThan(0);

    const exposed = oneJob({ autonomous: false, succeeds: false, seed });
    const insulated = oneJob({ autonomous: true, succeeds: false, seed });

    expect(Object.keys(exposed.state.evidence).length).toBeGreaterThan(0);
    expect(Object.keys(insulated.state.evidence)).toHaveLength(0);
    expect(insulated.capo.notes.some((n) => n.text.includes('stops with him'))).toBe(true);
  });

  it('strikes only what the night added, never what was already in the file', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    state.evidence['old'] = {
      id: 'old',
      day: 1,
      source: 'operation',
      strength: 20,
      npcIds: [],
      attachedTo: [],
      detail: 'Already on file.',
    };
    const before = new Set(Object.keys(state.evidence));
    state.evidence['new'] = { ...state.evidence['old'], id: 'new', detail: 'Tonight.' };

    insulateCommand(state, capo, before);

    expect(Object.keys(state.evidence)).toEqual(['old']);
  });

  it('insulates nothing once there is a wire up', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const before = new Set(Object.keys(state.evidence));
    state.evidence['new'] = {
      id: 'new',
      day: 1,
      source: 'operation',
      strength: 20,
      npcIds: [],
      attachedTo: [],
      detail: 'Tonight.',
    };
    // A confidant talking where she should not, and a case with a van outside
    // — the same two facts `investigation.ts` reads before a wire hears.
    confidant(state).active = true;
    setDiscretion(state, 0);
    state.law.investigations['case'] = {
      id: 'case',
      agencyId: 'city_police',
      stage: 'surveillance',
      openedDay: 1,
      stageSince: 1,
      strength: 40,
      suspectIds: [],
      businessIds: [],
      lastProgressDay: 1,
      status: 'open',
      verdict: null,
      verdictDay: null,
      history: [],
    };

    insulateCommand(state, capo, before);

    expect(Object.keys(state.evidence)).toContain('new');
    expect(capo.notes.some((n) => n.text.includes('listening'))).toBe(true);
  });
});

describe('handing a pitch to the man who brought it', () => {
  it('launches with his own crew and marks the job as his', () => {
    const state = game(63);
    const ts = territoryList(state);
    ts[0].influence = { ...ts[0].influence, player: 95 };
    const capo = hire(state, 'capo', 1);
    const hand = hire(state, 'soldier', 40);
    hand.reportsTo = capo.id;
    const stranger = hire(state, 'soldier', 80);
    fund(state, 20_000);

    state.capoPitches = [
      {
        id: 'p1',
        defId: 'protection_racket',
        territoryId: ts[0].id,
        capoId: capo.id,
        offeredDay: state.day,
        status: 'open',
      },
    ];

    const op = delegatePitchAutonomous(state, 'p1');

    expect(op).not.toBeNull();
    expect(op!.autonomous).toBe(true);
    expect(op!.capoId).toBe(capo.id);
    // Him and his man, not the one who answers to somebody else.
    expect(op!.crewIds).toEqual([capo.id, hand.id]);
    expect(stranger.status).toBe('active');
    expect(state.capoPitches![0].status).toBe('approved');
  });

  it('leaves the pitch open when the job cannot be launched', () => {
    const state = game(63);
    const ts = territoryList(state);
    ts[0].influence = { ...ts[0].influence, player: 95 };
    const capo = hire(state, 'capo', 1);
    hire(state, 'soldier', 40).reportsTo = capo.id;
    fund(state, 0); // cannot cover the stake

    state.capoPitches = [
      {
        id: 'p1',
        defId: 'protection_racket',
        territoryId: ts[0].id,
        capoId: capo.id,
        offeredDay: state.day,
        status: 'open',
      },
    ];

    expect(delegatePitchAutonomous(state, 'p1')).toBeNull();
    expect(state.capoPitches![0].status).toBe('open');
  });
});

describe('a boss on a corner', () => {
  /** Enough organization for `rankNow` to read Capo. */
  function seated(cash: number): GameState {
    const state = game(11);
    build(state, 2, 3, 9);
    state.org.respect = 50;
    fund(state, cash);
    return state;
  }

  it('costs a capo standing to run tier 0 work himself', () => {
    const state = seated(TRIBUTE.handsOnPovertyExemptionFunds);

    launchOperation(state, 'work_it_yourself', [], territoryList(state)[0].id);

    expect(state.org.respect).toBe(50 - TRIBUTE.handsOnStreetWorkRespectPenalty);
  });

  it('excuses a man who has nothing — that is not pride, that is being broke', () => {
    const state = seated(TRIBUTE.handsOnPovertyExemptionFunds - 1);

    launchOperation(state, 'work_it_yourself', [], territoryList(state)[0].id);

    expect(state.org.respect).toBe(50);
  });

  it('says nothing about work that is not tier 0', () => {
    const state = seated(20_000);
    const hands = crewList(state)
      .filter((n) => n.status === 'active')
      .slice(0, 2)
      .map((n) => n.id);

    launchOperation(state, 'protection_racket', hands, territoryList(state)[0].id);

    expect(state.org.respect).toBe(50);
  });

  it('says nothing about a man who is still nobody', () => {
    const state = game(11);
    state.org.respect = 50;
    fund(state, 20_000);

    launchOperation(state, 'work_it_yourself', [], territoryList(state)[0].id);

    expect(state.org.respect).toBe(50);
  });
});

