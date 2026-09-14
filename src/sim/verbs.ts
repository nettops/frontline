/**
 * The seven things only a particular boss can do.
 *
 * See `config/build.ts` for the design and what it replaces. The short of it:
 * a stat is not a multiplier. Each of the seven unlocks an **activity nobody
 * else has**, and separately changes **how the world behaves toward you**.
 * This file is the first half. `worldPull` and its consumers are the second.
 *
 * Every verb here is gated by `hasVerb` and nothing else — no money gate that
 * is really the gate, no rank requirement wearing a costume. If the answer to
 * "why can I not do this" is anything except "you did not put the points
 * there", the build has stopped being the decision.
 *
 * They are deliberately built out of machinery that already exists. Calling a
 * table is `openSitdown` without the invitation; casing a job is the prep
 * `scores.ts` already models; planting somebody is `informants.ts` pointed the
 * other way. Seven bespoke systems would be seven things to balance, and the
 * measurement in this project has never had the budget for that.
 */

import type { GameState, Id, Npc, RivalBusiness } from './types';
import type { FactionId } from '../config/factions';
import { clamp } from './rng';
import { addLog, formatMoneyShort } from './util';
import { crewList } from './npc';
import { hasVerb } from './build';
import { OPERATION_BY_ID } from '../config/operations';
import { VERBS } from '../config/verbs';
import { PAYDAY_INTERVAL } from '../config/economy';
import { AI } from '../config/factions';
import { BUSINESS_BY_ID } from '../config/businesses';
import { controlledTerritories, territoryDef, adjustSentiment } from './territory';
import { gainFear } from './player';
import { addNote } from './npc';
import { houseShort } from './houses';
import { earnDirty } from './economy';

export interface Check {
  ok: boolean;
  message: string;
}

const no = (message: string): Check => ({ ok: false, message });
const yes = (message = ''): Check => ({ ok: true, message });

/** The one refusal every verb shares, phrased as what is missing rather than a rule. */
function gate(state: GameState, id: Parameters<typeof hasVerb>[1], what: string): Check | null {
  return hasVerb(state, id) ? null : no(`You are not the kind of boss who ${what}.`);
}

// ------------------------------------------------------------------ grip ---

/**
 * Call everybody in.
 *
 * The whole family in one room. Grievances come out — that is what the room is
 * for — and the men who did not come are the finding. A boss with Grip hears
 * about a problem instead of losing the man who had it.
 *
 * Deliberately not a loyalty button. It clears *grievance*, which is the thing
 * a conversation can actually address, and leaves stagnation and heat alone —
 * those are answered by promotions and by laying low, and a room that fixed
 * everything would delete two systems.
 */
export function canCallEverybodyIn(state: GameState): Check {
  const stop = gate(state, 'grip', 'gets everybody in one room');
  if (stop) return stop;
  const last = state.org.lastMeetingDay ?? -999;
  const since = state.day - last;
  if (since < VERBS.meetingEveryDays) {
    return no(`You had them all in ${since} days ago. It stops meaning anything.`);
  }
  if (crewList(state).filter((n) => n.status === 'active').length < 2) {
    return no('There is nobody to call in.');
  }
  return yes();
}

export interface Meeting {
  /** Everyone who came, and what came out. */
  heard: { npc: Npc; grievanceBefore: number }[];
  /** And who did not, which is the half worth knowing. */
  absent: Npc[];
}

export function callEverybodyIn(state: GameState): Meeting | null {
  if (!canCallEverybodyIn(state).ok) return null;
  state.org.lastMeetingDay = state.day;

  const heard: Meeting['heard'] = [];
  const absent: Npc[] = [];

  for (const npc of crewList(state)) {
    if (npc.status !== 'active') {
      absent.push(npc);
      continue;
    }
    const before = npc.stats.grievance;
    npc.stats.grievance = clamp(before - VERBS.meetingClears, 0, 100);
    /*
       And it is worth something to have been in the room even for a man with
       nothing to say. Being spoken to by the boss is the cheapest standing
       there is, and the reason a meeting is not simply a grievance discount.
    */
    npc.stats.respectForBoss = clamp(
      npc.stats.respectForBoss + VERBS.meetingRegard,
      0,
      100,
    );
    if (before > VERBS.meetingClears) {
      addNote(npc, state.day, 'Said their piece, with everybody listening.', 'good');
    }
    heard.push({ npc, grievanceBefore: before });
  }

  addLog(
    state,
    `You had them all in. ${heard.length} came; ${absent.length} did not.`,
    'crew',
  );
  return { heard, absent };
}

