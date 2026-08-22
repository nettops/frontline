/**
 * Investigations.
 *
 * A case is never conjured from a difficulty setting. An agency opens one only
 * when enough evidence matching its interests is actually lying around, and
 * every point of case strength comes from something the player did: a job that
 * went wrong, a man who was arrested, a front pushed too hard, somebody cut
 * loose who knew too much.
 *
 * The consequence is that a case is always explicable, and always was
 * avoidable. It also means going quiet genuinely works — a case with nothing
 * new to chew on loses momentum and eventually closes.
 */

import { Rng, clamp } from './rng';
import type {
  EvidenceTrace,
  GameState,
  Investigation,
  LawEnforcement,
  Npc,
} from './types';
import { addEvidence, addLog, nextId, pushEvent, weightedPick } from './util';
import { addHeat, channelHeat } from './heat';
import { addNote, crewList } from './npc';
import { nightsWorked } from './standing';
import { playerInfluence, territoryList } from './territory';
import { remember } from './memory';
import { spend, totalFunds } from './economy';
import { ownedBusinesses } from './business';
import { seizeStock } from './contraband';
import { gainFear, gainRespect } from './player';
import { removePlayer } from './succession';
import { worldMod } from './world';
import { priced } from './market';
import {
  cover,
  pressureHeatFloorDrop,
  pressurePace,
  pressureWork,
} from './perception';
import {
  AGENCIES,
  AGENCY_BY_ID,
  ARREST_SWEEP_COUNT,
  ARREST_SWEEP_DAYS,
  SWEEP_JITTER,
  ADDITIONAL_CASE_SHARE,
  CASE_CLOSED_BELOW,
  CASE_INTEL_STAGE_ABOVE,
  CASE_INTEL_STRENGTH_ABOVE,
  CASE_INTEL_SUSPECTS_ABOVE,
  COLD_CASE_AFTER_DAYS,
  COLD_CASE_DECAY_PER_WEEK,
  CONTACT,
  DESTROY_EVIDENCE,
  EVIDENCE_ABSORPTION,
  EVIDENCE_DECAY_PER_WEEK,
  EVIDENCE_STALE_AFTER_DAYS,
  EVIDENCE_WORTHLESS_BELOW,
  FINANCIAL_LAUNDER_PENALTY,
  HEAT_EVIDENCE_CONTRIBUTION,
  LAWYER_BY_LEVEL,
  MOMENTUM_HEAT_FLOOR,
  OBVIOUS_STAGES,
  PARKED_CASE_REPEAT_CHANCE,
  PARKED_CASE_RESOLVES_AFTER_DAYS,
  PRESSURE_WITNESS,
  STAGES,
  STAGE_ADVANCE_FEAR,
  STAGE_ADVANCE_LOYALTY,
  STAGE_BY_ID,
  SURVEILLANCE_OPERATION_PENALTY,
  TRIAL,
  WARRANT_SEIZURE_SHARE,
  stageIndex,
  type AgencyDef,
  type LawyerLevel,
  type StageId,
} from '../config/lawEnforcement';
import { CHANNEL_OF_SOURCE } from '../config/heat';
import { ARREST_DAYS } from '../config/operations';
import { DIFFICULTY_BY_ID } from '../config/difficulty';
import { FEAR, PAYDAY_INTERVAL } from '../config/economy';

export function newLawEnforcement(): LawEnforcement {
  return {
    investigations: {},
    contacts: {},
    lawyer: 'none',
    casesOpened: 0,
    ledger: {
      absorbed: 0,
      work: 0,
      visibility: 0,
      decayed: 0,
      caseWeeks: 0,
      coldWeeks: 0,
      closedByDecay: 0,
    },
    casesClosed: 0,
  };
}

export function activeCases(state: GameState): Investigation[] {
  return Object.values(state.law.investigations).filter(
    (c) => c.status === 'open' || c.status === 'cold',
  );
}

export function allCases(state: GameState): Investigation[] {
  return Object.values(state.law.investigations).sort((a, b) => b.openedDay - a.openedDay);
}

export function agencyOf(investigation: Investigation): AgencyDef {
  return AGENCY_BY_ID[investigation.agencyId];
}

/** The furthest any live case has got. Drives the organization-wide effects. */
export function worstStage(state: GameState): StageId | null {
  let worst: StageId | null = null;
  for (const c of activeCases(state)) {
    if (!worst || stageIndex(c.stage) > stageIndex(worst)) worst = c.stage;
  }
  return worst;
}

function atLeast(state: GameState, stage: StageId): boolean {
  const worst = worstStage(state);
  return !!worst && stageIndex(worst) >= stageIndex(stage);
}

/** Being watched makes every job harder. Read by the operations panel. */
export function surveillancePenalty(state: GameState): number {
  return atLeast(state, 'surveillance') ? SURVEILLANCE_OPERATION_PENALTY : 0;
}

/** Once they are inside the books, the fronts cannot move what they used to. */
export function launderRestriction(state: GameState): number {
  return atLeast(state, 'financial') ? FINANCIAL_LAUNDER_PENALTY : 1;
}

// ------------------------------------------------------------- evidence ---

/**
 * Evidence this agency cares about and is not already holding. Several
 * agencies can work the same facts, so this is per-case rather than global.
 */
function availableFor(
  state: GameState,
  agency: AgencyDef,
  caseId: string | null,
): EvidenceTrace[] {
  return Object.values(state.evidence).filter(
    (e) => agency.focus.includes(e.source) && (!caseId || !e.attachedTo.includes(caseId)),
  );
}

