/**
 * The card game, held to the reason it was allowed to exist.
 *
 * The blueprint asked for gambling as *"a sink with teeth"* and, in the same
 * breath, argued against building perks because *"a perk from a dice roll is a
 * different game's mechanic"*. The line between those two is thin and this file
 * is where it is defended.
 *
 * Six properties.
 *
 * **It cannot become an income.** Straight play must lose money at the ceiling
 * of the attribute that helps, not merely at the average. An edge that
 * disappears once the player is good at the game is not an edge.
 *
 * **The profitable line has to be self-limiting.** Playing hard pays more than
 * playing straight, deliberately — otherwise nobody would ever choose it — and
 * the thing that stops it being free money is that people start watching. If
 * suspicion did not bite, this file would have shipped a money printer with a
 * paragraph of prose in front of it.
 *
 * **Losing on purpose has to buy something real, and capped.** It is a bribe
 * with plausible deniability, and it must not become a favour vending machine:
 * the same `CIVIC.maxOwed` every other route respects.
 *
 * **A broke boss can still sit down.** The obstacles rule, applied to an
 * opportunity rather than a threat.
 *
 * **Reading the table must not change the world.** `seatedAt` is derived, and
 * a lazy initialiser that rolled would reshuffle every later call in a career
 * that loaded an old save. The mistake whispers made on the day it was written.
 *
 * **One hand a night, and no more.** The game ran weekly and that was the cap
 * on every number above. It is a nightly table now and the bet is the decision,
 * so the cap moved onto the hand and the two mechanisms that were leaning on
 * the calendar — suspicion, and what a hand teaches you — had to be re-clocked.
 * Both are guarded here rather than left to a probe: a sevenfold throughput
 * against a flat 1.2 street smarts a hand was an outright exploit, and it is
 * now scaled by the share of your own ceiling you put up.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  bandFor,
  canSit,
  cards,
  caughtOdds,
  seatedAt,
  sitDown,
  stakeCeiling,
  stakeFloor,
  straightOdds,
  tableRead,
  tickCards,
} from '../cards';
import { figure } from '../civic';
import { postMortem } from '../legacy';
import { heldPossessions, possessions, grantPossession } from '../possessions';
import { CARDS, NOBODIES, SEATED, STAKES } from '../../config/cards';
import { CIVIC, CIVIC_FIGURES } from '../../config/civic';
import type { GameState } from '../types';

/*
   Respect 250 by default: a ceiling of about $57,000 before inflation.

   Was 80, then 250 when the tiers were sized against a plotted distribution.
   It stays at 250 through the rooms being replaced by a curve, because what it
   is for has not changed — it buys a fixture with room above it, so a test
   about what happens at a table is not accidentally a test about the gate.
*/
function game(seed = 5, respect = 250): GameState {
  const state = newGame({ name: 'Player', difficulty: 'normal', seed });
  state.org.respect = respect;
  state.org.cash = 400_000;
  /*
     Day 42 for no clock reason any more, and that is worth a line.

     `tickCards` used to be gated on `day % intervalDays === 0`, so a fixture
     starting on day 40 and stepping by 7 sat at 5 mod 7 for ever and the decay
     never ran — the clock trap in `docs/HANDOFF.md`, met here on the first
     attempt at this file. The gate is gone: suspicion bleeds every day. The
     day is kept so the fixtures below read the same as they did.
  */
  state.day = 42;
  return state;
}

/** Steps past tonight's hand. One a day, so this is a day. */
function nextGame(state: GameState): void {
  state.day += CARDS.intervalDays;
}

/** A bet worth the top band on this state, which is where the company is. */
function big(state: GameState): number {
  return stakeCeiling(state);
}

/** A bet in the bottom band, where it is only a card game. */
function small(state: GameState): number {
  return Math.max(stakeFloor(state), Math.round(stakeCeiling(state) * 0.05));
}

