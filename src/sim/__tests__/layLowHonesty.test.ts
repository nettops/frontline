/**
 * "Nothing moves" has to be true, or has to stop being said.
 *
 * Round 11 paid $5,154 to go quiet on day 130. On day 132 the log read
 * "Attention on the organization has risen: Intensive Task Force. (the job drew
 * attention)". Work already out finishes — men in the middle of a job cannot be
 * recalled — which is the right mechanic and the opposite of what the sentence
 * promised.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { startLayLow } from '../heat';
import { availableOperations, canLaunch, launchOperation } from '../operations';
import { operableTerritories } from '../territory';
import { availableCrew } from '../npc';

describe('going quiet', () => {
  it('says that work already out will still finish', () => {
    const state = newGame({ name: 'Quiet', difficulty: 'normal', seed: 8 });
    const def = availableOperations(state)[0];
    const where = operableTerritories(state)[0].territory.id;
    launchOperation(
      state,
      def.id,
      availableCrew(state).slice(0, def.crewRequired).map((n) => n.id),
      where,
    );
    expect(Object.keys(state.activeOperations).length).toBeGreaterThan(0);

    startLayLow(state);
    const line = state.log[0].text;
    expect(line).toMatch(/still out|already out|finish/i);
  });

  it('does not mention running work when there is none', () => {
    const state = newGame({ name: 'Quiet', difficulty: 'normal', seed: 8 });
    startLayLow(state);
    expect(state.log[0].text).not.toMatch(/still out|already out/i);
  });
});

/*
   Going quiet is a fortnight of decisions now, not a fortnight of "+1 week".

   Round 13 spent roughly 60 of its 300 days laid up across four stretches, and
   said the thing plainly: "the punishment for heat is not danger, it is 14 days
   of pressing +1 week." It was the round's first MUST FIX, and it is the same
   complaint F6 keeps mis-reading as Pacing.

   The mechanic itself was never the problem — heat has to cost something, and
   the cost has to bite. What was wrong is that it cost the player the game
   rather than costing them anything in it. So Quiet work is allowed while you
   are dark, and nothing else is.

   The heat maths is deliberately untouched. A job still resets `quietDays` and
   still stops that day's decay, which is what makes this a decision rather than
   a free lunch: take the reduced money and do not cool today, or stay dark and
   cool at four times the rate. Every day, for fourteen days.
*/
describe('working while you are dark', () => {
  function laidLow() {
    const state = newGame({ name: 'Quiet', difficulty: 'normal', seed: 8 });
    const def = availableOperations(state)[0];
    const where = operableTerritories(state)[0].territory.id;
    const crew = availableCrew(state).slice(0, def.crewRequired).map((n) => n.id);
    startLayLow(state);
    return { state, def, where, crew };
  }

  it('allows a quiet job', () => {
    const { state, def, where, crew } = laidLow();
    expect(canLaunch(state, def, crew, where, 'quiet').ok).toBe(true);
  });

  it('refuses anything louder, and says that quiet is the exception', () => {
    const { state, def, where, crew } = laidLow();
    for (const loud of ['standard', 'heavy'] as const) {
      const check = canLaunch(state, def, crew, where, loud);
      expect(check.ok).toBe(false);
      expect(check.reason).toMatch(/quiet/i);
    }
  });

  it('actually launches the quiet one', () => {
    const { state, def, where, crew } = laidLow();
    expect(launchOperation(state, def.id, crew, where, 'quiet')).not.toBeNull();
    expect(Object.keys(state.activeOperations).length).toBeGreaterThan(0);
  });

  it('still refuses everything once you are dark, by default', () => {
    // The unqualified call is what every other caller and test makes, and it
    // has to keep meaning what it meant.
    const { state, def, where, crew } = laidLow();
    expect(canLaunch(state, def, crew, where).ok).toBe(false);
  });
});

