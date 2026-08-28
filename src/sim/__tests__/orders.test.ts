/**
 * Somebody else wants a quantity of something by a date.
 *
 * `sellArms` has always let a player sell crates to a rival family, and it is
 * the most double-edged thing in the game — they pay above street value
 * because they are buying capability, and what they do with it is become
 * harder to fight. But it is a *spot* transaction: you have stock, they will
 * buy, done. Nothing in the game has ever asked the player to commit to a
 * quantity they do not have yet.
 *
 * An order does. That turns the trade from a stockpile question into a
 * scheduling one, which is the only reason it was worth building beside the
 * plant rather than instead of more of it.
 *
 * The assertions below are mostly about the two ways this could quietly become
 * a payout table:
 *
 *   - if accepting did not reserve the units, the distribution loop would sell
 *     them on the street before the deadline and the order would be a coin
 *     flip on the weekly buy
 *   - if failing cost nothing, accepting every offer would be free money with
 *     a countdown, and the deadline would be decoration
 *
 * Nothing here describes how anything is made, moved or concealed. The header
 * on `config/contraband.ts` stands.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { TRADES } from '../../config/contraband';
import { GANGS, GANG_BY_ID, ORDERS, ORDER_FAILURE } from '../../config/orders';
import { ALL_FACTIONS } from '../../config/factions';
import { TERRITORIES } from '../../config/territories';
import { SAVE_VERSION } from '../state';
import {
  acceptOrder,
  liveOrders,
  offerOrder,
  orderList,
  orderValue,
  refuseOrder,
  tickOrders,
} from '../orders';
import {
  openRoute,
  openSupply,
  reservedUnits,
  throughput,
  tickContraband,
  unitValue,
} from '../contraband';
import { withFronts } from './helpers';
import { controlledTerritories } from '../territory';
import { totalFunds } from '../economy';
import type { GameState, Order } from '../types';

/** An outfit holding ground, running premises, and able to pay for stock. */
function trading(seed = 31, funds = 900_000): GameState {
  const state = newGame({
    name: 'Orders',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
  withFronts(state, TRADES.arms.minFronts);
  state.org.cash = funds;
  state.org.dirtyCash = 0;
  /*
     A supply, or nothing is ever bought and every delivery assertion below
     measures an empty shelf rather than the thing it claims to. The first
     version of this fixture omitted it and three tests passed for the wrong
     reason — see the header on `floor.probe` for the house rule about proxies.
  */
  openSupply(state, 'dockside');
  for (const t of controlledTerritories(state)) {
    openRoute(state, 'product', t.id);
    openRoute(state, 'arms', t.id);
  }
  /*
     And a foot in each gang's neighbourhood. A gang only asks where the player
     is actually standing — supplying somebody else's corner in a district you
     have never been to is not a decision about anything — and the consequence
     of supplying them lands on ground you hold.
  */
  for (const gang of GANGS) {
    const where = state.territories[gang.territoryId];
    if (where) where.influence.player = Math.max(where.influence.player ?? 0, 25);
  }
  return state;
}

function place(state: GameState, kind: 'family' | 'gang', id: string): Order {
  const order = offerOrder(state, new Rng(state.rng), kind, id);
  expect(order, `no ${kind} order could be placed for ${id}`).not.toBeNull();
  return order!;
}

describe('a gang is not a family, and the code says so', () => {
  it('does not smuggle a fifth faction in through the side door', () => {
    /*
       `FactionId` is a closed four-member union that doubles as a save-format
       slot key. The temptation with a feature like this is to add city hall or
       a street gang to it and inherit the machinery; the cost is a save
       format change and five sixths of a family's fields sitting empty.
    */
    for (const gang of GANGS) {
      expect(ALL_FACTIONS as string[], `${gang.id} is trying to be a faction`).not.toContain(
        gang.id,
      );
    }
  });

  it('puts every gang somewhere that exists', () => {
    const board = new Set(TERRITORIES.map((t) => t.id));
    for (const gang of GANGS) {
      expect(board, `${gang.id} is from a neighbourhood that is not on the map`).toContain(
        gang.territoryId,
      );
    }
  });

  it('charges for a gang in the neighbourhood rather than in money', () => {
    // They pay above what a family pays. The cost is somewhere else entirely,
    // and if it were not this would be strictly the best buyer in the game.
    for (const gang of GANGS) {
      expect(gang.pays, `${gang.id} pays less than a family and costs more`).toBeGreaterThan(
        ORDERS.familyPays,
      );
      expect(
        Math.abs(gang.sentimentPerUnit),
        `${gang.id} is free money`,
      ).toBeGreaterThan(Math.abs(TRADES[gang.wants].sentimentPerUnit));
      expect(gang.influencePerUnit, `${gang.id} costs no ground`).toBeLessThan(0);
    }
  });
});

describe('the offer', () => {
  it('asks for more than a week already moves', () => {
    /*
       The size test. An order the existing weekly flow already covers is not a
       commitment, it is a rounding error with a countdown attached — the
       player accepts, does nothing differently, and collects. It has to be
       large enough to require buying more than the street would have absorbed.
    */
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    const weekly = throughput(state, order.trade).total;
    expect(order.units, 'an order a normal week already fills').toBeGreaterThan(weekly);
  });

  it('lapses if nobody answers it', () => {
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    expect(order.status).toBe('offered');
    for (let d = 0; d <= ORDERS.offerStands + 7 && !state.gameOver; d++) advanceDay(state);
    expect(
      orderList(state).find((o) => o.id === order.id)?.status,
      'an offer nobody answered is still sitting there',
    ).toBe('lapsed');
  });

  it('can be turned down, and goes away when it is', () => {
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    expect(refuseOrder(state, order.id).ok).toBe(true);
    expect(liveOrders(state)).toEqual([]);
  });

  it('will not ask a family you are shooting at', () => {
    // `ARMS_SALE.requiresPeace` already says nobody buys from somebody they
    // are at war with, and an order is a longer arrangement than a sale.
    const state = trading();
    const bond = state.factions.falcone.bonds.player!;
    bond.warSince = state.day;
    expect(offerOrder(state, new Rng(state.rng), 'family', 'falcone')).toBeNull();
  });

  it('stops asking once there are enough on the books', () => {
    const state = trading();
    for (let i = 0; i < ORDERS.maxLive; i++) place(state, 'gang', 'southport_men');
    expect(liveOrders(state).length).toBe(ORDERS.maxLive);
    expect(offerOrder(state, new Rng(state.rng), 'gang', 'river_boys')).toBeNull();
  });
});

describe('accepting is a commitment, not a sale', () => {
  it('reserves the units out of distribution', () => {
    /*
       The assertion this whole feature turns on. `tickContraband` sells
       everything the streets will take, every week. If an accepted order did
       not hold its units back, the player would be racing their own
       distribution loop to the deadline and the commitment would mean nothing.
    */
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    expect(reservedUnits(state, order.trade)).toBe(0);
    acceptOrder(state, order.id);
    expect(reservedUnits(state, order.trade)).toBe(order.units);
  });

  it('holds the reserved units back from the street', () => {
    /*
       And the behaviour behind the number, which the assertion above does not
       reach. Written after a mutation check: deleting `- reservedUnits(...)`
       from the distribution loop in `contraband.ts` left all sixteen other
       tests in this file green, which is exactly the shape of instrument this
       project has a standing finding about — one that reports confidently
       about something it is not measuring.

       So: a shelf holding precisely what is owed, no money to buy more, and
       streets with plenty of room. Nothing may go to the street.
    */
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    acceptOrder(state, order.id);

    state.contraband.stock[order.trade] = order.units;
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    state.day = 7 * (Math.floor(state.day / 7) + 1);
    expect(throughput(state, order.trade).total, 'the street has no room anyway').toBeGreaterThan(
      0,
    );

    tickContraband(state, new Rng(state.rng));
    expect(
      state.contraband.lastRun?.[order.trade].moved ?? 0,
      'the distribution loop sold stock that was already promised to somebody',
    ).toBe(0);
  });

  it('makes the weekly buy aim higher than the street', () => {
    /*
       And the other half of the same idea. Reserving without raising the
       target would starve the street instead of buying more, so an order would
       cost the player their ordinary income rather than requiring them to go
       and find more supply.
    */
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    acceptOrder(state, order.id);

    for (let d = 0; d < 8 && !state.gameOver; d++) advanceDay(state);
    const settled = orderList(state).find((o) => o.id === order.id)!;
    expect(settled.delivered, 'a week passed and the order got nothing').toBeGreaterThan(0);
    expect(
      state.contraband.lastRun?.[order.trade].moved ?? 0,
      'the order was filled by starving the street rather than by buying more',
    ).toBeGreaterThan(0);
  });

  it('pays per unit, above what the street pays', () => {
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    acceptOrder(state, order.id);
    expect(order.unitPrice).toBeGreaterThan(unitValue(state, order.trade));
    expect(orderValue(order)).toBe(order.units * order.unitPrice);

    state.contraband.stock[order.trade] = order.units;
    const before = totalFunds(state);
    tickOrders(state);
    expect(totalFunds(state), 'the order delivered and nobody was paid').toBeGreaterThan(before);
    expect(orderList(state).find((o) => o.id === order.id)!.status).toBe('filled');
  });
});

describe('what a buyer does with what they bought', () => {
  it('makes a family measurably harder to fight', () => {
    /*
       The same pinning `ARMED` already enforces: a crate is worth the same
       quantity in their hands as in yours, so every one delivered moves that
       quantity from your column to theirs. An order is a larger version of the
       spot sale and must not be a gentler one.
    */
    const state = trading();
    const order = place(state, 'family', 'falcone');
    acceptOrder(state, order.id);
    const before = state.factions.falcone.strength;
    state.contraband.stock[order.trade] = order.units;
    tickOrders(state);
    expect(
      state.factions.falcone.strength,
      'they bought a lorryload of crates and got no stronger',
    ).toBeGreaterThan(before);
  });

  it('changes what a gang neighbourhood is like to operate in', () => {
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    acceptOrder(state, order.id);
    const where = state.territories[GANG_BY_ID.southport_men.territoryId];
    const before = {
      sentiment: where.sentiment,
      influence: where.influence.player ?? 0,
      heat: state.org.heat,
    };
    state.contraband.stock[order.trade] = order.units;
    tickOrders(state);
    expect(where.sentiment, 'the neighbourhood did not notice').toBeLessThan(before.sentiment);
    expect(where.influence.player ?? 0, 'the street is no less theirs').toBeLessThan(
      before.influence,
    );
    expect(state.org.heat, 'nobody is looking at anybody').toBeGreaterThan(before.heat);
  });
});

describe('failing one', () => {
  it('costs the relationship and not the money already earned', () => {
    /*
       Units delivered are paid for as they go, so a failed order does not
       claw back a dollar the player had. What it costs is the buyer, and the
       buyer was the point — which is the same shape `promises.ts` uses, where
       breaking one writes a memory rather than deducting a stat.
    */
    const state = trading();
    const order = place(state, 'family', 'falcone');
    acceptOrder(state, order.id);
    const bond = state.factions.falcone.bonds.player!;
    const before = { grudge: bond.grudge, respect: state.org.respect, funds: totalFunds(state) };

    state.day = order.dueDay;
    tickOrders(state);

    const settled = orderList(state).find((o) => o.id === order.id)!;
    expect(settled.status).toBe('failed');
    expect(bond.grudge, 'they did not mind at all').toBeGreaterThan(before.grudge);
    expect(state.org.respect, 'your word costing nothing is the whole failure mode').toBeLessThan(
      before.respect,
    );
    expect(totalFunds(state), 'a failed order took money off the player').toBeGreaterThanOrEqual(
      before.funds,
    );
    expect(ORDER_FAILURE.respect).toBeGreaterThan(0);
  });

  it('releases the reservation when it settles', () => {
    // A dead order that still reserves stock would quietly strangle the trade
    // for the rest of the career, and nothing would say why.
    const state = trading();
    const order = place(state, 'gang', 'southport_men');
    acceptOrder(state, order.id);
    state.day = order.dueDay;
    tickOrders(state);
    expect(reservedUnits(state, order.trade)).toBe(0);
  });
});

describe('finishing early is worth more than scraping in', () => {
  it('pays a bonus that shrinks as the deadline approaches', () => {
    const build = (waitDays: number): number => {
      const state = trading(31, 5_000_000);
      const order = place(state, 'gang', 'southport_men');
      acceptOrder(state, order.id);
      state.day = order.acceptedDay! + waitDays;
      state.contraband.stock[order.trade] = order.units;
      const before = totalFunds(state);
      tickOrders(state);
      return totalFunds(state) - before;
    };
    const prompt = build(0);
    const late = build(20);
    expect(prompt, 'the deadline is the only number that matters').toBeGreaterThan(late);
    expect(ORDERS.earlyBonusShare).toBeGreaterThan(0);
  });
});

describe('anybody ever gets asked', () => {
  /*
     The question that killed the mirror-workshop design, asked again.

     Measured on `ladder.probe`'s bot — the project's standard career, not the
     one written for this feature — across 144 careers:

         product trade unlocked   132/144
         arms trade unlocked      122/144
         saw at least one offer   102/144
         offers in the career     p10 0   median 2   p75 5   p90 9   max 19

     Worth recording how that number was nearly got wrong. The first
     instrument was a bot written for this file, and it reported 13 careers in
     36 seeing an offer and a median of zero — the PATRON shape, and grounds
     for redesigning the whole feature. The bot was the fault: it opened a
     supply in 14 careers of 36 where the standard one reaches two fronts in
     132 of 144. F7, exactly as filed.

     What the weak bot did find, and what was a real fault, is below: the
     weekly roll picks one name out of the candidate list, so listing families
     who cannot buy because the arms trade is shut crowds out the gang who
     can. See `candidates` in `sim/orders.ts`.
  */
  it('reaches an ordinary trading career through the real tick', () => {
    const state = trading();
    let seen = 0;
    for (let d = 0; d < 400 && !state.gameOver; d++) {
      advanceDay(state);
      seen = Math.max(seen, orderList(state).length);
      for (const o of liveOrders(state)) if (o.status === 'offered') refuseOrder(state, o.id);
    }
    expect(seen, 'a year of running both trades and nobody ever asked for anything').toBeGreaterThan(
      0,
    );
  });
});

describe('the save', () => {
  it('does not move the version for an optional list', () => {
    // Nine existing optional fields follow this idiom; `orders` is the tenth.
    // A save written before this existed loads with nobody asking you for
    // anything, which for those saves is exactly true.
    expect(SAVE_VERSION).toBe(13);
    const state = trading();
    expect(state.orders, 'a new game ships a list nobody has filled yet').toBeUndefined();
    expect(reservedUnits(state, 'product'), 'an absent list is not zero').toBe(0);
  });
});
