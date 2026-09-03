/**
 * Somebody talking.
 *
 * The probe next door measures whether the record is readable. This file guards
 * the properties that make it a decision rather than a lookup — most of them
 * properties of what the game *refuses* to say, which is the hardest kind of
 * thing to keep true as a codebase grows and the easiest to break by accident
 * while adding a helpful log line.
 */
import { describe, expect, it } from 'vitest';
import informantsSource from '../informants.ts?raw';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  accuse,
  canAccuse,
  readAftermath,
  readLeaks,
  tickInformants,
  timesPresent,
} from '../informants';
import { crewList } from '../npc';
import { activeCases } from '../investigation';
import { INFORMANT } from '../../config/informants';
import type { GameState, Npc, OperationResult } from '../types';

function game(seed = 11): GameState {
  const state = newGame({ name: 'Quiet', difficulty: 'normal', seed });
  return state;
}

/**
 * Enough men to have a question about, since a career starts with one.
 *
 * Written to throw rather than to return early. Two tests in the delegation
 * suite were written the other way and silently did nothing for a week.
 */
function staff(state: GameState, count: number): Npc[] {
  const existing = crewList(state);
  const made: Npc[] = [...existing];
  let n = 0;
  while (made.length < count) {
    const source = existing[0];
    if (!source) throw new Error('a career starts with somebody; this one did not');
    const copy: Npc = {
      ...source,
      id: `extra_${n++}`,
      name: `Extra ${n}`,
      stats: { ...source.stats },
      notes: [],
      memories: [],
      ties: [],
    };
    state.npcs[copy.id] = copy;
    made.push(copy);
  }
  return made;
}

/** A night on the books, so there is something to be talked about. */
function job(state: GameState, id: string, crew: Npc[], day = state.day - 3): OperationResult {
  const result: OperationResult = {
    id,
    defId: 'corner_shakedown',
    name: `Job ${id}`,
    territoryId: Object.keys(state.territories)[0],
    day,
    success: true,
    margin: 0.2,
    payout: 500,
    heat: 1,
    crewIds: crew.map((n) => n.id),
    consequence: null,
  };
  state.operationHistory.unshift(result);
  return result;
}

/**
 * An agency with a file open, which is what gives anybody somebody to talk to.
 *
 * Written directly rather than by piling up evidence and waiting for one to
 * open on its own. The first version did the latter, and because it never
 * actually opened a case, the test asserting that *nobody* turns without one
 * passed for the wrong reason — a negative assertion that cannot distinguish
 * "the gate held" from "the setup did nothing".
 */
function underInvestigation(state: GameState): void {
  state.law.investigations['case_probe'] = {
    id: 'case_probe',
    agencyId: 'city_police',
    stage: 'suspicion',
    openedDay: state.day,
    stageSince: state.day,
    strength: 40,
    suspectIds: [],
    businessIds: [],
    lastProgressDay: state.day,
    status: 'open',
    verdict: null,
    verdictDay: null,
    history: [],
  };
  state.org.heat = 70;
}

