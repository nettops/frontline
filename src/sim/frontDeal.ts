/**
 * The room where a front changes hands.
 *
 * See `config/frontDeal.ts` for what was wrong and what was measured. In short:
 * buying a business was a purchase authorisation with nobody on the other side
 * of it, and the only input to which front you bought was how much money you
 * had.
 *
 * This adds the man selling it, and nothing else. `canAcquire` still decides
 * whether the family may buy at all — control, slots, public feeling, money —
 * and `acquireBusiness` still does the buying. What lives here is the price
 * that gets agreed on the way, and the terms it gets agreed under.
 *
 * It reuses the sit-down whole. `chooseRegister` reads a hidden stat against a
 * threshold, spends patience, reveals tags, and empties the room when the man
 * has had enough — all of which is exactly this scene, and none of which needs
 * writing twice. The three NPC-specific lines in that function are already
 * guarded by `if (sit.npcId)`, and a seller has none, so they simply do not run.
 */

import type { GameState, NpcStatId, NpcStats } from './types';

import { clamp } from './rng';
import { STAT_BANDS } from '../config/npcs';
import { acquireBusiness, acquisitionCost, canAcquire } from './business';
import { BUSINESS_BY_ID } from '../config/businesses';
import { territoryDef } from './territory';
import {
  DEAL,
  SELLER,
  TERM_EFFECT,
  TERM_FROM_REGISTER,
  TERMS,
  type TermId,
} from '../config/frontDeal';
import { SITDOWN } from '../config/sitdown';
import { WORLD } from '../config/build';
import { worldPull } from './build';


export interface Check {
  ok: boolean;
  message: string;
}

/**
 * The man across the table, worked out rather than rolled.
 *
 * `houseStats` is the precedent and the argument is the same one. A seller
 * generated fresh would make this a slot machine with dialogue on it; a seller
 * derived from the world is *there to be read*, so a player who works out that
 * poor districts sell cheap and expensive shops have composed owners has
 * learned something true rather than won a coin toss.
 *
 * Five of the eleven stats do the work and the rest sit at the middle. A
 * seller has no loyalty and no skill worth modelling — he is in the room for
 * twenty minutes and then he is a man who used to own a laundromat.
 */
export function sellerStats(state: GameState, defId: string, territoryId: string): NpcStats {
  const def = BUSINESS_BY_ID[defId];
  const t = state.territories[territoryId];
  const tDef = territoryDef(territoryId);
  const mid = SELLER.base;

  // Wealth and police come off the district definition; sentiment and your own
  // reputation come off what the family has actually done to the place.
  const wealth = clamp((tDef.wealth ?? 50) / 100, 0, 1);
  const police = clamp((tDef.policePresence ?? 0) / 100, 0, 1);
  const dear = clamp((def?.cost ?? 0) / SELLER.disciplineFullAt, 0, 1);

  return {
    // A man in a poor district needs the money. A man in a rich one does not.
    greed: clamp(mid + (1 - wealth) * SELLER.greedFromPoverty * 2 - SELLER.greedFromPoverty, 0, 100),
    // An expensive shop belongs to somebody who has held a number before.
    discipline: clamp(mid + dear * SELLER.disciplineFromPrice, 0, 100),
    // And somebody in a rich district has somewhere else to be next year.
    ambition: clamp(mid + wealth * SELLER.ambitionFromWealth * 2 - SELLER.ambitionFromWealth, 0, 100),
    /*
       What he has heard about you, less what the police being everywhere does
       for a man's nerve. A shopkeeper on a street with a patrol car on it is
       not the same shopkeeper as one two districts over.
    */
    fear: clamp(mid + state.org.fear * SELLER.fearFromYours - police * SELLER.fearFromPolice, 0, 100),
    /*
       And how the neighbourhood holds you, sitting opposite you.

       This is the one that makes public feeling matter to a *price* rather
       than only to a permission. `canAcquire` already refuses below the
       hostile line; between there and warm, the district's opinion is a man
       being difficult with you, and `lands` already resists everything except
       the register that works through a grudge.
    */
    grievance: clamp((100 - (t?.sentiment ?? 50)) * SELLER.grievanceFromSentiment, 0, 100),
    respectForBoss: clamp(mid + state.org.respect * SELLER.regardFromRespect, 0, 100),
    courage: mid,
    intelligence: mid,
    skill: mid,
    leadership: mid,
    loyalty: mid,
  };
}

export interface SellerLine {
  text: string;
  tone: 'good' | 'bad' | 'want' | 'plain';
}

/**
 * What you can tell about him across a table.
 *
 * The same five-band vocabulary the crew sheet and `houseRead` use, and no
 * numbers. Knowing a man is hungry does not tell you whether hungry is hungry
 * enough, which is the whole of the read.
 */