/** Forces the table so a test about consequences is not a test about luck. */
function seatCivic(state: GameState, stake: number): string | null {
  for (let i = 0; i < 400; i++) {
    const seat = seatedAt(state, stake);
    if (seat.kind === 'civic') return seat.id;
    state.day += CARDS.intervalDays;
  }
  return null;
}

describe('the house edge', () => {
  /*
     The invariant the whole feature rests on, checked against the *ceiling*
     rather than the base. A house edge that survives an average player and
     dies against a good one is not a house edge, it is a delayed exploit —
     and this project has shipped a thing that only worked at the values it
     was tested at more than once.
  */
  it('cannot be played straight for a living, even at the top of the attribute', () => {
    const win = CARDS.maxWin;
    const gain = win * CARDS.payout;
    const loss = 1 - win;
    expect(gain, 'straight play pays for itself at the attribute ceiling').toBeLessThan(loss);
  });

  it('never lets street smarts push the odds past that ceiling', () => {
    const state = game();
    state.player.attributes.streetSmarts = 999;
    expect(straightOdds(state)).toBe(CARDS.maxWin);
  });

  it('pays hard play better in money, which is the point of it', () => {
    // If this ever stops being true, "play hard" is a trap with a label rather
    // than a decision, and the option should be deleted instead of tuned.
    expect(CARDS.hard.payout).toBeGreaterThan(CARDS.payout);
  });
});

describe('being watched', () => {
  it('makes the sharp line worse every time you take it', () => {
    const state = game();
    const first = caughtOdds(state);

    for (let i = 0; i < 6; i++) {
      const before = caughtOdds(state);
      sitDown(state, new Rng(state.rng), small(state), 'hard');
      expect(caughtOdds(state), 'playing hard did not raise suspicion').toBeGreaterThan(before);
      nextGame(state);
    }
    /*
       The anti-grind property, stated as an outcome rather than as a
       mechanism: six sharp hands in six weeks has to leave the player worse
       off at it than they started, by enough to feel.
    */
    expect(caughtOdds(state)).toBeGreaterThan(first * 1.5);
  });

  it('forgets, so a boss who does it twice a year never meets the mechanism', () => {
    const state = game();
    sitDown(state, new Rng(state.rng), small(state), 'hard');
    const hot = cards(state).suspicion;
    expect(hot).toBeGreaterThan(0);

    /*
       A month, which is what "twice a year" means for the clock this now runs
       on. Sized against the worst single night rather than the average one:
       `perHardHand` 8 plus `perCatch` 25 is 33, and `decayPerDay` 1.5 clears
       that in 22 nights. A fortnight was the first number here and it left 12
       on the board — the fixture's hand had been caught, which is exactly the
       case the assertion is about. Was twenty *weeks* against a weekly decay
       of 4: the same statement about the game, a different clock.
    */
    for (let i = 0; i < 30; i++) {
      state.day += 1;
      tickCards(state);
    }
    expect(cards(state).suspicion).toBe(0);
  });
});

describe('losing on purpose', () => {
  it('always costs the stake, whatever the cards were going to do', () => {
    const state = game();
    const before = state.org.cash + state.org.dirtyCash;
    const result = sitDown(state, new Rng(state.rng), big(state), 'lose');
    expect(result.ok).toBe(true);
    expect(result.won).toBe(false);
    expect(state.org.cash + state.org.dirtyCash).toBeLessThan(before);
  });

  it('is how money reaches somebody who decides things', () => {
    /*
       Run over a population rather than once. The favour is a chance rather
       than a certainty — a man who took your money at cards has not agreed to
       anything and both of you know it — so a single seed would be measuring
       one roll.
    */
    let bought = 0;
    let sat = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = game(seed);
      const id = seatCivic(state, big(state));
      if (!id) continue;
      sat += 1;
      const before = figure(state, id).owed;
      sitDown(state, new Rng(state.rng), big(state), 'lose');
      if (figure(state, id).owed > before) bought += 1;
    }
    expect(sat, 'no seed ever seated a civic figure, so this measured nothing').toBeGreaterThan(20);
    expect(bought, 'losing to a judge never buys anything').toBeGreaterThan(0);
    expect(bought, 'losing to a judge always buys something, which is not a bribe, it is a shop').toBeLessThan(sat);
  });

  it('cannot stack favours past the cap every other route respects', () => {
    const state = game();
    const id = seatCivic(state, big(state));
    expect(id).not.toBeNull();
    figure(state, id!).owed = CIVIC.maxOwed;

    for (let i = 0; i < 12; i++) {
      sitDown(state, new Rng(state.rng), big(state), 'lose');
      nextGame(state);
    }
    expect(figure(state, id!).owed).toBe(CIVIC.maxOwed);
  });
});