/** Old crimes go cold on their own if nobody ever picks them up. */
function decayEvidence(state: GameState): void {
  for (const trace of Object.values(state.evidence)) {
    if (trace.attachedTo.length > 0) continue;
    if (state.day - trace.day < EVIDENCE_STALE_AFTER_DAYS) continue;

    trace.strength -= EVIDENCE_DECAY_PER_WEEK;
    if (trace.strength < EVIDENCE_WORTHLESS_BELOW) {
      delete state.evidence[trace.id];
    }
  }
}

// --------------------------------------------------------------- opening ---

function openCase(state: GameState, agency: AgencyDef, traces: EvidenceTrace[]): void {
  const id = nextId(state, 'case');
  const investigation: Investigation = {
    id,
    agencyId: agency.id,
    stage: 'suspicion',
    openedDay: state.day,
    stageSince: state.day,
    strength: 0,
    suspectIds: [],
    businessIds: [],
    lastProgressDay: state.day,
    status: 'open',
    verdict: null,
    verdictDay: null,
    history: [
      {
        day: state.day,
        text: `${agency.shortName} have opened a file.`,
        obvious: false,
      },
    ],
  };

  // The evidence that caused it goes straight onto it.
  for (const trace of traces) {
    trace.attachedTo.push(id);
    investigation.strength += trace.strength * EVIDENCE_ABSORPTION;
    for (const npcId of trace.npcIds) {
      if (!investigation.suspectIds.includes(npcId)) investigation.suspectIds.push(npcId);
    }
  }
  investigation.strength = clamp(investigation.strength, 0, 100);

  state.law.investigations[id] = investigation;
  state.law.casesOpened += 1;

  // Whether you find out depends on whether you have anybody inside.
  if (hasContact(state, agency.id)) {
    addLog(
      state,
      `Your man inside ${agency.shortName} says they have opened a file on you.`,
      'heat',
    );
  }
}

/**
 * The heat an agency can actually see.
 *
 * Each agency already declared which evidence sources it cares about; those map
 * onto the three heat channels, so this needed no new configuration. The
 * arithmetic is a sum rather than a maximum on purpose — it leaves the Bureau,
 * which cares about all four sources, reading exactly the global figure it read
 * before the split, so the top of the pressure curve is unchanged. What changes
 * is the specialists: Financial Crimes no longer notices a shooting, and going
 * quiet no longer makes the Task Force forget an informant.
 */
export function agencyHeat(state: GameState, agency: AgencyDef): number {
  const seen = new Set(agency.focus.map((source) => CHANNEL_OF_SOURCE[source]));
  let total = 0;
  for (const channel of seen) total += channelHeat(state, channel);
  return Math.min(100, total);
}

/** Weekly: does anybody have enough to justify opening a case? */
/**
 * How big the organization looks from outside.
 *
 * The four things an agency can see without opening a file: how many people
 * work for you, how much of the city answers to you, how many legitimate
 * businesses have your name somewhere in them, and how thick the folder they
 * have already accumulated is. Bodies, ground, fronts and paper.
 *
 * Deliberately not respect, not clean money, and not rank. Two of those are
 * things the *street* knows and the third is a conjunction that moves at the
 * speed of its slowest term — a twenty-man crew holding six districts with
 * nothing laundered reads as an Enforcer, and used to be invisible to the Task
 * Force because of it.
 *
 * Scaled 0..100 so the thresholds in the agency table read as percentages of
 * "as large as this game gets".
 */
export function footprint(state: GameState): number {
  const bodies = Math.min(crewList(state).filter((n) => n.status !== 'dead').length / 30, 1);
  const ground = Math.min(
    territoryList(state).filter((t) => playerInfluence(t) >= 25).length / 6,
    1,
  );
  const fronts = Math.min(ownedBusinesses(state).length / 5, 1);
  const paper = Math.min(Object.keys(state.evidence).length / 40, 1);
  return bodies * 40 + ground * 30 + fronts * 15 + paper * 15;
}

function considerOpening(state: GameState): void {
  // A city that is shouting about crime is a city whose agencies reach lower
  // than they otherwise would. This is the only route by which public opinion
  // touches an investigation, and it is deliberately the only one.
  const floorDrop = pressureHeatFloorDrop(state);

  for (const agency of AGENCIES) {
    if (agencyHeat(state, agency) < agency.heatFloor - floorDrop) continue;
    // They investigate organizations proportionate to themselves.
    if (footprint(state) < agency.noticesAbove) continue;
    // One case per agency at a time.
    if (activeCases(state).some((c) => c.agencyId === agency.id)) continue;

    // Everything they care about, whether or not somebody else is already
    // working it. Reopening on the same material is prevented by closing a
    // case burning what it held, not by hiding evidence from other agencies.
    const material = availableFor(state, agency, null);
    const total = material.reduce((sum, t) => sum + t.strength, 0);
    if (total < agency.openThreshold) continue;

    openCase(state, agency, material);
  }
}

// -------------------------------------------------------------- progress ---

/** Everything the player has put between themselves and a case. */
function evidenceMultiplier(state: GameState, investigation: Investigation): number {
  let multiplier = LAWYER_BY_LEVEL[state.law.lawyer].evidenceMultiplier;
  if (hasContact(state, investigation.agencyId)) {
    multiplier *= CONTACT.evidenceMultiplier;
  }
  return multiplier;
}

function record(
  state: GameState,
  investigation: Investigation,
  text: string,
  obvious: boolean,
): void {
  investigation.history.unshift({ day: state.day, text, obvious });
  if (investigation.history.length > 40) investigation.history.length = 40;
  // The player only hears about what is unmissable or what they paid to hear.
  if (obvious || hasContact(state, investigation.agencyId)) {
    addLog(state, text, 'heat');
  }
}