export function sellerRead(state: GameState, defId: string, territoryId: string): SellerLine[] {
  const stats = sellerStats(state, defId, territoryId);
  const band = (stat: NpcStatId): number => clamp(Math.floor(stats[stat] / 20), 0, 4);
  const say = (stat: NpcStatId) => STAT_BANDS[stat][band(stat)];

  return [
    { text: say('greed'), tone: band('greed') >= 3 ? 'want' : 'plain' },
    { text: say('discipline'), tone: band('discipline') >= 3 ? 'bad' : 'plain' },
    { text: say('fear'), tone: band('fear') >= 3 ? 'good' : 'plain' },
    { text: say('grievance'), tone: band('grievance') >= 3 ? 'bad' : 'plain' },
  ];
}

/**
 * Sit down with him.
 *
 * Refuses for exactly the reasons buying refuses, and says so in the same
 * words — there is no point walking a player into a conversation about a shop
 * they are not allowed to own, and `canAcquire` has spent three rounds of
 * playtesting learning how to phrase each of those refusals.
 */
export function openDeal(state: GameState, defId: string, territoryId: string): Check {
  if (state.sitdown && !state.sitdown.done) {
    return { ok: false, message: 'You are already in a room with somebody.' };
  }
  const guard = canAcquire(state, defId, territoryId);
  if (!guard.ok) return { ok: false, message: guard.reason ?? 'No.' };

  const listed = acquisitionCost(state, BUSINESS_BY_ID[defId], state.territories[territoryId]);
  state.sitdown = {
    kind: 'seller',
    reasonId: 'buying',
    npcId: null,
    factionId: null,
    deal: {
      defId,
      territoryId,
      /*
         He opens above the shelf price, so the scene has something in it.

         Opening at the catalogue number would make every landing pure profit
         and the only wrong move not talking. The list price is roughly what a
         competent conversation gets you; the ask is above it and the floor
         below, so saying nothing costs you and pushing too hard costs you
         differently.
      */
      /*
         Less of a premium, for a boss whose word carries.

         The Word half of the build. A seller who already knows who you are
         does not open with the number he would give a stranger, which is the
         cheapest and most legible thing standing can buy.
      */
      ask: Math.round(
        listed * (DEAL.askPremium - worldPull(state, 'word') * WORLD.wordOpensLower),
      ),
      listed,
      terms: [],
    },
    beats: [],
    revealed: [],
    familiarityBefore: 0,
    pending: null,
    patience: SITDOWN.patience,
    done: false,
    walkedOut: false,
    outcome: null,
  };
  return { ok: true, message: '' };
}

/** The number on the table right now. */
export function askingPrice(state: GameState): number {
  return state.sitdown?.deal?.ask ?? 0;
}

/** What has been agreed along the way. */
export function dealTerms(state: GameState): TermId[] {
  return (state.sitdown?.deal?.terms ?? []) as TermId[];
}

/**
 * What a beat did to the deal.
 *
 * Called by `chooseRegister` after the beat resolves, so the price moves for
 * the same reason the prose says it moved. A miss costs nothing here on
 * purpose — see `DEAL.moveOnMiss`. Patience already charges for a wrong
 * question, and charging twice turns a read into a punishment.
 */
export function dealBeat(state: GameState, registerId: string, landed: boolean): void {
  const deal = state.sitdown?.deal;
  if (!deal) return;
  if (!landed) return;

  const term = TERM_FROM_REGISTER[registerId];
  if (term && !deal.terms.includes(term)) {
    deal.terms.push(term);
    deal.ask = Math.round(deal.ask * (1 - TERMS[term].off));
  } else {
    deal.ask = Math.round(deal.ask * (1 - DEAL.movePerLanding));
  }

  // And the bottom, so the scene is not a slider.
  deal.ask = Math.max(deal.ask, Math.round(deal.listed * DEAL.floorShare));
}

/**
 * Shake on it.
 *
 * The purchase itself is still `acquireBusiness`, which knows about slots,
 * holdings, exposure and the log. What this adds is the agreed number in place
 * of the catalogue one, and the terms carried onto the front so it is a
 * different object afterwards than one somebody simply paid for.
 */
export function closeDeal(state: GameState): Check {
  const sit = state.sitdown;
  const deal = sit?.deal;
  if (!sit || !deal) return { ok: false, message: 'Nobody is selling you anything.' };
  /*
     A man who stood up did not sell you his shop.

     The cost that makes the scene a decision. Without it the conversation is a
     free roll — talk until it stops going well, then buy anyway at whatever
     you got it down to.
  */
  if (sit.walkedOut) return { ok: false, message: 'He is not selling. Not to you, not today.' };

  const paying = deal.ask;
  const bought = acquireBusiness(state, deal.defId, deal.territoryId, paying);
  if (!bought) return { ok: false, message: 'It did not come off.' };

  if (deal.terms.length) bought.terms = [...deal.terms] as TermId[];
  state.sitdown = null;
  return { ok: true, message: '' };
}

/** What the terms on a front cost it, as a share of what it earns. */
export function termRevenueShare(business: { terms?: string[] }): number {
  return (business.terms ?? []).includes('he_stays') ? 1 - TERM_EFFECT.heStaysRevenue : 1;
}

/** And what they cost it in attention. */
export function termExposure(business: { terms?: string[] }): number {
  return (business.terms ?? []).includes('looked_after') ? TERM_EFFECT.lookedAfterExposure : 0;
}
