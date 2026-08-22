/**
 * Relationships, war, and the things organizations say to each other.
 *
 * The relationship matrix is the single source of truth. War is not a flag —
 * it is what the bottom of the scale means, so anything that moves a
 * relationship can start or end one: taking a family's ground, leaning on
 * their people, paying tribute, taking somebody's man.
 *
 * The matrix covers rival-to-rival as well as rival-to-player, which is what
 * lets the families fall out, fight and make peace without the player being
 * involved at all.
 */

import { Rng, clamp } from './rng';
import type { Faction, FactionBond, GameState, Npc } from './types';
import { addEvidence, addLog, formatMoney } from './util';
import { addHeat } from './heat';
import { addNote, crewList } from './npc';
import { remember } from './memory';
import { takeBack, spend } from './economy';
import { playerInfluence, territoryDef, territoryList } from './territory';
import type { Territory } from './types';
import {
  GROUND_LOST,
  AI,
  ALL_FACTIONS,
  RELATIONSHIP_STATES,
  RIVAL_IDS,
  type FactionId,
} from '../config/factions';
import { FEAR, INFLUENCE_FROM } from '../config/economy';
import { gainFear, gainRespect, trainAttribute } from './player';
import { cover } from './perception';
import { warCasualty } from './capos';
import { rollAssassination } from './succession';
import {
  ALLIANCE,
  BOND,
  PEACE_GRUDGE,
  DIPLOMACY,
  DIPLOMATIC_ACTION_BY_ID,
  WAR,
  type DiplomaticActionId,
} from '../config/diplomacy';
import { houseShort } from './houses';

/*
 * Local copies of two one-line readers that also live in faction.ts.
 * faction.ts needs this module for war and relationships, so importing back
 * the other way would make a cycle — duplicating two trivial accessors is the
 * cheaper price.
 */
function rivals(state: GameState): Faction[] {
  return RIVAL_IDS.map((id) => state.factions[id]).filter(Boolean);
}

function factionInfluence(t: Territory, id: FactionId): number {
  return t.influence[id] ?? 0;
}

// ------------------------------------------------------------- relations ---

/** The record of how `from` stands with `to`, created on first use. */
export function bond(state: GameState, from: FactionId, to: FactionId): FactionBond {
  const faction = state.factions[from];
  if (faction) {
    const existing = faction.bonds[to];
    if (existing) return existing;
    const fresh: FactionBond = { grudge: 0, respect: 0, trust: 0, warSince: null };
    faction.bonds[to] = fresh;
    return fresh;
  }
  // The player has no faction record, so their side of every pair is read off
  // the other party. Symmetry is what makes that correct rather than a bodge.
  const other = state.factions[to];
  if (other) return bond(state, to, from);
  return { grudge: 0, respect: 0, trust: 0, warSince: null };
}

/**
 * The single figure everything coarse reads: the panels, the log copy, and the
 * AI judgements that only want to know whether these two get on.
 *
 * Derived rather than stored, so there is still exactly one source of truth —
 * it is just three numbers now instead of one. The weights are set so the
 * result lands in the range the old single score occupied, because every
 * threshold in this game was tuned against those numbers and re-tuning all of
 * them would have made this refactor a rebalance in disguise.
 */
export function relationship(state: GameState, from: FactionId, to: FactionId): number {
  if (from === to) return 100;
  const b = bond(state, from, to);
  return clamp(b.trust * BOND.weightTrust - b.grudge * BOND.weightGrudge, -100, 100);
}

export interface BondDelta {
  grudge?: number;
  respect?: number;
  trust?: number;
}

/**
 * Move specific dimensions. Symmetric — both sides of the pair are written,
 * because two organizations do not privately disagree about their history.
 */
export function adjustBond(
  state: GameState,
  a: FactionId,
  b: FactionId,
  delta: BondDelta,
): void {
  if (a === b) return;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as [FactionId, FactionId][]) {
    if (!state.factions[from]) continue;
    const record = bond(state, from, to);
    record.grudge = clamp(record.grudge + (delta.grudge ?? 0), 0, 100);
    record.respect = clamp(record.respect + (delta.respect ?? 0), -100, 100);
    record.trust = clamp(record.trust + (delta.trust ?? 0), -100, 100);
  }
}

/**
 * The compatible front door: a signed nudge to the overall standing.
 *
 * Most of the twenty-odd sites that move a relationship mean something simple
 * and directional — an insult, a courtesy, a slow drift back toward
 * indifference — and forcing every one of them to name a dimension would be
 * ceremony rather than clarity. Negative goes to grudge, which is what makes
 * organizations act; positive settles the grudge first and only then buys
 * goodwill, because you cannot make somebody like you while they are still
 * owed an apology.
 *
 * The sites that mean something specific — betrayal, a war won, a deal kept —
 * call `adjustBond` and say so.
 */