function advanceStage(state: GameState, rng: Rng, investigation: Investigation): void {
  const agency = agencyOf(investigation);
  const current = stageIndex(investigation.stage);
  const next = STAGES[current + 1];
  if (!next) return;

  /*
   * An agency cannot take a case further than its reach — but a case parked at
   * the limit is not harmless. They keep doing the last thing they are allowed
   * to do, so City Police sweep your people again and again without ever being
   * able to put you away. Only the Bureau can do that, and only once you are
   * big enough for them to care.
   */
  if (stageIndex(next.id) > stageIndex(agency.maxStage)) {
    if (state.day - investigation.stageSince >= PARKED_CASE_RESOLVES_AFTER_DAYS) {
      closeCase(state, investigation, 'They took what they could and moved on.');
      return;
    }
    if (rng.chance(PARKED_CASE_REPEAT_CHANCE)) {
      applyStageEffect(state, rng, investigation, investigation.stage);
    }
    return;
  }
  if (investigation.strength < next.minEvidence) return;
  if (
    state.day - investigation.stageSince <
    STAGE_BY_ID[investigation.stage].minDays / (agency.pace * pressurePace(state))
  ) {
    return;
  }

  investigation.stage = next.id;
  investigation.stageSince = state.day;

  const obvious = OBVIOUS_STAGES.includes(next.id);
  record(state, investigation, `${agency.shortName}: ${next.name}. ${next.blurb}`, obvious);

  // Everyone in the organization feels the pressure rise.
  for (const npc of crewList(state)) {
    npc.stats.fear = clamp(npc.stats.fear + STAGE_ADVANCE_FEAR, 0, 100);
    npc.stats.loyalty = clamp(npc.stats.loyalty + STAGE_ADVANCE_LOYALTY, 0, 100);
  }

  applyStageEffect(state, rng, investigation, next.id);
}

/**
 * A sweep: the agency comes and takes people off the payroll.
 *
 * Extracted from the `arrests` stage so that the retainer could be applied to
 * it, and because a test that has to advance an investigation through five
 * stages to reach the line under test is a test of the stage machine.
 *
 * The bug this fixes: the days were rolled here with no `sentenceMultiplier`,
 * while an arrest on a job in `operations.ts` applied one. The same retainer
 * therefore gave two different answers depending on how a man happened to be
 * picked up, which from the player's side is the mechanic behaving arbitrarily
 * and is how somebody learns to stop reading it.
 *
 * `Math.max(7, ...)` is the same floor the on-the-job path has. What money
 * buys is a shorter absence, never the absence of one.
 */
export function sweep(state: GameState, rng: Rng, agencyName = 'the police'): Npc[] {
  const available = crewList(state).filter(
    (n) => n.status === 'active' || n.status === 'busy',
  );
  if (available.length === 0) return [];

  const count = Math.min(
    available.length,
    rng.int(ARREST_SWEEP_COUNT[0], ARREST_SWEEP_COUNT[1]),
  );
  /*
     They come for the people who were actually out there.

     A uniform sample made losing a man a dice roll. This makes it the bill for
     how you have been staffing jobs, which is the same decision `standing.ts`
     marks people for.

     Drawn by weight rather than sorted by it, and the difference is the whole
     mechanic. The first version of this sorted on nights-worked plus a little
     noise, and a test caught it taking the same man in forty worlds out of
     forty: once one man is far enough ahead, no amount of small noise ever
     reorders him, and the sweep becomes a lookup. A weighted draw keeps
     everybody possible while making the man who ran everything much the most
     likely.

     `SWEEP_JITTER` is the floor weight rather than added noise. It is what
     gives somebody who has been out on nothing a real if small chance of being
     picked up anyway, which is both true to how a sweep works and what stops
     the quiet men being untouchable.
  */
  const weights = available.map((npc) => ({
    npc,
    weight: nightsWorked(state, npc.id) + SWEEP_JITTER,
  }));
  const taken: Npc[] = [];
  while (taken.length < count && weights.length > 0) {
    const picked = weightedPick(weights, rng.next());
    taken.push(picked.npc);
    weights.splice(weights.indexOf(picked), 1);
  }
  const shorten = LAWYER_BY_LEVEL[state.law.lawyer].sentenceMultiplier;

  for (const npc of taken) {
    npc.status = 'arrested';
    const rolled = rng.int(ARREST_SWEEP_DAYS[0], ARREST_SWEEP_DAYS[1]);
    npc.unavailableUntilDay = state.day + Math.max(7, Math.round(rolled * shorten));
    npc.stats.fear = clamp(npc.stats.fear + 20, 0, 100);
    addNote(npc, state.day, `Swept up by ${agencyName}.`, 'bad');
  }
  return taken;
}

/**
 * What being indicted by this agency actually means for you.
 *
 * One body served every agency and all of them promised "it goes in front of a
 * jury in 25 days". Only the Federal Bureau has `maxStage: 'trial'`. The Task
 * Force and Financial Crimes stop at `indictment` and can never reach a jury,
 * so for two agencies in four that sentence described something that could not
 * happen.
 *
 * Round 11 was indicted by the Task Force on day 147, moved to the most
 * expensive counsel in the game because of it, and reached day 303 with the
 * case still at Indictment. The Overview had been reading "TASK FORCE CAN TAKE
 * IT AS FAR AS INDICTMENT" throughout, so the game contradicted itself across
 * two screens.
 *
 * The clock was wrong even where the trial is real: `TRIAL.daysToVerdict` runs
 * from the day a case *reaches* trial, and an indictment is the stage below it.
 * The Bureau's version names the stage instead of a countdown that has not
 * started.
 */
