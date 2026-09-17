/**
 * The slipped tongue, and the three answers to it.
 *
 * The design argument is in `config/dementia.ts`. What this file has to keep
 * true is four things:
 *
 * 1. **Nothing is stored that can be derived.** `dementiaSince` is the whole
 *    condition — the field exists or it does not — and `dementiaCare` is the
 *    single answer currently in force. Everything else (who is failing, what
 *    it is costing, whether a minder is tied up) is recomputed from the
 *    roster each time it is asked.
 *
 * 2. **Doing nothing is free until there is a file.** A slipped tongue needs
 *    somewhere to land. A boss with no open case can leave an old man out in
 *    the social club for years and pay nothing for it, which is correct: the
 *    danger was never the talking, it was the talking plus somebody writing
 *    it down.
 *
 * 3. **Every refusal names what would lift it.** Green Grove says the figure
 *    and what is in the clean pool; a minder says how many men are free.
 *
 * 4. **The hit reuses `silence`.** There is one way to have a man killed in
 *    this game and this does not become a second one — same roll, same
 *    evidence, same heat, same chance it goes wrong and leaves him alive and
 *    talking. What this adds is the part `silence` cannot know about: the men
 *    who remember who he was find out, and they take it as what it is.
 */

import { Rng, clamp } from './rng';
import type { GameState, Id, Npc } from './types';
import { DEMENTIA, type DementiaCareStatus } from '../config/dementia';
import { ROLE_ORDER, DAYS_PER_YEAR } from '../config/economy';
import { isRelic } from './capoTension';
import { activeCases, recordCaseEvent } from './investigation';
import { addNote, crewList } from './npc';
import { remember } from './memory';
import { silence } from './silence';
import { note } from './ledger';
import { addLog } from './util';

export type { DementiaCareStatus };

/** Everybody on the roster whose mind has started going and who is still here. */
export function failingCapos(state: GameState): Npc[] {
  return crewList(state).filter(
    (n) =>
      n.dementiaSince !== undefined &&
      n.status !== 'dead' &&
      n.status !== 'defected' &&
      n.status !== 'boss',
  );
}

/** What is currently being done about him. Untended until the boss pays. */
export function careOf(npc: Npc): DementiaCareStatus {
  return npc.dementiaCare ?? 'active';
}

/**
 * The yearly pass, called from the clock beside `tickAging`.
 *
 * Capo and above only. A soldier with a failing memory is a sad thing and not
 * a crisis — what makes this the decision it is, is that the man knows
 * everything, and in this organization only the men at the top do.
 *
 * Draws once per eligible man per year and nothing at all when nobody is old
 * enough, so a career with a young table is bit-identical to one written
 * before this existed.
 */
export function checkDementiaOnset(state: GameState, rng: Rng): void {
  if (state.day % DAYS_PER_YEAR !== 0) return;

  for (const npc of crewList(state)) {
    if (npc.dementiaSince !== undefined) continue;
    if (npc.status !== 'active' && npc.status !== 'busy') continue;
    if (ROLE_ORDER.indexOf(npc.role) < ROLE_ORDER.indexOf('capo')) continue;
    if (npc.age < DEMENTIA.onsetAge) continue;
    if (!rng.chance(DEMENTIA.onsetChanceAnnual)) continue;

    npc.dementiaSince = state.day;
    npc.dementiaCare = 'active';
    addNote(
      npc,
      state.day,
      'Told the same story twice in an hour, and the second time it had a name in it.',
      'bad',
    );
    addLog(
      state,
      `${npc.name} is not right. Nobody at the table said anything, which is how you know they all noticed.`,
      'crew',
    );
  }
}

export interface CareAction {
  ok: boolean;
  message: string;
}

/** A man free to go and sit in a house indefinitely. Lowest rank first. */
function freeMinder(state: GameState): Npc | null {
  const free = crewList(state)
    .filter((n) => n.status === 'active' && ROLE_ORDER.indexOf(n.role) < ROLE_ORDER.indexOf('capo'))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return free[0] ?? null;
}

/** Puts whoever was sitting in the house back on the roster. */
function releaseMinder(state: GameState, capo: Npc): void {
  const minder = capo.dementiaMinderId ? state.npcs[capo.dementiaMinderId] : undefined;
  capo.dementiaMinderId = undefined;
  if (!minder || minder.status !== 'busy') return;
  minder.status = 'active';
  minder.unavailableUntilDay = null;
  addNote(minder, state.day, `Came back from sitting with ${capo.name}.`, 'neutral');
}

/**
 * What every man who remembers the old way takes from having watched it.
 *
 * Deliberately applied whether the hit came off or not. A relic does not
 * distinguish between the boss having an old man killed and the boss having
 * tried — the second one is worse, because now the old man is out there with
 * a reason to talk and everybody knows whose idea it was.
 */
function theOldMenFindOut(state: GameState, gone: Npc): void {
  for (const npc of crewList(state)) {
    if (npc.id === gone.id) continue;
    if (npc.status === 'dead' || npc.status === 'defected') continue;
    if (!isRelic(npc)) continue;

    npc.stats.grievance = clamp(npc.stats.grievance + DEMENTIA.relicGrievanceOnHit, 0, 100);
    npc.stats.loyalty = clamp(npc.stats.loyalty + DEMENTIA.relicLoyaltyHitOnHit, 0, 100);
    remember(npc, state.day, 'lost_a_friend', gone.id);
    addNote(
      npc,
      state.day,
      `${gone.name} was not well, and you had him dealt with anyway.`,
      'bad',
    );
  }
}

/**
 * Deciding what happens to him.
 *
 * `'hit'` is not a `DementiaCareStatus` and cannot be stored as one — it is
 * not care, and `Npc.status` already records the result without a second
 * field agreeing with it.
 */
