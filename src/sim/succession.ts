/**
 * Succession: the organization outliving the person who built it.
 *
 * Two endings existed before this file — no people and no money, and a
 * conviction. Both stopped the game, which quietly made every long-term
 * decision worthless: there was no point building something that could only
 * ever end with you.
 *
 * The rule here is that being removed is not the same as losing. If somebody
 * in the room can hold it, the game continues as them, one rung lower and
 * considerably poorer. Losing is having nobody.
 *
 * The decision this system is really about is made years earlier, in the
 * Succession panel: naming an heir is the only way to put a thumb on the
 * scale, and it costs you — the man you name can suddenly see the top, and
 * every senior man you did not name heard you say so.
 */

import { Rng, clamp } from './rng';
import type {
  Attributes,
  AttributeId,
  GameState,
  Npc,
  NpcStatId,
  RankId,
} from './types';
import { neglectRisk } from './personal';
import { addLog, pushEvent, withArticle } from './util';
import { addNote, crewList, isOutOfReach, perceive } from './npc';
import { goalEffect } from './goals';
import { passedOver, recordTie } from './ties';
import { claimFromMemory } from './memory';
import { territoryList } from './territory';
import { ATTRIBUTE_IDS, RANKS, ROLE_LABEL, ROLE_ORDER, rankIndex } from '../config/economy';
import { TIE_SUCCESSION } from '../config/ties';
import {
  CLAIM,
  HANDOVER,
  INHERITED_ATTRIBUTES,
  DEPOSITION,
  INHERITED_ATTRIBUTE_CEILING,
  NAMING,
  REMOVAL,
} from '../config/succession';
import { RIVAL_IDS } from '../config/factions';

// -------------------------------------------------------------- the room ---

/** Anybody senior enough to be considered at all, and around to be it. */
export function eligibleHeirs(state: GameState): Npc[] {
  const floor = ROLE_ORDER.indexOf(CLAIM.minRole);
  return crewList(state)
    .filter((n) => n.status !== 'arrested' && ROLE_ORDER.indexOf(n.role) >= floor)
    .sort((a, b) => ROLE_ORDER.indexOf(b.role) - ROLE_ORDER.indexOf(a.role));
}

export function heirOf(state: GameState): Npc | null {
  const id = state.succession?.heirId;
  if (!id) return null;
  const npc = state.npcs[id];
  /*
     A named heir who is dead, gone or inside is not an heir. The player is
     told this in the panel rather than finding out at the worst moment.

     "Inside" was in this comment and not in the code, and the gap was doing
     real damage: `eligibleHeirs` drops an arrested man, so a boss whose
     successor was in a cell had a panel telling him the succession was in
     hand and a `removePlayer` that found nobody to hand to. Eight of the
     nineteen careers that ended on a removal had named somebody who was by
     then arrested, dead or defected. `isOutOfReach` is the same test the crew
     screen uses to grey out promote and raise, so the three now agree.
  */
  if (!npc || isOutOfReach(npc)) return null;
  return npc;
}

/**
 * How strong a claim this person has on the chair.
 *
 * Deliberately not built on loyalty. Loyalty is how somebody feels about the
 * person who is no longer here; a claim is what the rest of the room will
 * accept. Ambition gates it, because a man who never wanted it will not fight
 * for it — but the floor is not zero, since a room can hand it to someone who
 * never asked.
 *
 * `stat` is injected so the same function serves the truth (the simulation)
 * and the player's guess (the panel), rather than the panel re-implementing
 * the maths against perceived numbers and slowly drifting away from it.
 */
function claimFrom(
  state: GameState,
  npc: Npc,
  stat: (id: NpcStatId) => number,
): number {
  const role = ROLE_ORDER.indexOf(npc.role) / (ROLE_ORDER.length - 1);
  const standing =
    (stat('leadership') * 0.5 + stat('skill') * 0.25 + stat('courage') * 0.25) / 100;
  const record = clamp(npc.opsCompleted / CLAIM.recordFullAt, 0, 1);
  const tenure = clamp(npc.daysInCrew / CLAIM.tenureFullAt, 0, 1);

  const base =
    role * CLAIM.role +
    standing * CLAIM.standing +
    record * CLAIM.record +
    tenure * CLAIM.tenure;

  const will = stat('ambition') / 100;
  const gated = base * (CLAIM.willFloor + will * (1 - CLAIM.willFloor));

  const named = state.succession?.heirId === npc.id ? CLAIM.heirBonus : 0;
  return clamp(
    gated +
      named +
      roomSupport(state, npc) +
      goalEffectOnClaim(npc) +
      // What the organization remembers of how he was treated. A man everybody
      // watched get passed over twice is not the man they hand it to.
      claimFromMemory(npc, state.day),
    0,
    1,
  );
}

