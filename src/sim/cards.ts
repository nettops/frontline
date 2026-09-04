/**
 * The card game.
 *
 * The design note is in `config/cards.ts`. The mechanics that matter here:
 *
 * **Who is at the table is read, never rolled.** `seatedAt` derives from
 * `Rng.stableNoise` keyed on the seed and the week, so the screen can say who
 * is sitting opposite before the player decides whether to sit — and reading
 * that costs the causal stream nothing. Same rule `perceive`, `legitimacy`,
 * `authority`, the whisper feed and the household all follow, and the same
 * rule whispers broke on the day it was written.
 *
 * **A hand is one roll and one relationship.** No hidden sub-simulation of
 * cards. What the player is choosing between is three postures toward the
 * person opposite, and a dealt hand would only put noise between the decision
 * and its consequence.
 *
 * **A leaf.** It reads money, standing, bonds, possessions and the papers, and
 * nothing reads it back except `clock.ts` for the weekly decay and the panel.
 */

import { Rng, clamp } from './rng';
import { addLog, formatMoney } from './util';
import { priced } from './market';
import { earnDirty, spend, totalFunds } from './economy';
import { gainFear, gainRespect, trainAttribute } from './player';
import { figure } from './civic';
import { bond } from './diplomacy';
import { rivals } from './faction';
import { houseShort } from './houses';
import { cover } from './perception';
import { heldPossessions, possessionDef, possessionValue } from './possessions';
import {
  CARDS,
  NOBODIES,
  SEATED,
  TABLES,
  TABLE_BY_ID,
  type CardStyle,
  type TableDef,
} from '../config/cards';
import { CIVIC, CIVIC_FIGURES } from '../config/civic';
import type { CardPlay, GameState, Possession } from './types';
import type { FactionId } from '../config/factions';

/** Lazily created, so a save written before this existed still loads. */
export function cards(state: GameState): CardPlay {
  if (!state.cards) {
    state.cards = { lastPlayedDay: -CARDS.intervalDays, suspicion: 0, hands: 0, won: 0 };
  }
  return state.cards;
}

/** A week of people forgetting how your last hand looked. */
export function tickCards(state: GameState): void {
  if (state.day % CARDS.intervalDays !== 0) return;
  const play = cards(state);
  play.suspicion = clamp(play.suspicion - CARDS.suspicion.decayPerWeek, 0, CARDS.suspicion.max);
}

// ------------------------------------------------------------ the table ----

export type SeatKind = 'nobody' | 'civic' | 'rival';

export interface Seated {
  kind: SeatKind;
  /** As the player would say it. */
  who: string;
  /** The civic figure's id, or the rival's faction id. Null for a nobody. */
  id: string | null;
}

/**
 * Which week's game this is.
 *
 * Floored rather than exact so every day inside a week reads the same table —
 * a room whose occupant changed while the player was deciding would be a
 * screen that lies.
 */
function week(state: GameState): number {
  return Math.floor(state.day / CARDS.intervalDays);
}

/**
 * Who is sitting at every table tonight, without touching the random stream.
 *
 * Built for all three rooms at once rather than one at a time, and that is the
 * whole reason this function exists in this shape. Drawing each table
 * independently put the same person in two rooms on the same night — first the
 * same anonymous wholesaler, and after a fix that only addressed the strangers,
 * the same rival boss. Both are the screen telling the player something that
 * cannot be true.
 *
 * Two attempts failed before this one, and they failed for the same reason:
 * they treated a collision as a thing to nudge rather than a thing to
 * prevent. Offsetting each independent draw by the room's index does not help
 * — two draws one apart still land together — and rotating a single offset
 * only fixes whichever pool it was applied to.
 *
 * So: pick in order, and never pick somebody already sitting somewhere else.
 * The same idiom `personal.ts` uses to stop anybody having two mothers.
 *
 * The top room picks first, which is the fiction as well as the mechanism: the
 * people worth an evening are upstairs, and the rooms below take who is left.
 */
