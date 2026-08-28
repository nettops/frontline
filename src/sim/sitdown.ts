/**
 * The sit-down.
 *
 * A conversation the player acts through, and the game's second verb. Every
 * other decision in this simulation is allocation — which job, which district,
 * which bodies. This one is inference: you choose against a reading of a
 * person that is deliberately noisy, and find out afterwards whether the
 * reading was right.
 *
 * The design and its three load-bearing rules are documented in
 * `config/sitdown.ts`. This module is the machine that runs them and decides
 * nothing on its own — every threshold, every line of prose and every payout
 * size lives in config.
 *
 * A rival sit-down uses the identical machine. The only difference is where
 * the hidden numbers come from: a crew member has real stats, and a house is
 * read off its leader's temperament and where it already stands with you. That
 * is what makes "the same screen, different content" true in the code rather
 * than only in the pitch.
 */

import { Rng, clamp } from './rng';
import { SELLER_REGISTERS, SELLER_REGISTER_BY_ID } from '../config/frontDeal';
import { dealBeat, sellerStats } from './frontDeal';
import { BUSINESS_BY_ID } from '../config/businesses';
import { territoryDef } from './territory';
import type { FactionId } from '../config/factions';
import type { GameState, Npc, NpcStatId, NpcStats, Sitdown } from './types';
import {
  ANSWER_REGISTERS,
  CREW_REGISTERS,
  REASON_BY_ID,
  REGISTER_BY_ID,
  RIVAL_REGISTERS,
  SITDOWN,
  type RegisterDef,
} from '../config/sitdown';
import { STAT_BANDS } from '../config/npcs';
import { addLog } from './util';
import { addNote, isOutOfReach, somethingGood } from './npc';
import { remember } from './memory';
import { spend } from './economy';
import { makePromise } from './promises';
import { trainAttribute } from './player';
import { adjustBond } from './diplomacy';
import { houseName } from './houses';

// ----------------------------------------------------------------- guards --

const satKey = (id: string) => `sat_${id}`;

export interface Check {
  ok: boolean;
  message: string;
}

export function canSitDownWith(state: GameState, id: string): Check {
  if (state.sitdown && !state.sitdown.done) {
    return { ok: false, message: 'You are already in a room with somebody.' };
  }
  /*
     Only when the id is a person.

     This function is also the gate for sitting down with a *house*, which
     passes a faction id and has no entry in `state.npcs`. The first version
     rejected everything it could not find and broke both rival sit-downs.
  */
  const man = state.npcs[id];
  if (man && isOutOfReach(man)) {
    return {
      ok: false,
      message:
        man.status === 'arrested'
          ? 'They are in a cell. There is no back room to sit in.'
          : 'They are not around to talk to.',
    };
  }
  const last = state.flags[satKey(id)];
  if (last !== undefined) {
    const since = state.day - last;
    if (since < SITDOWN.cooldownDays) {
      return {
        ok: false,
        message: `You sat down ${since} ${since === 1 ? 'day' : 'days'} ago. Give it time.`,
      };
    }
  }
  return { ok: true, message: '' };
}

// -------------------------------------------------------- reading a house --

/**
 * A rival family's hidden numbers.
 *
 * Not stored anywhere, because they are not a second set of facts — they are
 * the temperament of whoever is running the house plus the history between the
 * two of you, expressed in the vocabulary the sit-down already speaks. A
 * cautious boss is disciplined, a commercial one can be bought, and a house
 * that already trusts you is easier to level with.
 *
 * Derived rather than saved so it cannot drift out of step with the leader it
 * describes, and so a boss dying genuinely changes who you are talking to.
 */
export function houseStats(state: GameState, factionId: FactionId): NpcStats {
  const faction = state.factions[factionId];
  const bias = faction?.leader?.bias;
  const b = faction?.bonds?.['player'] ?? { grudge: 0, respect: 0, trust: 0, warSince: null };
  const from = (v: number | undefined, mid: number) => clamp(mid + (v ?? 0) * 45, 0, 100);

  return {
    // Frightened houses are the cautious ones, and fear rises with what they
    // stand to lose to you.
    fear: clamp(from(bias?.caution, 40) + b.respect * 0.3, 0, 100),
    greed: from(bias?.commerce, 45),
    ambition: from(bias?.ambition, 45),
    discipline: from(bias?.caution, 50),
    courage: from(bias?.aggression, 50),
    // How they hold you, not how you hold them.
    respectForBoss: clamp(40 + b.respect, 0, 100),
    loyalty: clamp(40 + b.trust, 0, 100),
    grievance: clamp(b.grudge, 0, 100),
    intelligence: 55,
    skill: 55,
    leadership: 60,
  };
}