/**
 * What the rest of the room thinks of him.
 *
 * A claim was previously a property of one man in isolation, which is a
 * strange way to model a question that is decided entirely by other people.
 * Now the men who would have to accept him have a say: everybody senior who
 * trusts him helps, everybody senior carrying a grudge hurts, and both of
 * those were written by things that actually happened over the preceding years.
 */
function roomSupport(state: GameState, npc: Npc): number {
  let support = 0;
  for (const other of eligibleHeirs(state)) {
    if (other.id === npc.id) continue;
    const tie = other.ties.find((t) => t.id === npc.id);
    if (!tie) continue;
    support += tie.trust * TIE_SUCCESSION.claimPerTrust;
    support += tie.resentment * TIE_SUCCESSION.claimPerResentment;
  }
  return support;
}

/** A man who wants it is a better candidate than a man who does not. */
function goalEffectOnClaim(npc: Npc): number {
  // Expressed as a shift rather than a multiplier so it composes with the
  // ambition gate above instead of double-counting it.
  return (goalEffect(npc, 'claim') - 1) * 0.25;
}

/** The truth. Used by the simulation, never rendered. */
export function claimStrength(state: GameState, npc: Npc): number {
  return claimFrom(state, npc, (id) => npc.stats[id]);
}

/**
 * What the player thinks the claim is, read through the same fog as everything
 * else about a person. Someone you barely know reads as an average man.
 */
export function perceivedClaim(state: GameState, npc: Npc): number {
  return claimFrom(state, npc, (id) => {
    const read = perceive(npc, id);
    return read.known ? read.bandIndex * 20 + 10 : 50;
  });
}

const CLAIM_BANDS = [
  'Nobody would follow them',
  'They would struggle to hold it',
  'It could go either way',
  'The room would accept them',
  'It would be their without a word',
];

export function claimBand(claim: number): string {
  return CLAIM_BANDS[clamp(Math.floor(claim / 0.2), 0, 4)];
}

// ------------------------------------------------------- naming, in life ---

export interface NameResult {
  ok: boolean;
  message: string;
}

/**
 * Say out loud who is next.
 *
 * The cost is immediate and permanent: the man you name gains ambition he did
 * not have, and everyone senior enough to have hoped takes it personally.
 */
