/**
 * The two trades, as a supply chain rather than a button.
 *
 * An operation is a job: pay, wait, roll, collect. A trade is a standing thing
 * with four separate places it can go wrong — the source, the stock, the
 * streets and the people — and the reason it is worth building as its own
 * system is that all four compete with things the player already cares about.
 * Distribution needs the same crew operations need. Routes need the same
 * districts businesses need. Stock is the only asset in the game a warrant can
 * physically take. And the product trade buys its margin directly out of how
 * the neighbourhood feels about you.
 *
 * Import discipline: this module deliberately does not import `economy.ts` or
 * `diplomacy.ts`, both of which reach `investigation.ts` — and investigation
 * imports *this*, to take your stock when a warrant lands. The two money
 * helpers and the one war check below are inlined for that reason, the same
 * trade diplomacy.ts already makes for its faction accessors.
 */

import { Rng, clamp } from './rng';
import type { Contraband, GameState, Territory } from './types';
import { addEvidence, addLog, formatMoney } from './util';
import { addHeat } from './heat';
import { crewList } from './npc';
import { controlLevel, people, prosperity, territoryDef, territoryList } from './territory';
import { activity, priced } from './market';
import { holdingShare } from './holdings';
import {
  ARMS_SALE,
  CONTROL_THROUGHPUT,
  PLANT,
  PORT,
  SEIZURE,
  ARMED,
  ARMS_SUPPLIERS,
  ARMS_SUPPLIER_BY_ID,
  type SupplierDef,
  SUPPLIERS,
  SUPPLIER_BY_ID,
  SUPPLY_TRUST,
  TRADES,
  TRADE_IDS,
  TRADE_SENTIMENT_FLOOR,
  UNITS_PER_CREW,
  WORKSHOP,
  type TradeId,
} from '../config/contraband';
import { ownedBusinesses } from './business';
import { PAYDAY_INTERVAL } from '../config/economy';
import {
  CONTROL_LABEL,
  CONTROL_THRESHOLDS,
  SENTIMENT_START,
  type ControlLevel,
} from '../config/territories';
import { RIVAL_IDS, type FactionId } from '../config/factions';
import { houseShort } from './houses';
import { note } from './ledger';
import type { LedgerKey } from '../config/ledger';
import { shakeLaundererTrust } from './launderers';

export function newContraband(): Contraband {
  return {
    stock: { product: 0, arms: 0 },
    supplierId: null,
    supplierSince: 0,
    workshops: [],
    routes: { product: [], arms: [] },
    lastRun: null,
    lifetime: { product: 0, arms: 0 },
  };
}

// -------------------------------------------------------- money, locally ---

/** Local copy of economy.ts:totalFunds. See the import note at the top. */
function funds(state: GameState): number {
  return state.org.cash + state.org.dirtyCash;
}

/**
 * Local copy of economy.ts:spend. See the import note at the top.
 *
 * `key` is the ledger row it lands on. Defaulted rather than required because
 * every caller here is spending on the trade one way or another, and a wrong
 * label is worse than a coarse one.
 */
function pay(state: GameState, amount: number, key: LedgerKey = 'stock'): boolean {
  if (amount <= 0) return true;
  if (state.org.cash + state.org.dirtyCash < amount) return false;
  const fromDirty = Math.min(state.org.dirtyCash, amount);
  state.org.dirtyCash -= fromDirty;
  state.org.cash -= amount - fromDirty;
  note(state, key, -amount);
  return true;
}

function earn(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.org.dirtyCash += amount;
  note(state, 'trade', amount);
}

/** Local copy of diplomacy.ts:atWar. See the import note at the top. */
function atWarWith(state: GameState, id: FactionId): boolean {
  return state.factions[id]?.bonds?.player?.warSince != null;
}

function standingWith(state: GameState, id: FactionId): number {
  const b = state.factions[id]?.bonds?.player;
  if (!b) return 0;
  return b.trust - b.grudge;
}

/**
 * Units already promised to somebody, by trade.
 *
 * Lives here rather than in `orders.ts` for the same reason the two money
 * helpers at the top of this file do: `orders.ts` reads this module and this
 * module must not read it back. It is one filter over an optional list, and
 * an absent list — every save written before orders existed — reads as zero,
 * which leaves the trade behaving exactly as it always did.
 *
 * Two places care. Buying adds it to the target, because stock for an order is
 * stock the streets were never going to absorb. Distribution subtracts it,
 * because the whole point of a commitment is that it is not for sale to
 * anybody else.
 */
export function reservedUnits(state: GameState, trade: TradeId): number {
  return (state.orders ?? []).reduce(
    (sum, o) =>
      o.status === 'accepted' && o.trade === trade
        ? sum + Math.max(0, o.units - o.delivered)
        : sum,
    0,
  );
}

// ------------------------------------------------------------- the trade ---

/**
 * Why a trade will not open, in words the player can act on.
 *
 * Both refusals said `Nobody will deal with a ${rank}` and stopped, naming a
 * title that no longer appears anywhere in the game and giving no figure, no
 * bar and no remedy. See `canAcquire` for the same repair on the front gate.
 */
function needsFronts(state: GameState, trade: TradeId): string {
  const have = ownedBusinesses(state).length;
  const want = TRADES[trade].minFronts;
  return (
    `Nobody deals with somebody who has nowhere to put it. You run ` +
    `${have} ${have === 1 ? 'front' : 'fronts'} and this wants ${want}. ` +
    `Take a district and buy premises in it.`
  );
}

export function tradeUnlocked(state: GameState, trade: TradeId): boolean {
  return ownedBusinesses(state).length >= TRADES[trade].minFronts;
}

function meetsControl(level: ControlLevel, required: ControlLevel): boolean {
  const order = CONTROL_THRESHOLDS.map((t) => t.level).reverse();
  return order.indexOf(level) >= order.indexOf(required);
}

/** Districts that could carry this trade, whether or not they currently do. */
function eligibleDistricts(state: GameState, trade: TradeId): Territory[] {
  return territoryList(state).filter((t) =>
    meetsControl(controlLevel(t), TRADES[trade].minControl),
  );
}

