/**
 * The things nobody tells you.
 *
 * This game explains itself through fourteen panels, and a first-time player
 * has no way of knowing which of them matters on day one — or that dirty money
 * cannot buy a rank, or that payroll runs whether the week earned or not. The
 * manual answer is a wall of text nobody reads. This is the other answer: one
 * line at a time, said at the moment it becomes true.
 *
 * Like the briefing in `report.ts`, it is strictly a reading of state. Nothing
 * here decides anything, no tip can change an outcome, and the simulation does
 * not know it exists — which is why it lives in `ui/` rather than `sim/`.
 *
 * Two properties make it a tutorial rather than a nag:
 *
 *   - A tip is shown only while its `when` is still true. "Bring somebody in"
 *     disappears the moment you bring somebody in, without being dismissed and
 *     without having been taught twice.
 *   - Only one is ever on screen. The opening chain sits at the top of the
 *     list in the order a career actually happens, so early tips hold the slot
 *     until the thing they are about is done.
 */

import type { GameMode, GameState } from '../sim/types';
import type { PanelId } from './Rail';
import { crewList } from '../sim/npc';
import { ownedBusinesses } from '../sim/business';
import { controlledTerritories } from '../sim/territory';
import { activeCases } from '../sim/investigation';
import { playerIsAtWar } from '../sim/diplomacy';
import { mostHostile } from '../sim/faction';
import { eligibleHeirs, heirOf } from '../sim/succession';
import { tradeUnlocked } from '../sim/contraband';
import { canBorrow, totalOwed } from '../sim/market';
import { canAcquire } from '../sim/business';

import { BUSINESSES } from '../config/businesses';
import { POSSESSIONS } from '../config/possessions';
import { cards, tableRead } from '../sim/cards';
import { canBuyPossession, heldPossessions } from '../sim/possessions';
import { isLayingLow } from '../sim/heat';
import { eligibleStewards } from '../sim/delegation';
import { playerInfluence, territoryList } from '../sim/territory';

export interface Tip {
  id: string;
  /** The kicker. Says what kind of thing this is before the sentence lands. */
  label: string;
  text: string;
  /** Where you would act on it. Null when there is nowhere to go. */
  panel: PanelId | null;
  /** True for as long as this is worth saying. Re-read on every render. */
  when: (state: GameState) => boolean;
  /**
   * Jumps the queue. For things that are wrong now rather than worth knowing
   * eventually — an open case does not wait behind a tip about wages.
   */
  urgent?: true;
  /**
   * The ways of playing this applies to. Absent means all of them.
   *
   * Out here rather than inside `when` for the same reason as `ceiling` — the
   * Tips page has to be able to say "not in this game" instead of implying
   * that something is coming which never will.
   */
  only?: GameMode[];
  /**
   * Last day this is worth saying at all. See `BASICS_UNTIL`.
   *
   * A field rather than another clause inside `when`, because the Tips page
   * has to be able to tell "not yet" from "that moment has gone" — and a
   * closure returning false cannot say which one it means.
   */
  ceiling?: number;
}

/**
 * How long the basics are still worth saying.
 *
 * Tips fire in list order, and an existing save that has never seen one is
 * indistinguishable from a game started this morning — so without a ceiling,
 * loading a four-year-old organization means being told what payroll is. The
 * two tips this covers are about things you will have lived through dozens of
 * times by here. The situational ones below have no ceiling, because they
 * fire on a condition rather than on a clock.
 *
 * Nothing is lost to this: anything the strip has stopped offering is printed
 * in full on the Tips page.
 */
const BASICS_UNTIL = 120;

/**
 * Order is the tutorial.
 *
 * The first four are a chain: each one's `when` goes false as the next one's
 * goes true, so a new player is walked from one man and no idea to a finished
 * job and a second hire without dismissing anything. The rest is situational,
 * firing whenever the game gets there — which for a fast player is week two
 * and for a careful one is month four.
 *
 * The chain is career-only. A sandbox start hands you a rank, a payroll and a
 * district, which is not a position anybody reaches without already knowing
 * how this works, and its first line would be describing one man and a few
 * hundred dollars to somebody looking at a capo's books.
 */