export function nameHeir(state: GameState, npcId: string | null): NameResult {
  const previous = state.succession.heirId ? state.npcs[state.succession.heirId] : null;

  if (npcId === null) {
    if (!previous) return { ok: false, message: 'You have not named anybody.' };
    state.succession.heirId = null;
    state.succession.heirNamedDay = null;
    resent(previous, NAMING.demotedHeirGrievance, NAMING.demotedHeirLoyalty);
    addNote(previous, state.day, 'Was told they are no longer next.', 'bad');
    addLog(state, `${previous.name} is no longer your successor. They know why.`, 'crew');
    return { ok: true, message: `${previous.name} has been passed over.` };
  }

  const npc = state.npcs[npcId];
  if (!npc) return { ok: false, message: 'No such person.' };
  if (!eligibleHeirs(state).some((n) => n.id === npcId)) {
    return {
      ok: false,
      message: `Nobody would follow ${withArticle(ROLE_LABEL[npc.role])}. Move them up first.`,
    };
  }
  if (previous?.id === npcId) {
    return { ok: false, message: `${npc.name} is already next.` };
  }

  if (previous) {
    resent(previous, NAMING.demotedHeirGrievance, NAMING.demotedHeirLoyalty);
    addNote(previous, state.day, `Replaced as successor by ${npc.name}.`, 'bad');
  }

  state.succession.heirId = npcId;
  state.succession.heirNamedDay = state.day;

  npc.stats.ambition = clamp(npc.stats.ambition + NAMING.heirAmbition, 0, 100);
  npc.stats.respectForBoss = clamp(
    npc.stats.respectForBoss + NAMING.heirRespectForBoss,
    0,
    100,
  );
  npc.stats.loyalty = clamp(npc.stats.loyalty + NAMING.heirLoyalty, 0, 100);
  addNote(npc, state.day, 'Named as your successor.', 'good');

  // Everyone else who was senior enough to have expected it.
  for (const other of eligibleHeirs(state)) {
    if (other.id === npcId || other.id === previous?.id) continue;
    if (ROLE_ORDER.indexOf(other.role) < ROLE_ORDER.indexOf(npc.role)) continue;
    resent(other, NAMING.passedOverGrievance, NAMING.passedOverLoyalty);
    // The grievance is with you. The tie is with him, and it outlasts you.
    recordTie(state.day, other, npc, 'passed_over');
    addNote(other, state.day, `Watched ${npc.name} be named successor.`, 'bad');
  }

  addLog(state, `${npc.name} is next, and the room has been told.`, 'crew');
  return { ok: true, message: `${npc.name} is your named successor.` };
}

function resent(npc: Npc, grievance: number, loyalty: number): void {
  npc.stats.grievance = clamp(npc.stats.grievance + grievance, 0, 100);
  npc.stats.loyalty = clamp(npc.stats.loyalty + loyalty, 0, 100);
}

// ----------------------------------------------------------- the removal ---

export type RemovalKind = 'convicted' | 'killed' | 'deposed';

/**
 * The single door out. Conviction and assassination both come through here,
 * and neither of them decides on its own whether the game is over — that
 * depends entirely on whether there is anybody left to take it.
 */
export function removePlayer(
  state: GameState,
  rng: Rng,
  kind: RemovalKind,
  detail: string,
  /**
   * The man who did it, when somebody did.
   *
   * A conviction and a bullet leave the chair empty and the room decides; a
   * deposition does not. Passing him through rather than letting the claim roll
   * sort it out is the difference between "somebody took over" and "he took
   * it", and the whole point of the route is that it has an author.
   */
  takenBy?: Npc,
): void {
  if (state.gameOver) return;

  /*
     The man you named is always a candidate, however the room feels about him.

     `claimStrength` includes `heirBonus`, but `roomSupport`, his goals and what
     the organization remembers of how he was treated all subtract from it — so
     a named, eligible successor could still fall under `seriousAt` and the
     family would simply end. Measured across 36 careers: a successor was in
     place 71% of weeks and somebody the room would actually follow only 59%,
     so four weeks in ten a boss who had done everything the succession panel
     asked still lost everything to a conviction.

     That is the one thing this game promises and it was a coin toss. Naming
     him is the plan; the room's opinion decides how badly the handover goes,
     not whether there is one. A disliked successor still faces a contested
     succession, still pays the full haircut on money, respect and influence,
     and still loses the rank if he was not the one named — all of which
     `resolveSuccession` and `applyHandoverCosts` already do.

     Nothing here helps a boss who named nobody, or whose man is dead, gone or
     inside. `eligibleHeirs` filters those out before this sees them.
  */
  const named = state.succession?.heirId;
  const contenders = eligibleHeirs(state).filter(
    (n) =>
      claimStrength(state, n) >= CLAIM.seriousAt ||
      n.id === takenBy?.id ||
      n.id === named,
  );

  if (contenders.length === 0) {
    /*
     * Outside a career this is where it would stop, and outside a career it
     * must not. Sandbox is for finding out what the late systems do, and
     * "a case landed and the run is over" is the one answer it cannot give.
     *
     * So the removal still happens to everything else — the case is still
     * built, the conviction still lands, and it is still worth avoiding — but
     * the organization goes on without a handover. The consequence is kept;
     * only the ending is dropped.
     */
    if (state.mode !== 'career') {
      addLog(
        state,
        'There was nobody to give it to. In another life that would have been the end of it.',
        'failure',
      );
      return;
    }
    state.gameOver = { reason: endingText(state, detail), day: state.day };
    addLog(state, 'There was nobody to give it to. It stops here.', 'failure');
    return;
  }

  resolveSuccession(state, rng, kind, detail, contenders, takenBy);
}