/**
 * What one district will absorb in a week.
 *
 * Population is most of it for product and wealth is most of it for arms,
 * which is the whole difference between selling something to everybody and
 * selling something to somebody.
 */
/**
 * Both terms are the district's *live* figures, which is what closes the loop
 * on the trade: running product somewhere lowers its prosperity, and lower
 * prosperity means it will carry less next year. The trade eats its own ground.
 */
export function districtCapacity(state: GameState, trade: TradeId, t: Territory): number {
  const def = TRADES[trade];
  const through = CONTROL_THROUGHPUT[controlLevel(t)];
  if (through <= 0) return 0;

  const wealth = (prosperity(state, t.id) / 100) * def.wealthWeight;
  // Normalised against the largest district on the board so the weights mean
  // what they say rather than depending on the population numbers' scale.
  const folk = (people(state, t.id) / 62_000) * def.populationWeight;

  return def.districtCapacity * (wealth + folk) * through;
}

export interface Throughput {
  /** What the open routes could carry. */
  routes: number;
  /** What the available people could actually move. */
  crew: number;
  /** The smaller of the two, which is what happens. */
  total: number;
}

/**
 * How much can move this week.
 *
 * Two ceilings, and which one is binding is the decision the player is
 * actually making: ground without people is a network nobody is running, and
 * people without ground is a crew standing about. It is deliberately the same
 * crew operations want.
 */
export function throughput(state: GameState, trade: TradeId): Throughput {
  const routes = (state.contraband?.routes[trade] ?? [])
    .map((id) => state.territories[id])
    .filter(Boolean)
    .reduce((sum, t) => sum + districtCapacity(state, trade, t), 0);

  const available = crewList(state).filter((n) => n.status === 'active').length;
  const crew = available * UNITS_PER_CREW;

  return { routes, crew, total: Math.min(routes, crew) };
}

// ------------------------------------------------------------ the source ---

/** Whoever holds the waterfront decides what the water costs. */
export function portHolder(state: GameState): FactionId | null {
  const docks = state.territories['the_docks'];
  if (!docks) return null;
  if (controlLevel(docks) === 'control' || controlLevel(docks) === 'dominance') {
    return 'player';
  }
  let best: FactionId | null = null;
  let bestValue = 30;
  for (const id of RIVAL_IDS) {
    const value = docks.influence[id] ?? 0;
    if (value > bestValue) {
      best = id;
      bestValue = value;
    }
  }
  return best;
}

/**
 * What a unit costs to obtain right now.
 *
 * For product this is the supplier's price, moved by who controls the water it
 * comes in on — the first thing in this game where a diplomatic position has a
 * number attached to it. For arms it is materials and wages, which nobody else
 * has an opinion about.
 */
/**
 * What a unit fetches this year.
 *
 * Value moves with prices and with the cycle; cost moves only with prices. The
 * gap is deliberate — a trade is worth materially more in a boom and materially
 * less at the bottom, which is the only reason to time one.
 */
export function unitValue(state: GameState, trade: TradeId): number {
  /*
     Whoever holds the water decides what the city pays for it.

     The docks and the rail yards are where everything entering the city is
     handled, so holding them moves both ends of the trade — you sell for more
     here and buy for less in `unitCost`. See `config/holdings.ts`.
  */
  const grip = 1 + holdingShare(state, 'trade');
  return Math.round(priced(state, TRADES[trade].unitValue) * activity(state) * grip);
}

/** What an arrangement thinks of you, 0..100. Zero for one you have not kept. */
export function supplierTrust(state: GameState, supplierId: string): number {
  return state.contraband?.supplierTrust?.[supplierId] ?? 0;
}

/**
 * The chance this arrangement simply stops, this week.
 *
 * Trust only ever reduces it. At nothing the figure is exactly the config's
 * own `failureChancePerWeek`, which is what every career sees today and what
 * makes this change unable to move a probe — the bot runs pegged at heat 100
 * and earns none. At full trust it is a fifth of that.
 */
export function walkChance(state: GameState, supplier: SupplierDef): number {
  const trust = clamp(supplierTrust(state, supplier.id), 0, 100);
  return supplier.failureChancePerWeek * (1 - (trust / 100) * SUPPLY_TRUST.maxReduction);
}

/**
 * A week of dealing, and what it does to the relationship.
 *
 * Drifts toward a target rather than adding, which is the idiom `tickCivic`
 * already uses for the other standing in this game. The target is how long you
 * have kept them, gated on how much attention you are drawing: at or above
 * `heatCeiling` it is nothing, so a loud career never gets the discount
 * however long it has been buying.
 */
function tickSupplierTrust(state: GameState, supplierId: string, sinceDay: number): void {
  const c = state.contraband;
  if (!c) return;
  if (!c.supplierTrust) c.supplierTrust = {};

  const weeks = Math.max(0, (state.day - sinceDay) / 7);
  const kept = Math.min(1, weeks / SUPPLY_TRUST.weeksToFull);
  const quiet = clamp(1 - state.org.heat / SUPPLY_TRUST.heatCeiling, 0, 1);
  const target = 100 * kept * quiet;

  const now = c.supplierTrust[supplierId] ?? 0;
  const step = Math.sign(target - now) * Math.min(SUPPLY_TRUST.driftPerWeek, Math.abs(target - now));
  c.supplierTrust[supplierId] = clamp(now + step, 0, 100);
}

/** A raid makes them nervous, whatever the relationship was. */
export function shakeSupplierTrust(state: GameState): void {
  const c = state.contraband;
  if (!c?.supplierTrust) return;
  for (const id of Object.keys(c.supplierTrust)) {
    c.supplierTrust[id] = clamp(c.supplierTrust[id] - SUPPLY_TRUST.seizureCost, 0, 100);
  }
}

/** The arms arrangement, or null. Separate from the product one entirely. */
export function armsSupplier(state: GameState): SupplierDef | null {
  const id = state.contraband?.armsSupplierId;
  return id ? (ARMS_SUPPLIER_BY_ID[id] ?? null) : null;
}