export const TIPS: Tip[] = [
  // ---------------------------------------------------------- first steps ---
  {
    id: 'first_job',
    only: ['career'],
    label: 'First steps',
    text:
      'A little money and one man who has been around as long as you have. Nothing here happens by itself — go to Operations, take the job your rank allows, put them on it and send it.',
    panel: 'operations',
    when: (s) =>
      s.operationHistory.length === 0 &&
      Object.keys(s.activeOperations).length === 0,
  },
  {
    id: 'time_moves',
    only: ['career'],
    label: 'First steps',
    text:
      'A job runs while the clock does, and the clock only moves when you move it. Space advances a day, W a week — and a week stops early the moment something needs you.',
    panel: null,
    when: (s) =>
      s.operationHistory.length === 0 && Object.keys(s.activeOperations).length > 0,
  },
  {
    id: 'more_crew',
    only: ['career'],
    label: 'First steps',
    text:
      'One man limits you to the smallest jobs there are. Organization is where you bring somebody in — a street criminal can hold three, and every rank after that holds more.',
    panel: 'crew',
    when: (s) => s.operationHistory.length > 0 && crewList(s).length < 2,
  },
  {
    id: 'it_saves',
    only: ['career'],
    label: 'First steps',
    text:
      'That is the loop: earn, spend it on people and ground, and stay under the attention it costs you. It saves itself every time the clock moves, and Saves holds three slots of your own.',
    panel: null,
    when: (s) => s.operationHistory.length > 0,
    ceiling: 45,
  },

  // ----------------------------------------------------------- the people ---
  {
    id: 'reading_people',
    only: ['career', 'sandbox'],
    label: 'People',
    text:
      'You never see what a man actually is. Organization shows a read — a phrase and five pips — and it sharpens as you work with them. Hiring is a bet, and it is meant to be one.',
    panel: 'crew',
    when: (s) => crewList(s).length > 0 && s.day >= 8,
    ceiling: BASICS_UNTIL,
  },
  {
    id: 'wages',
    only: ['career', 'sandbox'],
    label: 'Money',
    text:
      'Payroll runs every seventh day whether the week earned or not, and a missed one is remembered by the man who missed it. Finances shows the bill before it lands.',
    panel: 'finances',
    when: (s) => crewList(s).length >= 2 && s.day >= 6,
    ceiling: BASICS_UNTIL,
  },

  // ------------------------------------------------------------ the money ---
  {
    id: 'dirty_money',
    only: ['career', 'sandbox'],
    label: 'Money',
    text:
      'Dirty money pays wages and buys jobs. It cannot buy a rank, and a pile of it is something an investigator can read. Businesses turn it clean, slowly, for a cut.',
    panel: 'businesses',
    when: (s) => s.org.dirtyCash >= 2_500 && ownedBusinesses(s).length === 0,
  },
  {
    id: 'debt',
    only: ['career', 'sandbox'],
    label: 'Money',
    text:
      'A loan repays itself out of your money every week, on time, whether the week went well or not. Finances has what is still owed and to whom.',
    panel: 'finances',
    when: (s) => totalOwed(s) > 0,
  },

  // ------------------------------------------------------------- pressure ---
  {
    id: 'heat',
    only: ['career', 'sandbox'],
    label: 'Attention',
    text:
      'Heat is how hard the city is looking at you. It makes every job worse, and it barely falls while you are working. Laying low drops it fast, and only quiet work moves while you are dark.',
    panel: 'dashboard',
    when: (s) => s.org.heat >= 35 && !isLayingLow(s),
    urgent: true,
  },
  {
    id: 'case_open',
    only: ['career', 'sandbox'],
    label: 'The law',
    text:
      'Somebody has opened a file on you. A case builds on the evidence your failures leave behind — Law Enforcement shows how far along it is, and what a lawyer, a friend inside or a quiet month would do about it.',
    panel: 'law',
    when: (s) => activeCases(s).length > 0,
    urgent: true,
  },

  // --------------------------------------------------------------- ground ---
  {
    id: 'ground',
    only: ['career', 'sandbox'],
    label: 'Ground',
    text:
      'Every job you run in a district leaves influence behind. Enough of it and the district is yours — better payouts, room for fronts, and a rival who now has a reason to mind.',
    panel: 'territory',
    when: (s) =>
      s.operationHistory.length >= 6 && controlledTerritories(s).length === 0,
  },
  {
    /*
       F15, and it is a teaching problem rather than an economy problem.

       The economy forks on fronts: front income compounds into holdings, so a
       family that never gets a second one never starts. `ladder.probe` reports
       the gate as **money in 98% of the weeks a career owns nothing** — and 27
       of 36 careers finish flat, holding one front.

       What no instrument had ever checked is that the game already answers
       this. The first lender in the catalogue is a man at the back of a
       restaurant: $40,000, no collateral, no respect requirement, no business
       requirement, available on the first morning. An arm of the probe that
       borrows to reach a front moves careers past $100,000 from 9 in 36 to 14
       in 36, median fronts from one to two — and **kills nobody**: careers
       ending early stayed at zero.

       Seventeen loans across thirty-six careers was all it took, and the bot
       had to be told to do it. This is F10's shape again, which is the one
       finding this project has actually closed: a good thing nobody can see is
       there.
    */
    id: 'borrow_a_front',
    only: ['career', 'sandbox'],
    label: 'The difference',
    text:
      'A front pays into holdings, and holdings compound — which is why the second one is the one that matters, and why the money is always the thing in the way. Somebody on Delacroix will advance the difference against nothing but your word. It is expensive and it is not the worst idea you have had.',
    panel: 'finances',
    when: (s) =>
      ownedBusinesses(s).length <= 1 &&
      totalOwed(s) === 0 &&
      canBorrow(s, 'shark', {
        respect: s.org.respect,
        businesses: ownedBusinesses(s).length,
        friendlyFactionId: null,
      }).ok &&
      // Only once there is something to buy and it is out of reach, so this is
      // advice at the moment it becomes true rather than on the first morning.
      /*
         A front whose only remaining blocker is the money.

         `canAcquire` returns `ok: false` when you cannot cover it, so this
         cannot be written as "allowed but unaffordable" — the first version
         was, and the predicate could never be true. The refusal names the
         shortfall now, and this reads it.
      */
      territoryList(s).some((t) =>
        BUSINESSES.some((def) => {
          const check = canAcquire(s, def.id, t.id);
          return !check.ok && /short\.$/.test(check.reason ?? '');
        }),
      ),
  },
  {
    /*
       The one thing in the game that is yours rather than the organization's.

       It lives on the Yourself page, which is the page a player visits to read
       their attributes and then does not visit again — so this fires the first
       time there is clean money sitting there with nothing claiming it, rather
       than on the first morning when it would be noise.

       `clean` rather than total funds on purpose, and the tip says so, because
       the whole rule of the catalogue is that dirty money does not buy things
       in your own name and a player who does not know that will read the
       refusal as a bug.
    */
    id: 'something_of_your_own',
    only: ['career', 'sandbox'],
    label: 'Yours',
    text:
      'The fronts belong to the organization. Nothing belongs to you. Yourself has a catalogue now — a car, a watch, three rooms with your own name on the door. They count toward what the family is worth exactly as money put away does, so buying one costs you no rank; what it costs is that the money has stopped being money. Clean money only. What people can see makes you look more legitimate and puts your name in the paper, and those are not the same thing.',
    panel: 'player',
    when: (s) =>
      heldPossessions(s).length === 0 &&
      // Something in the catalogue is actually within reach, so this is advice
      // at the moment it becomes true rather than a standing advertisement.
      POSSESSIONS.some((def) => canBuyPossession(s, def.id).ok),
  },
  {
    /*
       The card game, and it is a tip rather than a memo for one reason: it is
       already on a page, and a memo would be the fourth thing competing for
       the one daily slot the pacing work spent a day protecting.

       Fires when a room is actually open *and* somebody worth an evening is
       sitting in it — a standing advertisement for a weekly game would be
       noise 51 weeks a year. The favour half is what the tip is really for:
       losing on purpose is the one route to a favour that does not involve
       waiting thirteen weeks for standing to drift, and nobody works that out
       from a button labelled "Lose to them".
    */
    id: 'the_game',
    only: ['career', 'sandbox'],
    label: 'The game',
    text:
      'There is a card game every week, and the cards are the least of it. Who is sitting opposite is on The City page before you commit — and losing to a man who decides things is how money reaches him without either of you having said anything. It is the fast road to a favour. The slow one is thirteen quiet weeks.',
    panel: 'city',
    when: (s) =>
      cards(s).hands === 0 &&
      tableRead(s).some((room) => room.ok && room.seat.kind !== 'nobody'),
  },
  /*
     `step_up` was here, and there is no step up any more.

     It fired on `player.pendingRank !== null` and pointed at the Advancement
     panel: "Rank is not experience — it is held money, standing, people and
     ground, all at once." Ground and people are still what open the game up;
     the title in the middle is gone, and with it the offer, so the tip could
     never fire again. `tips.reach.test.ts` caught it as an unreachable tip.

     What it was really teaching — that the game opens on what you hold rather
     than on how long you have played — the Needs column on the job table now
     says on every locked row, at the moment the player is looking at the job.
  */

  // ------------------------------------------------------- the second verb ---
  /*
     Everything above this point is allocation: which job, which district, which
     bodies. Everything below is the other half of the game, and a blind
     playtester found none of it in a hundred and sixty-eight days.

     That is what these five exist for. The sit-down, a district in somebody
     else's hands, a promise with a date on it, a page of nights the other side
     turned out to know, and a room that has stopped wanting you — all of them
     reachable, none of them announced, all of them living one click inside a
     panel nobody had a reason to open. The tester's verdict on depth and pacing
     was written about a game with its best mechanics switched off.

     Each fires on the state that makes it true rather than on a day, so a
     careful player meets them late and an aggressive one meets them early,
     which is the same rule the rest of this list follows.
  */
  {
    id: 'sitdown',
    only: ['career', 'sandbox'],
    label: 'The room',
    text:
      'You can sit down with any of them. Open somebody in Organization and ask for a room — three things said, against a read of them that is deliberately not reliable. It is the one decision in this game that is not about allocating anybody.',
    panel: 'crew',
    when: (s) =>
      crewList(s).some((n) => n.status === 'active' || n.status === 'busy') &&
      !Object.keys(s.flags).some((k) => k.startsWith('sat_')),
  },
  {
    id: 'grievance',
    only: ['career', 'sandbox'],
    label: 'The room',
    text:
      'Somebody is carrying something. A sit-down is the only way to find out what, and the only way to put it down — and what you say to settle it is a thing they will hold you to.',
    panel: 'crew',
    when: (s) =>
      crewList(s).some(
        /*
           35, and the number was measured rather than chosen.

           `tips.reach` plays six four-year careers and records what an active
           man actually carries. The ceiling across those careers moves between
           roughly 44 and 54 depending on nothing but the random stream — it
           was re-measured three times across one afternoon of unrelated
           changes and moved every time. So a bar of 55 was above what the
           simulation produces at all, and anything in the forties passes or
           fails on the seed: the advice was reachable by luck, and twice it
           was not reachable at all.

           A tip nobody can reach is F10's shape, and F10 is the one finding
           this project has actually closed. 35 is below the whole of the
           observed band rather than inside it, which is the only way a bar on
           a stochastic quantity stops being a coin flip — and it is still well
           above the twenty-odd an ordinary man carries, so the line still
           means what it says: somebody is carrying something.
        */
        (n) => (n.status === 'active' || n.status === 'busy') && n.stats.grievance >= 35,
      ),
  },
  {
    id: 'promised',
    only: ['career', 'sandbox'],
    label: 'Your word',
    text:
      'You told somebody something. It is on their sheet with a date on it, and it runs out — a promise you meant at the time and then forgot is worse than one you never made.',
    panel: 'crew',
    when: (s) => (s.promises ?? []).length > 0,
  },
  {
    id: 'delegate',
    only: ['career', 'sandbox'],
    label: 'Ground',
    text:
      'You cannot be in two districts at once, and a district nobody works goes quiet. Open one in Territory and put a man in charge of it — then read what they do with it, because that is the only thing you will ever be told about them.',
    panel: 'territory',
    when: (s) =>
      eligibleStewards(s).length > 0 &&
      territoryList(s).some((t) => playerInfluence(t) > 20 && !t.stewardId) &&
      territoryList(s).every((t) => !t.stewardId),
  },
  {
    id: 'ledger',
    only: ['career', 'sandbox'],
    label: 'Ground',
    text:
      'They have been filing weeks. Two of the things they can do are written down identically, and the only difference between them is what the district earned — so read the money against the claim, not the claim on its own.',
    panel: 'territory',
    when: (s) => territoryList(s).some((t) => (t.ledger ?? []).length >= 4),
  },
  {
    id: 'leaks',
    only: ['career', 'sandbox'],
    label: 'The law',
    text:
      'A case has turned out to know about specific nights. Intelligence lists them and who was on each one. Some of it is somebody talking and some of it is their own work, and nothing on that page will ever tell you which.',
    panel: 'intelligence',
    when: (s) => (s.leaks ?? []).length > 0,
    urgent: true,
  },
  {
    id: 'unrest',
    only: ['career', 'sandbox'],
    label: 'After you',
    text:
      'There has been a meeting you were not at. Somebody senior wants this and enough of the room is carrying something to let them — all of it readable on the crew sheet, in the usual amount of fog, if you go and look now.',
    panel: 'crew',
    when: (s) => (s.flags['unrest_told'] ?? 0) > 0,
    urgent: true,
  },

  // --------------------------------------------------------------- others ---
  {
    id: 'rivals',
    only: ['career', 'sandbox'],
    label: 'Rivals',
    text:
      'One of the families has taken against you. They decide for themselves, on their own goals — Rivals has what they hold and how they read you, and Diplomacy is where you deal with it before it costs you.',
    panel: 'rivals',
    when: (s) => !!mostHostile(s) && !playerIsAtWar(s),
  },
  {
    id: 'war',
    only: ['career', 'sandbox'],
    label: 'War',
    text:
      'You are at war. It resolves week by week on strength, allies and ground, and it does not end because you stopped paying attention to it. Diplomacy is where it ends.',
    panel: 'diplomacy',
    when: (s) => playerIsAtWar(s),
    urgent: true,
  },
  {
    id: 'heir',
    only: ['career', 'sandbox'],
    label: 'After you',
    text:
      'Name somebody. If you go — a conviction, a bullet, old age — whoever has the strongest claim takes it, and the room may disagree about who that is. Succession is where you settle that in advance.',
    panel: 'succession',
    when: (s) => !heirOf(s) && eligibleHeirs(s).length > 0,
  },
  {
    id: 'trade',
    only: ['career', 'sandbox'],
    label: 'The trade',
    text:
      'You have premises now, so people will deal with you. The Trade runs on a standing arrangement and districts to move through — steady money, and the one thing on your books a warrant can physically take.',
    panel: 'contraband',
    when: (s) => tradeUnlocked(s, 'product') && !s.contraband.supplierId,
  },
  {
    id: 'why',
    label: 'Records',
    text:
      'When a family does something that makes no sense, Why has the decision they took and the ones they turned down, with the numbers. None of it is scripted, so the answer is always in there.',
    panel: 'why',
    when: (s) => s.day >= 60,
  },

  // ----------------------------------------------------------- simulation ---
  {
    id: 'watching',
    only: ['simulation'],
    label: 'The city',
    text:
      'Nobody is playing this one. The families run themselves against their own goals — move the clock in months and read what they did to each other.',
    panel: null,
    when: () => true,
    ceiling: 30,
  },
];