function endingText(state: GameState, detail: string): string {
  const nobody =
    `There was nobody senior enough to take it. The people who were left ` +
    `drifted off within the month, and inside a year nothing you did was ` +
    `still standing.`;
  const generations =
    state.succession.generation > 1
      ? ` ${state.succession.generation} people ran this. None of them got to stop.`
      : '';
  return `${detail} ${nobody}${generations}`;
}

/**
 * The crisis itself.
 *
 * Everybody with a real claim rolls it. Naming an heir is worth a great deal
 * and is still not decisive — which is the point of naming one early enough
 * that he has a record, rather than late enough that it is only a title.
 */
function resolveSuccession(
  state: GameState,
  rng: Rng,
  kind: RemovalKind,
  detail: string,
  contenders: Npc[],
  takenBy?: Npc,
): void {
  const named = heirOf(state);
  const rolled = contenders
    .map((npc) => ({
      npc,
      score:
        claimStrength(state, npc) * rng.float(CLAIM.variance[0], CLAIM.variance[1]),
    }))
    .sort((a, b) => b.score - a.score);

  // A man who took it has it. The roll still happens, because who came second
  // decides how contested the handover was and who spends the next decade
  // resenting him.
  const winner = takenBy ?? rolled[0].npc;
  const contested = rolled.length > 1 && rolled[1].score > rolled[0].score * 0.85;
  const usurped = !!named && winner.id !== named.id;

  /*
   * Losing the room is remembered.
   *
   * The men who were in the running and did not get it now hold something
   * against the man who did — which is why a contested succession keeps
   * costing you for years afterwards rather than only on the day.
   */
  passedOver(state, winner, contenders, 'lost_the_room');

  // --- the predecessor goes on the record -------------------------------
  const fromDay =
    state.succession.line.length > 0
      ? state.succession.line[state.succession.line.length - 1].toDay
      : 1;
  // Read before the succession clears it, because whether there was a plan is
  // the thing that decides what the family keeps.
  const namedAtRemoval = heirOf(state)?.id ?? null;
  state.succession.line.push({
    name: state.player.name,
    rank: state.player.rank,
    fromDay,
    toDay: state.day,
    fate: detail,
  });
  state.succession.generation += 1;

  // --- the new boss ------------------------------------------------------
  /*
     A rung is lost only by a boss who left no plan.

     `ranksLost` used to apply to every handover, and it is the reason
     succession made the ladder slower rather than longer: a rung takes about
     three years to earn and a boss lasts about three, so every family paid
     back what it had just gained. Measured — Capo arrived on day 673 without
     succession and day 1,177 with it.

     Making it conditional keeps the drama and moves it somewhere the player
     controls. The man you named steps up and the family's position holds; a
     chair that empties with nobody named is a family that slips, because
     nobody outside knows who to deal with. It also turns the succession panel
     into a standing decision with a price rather than a screen visited once.

     The named heir has to actually take it. Somebody seizing the chair over
     your written intention is not your plan holding.
  */
  const planHeld = namedAtRemoval !== null && winner.id === namedAtRemoval;
  const inheritedRank = planHeld ? state.player.rank : inheritRank(state.player.rank);
  winner.status = 'boss';
  winner.unavailableUntilDay = null;
  state.succession.heirId = null;
  state.succession.heirNamedDay = null;

  state.player = {
    name: winner.name,
    rank: inheritedRank,
    attributes: inheritAttributes(winner),
    attributeProgress: zeroed(),
    opsCompleted: winner.opsCompleted,
    opsFailed: winner.opsFailed,
    pendingRank: null,
  };

  applyHandoverCosts(state, rng, winner, usurped, contested, kind);

  const body = successionMemo(state, kind, detail, winner, named, usurped, contested);
  pushEvent(state, {
    defId: 'succession',
    title: usurped ? `${winner.name} took it` : `${winner.name} has it now`,
    body,
    severity: usurped ? 'danger' : 'warning',
    npcId: winner.id,
    data: { generation: state.succession.generation },
    choices: [
      {
        id: 'continue',
        label: 'Get to work',
        hint: 'You are them now. Everything they inherited is your problem',
      },
    ],
  });
  addLog(
    state,
    `${winner.name} is running the organization now. ${
      state.succession.line[state.succession.line.length - 1].name
    } is not.`,
    'failure',
  );
}

