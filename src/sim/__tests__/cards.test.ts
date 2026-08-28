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
 * **The game runs weekly.** Every number above is capped by that and by
 * nothing else.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  canSit,
  cards,
  caughtOdds,
  seatedAt,
  sitDown,
  straightOdds,
  tableRead,
  tickCards,
} from '../cards';
import { figure } from '../civic';
import { postMortem } from '../legacy';
import { heldPossessions, possessions, grantPossession } from '../possessions';
import { CARDS, NOBODIES, TABLES, TABLE_BY_ID } from '../../config/cards';
import { CIVIC, CIVIC_FIGURES } from '../../config/civic';
import type { GameState } from '../types';

/*
   Respect 250 by default: enough for every room.

   Was 80, which stopped being enough the day the tiers were sized against a
   plotted distribution — five tests went red at once and every one of them was
   right to. The bars live in config and this number exists to clear them, so
   it is deliberately well past the top one rather than one point above it.
*/
function game(seed = 5, respect = 250): GameState {
  const state = newGame({ name: 'Player', difficulty: 'normal', seed });
  state.org.respect = respect;
  state.org.cash = 400_000;
  /*
     On a week boundary, and that is not cosmetic.

     `tickCards` is gated on `day % intervalDays === 0`, which the real clock
     satisfies because it advances a day at a time. A fixture that starts on
     day 40 and steps by 7 sits at 5 mod 7 forever, so the decay never runs —
     the clock trap in `HANDOFF.md`, met here on the first attempt at this
     file. It cost one red test and would have cost nothing at all if the
     assertion had been "less than before" instead of "zero", which is the
     part worth remembering.
  */
  state.day = 42;
  return state;
}

/** Steps past the weekly gate without running a day, staying on the boundary. */
function nextWeek(state: GameState): void {
  state.day += CARDS.intervalDays;
}

/** Forces the table so a test about consequences is not a test about luck. */
function seatCivic(state: GameState, tableId: string): string | null {
  for (let i = 0; i < 400; i++) {
    const seat = seatedAt(state, tableId);
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
      sitDown(state, new Rng(state.rng), 'back_room', 'hard');
      expect(caughtOdds(state), 'playing hard did not raise suspicion').toBeGreaterThan(before);
      nextWeek(state);
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
    sitDown(state, new Rng(state.rng), 'back_room', 'hard');
    const hot = cards(state).suspicion;
    expect(hot).toBeGreaterThan(0);

    for (let i = 0; i < 20; i++) {
      state.day += CARDS.intervalDays;
      tickCards(state);
    }
    expect(cards(state).suspicion).toBe(0);
  });
});

describe('losing on purpose', () => {
  it('always costs the stake, whatever the cards were going to do', () => {
    const state = game();
    const before = state.org.cash + state.org.dirtyCash;
    const result = sitDown(state, new Rng(state.rng), 'the_club', 'lose');
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
      const id = seatCivic(state, 'the_club');
      if (!id) continue;
      sat += 1;
      const before = figure(state, id).owed;
      sitDown(state, new Rng(state.rng), 'the_club', 'lose');
      if (figure(state, id).owed > before) bought += 1;
    }
    expect(sat, 'no seed ever seated a civic figure, so this measured nothing').toBeGreaterThan(20);
    expect(bought, 'losing to a judge never buys anything').toBeGreaterThan(0);
    expect(bought, 'losing to a judge always buys something, which is not a bribe, it is a shop').toBeLessThan(sat);
  });

  it('cannot stack favours past the cap every other route respects', () => {
    const state = game();
    const id = seatCivic(state, 'the_club');
    expect(id).not.toBeNull();
    figure(state, id!).owed = CIVIC.maxOwed;

    for (let i = 0; i < 12; i++) {
      sitDown(state, new Rng(state.rng), 'the_club', 'lose');
      nextWeek(state);
    }
    expect(figure(state, id!).owed).toBe(CIVIC.maxOwed);
  });
});

