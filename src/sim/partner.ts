/**
 * A rival family owns a piece of you.
 *
 * The argument for the whole thing is in `config/partner.ts`. This is the
 * mechanism: who offers, what signing does, what their cut costs on every job,
 * and how you buy your way out.
 *
 * A leaf module. Nothing here reaches into diplomacy or operations — the cut
 * is taken inside `earnDirty`, which is the single funnel every criminal
 * dollar already passes through, and the protection is expressed as a floor on
 * a bond that the AI already reads. Both are one guard in a shared place
 * rather than a special case in each caller.
 */

import type { FactionId } from '../config/factions';
import type { GameState } from './types';
import { PARTNER } from '../config/partner';
import { priced } from './market';
import { rivals } from './faction';
import { houseShort } from './houses';
import { totalFunds } from './economy';
import { addLog } from './util';

export interface PartnerOffer {
  factionId: FactionId;
  /** Their name as the player reads it, at the moment of the offer. */
  house: string;
  /** What they will put in, at this year's prices. */
  stake: number;
  /** Their permanent share of criminal income. */
  share: number;
}

/**
 * Who, if anybody, is willing to buy in this morning.
 *
 * Null is the normal answer. Everything here is a reason not to offer, and the
 * order matters only for readability — a boss who is doing fine, is three
 * weeks old, or already sold a piece should never see this.
 */
export function partnerOffer(state: GameState): PartnerOffer | null {
  if (state.mode !== 'career') return null;
  if (state.org.partner) return null;
  if (state.day < PARTNER.notBeforeDay) return null;
  if (totalFunds(state) >= priced(state, PARTNER.offerBelow)) return null;

  const refused = state.org.partnerRefusedDay;
  if (refused !== undefined && state.day - refused < PARTNER.refusalCooldownDays) return null;

  /*
     Richest family still standing. Strength at the floor is how a finished
     family is represented everywhere else in this project, so it is how it is
     read here — a house with nothing left is not buying anything.

     Richest rather than friendliest on purpose: the one with money is the one
     who can, and being bought by the strongest family in the city is a worse
     position to be in than being bought by the weakest. That is the point.
  */
  const able = rivals(state)
    .filter((f) => f.strength > 0 && f.wealth >= priced(state, PARTNER.stake))
    .sort((a, b) => b.wealth - a.wealth);

  const buyer = able[0];
  if (!buyer) return null;

  return {
    factionId: buyer.id,
    house: houseShort(state, buyer.id),
    stake: Math.round(priced(state, PARTNER.stake)),
    share: PARTNER.share,
  };
}

/** Sign. The money arrives dirty, because of who it is from. */
export function takePartner(state: GameState, offer: PartnerOffer): void {
  if (state.org.partner) return;

  state.org.partner = {
    factionId: offer.factionId,
    share: offer.share,
    stake: offer.stake,
    sinceDay: state.day,
    taken: 0,
  };

  /*
     Straight onto the balance rather than through `earnDirty`, or their own
     stake would arrive with their cut already removed from it.
  */
  state.org.dirtyCash += offer.stake;

  addLog(
    state,
    `${offer.house} put ${'$' + offer.stake.toLocaleString('en-US')} into the ` +
      `organization. They take ${Math.round(offer.share * 100)} cents in every ` +
      `dollar from now on.`,
    'money',
  );
}

/** Turn them down. They stop asking for a while. */
export function refusePartner(state: GameState): void {
  state.org.partnerRefusedDay = state.day;
}

/** Their share of criminal income, or zero. */
export function partnerShare(state: GameState): number {
  return state.org.partner?.share ?? 0;
}

/**
 * Their end of a job, taken as it lands.
 *
 * Called from `earnDirty` rather than skimmed weekly, so the cut shows up
 * beside the job that earned it instead of as an unexplained gap on payday.
 * A player should be able to watch this leave.
 */
export function takeCut(state: GameState, amount: number): number {
  const held = state.org.partner;
  if (!held || amount <= 0) return 0;

  /*
     Bounded, and never taking more than the balance outstanding.

     Clamping the last payment matters as much as the ceiling does: without
     it the final cut overshoots and the arrangement ends having taken more
     than it was ever owed, which is the kind of small dishonesty a player
     notices exactly once and never forgets.
  */
  // Nothing at all from a job below the floor. See `takesNothingBelow`.
  if (amount < PARTNER.takesNothingBelow) return 0;

  const ceiling = held.stake * PARTNER.endsAtMultiple;
  const owed = Math.max(0, ceiling - held.taken);
  const cut = Math.min(amount * held.share, owed);
  held.taken += cut;

  if (held.taken >= ceiling - 0.5) {
    const house = houseShort(state, held.factionId);
    delete state.org.partner;
    addLog(
      state,
      `${house} has had their ${'$' + Math.round(ceiling).toLocaleString('en-US')} ` +
        `out of you. The arrangement is finished and nobody owns any part of this.`,
      'money',
    );
  }
  return cut;
}

/** What they are still owed before the arrangement closes itself. */
export function partnerOutstanding(state: GameState): number {
  const held = state.org.partner;
  if (!held) return 0;
  return Math.max(0, held.stake * PARTNER.endsAtMultiple - held.taken);
}

/**
 * What it costs to be free of them.
 *
 * A multiple of the original stake, and deliberately **not** a function of
 * what they have taken. Pricing the exit off their earnings would mean every
 * good week made freedom more expensive — the player would be punished for
 * playing well, and the arrangement would recede as they approached it.
 */
export function buyOutPrice(state: GameState): number {
  const held = state.org.partner;
  if (!held) return 0;
  return Math.round(held.stake * PARTNER.buyoutMultiple);
}

/** Pay them off. False when it cannot be covered, and nothing changes. */
export function buyOutPartner(state: GameState): boolean {
  const held = state.org.partner;
  if (!held) return false;

  const price = buyOutPrice(state);
  if (totalFunds(state) < price) return false;

  /*
     By hand rather than through `spend`, which takes dirty money first. Buying
     out a family is a settlement between two organizations and the money that
     leaves should be the money you would show anybody — the same reasoning
     `possessions.ts` uses for the other purchase in this game that is about
     what you look like rather than what you can do.
  */
  let left = price;
  const clean = Math.min(state.org.cash, left);
  state.org.cash -= clean;
  left -= clean;
  if (left > 0) {
    state.org.dirtyCash -= left;
  }

  const house = houseShort(state, held.factionId);
  delete state.org.partner;

  addLog(
    state,
    `You bought ${house} out for ${'$' + price.toLocaleString('en-US')}. ` +
      `Nobody owns any part of this any more.`,
    'money',
  );
  return true;
}

/** Who holds a piece, for anything that needs to name them. */
export function partnerHouse(state: GameState): string | null {
  const held = state.org.partner;
  return held ? houseShort(state, held.factionId) : null;
}