/*
 * And whether the player can tell those two cases apart before paying.
 *
 * Every seat carried one string — "Worth an evening whatever the cards do" —
 * so a figure two points off a favour and a figure who already owes you
 * everything he is going to read identically. A blind tester threw five nights
 * across a 481-day career, two landed and three did not, and reported it as a
 * lottery he could not read. Half of it is a roll and is meant to be. The
 * other half is `CIVIC.maxOwed`, where a thrown night is a guaranteed nothing
 * and the log says the same sentence an unlucky one gets.
 */
describe('what a thrown night is worth', () => {
  it('names the odds and how many they already owe', () => {
    const state = game();
    const id = seatCivic(state, big(state));
    expect(id).not.toBeNull();
    figure(state, id!).owed = 0;

    const row = tableRead(state, big(state));
    expect(row.thrown).toMatch(new RegExp(`0 of ${CIVIC.maxOwed}`));
    expect(row.thrown).toMatch(/\d+% of the time/);
  });

  it('says outright when it would buy nothing at all', () => {
    // The case that read as bad luck and is not luck.
    const state = game();
    const id = seatCivic(state, big(state));
    figure(state, id!).owed = CIVIC.maxOwed;

    const row = tableRead(state, big(state));
    expect(row.thrown).toMatch(/buys nothing more/);
    expect(row.thrown).not.toMatch(/% of the time/);

    // And the screen is telling the truth: it really does buy nothing.
    const before = figure(state, id!).owed;
    sitDown(state, new Rng(state.rng), big(state), 'lose');
    expect(figure(state, id!).owed).toBe(before);
  });

  it('does not give every seat the same sentence', () => {
    /*
       The whole fault, as a property. Across a population there have to be
       seats that read differently from each other, or the line is decoration
       in the same way the string it replaced was.
    */
    const said = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const state = game(seed);
      for (const stake of [small(state), Math.round(stakeCeiling(state) / 3), big(state)]) {
        said.add(tableRead(state, stake).thrown);
      }
    }
    expect(said.size, 'every seat in forty careers says the same thing').toBeGreaterThan(2);
  });
});