/** Exported so the panel shows the real figure rather than its own copy of it. */
/**
 * Where an unplanned handover leaves the family.
 *
 * Only reached when nobody was named. A boss who left a successor hands the
 * rank over intact — see `resolveSuccession`. Still exported so the panel can
 * show the player what they stand to lose by not naming anybody.
 */
export function inheritRank(rank: RankId): RankId {
  const idx = Math.max(0, rankIndex(rank) - HANDOVER.ranksLost);
  return RANKS[idx].id;
}

function zeroed(): Attributes {
  return Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, 0])) as Attributes;
}

/**
 * The successor's attributes, derived from who he was.
 *
 * This is the payoff for the perception system: you have spent the whole game
 * guessing at these numbers from the outside, and now you have to live inside
 * them and find out how close you were.
 */
function inheritAttributes(npc: Npc): Attributes {
  const attributes = zeroed();
  for (const id of ATTRIBUTE_IDS as AttributeId[]) {
    const blend = INHERITED_ATTRIBUTES[id] ?? {};
    let value = 0;
    for (const [statId, weight] of Object.entries(blend)) {
      value += (npc.stats[statId as NpcStatId] ?? 0) * (weight as number);
    }
    attributes[id] = Math.round((value / 100) * INHERITED_ATTRIBUTE_CEILING);
  }
  return attributes;
}

/**
 * What the handover costs.
 *
 * It has to be expensive enough that succession is a bad outcome and cheap
 * enough that it beats starting over — otherwise naming an heir is just a
 * slower way to lose.
 */
function applyHandoverCosts(
  state: GameState,
  rng: Rng,
  winner: Npc,
  usurped: boolean,
  contested: boolean,
  kind: RemovalKind,
): void {
  state.org.respect = Math.round(state.org.respect * HANDOVER.respectKept);
  state.org.cash = Math.round(state.org.cash * HANDOVER.cleanCashKept);
  state.org.dirtyCash = Math.round(state.org.dirtyCash * HANDOVER.dirtyCashKept);
  /*
     A chair that empties on its own buys quiet. One emptied by the state does
     not — see config/succession.ts:heatKeptWhenConvicted.
  */
  state.org.heat =
    state.org.heat *
    (kind === 'convicted' ? HANDOVER.heatKeptWhenConvicted : HANDOVER.heatKept);
  state.org.layLowUntilDay = null;

  for (const t of territoryList(state)) {
    t.influence.player = (t.influence.player ?? 0) * HANDOVER.influenceKept;
  }

  /*
   * The open files lose the man they were built around.
   *
   * This is the mechanic that makes succession an actual out from a losing
   * legal position rather than a consolation prize: they spent years getting
   * a conviction and the person they convicted is not running anything any
   * more. The evidence survives, so it is a reprieve, not an amnesty.
   */
  for (const investigation of Object.values(state.law.investigations)) {
    if (investigation.status !== 'open' && investigation.status !== 'cold') continue;
    investigation.strength *= HANDOVER.caseStrengthKept;
    investigation.status = 'cold';
    investigation.lastProgressDay = state.day;
    investigation.history.unshift({
      day: state.day,
      text: 'The subject of this investigation is no longer running the organization.',
      obvious: false,
    });
  }

  /*
     People who were here for the last man, not for this one.

     Least loyal first, so that when the floor stops the exodus it is the
     people who were staying anyway who are left, rather than whoever the map
     happened to iterate last. Both rolls happen either way — a man's reason
     to leave does not depend on how many went before him, only on whether
     there is anybody left for him to be the last of.
  */
  const room = crewList(state)
    .filter((n) => n.id !== winner.id)
    .sort((a, b) => a.stats.loyalty - b.stats.loyalty);
  let staying = room.length;

  for (const npc of room) {
    const walking =
      npc.stats.loyalty < HANDOVER.walkOutLoyaltyBelow &&
      rng.chance(HANDOVER.walkOutChance);
    const sourLoser =
      (usurped || contested) &&
      ROLE_ORDER.indexOf(npc.role) >= ROLE_ORDER.indexOf(winner.role) &&
      rng.chance(HANDOVER.loserLeavesChance);

    if ((walking || sourLoser) && staying > HANDOVER.keepAtLeast) {
      staying -= 1;
      npc.status = 'defected';
      npc.unavailableUntilDay = null;
      addNote(npc, state.day, 'Left rather than work for the new boss.', 'bad');
    } else {
      // Whatever they thought of the old man does not transfer.
      npc.stats.respectForBoss = clamp(npc.stats.respectForBoss - 15, 0, 100);
    }
  }

  /*
   * The other families can count, and a house mid-handover counts as weak.
   *
   * Respect, deliberately: they do not resent you for your predecessor being
   * removed, they revise what they think you can do about it. Under the old
   * single score those were the same event, which is why a succession used to
   * make everybody hostile rather than opportunistic.
   */
  for (const id of RIVAL_IDS) {
    const faction = state.factions[id];
    if (!faction) continue;
    const record = faction.bonds.player ?? { grudge: 0, respect: 0, trust: 0, warSince: null };
    record.respect = clamp(record.respect + HANDOVER.rivalRespectHit, -100, 100);
    faction.bonds.player = record;
  }
}