export function indictmentBody(agency: AgencyDef): string {
  const opening =
    `A grand jury sat for two weeks and you were not invited.

` +
    `The charges name you personally. Everything you have built is now a set of ` +
    `exhibits.`;

  if (agency.maxStage === 'trial') {
    return (
      `${opening} What is left is a trial, and they do not bring one they expect ` +
      `to lose.

Whatever you are going to do about it, do it before it starts.`
    );
  }

  return (
    `${opening} This is as far as ${agency.shortName} can take it — they can ` +
    `indict and no further, and an indictment that never reaches a courtroom is ` +
    `still a file with your name on every page.

` +
    `Somebody who can take it further may read that file one day.`
  );
}

function applyStageEffect(
  state: GameState,
  rng: Rng,
  investigation: Investigation,
  stage: StageId,
): void {
  const agency = agencyOf(investigation);

  switch (stage) {
    case 'witnesses': {
      // They start with the people who look most likely to talk.
      const candidates = crewList(state)
        .filter((n) => n.status !== 'dead' && !investigation.suspectIds.includes(n.id))
        .sort((a, b) => b.stats.fear - a.stats.fear);
      const picked = candidates.slice(0, rng.int(1, 3));
      for (const npc of picked) {
        investigation.suspectIds.push(npc.id);
        npc.stats.fear = clamp(npc.stats.fear + 10, 0, 100);
        addNote(npc, state.day, `Approached by ${agency.shortName}.`, 'bad');
      }
      if (picked.length) {
        record(
          state,
          investigation,
          `${agency.shortName} have been talking to ${picked.map((n) => n.name).join(' and ')}.`,
          true,
        );
      }
      return;
    }

    case 'financial': {
      const businesses = ownedBusinesses(state).sort((a, b) => b.exposure - a.exposure);
      investigation.businessIds = businesses.slice(0, 3).map((b) => b.id);
      if (investigation.businessIds.length) {
        record(
          state,
          investigation,
          `${agency.shortName} have subpoenaed your books. Everything moves slower now.`,
          true,
        );
      }
      return;
    }

    case 'warrants': {
      const share = rng.float(WARRANT_SEIZURE_SHARE[0], WARRANT_SEIZURE_SHARE[1]);
      const seized = Math.round((state.org.cash + state.org.dirtyCash) * share);
      spend(state, seized);
      record(
        state,
        investigation,
        `They came through the doors and took $${seized.toLocaleString('en-US')}.`,
        true,
      );
      // And whatever was in the building. Stock is the only asset in this
      // game that physically exists somewhere, and this is the price of that.
      seizeStock(state, rng, agency.shortName);
      cover(state, rng, 'raid', { named: true });
      return;
    }

    case 'arrests': {
      const taken = sweep(state, rng, agency.shortName);
      for (const npc of taken) {
        if (!investigation.suspectIds.includes(npc.id)) investigation.suspectIds.push(npc.id);
      }
      if (taken.length) {
        record(
          state,
          investigation,
          `${agency.shortName} took ${taken.map((n) => n.name).join(', ')}.`,
          true,
        );
        cover(state, rng, 'arrest', { who: taken[0].name, named: true });
      }
      return;
    }

    case 'indictment': {
      pushEvent(state, {
        defId: 'indictment',
        title: `${agency.shortName} have indicted you`,
        body: indictmentBody(agency),
        severity: 'danger',
        npcId: null,
        data: { caseId: investigation.id },
        choices: [
          { id: 'acknowledge', label: 'There is nothing else to say', hint: 'The trial begins' },
        ],
      });
      return;
    }

    default:
      return;
  }
}

/** Case strength is decided at trial. Everything you bought helps here. */
function resolveTrial(state: GameState, rng: Rng, investigation: Investigation): void {
  const agency = agencyOf(investigation);
  const lawyer = LAWYER_BY_LEVEL[state.law.lawyer];

  const livingSuspects = investigation.suspectIds.filter(
    (id) => state.npcs[id] && state.npcs[id].status !== 'dead',
  ).length;

  const conviction = clamp(
    investigation.strength * TRIAL.strengthWeight +
      livingSuspects * TRIAL.perSuspect -
      lawyer.trialBonus -
      (hasContact(state, agency.id) ? 0.08 : 0),
    TRIAL.minConviction,
    TRIAL.maxConviction,
  );

  investigation.verdictDay = state.day;
  investigation.status = 'resolved';
  cover(state, rng, 'trial', { named: true });

  if (rng.chance(conviction)) {
    investigation.verdict = 'convicted';
    cover(state, rng, 'conviction', { named: true });
    record(state, investigation, 'The jury convicted. It is over for them.', true);
    // They got who they came for, and the file closes with him in it.
    closeCase(state, investigation, 'They got their conviction. The file is closed.');
    /*
     * A conviction removes the player, and removing the player is not the same
     * as ending the game — if there is anybody left who can hold the room, it
     * continues as them. That is the whole point of Phase 7, and it is also
     * what makes the succession panel worth visiting before you need it.
     */
    removePlayer(
      state,
      rng,
      'convicted',
      `${agency.name} finally made it stick. The jury was out for two days and ` +
        `came back with everything the indictment asked for.`,
    );
  } else {
    investigation.verdict = 'acquitted';
    // Beating a case is the single best thing that can happen to a reputation
    // — and a humiliation the city reads about, which is not the same as good.
    gainRespect(state, TRIAL.acquittalRespect);
    cover(state, rng, 'acquittal', { named: true });
    record(
      state,
      investigation,
      'Acquitted. They spent years on you and walked out with nothing.',
      true,
    );
    closeCase(state, investigation, 'They had it and could not make it stick.');
  }
}

