/**
 * Buying a front from the man who owns it.
 *
 * Acquiring a business was a purchase authorisation. `acquisitionOptions`
 * listed ten entries against every district, `canAcquire` checked control,
 * slots, public feeling and money, and the button moved a number. There was
 * nobody on the other side of it — `haggle` inside `acquisitionCost` is a flat
 * discount taken off the negotiation attribute, so the price bends to a stat
 * the player already has and no negotiation happens anywhere.
 *
 * Measured off the catalogue before a line of this was written:
 *
 *     strictly dominated entries, price included     0
 *     beaten on every quality axis by something      7 of 10
 *     revenue per $1,000 of cost                     37.8 to 51.1, most at 50.0
 *     capacity against legitimacy                    r = -0.41
 *
 * No entry is dead, because each is cheaper than the thing that beats it. But
 * seven of ten exist *only* because they are cheaper, `real_estate` beats six
 * of them outright on revenue, capacity, exposure and legitimacy at once, and
 * revenue per dollar is nearly flat across the whole list. The only input to
 * which front you buy is how much money you have — and F15 measured the same
 * thing from the other end, finding money the blocker in 97% of the weeks a
 * career owns no front, with 30 careers of 36 finishing on exactly one.
 *
 * The header of `businesses.ts` says legitimacy and launder capacity "pull
 * against each other on purpose". At -0.41, driven almost entirely by one
 * entry, they mostly do not: `real_estate` has the second-highest capacity in
 * the game and the highest legitimacy. That is a separate repair and it is the
 * next piece of this work; this file does not touch the catalogue.
 *
 * **What is at stake here is not whether you may buy.** `canAcquire` is
 * unchanged and still decides that. The conversation decides the price and the
 * terms, and it can end with the man declining to sell to you at all — which
 * is the cost that stops this being a free discount with prose on it.
 */

import type { NpcStatId } from '../sim/types';
import type { RegisterDef } from './sitdown';

/**
 * What the seller is, as a term on the deal.
 *
 * Terms rather than a percentage, because "12% off" is not a decision — it is
 * the same object for less money. A front the previous owner still has a piece
 * of is a *different* front afterwards, and that difference is the thing the
 * player is choosing between when they decide how hard to push.
 */
export type TermId = 'he_stays' | 'looked_after';

export interface TermDef {
  id: TermId;
  label: string;
  /** What it means, in the words somebody would actually use. */
  blurb: string;
  /** Taken off the asking price when it is agreed, as a share. */
  off: number;
}

export const TERMS: Record<TermId, TermDef> = {
  he_stays: {
    id: 'he_stays',
    label: 'They keep a piece',
    blurb: 'Cheaper to take on, and a share of what it earns is never yours.',
    off: 0.18,
  },
  looked_after: {
    id: 'looked_after',
    label: 'They are looked after',
    blurb: 'Cheaper to take on, and the place is louder than it should be.',
    off: 0.12,
  },
};

/**
 * What a term costs forever, against what it saved once.
 *
 * Both are small on purpose and both are permanent, which is the trade. A
 * player taking a term is spending a slice of a front's whole working life to
 * get in the door today — and F15 says getting in the door is the thing that
 * decides a career, so that is a bargain a lot of the time and a mistake for
 * a family that could simply have paid.
 *
 * Not sized against the estate. See the note in `config/silence.ts` about what
 * that instrument can and cannot resolve; these are sized to be worth taking
 * when you are short and not worth taking when you are not.
 */
export const TERM_EFFECT = {
  /** Share of weekly revenue that goes to the man who kept a piece. */
  heStaysRevenue: 0.22,
  /** Extra exposure per week for a front with somebody being carried. */
  lookedAfterExposure: 0.5,
} as const;

export const DEAL = {
  /**
   * How far above the catalogue he opens.
   *
   * The list price is what a going concern is worth to a real buyer. It is not
   * the first number out of the mouth of the man who owns it, and a scene that
   * opened at the shelf price would have nothing in it to talk about — every
   * landing would be pure profit and the only wrong move would be not talking.
   *
   * So the shelf price is roughly what a competent conversation gets you, the
   * ask is above it, and the floor below. Saying nothing costs you.
   */
  askPremium: 1.22,

  /**
   * And the bottom, as a share of the catalogue price.
   *
   * A price that falls with every landing is a discount slider. The reason to
   * stop talking has to be that there is nothing left to win or that he is
   * about to stand up, and this is the first of those two.
   */
  floorShare: 0.78,

  /** What one landed register takes off, as a share of the current ask. */
  movePerLanding: 0.06,

  /**
   * And what a misread costs.
   *
   * Nothing, on the price. A wrong question does not make a man want more for
   * his shop — it wears out the room, which patience already models, and
   * charging twice for the same mistake is how a mechanic stops being a read
   * and starts being a punishment.
   */
  moveOnMiss: 0,
} as const;

/**
 * How the man across the table is put together.
 *
 * Derived from the district and the front rather than generated, the way
 * `houseStats` derives a rival's temperament from its faction. A seller rolled
 * fresh each time would make the scene a slot machine, and the entire point of
 * a sit-down is that what you are reading is *there* to be read — a struggling
 * place in a poor district really is a man who needs the money, and a player
 * who works that out has learned something true about the world rather than
 * won a coin toss.
 */