export interface HouseRead {
  text: string;
  tone: 'good' | 'bad' | 'want' | 'plain';
}

/**
 * What you can tell about a house across a table.
 *
 * A crew member's chips come through `perceive`, which is noisy because how
 * well you know one man is a thing that varies. A house is different: its
 * temperament is the most public thing about it — the reputation line is
 * printed on the Rivals panel and every district in the city has an opinion.
 *
 * So the uncertainty here is not noise, it is coarseness. You get the same
 * five-band vocabulary the crew sheet uses and no more, and the thresholds a
 * register is actually testing against stay hidden. Knowing a house is
 * "hungry" still does not tell you whether hungry is hungry enough.
 */
export function houseRead(state: GameState, factionId: FactionId): HouseRead[] {
  const stats = houseStats(state, factionId);
  const band = (stat: NpcStatId): number => clamp(Math.floor(stats[stat] / 20), 0, 4);
  const say = (stat: NpcStatId) => STAT_BANDS[stat][band(stat)];

  return [
    { text: say('greed'), tone: band('greed') >= 3 ? 'want' : 'plain' },
    { text: say('ambition'), tone: band('ambition') >= 3 ? 'want' : 'plain' },
    { text: say('fear'), tone: band('fear') >= 3 ? 'bad' : 'plain' },
    {
      text: say('loyalty'),
      tone: band('loyalty') >= 3 ? 'good' : band('loyalty') <= 1 ? 'bad' : 'plain',
    },
  ];
}

function statsOf(state: GameState, sit: Sitdown): NpcStats | null {
  if (sit.npcId) return state.npcs[sit.npcId]?.stats ?? null;
  if (sit.factionId) return houseStats(state, sit.factionId as FactionId);
  // And the man selling you a shop, worked out from the district he is in.
  if (sit.deal) return sellerStats(state, sit.deal.defId, sit.deal.territoryId);
  return null;
}

// ------------------------------------------------------------- the room ----

export function openSitdown(
  state: GameState,
  kind: 'crew' | 'rival',
  targetId: string,
  reasonId: string,
): Check {
  const guard = canSitDownWith(state, targetId);
  if (!guard.ok) return guard;
  if (!REASON_BY_ID[reasonId]) return { ok: false, message: 'No reason to.' };

  const npc = kind === 'crew' ? state.npcs[targetId] : null;
  if (kind === 'crew' && !npc) return { ok: false, message: 'They are not here.' };
  if (kind === 'crew' && npc && (npc.status === 'dead' || npc.status === 'defected')) {
    return { ok: false, message: 'Not any more.' };
  }

  state.sitdown = {
    kind,
    reasonId,
    npcId: kind === 'crew' ? targetId : null,
    factionId: kind === 'rival' ? (targetId as FactionId) : null,
    beats: [],
    revealed: [],
    familiarityBefore: npc ? Math.round(npc.familiarity) : 0,
    pending: null,
    patience: SITDOWN.patience,
    done: false,
    walkedOut: false,
    outcome: null,
  };
  return { ok: true, message: '' };
}

/** A register on the table, and why you cannot use it if you cannot. */
export interface Option {
  def: RegisterDef;
  /** Set when it is visible but unusable. Mirrors the memo's convention. */
  disabledReason: string | null;
}

/**
 * What is on the table right now.
 *
 * A register with `needs` is not listed at all until the tag that unlocks it
 * has been revealed in this conversation — that is the whole mechanic, and a
 * greyed-out row would give away that there is something to find.
 *
 * A register you simply cannot pay for is a different matter: it is shown, and
 * shown as unaffordable, because "you have not got it" is information the
 * player is entitled to before they spend a beat looking for it.
 */
export function sitdownOptions(state: GameState): Option[] {
  const sit = state.sitdown;
  if (!sit || sit.done) return [];
  const used = new Set(sit.beats.map((b) => b.registerId));
  const funds = state.org.cash + state.org.dirtyCash;

  /*
     A question narrows the room, and that narrowing is the mechanism.

     While he is waiting on an answer the table holds only answers to what he
     asked — a question you can talk past is not a question, and the whole
     point of him asking is that your next move becomes a reply rather than a
     free pick. Answers never appear otherwise; they exist for as long as the
     question does and no longer.
  */
  const pool = sit.pending
    ? ANSWER_REGISTERS.filter((r) => r.answers === sit.pending)
    : sit.kind === 'crew'
      ? CREW_REGISTERS
      : sit.kind === 'seller'
        ? SELLER_REGISTERS
        : RIVAL_REGISTERS;

  return pool
    .filter((r) => !used.has(r.id) && (!r.needs || sit.revealed.includes(r.needs)))
    .map((def) => ({
      def,
      disabledReason:
        def.cost && def.cost > funds ? `You have not got ${money(def.cost)}` : null,
    }));
}