export function seating(state: GameState): Record<string, Seated> {
  const taken = new Set<string>();
  const out: Record<string, Seated> = {};
  const w = week(state);

  /** First unused entry at or after the drawn index. Null if all are taken. */
  const claim = <T>(items: readonly T[], drawn: number, id: (item: T) => string): T | null => {
    for (let i = 0; i < items.length; i++) {
      const item = items[(drawn + i) % items.length];
      if (!taken.has(id(item))) {
        taken.add(id(item));
        return item;
      }
    }
    return null;
  };

  const at = (key: string, salt: number, count: number) =>
    Math.floor(Rng.stableNoise(key, salt) * count);

  // Top room first. `TABLES` is authored bottom-up, so this walks it backwards.
  for (const def of [...TABLES].reverse()) {
    const mix = SEATED[def.id] ?? SEATED.back_room;
    const key = `cards:${state.rng.seed}:${def.id}`;
    const roll = Rng.stableNoise(key, w);

    const stranger = (): Seated => {
      const who = claim(NOBODIES, at(key, w + 500, NOBODIES.length), (n) => n);
      // Only reachable with more rooms than strangers, which a test forbids.
      return { kind: 'nobody', who: who ?? 'somebody nobody introduced', id: null };
    };

    if (roll < mix.nobody) {
      out[def.id] = stranger();
      continue;
    }

    if (roll < mix.nobody + mix.civic) {
      const figureDef = claim(
        CIVIC_FIGURES,
        at(key, w + 900, CIVIC_FIGURES.length),
        (f) => `civic:${f.id}`,
      );
      out[def.id] = figureDef
        ? { kind: 'civic', who: figureDef.title, id: figureDef.id }
        : stranger();
      continue;
    }

    /*
       A family with nothing left is not sitting at anybody's card table. There
       is no "destroyed" flag in this game — strength at the floor is how a
       finished family is represented everywhere else, so it is how it is read
       here.
    */
    const others = rivals(state).filter((f) => f.strength > 0);
    const faction = others.length
      ? claim(others, at(key, w + 1300, others.length), (f) => `rival:${f.id}`)
      : null;
    out[def.id] = faction
      ? {
          kind: 'rival',
          who: `${faction.leader.name} of the ${houseShort(state, faction.id)}`,
          id: faction.id,
        }
      : stranger();
  }

  return out;
}

/** Who is sitting opposite at one table. See `seating`. */
export function seatedAt(state: GameState, tableId: string): Seated {
  return seating(state)[tableId] ?? { kind: 'nobody', who: NOBODIES[0], id: null };
}

/** What a seat costs tonight, in this year's money. */
export function tableStake(state: GameState, def: TableDef): number {
  return priced(state, def.stake);
}

export interface Refusal {
  ok: boolean;
  reason?: string;
}

/**
 * Whether you can sit, refusing by naming both figures.
 *
 * `stakeItemId` is a possession put up instead of cash. It has to be worth at
 * least the stake — nobody at the top table is taking a watch against twelve
 * thousand dollars.
 */
export function canSit(
  state: GameState,
  tableId: string,
  stakeItemId?: string | null,
): Refusal {
  const def = TABLE_BY_ID[tableId];
  if (!def) return { ok: false, reason: 'No such game.' };

  const play = cards(state);
  const since = state.day - play.lastPlayedDay;
  if (since < CARDS.intervalDays) {
    return {
      ok: false,
      reason: `The game runs weekly. Next one in ${CARDS.intervalDays - since} days.`,
    };
  }

  if (state.org.respect < def.respectAbove) {
    return {
      ok: false,
      reason:
        `They do not know you well enough. Respect ${def.respectAbove} gets you in the door, ` +
        `and you are on ${Math.round(state.org.respect)}.`,
    };
  }

  const stake = tableStake(state, def);

  if (stakeItemId) {
    const owned = heldPossessions(state).find((p) => p.defId === stakeItemId);
    if (!owned) return { ok: false, reason: 'You do not own that.' };
    const itemDef = possessionDef(owned);
    const worth = itemDef ? possessionValue(state, itemDef) : 0;
    if (worth < stake) {
      return {
        ok: false,
        reason:
          `${itemDef ? itemDef.name : 'It'} is worth ${formatMoney(worth)} and the stake is ` +
          `${formatMoney(stake)}. Nobody is taking that against this.`,
      };
    }
    return { ok: true };
  }

  if (totalFunds(state) < stake) {
    return {
      ok: false,
      reason:
        `${formatMoney(stake)} to sit, and you have ${formatMoney(totalFunds(state))}. ` +
        `You could put something of your own up instead.`,
    };
  }
  return { ok: true };
}

// ------------------------------------------------------------- the hand ----

/** How likely a straight hand is to come in. */
export function straightOdds(state: GameState): number {
  return Math.min(
    CARDS.maxWin,
    CARDS.baseWin + state.player.attributes.streetSmarts * CARDS.perStreetSmarts,
  );
}

/** How likely somebody is to notice, if you push it. */
export function caughtOdds(state: GameState): number {
  const play = cards(state);
  return clamp(
    CARDS.hard.caughtBase +
      play.suspicion * CARDS.hard.caughtPerSuspicion -
      state.player.attributes.streetSmarts * CARDS.hard.caughtPerStreetSmarts,
    0.02,
    0.9,
  );
}

export interface HandResult extends Refusal {
  /** What the player is told happened, in one line. */
  message?: string;
  won?: boolean;
  caught?: boolean;
  /** Money in, or money out. Negative when it went the other way. */
  swing?: number;
  /** The possession that changed hands, if one did. */
  lost?: Possession;
}

