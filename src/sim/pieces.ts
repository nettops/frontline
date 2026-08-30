/**
 * The shelf, and what leaves it.
 *
 * The design and every tuned number live in `config/pieces.ts`. This file
 * holds the four properties that make the thing safe to wire into acts the
 * game has been measuring for a year:
 *
 * 1. **It is never a gate.** `armFor` cannot fail. If the shelf is empty it
 *    refills from what the family has always had, because a boss does not send
 *    his people out unarmed and no act of violence may be blocked, delayed or
 *    worsened for want of an object.
 * 2. **Reading it never draws.** Seeding, selection and the readings are all
 *    `stableNoise` or plain order. `addLog`'s header records what happened the
 *    two times something presentational touched the stream, and it took four
 *    probe runs to find each time.
 * 3. **The default policy never draws either.** `pocket` and keep is the
 *    measured game, so a career that never opens the panel — and the
 *    autopilot, which never will — moves not at all.
 * 4. **A piece's history is a reading, not a trap.** `pieceReading` says there
 *    is something to know and never the number, which is `perceive()`'s stance
 *    everywhere else.
 *
 * Lazily initialised, so `SAVE_VERSION` does not move and an old save loads as
 * a family that always had its guns. Here that idiom is not merely convenient:
 * it is true.
 */

import type { Armoury, GameState, Id, Piece } from './types';
import { Rng, clamp } from './rng';
import { addEvidence, addLog, nextId } from './util';
import { spend } from './economy';
import { playerInfluence } from './territory';
import { HOME_TERRITORY } from '../config/territories';
import { TRADES } from '../config/contraband';
import {
  BOUGHT_BY_CLASS,
  CARRIED_BY_CLASS,
  CLASS,
  COLD,
  CRATE_BREAK,
  DUMP,
  HOUSE,
  JOIN,
  PIECES,
  PROVENANCE,
  type PieceClass,
} from '../config/pieces';

export interface PieceCheck {
  ok: boolean;
  message: string;
}

/**
 * What is going out tonight, and what it does to the act.
 *
 * Three multipliers rather than three decisions. The caller keeps its own
 * numbers and this scales them, so every figure `SILENCE`, `MARK` and
 * `INFORMANT` were measured with is still the figure in the file.
 */
export interface ArmedAct {
  piece: Piece;
  /** Added to the chance the act goes the way you wanted. */
  odds: number;
  /** Multiplies the heat the act was going to make. */
  heat: number;
  /** Multiplies the violence trace the act was going to file. */
  evidence: number;
}

/**
 * The sheet's own line about what this thing leaves, for the trace detail.
 *
 * This is the whole reason the roster of thirty-one carries no balance
 * figures: a razor and a sawn-off differ in what the paperwork says happened,
 * and that is worth having without being worth pricing.
 */
export function leftBehind(act: ArmedAct): string {
  return PIECES[act.piece.defId].leaves;
}

// ------------------------------------------------------------- the shelf ---

/**
 * What the family owns, seeding it the first time anybody asks.
 *
 * The four starting pieces are drawn with `stableNoise` off the career seed,
 * so the shelf is the same every time it is read and costs nothing to read.
 * Weighted to `pocket`: a family that has not started anything yet does not
 * keep rifles.
 */
export function armouryOf(state: GameState): Armoury {
  if (!state.armoury) {
    state.armoury = { pieces: [], carry: 'pocket', dump: false };
    for (let i = 0; i < HOUSE.count; i++) state.armoury.pieces.push(housePiece(state, i));
  }
  return state.armoury;
}

/**
 * One of the guns the family has always had.
 *
 * `oldBody` is the tutorial nobody has to read. A third of these have been out
 * before, which is what a gun in a house for years means, and it is why the
 * first silencing can come back heavier than a player expected. The panel says
 * so in words before they use it — see `pieceReading`.
 */