function closeCase(state: GameState, investigation: Investigation, reason: string): void {
  investigation.status = investigation.status === 'resolved' ? 'resolved' : 'closed';
  state.law.casesClosed += 1;

  // The trail dies with the case. Anything no other agency is still holding is
  // gone for good — this is what stops a closed case reopening on Monday.
  for (const trace of Object.values(state.evidence)) {
    if (!trace.attachedTo.includes(investigation.id)) continue;
    trace.attachedTo = trace.attachedTo.filter((id) => id !== investigation.id);
    if (trace.attachedTo.length === 0) delete state.evidence[trace.id];
  }
  addLog(state, `${agencyOf(investigation).shortName}: ${reason}`, 'success');
}

// ------------------------------------------------------------------ tick ---

/**
 * Weekly. Cases absorb what is lying around, grow on their own work, advance
 * when they have enough, and go cold when the player stops feeding them.
 */
export function tickInvestigations(state: GameState, rng: Rng): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;
  const diff = DIFFICULTY_BY_ID[state.difficulty];

  decayEvidence(state);
  tickContacts(state, rng);
  considerOpening(state);

  const ledger = state.law.ledger;

  for (const investigation of activeCases(state)) {
    const agency = agencyOf(investigation);
    const before = investigation.strength;
    if (ledger) ledger.caseWeeks += 1;

    /*
     * 1. Anything new they care about and are not already holding — less
     *    whatever your counsel keeps out of the file.
     *
     * `evidenceMultiplier` used to scale only the agency's own work, which
     * sounds right and measured wrong. Over 10,130 case-weeks a case gains
     * +6.60 a week from absorbed evidence, +2.10 from agency work and +2.33
     * from the player being visibly loud. The most expensive counterplay in
     * the game was aimed at the smallest of the three, which is why retaining
     * the best firm in the city changed nothing anybody could see.
     *
     * Getting things excluded is what the fiction has always said a defence
     * lawyer does, and it is what the multiplier is named for. A contact
     * inside the agency compounds with it for the same reason: somebody who
     * loses paperwork is doing the same job by other means.
     */
    const keptOut = evidenceMultiplier(state, investigation);
    let absorbed = 0;
    for (const trace of availableFor(state, agency, investigation.id)) {
      trace.attachedTo.push(investigation.id);
      absorbed += trace.strength * EVIDENCE_ABSORPTION * keptOut;
      for (const npcId of trace.npcIds) {
        if (!investigation.suspectIds.includes(npcId)) investigation.suspectIds.push(npcId);
      }
    }
    investigation.strength += absorbed;
    if (ledger) ledger.absorbed += absorbed;

    /*
     * 2. Their own work — but only where there is something to work on.
     *
     * Without this an agency gains strength every week from its own skill no
     * matter what the player does, which quietly makes going quiet useless and
     * every case a countdown. Momentum needs feeding: fresh evidence gives them
     * full traction, being visibly loud gives them some, and a player who has
     * genuinely gone still gives them almost nothing.
     */
    const momentum =
      absorbed > 0 ? 1 : clamp((state.org.heat - MOMENTUM_HEAT_FLOOR) / 50, 0, 1);
    const work =
      agency.skill *
      diff.heatGain *
      keptOut *
      momentum *
      worldMod(state, 'agencyWork') *
      pressureWork(state);
    const visibility = state.org.heat * HEAT_EVIDENCE_CONTRIBUTION;
    investigation.strength += work + visibility;
    if (ledger) {
      ledger.work += work;
      ledger.visibility += visibility;
    }
    investigation.strength = clamp(investigation.strength, 0, 100);

    /*
       A case stays warm on what they find, not on how loud you are.

       This tested `strength > before + 0.5`, and `visibility` is
       `heat * 0.035` with no gate on it at all — 2.03 a week at the measured
       mean heat of 58. So the clock reset every single week in every career,
       no case ever went cold, decay never ran, and `CASE_CLOSED_BELOW` did not
       fire once in 457 cases across 36 careers. Open case strength sat at 86
       of 100 permanently, from about month eight.

       The intent was already written three paragraphs above — "a player who
       has genuinely gone still gives them almost nothing" — and `momentum`
       implements it for the agency's own work. `visibility` walked straight
       past it, so going still did nothing whatsoever and every case was a
       countdown after all.

       Ambient attention is why they are looking. It is not something they
       found. Leave nothing behind for `COLD_CASE_AFTER_DAYS` and the file goes
       cold, however noisy the city thinks you are — which is the counterplay
       the whole system was built to have and did not.
    */
    if (absorbed > 0 && investigation.strength > before + 0.5) {
      investigation.lastProgressDay = state.day;
      investigation.status = 'open';
    }

    // 3. A case with nothing to chew on loses momentum, and can die entirely.
    if (state.day - investigation.lastProgressDay >= COLD_CASE_AFTER_DAYS) {
      investigation.status = 'cold';
      const cooled = Math.max(0, investigation.strength - COLD_CASE_DECAY_PER_WEEK);
      if (ledger) {
        ledger.coldWeeks += 1;
        ledger.decayed += investigation.strength - cooled;
      }
      investigation.strength = cooled;
      if (investigation.strength < CASE_CLOSED_BELOW) {
        if (ledger) ledger.closedByDecay += 1;
        closeCase(state, investigation, 'The file has been put away.');
        continue;
      }
    }

    // 4. Trial resolves on its own clock once the indictment lands.
    if (investigation.stage === 'trial') {
      if (state.day - investigation.stageSince >= TRIAL.daysToVerdict) {
        resolveTrial(state, rng, investigation);
      }
      continue;
    }

    advanceStage(state, rng, investigation);
  }
}

// ------------------------------------------------------------- contacts ---