export function unitCost(state: GameState, trade: TradeId): number {
  const def = TRADES[trade];
  // And the other end of the same grip — see `unitValue`.
  const grip = 1 - holdingShare(state, 'trade');
  if (trade === 'arms') {
    /*
       Bought crates cost more than made ones, always. `priceMultiplier` is
       above 1 on every arms source for exactly that reason — a cheaper door
       that also had the better margin would retire the workshop, and the
       capital half of this trade is where its drama lives.
    */
    const bought = armsSupplier(state);
    return Math.round(priced(state, def.unitCost) * (bought ? bought.priceMultiplier : 1) * grip);
  }

  /*
     The cheapest place it can come from, which is what a player is actually
     paying. `productSources` orders them, so a plant beside an arrangement
     reads as the plant's price — and `tickContraband` fills from the same list
     in the same order, so the figure on the panel is the figure being paid.
  */
  const sources = productSources(state);
  return Math.round((sources[0]?.price ?? priced(state, def.unitCost)) * grip);
}

/** What the waterfront arrangement costs, before and after who holds the water. */
function supplierPrice(state: GameState, supplier: SupplierDef): number {
  let price = priced(state, TRADES.product.unitCost) * supplier.priceMultiplier;
  if (supplier.id === PORT.supplierId) price *= portMultiplier(state);
  return Math.round(price);
}

/**
 * Every place product can come from this week, cheapest first.
 *
 * Two kinds, and the whole design of the plant is in the fact that they are
 * both on this list rather than one replacing the other. A plant is cheap and
 * small; an arrangement is dear and large. A family that has built one and
 * kept the other fills its base load from the building and its peaks from the
 * relationship, which is the shape the fork was drawn for.
 */
export interface ProductSource {
  kind: 'plant' | 'supplier';
  /** What one unit costs from here, right now. */
  price: number;
  /** Units a week this source can actually cover. */
  ceiling: number;
}

export function productSources(state: GameState): ProductSource[] {
  const sources: ProductSource[] = [];

  const plants = state.contraband?.plants?.length ?? 0;
  if (plants > 0) {
    sources.push({
      kind: 'plant',
      price: Math.round(priced(state, TRADES.product.unitCost) * PLANT.unitCostShare),
      ceiling: plants * PLANT.supplyPerWeek,
    });
  }

  const supplier = state.contraband?.supplierId
    ? SUPPLIER_BY_ID[state.contraband.supplierId]
    : null;
  if (supplier) {
    sources.push({
      kind: 'supplier',
      price: supplierPrice(state, supplier),
      ceiling: supplier.ceiling,
    });
  }

  return sources.sort((a, b) => a.price - b.price);
}

export interface TradeAction {
  ok: boolean;
  message: string;
}

/**
 * Whether an arrangement can be opened, and why not.
 *
 * Split out of openSupply so the panel can disable the button and say what is
 * missing, the way canBuildWorkshop and canSellArms already do. Without it the
 * button looked live, took the click, failed on the retainer and said nothing —
 * which reads as a broken button rather than as being too poor.
 */
export function canOpenSupply(state: GameState, supplierId: string): TradeAction {
  const supplier = SUPPLIER_BY_ID[supplierId];
  if (!supplier) return { ok: false, message: 'No such arrangement.' };
  if (!tradeUnlocked(state, 'product')) {
    return {
      ok: false,
      message: needsFronts(state, 'product'),
    };
  }
  const retainer = priced(state, supplier.retainer);
  if (funds(state) < retainer) {
    return {
      ok: false,
      // Both through formatMoney, which rounds. Round 11 read
      // "you have $19,215.862" — `funds` returns a float and only the retainer
      // side had ever been formatted.
      message: `The retainer is ${formatMoney(retainer)} and you have ${formatMoney(funds(state))}.`,
    };
  }
  return { ok: true, message: `$${retainer.toLocaleString('en-US')} to open.` };
}

export function openSupply(state: GameState, supplierId: string): TradeAction {
  const check = canOpenSupply(state, supplierId);
  if (!check.ok) return check;
  const supplier = SUPPLIER_BY_ID[supplierId]!;
  if (!pay(state, priced(state, supplier.retainer), 'premises')) {
    return { ok: false, message: 'You cannot cover the retainer.' };
  }

  state.contraband.supplierId = supplierId;
  state.contraband.supplierSince = state.day;
  // From nothing. The thing being rewarded is having kept them, so walking out
  // and back in does not restore what you had.
  if (!state.contraband.supplierTrust) state.contraband.supplierTrust = {};
  state.contraband.supplierTrust[supplierId] = 0;
  addLog(state, `${supplier.name} will deal with you now.`, 'money');
  return { ok: true, message: supplier.name };
}

/**
 * Whether a source of finished crates can be opened, and why not.
 *
 * Same shape as `canOpenSupply` and deliberately so: same rank gate the trade
 * itself carries, same named price on refusal. F10 closed by naming the
 * figure, the bar and the remedy at the point of refusal, and every gate added
 * since has had to do the same.
 */
export function canOpenArmsSupply(state: GameState, supplierId: string): TradeAction {
  const supplier = ARMS_SUPPLIER_BY_ID[supplierId];
  if (!supplier) return { ok: false, message: 'No such arrangement.' };
  if (!tradeUnlocked(state, 'arms')) {
    return {
      ok: false,
      message: needsFronts(state, 'arms'),
    };
  }
  const retainer = priced(state, supplier.retainer);
  if (funds(state) < retainer) {
    return {
      ok: false,
      message: `The retainer is ${formatMoney(retainer)} and you have ${formatMoney(funds(state))}.`,
    };
  }
  return { ok: true, message: `$${retainer.toLocaleString('en-US')} to open.` };
}

