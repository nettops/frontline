/**
 * Sending people to kill somebody who is not yours.
 *
 * The design and every tuned number live in `config/contract.ts`. What this
 * file holds is the shape: a contract is **state with a day on it**, not a
 * function call. You decide once, the men are gone for a week, and then you
 * read what happened — the same stance `marks.ts` takes, and for the same
 * reason. A killing you can order and resolve in the same click is a button.
 *
 * Four things it must not get wrong:
 *
 * 1. **The men are actually gone.** They go `busy` for the duration, so a
 *    contract competes with the work for the same bodies. Without that it is
 *    free and the whole decision evaporates.
 * 2. **It goes through `armFor` and `spent`.** Class moves the odds and the
 *    heat, provenance moves the trace *and* the attribution. An act with a
 *    body that ignored the armoury would make the armoury decoration.
 * 3. **The player is never told what the family concluded.** `attribute`
 *    returns `mistaken`; `beliefs.ts` never renders it and neither does this.
 *    You find out by watching what they do.
 * 4. **Nothing is refunded.** The money bought the attempt.
 */

import type { Contract, GameState, Id, Npc } from './types';
import type { FactionId } from '../config/factions';
import { Rng, clamp } from './rng';
import { addEvidence, addLog, nextId } from './util';
import { addHeat } from './heat';
import { addNote, crewList } from './npc';
import { spend } from './economy';
import { gainFear, gainRespect } from './player';
import { attribute } from './beliefs';
import { caposOf, removeCapo } from './capos';
import { replaceLeader } from './leaders';
import { houseShort } from './houses';
import { adjustSentiment } from './territory';
import { prices } from './market';
import { CREW_SKILL_VS_DISCIPLINE } from '../config/operations';
import { BOSS_CONTRACT, CONTRACT, WITNESS_CONTRACT } from '../config/contract';
import { CHARGE, PROVENANCE } from '../config/pieces';
import { armFor, leftBehind, spent, usingCharge } from './pieces';

export type ContractTarget =
  | { kind: 'capo'; factionId: FactionId; capoId: string }
  | { kind: 'boss'; factionId: FactionId }
  | { kind: 'witness'; caseId: string; npcId: Id };

export interface ContractCheck {
  ok: boolean;
  message: string;
  /** What it would cost and come off at, so the panel can say so first. */
  cost?: number;
  chance?: number;
}

/** Everything ever sent, lazily. The `marks` idiom. */
export function contractList(state: GameState): Contract[] {
  if (!state.contracts) state.contracts = [];
  return state.contracts;
}

export function openContracts(state: GameState): Contract[] {
  return (state.contracts ?? []).filter((c) => c.status === 'open');
}

// -------------------------------------------------------------- the shape --

/**
 * The multipliers this kind of job wears. See `config/contract.ts`.
 *
 * One flat shape with every field present rather than three unions, so a
 * caller can never quietly read `undefined` off one of them and multiply a
 * grudge by nothing. A capo contract is the identity and the numbers it was
 * measured with.
 */
interface Shape {
  costMultiplier: number;
  chanceMultiplier: number;
  heatMultiplier: number;
  evidenceMultiplier: number;
  grudgeMultiplier: number;
  respectMultiplier: number;
  fearMultiplier: number;
}

const CAPO_SHAPE: Shape = {
  costMultiplier: 1,
  chanceMultiplier: 1,
  heatMultiplier: 1,
  evidenceMultiplier: 1,
  grudgeMultiplier: 1,
  respectMultiplier: 1,
  fearMultiplier: 1,
};

function shapeOf(kind: ContractTarget['kind']): Shape {
  if (kind === 'boss') return { ...CAPO_SHAPE, ...BOSS_CONTRACT };
  if (kind === 'witness') return { ...CAPO_SHAPE, ...WITNESS_CONTRACT };
  return CAPO_SHAPE;
}

function targetKey(target: ContractTarget): string {
  if (target.kind === 'capo') return `capo:${target.capoId}`;
  if (target.kind === 'boss') return `boss:${target.factionId}`;
  return `witness:${target.npcId}`;
}

