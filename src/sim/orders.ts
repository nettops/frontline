/**
 * Orders, as commitments rather than sales.
 *
 * The design lives in `config/orders.ts`. This is the machine: it decides who
 * asks and for how much, holds the units back once you have said yes, hands
 * them over as they arrive, and settles what is left on the day it was due.
 *
 * Three things it deliberately does not own.
 *
 * **The reservation.** `reservedUnits` lives in `contraband.ts`, because that
 * is the module that buys and distributes and it must not import this one.
 * This module reads that one; nothing reads back.
 *
 * **The consequence of arming somebody.** A family order settles through
 * `ARMS_SALE.strengthPerCrate`, the same rate the spot sale and the player's
 * own armoury both use. A crate cannot be worth one thing in a rival's hands
 * and another in yours — that pinning is what makes any of this a trade rather
 * than free money, and it belongs where it already is.
 *
 * **What a gang is.** A gang is a name, a neighbourhood and three
 * per-unit figures. It has no turn, no wealth and no agenda, and the moment it
 * grows any of those it should become a faction properly or stop pretending.
 */

import { Rng, clamp } from './rng';
import type { GameState, Id, Order } from './types';
import { addLog, formatMoney } from './util';
import { addHeat } from './heat';
import { territoryDef } from './territory';
import { houseShort } from './houses';
import { note } from './ledger';
import { ARMS_SALE, type TradeId } from '../config/contraband';
import { GANGS, GANG_BY_ID, ORDERS, ORDER_FAILURE } from '../config/orders';
import { RIVAL_IDS, type FactionId } from '../config/factions';
import { PAYDAY_INTERVAL } from '../config/economy';
import { throughput, tradeUnlocked, unitValue, type TradeAction } from './contraband';

/**
 * Everything anybody has asked for, lazily.
 *
 * Optional state with a lazy initialiser, the same idiom `promises` and
 * `civic` use — so `SAVE_VERSION` does not move and a save written before
 * orders existed loads with nobody asking you for anything.
 */
export function orderList(state: GameState): Order[] {
  if (!state.orders) state.orders = [];
  return state.orders;
}

/** Offers still standing and commitments still running. */
export function liveOrders(state: GameState): Order[] {
  return (state.orders ?? []).filter((o) => o.status === 'offered' || o.status === 'accepted');
}

export function orderValue(order: Order): number {
  return order.units * order.unitPrice;
}

/** Days until it lapses, or until it is due. */
export function daysLeft(state: GameState, order: Order): number {
  const on = order.status === 'offered' ? order.lapsesDay : order.dueDay;
  return Math.max(0, on - state.day);
}

export function buyerName(state: GameState, order: Order): string {
  return order.buyerKind === 'family'
    ? houseShort(state, order.buyerId as FactionId)
    : (GANG_BY_ID[order.buyerId]?.name ?? 'Somebody');
}

// ------------------------------------------------------------ the asking ---

/** Local copy of diplomacy.ts:atWar, for the same reason contraband.ts keeps one. */
function atWarWith(state: GameState, id: FactionId): boolean {
  return state.factions[id]?.bonds?.player?.warSince != null;
}

/**
 * Somebody asks.
 *
 * Sized off the player's own weekly throughput rather than off a fixed number,
 * because a fixed quantity is either trivial for a large outfit or impossible
 * for a small one and both of those are the same bug. Above one week on
 * purpose — an order the existing flow already covers is a rounding error with
 * a countdown attached.
 *
 * Returns null when this buyer cannot ask right now, which is the honest
 * answer and lets the weekly chooser above simply try somebody else.
 */