// ---------------------------------------------------------------- muscle ---

/**
 * Put a district on the card.
 *
 * A standing weekly take off ground you already hold, paid for in how the
 * neighbourhood feels about you. It is the demand side fear never had:
 * measured twice, being feared had no reachable supply and bought almost
 * nothing, and a racket only a frightening family can hold is a reason to
 * build it.
 *
 * The take scales with fear rather than with the district, because that is
 * what the mechanic is: money that arrives because of what people think you
 * would do. A family with no reputation collects almost nothing and pays the
 * same public feeling for it.
 */
export function canPutOnCard(state: GameState, territoryId: string): Check {
  const stop = gate(state, 'muscle', 'collects like that');
  if (stop) return stop;
  const t = state.territories[territoryId];
  if (!t) return no('No such district.');
  if (!controlledTerritories(state).some((c) => c.id === territoryId)) {
    return no(`${territoryDef(territoryId).name} is not yours to collect on.`);
  }
  if ((state.org.card ?? []).includes(territoryId)) {
    return no(`${territoryDef(territoryId).name} is already on the card.`);
  }
  return yes(`Put ${territoryDef(territoryId).name} on the card`);
}

export function putOnCard(state: GameState, territoryId: string): Check {
  const guard = canPutOnCard(state, territoryId);
  if (!guard.ok) return guard;
  state.org.card = [...(state.org.card ?? []), territoryId];
  addLog(
    state,
    `${territoryDef(territoryId).name} pays now. Somebody will go round on Fridays.`,
    'money',
  );
  return yes();
}

export function takeOffCard(state: GameState, territoryId: string): Check {
  const card = state.org.card ?? [];
  if (!card.includes(territoryId)) return no('It is not on the card.');
  state.org.card = card.filter((id) => id !== territoryId);
  addLog(state, `${territoryDef(territoryId).name} comes off the card.`, 'money');
  return yes();
}

/*
   What one district on the card pays, at what you are worth right now.

   Every district pays the same figure — it is fear that moves it, not the
   ground itself — so this is also the honest preview for a district not yet
   on the card. Split out because the panel's own caption used to print the
   *total across whatever is already on the card*, which reads identically
   to "this is worthless" whether that is true or the card is simply still
   empty. A round-16 playtester read it exactly that way on a district they
   had not added yet and never returned to the mechanic.
*/
export function cardPerDistrict(state: GameState): number {
  const feared = clamp(state.org.fear / 100, 0, 1);
  return Math.round(VERBS.cardPerDistrict * (VERBS.cardFloor + feared * (1 - VERBS.cardFloor)));
}

/** What the card is worth this week, and what it costs the street. */
export function cardTake(state: GameState): number {
  const card = (state.org.card ?? []).filter((id) => state.territories[id]);
  return card.length * cardPerDistrict(state);
}

/**
 * Weekly. The card pays, and the street remembers who is collecting.
 *
 * Dirty money, because it is. And the sentiment cost is charged whether or not
 * the take was worth anything, which is the whole shape of the decision: a
 * family with no reputation is paying full price for nearly nothing.
 */
export function tickCard(state: GameState): void {
  // Weekly, gated in here rather than at the call site, the way `tickFear`
  // does it — a tick that only sometimes does anything should know that itself.
  if (state.day % PAYDAY_INTERVAL !== 0) return;
  const card = state.org.card ?? [];
  if (card.length === 0) return;

  const take = cardTake(state);
  if (take > 0) state.org.dirtyCash += take;

  for (const id of card) {
    if (!state.territories[id]) continue;
    adjustSentiment(state, id, VERBS.cardSentiment);
  }
  // Collecting is itself the reminder. Small, and it is the only source of
  // fear in the game that does not require a job to have gone well.
  gainFear(state, VERBS.cardFear * card.length);
}

// -------------------------------------------------------------- instinct ---