export function adjustRelationship(
  state: GameState,
  a: FactionId,
  b: FactionId,
  delta: number,
): void {
  if (a === b) return;
  if (delta < 0) {
    adjustBond(state, a, b, { grudge: -delta });
    return;
  }
  const current = bond(state, a, b).grudge;
  const settled = Math.min(current, delta);
  adjustBond(state, a, b, { grudge: -settled, trust: (delta - settled) * 0.5 });
}

/** Sets the whole bond to a standing, for tests and for handing over a state. */
export function setRelationship(
  state: GameState,
  a: FactionId,
  b: FactionId,
  value: number,
): void {
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as [FactionId, FactionId][]) {
    if (!state.factions[from]) continue;
    const record = bond(state, from, to);
    if (value < 0) {
      record.grudge = clamp(-value / BOND.weightGrudge, 0, 100);
      record.trust = 0;
    } else {
      record.grudge = 0;
      record.trust = clamp(value / BOND.weightTrust, -100, 100);
    }
  }
}

/**
 * At war, which is now a fact rather than a threshold.
 *
 * The old definition — standing at or below AT_WAR_BELOW — meant every system
 * that moved a relationship could start or end a war by accident, and the
 * clamping that prevented it was the most delicate code in the file.
 */
export function atWar(state: GameState, a: FactionId, b: FactionId): boolean {
  if (a === b) return false;
  return bond(state, a, b).warSince !== null;
}

export function playerWars(state: GameState): Faction[] {
  return rivals(state).filter((f) => atWar(state, 'player', f.id));
}

export function relationshipLabelFor(value: number): string {
  return RELATIONSHIP_STATES.find((r) => value >= r.min)?.label ?? 'Neutral';
}

/**
 * Who will actually turn out for you.
 *
 * Gated on trust as well as standing, which is the point of having the
 * dimension at all: an alliance is an arrangement you expect to hold, and
 * somebody who merely does not dislike you is not that. A family that has been
 * betrayed once will decline to be allied with anybody, however warmly it feels.
 */
export function alliesOf(state: GameState, id: FactionId): FactionId[] {
  return ALL_FACTIONS.filter((other) => {
    if (other === id) return false;
    if (atWar(state, id, other)) return false;
    const b = bond(state, id, other);
    return b.trust >= BOND.allianceTrust && relationship(state, id, other) >= BOND.allianceStanding;
  });
}

/**
 * Weekly upkeep on every pair.
 *
 * Grudges fade fastest, trust is slow in both directions, and respect settles
 * toward what the organization can currently actually do — a family that was
 * frightening five years ago and is four men now does not keep the reputation.
 */
export function tickBonds(state: GameState, districtsOf: (id: FactionId) => number): void {
  for (const from of ALL_FACTIONS) {
    const faction = state.factions[from];
    if (!faction) continue;

    for (const to of ALL_FACTIONS) {
      if (to === from) continue;
      const record = bond(state, from, to);
      const fighting = record.warSince !== null;

      if (!fighting) {
        record.grudge = Math.max(0, record.grudge - BOND.grudgeDecayPerWeek);
        // Peace held for another week is the only way ordinary trust is built.
        record.trust = clamp(record.trust + BOND.trustPerPeacefulWeek, -100, 100);
        if (record.trust >= BOND.allianceTrust) {
          record.trust = clamp(record.trust + BOND.trustPerAlliedWeek, -100, 100);
        }
      } else {
        record.trust = clamp(record.trust - BOND.trustDecayPerWeek, -100, 100);
      }

      /*
         Respect tracks what they can do, not what they once did — and until
         now "what they can do" meant strength and ground and nothing else.

         `config/diplomacy.ts` says respect is for *"an organization that has
         beaten a case, survived a war and holds half the city"*. Two of those
         three were in the formula. The third was the one a career that never
         goes to war can actually earn, and it was not there — so
         `ladder.probe` measured the best respect any family ever holds for a
         player at 29 / 29 / 31 across thirty-six careers, a distribution flat
         enough that no bar on it could be a decision. The demand-tribute door
         it gates was open in two careers out of thirty-six.

         Beating a case is the peaceful half of a reputation. Only the player
         is ever investigated in this game, so the term only applies to them —
         which is honest rather than lopsided: the other families are read on
         what the player can see of them, and a rival's court record is not
         something the player has.
      */
      const beaten =
        to === 'player'
          ? Object.values(state.law.investigations).filter(
              (i) => i.status === 'closed' || i.verdict === 'acquitted',
            ).length
          : 0;
      const target = clamp(
        factionStrength(state, to) * BOND.respectFromStrength +
          districtsOf(to) * BOND.respectFromDistricts +
          Math.min(BOND.respectFromCasesCap, beaten * BOND.respectFromCaseBeaten) +
          (to === 'player' ? state.org.respect * BOND.respectFromStanding : 0),
        -100,
        100,
      );
      const step = Math.min(BOND.respectSettlePerWeek, Math.abs(target - record.respect));
      record.respect += record.respect < target ? step : -step;
    }
  }
}