/** The ones you could actually say. */
export function availableRegisters(state: GameState): RegisterDef[] {
  return sitdownOptions(state)
    .filter((o) => o.disabledReason === null)
    .map((o) => o.def);
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Whether a register lands, and by how far.
 *
 * Read against the *true* stat, never the perceived one — that is the bet the
 * player is making. Everything that moves the threshold is something the
 * player could reasonably have known: how the man regards them, how good they
 * are at this, and whether he is carrying something that has not been named.
 */
function lands(state: GameState, sit: Sitdown, reg: RegisterDef): boolean {
  const stats = statsOf(state, sit);
  if (!stats) return false;

  let help =
    (state.player.attributes.leadership / 100) * SITDOWN.leadershipHelp +
    (stats.respectForBoss / 100) * SITDOWN.regardHelp;

  // A man with a real grudge answers almost nothing until it is named. The
  // registers that work *through* the grievance are exempt, which is what
  // makes listening the right opener far more often than it looks.
  const worksThroughIt = reg.against === 'grievance' || reg.id === 'name_it';
  if (!worksThroughIt) {
    help -= (stats.grievance / 100) * SITDOWN.grievanceResistance;
  }

  const value = stats[reg.against as NpcStatId];
  return reg.wants === 'high' ? value + help >= reg.threshold : value - help <= reg.threshold;
}

export function chooseRegister(state: GameState, _rng: Rng, registerId: string): Check {
  const sit = state.sitdown;
  if (!sit || sit.done) return { ok: false, message: 'Nobody is in the room.' };

  const reg = REGISTER_BY_ID[registerId] ?? SELLER_REGISTER_BY_ID[registerId];
  if (!reg) return { ok: false, message: 'Not something you can say.' };
  if (!availableRegisters(state).some((r) => r.id === registerId)) {
    return { ok: false, message: 'Not on the table.' };
  }
  if (reg.cost && !spend(state, reg.cost)) {
    return { ok: false, message: 'You could not cover it.' };
  }

  const landed = lands(state, sit, reg);
  sit.beats.push({ registerId: reg.id, landed, text: landed ? reg.landed : reg.missed });

  /*
     Answering clears the question, whether or not the answer landed. He asked,
     you said something; what he made of it is the beat's business and not a
     reason to ask again.

     Cleared before the `asks` below, so an answer that itself provokes a new
     question would work rather than being wiped by its own resolution.
  */
  if (reg.answers) sit.pending = null;

  // And a landing can end with him wanting something from you.
  if (landed && reg.asks) sit.pending = reg.asks;
  if (landed && reg.reveals && !sit.revealed.includes(reg.reveals)) {
    sit.revealed.push(reg.reveals);
  }

  /*
     A register that commits you commits you at the moment you say it, not at
     the end of the conversation — and only when it landed, because a promise
     the other man did not believe is not a promise he is holding you to.
  */
  if (landed && reg.promises && sit.npcId) {
    makePromise(state, sit.npcId, reg.promises);
  }

  /*
     And what it actually puts down, if anything.

     Applied here beside the promise rather than in `paid` below, because
     `paid` switches on what the *reason* wanted and this is a property of the
     words said. It also means a register that calms somebody works even in a
     conversation that does not otherwise get where it was going, which is
     right: telling a frightened man he is covered helps him whether or not you
     also found out what else was wrong.
  */
  if (landed && reg.calms && sit.npcId) {
    const man = state.npcs[sit.npcId];
    if (man) {
      man.stats[reg.calms] = clamp(man.stats[reg.calms] - SITDOWN.calmed, 0, 100);
    }
  }

  /*
     And what it did to the number on the table, when there is one.

     Beside the promise and the calm rather than inside `paid` below, for the
     same reason those are: this is a property of the words that were said, not
     of what the conversation was for.
  */
  if (sit.deal) dealBeat(state, reg.id, landed);

  // Using it is how you get better at it, whether or not it worked.
  trainAttribute(state, reg.trains, landed ? 1 : 0.5);

  /*
     Familiarity rises on a miss as well as a hit, and this is the rule the
     whole mechanic rests on. If a wasted beat bought nothing, the correct play
     would be to only ever sit down with people you already read well — which
     is exactly the set of people a sit-down has nothing left to tell you
     about.
  */
  const npc = sit.npcId ? state.npcs[sit.npcId] : null;
  if (npc) {
    npc.familiarity = clamp(
      npc.familiarity + SITDOWN.familiarityPerBeat + (landed ? SITDOWN.familiarityOnLanded : 0),
      0,
      100,
    );
  }

  /*
     And what the exchange cost him.

     Spent after the beat rather than before, so the thing you just said always
     gets said — a man does not walk out in the middle of your sentence. A
     misread costs extra because being asked the wrong question by somebody who
     is supposed to know you is what wears out a room; landing something real
     buys a little back, but never as much as the beat cost, so even a
     perfectly read conversation runs down.
  */
  sit.patience -=
    SITDOWN.patiencePerBeat +
    (landed ? -SITDOWN.patienceBackOnLanded : SITDOWN.patienceOnMiss);

  if (sit.patience <= 0) heWalks(state, sit);
  return { ok: true, message: '' };
}

/**
 * How close he is to standing up, in the words somebody in the room would use.
 *
 * Never a number, for the same reason no stat on the crew sheet is one. What a
 * boss has to go on is the way a man is sitting, and the whole decision this
 * rework exists to create — is there another question worth asking? — is read
 * off this and nothing else.
 */
export function patienceRead(sit: Sitdown): string {
  const left = sit.patience / SITDOWN.patience;
  if (left > 0.75) return 'settled, in no hurry';
  if (left > 0.5) return 'still with you';
  if (left > 0.25) return 'glancing at the door';
  return 'already half standing';
}

/**
 * You stand up.
 *
 * The decision the whole rework exists for. Everything won is kept — `settle`
 * pays out on what was revealed, whenever it is called — and nothing is
 * charged for going early. What you give up is whatever the next question
 * might have been.
 */
export function endSitdown(state: GameState): void {
  const sit = state.sitdown;
  if (!sit || sit.done) return;
  settle(state, sit);
}

/**
 * He stands up, which is the expensive way for a room to empty.
 *
 * A man who walks out on his boss takes something with him, and it is not the
 * grudge that matters most — it is what he now thinks of you. `respectForBoss`
 * feeds wages, defection and informing, so this is a bill that arrives later
 * and somewhere else, which is the shape every cost in this game prefers.
 */
function heWalks(state: GameState, sit: Sitdown): void {
  sit.walkedOut = true;
  const npc = sit.npcId ? state.npcs[sit.npcId] : null;
  if (npc) {
    npc.stats.grievance = clamp(npc.stats.grievance + SITDOWN.walkedGrievance, 0, 100);
    npc.stats.respectForBoss = clamp(
      npc.stats.respectForBoss - SITDOWN.walkedRegard,
      0,
      100,
    );
    addNote(npc, state.day, 'Had enough, and said so by leaving.', 'bad');
  }
  settle(state, sit);
  sit.outcome = sit.deal
    ? dealOutcome(sit)
    : npc
      ? `${npc.name} had heard enough. They were not finished being asked, and they left anyway.`
      : 'They had heard enough.';
}

/** Kept for the callers that mean "the room is over", whoever ended it. */
export function leaveSitdown(state: GameState): void {
  endSitdown(state);
}

export function clearSitdown(state: GameState): void {
  state.sitdown = null;
}

// ------------------------------------------------------------- outcomes ----

function settle(state: GameState, sit: Sitdown): void {
  sit.done = true;
  const reason = REASON_BY_ID[sit.reasonId];
  const target = sit.npcId ?? sit.factionId ?? '';
  state.flags[satKey(target)] = state.day;

  /*
     A room with a shop in it settles on the shop.

     `REASON_BY_ID` has no entry for buying and should not — a reason is what
     you wanted *from a person you already know*, and a man selling premises
     wants one thing that is written on the deal. So the outcome is the number
     you got to, which is the only thing that was ever at stake here.
  */
  if (sit.deal) {
    sit.outcome = dealOutcome(sit);
    return;
  }

  const got = reason ? sit.revealed.includes(reason.wants) : false;
  sit.outcome = got ? paid(state, sit, reason!.wants) : missed(state, sit);
}

/** What the room came to, when what was in it was a shop. */
function dealOutcome(sit: Sitdown): string {
  const deal = sit.deal;
  if (!deal) return 'Nothing came of it.';
  const where = territoryDef(deal.territoryId).name;
  const what = BUSINESS_BY_ID[deal.defId]?.name.toLowerCase() ?? 'the place';
  if (sit.walkedOut) {
    return `That is the end of it. The ${what} in ${where} is not for sale to you.`;
  }
  const moved = deal.listed - deal.ask;
  const price = money(deal.ask);
  if (moved > 0) return `${price} for the ${what} in ${where}, which is ${money(moved)} under the asking.`;
  if (moved < 0) return `${price} for the ${what} in ${where}. You are paying over the odds for it.`;
  return `${price} for the ${what} in ${where}, which is what it is worth.`;
}

function nameOf(state: GameState, sit: Sitdown): string {
  if (sit.npcId) return state.npcs[sit.npcId]?.name ?? 'They';
  if (sit.factionId) return houseName(state, sit.factionId as FactionId);
  return 'They';
}

function missed(state: GameState, sit: Sitdown): string {
  const npc = sit.npcId ? state.npcs[sit.npcId] : null;
  const gained = npc ? Math.round(npc.familiarity) - sit.familiarityBefore : 0;
  if (npc && gained > 0) {
    addNote(npc, state.day, 'Sat down with you. Nothing was settled.', 'neutral');
    return `You did not get what you came for. You know ${npc.name} better than you did.`;
  }
  return `Nothing came of it.`;
}

function paid(state: GameState, sit: Sitdown, wants: string): string {
  const npc = sit.npcId ? state.npcs[sit.npcId] : null;
  const name = nameOf(state, sit);

  switch (wants) {
    case 'settled': {
      if (!npc) break;
      npc.stats.grievance = clamp(npc.stats.grievance - SITDOWN.settledGrievance, 0, 100);
      npc.stats.loyalty = clamp(npc.stats.loyalty + SITDOWN.settledLoyalty, 0, 100);
      remember(npc, state.day, 'was_believed');
      // Being heard is the quietest of the good things, and it still counts.
      somethingGood(state, npc);
      addNote(npc, state.day, 'Told you what was wrong, and you heard it.', 'good');
      addLog(state, `Whatever ${name} was carrying, it is off the table.`, 'crew');
      return `${name} has put it down.`;
    }
    case 'owed': {
      if (!npc) break;
      npc.stats.loyalty = clamp(npc.stats.loyalty + SITDOWN.promiseLoyalty, 0, 100);
      addNote(npc, state.day, 'You told them they have the next one.', 'good');
      addLog(state, `${name} is expecting to be named on the next job.`, 'crew');
      return `${name} is holding you to it.`;
    }
    case 'tested': {
      if (!npc) break;
      addNote(npc, state.day, 'You put a lie in front of them and watched.', 'neutral');
      if (npc.isSkimming) {
        addLog(state, `${name} is taking from you. You are fairly sure of it now.`, 'failure');
        return `They are taking. They do not know that you know.`;
      }
      return `Whatever is wrong with the numbers, it is not them.`;
    }
    case 'talked': {
      if (!npc) break;
      // He has told you about the people he actually knows, so you now read
      // them better — which is the tie system finally becoming something the
      // player can act on rather than only read.
      let moved = 0;
      for (const tie of npc.ties) {
        const other = state.npcs[tie.id];
        if (!other || other.status === 'dead' || other.status === 'defected') continue;
        other.familiarity = clamp(other.familiarity + 8, 0, 100);
        moved++;
      }
      addNote(npc, state.day, 'Told you how the room actually sits.', 'neutral');
      return moved > 0
        ? `You see ${moved} of your people more clearly than you did this morning.`
        : `They talk, but they do not know anyone well enough to be useful.`;
    }
    case 'intent': {
      const faction = sit.factionId ? state.factions[sit.factionId] : null;
      const rep = faction?.leader?.reputation;
      addLog(state, `You have a read on what ${name} is reaching for.`, 'event');
      return rep ? `${name}: ${rep}` : `You know what they want now.`;
    }
    case 'dealt': {
      if (!sit.factionId) break;
      adjustBond(state, 'player', sit.factionId as FactionId, {
        trust: SITDOWN.rivalTrust,
        respect: SITDOWN.rivalRespect,
      });
      addLog(state, `Something was agreed with ${name}. Not everything.`, 'event');
      return `${name} will keep talking.`;
    }
    case 'warned': {
      if (!sit.factionId) break;
      adjustBond(state, 'player', sit.factionId as FactionId, {
        respect: SITDOWN.rivalRespect,
        grudge: SITDOWN.warnGrudge,
      });
      addLog(state, `${name} has been told, in a room, once.`, 'event');
      return `They heard it. They will not enjoy having heard it.`;
    }
    default:
      break;
  }
  return `It went the way you wanted.`;
}

/** Everyone in the crew you could reasonably ask for a room. */
export function sitDownCandidates(state: GameState): Npc[] {
  return Object.values(state.npcs).filter(
    (n) => n.status === 'active' || n.status === 'busy',
  );
}