/** One flag per tip, so a save carries what it has already taught. */
const seenKey = (id: string): string => `tip_${id}`;
/**
 * Separate from retirement, and the difference matters.
 *
 * Retirement is you saying you have understood something. Being shown is only
 * that it went past. The opening chain is designed to advance without anybody
 * dismissing anything, so tracking retirement alone left the Tips page filing
 * three of the four tutorial lines under "not said yet" immediately after
 * saying them — found by playing it, not by testing it.
 */
const shownKey = (id: string): string => `tipshown_${id}`;
const OFF = 'tips_off';

export function tipsOff(state: GameState): boolean {
  return !!state.flags[OFF];
}

export function setTipsOff(state: GameState, off: boolean): void {
  if (off) state.flags[OFF] = 1;
  else delete state.flags[OFF];
}

/** Never shown again, in this save. */
export function dismissTip(state: GameState, id: string): void {
  state.flags[seenKey(id)] = state.day;
}

/** The day it was retired, or null if it never has been. */
export function retiredOn(state: GameState, id: string): number | null {
  return state.flags[seenKey(id)] ?? null;
}

/** It went past. Written by the strip the first time it prints one. */
export function markShown(state: GameState, id: string): void {
  if (state.flags[shownKey(id)] === undefined) state.flags[shownKey(id)] = state.day;
}