/** Every pair currently shooting at each other, player included. */
export function activeWars(state: GameState): [FactionId, FactionId][] {
  const wars: [FactionId, FactionId][] = [];
  for (let i = 0; i < ALL_FACTIONS.length; i++) {
    for (let j = i + 1; j < ALL_FACTIONS.length; j++) {
      const a = ALL_FACTIONS[i];
      const b = ALL_FACTIONS[j];
      if (atWar(state, a, b)) wars.push([a, b]);
    }
  }
  return wars;
}

// -------------------------------------------------------------- strength ---

/**
 * What the player can actually put on the street.
 *
 * Headcount matters most, but a crew of frightened amateurs is not an army —
 * quality scales the whole thing, and people who are hurt or inside do not
 * count at all.
 */
export function playerStrength(state: GameState): number {
  const available = crewList(state).filter(
    (n) => n.status === 'active' || n.status === 'busy',
  );
  if (available.length === 0) return 0;

  const quality =
    available.reduce(
      (sum, n) => sum + (n.stats.skill * 0.4 + n.stats.courage * 0.4 + n.stats.discipline * 0.2),
      0,
    ) /
    available.length /
    50;

  return clamp(available.length * 2.2 * quality, 0, 100);
}

export function factionStrength(state: GameState, id: FactionId): number {
  return id === 'player' ? playerStrength(state) : (state.factions[id]?.strength ?? 0);
}

/** Districts both sides are standing in — where a war is actually fought. */
function contestedBetween(state: GameState, a: FactionId, b: FactionId) {
  return territoryList(state).filter((t) => {
    const inA = a === 'player' ? playerInfluence(t) : factionInfluence(t, a);
    const inB = b === 'player' ? playerInfluence(t) : factionInfluence(t, b);
    return inA >= 8 && inB >= 8;
  });
}

// ------------------------------------------------------------------- war ---

function applyPlayerCasualties(
  state: GameState,
  rng: Rng,
  margin: number,
  enemy: string,
  /** Fraction of the week's damage that landed on an ally instead. */
  absorbed = 0,
): void {
  const available = crewList(state).filter(
    (n) => n.status === 'active' || n.status === 'busy',
  );
  if (available.length === 0) return;

  let count = Math.min(
    available.length,
    rng.int(WAR.playerInjured[0], WAR.playerInjured[1]) + (margin > 0.5 ? 1 : 0),
  );
  if (absorbed > 0) {
    // Rounded probabilistically rather than to the nearest whole man. At one
    // or two casualties a week, rounding would swallow the entire benefit of
    // having an ally in the street with you.
    const reduced = count * (1 - absorbed);
    count = Math.floor(reduced) + (rng.chance(reduced % 1) ? 1 : 0);
  }
  if (count <= 0) return;

  for (const npc of rng.sample(available, count)) {
    if (rng.chance(WAR.fatalityChance)) {
      npc.status = 'dead';
      npc.unavailableUntilDay = null;
      addNote(npc, state.day, `Killed in the war with ${enemy}.`, 'bad');
      addLog(state, `${npc.name} was killed. The ${enemy} war did that.`, 'failure');
      /*
       * The people who were close to him remember losing him.
       *
       * This is where two systems built weeks apart meet without either
       * knowing about the other: the tie says who was close, and the memory is
       * what that closeness costs when the war takes him.
       */
      for (const other of crewList(state)) {
        const tie = other.ties.find((t) => t.id === npc.id);
        if (tie && tie.trust >= 25) {
          remember(other, state.day, 'lost_a_friend', npc.id, tie.trust / 60);
        }
      }
    } else {
      npc.status = 'injured';
      npc.unavailableUntilDay =
        state.day + rng.int(WAR.playerInjuryDays[0], WAR.playerInjuryDays[1]);
      npc.stats.fear = clamp(npc.stats.fear + 12, 0, 100);
      addNote(npc, state.day, `Hurt fighting the ${enemy}.`, 'bad');
    }
  }
}

/** An ally who turned out for somebody this week, and how far in they are. */
interface Support {
  id: FactionId;
  strength: number;
  /** In the war themselves, as opposed to quietly helping a friend. */
  committed: boolean;
}

/**
 * Who else turns up on `side` against `enemy`.
 *
 * The player is never in this list. Every other faction here is an AI that
 * decides things on its own; the player's people go out when the player says
 * so, and conscripting them into a war they did not choose would be taking the
 * one thing this game is about. They are asked instead — see the ally event in
 * events.ts, which is the player's half of the same arrangement.
 */
