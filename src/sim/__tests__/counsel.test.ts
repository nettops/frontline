/**
 * What a retainer is actually for.
 *
 * A lawyer used to buy a slower case and a better trial and nothing whatever
 * for the man sitting in a cell — which is both wrong about lawyers and the
 * reason a run of arrests read as the game going away for a while. A playtester
 * lost their whole crew, watched thirty to a hundred and twenty days pass with
 * no lever of any kind, and filed it as the worst thing in the build.
 *
 * The repair hangs on the retainer that already exists rather than adding a
 * per-arrest purchase: an existing decision gains a second consequence, and the
 * counsel you were already paying for turns out to matter on the worst week you
 * have.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { crewList } from '../npc';
import { Rng } from '../rng';
import { arrestRisk, retainLawyer, sweep } from '../investigation';
import { LAWYERS, LAWYER_BY_LEVEL } from '../../config/lawEnforcement';
import { ARREST_DAYS } from '../../config/operations';
import type { GameState, Npc } from '../types';

function game(): GameState {
  const state = newGame({ name: 'Counsel', difficulty: 'normal', seed: 12 });
  state.org.cash = 500_000;
  return state;
}

describe('a retainer', () => {
  it('shortens a sentence, and better counsel shortens it further', () => {
    const factors = LAWYERS.map((l) => l.sentenceMultiplier);

    // Monotonic: every step up the ladder is worth something.
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i], `${LAWYERS[i].level} is no better than ${LAWYERS[i - 1].level}`)
        .toBeLessThan(factors[i - 1]);
    }
    expect(LAWYER_BY_LEVEL.none.sentenceMultiplier).toBe(1);
  });

  it('never makes an arrest free', () => {
    /*
       The floor that stops the best counsel turning the worst thing that can
       happen to a crew into an inconvenience. Even at the top of the ladder a
       man is gone for weeks — what money buys is a shorter absence, not the
       absence of one.
    */
    const best = LAWYER_BY_LEVEL.best.sentenceMultiplier;
    expect(best).toBeGreaterThan(0.3);
    expect(ARREST_DAYS[0] * best).toBeGreaterThanOrEqual(7);
  });

  it('says what it would be worth before you buy it', () => {
    const without = game();
    const quoted = arrestRisk(without).cost;
    expect(quoted).toMatch(/\d+ to \d+ weeks/);
    // With nobody retained the line has to point at the lever rather than just
    // stating the damage, or it is a warning with no answer attached.
    expect(quoted).toMatch(/counsel/i);

    const with_ = game();
    retainLawyer(with_, 'best');
    const better = arrestRisk(with_).cost;
    expect(better).not.toBe(quoted);

    const weeks = (line: string) => Number(/(\d+) to (\d+) weeks/.exec(line)![2]);
    expect(
      weeks(better),
      'retaining the best counsel did not change the quoted sentence',
    ).toBeLessThan(weeks(quoted));
  });
});

/**
 * The same lawyer, whichever way a man is picked up.
 *
 * A retainer shortened a sentence from an arrest on a job and did nothing at
 * all for a man taken in a sweep — the two paths rolled their days from
 * different constants and only one of them had ever been told about counsel.
 * From the player's side that is the same money buying two different answers
 * for no stated reason, which is the kind of inconsistency that teaches
 * somebody the mechanic is arbitrary and to stop reading it.
 */
describe('a sweep', () => {
  it('is shortened by the counsel you already pay for', () => {
    const withCounsel = game();
    retainLawyer(withCounsel, 'best');
    const without = game();

    const takenWith = sweep(withCounsel, new Rng(withCounsel.rng));
    const takenWithout = sweep(without, new Rng(without.rng));

    expect(takenWith.length, 'nobody was swept up at all').toBeGreaterThan(0);
    expect(takenWithout.length).toBeGreaterThan(0);

    const held = (state: GameState, taken: Npc[]) =>
      Math.max(...taken.map((n) => (n.unavailableUntilDay ?? state.day) - state.day));

    expect(held(withCounsel, takenWith)).toBeLessThan(held(without, takenWithout));
  });

  it('never lets the best counsel make a sweep free', () => {
    // The same floor the on-the-job arrest has. What money buys is a shorter
    // absence, never the absence of one.
    const state = game();
    retainLawyer(state, 'best');
    const taken = sweep(state, new Rng(state.rng));
    for (const npc of taken) {
      expect((npc.unavailableUntilDay ?? state.day) - state.day).toBeGreaterThanOrEqual(7);
    }
  });
});

/**
 * Who a sweep comes for.
 *
 * It was `rng.sample` over the whole payroll. That made the worst thing that
 * can happen to a crew a lottery, and it meant the one decision this game asks
 * a hundred times — who do I send — had no consequence attached to it on the
 * law's side at all. A playtester lost a soldier for forty-five days and read
 * it as bad luck, which it was.
 */
describe('who a sweep comes for', () => {
  it('is likelier to be the man who has been out on everything', () => {
    let takenWorker = 0;
    const worlds = 40;

    for (let seed = 0; seed < worlds; seed++) {
      const state = game();
      const crew = crewList(state).filter((n) => n.status === 'active');
      // Enough people that a uniform draw would rarely pick any one of them.
      const source = crew[0];
      for (let i = 0; i < 6; i++) {
        const npc: Npc = { ...source, id: `hand-${i}`, name: `Hand ${i}`, memories: [], notes: [] };
        state.npcs[npc.id] = npc;
      }
      const worker = source;
      state.day = 60;
      for (let d = 20; d < 55; d++) {
        state.operationHistory.unshift({
          id: `op-${d}`,
          defId: 'corner_shakedown',
          name: 'Corner Shakedown',
          territoryId: 'little_sicily',
          day: d,
          success: true,
          margin: 0.4,
          payout: 300,
          heat: 1,
          crewIds: [worker.id],
          consequence: null,
        });
      }

      const taken = sweep(state, new Rng({ seed, calls: 0 }));
      if (taken.some((n) => n.id === worker.id)) takenWorker += 1;
    }

    /*
       A floor rather than a target, and deliberately not near certainty. The
       jitter exists so that the man who does everything is far likelier to be
       taken and never a foregone conclusion — if this ever reaches every world
       then the sweep has become a lookup and the risk has gone out of it.
    */
    expect(takenWorker, 'the man who ran every job was no likelier to be taken').toBeGreaterThan(
      worlds / 2,
    );
    expect(takenWorker, 'the sweep has become a certainty rather than a risk').toBeLessThan(worlds);
  });
});