export function offerOrder(
  state: GameState,
  rng: Rng,
  kind: 'family' | 'gang',
  buyerId: string,
): Order | null {
  if (liveOrders(state).length >= ORDERS.maxLive) return null;

  const trade: TradeId = kind === 'family' ? 'arms' : (GANG_BY_ID[buyerId]?.wants ?? 'product');
  if (kind === 'gang' && !GANG_BY_ID[buyerId]) return null;
  if (!tradeUnlocked(state, trade)) return null;

  const pays = kind === 'family' ? ORDERS.familyPays : GANG_BY_ID[buyerId].pays;
  const unitPrice = Math.round(unitValue(state, trade) * pays);

  let units = Math.max(
    ORDERS.minUnits[trade],
    Math.round(
      throughput(state, trade).total * rng.float(ORDERS.scaleOfWeekly[0], ORDERS.scaleOfWeekly[1]),
    ),
  );

  if (kind === 'family') {
    const faction = state.factions[buyerId as FactionId];
    if (!faction) return null;
    // Nobody buys from somebody they are shooting at. `ARMS_SALE` already says
    // so about a single afternoon's sale; an order is a longer arrangement.
    if (ARMS_SALE.requiresPeace && atWarWith(state, buyerId as FactionId)) return null;
    // And they have to be able to pay for it. `faction.wealth` is a real
    // number that other systems spend, so an order that ignored it would be
    // printing money into somebody else's treasury.
    units = Math.min(units, Math.floor(faction.wealth / Math.max(1, unitPrice)));
    if (units < ORDERS.minUnits[trade]) return null;
  }

  const window = Math.round(rng.float(ORDERS.daysToFill[0], ORDERS.daysToFill[1]));
  const order: Order = {
    id: `order_${state.day}_${orderList(state).length}` as Id,
    buyerKind: kind,
    buyerId,
    trade,
    units,
    unitPrice,
    offeredDay: state.day,
    lapsesDay: state.day + ORDERS.offerStands,
    dueDay: state.day + window,
    delivered: 0,
    status: 'offered',
  };
  orderList(state).push(order);
  addLog(
    state,
    `${buyerName(state, order)} want ${units} inside ${window} days, at ${formatMoney(
      unitPrice,
    )} each.`,
    'neutral',
  );
  return order;
}

// ----------------------------------------------------------- saying yes ----

export function acceptOrder(state: GameState, id: Id): TradeAction {
  const order = orderList(state).find((o) => o.id === id);
  if (!order) return { ok: false, message: 'Nobody asked you for that.' };
  if (order.status !== 'offered') return { ok: false, message: 'That is not on the table.' };

  order.status = 'accepted';
  order.acceptedDay = state.day;
  /*
     Re-based off the day it was accepted rather than the day it was offered.

     An offer stands for ten days, so a player who sits on one for nine of them
     would otherwise be agreeing to a three-week job with twelve days left on
     it. The window is the window whenever you take it.
  */
  order.dueDay = state.day + (order.dueDay - order.offeredDay);
  addLog(
    state,
    `You have told ${buyerName(state, order)} they will have ${order.units} by then.`,
    'neutral',
  );
  return { ok: true, message: `Due on day ${order.dueDay}.` };
}

export function refuseOrder(state: GameState, id: Id): TradeAction {
  const order = orderList(state).find((o) => o.id === id);
  if (!order) return { ok: false, message: 'Nobody asked you for that.' };
  if (order.status !== 'offered') return { ok: false, message: 'That is not on the table.' };
  order.status = 'lapsed';
  order.settledDay = state.day;
  return { ok: true, message: 'You said no.' };
}

// ------------------------------------------------------------- the tick ----

function earn(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.org.dirtyCash += amount;
  note(state, 'trade', amount);
}

/**
 * What the buyer does with what they bought, per unit, as it arrives.
 *
 * Applied on delivery rather than on completion, so a half-filled order arms
 * somebody by half. The alternative — everything at the end — would let a
 * player deliver 90% of a crate order, fail it deliberately, and hand a rival
 * nothing at all.
 */
function consequence(state: GameState, order: Order, units: number): void {
  if (units <= 0) return;

  if (order.buyerKind === 'family') {
    const faction = state.factions[order.buyerId as FactionId];
    if (!faction) return;
    faction.wealth = Math.max(0, faction.wealth - units * order.unitPrice);
    faction.strength = clamp(faction.strength + units * ARMS_SALE.strengthPerCrate, 0, 100);
    const bond = faction.bonds.player;
    if (bond) {
      bond.trust = clamp(bond.trust + ARMS_SALE.trustPerSale, -100, 100);
      bond.respect = clamp(bond.respect + ARMS_SALE.respectPerSale, -100, 100);
    }
    return;
  }

  const gang = GANG_BY_ID[order.buyerId];
  if (!gang) return;
  const where = state.territories[gang.territoryId];
  if (where) {
    where.sentiment = clamp(where.sentiment + units * gang.sentimentPerUnit, 0, 100);
    where.influence.player = clamp(
      (where.influence.player ?? 0) + units * gang.influencePerUnit,
      0,
      100,
    );
  }
  addHeat(state, units * gang.heatPerUnit, 'street', gang.name);
}