/** Moves the person opposite, whoever they turned out to be. */
function moveSeat(
  state: GameState,
  seat: Seated,
  effect: { standing?: number; trust?: number; grudge?: number },
): void {
  if (seat.kind === 'civic' && seat.id) {
    const held = figure(state, seat.id);
    held.standing = clamp(held.standing + (effect.standing ?? 0), 0, 100);
    return;
  }
  if (seat.kind === 'rival' && seat.id) {
    const link = bond(state, seat.id as FactionId, 'player');
    link.trust = clamp(link.trust + (effect.trust ?? 0), -100, 100);
    link.grudge = clamp(link.grudge + (effect.grudge ?? 0), 0, 100);
  }
}

/**
 * One hand.
 *
 * Every path through this pays the stake first and returns something second,
 * so there is no branch where a player sits down for nothing.
 */
export function sitDown(
  state: GameState,
  rng: Rng,
  tableId: string,
  style: CardStyle,
  stakeItemId?: string | null,
): HandResult {
  const check = canSit(state, tableId, stakeItemId);
  if (!check.ok) return check;

  const def = TABLE_BY_ID[tableId];
  const play = cards(state);
  const seat = seatedAt(state, tableId);
  const stake = tableStake(state, def);

  const staked = stakeItemId
    ? heldPossessions(state).find((p) => p.defId === stakeItemId) ?? null
    : null;

  play.lastPlayedDay = state.day;
  play.hands += 1;

  /*
     Losing on purpose.

     Resolved before anything is rolled, because there is nothing to roll. The
     money is not the transaction — the money is the cover story for the
     transaction, and the transaction is that a man who decides things now owes
     you a small one.
  */
  if (style === 'lose') {
    const result = takeStake(state, staked, stake);
    let message =
      seat.kind === 'nobody'
        ? `You dropped ${formatMoney(stake)} to ${seat.who}, who could not believe their evening.`
        : `You lost ${formatMoney(stake)} to ${seat.who}, slowly, over four hours, in a way that looked like bad cards.`;

    if (seat.kind === 'civic' && seat.id) {
      moveSeat(state, seat, { standing: CARDS.lose.civicStanding });
      const held = figure(state, seat.id);
      /*
         And the thing that was actually being bought.

         Capped by the same `maxOwed` every other route to a favour respects,
         so this is a faster road to one and never a larger stock of them.
      */
      if (held.owed < CIVIC.maxOwed && rng.chance(CARDS.lose.civicFavourChance)) {
        held.owed += 1;
        held.lastFavourDay = state.day;
        message += ` Nothing was said. Something was understood.`;
      } else {
        message += ` They took it as their due, and nothing more.`;
      }
    } else if (seat.kind === 'rival') {
      moveSeat(state, seat, {
        trust: CARDS.lose.rivalTrust,
        grudge: CARDS.lose.rivalGrudge,
      });
      message += ` A man who has taken your money is easier to talk to.`;
    }

    trainAttribute(state, 'streetSmarts', CARDS.trainStraight);
    addLog(state, message, 'money');
    return { ok: true, message, won: false, swing: -stake, lost: result ?? undefined };
  }

  const sharp = style === 'hard';
  if (sharp) play.suspicion = clamp(play.suspicion + CARDS.suspicion.perHardHand, 0, CARDS.suspicion.max);

  const caught = sharp && rng.chance(caughtOdds(state));
  const odds = sharp ? CARDS.hard.win : straightOdds(state);
  const won = !caught && rng.chance(odds);

  trainAttribute(state, 'streetSmarts', sharp ? CARDS.trainHard : CARDS.trainStraight);

  if (caught) {
    const result = takeStake(state, staked, stake);
    play.suspicion = clamp(play.suspicion + CARDS.suspicion.perCatch, 0, CARDS.suspicion.max);
    moveSeat(state, seat, {
      standing: CARDS.caught.civicStanding,
      trust: CARDS.caught.rivalTrust,
      grudge: CARDS.caught.rivalGrudge,
    });
    gainRespect(state, CARDS.caught.respect);
    gainFear(state, CARDS.caught.fear);
    cover(state, rng, 'display', { named: true, scale: CARDS.caught.notorietyScale });

    const message =
      `${seat.who} put a hand flat on the table and asked you to deal that again. ` +
      `${formatMoney(stake)} gone, and everybody in the room watched you leave.`;
    addLog(state, message, 'failure');
    return { ok: true, message, won: false, caught: true, swing: -stake, lost: result ?? undefined };
  }

  if (!won) {
    const result = takeStake(state, staked, stake);
    moveSeat(state, seat, {
      standing: sharp ? 0 : CARDS.straight.civicStanding,
      trust: sharp ? 0 : CARDS.straight.rivalTrust,
    });
    const message = staked
      ? `The cards did not come. ${possessionDef(staked)?.name ?? 'It'} belongs to ${seat.who} now.`
      : `${formatMoney(stake)} to ${seat.who}, and a long walk home.`;
    addLog(state, message, 'money');
    return { ok: true, message, won: false, swing: -stake, lost: result ?? undefined };
  }

  /*
     Won.

     A staked possession that survives is not sold and not paid for — you keep
     the thing and you are paid as though the money had been on the table,
     which is what putting it up meant.
  */
  if (!staked && !spend(state, stake, 'world')) {
    return { ok: false, reason: 'The money was not there when it came to it.' };
  }
  const pot = Math.round(stake * (sharp ? CARDS.hard.payout : CARDS.payout));
  earnDirty(state, stake + pot);
  play.won += 1;

  moveSeat(state, seat, {
    standing: sharp ? 0 : CARDS.straight.civicStanding + CARDS.won.civicStanding,
    trust: sharp ? 0 : CARDS.straight.rivalTrust,
  });
  if (stake >= priced(state, CARDS.won.respectAtStake)) gainRespect(state, CARDS.won.respect);

  const message = `You took ${formatMoney(pot)} off ${seat.who}.`;
  addLog(state, message, 'money');
  return { ok: true, message, won: true, swing: pot };
}