function supportersFor(state: GameState, side: FactionId, enemy: FactionId): Support[] {
  const help: Support[] = [];
  for (const id of alliesOf(state, side)) {
    if (id === enemy || id === 'player') continue;
    const faction = state.factions[id];
    if (!faction) continue;
    // Somebody who has already been beaten half to death is no use to you.
    if (faction.warWeariness >= ALLIANCE.wearinessStaysHome) continue;
    // Allied to both sides: an alliance with one is not a reason to shoot the
    // other, so they sit this one out and keep both.
    if (alliesOf(state, enemy).includes(id)) continue;

    const committed = atWar(state, id, enemy);
    let share = committed ? ALLIANCE.committedShare : ALLIANCE.quietShare;
    // Already fighting a war that is not this one.
    const elsewhere = ALL_FACTIONS.some(
      (other) => other !== id && other !== enemy && atWar(state, id, other),
    );
    if (elsewhere) share *= ALLIANCE.stretchedShare;

    const strength = faction.strength * share;
    if (strength <= 0) continue;
    help.push({ id, strength, committed });
  }
  return help;
}

/** One week of a war between two organizations, and whoever turned out for them. */
function resolveClash(state: GameState, rng: Rng, a: FactionId, b: FactionId): void {
  const ground = contestedBetween(state, a, b);
  const battlefield = ground.length ? rng.pick(ground) : null;

  const helpFor: Record<string, Support[]> = {
    [a]: supportersFor(state, a, b),
    [b]: supportersFor(state, b, a),
  };

  const roll = (id: FactionId) => {
    const own = factionStrength(state, id);
    const lent = helpFor[id].reduce((sum, s) => sum + s.strength, 0);
    let power = (own + lent) * rng.float(WAR.clashVariance[0], WAR.clashVariance[1]);
    // Fighting somewhere you are established is worth something.
    if (battlefield) {
      const here =
        id === 'player' ? playerInfluence(battlefield) : factionInfluence(battlefield, id);
      if (here >= 40) power *= WAR.homeAdvantage;
    }
    return power;
  };

  const powerA = roll(a);
  const powerB = roll(b);
  const total = powerA + powerB;
  if (total <= 0) return;

  const winner = powerA >= powerB ? a : b;
  const loser = winner === a ? b : a;
  const margin = Math.abs(powerA - powerB) / total;

  // --- casualties on the losing side ------------------------------------
  const loserName = houseShort(state, loser);
  const winnerName = houseShort(state, winner);

  // The week's damage to the losing side, before it is shared out. Committed
  // allies are standing in the same street, so some of it lands on them
  // instead — which is the whole point of them being there.
  const damage = rng.float(WAR.rivalCasualties[0], WAR.rivalCasualties[1]) * (0.5 + margin);
  const committed = helpFor[loser].filter((s) => s.committed);
  const absorbed = committed.length > 0 ? ALLIANCE.casualtyShare : 0;

  if (loser === 'player') {
    applyPlayerCasualties(state, rng, margin, winnerName, absorbed);
    // A bad enough week, in a war you were always losing, can reach past the
    // crew entirely. Gated hard — see rollAssassination. An ally standing with
    // you counts toward the strength that keeps this from being possible.
    const ownStrength = playerStrength(state) + helpFor.player?.reduce((s, h) => s + h.strength, 0);
    const ratio =
      factionStrength(state, winner) > 0 ? ownStrength / factionStrength(state, winner) : 1;
    if (rollAssassination(state, rng, margin, ratio, winnerName)) return;
  } else {
    const faction = state.factions[loser];
    faction.strength = clamp(faction.strength - damage * (1 - absorbed), 0, 100);
    // Capped: every consumer clamps this anyway, and an uncapped counter that
    // reached 911 in a measured six-year war made "tired" and "annihilated"
    // the same reading for five and a half of those years.
    faction.warWeariness = Math.min(WAR.wearinessMax, faction.warWeariness + WAR.wearinessPerLoss);
  }

  for (const ally of committed) {
    const faction = state.factions[ally.id];
    if (!faction) continue;
    faction.strength = clamp(faction.strength - (damage * absorbed) / committed.length, 0, 100);
    faction.warWeariness = Math.min(
      WAR.wearinessMax,
      faction.warWeariness + WAR.wearinessPerLoss * 0.6,
    );
  }

  /*
   * Being seen helping.
   *
   * An ally who is not in the war took no casualties, and this is the bill
   * instead: the other side watched them hand over money and men, and files it.
   * Enough weeks of that and the relationship crosses the war line on its own —
   * which is how a fight between two families becomes a fight between four
   * without anybody having decided to widen it.
   */
  for (const [side, other] of [
    [a, b],
    [b, a],
  ] as [FactionId, FactionId][]) {
    for (const helper of helpFor[side]) {
      if (helper.committed) continue;
      adjustRelationship(state, helper.id, other, ALLIANCE.quietHelpRelationship);
    }
  }

  if (winner !== 'player') {
    // Even winning costs something.
    state.factions[winner].warWeariness = Math.min(
      WAR.wearinessMax,
      state.factions[winner].warWeariness + WAR.wearinessPerLoss * 0.25,
    );
  }

  // --- ground changes hands ---------------------------------------------
  if (battlefield) {
    const swing = rng.float(WAR.territorySwing[0], WAR.territorySwing[1]) * (0.5 + margin);
    const take = (id: FactionId, amount: number) => {
      if (id === 'player') {
        battlefield.influence.player = clamp(
          (battlefield.influence.player ?? 0) + amount,
          0,
          100,
        );
      } else {
        battlefield.influence[id] = clamp((battlefield.influence[id] ?? 0) + amount, 0, 100);
      }
    };
    take(winner, swing);
    take(loser, -swing);
  }

  // A war reaching somebody with a name. Only the losing side, only sometimes,
  // and it is the thing that makes a long war legible: strength points falling
  // is a graph, and burying a capo is a week the family remembers.
  if (loser !== 'player') warCasualty(state, rng, loser);

  // --- everybody pays for the noise -------------------------------------
  // Whoever is fighting, the city reads about it. This is the edge that was
  // missing: two families could shoot at each other for two years and the only
  // entity in the simulation that noticed was a case file.
  cover(state, rng, 'war', {
    territoryId: battlefield?.id ?? null,
    named: a === 'player' || b === 'player',
  });

  if (a === 'player' || b === 'player') {
    addHeat(state, WAR.heatPerClash, 'street', 'open warfare');
    // A war you are visibly winning is the cheapest fear there is.
    if (winner === 'player') gainFear(state, FEAR.fromWarClash);
    addEvidence(state, {
      day: state.day,
      source: 'violence',
      strength: WAR.evidencePerClash,
      npcIds: [],
      detail: `Open violence between the organization and the ${
        houseShort(state, a === 'player' ? b : a)
      }.`,
    });
    const where = battlefield ? ` in ${territoryDef(battlefield.id).name}` : '';
    addLog(
      state,
      winner === 'player'
        ? `You had the better of the ${loserName} this week${where}.`
        : `The ${winnerName} had the better of it this week${where}.`,
      winner === 'player' ? 'success' : 'failure',
    );

    // An alliance you cannot see working is an alliance you will not pay for.
    // Both halves are worth saying: who stood with you, and who stood with them.
    const enemyOfPlayer = a === 'player' ? b : a;
    for (const [side, label] of [
      ['player' as FactionId, 'with you'],
      [enemyOfPlayer, `with the ${houseShort(state, enemyOfPlayer)}`],
    ] as [FactionId, string][]) {
      for (const helper of helpFor[side] ?? []) {
        addLog(
          state,
          helper.committed
            ? `The ${houseShort(state, helper.id)} were in it ${label}.`
            : `The ${houseShort(state, helper.id)} did not fight, but their people and their money were ${label}.`,
          side === 'player' ? 'success' : 'failure',
        );
      }
    }
  } else if (ground.some((t) => playerInfluence(t) >= 10)) {
    // A war between two other families, fought where you can see it.
    addLog(state, `The ${winnerName} and the ${loserName} are fighting openly.`, 'heat');
  }
}