/** Who is actually free to go. */
function available(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status === 'active');
}

/**
 * How good the men you are sending actually are.
 *
 * The same two stats and the same weighting `crewCompetence` reads, because
 * reaching a careful man is not a separate quality from being good at the
 * work. Averaged over whoever goes, so sending your two best is a real choice
 * against sending them on a job that pays.
 */
function competenceOf(crew: Npc[]): number {
  if (crew.length === 0) return 0;
  const total = crew.reduce(
    (sum, n) =>
      sum +
      n.stats.skill * CREW_SKILL_VS_DISCIPLINE +
      n.stats.discipline * (1 - CREW_SKILL_VS_DISCIPLINE),
    0,
  );
  return total / crew.length;
}

/**
 * How hard he is to reach.
 *
 * A capo's share of his family is the same number `capoWorth` uses, which
 * makes the tension the right way round: the man worth killing is the man with
 * people around him. A boss has no share and takes the flat multiplier
 * instead; a witness has nobody at all.
 */
function shareOf(state: GameState, target: ContractTarget): number {
  if (target.kind !== 'capo') return 0;
  const capo = caposOf(state, target.factionId).find((c) => c.id === target.capoId);
  return capo?.share ?? 0;
}

function nameOf(state: GameState, target: ContractTarget): string | null {
  if (target.kind === 'capo') {
    return caposOf(state, target.factionId).find((c) => c.id === target.capoId)?.name ?? null;
  }
  if (target.kind === 'boss') return state.factions[target.factionId]?.leader?.name ?? null;
  return state.npcs[target.npcId]?.name ?? null;
}

function whereOf(state: GameState, target: ContractTarget): string | null {
  if (target.kind === 'capo') {
    return (
      caposOf(state, target.factionId).find((c) => c.id === target.capoId)?.territoryId ?? null
    );
  }
  return null;
}

export function contractCost(state: GameState, target: ContractTarget): number {
  return Math.round(CONTRACT.cost * shapeOf(target.kind).costMultiplier * prices(state));
}

export function contractChance(state: GameState, target: ContractTarget): number {
  const crew = available(state).slice(0, CONTRACT.crew);
  return clamp(
    (CONTRACT.base +
      (competenceOf(crew) / 100) * CONTRACT.perCrewSkill -
      shareOf(state, target) * CONTRACT.perTargetShare) *
      shapeOf(target.kind).chanceMultiplier,
    CONTRACT.minChance,
    CONTRACT.maxChance,
  );
}

export function canContract(state: GameState, target: ContractTarget): ContractCheck {
  const cost = contractCost(state, target);
  const chance = contractChance(state, target);
  const none = { ok: false, cost, chance };

  const name = nameOf(state, target);
  if (!name) return { ...none, message: 'Nobody by that name any more.' };

  if (openContracts(state).some((c) => c.id.length && targetKeyOf(c) === targetKey(target))) {
    return { ...none, message: `Somebody is already out looking for ${name}.` };
  }

  /*
     `CONTRACT.cooldownDays` existed and was read by nothing — the "already
     out looking" guard above only ever sees a contract while it is *open*,
     so the same man could be sent for again the day after a botched attempt
     came home, with nothing charged for it but the second attempt's own
     price. The comment on the key says what it is for: "he will be careful
     for a long time afterwards."

     Only `missed` counts. A `landed` contract means the man is gone — a
     `boss` slot refilled by `replaceLeader` is a different person wearing
     the same key, and he has not been shot at yet.
  */
  const settled = contractList(state)
    .filter((c) => c.status === 'missed' && targetKeyOf(c) === targetKey(target))
    .sort((a, b) => (b.settledDay ?? b.endDay) - (a.settledDay ?? a.endDay))[0];
  if (settled) {
    const since = state.day - (settled.settledDay ?? settled.endDay);
    if (since < CONTRACT.cooldownDays) {
      return {
        ...none,
        message: `${name} is watching their back after last time. Try again in ${CONTRACT.cooldownDays - since} days.`,
      };
    }
  }

  const free = available(state);
  if (free.length < CONTRACT.crew) {
    /*
       Named, not hinted. `refusals.test.ts` exists because a player told
       "nobody is free" cannot tell whether they are one man short or four, and
       the same silence cost three playtest rounds between ninety and two
       hundred days on the business gate.
    */
    return {
      ...none,
      message: `It takes ${CONTRACT.crew} and you have ${free.length} free.`,
    };
  }

  if (state.org.cash + state.org.dirtyCash < cost) {
    return { ...none, message: `It costs ${cost.toLocaleString('en-US')} and you cannot cover it.` };
  }

  return { ok: true, cost, chance, message: `Send somebody for ${name}` };
}