export function assignDementiaCare(
  state: GameState,
  capoId: Id,
  care: 'golden_cage' | 'house_guard' | 'hit',
): CareAction {
  const capo = state.npcs[capoId];
  if (!capo) return { ok: false, message: 'No such person.' };
  if (capo.dementiaSince === undefined) {
    return { ok: false, message: `There is nothing wrong with ${capo.name}.` };
  }
  if (capo.status === 'dead' || capo.status === 'defected') {
    return { ok: false, message: `${capo.name} is already gone.` };
  }

  if (care === 'golden_cage') {
    /*
       Clean money only, straight off `org.cash` rather than through `spend`,
       which takes dirty first — a private hospital bills a man with a name
       and an address, and paying it out of a bag is the one thing this
       arrangement exists to avoid. Booked by hand so the weekly close still
       balances; same handling as `buyPetProject`.
    */
    if (state.org.cash < DEMENTIA.goldenCageCostMonthly) {
      return {
        ok: false,
        message:
          `Green Grove is $${DEMENTIA.goldenCageCostMonthly.toLocaleString('en-US')} a month and it has to come out of clean money. ` +
          `You have $${Math.round(state.org.cash).toLocaleString('en-US')} that could stand being asked about.`,
      };
    }
    releaseMinder(state, capo);
    capo.dementiaCare = 'golden_cage';
    addNote(capo, state.day, 'Moved somewhere with a garden and a locked gate.', 'neutral');
    const message = `${capo.name} is at Green Grove. He has a room with a view of the lawn and nobody can get to him.`;
    addLog(state, message, 'crew');
    return { ok: true, message };
  }

  if (care === 'house_guard') {
    const minder = freeMinder(state);
    if (!minder) {
      return {
        ok: false,
        message: 'Somebody has to sit in that house all day, and every man you have is out.',
      };
    }
    releaseMinder(state, capo);
    /*
       No timer. `tickNpcs` releases a busy man on `unavailableUntilDay`, and
       this arrangement has no end date — it lasts until the boss ends it or
       the old man does. `releaseMinder` is the only way back.
    */
    minder.status = 'busy';
    minder.unavailableUntilDay = null;
    capo.dementiaMinderId = minder.id;
    capo.dementiaCare = 'house_guard';
    addNote(minder, state.day, `Sent to sit with ${capo.name}. Indefinitely.`, 'neutral');
    addNote(capo, state.day, `${minder.name} is in the house now, every day.`, 'neutral');
    const message = `${minder.name} sits in ${capo.name}'s front room now. He is off everything else.`;
    addLog(state, message, 'crew');
    return { ok: true, message };
  }

  releaseMinder(state, capo);
  const done = silence(state, new Rng(state.rng), capoId);
  if (!done.ok) return done;
  theOldMenFindOut(state, capo);
  return {
    ok: true,
    message: `${capo.name} is dealt with. Every man at that table who is over fifty knows exactly what happened and why.`,
  };
}

/**
 * The weekly pass: the bill, and what an untended man said this week.
 *
 * Returns before any draw when nobody is failing, and again when there is no
 * file for a slipped tongue to land on — so the causal stream is untouched
 * until the game genuinely has both an old man and a case.
 */
export function tickDementia(state: GameState, rng: Rng): void {
  if (state.day % 7 !== 0) return;
  const failing = failingCapos(state);
  if (failing.length === 0) return;

  if (state.day % DEMENTIA.goldenCageIntervalDays === 0) {
    for (const npc of failing) {
      if (careOf(npc) !== 'golden_cage') continue;
      if (state.org.cash < DEMENTIA.goldenCageCostMonthly) {
        /*
           The bill did not clear, so the arrangement ends — and it ends by
           dropping back to `active`, which is to say he comes home and starts
           talking again. A private hospital does not carry anybody.
        */
        npc.dementiaCare = 'active';
        addNote(npc, state.day, 'Green Grove sent him home. The account was short.', 'bad');
        addLog(
          state,
          `${npc.name} is back in his own house. Green Grove does not run a tab.`,
          'money',
        );
        continue;
      }
      state.org.cash -= DEMENTIA.goldenCageCostMonthly;
      note(state, 'world', -DEMENTIA.goldenCageCostMonthly);
    }
  }

  const loose = failing.filter((n) => careOf(n) === 'active');
  if (loose.length === 0) return;

  /*
     The file it lands on. Strongest first, exactly as `tickSuburban` and
     `transmitOrder` pick theirs: the agency with the most is the one whose
     people are in the neighbourhood listening to an old man in a coffee shop.
  */
  const cases = activeCases(state);
  if (cases.length === 0) return;
  const worst = cases.reduce((a, b) => (b.strength > a.strength ? b : a));

  for (const npc of loose) {
    if (!rng.chance(DEMENTIA.slippedTongueChanceWeekly)) continue;
    const added = DEMENTIA.slippedTongueEvidenceWeekly;
    worst.strength = clamp(worst.strength + added, 0, 100);
    // Itemised, for the same reason `tickSuburban`'s statement is.
    worst.lastGrowth = worst.lastGrowth
      ? { ...worst.lastGrowth, absorbed: worst.lastGrowth.absorbed + added }
      : { absorbed: added, work: 0, visibility: 0 };
    worst.lastProgressDay = state.day;
    /*
       `obvious: true`. He said it out loud, in a room with people in it — the
       difference between this and a wiretap is precisely that everybody heard.
    */
    recordCaseEvent(
      state,
      worst,
      `${npc.name} told a story in a coffee shop with four names in it, two of them dead.`,
      true,
    );
    addNote(npc, state.day, 'Said something in public that only four people knew.', 'bad');
  }
}