/**
 * Plant somebody.
 *
 * `informants.ts` models their people inside your family. This is the same
 * machinery pointed the other way: a man of yours inside a rival house or the
 * department, who tells you what is coming.
 *
 * What it buys is warning rather than power — see `plantedWarning`. A boss who
 * knows a raid is coming can lay low before it lands, which is the difference
 * between a bad week and a case.
 */
export function canPlant(state: GameState, where: string): Check {
  const stop = gate(state, 'instinct', 'has people in other people’s houses');
  if (stop) return stop;
  if ((state.org.planted ?? []).some((p) => p.where === where)) {
    return no('You already have somebody there.');
  }
  if ((state.org.planted ?? []).length >= VERBS.plantsAtOnce) {
    return no('You have as many people placed as you can keep track of.');
  }
  const spare = crewList(state).filter((n) => n.status === 'active');
  if (spare.length < VERBS.plantNeedsCrew) {
    return no('You have nobody to spare for it.');
  }
  return yes();
}

export function plant(state: GameState, where: string, npcId: Id): Check {
  const guard = canPlant(state, where);
  if (!guard.ok) return guard;
  const npc = state.npcs[npcId];
  if (!npc || npc.status !== 'active') return no('They are not available.');

  state.org.planted = [
    ...(state.org.planted ?? []),
    { where, npcId, since: state.day },
  ];
  /*
     He is gone from the roster while he is in there. A verb that cost nothing
     would be a free warning system, and the price of knowing things is that
     somebody is spending their life doing it.
  */
  npc.status = 'busy';
  npc.unavailableUntilDay = null;
  addNote(npc, state.day, `Placed inside ${where}. Nobody else knows.`, 'neutral');
  addLog(state, `You have somebody inside ${where} now.`, 'crew');
  return yes();
}

export function pullOut(state: GameState, where: string): Check {
  const planted = state.org.planted ?? [];
  const one = planted.find((p) => p.where === where);
  if (!one) return no('You have nobody there.');
  state.org.planted = planted.filter((p) => p.where !== where);
  const npc = state.npcs[one.npcId];
  if (npc && npc.status === 'busy') {
    npc.status = 'active';
    npc.unavailableUntilDay = null;
  }
  addLog(state, `You pulled your man out of ${where}.`, 'crew');
  return yes();
}

/** Whether somebody inside would have heard about this. */
export function hearsAbout(state: GameState, where: string): boolean {
  return (state.org.planted ?? []).some((p) => p.where === where);
}

// ---------------------------------------------------------------- stomach --

/**
 * Take the weight.
 *
 * You go inside so that one of yours does not. The most mafia decision this
 * game can offer and the only one that spends the boss himself: it costs
 * months of the clock, and it is worth more to the people watching than
 * anything money can buy.
 *
 * Deliberately expensive and deliberately not optimisable. A boss who does
 * this is out of the chair for a season, which is exactly long enough for the
 * succession machinery to become interesting.
 */
export function canTakeTheWeight(state: GameState, npcId: Id): Check {
  const stop = gate(state, 'stomach', 'goes in somebody else’s place');
  if (stop) return stop;
  const npc = state.npcs[npcId];
  if (!npc) return no('Nobody by that name.');
  if (npc.status !== 'arrested') return no(`${npc.name} is not the one they have.`);
  if ((state.org.insideUntilDay ?? 0) > state.day) return no('You are already inside.');
  return yes(`Go in for ${npc.name}`);
}

