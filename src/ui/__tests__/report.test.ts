/**
 * The briefing.
 *
 * The properties under test are about editorial judgement rather than
 * arithmetic: it stays quiet when nothing happened, it says the important
 * thing first, it never lets good news set the tone of a bad week, and it
 * cannot be made to talk about somebody who is not on file.
 *
 * The report is a pure reading of state, so most of these build a `before`
 * snapshot, change the state by hand, and read the difference. That tests the
 * diff itself rather than whichever systems happened to fire that week.
 */

import { describe, expect, it } from 'vitest';

import { newGame } from '../../sim/state';
import { runDaysSolvent } from '../../sim/__tests__/helpers';
import { crewList } from '../../sim/npc';
import { addLog } from '../../sim/util';
import { DAY_PARTS, buildReport, snapshot } from '../report';
import { home } from '../../sim/personal';
import { HOME } from '../../config/personal';
import { AGENCIES } from '../../config/lawEnforcement';
import { TERRITORIES } from '../../config/territories';
import type { GameState } from '../../sim/types';

function fresh(seed = 11): GameState {
  return newGame({ name: 'Tester', difficulty: 'normal', seed });
}

describe('the briefing stays quiet when there is nothing to say', () => {
  it('says nothing when nothing changed', () => {
    const state = fresh();
    expect(buildReport(snapshot(state), state)).toBeNull();
  });

  it('ignores money that moved by less than a dollar', () => {
    const state = fresh();
    const before = snapshot(state);
    state.org.dirtyCash += 0.4;
    expect(buildReport(before, state)).toBeNull();
  });

  it('ignores heat drifting by a point', () => {
    const state = fresh();
    const before = snapshot(state);
    state.org.heat += 1;
    expect(buildReport(before, state)).toBeNull();
  });
});

describe('what it reports', () => {
  it('reports money, and calls a loss a loss', () => {
    const state = fresh();
    const up = snapshot(state);
    state.org.dirtyCash += 5000;
    expect(buildReport(up, state)?.lines[0]).toMatchObject({ tone: 'money' });

    const down = snapshot(state);
    state.org.dirtyCash -= 4000;
    const loss = buildReport(down, state);
    expect(loss?.lines[0].tone).toBe('bad');
    expect(loss?.lines[0].text).toContain('Down');
  });

  /*
   * "+1 week" stops the moment something needs the player, so a press
   * labelled a week is routinely three days. The first draft said "on the
   * week" either way, which is a small lie about a number.
   */
  it('describes the span it actually covered', () => {
    const state = fresh();
    const spans: Record<number, string> = { 1: 'on the day', 7: 'on the week', 3: 'over 3 days' };
    for (const [days, phrase] of Object.entries(spans)) {
      const before = snapshot(state);
      state.day += Number(days);
      state.org.dirtyCash += 500;
      expect(buildReport(before, state)?.lines[0].text).toContain(phrase);
    }
  });

  it('names the man who died, and sends you to the panel about him', () => {
    const state = fresh();
    const victim = crewList(state)[0];
    const before = snapshot(state);
    victim.status = 'dead';
    const report = buildReport(before, state);
    expect(report?.lines[0].text).toContain(victim.name);
    expect(report?.lines[0].panel).toBe('crew');
  });

  it('separates being killed from being arrested', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    const before = snapshot(state);
    npc.status = 'arrested';
    expect(buildReport(before, state)?.lines[0].text).toContain('picked up');
  });

  it('reports an agency opening a file', () => {
    const state = fresh();
    const before = snapshot(state);
    const agency = AGENCIES[0];
    state.law.investigations['case_1'] = {
      id: 'case_1',
      agencyId: agency.id,
      stage: 'suspicion',
      openedDay: state.day,
      stageSince: state.day,
      strength: 5,
      suspectIds: [],
      businessIds: [],
      lastProgressDay: state.day,
      status: 'open',
      verdict: null,
      verdictDay: null,
      history: [],
    };
    const report = buildReport(before, state);
    expect(report?.lines.some((l) => l.text.includes(agency.name))).toBe(true);
    expect(report?.lines.some((l) => l.panel === 'law')).toBe(true);
  });

  it('reports ground taken and ground lost', () => {
    const state = fresh();
    const district = TERRITORIES[0];
    const territory = state.territories[district.id];

    const takingIt = snapshot(state);
    territory.influence.player = 80;
    const gained = buildReport(takingIt, state);
    expect(gained?.lines.some((l) => l.tone === 'good' && l.panel === 'territory')).toBe(true);

    const losingIt = snapshot(state);
    territory.influence.player = 0;
    const lost = buildReport(losingIt, state);
    expect(lost?.lines.some((l) => l.tone === 'bad' && l.panel === 'territory')).toBe(true);
  });
});