/** Weekly: run every war, charge for it, and let the exhausted recover. */
export function tickWars(state: GameState, rng: Rng): void {
  for (const [a, b] of activeWars(state)) {
    // A clash can remove the player entirely. Nothing after that is this week's
    // business — the succession memo is, and the rest resumes next week.
    if (state.gameOver) return;
    resolveClash(state, rng, a, b);
  }

  // Wars cost money to keep running.
  const playerAtWar = playerWars(state);
  if (playerAtWar.length > 0) {
    const crew = crewList(state).filter((n) => n.status !== 'dead').length;
    const cost = crew * WAR.playerWarCostPerCrew * playerAtWar.length;
    if (!spend(state, cost) && crew > 0) {
      addLog(state, 'You cannot afford to keep fighting. People notice.', 'failure');
      for (const npc of crewList(state)) {
        npc.stats.loyalty = clamp(npc.stats.loyalty - 4, 0, 100);
      }
    }
  }

  for (const faction of rivals(state)) {
    const fighting = ALL_FACTIONS.some(
      (other) => other !== faction.id && atWar(state, faction.id, other),
    );
    if (fighting) {
      faction.wealth = Math.max(0, faction.wealth - WAR.rivalWarCost);
    } else {
      /*
       * Peace lets them rebuild and forget — if they can pay for it.
       *
       * Recovery used to be unconditional, so every family sat pegged at
       * strength 100 forever and the strength lead that starting a war
       * requires became unreachable by construction. That single line was the
       * measured cause of zero rival wars in thirty years across six seeds:
       * nobody could ever be stronger than anybody, so nobody ever moved.
       */
      const cost = WAR.rivalRecoveryPerWeek * AI.recoveryCostPerPoint;
      if (faction.strength < 100 && faction.wealth >= cost) {
        faction.wealth -= cost;
        faction.strength = clamp(faction.strength + WAR.rivalRecoveryPerWeek, 0, 100);
      }
      faction.warWeariness = Math.max(0, faction.warWeariness - WAR.wearinessDecayPerWeek);
    }
  }
}