export function takeTheWeight(state: GameState, npcId: Id): Check {
  const guard = canTakeTheWeight(state, npcId);
  if (!guard.ok) return guard;
  const npc = state.npcs[npcId];
  if (!npc) return no('Nobody by that name.');

  const days = npc.unavailableUntilDay
    ? Math.max(VERBS.weightMinimumDays, npc.unavailableUntilDay - state.day)
    : VERBS.weightMinimumDays;

  npc.status = 'active';
  npc.unavailableUntilDay = null;
  npc.stats.loyalty = clamp(npc.stats.loyalty + VERBS.weightLoyalty, 0, 100);
  npc.stats.respectForBoss = clamp(npc.stats.respectForBoss + VERBS.weightRegard, 0, 100);
  addNote(npc, state.day, 'The boss went in for them. Nobody had to ask.', 'good');

  state.org.insideUntilDay = state.day + days;

  /*
     And everybody else hears about it.

     The reason this is worth more than money: a family watches what happens to
     the man who got caught, and the answer decides what they believe about the
     one who did not. Applied to the whole roster, not only the man it saved.
  */
  for (const other of crewList(state)) {
    if (other.id === npc.id || other.status === 'dead') continue;
    other.stats.loyalty = clamp(other.stats.loyalty + VERBS.weightLoyaltyOthers, 0, 100);
    other.stats.respectForBoss = clamp(
      other.stats.respectForBoss + VERBS.weightRegardOthers,
      0,
      100,
    );
  }

  addLog(
    state,
    `You went in for ${npc.name}. ${days} days, and everybody knows who did it.`,
    'crew',
  );
  return yes();
}

/** Whether the boss is currently doing the time. */
export function isInside(state: GameState): boolean {
  return (state.org.insideUntilDay ?? 0) > state.day;
}

/** Daily. Comes back out when the time is done. */
export function tickInside(state: GameState): void {
  const until = state.org.insideUntilDay ?? 0;
  if (until === 0 || until > state.day) return;
  state.org.insideUntilDay = 0;
  addLog(state, 'You are out. Everything carried on without you, more or less.', 'neutral');
}

// ----------------------------------------------------------------- method --

/**
 * Case a job.
 *
 * A week spent looking at an ordinary job properly, after which it runs like a
 * planned one. `scores.ts` already models preparation and its whole point is
 * that groundwork is a month of deliberate work on a big target; this is the
 * small version, for the work a family actually runs every day.
 *
 * One at a time, because a boss who has cased four jobs is not a boss who
 * cases jobs, he is a boss with a discount.
 */
export function canCase(state: GameState, territoryId: string): Check {
  const stop = gate(state, 'method', 'works like that');
  if (stop) return stop;
  /*
     And say what, because "something" was the whole of what a player got.

     Two round-17 testers used this verb and could not afterwards tell whether
     it had done anything; the only acknowledgement either of them found was
     this refusal, which names neither the job nor the clock. It now names both,
     and the Overview lists it beside everything else running.
  */
  if (state.org.cased) {
    const on = state.org.cased;
    const days = on.readyDay - state.day;
    return no(
      `Somebody is already watching ${OPERATION_BY_ID[on.defId]?.name ?? 'a job'} in ` +
        `${territoryDef(on.territoryId).name}` +
        (days > 0 ? `, ${days} ${days === 1 ? 'day' : 'days'} to go.` : ', and they are done.'),
    );
  }
  if (!state.territories[territoryId]) return no('No such district.');
  // Not a second name for the verb — the button reads its label from
  // `config/build.ts`, which is where the point that sold it is written. This
  // is the tooltip, and it says the constraint the label cannot.
  return yes('A week on it, and you can only be looking at one thing at a time.');
}

export function caseJob(state: GameState, defId: string, territoryId: string): Check {
  const guard = canCase(state, territoryId);
  if (!guard.ok) return guard;
  state.org.cased = { defId, territoryId, readyDay: state.day + VERBS.casingDays };
  addLog(state, 'Somebody is watching the place this week.', 'neutral');
  return yes();
}

/** Points on the odds, for the pair that was actually cased and once it is ready. */
export function casedBonus(state: GameState, defId: string, territoryId: string): number {
  const cased = state.org.cased;
  if (!cased) return 0;
  if (cased.defId !== defId || cased.territoryId !== territoryId) return 0;
  if (state.day < cased.readyDay) return 0;
  return VERBS.casedOdds;
}

/** Spent when the job it was for goes out. */
export function spendCasing(state: GameState, defId: string, territoryId: string): void {
  const cased = state.org.cased;
  if (!cased) return;
  if (cased.defId !== defId || cased.territoryId !== territoryId) return;
  if (state.day < cased.readyDay) return;
  state.org.cased = null;
}

// ------------------------------------------------------------------ word ---