function housePiece(state: GameState, n: number, scraped = false): Piece {
  const key = `piece:${state.rng.seed}:${n}`;
  const roll = Rng.stableNoise(key, 0);
  // Three in four are pocket. The rest is what somebody once brought home.
  const cls: PieceClass = roll < 0.75 ? 'pocket' : 'coat';
  const rack = CARRIED_BY_CLASS[cls];
  const def = rack[Math.floor(Rng.stableNoise(key, 1) * rack.length)];
  return {
    id: nextId(state, 'pc'),
    defId: def.id,
    cls,
    provenance: 'house',
    gotDay: state.day,
    /*
       A scraped piece has always been out.

       The probe found the hole this closes, which is what a probe is for. The
       refill exists so that no act is ever gated, and while it handed over
       clean guns for nothing it also made **dumping free**: get rid of
       everything, get a fresh one, never tie two nights together, pay nothing.
       That is a difficulty setting rather than a decision.

       So what the family scrapes up when it has run through its own is what
       was at the back of the drawer, and it is at the back of the drawer for a
       reason. The act still happens — nothing is gated, which was never
       negotiable — but the free option stops being the clean one, and $3,400
       for something cold starts being worth it.
    */
    bodies: scraped || Rng.stableNoise(key, 2) < HOUSE.oldBody ? 1 : 0,
    status: 'shelf',
  };
}

/** Everything still on it. */
export function shelf(state: GameState): Piece[] {
  return armouryOf(state).pieces.filter((p) => p.status === 'shelf');
}

export function setCarry(state: GameState, cls: PieceClass): void {
  armouryOf(state).carry = cls;
}

export function setDump(state: GameState, on: boolean): void {
  armouryOf(state).dump = on;
}

export function setCharge(state: GameState, on: boolean): void {
  armouryOf(state).charge = on;
}

/**
 * Whether tonight's contract goes up rather than gets shot.
 *
 * A separate reading from `armFor` because a charge is not a piece off the
 * shelf — the family does not keep an inventory of them and nothing is spent
 * when one is used. What it changes is the odds, the noise, the street, and —
 * the whole point — which agency ends up holding the file. See `CHARGE`.
 */
export function usingCharge(state: GameState): boolean {
  return armouryOf(state).charge === true;
}

/**
 * What a player is allowed to know about a piece before they use it.
 *
 * A reading and never a count. `perceive()` takes this stance about every
 * hidden stat in the game: you are told there is something to know, and the
 * number stays where it is. A trap would be a house gun that quietly files a
 * joining trace nobody was warned about.
 */
export function pieceReading(piece: Piece): string {
  if (piece.bodies === 0) return 'Nothing has ever happened with it.';
  if (piece.provenance === 'house' && piece.bodies === 1) {
    return 'It has been in the family a long time, and it has been out before.';
  }
  return piece.bodies === 1
    ? 'It has been out once already.'
    : 'It has been out more than once, and everything it did is the same piece.';
}

// ---------------------------------------------------------------- arming ---

/**
 * What goes with them.
 *
 * Cannot return nothing — see the header. The policy class is a preference and
 * not a requirement, so a boss who has told his people to carry rifles and
 * owns none still gets somebody out of the door tonight.
 *
 * Oldest first, deliberately. That means the same gun keeps going out while
 * the policy is keep, which is exactly the pressure `JOIN` is for: the free
 * choice is the one that ties the nights together.
 */
export function armFor(state: GameState): ArmedAct {
  const armoury = armouryOf(state);
  let available = shelf(state);
  if (available.length === 0) {
    // Never a gate. The family finds something, because it always could — and
    // what it finds has been out before. See `housePiece`.
    armoury.pieces.push(housePiece(state, armoury.pieces.length, true));
    available = shelf(state);
  }

  const wanted = available.filter((p) => p.cls === armoury.carry);
  const from = wanted.length > 0 ? wanted : available;
  const piece = [...from].sort((a, b) => a.gotDay - b.gotDay || a.id.localeCompare(b.id))[0];

  return {
    piece,
    odds: CLASS[piece.cls].odds,
    heat: CLASS[piece.cls].heat,
    evidence: PROVENANCE[piece.provenance].evidence,
  };
}

/**
 * Afterwards.
 *
 * Two things, and only the first is the system. A piece that has been out
 * before ties tonight to the last time — one trace carrying both, which is the
 * thing a player will remember. Then dump-or-keep settles, and keeping is the
 * default because keeping is free and free is what the early game can afford.
 *
 * `landed` is whether there is a body. A botched silencing still spent the
 * night and still gets dumped if that is the policy; it just did not add to
 * what the piece has done.
 */