/*
 * Found by playing it: a week in which a rival tried to buy one of my men and
 * I failed to make payroll was reported as a week in which nothing happened,
 * because neither of those moves a tracked figure.
 */
describe('things that happened without moving a number', () => {
  it('reports a week where nothing measurable changed but something did', () => {
    const state = fresh();
    const before = snapshot(state);
    state.day += 7;
    addLog(state, 'You could not make payroll. $450 owed, $329 on hand.', 'failure');
    const report = buildReport(before, state);
    expect(report).not.toBeNull();
    expect(report!.lines[0].text).toContain('payroll');
    expect(report!.lines[0].tone).toBe('bad');
  });

  it('ignores the log from before the window', () => {
    const state = fresh();
    addLog(state, 'Old news nobody needs again.', 'crew');
    const before = snapshot(state);
    state.day += 7;
    expect(buildReport(before, state)).toBeNull();
  });

  it('does not report a death twice', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    const before = snapshot(state);
    npc.status = 'dead';
    addLog(state, `${npc.name} was killed. The Kestler war did that.`, 'failure');
    const lines = buildReport(before, state)!.lines;
    expect(lines.filter((l) => l.text.includes(npc.name))).toHaveLength(1);
  });

  it('caps a chaotic fortnight rather than printing a wall', () => {
    const state = fresh();
    const before = snapshot(state);
    state.day += 14;
    for (let i = 0; i < 9; i++) addLog(state, `Something went wrong, number ${i}.`, 'failure');
    const lines = buildReport(before, state)!.lines;
    expect(lines.filter((l) => l.text.includes('went wrong')).length).toBeLessThanOrEqual(3);
  });

  it('leaves money and heat to the diff rather than echoing the log', () => {
    const state = fresh();
    const before = snapshot(state);
    state.day += 7;
    addLog(state, 'Payday. 2 on the books, $450 out.', 'money');
    addLog(state, 'Heat is climbing.', 'heat');
    expect(buildReport(before, state)).toBeNull();
  });
});

describe('the tone of a week', () => {
  /*
   * This is the property that matters most and the easiest one to get wrong.
   * A week in which you lost a man and made money is a bad week, and playing
   * the money cue over the funeral gets it exactly backwards.
   */
  it('does not let good news set the tone of a bad week', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    const before = snapshot(state);
    state.org.dirtyCash += 20_000;
    npc.status = 'dead';
    const report = buildReport(before, state);
    expect(report?.cue).not.toBe('money');
    expect(report?.cue).not.toBe('good');
  });

  it('plays money only when the week was otherwise uneventful', () => {
    const state = fresh();
    const before = snapshot(state);
    state.org.dirtyCash += 20_000;
    expect(buildReport(before, state)?.cue).toBe('money');
  });

  it('puts the dead man above the takings', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    const before = snapshot(state);
    state.org.dirtyCash += 20_000;
    npc.status = 'dead';
    const lines = buildReport(before, state)!.lines;
    const death = lines.findIndex((l) => l.text.includes(npc.name));
    const money = lines.findIndex((l) => l.tone === 'money');
    expect(death).toBeGreaterThanOrEqual(0);
    expect(death).toBeLessThan(money);
  });

  it('a waiting memo outranks everything else', () => {
    const state = fresh();
    const before = snapshot(state);
    state.org.dirtyCash += 20_000;
    state.pendingEvents.push({
      id: 'evt_test',
      defId: 'test',
      day: state.day,
      title: 'Something',
      body: 'Anything',
      severity: 'warning',
      choices: [{ id: 'ok', label: 'Fine', hint: '' }],
      npcId: null,
      data: {},
    });
    expect(buildReport(before, state)?.cue).toBe('memo');
  });
});