/** The key a live contract was opened against, rebuilt from what it stored. */
function targetKeyOf(contract: Contract): string {
  if (contract.kind === 'capo') return `capo:${contract.targetId}`;
  if (contract.kind === 'boss') return `boss:${contract.factionId}`;
  return `witness:${contract.targetId}`;
}

// ------------------------------------------------------------- sending it --

/**
 * Deciding.
 *
 * Everything expensive happens here and nothing final does: the money goes,
 * the men go, and then it is out of your hands for `CONTRACT.days`. That gap
 * is deliberate and it is the whole texture of the mechanic.
 */
export function openContract(state: GameState, target: ContractTarget): ContractCheck {
  const guard = canContract(state, target);
  if (!guard.ok) return guard;

  const cost = guard.cost!;
  if (!spend(state, cost, 'world')) {
    return { ok: false, message: 'You cannot cover it.' };
  }

  const crew = available(state).slice(0, CONTRACT.crew);
  for (const npc of crew) {
    npc.status = 'busy';
    npc.unavailableUntilDay = state.day + CONTRACT.days;
  }

  const contract: Contract = {
    id: nextId(state, 'ct'),
    kind: target.kind,
    factionId: target.kind === 'witness' ? null : target.factionId,
    targetId:
      target.kind === 'capo'
        ? target.capoId
        : target.kind === 'witness'
          ? target.npcId
          : null,
    caseId: target.kind === 'witness' ? target.caseId : undefined,
    targetName: nameOf(state, target) ?? 'somebody',
    territoryId: whereOf(state, target),
    crewIds: crew.map((n) => n.id),
    openedDay: state.day,
    endDay: state.day + CONTRACT.days,
    chance: guard.chance!,
    paid: cost,
    status: 'open',
  };
  contractList(state).push(contract);

  addLog(
    state,
    `${crew.map((n) => n.name).join(' and ')} have gone to see about ${contract.targetName}.`,
    'crew',
  );
  return { ok: true, cost, chance: contract.chance, message: 'They have gone.' };
}

// ------------------------------------------------------------ the outcome --

/** The men come home, or one of them does not. */
function comeHome(state: GameState, rng: Rng, contract: Contract, worked: boolean): void {
  const went = contract.crewIds
    .map((id) => state.npcs[id])
    .filter((n): n is Npc => !!n && n.status !== 'dead');

  for (const npc of went) {
    if (npc.status === 'busy') npc.status = 'active';
    npc.unavailableUntilDay = null;
  }

  const chance = worked ? CONTRACT.crewLostOnSuccess : CONTRACT.crewLostOnFailure;
  if (went.length === 0 || !rng.chance(chance)) return;

  /*
     The first job in this game that can kill one of your own.

     Without it a contract is a button. `theRoomFindsOut` in `silence.ts` is
     not reused here on purpose: that models a killing everybody knows you
     ordered, and this is a man who did not come back from something he was
     sent to do. The room reads those differently.
  */
  const lost = rng.pick(went);
  lost.status = 'dead';
  lost.unavailableUntilDay = null;
  addNote(lost, state.day, 'Did not come back from something you sent them to do.', 'bad');
  addLog(state, `${lost.name} did not come home.`, 'failure');
}