describe('sitting down at all', () => {
  it('is one hand a night, and says so', () => {
    const state = game();
    expect(canSit(state, small(state)).ok).toBe(true);
    sitDown(state, new Rng(state.rng), small(state), 'straight');

    const no = canSit(state, small(state));
    expect(no.ok).toBe(false);
    expect(no.reason).toMatch(/tonight/);
    // And the number, because `refusals.test.ts` holds every gate to naming it.
    expect(no.reason).toMatch(/\d+ day/);

    nextGame(state);
    expect(canSit(state, small(state)).ok).toBe(true);
  });

  it('refuses a bet the room will not cover, by naming the figure and what lifts it', () => {
    const state = game(5, 10);
    const no = canSit(state, stakeCeiling(state) * 2);
    expect(no.ok).toBe(false);
    // Not "you are not welcome". The number, and that respect is what moves it.
    expect(no.reason).toMatch(/respect/i);
    expect(no.reason).toMatch(/10/);
  });

  it('lets a boss on their first morning put something on a table', () => {
    const fresh = newGame({ name: 'New', difficulty: 'normal', seed: 3 });
    expect(fresh.org.respect).toBe(0);
    expect(stakeCeiling(fresh)).toBeGreaterThanOrEqual(stakeFloor(fresh));
    expect(fresh.org.cash).toBeGreaterThanOrEqual(stakeFloor(fresh));
    expect(canSit(fresh, stakeFloor(fresh)).ok).toBe(true);
  });

  /*
     The gate that replaced the three respect bars, as a curve rather than as
     three numbers. It has to be monotonic and it has to actually move — a
     ceiling that reads the same at nothing and at two hundred respect is three
     identical rooms wearing a formula.
  */
  it('grows what the room will take as more people know your name', () => {
    const at = (respect: number) => stakeCeiling(game(5, respect));
    const ladder = [0, 85, 180, 260, 340].map(at);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i], `the ceiling did not grow past respect ${[0, 85, 180, 260, 340][i]}`)
        .toBeGreaterThan(ladder[i - 1]);
    }
    expect(at(0)).toBeGreaterThanOrEqual(stakeFloor(game(5, 0)));
    // Two doublings by the old middle room's bar, and well past the old top one.
    expect(at(85) / at(0)).toBeGreaterThan(4);
    expect(at(340) / at(0)).toBeGreaterThan(500);
  });

  it('pays winnings dirty, because a pot is cash in a bag', () => {
    const state = game();
    state.player.attributes.streetSmarts = 999;
    let won = false;
    for (let i = 0; i < 40 && !won; i++) {
      const dirtyBefore = state.org.dirtyCash;
      const cleanBefore = state.org.cash;
      const r = sitDown(state, new Rng(state.rng), small(state), 'straight');
      if (r.won) {
        won = true;
        expect(state.org.dirtyCash).toBeGreaterThan(dirtyBefore);
        expect(state.org.cash).toBeLessThanOrEqual(cleanBefore);
      }
      nextGame(state);
    }
    expect(won, 'forty hands and never a winner').toBe(true);
  });
});

describe('a boss with nothing but a watch', () => {
  /*
     A bet the necklace can actually stand against, which the fixed tables used
     to supply and a curve does not. `game()` runs at respect 250, so the
     ceiling is tens of thousands and a piece of jewellery covers a small
     fraction of it — the point of the test is that being broke does not shut
     you out, not that a necklace covers any number you care to type.
  */
  const jewelStake = (state: GameState) => Math.max(stakeFloor(state), 2_500);

  it('can put it up instead of money', () => {
    const state = game();
    expect(grantPossession(state, new Rng(state.rng), 'necklace')).toBeTruthy();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    nextGame(state);

    expect(
      canSit(state, jewelStake(state)).ok,
      'broke and holding nothing usable',
    ).toBe(false);
    expect(canSit(state, jewelStake(state), 'necklace').ok).toBe(true);
  });

  it('will not let a watch stand against serious money', () => {
    const state = game();
    expect(grantPossession(state, new Rng(state.rng), 'watch')).toBeTruthy();
    const no = canSit(state, big(state), 'watch');
    expect(no.ok).toBe(false);
    expect(no.reason).toMatch(/\$/);
  });

  it('loses it, and the record says how', () => {
    const state = game();
    expect(grantPossession(state, new Rng(state.rng), 'necklace')).toBeTruthy();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    nextGame(state);

    const result = sitDown(state, new Rng(state.rng), jewelStake(state), 'lose', 'necklace');
    expect(result.ok).toBe(true);
    expect(heldPossessions(state)).toEqual([]);
    /*
       `lost`, not `sold`. The Legacy screen reads this record and "lost at
       cards" is a different sentence about a career from "sold".
    */
    expect(possessions(state).find((p) => p.defId === 'necklace')?.status).toBe('lost');
    expect(state.org.cash).toBe(0);

    const row = postMortem(state).find((l) => /yours/i.test(l.label));
    expect(String(row?.value)).toMatch(/lost at cards on day/i);
  });
});