describe('the briefing survives a real game', () => {
  it('produces readable lines over two years and never invents a person', () => {
    const state = fresh(4);
    let reports = 0;

    for (let week = 0; week < 104; week++) {
      const before = snapshot(state);
      if (runDaysSolvent(state, 7) < 7) break;
      const report = buildReport(before, state);
      if (!report) continue;
      reports += 1;

      for (const line of report.lines) {
        expect(line.text.length).toBeGreaterThan(0);
        expect(line.text).not.toContain('undefined');
        expect(line.text).not.toContain('NaN');
        expect(line.text).not.toContain('[object');
      }
    }

    // If this is zero the assertions above never ran and the test is a lie.
    expect(reports).toBeGreaterThan(10);
  });
});

/*
   The day has a shape.

   The simulation has always run in this order — the night resolves, the desk
   fills, and the part of a boss's life that is not the business is whatever is
   left. What was missing was anywhere the player could feel it: the briefing
   was one list in which a man dying overnight, a memo still waiting for an
   answer, and your family asking after you were the same kind of line.

   Nothing in `sim/` knows this exists, which is the property the first test
   here guards.
*/
describe('the parts of the day', () => {
  it('files what already happened under the night', () => {
    const state = fresh();
    const snap = snapshot(state);
    state.org.heat += 20;
    const report = buildReport(snap, state)!;
    expect(report).not.toBeNull();
    expect(report.lines.every((l) => (l.part ?? 'overnight') === 'overnight')).toBe(true);
  });

  /*
     A memo has not happened yet, which is the whole difference. Reading it
     under the same heading as a death is what made the old briefing a list
     rather than a morning.
  */
  it('files what has not happened yet under today', () => {
    const state = fresh();
    const snap = snapshot(state);
    state.org.heat += 20;
    state.pendingEvents.push({
      id: 'evt_x',
      defId: 'test',
      day: state.day,
      title: 'Something',
      body: 'Anything',
      severity: 'info',
      choices: [{ id: 'ok', label: 'Fine', hint: '' }],
      npcId: null,
      data: {},
    });

    const report = buildReport(snap, state)!;
    const today = report.lines.filter((l) => l.part === 'today');
    expect(today.length, 'a memo on the desk was not filed under today').toBe(1);
    expect(today[0].text).toMatch(/waiting for an answer/);
  });

  /*
     And the evening, which is the reason the roadmap put this after the
     personal life rather than before it. An evening with nothing in it is
     worse than no evening.
  */
  it('says nothing about the evening while the house is content', () => {
    const state = fresh();
    const snap = snapshot(state);
    state.org.heat += 20;
    const report = buildReport(snap, state)!;
    expect(report.lines.some((l) => l.part === 'evening')).toBe(false);
  });

  it('speaks in the evening once the house has noticed', () => {
    const state = fresh();
    const snap = snapshot(state);
    state.org.heat += 20;
    home(state).neglect = HOME.depositionFrom + 10;
    home(state).lastVisitDay = state.day - 90;

    const report = buildReport(snap, state)!;
    const evening = report.lines.filter((l) => l.part === 'evening');
    expect(evening.length, 'the house has given up on you and the briefing did not say').toBe(1);
    expect(evening[0].panel, 'the evening line goes nowhere').toBe('player');
    expect(evening[0].text).toMatch(/asked after you/);
  });

  /*
     The evening on its own is not a briefing. A boss who had a completely
     quiet week should not be handed a page whose only content is that nobody
     at home has seen him — that is a nag with a heading on it.

     It is allowed to be the only line once it is loud enough to matter, which
     is the case above; this is the quieter one below that bar.
  */
  it('does not raise a briefing for the evening alone when nothing else happened', () => {
    const state = fresh();
    const snap = snapshot(state);
    home(state).lastVisitDay = state.day - 30;
    const report = buildReport(snap, state);
    expect(
      report && report.lines.every((l) => l.part === 'evening'),
      'a quiet week produced a briefing that only said nobody has seen you',
    ).not.toBe(true);
  });

  it('keeps every part in the order a day happens', () => {
    expect(DAY_PARTS.map((p) => p.id)).toEqual(['overnight', 'today', 'evening']);
    expect(DAY_PARTS.every((p) => p.label.length > 0)).toBe(true);
  });
});