function landCapo(state: GameState, contract: Contract): void {
  if (!contract.factionId || !contract.targetId) return;
  removeCapo(state, contract.factionId, contract.targetId, CONTRACT.wearinessOnDeath);
}

function landBoss(state: GameState, rng: Rng, contract: Contract): void {
  const faction = contract.factionId ? state.factions[contract.factionId] : null;
  if (!faction || !contract.factionId) return;
  addLog(
    state,
    `${contract.targetName} of the ${houseShort(state, contract.factionId)} is dead. ` +
      'Somebody else has that chair now.',
    'failure',
  );
  replaceLeader(state, rng, faction, contract.factionId);
}

function landWitness(state: GameState, rng: Rng, contract: Contract): void {
  const investigation = contract.caseId ? state.law.investigations[contract.caseId] : null;
  const npc = contract.targetId ? state.npcs[contract.targetId] : null;
  if (npc) {
    npc.status = 'dead';
    npc.informingSince = undefined;
    npc.unavailableUntilDay = null;
  }
  if (!investigation) return;
  const removed = rng.float(WITNESS_CONTRACT.removed[0], WITNESS_CONTRACT.removed[1]);
  investigation.strength = Math.max(0, investigation.strength - removed);
  investigation.suspectIds = investigation.suspectIds.filter((id) => id !== contract.targetId);
  addLog(state, 'What they were building on is not available any more.', 'success');
}

/**
 * What the family decides happened, which is the only new idea here.
 *
 * `attribute` already blames somebody plausible when it cannot see clearly,
 * and grudge already drives the `ruin` agenda, pressure targeting and war
 * declarations. What it had never been given is a reason to be wrong that the
 * player controls — and that is the piece. A cold one is a careful job.
 *
 * Nothing about the result is logged. `mistaken` is stored for tests and the
 * tracer and is never rendered; the player finds out a family has the wrong
 * idea by watching what they do about it.
 */
function theyWorkItOut(
  state: GameState,
  rng: Rng,
  contract: Contract,
  care: number,
  worked: boolean,
): void {
  if (!contract.factionId) return;
  const faction = state.factions[contract.factionId];
  if (!faction) return;

  const found = attribute(
    state,
    rng,
    contract.factionId,
    'player',
    contract.territoryId,
    'violence',
    care,
  );

  const base = worked
    ? CONTRACT.grudge * (shapeOf(contract.kind).grudgeMultiplier)
    : CONTRACT.grudgeOnFailure;
  /*
     Straight off the victim's own bond matrix, keyed by whoever they decided
     it was.

     The first version looked up `state.factions[found.believed]` and used that
     to guard the bond. There is no faction entry under `player` — the player's
     side of every pair lives on the *other* family's bond — so the guard was
     false for every correct attribution and the grudge went nowhere. Four
     careers in the running game: two blamed the player at 93% and 71%
     confidence and came away holding nothing against anybody, which would have
     shipped this entire mechanic inert with all twelve unit tests green.
  */
  const bond = faction.bonds[found.believed];
  if (bond) bond.grudge = clamp(bond.grudge + base * found.confidence, 0, 100);
}

/**
 * Daily, beside the other things with a clock on them.
 *
 * Nothing here asks whether it is still a good idea — the same omission every
 * standing decision in this game makes, and for the same reason.
 */