/**
 * Call a table.
 *
 * This function is the stat gate alone, used by the allocation screen to say
 * whether the *build* is there — it names no target and does not decide who
 * you may actually approach. That decision was made real 2026-09-10 in
 * `sim/sitdown.ts`'s `canSitDownWith`: a crew member and a house at peace with
 * you are reachable regardless, and a house actively at war is the one room
 * a boss whose word carries nothing yet does not get shown into. Read the
 * comment there rather than here for the actual restriction — this stayed a
 * plain gate so `verbs.test.ts`'s baseline ("every verb refuses with nothing
 * built") keeps meaning what it says.
 */
export function canCallATable(state: GameState): Check {
  const stop = gate(state, 'word', 'calls people to a table');
  if (stop) return stop;
  return yes();
}

// ---------------------------------------------------------------- ledger ---

/**
 * The rival fronts a player has ever had a name for.
 *
 * Lazily created, matching `career`/`home`/`civic` before it — a save from
 * before this existed, or a career where no rival has invested yet, reads as
 * nobody having anything to buy into.
 */
export function rivalBusinesses(state: GameState): Record<Id, RivalBusiness> {
  if (!state.rivalBusinesses) state.rivalBusinesses = {};
  return state.rivalBusinesses;
}

export interface RivalBusinessRead {
  id: Id;
  name: string;
  factionId: FactionId;
  /** The house's own short name, for a row that names no faction id. */
  house: string;
  where: string | null;
  stake?: number;
}

/** Everything the Ledger screen needs to list what is out there to buy into. */
export function rivalBusinessRead(state: GameState): RivalBusinessRead[] {
  return Object.values(rivalBusinesses(state)).map((b) => ({
    id: b.id,
    name: BUSINESS_BY_ID[b.defId]?.name ?? 'A business',
    factionId: b.factionId,
    house: houseShort(state, b.factionId),
    where: b.territoryId ? territoryDef(b.territoryId).name : null,
    stake: b.stake,
  }));
}

/**
 * Buy into somebody else's business.
 *
 * A share of a front that already exists and is already earning, instead of
 * acquiring one of your own. It costs less than a purchase and it earns less,
 * and the thing you are really buying is that it is not in your name — a
 * business you own a piece of is not a business an investigator can walk into
 * and ask about you.
 *
 * Targets a rival's front specifically — see `RivalBusiness`'s own doc
 * comment for why `state.businesses`, which only ever holds the player's
 * own, could never be what this verb was for.
 */
export function canBuyIn(state: GameState, businessId: Id): Check {
  const stop = gate(state, 'ledger', 'gets into other people’s books');
  if (stop) return stop;
  const biz = rivalBusinesses(state)[businessId];
  if (!biz) return no('No such business.');
  if (biz.stake) return no('You already have a piece of that.');
  return yes();
}

export function buyIn(state: GameState, businessId: Id): Check {
  const guard = canBuyIn(state, businessId);
  if (!guard.ok) return guard;
  const biz = rivalBusinesses(state)[businessId];
  if (!biz) return no('No such business.');
  biz.stake = VERBS.stakeShare;
  addLog(state, 'You have a piece of it now. Your name is on nothing.', 'money');
  return yes();
}

/** What a stake in somebody else's place is worth per week. */
export function stakeIncome(weeklyRevenue: number, biz: { stake?: number }): number {
  return biz.stake ? Math.round(weeklyRevenue * biz.stake) : 0;
}

/**
 * Weekly. Everything a stake actually pays.
 *
 * Not taken off the rival's own `wealth` — `AI.invest.incomePerBusiness` is
 * tuned against measured populations (see `config/factions.ts`), and a cut
 * skimmed quietly off the books of one front among a family's several is not
 * the kind of dent that number was ever meant to absorb. What the player
 * bought is a piece of what a business like that earns, not a lever on the
 * rival's own economy.
 */
export function tickStakes(state: GameState): void {
  // Weekly, gated in here rather than at the call site — see `tickCard`.
  if (state.day % PAYDAY_INTERVAL !== 0) return;
  let total = 0;
  for (const biz of Object.values(rivalBusinesses(state))) {
    total += stakeIncome(AI.invest.incomePerBusiness, biz);
  }
  if (total <= 0) return;
  earnDirty(state, total);
  addLog(
    state,
    `The pieces you hold in other people's businesses paid ${formatMoneyShort(total)}, quietly.`,
    'money',
  );
}