/** Ends a war, leaving the resentment that made it. */
export function makePeace(state: GameState, a: FactionId, b: FactionId): void {
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as [FactionId, FactionId][]) {
    if (!state.factions[from]) continue;
    const record = bond(state, from, to);
    record.warSince = null;
    // Nobody forgets, but the shooting stops and the grudge starts fading from
    // a known point rather than from wherever the war happened to leave it.
    record.grudge = Math.min(record.grudge, PEACE_GRUDGE);
  }

  for (const id of [a, b]) {
    const faction = state.factions[id];
    if (faction) faction.warWeariness = Math.max(0, faction.warWeariness - 25);
  }
  addLog(
    state,
    a === 'player' || b === 'player'
      ? `The war with the ${houseShort(state, a === 'player' ? b : a)} is over.`
      : `The ${houseShort(state, a)} and the ${houseShort(state, b)} have stopped fighting.`,
    'success',
  );
}

export function declareWar(state: GameState, a: FactionId, b: FactionId): void {
  if (atWar(state, a, b)) return;

  /*
   * Whether this is a betrayal, decided before the war record is written.
   *
   * Starting one on somebody you were on decent terms with is the thing the
   * old single score could not represent at all: it had no way to distinguish
   * "finally moved on a family it had hated for years" from "turned on a
   * partner", because both simply pushed one number down. A reputation for
   * treachery is something you carry around the whole board, and it is why
   * nobody will sign anything with you two years later.
   */
  const treachery = relationship(state, a, b) > -20;

  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as [FactionId, FactionId][]) {
    if (!state.factions[from]) continue;
    bond(state, from, to).warSince = state.day;
  }
  adjustBond(state, a, b, { grudge: 45, trust: treachery ? BOND.betrayalTrust : -10 });

  addLog(
    state,
    a === 'player'
      ? `You have declared war on the ${houseShort(state, b)}.`
      : b === 'player'
        ? `The ${houseShort(state, a)} have declared war on you.`
        : `The ${houseShort(state, a)} and the ${houseShort(state, b)} are at war.`,
    'heat',
  );

  if (treachery) {
    // Everybody else was watching, and files it.
    for (const witness of ALL_FACTIONS) {
      if (witness === a || witness === b) continue;
      adjustBond(state, witness, a, { trust: BOND.betrayalWitnessTrust });
    }
    addLog(
      state,
      `${a === 'player' ? 'You' : `The ${houseShort(state, a)}`} moved on people ${
        a === 'player' ? 'you were' : 'they were'
      } supposed to be at peace with. Everybody in this city heard about it.`,
      'heat',
    );
  }

  // Allies are expected to turn up.
  for (const ally of alliesOf(state, a)) {
    if (ally === b) continue;
    adjustRelationship(state, ally, b, -30);
  }
}

// -------------------------------------------------------------- poaching ---

/** Somebody a rival could plausibly turn: unhappy, and still around. */
export function poachTarget(state: GameState, rng: Rng, loyaltyBelow: number): Npc | null {
  const candidates = crewList(state).filter(
    (n) =>
      (n.status === 'active' || n.status === 'busy') && n.stats.loyalty < loyaltyBelow,
  );
  return candidates.length ? rng.pick(candidates) : null;
}

/** Moves somebody from the player's organization to a rival's. */
export function defectToRival(
  state: GameState,
  npc: Npc,
  factionId: FactionId,
): void {
  npc.status = 'defected';
  npc.unavailableUntilDay = null;
  addNote(npc, state.day, `Left to work for the ${houseShort(state, factionId)}.`, 'bad');

  const faction = state.factions[factionId];
  if (faction) faction.strength = clamp(faction.strength + 1.5, 0, 100);

  addEvidence(state, {
    day: state.day,
    source: 'informant',
    strength: 14,
    npcIds: [npc.id],
    detail: `${npc.name} changed organizations and knows how both of them work.`,
  });

  addLog(
    state,
    `${npc.name} is working for the ${houseShort(state, factionId)} now.`,
    'crew',
  );
}

/** Used by the dashboard and rail: is anybody actually shooting at us? */
export function playerIsAtWar(state: GameState): boolean {
  return RIVAL_IDS.some((id) => atWar(state, 'player', id));
}

// --------------------------------------------------- player diplomacy -----

export interface DiplomaticResult {
  ok: boolean;
  message: string;
}

export function diplomaticCost(
  state: GameState,
  action: DiplomaticActionId,
  target: FactionId,
): number {
  const def = DIPLOMATIC_ACTION_BY_ID[action];
  if (action === 'sue_for_peace') {
    // Suing from a losing position costs more. They know what they have.
    const deficit = clamp(
      (factionStrength(state, target) - playerStrength(state)) / 50,
      0,
      1,
    );
    return Math.round(def.cost * (1 + deficit));
  }
  // Negotiation buys everything down a little.
  const haggle = 1 - clamp(state.player.attributes.negotiation * 0.015, 0, 0.3);
  return Math.round(def.cost * haggle);
}