export function hasContact(state: GameState, agencyId: string): boolean {
  const contact = state.law.contacts[agencyId];
  return !!contact && !contact.burned;
}

/** Weekly upkeep, and the standing risk that somebody notices the payments. */
function tickContacts(state: GameState, rng: Rng): void {
  for (const contact of Object.values(state.law.contacts)) {
    if (contact.burned) continue;
    const agency = AGENCY_BY_ID[contact.agencyId];

    if (!spend(state, contact.upkeep)) {
      contact.burned = true;
      addLog(
        state,
        `You stopped paying your man in ${agency.shortName}. They are no longer your man.`,
        'failure',
      );
      continue;
    }

    if (rng.chance(CONTACT.exposureChancePerWeek)) {
      contact.burned = true;
      addEvidence(state, {
        day: state.day,
        source: 'informant',
        strength: CONTACT.exposureEvidence,
        npcIds: [],
        detail: `A ${agency.shortName} employee was found to be taking payments from the organization.`,
      });
      addHeat(state, 12, 'inside', 'a corrupt official was exposed');
      cover(state, rng, 'corruption', { named: true });
      addLog(
        state,
        `Your man inside ${agency.shortName} was caught. That is now part of the case against you.`,
        'failure',
      );
    }
  }
}

// ------------------------------------------------------------------ intel ---

/** How much of a case the player can actually see. */
export function caseIntel(state: GameState, investigation: Investigation): number {
  let intel = 0;
  // Some stages announce themselves whatever you know.
  if (OBVIOUS_STAGES.includes(investigation.stage)) intel = CASE_INTEL_STAGE_ABOVE + 5;
  if (state.law.lawyer !== 'none') intel = Math.max(intel, 35);
  if (hasContact(state, investigation.agencyId)) {
    intel = Math.max(intel, CONTACT.intelValue);
  }
  return intel;
}

export interface CaseRead {
  investigation: Investigation;
  agency: AgencyDef;
  intel: number;
  /** Null when the player cannot tell. */
  stageName: string | null;
  strength: string;
  suspects: string | null;
  known: { day: number; text: string }[];
}

export function readCase(state: GameState, investigation: Investigation): CaseRead {
  const intel = caseIntel(state, investigation);
  const agency = agencyOf(investigation);

  let strength: string;
  if (intel >= CASE_INTEL_STRENGTH_ABOVE) {
    strength = `${Math.round(investigation.strength)}%`;
  } else if (intel >= CASE_INTEL_STAGE_ABOVE) {
    strength =
      investigation.strength > 60 ? 'substantial' : investigation.strength > 30 ? 'building' : 'thin';
  } else {
    strength = 'unknown';
  }

  return {
    investigation,
    agency,
    intel,
    stageName: intel >= CASE_INTEL_STAGE_ABOVE ? STAGE_BY_ID[investigation.stage].name : null,
    strength,
    suspects:
      intel >= CASE_INTEL_SUSPECTS_ABOVE
        ? investigation.suspectIds
            .map((id) => state.npcs[id]?.name)
            .filter(Boolean)
            .join(', ') || 'nobody yet'
        : null,
    known: investigation.history
      .filter((h) => h.obvious || intel >= CASE_INTEL_STAGE_ABOVE)
      .slice(0, 12),
  };
}

export interface ArrestRisk {
  level: 'clear' | 'traces' | 'watched' | 'building' | 'closing';
  line: string;
  /**
   * What an arrest actually costs you, in weeks of a person's life.
   *
   * A playtester lost their whole crew to arrests, spent months unable to act,
   * and wrote: "a new player has no way to know in advance that an arrest
   * sidelines someone for that long." They were right. The countdown appears on
   * the crew sheet the moment somebody is taken — `Held · 84d` — and nowhere
   * before that does the game admit the range is one to four months.
   *
   * The heat meter is where a player looks before deciding whether to push, so
   * that is where the price belongs.
   */
  cost: string;
  /**
   * How far the worst of them could take it, whatever the heat says.
   *
   * Null only when nobody could open a case at all. This is the number that
   * makes the heat meter mean something: a second playtester held street heat
   * at 100 for fifteen days on the hardest difficulty and was never in any
   * danger, because the only agency that will look at a street criminal is the
   * city police and they cannot indict anybody. Both testers read 100/100 as
   * maximum peril. It is not, and the game should say so out loud rather than
   * letting the player supply their own dread.
   */
  ceiling: string | null;
}

/** Everyone who would look at an organization this size. */
function agenciesInRange(state: GameState): AgencyDef[] {
  const size = footprint(state);
  return AGENCIES.filter((a) => a.noticesAbove <= size);
}

/** The furthest anybody currently interested in you could take it. */
function worstCeiling(agencies: AgencyDef[]): AgencyDef | null {
  let worst: AgencyDef | null = null;
  for (const agency of agencies) {
    if (!worst || stageIndex(agency.maxStage) > stageIndex(worst.maxStage)) worst = agency;
  }
  return worst;
}

/**
 * Whether you are actually in trouble, in one sentence.
 *
 * The stat bar has a heat number and the overview has a tier, and a playtester
 * ran an organization at 100/100 heat for a week and a half without so much as
 * a file being opened — because heat is attention and a case is evidence, and
 * evidence only comes from work that went wrong. That is the design and it is
 * worth keeping: a loud operator who never fumbles genuinely is safe. What was
 * not worth keeping is that the player had no way to know which of the two
 * they were looking at, so the number that dominates the screen was, in their
 * words, "cosmetic dread".
 *
 * This does not lift the fog. It reports only what the player is entitled to
 * see — an unreadable case says so rather than leaking its stage — because
 * being told there is a file and not what is in it is the tension, not a gap.
 */