/** Handing over what is on the shelf, against what is owed. */
function deliver(state: GameState, order: Order): void {
  const c = state.contraband;
  if (!c) return;
  const owed = order.units - order.delivered;
  const going = Math.min(owed, Math.floor(c.stock[order.trade]));
  if (going <= 0) return;

  c.stock[order.trade] -= going;
  order.delivered += going;
  const paid = going * order.unitPrice;
  earn(state, paid);
  c.lifetime[order.trade] += paid;
  consequence(state, order, going);

  if (order.delivered < order.units) return;

  /*
     Finished. The bonus is a straight line against how much of the window was
     left, so the first week of a six-week order is worth materially more than
     the last day of it. Without it every order is filled at the deadline and
     the deadline is the only number in the feature.
  */
  const window = Math.max(1, order.dueDay - (order.acceptedDay ?? order.offeredDay));
  const spare = clamp((order.dueDay - state.day) / window, 0, 1);
  const bonus = Math.round(orderValue(order) * ORDERS.earlyBonusShare * spare);
  earn(state, bonus);
  order.status = 'filled';
  order.settledDay = state.day;
  addLog(
    state,
    bonus > 0
      ? `${buyerName(state, order)} have it all, and early. ${formatMoney(paid + bonus)}.`
      : `${buyerName(state, order)} have it all. ${formatMoney(paid)}.`,
    'money',
  );
}

/** The day it was due, and it is not all there. */
function fail(state: GameState, order: Order): void {
  order.status = 'failed';
  order.settledDay = state.day;
  state.org.respect = Math.max(0, state.org.respect - ORDER_FAILURE.respect);

  if (order.buyerKind === 'family') {
    const bond = state.factions[order.buyerId as FactionId]?.bonds.player;
    if (bond) {
      bond.grudge = clamp(bond.grudge + ORDER_FAILURE.grudge, 0, 100);
      bond.trust = clamp(bond.trust - ORDER_FAILURE.trust, -100, 100);
    }
  } else {
    const gang = GANG_BY_ID[order.buyerId];
    const where = gang ? state.territories[gang.territoryId] : null;
    if (where) where.sentiment = clamp(where.sentiment - ORDER_FAILURE.sentiment, 0, 100);
  }

  addLog(
    state,
    `${buyerName(state, order)} did not get what you said they would. ${order.delivered} of ${
      order.units
    }.`,
    'failure',
  );
}

/**
 * Who might ask this week.
 *
 * A gang asks only where the player is actually standing — supplying somebody
 * else's corner in a neighbourhood you have never been to is not a decision
 * about anything. A family asks only when they are not at war, which
 * `offerOrder` enforces again on its own.
 */
function candidates(state: GameState): { kind: 'family' | 'gang'; id: string }[] {
  const out: { kind: 'family' | 'gang'; id: string }[] = [];

  /*
     Only people who could actually place an order.

     The first version listed every family at peace and let `offerOrder` refuse
     them, which read as harmless and was not: the weekly roll picks one name
     out of this list, so three families who cannot buy arms because the arms
     trade is not open crowd out the one gang who can buy product. Measured
     over 36 careers, the arms trade opened in **none** of them, and a bot with
     twenty candidate-weeks in the year saw a median of *zero* offers — the
     whole feature was gated behind a trade nobody in the sample reached, and
     the gate was invisible because the roll had happened and simply landed on
     nobody.
  */
  for (const id of RIVAL_IDS) {
    // Families buy crates. That is where the double edge is, and it is the
    // reason this extends `ARMS_SALE` rather than inventing a second market.
    if (!tradeUnlocked(state, 'arms')) break;
    if (!atWarWith(state, id)) out.push({ kind: 'family', id });
  }
  for (const gang of GANGS) {
    if (!tradeUnlocked(state, gang.wants)) continue;
    // Somebody else's corner in a district you have never been to is not a
    // decision about anything, and the consequence would land where you would
    // never notice it.
    const where = state.territories[gang.territoryId];
    if ((where?.influence.player ?? 0) > 0) out.push({ kind: 'gang', id: gang.id });
  }
  return out;
}