describe('who is at the table', () => {
  /*
     It held all week when the game ran weekly, and the claim was that a room
     whose occupant changed while the player was deciding is a screen that
     lies. The game runs nightly now, so the window is the night: read it twice
     on the same day and it is the same person, and tomorrow is a new table.
     That is the same claim against the clock it actually has.
  */
  it('holds for the night, and reading it costs nothing', () => {
    const state = game();
    const before = state.rng.calls;

    const first = seatedAt(state, big(state));
    expect(seatedAt(state, big(state))).toEqual(first);
    state.day += 1;
    // The whole panel, at every band, not just the one bet.
    for (const stake of [small(state), big(state)]) tableRead(state, stake);
    expect(state.rng.calls, 'reading the room advanced the random stream').toBe(before);
  });

  it('is not the same every night', () => {
    const state = game();
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      seen.add(seatedAt(state, big(state)).who);
      state.day += CARDS.intervalDays;
    }
    expect(seen.size, 'the same person sits opposite you for thirty nights').toBeGreaterThan(2);
  });

  it('puts somebody worth knowing opposite real money more often than pocket money', () => {
    const state = game();
    let topNamed = 0;
    let bottomNamed = 0;
    for (let i = 0; i < 200; i++) {
      if (seatedAt(state, big(state)).kind !== 'nobody') topNamed += 1;
      if (seatedAt(state, small(state)).kind !== 'nobody') bottomNamed += 1;
      state.day += CARDS.intervalDays;
    }
    /*
       The design, as a property: **what you are willing to lose decides who is
       sitting opposite**. Held as a gap rather than as two thresholds so it
       survives the mix being retuned. This is the assertion that would fail if
       the bands ever stopped being read off the stake.
    */
    expect(topNamed).toBeGreaterThan(bottomNamed * 1.5);
  });

  it('has more strangers than bands, which is what makes the rotation work', () => {
    expect(NOBODIES.length).toBeGreaterThan(Object.keys(SEATED).length);
  });

  /*
     The bands are drawn together so that raising the bet cannot put you
     opposite the man you were already playing. Same fault the three rooms had
     — the same wholesaler in two of them on one night — and it survives the
     rooms because the panel changes the seat live as the number moves.
  */
  it('never seats the same stranger in two bands on the same night', () => {
    const state = game();
    for (let i = 0; i < 200; i++) {
      const ceiling = stakeCeiling(state);
      const who = [ceiling * 0.05, ceiling * 0.3, ceiling].map(
        (stake) => seatedAt(state, Math.round(stake)).who,
      );
      expect(new Set(who).size, `day ${state.day}: ${who.join(' / ')}`).toBe(who.length);
      state.day += CARDS.intervalDays;
    }
  });

  /*
     And that the bands are what the stake is read against, rather than a sum.
     A boss who can put up ninety thousand and bets two thousand is playing
     under himself, and the room reads it that way.
  */
  it('reads the bet as a share of what you could have put up, not as a sum', () => {
    const poor = game(5, 0);
    const rich = game(5, 340);
    const same = stakeCeiling(poor);
    expect(bandFor(poor, same)).toBe('serious');
    expect(bandFor(rich, same)).toBe('quiet');
    expect(STAKES.quietBelow).toBeLessThan(STAKES.seriousAbove);
  });

  it('names a real civic figure when it seats one', () => {
    const state = game();
    for (let i = 0; i < 100; i++) {
      const seat = seatedAt(state, big(state));
      if (seat.kind === 'civic') {
        expect(CIVIC_FIGURES.some((f) => f.id === seat.id)).toBe(true);
      }
      state.day += CARDS.intervalDays;
    }
  });
});