export function openArmsSupply(state: GameState, supplierId: string): TradeAction {
  const check = canOpenArmsSupply(state, supplierId);
  if (!check.ok) return check;
  const supplier = ARMS_SUPPLIER_BY_ID[supplierId]!;
  if (!pay(state, priced(state, supplier.retainer), 'premises')) {
    return { ok: false, message: 'You cannot cover the retainer.' };
  }
  state.contraband.armsSupplierId = supplierId;
  state.contraband.armsSupplierSince = state.day;
  if (!state.contraband.supplierTrust) state.contraband.supplierTrust = {};
  state.contraband.supplierTrust[supplierId] = 0;
  addLog(state, `${supplier.name} will deal with you now.`, 'money');
  return { ok: true, message: supplier.name };
}

export function dropArmsSupply(state: GameState): TradeAction {
  const held = armsSupplier(state);
  if (!held) return { ok: false, message: 'There is no arrangement to end.' };
  state.contraband.armsSupplierId = null;
  addLog(state, `You are no longer buying from ${held.name}.`, 'neutral');
  return { ok: true, message: held.name };
}

export function dropSupply(state: GameState): TradeAction {
  if (!state.contraband.supplierId) return { ok: false, message: 'You have no arrangement.' };
  state.contraband.supplierId = null;
  addLog(state, 'That arrangement is finished. Nobody was unpleasant about it.', 'neutral');
  return { ok: true, message: 'Ended.' };
}

// --------------------------------------------------------- the workshops ---

export function canBuildWorkshop(state: GameState, territoryId: string): TradeAction {
  if (!tradeUnlocked(state, 'arms')) {
    return { ok: false, message: needsFronts(state, 'arms') };
  }
  const t = state.territories[territoryId];
  if (!t) return { ok: false, message: 'No such district.' };
  if (!meetsControl(controlLevel(t), WORKSHOP.minControl)) {
    return { ok: false, message: `You would need control of ${territoryDef(territoryId).name}.` };
  }
  if (state.contraband.workshops.length >= WORKSHOP.max) {
    return {
      ok: false,
      message: `You already run ${state.contraband.workshops.length}. ${WORKSHOP.max} is the most anybody can keep quiet.`,
    };
  }
  if (state.org.cash + state.org.dirtyCash < priced(state, WORKSHOP.cost)) {
    return {
      ok: false,
      message: `A shop costs ${formatMoney(priced(state, WORKSHOP.cost))} and you hold ${formatMoney(
        funds(state),
      )}.`,
    };
  }
  return { ok: true, message: `Open a shop in ${territoryDef(territoryId).name}` };
}

export function buildWorkshop(state: GameState, territoryId: string): TradeAction {
  const check = canBuildWorkshop(state, territoryId);
  if (!check.ok) return check;
  if (!pay(state, priced(state, WORKSHOP.cost), 'premises')) return { ok: false, message: 'You cannot cover it.' };

  state.contraband.workshops.push({ territoryId, since: state.day });
  addLog(
    state,
    `There is a machine shop in ${territoryDef(territoryId).name} now, and it has a lease and a sign.`,
    'money',
  );
  return { ok: true, message: 'Open.' };
}

// ------------------------------------------------------------- the plants --

/**
 * Your own supply, lazily.
 *
 * Optional state with a lazy initialiser, the same idiom `promises` and
 * `civic` use — so `SAVE_VERSION` does not move and a save written before this
 * existed loads with an empty list, which for those saves is exactly true.
 */
export function plantList(state: GameState): { territoryId: string; since: number }[] {
  const c = state.contraband;
  if (!c.plants) c.plants = [];
  return c.plants;
}

export function canBuildPlant(state: GameState, territoryId: string): TradeAction {
  if (!tradeUnlocked(state, 'product')) {
    return { ok: false, message: needsFronts(state, 'product') };
  }
  const t = state.territories[territoryId];
  if (!t) return { ok: false, message: 'No such district.' };
  if (!meetsControl(controlLevel(t), PLANT.minControl)) {
    return {
      ok: false,
      message: `You would need control of ${territoryDef(territoryId).name}. A foothold is not somewhere to put this.`,
    };
  }
  if (plantList(state).length >= PLANT.max) {
    return {
      ok: false,
      message: `You already run ${plantList(state).length}. ${PLANT.max} is the most anybody can keep quiet.`,
    };
  }
  const cost = priced(state, PLANT.cost);
  if (funds(state) < cost) {
    return {
      ok: false,
      message: `That costs ${formatMoney(cost)} and you hold ${formatMoney(funds(state))}.`,
    };
  }
  return { ok: true, message: `Open one in ${territoryDef(territoryId).name}` };
}

export function buildPlant(state: GameState, territoryId: string): TradeAction {
  const check = canBuildPlant(state, territoryId);
  if (!check.ok) return check;
  if (!pay(state, priced(state, PLANT.cost), 'premises')) return { ok: false, message: 'You cannot cover it.' };

  plantList(state).push({ territoryId, since: state.day });
  addLog(
    state,
    `You do not have to ask anybody for it any more, at least not in ${territoryDef(territoryId).name}.`,
    'money',
  );
  return { ok: true, message: 'Open.' };
}

// ------------------------------------------------------------- the routes --

export function openRoute(state: GameState, trade: TradeId, territoryId: string): TradeAction {
  const t = state.territories[territoryId];
  if (!t) return { ok: false, message: 'No such district.' };
  if (!meetsControl(controlLevel(t), TRADES[trade].minControl)) {
    return {
      ok: false,
      message: `You do not hold enough of ${territoryDef(territoryId).name}.`,
    };
  }
  const routes = state.contraband.routes[trade];
  if (routes.includes(territoryId)) return { ok: false, message: 'Already running there.' };

  routes.push(territoryId);
  addLog(
    state,
    `${TRADES[trade].name} is running through ${territoryDef(territoryId).name} now.`,
    'neutral',
  );
  return { ok: true, message: 'Open.' };
}

export function closeRoute(state: GameState, trade: TradeId, territoryId: string): TradeAction {
  const routes = state.contraband.routes[trade];
  const index = routes.indexOf(territoryId);
  if (index === -1) return { ok: false, message: 'Nothing running there.' };
  routes.splice(index, 1);
  return { ok: true, message: 'Closed.' };
}