export function canDo(
  state: GameState,
  action: DiplomaticActionId,
  target: FactionId,
): DiplomaticResult {
  const def = DIPLOMATIC_ACTION_BY_ID[action];
  const faction = state.factions[target];
  if (!faction) return { ok: false, message: 'No such organization.' };

  const war = atWar(state, 'player', target);
  if (def.requiresWar === true && !war) {
    return { ok: false, message: 'You are not at war with them.' };
  }
  if (def.requiresWar === false && war) {
    return { ok: false, message: 'There is a war on. That comes first.' };
  }

  const standing = relationship(state, 'player', target);
  if (standing < def.minRelationship) {
    /*
       Names the bar, because every refusal in this project has to.

       This said "They will not hear it from you." and stopped — no number, on
       the gate that shut `propose_alliance` in all thirty-six careers the
       probe has run. `refusals.test.ts` walked past it: its detector wants a
       comparison against a named constant and this one compares against
       `def.minRelationship`, a lowercase field. Same blind spot that hid the
       front purchase.
    */
    return {
      ok: false,
      message:
        `They will not hear it from you. Standing with them is ${Math.round(standing)}; ` +
        `this needs ${def.minRelationship}.`,
    };
  }
  if (action === 'declare_war' && war) {
    return { ok: false, message: 'You are already at war with them.' };
  }
  if (action === 'demand_tribute') {
    // Either they can see you are stronger, or they already take you
    // seriously enough not to need showing.
    const lead = playerStrength(state) - factionStrength(state, target);
    // Their respect for you. `bond` is symmetric across the player — there is
    // no `state.factions['player']`, so both orderings return the one record
    // the rival keeps — but reading it in this direction says what it means.
    const standing = bond(state, target, 'player').respect;
    if (lead < DIPLOMACY.demandStrengthLead && standing < DIPLOMACY.demandRespect) {
      /*
         Round 13 read this screen four times and wrote it down as "shows
         strengths and stances but I never found anything on it I could press".
         "Be stronger first" is why — it is a mood where a requirement belongs,
         and there are two ways over this bar rather than one.
      */
      return {
        ok: false,
        message:
          `They would laugh at you. You lead them by ${Math.round(lead)} strength and would need ` +
          `${DIPLOMACY.demandStrengthLead} — or ${DIPLOMACY.demandRespect} standing with them, ` +
          `against ${Math.round(standing)}.`,
      };
    }
  }

  /*
     What you can put on the table, and holdings count toward it.

     The same argument `canAcquire` makes about buying a front: front income is
     paid into holdings so it compounds rather than being spent on the next
     job, and a family with every dollar of its legitimate earnings put away
     was being told it could not afford the thing that money exists to buy.
     Measured: ten careers in thirty-six reach the standing an alliance asks
     for and **one** could ever press the button, because the liquid cash was
     never there on the same afternoon.
  */
  const cost = diplomaticCost(state, action, target);
  const inHand = state.org.cash + state.org.dirtyCash + (state.org.holdings ?? 0);
  if (cost > 0 && inHand < cost) {
    return {
      ok: false,
      message: `${formatMoney(cost)}, and you have ${formatMoney(inHand)}.`,
    };
  }
  return { ok: true, message: def.name };
}

/**
 * Everything the player can say to another organization.
 *
 * Nothing here is guaranteed. Peace has to be wanted by both sides, a demand
 * has to be backed by real strength, and an alliance costs money that a family
 * will happily take before deciding you are not worth it after all.
 */