describe('sitting down at all', () => {
  it('runs weekly, and says how long is left', () => {
    const state = game();
    expect(canSit(state, 'back_room').ok).toBe(true);
    sitDown(state, new Rng(state.rng), 'back_room', 'straight');

    const no = canSit(state, 'back_room');
    expect(no.ok).toBe(false);
    expect(no.reason).toMatch(/days/);

    nextWeek(state);
    expect(canSit(state, 'back_room').ok).toBe(true);
  });

  it('refuses the rooms you have not been invited to, by naming both figures', () => {
    const state = game(5, 10);
    const no = canSit(state, 'upstairs');
    expect(no.ok).toBe(false);
    expect(no.reason).toMatch(String(TABLE_BY_ID.upstairs.respectAbove));
    // Not "you are not welcome". How far off you are.
    expect(no.reason).toMatch(/10/);
  });

  it('opens the bottom room to a boss on their first morning', () => {
    const fresh = newGame({ name: 'New', difficulty: 'normal', seed: 3 });
    expect(TABLE_BY_ID.back_room.respectAbove).toBe(0);
    expect(fresh.org.cash).toBeGreaterThanOrEqual(TABLE_BY_ID.back_room.stake);
    expect(canSit(fresh, 'back_room').ok).toBe(true);
  });

  it('pays winnings dirty, because a pot is cash in a bag', () => {
    const state = game();
    state.player.attributes.streetSmarts = 999;
    let won = false;
    for (let i = 0; i < 40 && !won; i++) {
      const dirtyBefore = state.org.dirtyCash;
      const cleanBefore = state.org.cash;
      const r = sitDown(state, new Rng(state.rng), 'back_room', 'straight');
      if (r.won) {
        won = true;
        expect(state.org.dirtyCash).toBeGreaterThan(dirtyBefore);
        expect(state.org.cash).toBeLessThanOrEqual(cleanBefore);
      }
      nextWeek(state);
    }
    expect(won, 'forty hands and never a winner').toBe(true);
  });
});

describe('a boss with nothing but a watch', () => {
  it('can put it up instead of money', () => {
    const state = game();
    expect(grantPossession(state, new Rng(state.rng), 'necklace')).toBeTruthy();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    nextWeek(state);

    expect(canSit(state, 'the_club').ok, 'broke and holding nothing usable').toBe(false);
    expect(canSit(state, 'the_club', 'necklace').ok).toBe(true);
  });

  it('will not be let stake a watch against the top table', () => {
    const state = game();
    expect(grantPossession(state, new Rng(state.rng), 'watch')).toBeTruthy();
    const no = canSit(state, 'upstairs', 'watch');
    expect(no.ok).toBe(false);
    expect(no.reason).toMatch(/\$/);
  });

  it('loses it, and the record says how', () => {
    const state = game();
    expect(grantPossession(state, new Rng(state.rng), 'necklace')).toBeTruthy();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    nextWeek(state);

    const result = sitDown(state, new Rng(state.rng), 'the_club', 'lose', 'necklace');
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
  it('is the same all week, and reading it costs nothing', () => {
    const state = game();
    const before = state.rng.calls;

    const first = seatedAt(state, 'upstairs');
    state.day += 1;
    expect(seatedAt(state, 'upstairs')).toEqual(first);
    // The whole panel, not just one table.
    tableRead(state);
    expect(state.rng.calls, 'reading the room advanced the random stream').toBe(before);
  });

  it('is not the same every week', () => {
    const state = game();
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      seen.add(seatedAt(state, 'upstairs').who);
      state.day += CARDS.intervalDays;
    }
    expect(seen.size, 'the same person sits opposite you for thirty weeks').toBeGreaterThan(2);
  });

  it('puts somebody worth knowing at the top table more often than at the bottom', () => {
    const state = game();
    let topNamed = 0;
    let bottomNamed = 0;
    for (let i = 0; i < 200; i++) {
      if (seatedAt(state, 'upstairs').kind !== 'nobody') topNamed += 1;
      if (seatedAt(state, 'back_room').kind !== 'nobody') bottomNamed += 1;
      state.day += CARDS.intervalDays;
    }
    /*
       The progression, and the reason the top table is worth being invited to
       beyond the size of the pot. Held as a gap rather than as two thresholds
       so it survives the mix being retuned.
    */
    expect(topNamed).toBeGreaterThan(bottomNamed * 1.5);
  });

  it('has more strangers than rooms, which is what makes the rotation work', () => {
    expect(NOBODIES.length).toBeGreaterThan(TABLES.length);
  });

  it('never seats the same stranger at two tables on the same night', () => {
    const state = game();
    for (let i = 0; i < 200; i++) {
      const who = TABLES.map((t) => seatedAt(state, t.id)).map((seat) => seat.who);
      expect(new Set(who).size, `day ${state.day}: ${who.join(' / ')}`).toBe(who.length);
      state.day += CARDS.intervalDays;
    }
  });

  it('names a real civic figure when it seats one', () => {
    const state = game();
    for (let i = 0; i < 100; i++) {
      const seat = seatedAt(state, 'upstairs');
      if (seat.kind === 'civic') {
        expect(CIVIC_FIGURES.some((f) => f.id === seat.id)).toBe(true);
      }
      state.day += CARDS.intervalDays;
    }
  });
});