// ------------------------------------------------------------------ tick ---

/**
 * Weekly. Acquire, lose some, move what the streets and the people allow, and
 * pay for all of it in the three currencies this game charges in.
 *
 * Runs before the fronts, so what a trade earns this week can be washed this
 * week — which is the join between the two halves of the economy and the
 * reason the laundering system finally has something to strain against.
 */
export function tickContraband(state: GameState, rng: Rng): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;
  const c = state.contraband;
  if (!c) return;

  const report: Contraband['lastRun'] = {
    product: { moved: 0, earned: 0, bought: 0, seized: 0 },
    arms: { moved: 0, earned: 0, bought: 0, seized: 0 },
  };

  // --- the source ---------------------------------------------------------
  if (c.supplierId) {
    const supplier = SUPPLIER_BY_ID[c.supplierId];
    if (supplier) tickSupplierTrust(state, supplier.id, c.supplierSince);
    if (supplier && rng.chance(walkChance(state, supplier))) {
      c.supplierId = null;
      addLog(
        state,
        `${supplier.name} has stopped. No explanation, and asking for one would be a mistake.`,
        'failure',
      );
    }
  }

  /*
     Filled cheapest first, across however many sources there are.

     This used to be one arrangement and one price. A plant is a second source
     rather than a replacement for the first, so the buy has to walk a list —
     the building covers its ceiling at its price and the arrangement covers
     whatever is left at its own. A family with both fills its base load from
     the plant and its peaks from the relationship, which is the whole reason
     the fork is worth having.
  */
  if (tradeUnlocked(state, 'product')) {
    // Buy what the streets can shift, not what the sources can deliver. A
    // warehouse of stock is a warehouse of evidence — plus anything already
    // promised to somebody, which is stock that is not for the street at all.
    let want = Math.min(
      Math.max(
        0,
        Math.ceil(throughput(state, 'product').total + reservedUnits(state, 'product')) -
          c.stock.product,
      ),
      TRADES.product.stockCap - c.stock.product,
    );
    for (const source of productSources(state)) {
      if (want <= 0) break;
      const affordable = Math.floor((state.org.cash + state.org.dirtyCash) / source.price);
      const bought = Math.max(0, Math.min(want, source.ceiling, affordable));
      if (bought > 0 && pay(state, bought * source.price)) {
        c.stock.product += bought;
        report.product.bought += bought;
        want -= bought;
      }
    }
  }

  if (c.supplierId && tradeUnlocked(state, 'product')) {
    const supplier = SUPPLIER_BY_ID[c.supplierId];
    if (supplier.exposure > 0) {
      addEvidence(state, {
        day: state.day,
        source: 'operation',
        strength: supplier.exposure,
        npcIds: [],
        detail: 'Regular deliveries arriving on a schedule somebody has noticed.',
      });
    }
  }

  // --- the plants ---------------------------------------------------------
  /*
     A plant costs the same money whether or not a single unit moved, and it is
     the loudest thing in the trade. That is the price of an arrangement nobody
     can walk out of: the exposure above stops when the deliveries stop, and a
     building's does not.

     Nothing is produced here. The plant's only effect on the shelf is the
     price it put on the units bought above.
  */
  const plants = c.plants ?? [];
  if (plants.length > 0) {
    if (pay(state, plants.length * priced(state, PLANT.upkeep), 'premises')) {
      addEvidence(state, {
        day: state.day,
        source: 'operation',
        strength: plants.length * PLANT.exposure,
        npcIds: [],
        detail: 'Premises with a lease, a meter reading and no customers anybody can name.',
      });
    } else {
      addLog(state, 'You could not pay for your own premises this week.', 'failure');
    }
  }

  // --- bought crates ------------------------------------------------------
  /*
     The second door into the arms trade, and it delivers the same way the
     product arrangement does: buy up to what the routes can carry, capped by
     what the source can actually supply and what you can pay for.

     Deliberately beside the workshops rather than instead of them. Both can
     run at once — a career that buys its way in and later builds a shop keeps
     the source until it stops being worth the price, which is the shape of
     every other supply decision in this file.
  */
  const armsSource = armsSupplier(state);
  if (armsSource && tradeUnlocked(state, 'arms')) {
    const price = unitCost(state, 'arms');
    const want = Math.min(
      armsSource.ceiling,
      Math.max(
        0,
        Math.ceil(throughput(state, 'arms').total + reservedUnits(state, 'arms')) - c.stock.arms,
      ),
      TRADES.arms.stockCap - c.stock.arms,
    );
    const affordable = Math.floor((state.org.cash + state.org.dirtyCash) / price);
    const bought = Math.max(0, Math.min(want, affordable));
    if (bought > 0 && pay(state, bought * price)) {
      c.stock.arms += bought;
      report.arms.bought += bought;
    }
    if (armsSource.exposure > 0) {
      addEvidence(state, {
        day: state.day,
        source: 'violence',
        strength: armsSource.exposure,
        npcIds: [],
        detail: 'Crates arriving from outside the city, on somebody else’s manifest.',
      });
    }
    // The arrangement can simply stop, the same way the product one can — and
    // it is held off by the same relationship.
    tickSupplierTrust(state, armsSource.id, c.armsSupplierSince ?? state.day);
    if (rng.chance(walkChance(state, armsSource))) {
      c.armsSupplierId = null;
      addLog(state, `${armsSource.name} has stopped taking your calls.`, 'failure');
    }
  }

  // --- the workshops ------------------------------------------------------
  if (c.workshops.length > 0) {
    const upkeep = c.workshops.length * priced(state, WORKSHOP.upkeep);
    if (pay(state, upkeep, 'premises')) {
      const materials = WORKSHOP.outputPerWeek * unitCost(state, 'arms');
      for (const shop of c.workshops) {
        if (c.stock.arms >= TRADES.arms.stockCap) break;
        if (!pay(state, materials)) break;
        c.stock.arms = Math.min(TRADES.arms.stockCap, c.stock.arms + WORKSHOP.outputPerWeek);
        report.arms.bought += WORKSHOP.outputPerWeek;
        void shop;
      }
      addEvidence(state, {
        day: state.day,
        source: 'violence',
        strength: c.workshops.length * WORKSHOP.exposure,
        npcIds: [],
        detail: 'A workshop with a lease, a sign, and deliveries nobody can account for.',
      });
    } else {
      addLog(state, 'The shops did not run this week. You could not pay for them.', 'failure');
    }
  }

  // --- distribution -------------------------------------------------------
  for (const trade of TRADE_IDS) {
    const def = TRADES[trade];
    if (c.stock[trade] <= 0) continue;

    // Wastage first. Some of it never reaches anybody.
    const lost = c.stock[trade] * def.wastagePerWeek;
    c.stock[trade] = Math.max(0, c.stock[trade] - lost);

    const routes = c.routes[trade].map((id) => state.territories[id]).filter(Boolean);
    if (routes.length === 0) continue;

    const capacity = throughput(state, trade);
    // Stock somebody is already owed is not on the street this week, however
    // much room the street has. A commitment that the distribution loop can
    // quietly sell out from under it is not a commitment.
    const sellable = Math.max(0, c.stock[trade] - reservedUnits(state, trade));
    let remaining = Math.min(sellable, capacity.total);
    if (remaining <= 0) continue;

    let earned = 0;
    let moved = 0;

    // Spread across the open routes in proportion to what each can take.
    const shares = routes.map((t) => districtCapacity(state, trade, t));
    const totalShare = shares.reduce((sum, v) => sum + v, 0);
    if (totalShare <= 0) continue;

    routes.forEach((t, i) => {
      const here = Math.min(remaining, (shares[i] / totalShare) * capacity.total);
      if (here <= 0) return;
      remaining -= here;
      moved += here;

      earned += here * unitValue(state, trade) * (0.7 + (prosperity(state, t.id) / 100) * 0.6);

      /*
         What it costs the street. This is the whole reason product is not
         simply the best thing in the game.

         Scaled by the room left above `TRADE_SENTIMENT_FLOOR`, so the drain
         weakens as a district sours and the street finds an equilibrium
         against the weekly recovery instead of racing it to zero. See the note
         on the constant for why a flat figure could not work here in either
         direction.
      */
      const room = clamp(
        (t.sentiment - TRADE_SENTIMENT_FLOOR) / (SENTIMENT_START - TRADE_SENTIMENT_FLOOR),
        0,
        1,
      );
      t.sentiment = clamp(t.sentiment + here * def.sentimentPerUnit * room, 0, 100);
    });

    c.stock[trade] -= moved;
    earn(state, Math.round(earned));
    addHeat(state, moved * def.heatPerUnit, 'street', def.name);
    addEvidence(state, {
      day: state.day,
      source: def.evidence,
      strength: moved * def.evidencePerUnit,
      npcIds: [],
      detail: `${def.name} running through ${routes.length} ${
        routes.length === 1 ? 'district' : 'districts'
      }.`,
    });

    c.lifetime[trade] += Math.round(earned);
    report[trade].moved = Math.round(moved);
    report[trade].earned = Math.round(earned);
  }

  c.lastRun = report;

  const total = report.product.earned + report.arms.earned;
  if (total > 0) {
    addLog(
      state,
      `The trade brought in $${total.toLocaleString('en-US')} this week.`,
      'money',
    );
  }
}