export function arrestRisk(state: GameState): ArrestRisk {
  const cases = activeCases(state);

  /*
     What is actually on the table.

     Taken from the agencies that would look at an organization your size, not
     from the ones with a file open — because the question the player is asking
     at 90 heat is "how bad can this get", and the honest answer at a low rank
     is "arrested, and no worse". A federal case is a thing you become eligible
     for by succeeding, which is a much better sentence than a heat meter.
  */
  /*
     Stated in weeks rather than days, and as a range rather than an average,
     because the range is the point: thirty days is a bad month and a hundred
     and twenty is a third of a year, and the player is being asked to gamble
     without being told which end of that they are betting.
  */
  const shorten = LAWYER_BY_LEVEL[state.law.lawyer].sentenceMultiplier;
  const lo = Math.round((ARREST_DAYS[0] * shorten) / 7);
  const hi = Math.round((ARREST_DAYS[1] * shorten) / 7);
  const cost =
    `An arrest holds somebody ${lo} to ${hi} weeks` +
    (shorten < 1
      ? ', with your counsel on it.'
      : '. Counsel would cut that, and it would apply to everybody.');

  const inRange = agenciesInRange(state);
  const openWorst = worstCeiling(cases.map((c) => agencyOf(c)));
  const ceilingAgency = openWorst ?? worstCeiling(inRange);
  const ceiling = ceilingAgency
    ? `${ceilingAgency.shortName} can take it as far as ${STAGE_BY_ID[
        ceilingAgency.maxStage
      ].name.toLowerCase()}`
    : null;

  if (cases.length === 0) {
    const loose = looseEvidence(state);
    if (loose <= 0) {
      return { level: 'clear', line: 'Nobody has a file open on you.', ceiling, cost };
    }
    return {
      level: 'traces',
      line: 'No file open yet. There is evidence lying around with your name on it.',
      ceiling,
      cost,
    };
  }

  const reads = cases.map((c) => readCase(state, c));
  const named = reads.find((r) => r.stageName !== null);
  if (!named) {
    return {
      level: 'watched',
      line: `${reads[0].agency.name} has a file open. What is in it, you do not know — a lawyer or a friend inside would tell you.`,
      ceiling,
      cost,
    };
  }

  const worst = worstStage(state);
  const late = !!worst && stageIndex(worst) >= stageIndex('warrants');
  const middle = !!worst && stageIndex(worst) >= stageIndex('surveillance');
  return {
    level: late ? 'closing' : middle ? 'building' : 'watched',
    line: late
      ? `${named.agency.name}: ${named.stageName!.toLowerCase()}. This is the end of a case, not the start of one.`
      : middle
        ? `${named.agency.name}: ${named.stageName!.toLowerCase()}. They are building something.`
        : `${named.agency.name} is asking questions. They have nothing yet.`,
    ceiling,
    cost,
  };
}

/** Total unattached evidence — what a new agency could still pick up. */
export function looseEvidence(state: GameState): number {
  return Object.values(state.evidence)
    .filter((e) => e.attachedTo.length === 0)
    .reduce((sum, e) => sum + e.strength, 0);
}

// ------------------------------------------------------------ counterplay ---

export interface LegalAction {
  ok: boolean;
  message: string;
}

/** Weekly legal bill across every agency currently working on you. */
/**
 * What a given tier would cost this week, whether or not it is the one retained.
 *
 * The picker showed "×2.6 retainer" and the page header showed one total, so a
 * player chose a tier without ever being told its price. Round 11 selected the
 * local attorney on day 30 reading "$381 / WEEK IN LEGAL" and was billed
 * $1,058 for the same unchanged tier on day 60 — correct behaviour, since the
 * bill scales with how many agencies are working and how serious the worst of
 * them is, and disclosed nowhere.
 */
export function legalCostAt(state: GameState, level: LawyerLevel): number {
  return weeklyLegalCost(state, level);
}

export function weeklyLegalCost(state: GameState, level?: LawyerLevel): number {
  const lawyer = LAWYER_BY_LEVEL[level ?? state.law.lawyer];
  if (lawyer.costMultiplier === 0) return 0;
  const cases = activeCases(state);
  /*
     The worst case in full, and a share of each of the others.

     A retainer with nobody investigating you is a modest insurance premium,
     and a second agency is more work rather than a second firm. Summing every
     case at full rate and then applying `costMultiplier` to the total is what
     produced a bill six times the payroll.
  */
  const rates = cases
    .map((c) => priced(state, agencyOf(c).legalCostPerWeek))
    .sort((a, b) => b - a);
  const base = rates.length
    ? rates[0] + rates.slice(1).reduce((sum, r) => sum + r * ADDITIONAL_CASE_SHARE, 0)
    : priced(state, AGENCY_BY_ID['city_police'].legalCostPerWeek);
  return Math.round(base * lawyer.costMultiplier);
}

export function retainLawyer(state: GameState, level: LawyerLevel): LegalAction {
  state.law.lawyer = level;
  const def = LAWYER_BY_LEVEL[level];
  addLog(
    state,
    level === 'none'
      ? 'You have let your representation go.'
      : `${def.name} is on retainer — $${weeklyLegalCost(state).toLocaleString('en-US')} a week.`,
    'money',
  );
  return { ok: true, message: def.name };
}

export function contactCost(state: GameState, agencyId: string): number {
  const agency = AGENCY_BY_ID[agencyId];
  // People are cheaper to turn when you have pull.
  const discount = clamp(state.player.attributes.influence * 0.02, 0, 0.3);
  return Math.round(priced(state, agency.contactCost) * (1 - discount));
}