/** The day it was first shown, or null if it never has been. */
export function shownOn(state: GameState, id: string): number | null {
  return state.flags[shownKey(id)] ?? null;
}

/** Puts one back in the queue. Only useful while its `when` still holds. */
export function restoreTip(state: GameState, id: string): void {
  delete state.flags[seenKey(id)];
}

export function restoreAllTips(state: GameState): void {
  for (const tip of TIPS) {
    delete state.flags[seenKey(tip.id)];
    delete state.flags[shownKey(tip.id)];
  }
}

/**
 * The one tip worth the strip right now, or nothing.
 *
 * Urgent beats order, order beats everything else, and anything dismissed or
 * no longer true is not a candidate.
 */
/**
 * How long a tip holds the slot before the queue moves past it.
 *
 * `nextTip` skipped only on `seenKey`, which nothing but the "got it" button
 * writes. So a tip whose condition stays true, shown to a player who never
 * presses that button, sat at the head of the queue forever and every later
 * non-urgent tip was unreachable.
 *
 * Round 11 finished a 303-day career reading "5 OF 25 SAID" — all five inside
 * the first 42 days, with the same THE LAW tip pinned "ON SCREEN NOW" for 258
 * of them. `tips.reach.test.ts` is right that eighteen predicates come true in
 * an ordinary career; they were coming true behind a tip nobody dismissed.
 *
 * Twelve days is long enough to have been read at any play speed — a player
 * stepping a week at a time sees it twice — and short enough that a career
 * gets through the catalogue. Nothing is lost either way: the Advice page keeps
 * every tip, and `restoreTip` puts one back.
 */
export const TIP_LINGER_DAYS = 12;

export function nextTip(state: GameState): Tip | null {
  if (tipsOff(state) || state.gameOver) return null;
  let first: Tip | null = null;
  for (const tip of TIPS) {
    if (state.flags[seenKey(tip.id)] !== undefined) continue;
    if (tip.only && !tip.only.includes(state.mode)) continue;
    if (tip.ceiling !== undefined && state.day > tip.ceiling) continue;
    if (!tip.when(state)) continue;
    if (tip.urgent) return tip;
    // Had its turn. It stays on the Advice page; it stops holding the slot.
    const shown = state.flags[shownKey(tip.id)];
    if (shown !== undefined && state.day - shown >= TIP_LINGER_DAYS) continue;
    if (!first) first = tip;
  }
  return first;
}