// ------------------------------------------------------- selling to them ---

export function armsSaleValue(state: GameState, crates: number): number {
  void state;
  return Math.round(crates * unitValue(state, 'arms') * ARMS_SALE.priceMultiplier);
}

export function canSellArms(state: GameState, target: FactionId, crates: number): TradeAction {
  const faction = state.factions[target];
  if (!faction) return { ok: false, message: 'No such organization.' };
  if (crates < ARMS_SALE.minCrates) {
    return { ok: false, message: `They would not cross the street for fewer than ${ARMS_SALE.minCrates}.` };
  }
  if ((state.contraband?.stock.arms ?? 0) < crates) {
    return { ok: false, message: 'You do not have that many.' };
  }
  if (ARMS_SALE.requiresPeace && atWarWith(state, target)) {
    return { ok: false, message: 'You are at war with them. Obviously not.' };
  }
  if (faction.wealth < armsSaleValue(state, crates)) {
    return { ok: false, message: 'They cannot cover it.' };
  }
  return { ok: true, message: `Sell ${crates} to the ${houseShort(state, target)}` };
}

/**
 * Arming somebody else.
 *
 * The most double-edged thing in the game. They pay well above street value
 * because they are buying capability rather than goods, and what they do with
 * it is become measurably harder to fight. Nothing warns the player; the
 * strength figure on the Rivals panel simply goes up, and in eighteen months
 * it is pointed at them.
 */
export function sellArms(
  state: GameState,
  target: FactionId,
  crates: number,
): TradeAction {
  const check = canSellArms(state, target, crates);
  if (!check.ok) return check;

  const faction = state.factions[target];
  const value = armsSaleValue(state, crates);

  state.contraband.stock.arms -= crates;
  faction.wealth -= value;
  earn(state, value);
  state.contraband.lifetime.arms += value;

  faction.strength = clamp(faction.strength + crates * ARMS_SALE.strengthPerCrate, 0, 100);

  const bond = faction.bonds.player;
  if (bond) {
    bond.trust = clamp(bond.trust + ARMS_SALE.trustPerSale, -100, 100);
    bond.respect = clamp(bond.respect + ARMS_SALE.respectPerSale, -100, 100);
  }

  addEvidence(state, {
    day: state.day,
    source: 'violence',
    strength: ARMS_SALE.evidence,
    npcIds: [],
    detail: `Crates traceable to your shop turning up in ${houseShort(state, target)} hands.`,
  });

  addLog(
    state,
    `You sold ${crates} to the ${houseShort(state, target)} for $${value.toLocaleString(
      'en-US',
    )}. They are stronger than they were this morning.`,
    'money',
  );
  return { ok: true, message: `$${value.toLocaleString('en-US')}.` };
}