export function tickContracts(state: GameState, rng: Rng): void {
  for (const contract of openContracts(state)) {
    // The man died of something else, or somebody else got there first.
    if (!stillThere(state, contract)) {
      contract.status = 'void';
      contract.settledDay = state.day;
      comeHome(state, rng, contract, false);
      addLog(state, `Whatever was going to happen to ${contract.targetName} already has.`, 'crew');
      continue;
    }
    if (state.day < contract.endDay) continue;

    const act = armFor(state);
    /*
       A charge, if that is the standing decision and the target is somebody
       with an address rather than one of your own.

       Not a piece off the shelf — the family keeps no inventory of these and
       nothing is spent using one. What it buys is certainty; what it costs is
       the street, and the fact that no local force works `ordnance`. See
       `CHARGE` in `config/pieces.ts`.
    */
    const charged = usingCharge(state) && contract.kind !== 'witness';
    const odds = charged ? CHARGE.odds : act.odds;
    const worked = rng.chance(clamp(contract.chance + odds, 0, 1));
    const shape = shapeOf(contract.kind);
    contract.status = worked ? 'landed' : 'missed';
    contract.settledDay = state.day;

    if (worked) {
      if (contract.kind === 'capo') landCapo(state, contract);
      else if (contract.kind === 'boss') landBoss(state, rng, contract);
      else landWitness(state, rng, contract);

      addHeat(
        state,
        CONTRACT.heat * shape.heatMultiplier * (charged ? CHARGE.heat : act.heat),
        'street',
        charged ? 'a car going up in the street' : 'a killing',
      );
      addEvidence(state, {
        day: state.day,
        source: charged ? 'ordnance' : 'violence',
        strength: Math.round(
          CONTRACT.evidence * shape.evidenceMultiplier * (charged ? CHARGE.evidence : act.evidence),
        ),
        npcIds: contract.crewIds,
        detail: charged
          ? `${contract.targetName} went up with the car. Nobody local is going to be handling that.`
          : `${contract.targetName} was killed, and whoever did it left ${leftBehind(act)}.`,
      });
      // The street remembers a crater. Sentiment gates fronts, jobs and
      // eventually whether anybody will sell to you.
      if (charged && contract.territoryId) {
        adjustSentiment(state, contract.territoryId, CHARGE.sentiment);
      }
      gainRespect(state, CONTRACT.respect * shape.respectMultiplier);
      gainFear(state, CONTRACT.fear * shape.fearMultiplier);
      addLog(state, `${contract.targetName} is dead.`, 'success');
    } else {
      /*
         He lives, and now he knows — which is strictly worse than not having
         tried, the same property `silence`'s failure has and for the same
         reason. A witness who survives it also becomes a much better witness.
      */
      addHeat(
        state,
        CONTRACT.heatOnFailure * shape.heatMultiplier * act.heat,
        'street',
        'somebody survived something',
      );
      addEvidence(state, {
        day: state.day,
        source: 'violence',
        strength: Math.round(CONTRACT.evidence * 0.7 * act.evidence),
        npcIds: contract.crewIds,
        detail: `Somebody tried for ${contract.targetName} and missed. They left ${leftBehind(act)}.`,
      });
      if (contract.kind === 'witness' && contract.caseId) {
        const investigation = state.law.investigations[contract.caseId];
        if (investigation) {
          investigation.strength = clamp(
            investigation.strength + WITNESS_CONTRACT.backfire,
            0,
            100,
          );
        }
      }
      gainFear(state, CONTRACT.fearOnFailure);
      addLog(state, `It did not happen. ${contract.targetName} knows somebody tried.`, 'failure');
    }

    /*
       A charge overrides the piece's own carefulness. Provenance is about an
       object left behind and a charge does not leave one — what it leaves is a
       very short list of people with a reason.
    */
    theyWorkItOut(
      state,
      rng,
      contract,
      charged ? CHARGE.care : PROVENANCE[act.piece.provenance].care,
      worked,
    );
    // Nothing comes off the shelf when it was a charge, so no piece is spent
    // and nothing joins the last time.
    if (!charged) spent(state, rng, act, { npcIds: contract.crewIds, landed: worked });
    comeHome(state, rng, contract, worked);
  }
}

/** Whether there is still somebody there to go after. */
function stillThere(state: GameState, contract: Contract): boolean {
  if (contract.kind === 'capo') {
    return (
      !!contract.factionId &&
      caposOf(state, contract.factionId).some((c) => c.id === contract.targetId)
    );
  }
  if (contract.kind === 'boss') {
    return (
      !!contract.factionId &&
      state.factions[contract.factionId]?.leader?.name === contract.targetName
    );
  }
  const npc = contract.targetId ? state.npcs[contract.targetId] : null;
  return !!npc && npc.status !== 'dead';
}