export function spent(
  state: GameState,
  rng: Rng,
  act: ArmedAct,
  opts: { npcIds: Id[]; landed: boolean },
): void {
  const piece = act.piece;
  const def = PIECES[piece.defId];

  if (opts.landed && piece.bodies > 0) {
    /*
       The join. Filed as its own trace rather than folded into the act's,
       because it is a different fact about a different night and the case
       screens read traces one at a time.
    */
    addEvidence(state, {
      day: state.day,
      source: 'violence',
      strength: JOIN.perBody * Math.min(piece.bodies, JOIN.cap),
      npcIds: opts.npcIds,
      detail: `The same ${def.name.toLowerCase()} was used before. Two of them are the same case now.`,
    });
    addLog(state, 'It was the same one as last time. Somebody will notice that.', 'crew');
  }

  if (opts.landed) piece.bodies += 1;

  if (!armouryOf(state).dump) return;

  /*
     Getting rid of it, on `DISPOSAL`'s shape and for its reasons — the score
     already has this beat and a second set of numbers for the same act would
     say nothing new. Easier on ground your own people watch.
  */
  piece.status = 'dumped';
  const held = playerInfluence(state.territories[HOME_TERRITORY]) / 100;
  if (!rng.chance(clamp(DUMP.base + DUMP.perControl * held, 0.05, 0.95))) {
    addEvidence(state, {
      day: state.day,
      source: 'disposal',
      strength: DUMP.strength,
      npcIds: opts.npcIds,
      detail: `${def.name} turned up where it should not have.`,
    });
    addLog(state, 'It did not go in the river after all.', 'failure');
  }
}

// ----------------------------------------------------------- the doors ---

/** Where a new piece comes from, whichever door it came through. */
function add(state: GameState, defId: string, provenance: Piece['provenance']): Piece {
  const piece: Piece = {
    id: nextId(state, 'pc'),
    defId,
    cls: PIECES[defId].cls,
    provenance,
    gotDay: state.day,
    bodies: 0,
    status: 'shelf',
  };
  armouryOf(state).pieces.push(piece);
  return piece;
}

/**
 * The street door, which opens with money and nothing else.
 *
 * Bought with whatever is in the bag — `spend` takes dirty first, which is
 * right here and is exactly why `possessions` does not use it. Nobody buys a
 * cold gun with a cheque.
 *
 * The class is the one you have told your people to carry, so the purchase
 * answers the standing decision rather than asking a second question.
 */
export function buyCold(state: GameState): PieceCheck {
  const armoury = armouryOf(state);
  if (!spend(state, COLD.cost, 'other_out')) {
    return { ok: false, message: 'Not with what is in the bag.' };
  }
  const rack = BOUGHT_BY_CLASS[armoury.carry];
  const def = rack[Math.floor(Rng.stableNoise(`cold:${state.rng.seed}:${state.day}`, 3) * rack.length)];
  add(state, def.id, 'cold');
  addLog(state, `${def.name}, and nothing on it and nothing behind it.`, 'crew');
  return { ok: true, message: `${def.name}. Cold.` };
}

/**
 * The other door, and the late game's whole joke.
 *
 * A crate out of your own trade breaks into pieces that cost almost exactly
 * what a cold one costs — and every one of them points at the workshop that
 * made it. The trade that made you rich is the trade with your name on the
 * paperwork. `ARMS_SALE` says the same thing pointing outward.
 */
export function breakOutCrate(state: GameState): PieceCheck {
  const trade = state.contraband;
  if (!trade || trade.stock.arms < 1) {
    return { ok: false, message: `No ${TRADES.arms.unit[1]} to break out.` };
  }
  trade.stock.arms -= 1;
  const rack = BOUGHT_BY_CLASS[armouryOf(state).carry];
  for (let i = 0; i < CRATE_BREAK.pieces; i++) {
    const def = rack[Math.floor(Rng.stableNoise(`crate:${state.rng.seed}:${state.day}:${i}`, 4) * rack.length)];
    add(state, def.id, 'crate');
  }
  addLog(
    state,
    `One crate came off the shelf and went into the house. Every piece of it is yours on paper.`,
    'crew',
  );
  return { ok: true, message: `${CRATE_BREAK.pieces} pieces, all of them traceable to you.` };
}

/**
 * The third door, which you do not open — somebody else does.
 *
 * A gift leaves an ordinary trace, because the paper trail on it is theirs.
 * What it costs is that the family who handed it over now holds something,
 * which belongs to the bond and not to a number here.
 */
export function givenPiece(state: GameState, from: string): Piece {
  const rack = BOUGHT_BY_CLASS[armouryOf(state).carry];
  const def = rack[Math.floor(Rng.stableNoise(`gift:${from}:${state.day}`, 5) * rack.length)];
  const piece = add(state, def.id, 'given');
  addLog(state, `${def.name}, from friends. You will be asked about it one day.`, 'crew');
  return piece;
}