// ------------------------------------------------------------- seizure ----

/**
 * What a warrant takes, beyond the money.
 *
 * Stock is the only asset in this game that physically exists somewhere, and
 * this is the consequence of that: a raid does not merely cost you cash, it
 * costs you the thing you had already paid for and not yet sold.
 */
export function seizeStock(state: GameState, rng: Rng, agency: string): void {
  const c = state.contraband;
  if (!c) return;

  let took = 0;
  for (const trade of TRADE_IDS) {
    if (c.stock[trade] <= 0) continue;
    const share = rng.float(SEIZURE.stockShare[0], SEIZURE.stockShare[1]);
    const seized = c.stock[trade] * share;
    c.stock[trade] -= seized;
    took += seized;
    if (c.lastRun) c.lastRun[trade].seized = Math.round(seized);
  }

  if (took > 0) {
    addEvidence(state, {
      day: state.day,
      source: 'operation',
      strength: SEIZURE.evidence,
      npcIds: [],
      detail: `${agency} recovered goods from premises connected to the organization.`,
    });
    addLog(state, `${agency} took what was in the building. All of it was yours.`, 'failure');

    /*
       And the people who sold it to you read the same newspaper.

       A customer whose stock keeps being carried out of a building is a
       liability rather than a good account, so a raid costs the relationship
       whatever it had built. This is where the trust discount is actually lost
       in play — heat holds it at nothing while you are hot, and a raid takes
       back what a quiet year earned.
    */
    shakeSupplierTrust(state);
    // And whoever signs the accounts reads the same newspaper. See
    // `shakeLaundererTrust` — the discount is bought with quiet, and this is
    // where a quiet year is taken back.
    shakeLaundererTrust(state);
  }

  if (c.workshops.length > 0 && rng.chance(SEIZURE.workshopChance)) {
    const shop = c.workshops.pop()!;
    state.org.cash += Math.round(priced(state, WORKSHOP.cost) * WORKSHOP.raidRefundShare);
    addLog(
      state,
      `The shop in ${territoryDef(shop.territoryId).name} is gone. They took the machines and the paperwork.`,
      'failure',
    );
  }

  /*
     And the other kind of building.

     A plant buys its way out of ever being walked out on by a supplier, and
     this is what it pays for that: an address, on a list, that a warrant can
     be written against. An arrangement cannot be raided because there is
     nothing of yours at the end of it.
  */
  if ((c.plants?.length ?? 0) > 0 && rng.chance(SEIZURE.plantChance)) {
    const gone = c.plants!.pop()!;
    state.org.cash += Math.round(priced(state, PLANT.cost) * PLANT.raidRefundShare);
    addLog(
      state,
      `The premises in ${territoryDef(gone.territoryId).name} are sealed. You are buying from somebody again.`,
      'failure',
    );
  }
}

// -------------------------------------------------------------- readouts ---

export interface TradeRead {
  trade: TradeId;
  unlocked: boolean;
  stock: number;
  capacity: Throughput;
  routes: Territory[];
  eligible: Territory[];
  /** What a unit costs and fetches right now. */
  cost: number;
  value: number;
  /**
   * Loads the family could pay for this week, at today's price.
   *
   * The third constraint, and for a long time the invisible one. `throughput`
   * answers ground and people; this answers money, and `tickContraband` has
   * always applied it — it computed the same figure every week to decide what
   * to buy and then threw it away. Round 11's trade died at $719 against a
   * $2,263 load while the panel told them to take more of the city.
   */
  affordable: number;
  lastEarned: number;
  lastMoved: number;
  /**
   * The one thing to fix, and the sentence that says so.
   *
   * The panel used to decide this itself, out of `capacity.total <= 0` and
   * three nested ternaries, and it got it wrong in both directions on a live
   * career. A blind tester on day 45 held an open route in Little Sicily and
   * was told *"Nothing can move. Open a route in one of the districts below"*
   * — because every one of his people was on a standing order, `capacity.crew`
   * was 0, and a zero on the people side made `total` zero and the message
   * blamed the streets. On days 138 and 140 he was told *"Money is the short
   * end"* while holding the money, the ground and the people: what he did not
   * have was a supply arrangement, which the panel had no word for at all. He
   * found the $40,314 retainer by clicking a greyed-out button and reading the
   * refusal, and put roughly ninety days of play into a screen that had been
   * naming the wrong blocker the whole time.
   *
   * So it is resolved here, in order, against the state each clause actually
   * reads — and `sourced` is first, because nothing else matters without it.
   */
  blocker: TradeBlocker | null;
  /** Whether anything is in a position to sell or make units at all. */
  sourced: boolean;
}

export type TradeBlockerId =
  | 'locked'
  | 'source'
  | 'ground'
  | 'route'
  | 'people'
  | 'money'
  | 'streets';

export interface TradeBlocker {
  id: TradeBlockerId;
  sentence: string;
}

export function readTrade(state: GameState, trade: TradeId): TradeRead {
  const c = state.contraband;
  return {
    trade,
    unlocked: tradeUnlocked(state, trade),
    stock: Math.round(c?.stock[trade] ?? 0),
    capacity: throughput(state, trade),
    routes: (c?.routes[trade] ?? []).map((id) => state.territories[id]).filter(Boolean),
    eligible: eligibleDistricts(state, trade),
    cost: unitCost(state, trade),
    value: unitValue(state, trade),
    affordable: Math.floor(
      (state.org.cash + state.org.dirtyCash) / Math.max(1, unitCost(state, trade)),
    ),
    lastEarned: c?.lastRun?.[trade].earned ?? 0,
    lastMoved: c?.lastRun?.[trade].moved ?? 0,
    ...blockerOf(state, trade),
  };
}

/** Whether anything is in a position to sell or make units of this. */
export function sourced(state: GameState, trade: TradeId): boolean {
  const c = state.contraband;
  if (!c) return false;
  return trade === 'product'
    ? Boolean(c.supplierId) || plantList(state).length > 0
    : Boolean(armsSupplier(state)) || c.workshops.length > 0;
}