describe('what the game refuses to say', () => {
  it('never tells the player who is talking, in any reachable form', () => {
    const state = game();
    const men = staff(state, 4);
    const j = job(state, 'op1', men.slice(0, 3));
    state.leaks = [
      {
        day: state.day,
        opId: j.id,
        opName: j.name,
        territoryId: j.territoryId,
        knewIds: j.crewIds,
        sourceId: men[0].id,
      },
    ];

    const serialised = JSON.stringify([readLeaks(state), timesPresent(state)]);
    expect(serialised).not.toContain('sourceId');
    // The id itself will appear — he was on the job. What must not appear is
    // any field distinguishing him from the other two men who were there.
    const row = timesPresent(state);
    expect(new Set(row.map((r) => r.leaks)).size).toBe(1);
  });

  it('keeps the one field that matters out of the rest of the codebase', () => {
    /*
       Read from the source rather than from behaviour, because what is being
       guarded is a property of the module boundary: `sourceId` is written and
       read in exactly one file, and any future helper that returns it to a
       caller ends the mechanic without failing a single behavioural test.
    */
    const uses = (informantsSource as string).match(/sourceId/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    // Two in the type-shaped literal, one in the parameter, one in the filter
    // used by the tick. If this grows, somebody has started passing it around.
    expect(uses.length, 'sourceId has started travelling').toBeLessThanOrEqual(6);
  });

  it('says the same sentence whether the man was talking or not', () => {
    const lines = [true, false].map((talking) => {
      const state = game();
      const men = staff(state, 4);
      const j = job(state, 'op1', men.slice(0, 3));
      state.leaks = [
        {
          day: state.day,
          opId: j.id,
          opName: j.name,
          territoryId: j.territoryId,
          knewIds: j.crewIds,
          sourceId: talking ? men[1].id : null,
        },
      ];
      if (talking) men[1].informingSince = state.day - 30;
      accuse(state, men[1].id);
      return state.log[0].text;
    });

    /*
       The single most important assertion in the file.

       Everything about an accusation branches on whether he was talking — the
       respect, the fear, the crew's loyalty, whether the leaks stop. The one
       thing that must not branch is what the player is told on the day, because
       the player finding out today is the whole thing this mechanic exists to
       withhold.
    */
    expect(lines[0]).toBe(lines[1]);
  });
});

describe('an accusation', () => {
  it('needs something to have come back to you first', () => {
    const state = game();
    const men = staff(state, 3);
    expect(canAccuse(state, men[0].id).ok).toBe(false);
  });

  it('costs the room more when he was not talking', () => {
    const loyaltyAfter = (talking: boolean): number => {
      const state = game();
      const men = staff(state, 6);
      for (const m of men) m.stats.loyalty = 70;
      const j = job(state, 'op1', men.slice(0, 3));
      state.leaks = [
        {
          day: state.day,
          opId: j.id,
          opName: j.name,
          territoryId: j.territoryId,
          knewIds: j.crewIds,
          sourceId: talking ? men[1].id : null,
        },
      ];
      if (talking) men[1].informingSince = state.day - 30;
      accuse(state, men[1].id);
      const rest = crewList(state).filter((n) => n.id !== men[1].id && n.status !== 'dead');
      return rest.reduce((s, n) => s + n.stats.loyalty, 0) / rest.length;
    };

    expect(loyaltyAfter(false)).toBeLessThan(loyaltyAfter(true));
  });

  it('teaches the man who is actually talking to go quiet', () => {
    const state = game();
    const men = staff(state, 6);
    const talker = men[4];
    talker.informingSince = state.day - 40;
    const j = job(state, 'op1', men.slice(0, 3));
    state.leaks = [
      {
        day: state.day,
        opId: j.id,
        opName: j.name,
        territoryId: j.territoryId,
        knewIds: j.crewIds,
        sourceId: talker.id,
      },
    ];

    // The wrong man.
    accuse(state, men[1].id);
    expect(talker.carefulUntilDay).toBe(state.day + INFORMANT.cautiousDays);

    /*
       ...and being careful means he stops handing anything over — while the
       page keeps filling up anyway, because the agency's own work never
       stopped.

       That combination is the cruellest thing in the mechanic and it is
       deliberate. The player who killed the wrong man does not get silence,
       which would at least be information. They get a thinner version of the
       same page, which is exactly what a solved problem also looks like.

       This assertion reads `sourceId` directly, which nothing outside the
       simulation may do — a test is allowed to check the machine is consistent;
       it is the player who is not allowed to ask.
    */
    const fromHim = () => (state.leaks ?? []).filter((l) => l.sourceId === talker.id).length;
    const before = fromHim();
    state.day += 7 - (state.day % 7);
    underInvestigation(state);
    for (let i = 0; i < 6; i++) {
      state.day += 7;
      tickInformants(state, new Rng(state.rng));
    }
    expect(fromHim(), 'he went on talking after watching that').toBe(before);
    expect(
      (state.leaks ?? []).length,
      'the page went quiet, which would tell the player they were right',
    ).toBeGreaterThan(before);
  });

  it('stops the leaking when it was the right man', () => {
    const state = game();
    const men = staff(state, 6);
    const talker = men[2];
    talker.informingSince = state.day - 40;
    const j = job(state, 'op1', men.slice(0, 4));
    state.leaks = [
      {
        day: state.day,
        opId: j.id,
        opName: j.name,
        territoryId: j.territoryId,
        knewIds: j.crewIds,
        sourceId: talker.id,
      },
    ];

    accuse(state, talker.id);
    expect(talker.informingSince).toBeUndefined();
    expect(talker.status).toBe('dead');
  });
});

/*
 * And whether either outcome is visible from outside.
 *
 * The right/wrong branch has always been real, and a blind tester who used it
 * twice on a 481-day career reported it as a screen with no consequence
 * behind it — because the only confirmation this system offers is the record
 * going quiet, and nothing tracked the record from the day of the accusation.
 * A quiet page and a solved problem looked the same, and so did a page that
 * had started filling up again.
 */
describe('afterwards', () => {
  function killed(seed: number, guilty: boolean) {
    const state = game(seed);
    const men = staff(state, 6);
    const talker = men[2];
    talker.informingSince = state.day - 40;
    const j = job(state, 'op1', men.slice(0, 4));
    state.leaks = [
      {
        day: state.day,
        opId: j.id,
        opName: j.name,
        territoryId: j.territoryId,
        knewIds: j.crewIds,
        sourceId: talker.id,
      },
    ];
    const target = guilty ? talker : men[4];
    accuse(state, target.id);
    return { state, men, talker, target };
  }

  it('says nothing at all until somebody has been decided on', () => {
    const state = game(31);
    staff(state, 4);
    expect(readAftermath(state)).toBeNull();
  });

  it('counts the nights that came back after, and dates the decision', () => {
    const { state, target } = killed(32, true);
    const at = state.day;
    const after = readAftermath(state)!;
    expect(after.name).toBe(target.name);
    expect(after.day).toBe(at);
    expect(after.sinceCount).toBe(0);

    // Two months on, with the record still shut.
    state.day = at + 60;
    expect(readAftermath(state)!.daysSince).toBe(60);
    expect(readAftermath(state)!.sinceCount).toBe(0);
  });

  it('reads the page filling up again when it was the wrong man', () => {
    const { state, men, talker } = killed(33, false);
    const at = state.day;
    expect(readAftermath(state)!.sinceCount).toBe(0);

    // Past the window the real one goes careful for, and with nights for him
    // to describe: `recentJobs` has a window of its own, so a fixture that
    // advances two months without working would test nothing.
    underInvestigation(state);
    state.day = at + INFORMANT.cautiousDays + 1;
    state.day += 7 - (state.day % 7);
    for (let w = 0; w < 60 && readAftermath(state)!.sinceCount === 0; w++) {
      state.day += 7;
      job(state, `after${w}`, men.slice(0, 3));
      tickInformants(state, new Rng(state.rng));
    }
    const after = readAftermath(state)!;
    expect(after.sinceCount, 'the record never reopened, so nothing was measured').toBeGreaterThan(0);
    expect(after.lastDay).toBeGreaterThan(at);
    void talker;
  });

  it('still refuses to say which one it was', () => {
    // The whole point. The count is the same read either way; it is the
    // player's problem what it means, and a night after a correct call is
    // possible because somebody else can always start.
    const right = killed(34, true);
    const wrong = killed(34, false);
    expect(Object.keys(readAftermath(right.state)!).sort()).toEqual(
      Object.keys(readAftermath(wrong.state)!).sort(),
    );
    expect(JSON.stringify(readAftermath(right.state))).not.toMatch(/talking|guilty|right|wrong/i);
  });
});

describe('turning', () => {
  it('needs somebody to be asking', () => {
    const state = game();
    const men = staff(state, 6);
    for (const m of men) {
      m.stats.fear = 90;
      m.stats.loyalty = 10;
      m.memories = [{ kind: 'took_a_charge', day: state.day - 10, aboutId: null, weight: 90 }];
    }
    job(state, 'op1', men.slice(0, 3));

    // No case open: nobody has anybody to talk to, however frightened they are.
    // The companion test below proves this setup does turn somebody when there
    // *is* one, which is what stops this being an assertion about nothing.
    expect(activeCases(state)).toHaveLength(0);
    state.day = 700;
    for (let i = 0; i < 20; i++) {
      state.day += 7;
      tickInformants(state, new Rng(state.rng));
    }
    expect(crewList(state).filter((n) => n.informingSince !== undefined)).toHaveLength(0);
  });

  it('produces one man talking, not four', () => {
    const state = game();
    const men = staff(state, 10);
    for (const m of men) {
      m.stats.fear = 95;
      m.stats.loyalty = 5;
      m.memories = [{ kind: 'took_a_charge', day: state.day - 10, aboutId: null, weight: 95 }];
    }
    job(state, 'op1', men.slice(0, 4));
    underInvestigation(state);

    state.day = 700;
    for (let i = 0; i < 60; i++) {
      state.day += 7;
      tickInformants(state, new Rng(state.rng));
    }

    const talking = crewList(state).filter((n) => n.informingSince !== undefined);
    // Somebody should have turned — ten frightened, disloyal men with a case
    // open for a year is the strongest possible case for it.
    expect(talking.length).toBe(1);
  });
});