// ----------------------------------------------------------------- memos ---

function successionMemo(
  state: GameState,
  kind: RemovalKind,
  detail: string,
  winner: Npc,
  named: Npc | null,
  usurped: boolean,
  contested: boolean,
): string {
  const gone = state.succession.line[state.succession.line.length - 1];
  const opening =
    kind === 'convicted'
      ? `${gone.name} went away for ${REMOVAL.sentenceYears[0]} to ${REMOVAL.sentenceYears[1]} years. ` +
        `${detail}`
      : kind === 'deposed'
        ? `${gone.name} is not running anything any more. ${detail}`
        : `${gone.name} is dead. ${detail}`;

  const room = usurped
    ? `You named ${named!.name}. The room did not agree with you.\n\n` +
      `${winner.name} did not raise their voice and did not have to. By the time ` +
      `anybody thought to argue it had already been settled by the people who ` +
      `would have had to do the arguing.`
    : named
      ? `${winner.name} was named years ago and the room remembered it. That is ` +
        `the whole value of having said it out loud while there was still time.`
      : `Nobody had been named. ${winner.name} was simply the man everyone looked ` +
        `at, which is not the same as agreement, but it was enough.`;

  const cost =
    `\n\nWhat is left is smaller. Money went on lawyers and funerals and the ` +
    `people who took their share on the way out. Standing does not transfer — ` +
    `${winner.name} has a name on the street but it is not the one the last ` +
    `few years were built on.` +
    (contested ? ` Some of the senior men have not come back.` : '');

  return `${opening}\n\n${room}${cost}\n\nYou are ${winner.name} now.`;
}

// ------------------------------------------------------------- deposition --

/** Everyone senior who has stopped believing in you. The other half of a coup. */
function disaffected(state: GameState): Npc[] {
  return eligibleHeirs(state).filter(
    (n) =>
      (n.status === 'active' || n.status === 'busy') &&
      n.stats.respectForBoss < DEPOSITION.backerRespectBelow &&
      n.stats.grievance > DEPOSITION.backerGrievanceAbove,
  );
}

/**
 * The man who would take it, if anybody would.
 *
 * Exported because the rumour needs it and the tests need it, and because a
 * future panel might want to ask the question — though it must never be told
 * the answer. Nothing player-facing calls this.
 */
export function wouldTakeIt(state: GameState): Npc | null {
  const room = disaffected(state);
  if (room.length < DEPOSITION.backersNeeded) return null;

  const candidates = room
    .filter(
      (n) =>
        n.stats.ambition > DEPOSITION.ambitionAbove &&
        n.stats.respectForBoss < DEPOSITION.respectBelow &&
        n.stats.grievance > DEPOSITION.grievanceAbove &&
        claimStrength(state, n) > DEPOSITION.claimAbove,
    )
    .sort((a, b) => claimStrength(state, b) - claimStrength(state, a));

  return candidates[0] ?? null;
}