/**
 * Pays the stake, in money or in kind.
 *
 * Returns the possession when one went, so the caller can name it. A staked
 * possession is marked `lost` rather than `sold` because the Legacy screen
 * reads that record and "lost at cards on day 212" is a different sentence
 * from "sold on day 212".
 */
function takeStake(state: GameState, staked: Possession | null, stake: number): Possession | null {
  if (staked) {
    staked.status = 'lost';
    staked.goneDay = state.day;
    return staked;
  }
  spend(state, stake, 'world');
  return null;
}

// -------------------------------------------------------------- the read ---

/**
 * A room, priced and refused.
 *
 * Extends `Refusal` rather than renaming its fields, so the panel can hold a
 * row and a fresh `canSit` check in the same variable — it re-checks whenever
 * the player picks something of their own to stake, and two shapes meaning the
 * same thing would make that a cast.
 */
export interface TableRead extends Refusal {
  def: TableDef;
  stake: number;
  seat: Seated;
  /** What a deliberate loss against this seat is worth. See `throwRead`. */
  thrown: string;
}

/**
 * What a thrown night against this seat is actually worth.
 *
 * Every seat carried the same string — *"Worth an evening whatever the cards
 * do"* — whether the man opposite was two points off owing you a favour or
 * already owed you everything he is going to. A blind tester threw five nights
 * across a 481-day career, two landed, three did not, and he could not tell
 * the cases apart before or after:
 *
 *   > "It fails silently about half the time... All five opposites carried
 *   > the identical tag. A $12,313 stake against Doreen Rowe read exactly the
 *   > same as a $413 stake against a city-hall man."
 *
 * Half of that is a roll and is meant to be: `CARDS.lose.civicFavourChance` is
 * 0.45 and a coin flip you can read is not a coin flip. The other half is not
 * a roll at all. `CIVIC.maxOwed` is 2, and a figure already holding two owes
 * you nothing further no matter what you throw — the money goes, and the log
 * says *"They took it as their due, and nothing more"*, which is the same
 * sentence an unlucky night gets. That case is a guaranteed nothing wearing
 * the costume of bad luck, and it is the one this exists to name.
 *
 * States the odds and the ceiling. It does not state the outcome.
 */
export function throwRead(state: GameState, seat: Seated): string {
  if (seat.kind === 'nobody') return 'Nobody who decides anything';

  if (seat.kind === 'civic' && seat.id) {
    const held = figure(state, seat.id);
    if (held.owed >= CIVIC.maxOwed) {
      return (
        `Owes you ${held.owed} of ${CIVIC.maxOwed} — a thrown night buys ` +
        `nothing more until you spend one`
      );
    }
    const odds = Math.round(CARDS.lose.civicFavourChance * 100);
    return (
      `Owes you ${held.owed} of ${CIVIC.maxOwed} · a thrown night lands a ` +
      `favour about ${odds}% of the time`
    );
  }

  // A rival always moves. What does not always move is the band the panel
  // draws it in, which is what read as a failure.
  return 'A thrown night always moves what they think of you, whether or not the band changes';
}

/** What the panel shows, already priced and already refused. */
export function tableRead(state: GameState): TableRead[] {
  return TABLES.map((def) => {
    const seat = seatedAt(state, def.id);
    return {
      def,
      stake: tableStake(state, def),
      seat,
      thrown: throwRead(state, seat),
      ...canSit(state, def.id),
    };
  });
}