export function canBuyContact(state: GameState, agencyId: string): LegalAction {
  const agency = AGENCY_BY_ID[agencyId];
  if (!agency) return { ok: false, message: 'No such agency.' };
  if (hasContact(state, agencyId)) {
    return { ok: false, message: 'You already have somebody inside.' };
  }
  if (state.player.attributes.influence < agency.contactInfluenceRequired) {
    return {
      ok: false,
      message: `Nobody in ${agency.shortName} will take your call. Needs Influence ${agency.contactInfluenceRequired}.`,
    };
  }
  if (totalFunds(state) < contactCost(state, agencyId)) {
    return { ok: false, message: 'You cannot cover it.' };
  }
  return { ok: true, message: `Turn somebody inside ${agency.shortName}` };
}

/**
 * Buying somebody inside. They tell you what the file says and slow it down —
 * and they are a person who knows you are paying them, which is its own kind
 * of evidence waiting to happen.
 */
export function buyContact(state: GameState, agencyId: string): LegalAction {
  const check = canBuyContact(state, agencyId);
  if (!check.ok) return check;

  const cost = contactCost(state, agencyId);
  if (!spend(state, cost)) return { ok: false, message: 'You cannot cover it.' };

  const agency = AGENCY_BY_ID[agencyId];
  state.law.contacts[agencyId] = {
    agencyId,
    since: state.day,
    upkeep: Math.round(contactCost(state, agencyId) * CONTACT.upkeepShare),
    burned: false,
  };
  addLog(state, `You have somebody inside ${agency.shortName} now.`, 'crew');
  return { ok: true, message: `Somebody inside ${agency.shortName}.` };
}

/**
 * Getting at what they have already collected. Works often enough to be worth
 * trying and fails badly enough to make it a real decision.
 */
export function destroyEvidence(
  state: GameState,
  rng: Rng,
  caseId: string,
): LegalAction {
  const investigation = state.law.investigations[caseId];
  if (!investigation || investigation.status === 'closed') {
    return { ok: false, message: 'There is nothing to get at.' };
  }
  if (!spend(state, DESTROY_EVIDENCE.cost)) {
    return { ok: false, message: 'You cannot cover it.' };
  }

  const chance = clamp(
    DESTROY_EVIDENCE.baseSuccess +
      state.player.attributes.streetSmarts * DESTROY_EVIDENCE.successPerStreetSmarts,
    0.1,
    0.9,
  );

  if (rng.chance(chance)) {
    const removed = rng.float(DESTROY_EVIDENCE.removed[0], DESTROY_EVIDENCE.removed[1]);
    investigation.strength = Math.max(0, investigation.strength - removed);
    record(state, investigation, 'Something they were relying on is no longer available.', false);
    addLog(state, 'What they had is not what they have.', 'success');
    return { ok: true, message: 'It is gone.' };
  }

  investigation.strength = clamp(
    investigation.strength + DESTROY_EVIDENCE.backfireEvidence,
    0,
    100,
  );
  addHeat(state, DESTROY_EVIDENCE.backfireHeat, 'inside', 'tampering');
  record(state, investigation, 'Somebody tried to get at the file. That is a charge of its own.', true);
  addLog(state, 'It went wrong, and now that is part of the case too.', 'failure');
  return { ok: false, message: 'It went wrong.' };
}

/** Leaning on somebody they have lined up to testify. */
export function pressureWitness(
  state: GameState,
  rng: Rng,
  caseId: string,
  npcId: string,
): LegalAction {
  const investigation = state.law.investigations[caseId];
  const npc = state.npcs[npcId];
  if (!investigation || !npc) return { ok: false, message: 'Nobody to lean on.' };
  if (!spend(state, PRESSURE_WITNESS.cost)) {
    return { ok: false, message: 'You cannot cover it.' };
  }

  // What fear is actually for. A man weighing whether to testify is weighing
  // it against what he has watched happen to other people.
  const chance = clamp(
    PRESSURE_WITNESS.baseSuccess +
      state.player.attributes.intimidation * PRESSURE_WITNESS.successPerIntimidation +
      clamp(state.org.fear / FEAR.max, 0, 1) * FEAR.witnessBonusAtMax,
    0.1,
    0.9,
  );

  if (rng.chance(chance)) {
    const removed = rng.float(PRESSURE_WITNESS.removed[0], PRESSURE_WITNESS.removed[1]);
    investigation.strength = Math.max(0, investigation.strength - removed);
    investigation.suspectIds = investigation.suspectIds.filter((id) => id !== npcId);
    npc.stats.fear = clamp(npc.stats.fear + 25, 0, 100);
    npc.stats.loyalty = clamp(npc.stats.loyalty - 8, 0, 100);
    // He stopped talking to them. He did not stop remembering why.
    remember(npc, state.day, 'was_leaned_on');
    addNote(npc, state.day, 'Was reminded of their obligations.', 'bad');
    gainFear(state, FEAR.fromIntimidation);
    addLog(state, `${npc.name} has stopped being helpful to them.`, 'success');
    return { ok: true, message: `${npc.name} has reconsidered.` };
  }

  // Witness tampering is exactly the kind of thing that makes a weak case strong.
  investigation.strength = clamp(
    investigation.strength + PRESSURE_WITNESS.backfireEvidence,
    0,
    100,
  );
  addHeat(state, PRESSURE_WITNESS.backfireHeat, 'inside', 'witness tampering');
  addEvidence(state, {
    day: state.day,
    source: 'informant',
    strength: 15,
    npcIds: [npcId],
    detail: `${npc.name} reported being threatened.`,
    attachedTo: [investigation.id],
  });
  record(state, investigation, `${npc.name} told them they had been threatened.`, true);
  return { ok: false, message: 'They went straight to them.' };
}