export const SELLER = {
  /** Everything starts here and is pushed around by what the district is. */
  base: 45,

  /** A poor district makes a hungry seller. Full swing at either extreme. */
  greedFromPoverty: 30,
  /** An expensive front is owned by somebody who holds his number. */
  disciplineFromPrice: 25,
  /** The price at which an owner is fully composed. */
  disciplineFullAt: 260_000,
  /** Somebody in a rich district has somewhere else to be. */
  ambitionFromWealth: 25,
  /** How much of your reputation for violence he has heard. */
  fearFromYours: 0.45,
  /** And how much the police being everywhere steadies him. */
  fearFromPolice: 25,
  /** What the neighbourhood thinks of you, sat down opposite you. */
  grievanceFromSentiment: 1,
  /** Being somebody buys a hearing. */
  regardFromRespect: 0.3,
} as const;

/**
 * The things you say to a man selling a shop.
 *
 * Same shape as the crew and rival registers and read by the same
 * `chooseRegister`, because the mechanic is the mechanic: a hidden stat, a
 * threshold, and prose for both outcomes. What differs is what a landing buys
 * — here it moves a number on a deal rather than a stat on a person.
 *
 * Thresholds straddle the middle of each stat for the reason the crew
 * registers do: one that lands on almost everybody is a button, not a read.
 */
export const SELLER_REGISTERS: RegisterDef[] = [
  {
    id: 'let_him_talk',
    does: 'You let it get there in its own time.',
    label: 'Let them talk',
    hint: 'Costs a little patience and tells you what this is really about.',
    against: 'grievance' as NpcStatId,
    wants: 'high',
    threshold: 20,
    reveals: 'why_selling',
    landed:
      'It comes out sideways, the way it does. A brother-in-law, a bad year, ' +
      'and a decision already made and not yet said out loud.',
    missed:
      'The wait is for you to say something. Whatever this is, they are not ' +
      'going to be the one who opens it.',
    trains: 'intelligence',
  },
  {
    id: 'ask_price',
    says: '“What do you want for it?”',
    label: 'Ask their number',
    hint: 'The plain question. Somebody who has thought about it answers it.',
    against: 'discipline' as NpcStatId,
    wants: 'low',
    threshold: 55,
    reveals: 'his_number',
    landed:
      'A figure, and then a second, smaller one before you have answered the ' +
      'first. That is the one that was meant.',
    missed:
      'You get the number everybody has been getting, and it does not move ' +
      'while you are sitting there.',
    trains: 'negotiation',
  },
  {
    id: 'its_failing',
    says: '“The place is bleeding and we both know it.”',
    label: 'Say what it is worth',
    hint: 'True, and unkind. Somebody composed will not flinch at it.',
    against: 'discipline' as NpcStatId,
    wants: 'low',
    threshold: 45,
    needs: 'why_selling',
    landed:
      'No argument. That is the whole answer — the same numbers have been run ' +
      'already, and run first.',
    missed:
      '“Every place is bleeding.” It sits there. That was not news, and nobody ' +
      'pays you for telling them what they already knew.',
    trains: 'negotiation',
  },
  {
    id: 'cash_today',
    says: '“Cash. Today. Nobody signs anything twice.”',
    label: 'Offer it in cash',
    hint: 'Fast, quiet money. Worth a great deal to the right person.',
    against: 'greed' as NpcStatId,
    wants: 'high',
    threshold: 50,
    landed:
      'Something in the shoulders lets go. A month of paperwork was the part ' +
      'being dreaded, more than the price ever was.',
    missed:
      '“I am not in a hurry.” They are, but not the kind of hurry that makes ' +
      'anybody take less to be finished sooner.',
    trains: 'negotiation',
  },
  {
    id: 'who_i_am',
    says: '“You know who I am.”',
    label: 'Let them know who you are',
    hint: 'It works on some people. The street hears about it either way.',
    against: 'fear' as NpcStatId,
    wants: 'high',
    threshold: 50,
    landed:
      'They know. They knew before you sat down, and now it has been said out ' +
      'loud they would rather this were over.',
    missed:
      '“I know exactly who you are.” Said the way somebody says it once they ' +
      'have decided it does not frighten them.',
    trains: 'intimidation',
  },
  {
    id: 'offer_cut',
    says: '“Keep a piece of it. You stay, the place stays yours on the door.”',
    label: 'Let them keep a piece',
    hint: 'Cheaper today. A share of everything it ever earns is not yours.',
    against: 'ambition' as NpcStatId,
    wants: 'high',
    threshold: 45,
    landed:
      'That had not come up. You can watch it land — the same shop, the same ' +
      'apron, and somebody else worrying about the rest of it.',
    missed:
      '“I want out. That is the entire point.” Some people are selling a ' +
      'business and some are leaving one.',
    trains: 'negotiation',
  },
  {
    id: 'look_after_him',
    says: '“Nothing happens to you. Anybody asks, you are with us.”',
    label: 'Offer to look after them',
    hint: 'Cheaper today, and somebody the street can point at afterwards.',
    against: 'fear' as NpcStatId,
    wants: 'high',
    threshold: 35,
    needs: 'why_selling',
    landed:
      'That was the thing. Not the money — the fortnight after the money, and ' +
      'who would be standing anywhere near them during it.',
    missed:
      '“I do not need looking after.” Meaning: not wanting to be somebody who ' +
      'needs looking after, which is not the same sentence.',
    trains: 'leadership',
  },
];

export const SELLER_REGISTER_BY_ID: Record<string, RegisterDef> = Object.fromEntries(
  SELLER_REGISTERS.map((r) => [r.id, r]),
);

/** Which register agrees which term. Kept here so the words own the promise. */
export const TERM_FROM_REGISTER: Record<string, TermId> = {
  offer_cut: 'he_stays',
  look_after_him: 'looked_after',
};