/**
 * What is stopping you, in the order the answers actually gate each other.
 *
 * Each clause reads the state it is about and nothing else. The old version
 * inferred the whole answer from `capacity.total`, which is the minimum of two
 * unrelated numbers, so a zero anywhere reported as a shortage of streets.
 */
function blockerOf(
  state: GameState,
  trade: TradeId,
): { blocker: TradeBlocker | null; sourced: boolean } {
  const def = TRADES[trade];
  const has = sourced(state, trade);
  const capacity = throughput(state, trade);
  const open = (state.contraband?.routes[trade] ?? []).length;
  const eligible = eligibleDistricts(state, trade);
  const cost = unitCost(state, trade);
  const affordable = Math.floor((state.org.cash + state.org.dirtyCash) / Math.max(1, cost));

  const say = (id: TradeBlockerId, sentence: string) => ({
    blocker: { id, sentence },
    sourced: has,
  });

  if (!tradeUnlocked(state, trade)) return say('locked', needsFronts(state, trade));

  // First, and it was missing entirely. Everything below is a detail until
  // somebody is willing to hand you units.
  if (!has) return say('source', needsSource(state, trade));

  if (eligible.length === 0) {
    return say(
      'ground',
      `Nothing can move. This needs a district at ${CONTROL_LABEL[def.minControl].toLowerCase()} or ` +
        `better, and you do not hold one that far yet.`,
    );
  }
  // Read from the routes themselves rather than from a capacity that folds in
  // the crew. This is the clause that told a tester to open a route he had
  // already opened.
  if (open === 0) return say('route', 'Nothing can move. Open a route in one of the districts below.');
  if (capacity.crew <= 0) {
    return say(
      'people',
      'Nobody is free to carry it. Everybody you have is on a job or a standing order.',
    );
  }
  if (affordable <= 0) {
    return say(
      'money',
      `Nothing is moving because nothing was bought. A load costs ${formatMoney(cost)} and ` +
        `there is no money to buy one.`,
    );
  }

  const binding = Math.min(capacity.routes, capacity.crew, affordable);
  if (affordable === binding && affordable < Math.min(capacity.routes, capacity.crew)) {
    return say(
      'money',
      `Money is the short end. You can stock ${affordable} at ${formatMoney(cost)} each; the ` +
        `streets and the people could carry more.`,
    );
  }
  if (capacity.crew < capacity.routes) {
    return say('people', 'You have more ground than people. Anybody on a job is not on this.');
  }
  if (capacity.routes < capacity.crew) {
    return say('streets', 'You have more people than ground. Take more of the city.');
  }
  return { blocker: null, sourced: has };
}

/**
 * The sentence that names the retainer, which nothing on the screen ever did.
 *
 * The cheapest way in, with its figure, so the number a player has to save
 * toward is on the panel that is telling them they cannot move anything —
 * rather than only inside the refusal of a button they have to think to press.
 */
function needsSource(state: GameState, trade: TradeId): string {
  if (trade === 'product') {
    const cheapest = SUPPLIERS.map((s) => priced(state, s.retainer)).sort((a, b) => a - b)[0];
    return (
      'Nothing can move because nobody is supplying you. An arrangement starts at ' +
      `${formatMoney(cheapest)} for the retainer, or you can build a plant of your own.`
    );
  }
  const cheapest = ARMS_SUPPLIERS.map((s) => priced(state, s.retainer)).sort((a, b) => a - b)[0];
  return (
    'Nothing can move because nothing is making them and nobody is selling them. ' +
    `A freight agent starts at ${formatMoney(cheapest)} for the retainer; a workshop is ` +
    `${formatMoney(priced(state, WORKSHOP.cost))} to build.`
  );
}

/** Every supplier, with what the player can currently tell about the price. */
export function readSuppliers(state: GameState) {
  return SUPPLIERS.map((supplier) => ({
    def: supplier,
    current: state.contraband?.supplierId === supplier.id,
    // The waterfront price moves with who holds the water, and that is
    // something the player can see on the Territory panel already.
    /*
       The arrangement's own price, not the one you are paying.

       This read `unitCost(state, 'product') * supplier.priceMultiplier`, and
       `unitCost` already had the *current* supplier's multiplier baked into
       it — so every row in this table was wrong the moment any arrangement was
       open, by whatever the open one's multiplier happened to be. A plant
       would have made it wronger still, because `unitCost` now reads the
       cheapest source rather than the arrangement.
    */
    price: supplierPrice(state, supplier),
  }));
}

export function portMultiplier(state: GameState): number {
  const holder = portHolder(state);
  if (holder === 'player') return PORT.ownedMultiplier;
  if (holder && atWarWith(state, holder)) return PORT.atWarMultiplier;
  if (holder && standingWith(state, holder) < -25) return PORT.hostileMultiplier;
  return 1;
}


/**
 * What the armoury is worth in a fight.
 *
 * A pure read, so `playerStrength` can add it without this module knowing
 * anything about how a war is scored. Returns zero for an empty shelf and
 * never more than `ARMED.maxStrength`.
 */
export function armsStrength(state: GameState): number {
  const crates = state.contraband?.stock.arms ?? 0;
  if (crates <= 0) return 0;
  return Math.min(crates * ARMED.strengthPerCrate, ARMED.maxStrength);
}

/**
 * A week of war, off the shelf.
 *
 * Called once a week with the number of wars actually being fought, so two at
 * once costs twice as much. This is what stops a stockpile being a one-off
 * purchase of a permanent bonus: crates are spent by the thing they are for,
 * and the decision is sell them now or hold them for a war that may not come.
 */
export function spendWarStock(state: GameState, wars: number): void {
  if (wars <= 0) return;
  const c = state.contraband;
  if (!c || c.stock.arms <= 0) return;
  c.stock.arms = Math.max(0, c.stock.arms - ARMED.spentPerWarWeek * wars);
}