/**
 * The weekly question of whether the organization still wants you.
 *
 * Two things happen here and the order matters. Long before the roll can land,
 * the player is told that something is being discussed — because a coup nobody
 * could have seen coming is a coin flip with extra steps, and every input to it
 * has been sitting on the crew sheet for months in the same banded, noisy form
 * as everything else about a person.
 */
export function tickDeposition(state: GameState, rng: Rng): void {
  if (state.gameOver) return;
  if (state.mode === 'simulation') return;
  if (state.day % 7 !== 0) return;

  const mover = wouldTakeIt(state);
  if (!mover) {
    state.flags['unrest_since'] = 0;
    return;
  }

  const since = state.flags['unrest_since'] ?? 0;
  if (since === 0) {
    state.flags['unrest_since'] = state.day;
    return;
  }
  const weeks = Math.floor((state.day - since) / 7);
  if (weeks < DEPOSITION.rumourAfterWeeks) return;

  if (!state.flags['unrest_told']) {
    state.flags['unrest_told'] = state.day;
    /*
       Deliberately does not name him.

       Naming him would turn the whole thing into a to-do item: sit him down,
       pay him, promote him, done. Not naming him puts the player back in front
       of the crew sheet reading perceived ambition and perceived regard across
       eight men, which is the only screen in the game where that has ever been
       worth doing at this range.
    */
    addLog(
      state,
      'There has been a meeting you were not at. Nobody will say whose idea it was.',
      'failure',
    );
    return;
  }

  const named = heirOf(state);
  /*
     And whether the man in the chair has anything outside it.

     `config/personal.ts` argues this rather than asserts it: a boss who is
     only ever seen in the back room is a boss his own people know only as the
     work, and when the room turns there is nobody in it with a personal reason
     to stand with him. `neglectRisk` is 1 for any boss who goes home
     occasionally, so this is a thing the player can be wrong about rather than
     a tax everybody pays.

     It goes here because this file already calls deposition the only way out
     of the chair that is entirely the player's own work, and that is exactly
     what a life nobody kept is.
  */
  const chance =
    DEPOSITION.chancePerWeek *
    (named && named.id === mover.id ? DEPOSITION.namedHeirMultiplier : 1) *
    neglectRisk(state);
  if (!rng.chance(chance)) return;

  removePlayer(
    state,
    rng,
    'deposed',
    `Nobody was killed and nobody was arrested. Enough of the people who ` +
      `mattered had stopped taking their calls, and one morning that was simply ` +
      `what the arrangement was.`,
    mover,
  );
  state.flags['unrest_since'] = 0;
  state.flags['unrest_told'] = 0;
}

// ------------------------------------------------------------ war removal --

/**
 * Rolled when the player takes a heavy beating in a war.
 *
 * Gated the same way agencies have a minimum rank and wars have a minimum
 * target strength: getting to the boss should be how a losing war ends, not a
 * coin flip somebody spins at you every week.
 */
export function rollAssassination(
  state: GameState,
  rng: Rng,
  margin: number,
  /** Player strength over the enemy's. Below 1 means outmatched. */
  powerRatio: number,
  enemy: string,
): boolean {
  if (margin < REMOVAL.assassinationMarginAbove) return false;
  if (powerRatio > REMOVAL.assassinationOutmatchedBelow) return false;

  const guards = crewList(state).filter(
    (n) => n.status === 'active' || n.status === 'busy',
  ).length;
  let chance = REMOVAL.assassinationChance;
  if (guards < REMOVAL.assassinationUnguardedBelow) {
    chance *= REMOVAL.assassinationUnguardedMultiplier;
  }
  if (!rng.chance(chance)) return false;

  removePlayer(
    state,
    rng,
    'killed',
    `The ${enemy} got to them on the way out of a restaurant on Delacroix. It was ` +
      `not complicated and it did not need to be — a war they were losing, and a ` +
      `week where there were not enough people around them.`,
  );
  return true;
}