/*
   And every screen that offers it has to describe the mechanic it now has.

   Iteration 6 allowed quiet work while dark and did not change one line of
   copy. The memo option still read "Everything stops — Lay low. Heat falls
   fast, nothing earns, respect suffers", and the Overview tooltip still said
   "Nothing earns". Round 14 went dark four times, had been using the Quiet
   approach since day 86, never discovered the two combine, and reported the
   whole mechanic as a dead fortnight with "no partial option".

   The tests above prove the sim does the right thing. That is what made this
   expensive: nothing was broken, so nothing failed, and a blind round was
   spent rediscovering a complaint the change had already answered.

   Scans the source rather than the running UI because there is no jsdom here,
   and the failure is in a string either way.
*/
describe('the screens agree that quiet work moves', () => {
  const SOURCES = import.meta.glob('../../{sim,ui}/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  it('reads the source it is asserting about', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
  });

  /**
   * Every player-facing line that mentions going dark.
   *
   * Comments are allowed to quote the old wording — the entry above this one
   * does, and a check that forbade explaining itself would be a check nobody
   * could document. Tracked as a block state rather than by the leading
   * character, because the first draft only skipped lines starting with `*`
   * and so flagged its own explanation.
   */
  function sentencesAboutGoingDark(): { where: string; text: string }[] {
    const out: { where: string; text: string }[] = [];
    for (const [file, text] of Object.entries(SOURCES)) {
      // Probes print their own console summaries and are not screens. Matched
      // on the filename because a sibling test resolves as `./x.test.ts`,
      // which contains no directory to match on.
      if (file.includes('__tests__') || /\.test\.tsx?$/.test(file)) continue;
      let inBlock = false;
      for (const [i, line] of text.split(String.fromCharCode(10)).entries()) {
        const code = line.trim();
        const opens = code.includes('/*');
        const closes = code.includes('*/');
        const wasInBlock = inBlock;
        if (opens && !closes) inBlock = true;
        if (closes) inBlock = false;
        if (wasInBlock || opens || code.startsWith('//') || code.startsWith('*')) continue;

        const lower = code.toLowerCase();
        if (!lower.includes('laying low') && !lower.includes('lay low') && !lower.includes('going dark')) {
          continue;
        }
        out.push({ where: `${file}:${i + 1}`, text: code });
      }
    }
    return out;
  }

  /*
     The instrument, and this one has earned its place.

     Round 15 chose Go dark believing quiet work would continue, then read "No
     operations can be launched" on the Overview and "Nothing can be launched
     until day N. That is the point of it." on the Operations page — and did
     not try. They lost fourteen days of income, missed payroll, lost counsel,
     and filed it as the MUST FIX that decided their run.

     The check that existed was built for exactly that defect and matched
     neither string, because it hunted three specific sentences rather than the
     claim. **A guard with a blind spot shaped like the bug it hunts** is
     HANDOFF section 3's whole subject.

     The replacement was two regular expressions and it went green with the
     defect reinstated — five rounds of instrumenting later, `totalStop.test`
     was returning false inside the test on a line it matched everywhere else.
     Whatever the cause, a check nobody can predict is worse than none. Plain
     lowercase string matching cannot surprise anybody.
  */
  it('finds the sentences it is meant to be checking', () => {
    const found = sentencesAboutGoingDark();
    expect(found.length, 'no screen mentions going dark at all').toBeGreaterThan(3);
  });

  const STOP_CLAIMS = [
    'nothing can be launched',
    'no operations can be launched',
    'nothing earns',
    'earns nothing',
    'everything stops',
    'nothing moves',
    'nothing runs',
    'no work',
  ];

  it('nowhere claims that laying low stops everything', () => {
    const claims = sentencesAboutGoingDark().filter((s) =>
      STOP_CLAIMS.some((claim) => s.text.toLowerCase().includes(claim)),
    );

    expect(
      claims.map((c) => `${c.where} ${c.text}`),
      'quiet work moves while dark, so no screen may say otherwise',
    ).toEqual([]);
  });

  /*
     And the half that does not depend on anybody having thought of the
     wording. A screen that describes the mechanic without describing the
     exception is the defect however it is phrased.

     Only sentences that make a claim about what happens — a bare status badge
     reading " · laying low" describes nothing and needs no exception.
  */
  it('says what still moves wherever it describes going dark', () => {
    const CLAIMS_ABOUT_WORK = ['launch', 'earn', 'work', 'job', 'operation', 'moves', 'runs'];
    const silent = sentencesAboutGoingDark().filter((s) => {
      const lower = s.text.toLowerCase();
      if (!CLAIMS_ABOUT_WORK.some((w) => lower.includes(w))) return false;
      return !lower.includes('quiet');
    });

    expect(
      silent.map((c) => `${c.where} ${c.text}`),
      'a screen describes going dark without saying quiet work still moves',
    ).toEqual([]);
  });
});