export function doDiplomacy(
  state: GameState,
  rng: Rng,
  action: DiplomaticActionId,
  target: FactionId,
): DiplomaticResult {
  const check = canDo(state, action, target);
  if (!check.ok) return check;

  const faction = state.factions[target];
  const name = houseShort(state, target);
  const cost = diplomaticCost(state, action, target);
  if (cost > 0) {
    /*
       Pull it back out of holdings if that is where it is.

       `takeBack` charges for the privilege, which is the point — money you had
       put somewhere safe costs something to reach — and it is the same trade
       the Finances screen describes. Without this the affordability check
       above would let the button light up and `spend` would refuse it, which
       is the exact failure `loyalty_gesture` carries a comment about.
    */
    const liquid = state.org.cash + state.org.dirtyCash;
    if (liquid < cost) takeBack(state, cost - liquid);
    if (!spend(state, cost)) {
      return { ok: false, message: `${formatMoney(cost)} could not be raised.` };
    }
  }

  /*
     Making the approach builds pull, whether or not they say yes.

     The favour economy is the thing `influence` is described as measuring —
     "Contacts, counsel, favours" — and it was earnable almost nowhere, so
     round 9's tester finished 150 days at influence 0 with the police
     contacts, city hall and two layers of the City panel all sealed behind it.

     Credited on the approach rather than the outcome on purpose. You have
     spent the money and sent somebody to stand in a room; the city now knows
     you are a family that talks to other families. A refusal already costs
     relationship below, so this is not free — it is the difference between
     being nobody and being somebody who was turned down.
  */
  const b = bond(state, 'player', target);
  const since = state.day - (b.lastApproachDay ?? -Infinity);
  if (since >= INFLUENCE_FROM.approachCooldownDays) {
    b.lastApproachDay = state.day;
    trainAttribute(state, 'influence', INFLUENCE_FROM.approach);
  }

  switch (action) {
    case 'sue_for_peace': {
      // They accept based on how tired they are and how badly it is going.
      // Weariness gets them to the table. Trust decides whether they believe
      // anything said at it — a man who has broken a peace before is offering
      // the same words and a worse guarantee.
      const chance = clamp(
        DIPLOMACY.peaceBaseChance +
          state.player.attributes.negotiation * DIPLOMACY.negotiationPerPoint +
          faction.warWeariness * DIPLOMACY.peacePerWeariness +
          bond(state, target, 'player').trust * DIPLOMACY.peacePerTrust +
          (playerStrength(state) - faction.strength) * DIPLOMACY.peacePerStrengthLead,
        0.05,
        0.95,
      );
      if (rng.chance(chance)) {
        makePeace(state, 'player', target);
        return { ok: true, message: `The ${name} war is over.` };
      }
      // A refused offer is read as weakness.
      adjustRelationship(state, target, 'player', -3);
      addLog(state, `The ${name} sent your man back. The war goes on.`, 'failure');
      return { ok: false, message: 'They refused.' };
    }

    case 'offer_tribute': {
      const gain = Math.min(
        DIPLOMACY.tributeMaxRelationship,
        (cost / 10_000) * DIPLOMACY.tributeRelationshipPer10k,
      );
      /*
         Money settles a grievance. It does not, on its own, make you reliable.

         Written as their bond with you, which is where the record physically
         lives — the player has no faction entry of their own, so `bond` stores
         both sides on the other party. Behaviourally identical to the other
         argument order; it just no longer reads as though the player keeps a
         private opinion the game never looks at.
      */
      adjustRelationship(state, target, 'player', gain);

      /*
         And it settles what they are actually holding against you.

         The line above buys their opinion, which `scorePressure` reads only as
         a multiplier. What decides whether they come back to a street is the
         ledger in `faction.groundLost` — see config/factions.ts:GROUND_LOST —
         so a tribute that moved the mood alone would have let a family take
         the money and keep coming, which the blurb on this action explicitly
         promises it will not.

         Oldest business first: a family lets go of the corner it has been
         stewing over longest before the one it lost this morning.
      */
      let budget = (cost / 10_000) * GROUND_LOST.settledPer10k;
      const ledger = faction.groundLost;
      if (ledger) {
        for (const key of Object.keys(ledger).sort((a, b) => ledger[b] - ledger[a])) {
          if (budget <= 0) break;
          if (!key.startsWith('player:')) continue;
          const settled = Math.min(ledger[key], budget);
          budget -= settled;
          if (settled >= ledger[key]) delete ledger[key];
          else ledger[key] -= settled;
        }
      }

      addLog(state, `You sent the ${name} a courtesy. They took it.`, 'money');
      return { ok: true, message: `The ${name} think better of you.` };
    }

    case 'demand_tribute': {
      const paid = Math.round(faction.wealth * DIPLOMACY.demandShare);
      faction.wealth = Math.max(0, faction.wealth - paid);
      state.org.dirtyCash += paid;
      adjustRelationship(state, target, 'player', DIPLOMACY.demandRelationshipHit);
      gainRespect(state, 8);
      addLog(
        state,
        `The ${name} paid you $${paid.toLocaleString('en-US')}. They will not forget being made to.`,
        'money',
      );
      return { ok: true, message: `They paid $${paid.toLocaleString('en-US')}.` };
    }

    case 'propose_alliance': {
      /*
       * An alliance is bought in trust, not warmth.
       *
       * Paying for it buys the arrangement; whether they will actually turn
       * out for you is `alliesOf`, which reads the trust this puts there
       * against everything else that has happened between you. Money can start
       * an understanding and cannot manufacture a reliable one.
       */
      adjustBond(state, 'player', target, {
        trust: DIPLOMACY.allianceRelationship,
        grudge: -DIPLOMACY.allianceRelationship / 2,
      });
      const holds = alliesOf(state, 'player').includes(target);
      addLog(
        state,
        holds
          ? `You and the ${name} have an understanding now.`
          : `The ${name} took your money and said the right things. Whether they would turn up is another question.`,
        holds ? 'success' : 'money',
      );
      return { ok: true, message: holds ? `Allied with the ${name}.` : `The ${name} accepted.` };
    }

    case 'declare_war': {
      declareWar(state, 'player', target);
      gainRespect(state, DIPLOMACY.declareWarRespect);
      return { ok: true, message: `You are at war with the ${name}.` };
    }

    default:
      return { ok: false, message: 'Nothing to say.' };
  }
}