/**
 * The weekly roll, on a stream of its own.
 *
 * Everything else in the tick pipeline draws from `state.rng`, and that is
 * right for anything whose outcome the rest of the world reacts to. This one
 * deliberately does not, and the reason is measurement rather than taste.
 *
 * The stream is shared, ordered and load-bearing: every probe in this project
 * plays a fixed set of seeds, and several of its pre-committed bars sit within
 * a percentage point of their thresholds by design — a target is supposed to
 * be near what the game actually does. Adding one `rng.chance` a week to the
 * shared stream reshuffles all 144 careers, and four bars that were measuring
 * pacing quietly become bars measuring whether orders exist. Two of them moved
 * the first time this was wired up.
 *
 * DIRECTOR §5 forbids moving a threshold to make something pass. The honest
 * way to keep that rule is to not disturb what the thresholds are watching.
 * The generator is stateless given (seed, calls), so a derived stream is
 * exactly as deterministic and exactly as save-safe — both inputs are already
 * on disk — while leaving `state.rng.calls` untouched.
 *
 * The stride keeps one day's draws from overlapping the next day's stream,
 * which would correlate two rolls that have nothing to do with each other.
 */
function offerStream(state: GameState): Rng {
  return new Rng({ seed: (state.rng.seed ^ 0x0d3e15) >>> 0, calls: state.day * 8 });
}

/**
 * Daily, because a deadline is a day and not a week.
 *
 * Deliveries, lapses and settlements all run every day; only the asking is
 * weekly, because a screen with a new commitment on it every morning is a
 * chore rather than a decision.
 *
 * Runs after `tickContraband` in the pipeline, which is the order the
 * reservation depends on: the trade buys for the street *and* the order, the
 * street takes everything that is not reserved, and what is left on the shelf
 * is what this hands over.
 */
export function tickOrders(state: GameState): void {
  for (const order of orderList(state)) {
    if (order.status === 'offered' && state.day >= order.lapsesDay) {
      order.status = 'lapsed';
      order.settledDay = state.day;
      addLog(state, `${buyerName(state, order)} found somebody else.`, 'neutral');
      continue;
    }
    if (order.status !== 'accepted') continue;
    deliver(state, order);
    if (order.status === 'accepted' && state.day >= order.dueDay) fail(state, order);
  }

  if (state.day % PAYDAY_INTERVAL !== 0) return;
  if (liveOrders(state).length >= ORDERS.maxLive) return;

  // Who could ask, before whether anybody does. Rolling first and then finding
  // an empty list spends a draw on a decision with no options in it.
  const open = candidates(state);
  if (open.length === 0) return;

  const rng = offerStream(state);
  if (!rng.chance(ORDERS.offerChancePerWeek)) return;
  const pick = open[rng.int(0, open.length - 1)];
  offerOrder(state, rng, pick.kind, pick.id);
}

// -------------------------------------------------------------- readouts ---

export interface OrderRead {
  order: Order;
  buyer: string;
  blurb: string;
  value: number;
  daysLeft: number;
  /** What is on the shelf against what is still owed. */
  onHand: number;
  owed: number;
}

export function readOrders(state: GameState): OrderRead[] {
  return liveOrders(state).map((order) => ({
    order,
    buyer: buyerName(state, order),
    blurb:
      order.buyerKind === 'gang'
        ? (GANG_BY_ID[order.buyerId]?.blurb ?? '')
        : 'Another family, buying capability rather than goods. Every unit makes them harder to fight.',
    value: orderValue(order),
    daysLeft: daysLeft(state, order),
    onHand: Math.floor(state.contraband?.stock[order.trade] ?? 0),
    owed: Math.max(0, order.units - order.delivered),
  }));
}

/** What supplying a gang is doing to the neighbourhood, for the panel. */
export function gangCost(order: Order): string {
  const gang = GANG_BY_ID[order.buyerId];
  if (!gang) return '';
  const t = territoryDef(gang.territoryId);
  return `Every unit costs ${t.name} ${Math.abs(gang.sentimentPerUnit).toFixed(2)} of how it feels about you and ${Math.abs(gang.influencePerUnit).toFixed(2)} of how much of it is yours.`;
}
