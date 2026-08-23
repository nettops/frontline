/**
 * Operations: the core risk/reward loop.
 *
 * Launching commits crew and money for a number of days. Resolution is a
 * single roll against a chance the player was shown up front, and failure
 * rolls a consequence — the point is that a bad run costs you people and
 * attention, not just the investment.
 */

import { Rng, clamp } from './rng';
import type {
  ActiveOperation,
  GameState,
  Npc,
  OperationDef,
  OperationResult,
  OpsBoard,
} from './types';
import { addEvidence, addLog, nextId, weightedPick } from './util';
import { addHeat, heatSuccessPenalty, isLayingLow } from './heat';
import { earnDirty, refundDirty, spend, totalFunds } from './economy';
import { ownedBusinesses } from './business';
import {
  addNote,
  creditOperation,
  crewList,
  crewTraitEffect,
  gainFamiliarity,
  traitEffect,
} from './npc';
import { tiesFromOperation, tookTheBlame } from './ties';
import { remember } from './memory';
import { keepPromise } from './promises';
import { cover } from './perception';
import { gainFear, gainRespect, trainAttribute } from './player';
import { noteInfluenceTaken } from './faction';
import { surveillancePenalty } from './investigation';
import { worldMod, worldSuccessDelta } from './world';
import { activity, priced, prices } from './market';
import {
  addInfluence,
  adjustSentiment,
  canOperateIn,
  controlledTerritories,
  hasPresence,
  heatMultiplier,
  payoutMultiplier,
  successModifier,
  territoryDef,
} from './territory';
import {
  INFLUENCE_ON_FAILURE_SHARE,
  INFLUENCE_PER_OPERATION,
  INFLUENCE_PER_OPERATION_TIER,
  SENTIMENT_HOSTILE_BELOW,
  SENTIMENT_ON_FAILURE,
  SENTIMENT_ON_SUCCESS,
  SENTIMENT_ON_VIOLENCE,
} from '../config/territories';
import {
  APPROACH_BY_ID,
  ARREST_DAYS,
  ARREST_FEAR_INCREASE,
  ARREST_LOYALTY_HIT,
  ATTRIBUTE_WEIGHT,
  CREW_COMPETENCE_WEIGHT,
  CREW_SKILL_VS_DISCIPLINE,
  DEFAULT_APPROACH,
  EVIDENCE_STRENGTH_RANGE,
  EXTRA_LOSS_SHARE,
  FAILURE_CONSEQUENCES,
  FAILURE_INVESTMENT_RECOVERY,
  HEAT_SPIKE_RANGE,
  heatDistance,
  heatScaleForDistance,
  INJURY_DAYS,
  INJURY_GRIEVANCE,
  MAX_SUCCESS_CHANCE,
  MIN_SUCCESS_CHANCE,
  OPERATIONS,
  OPERATION_BY_ID,
  PAYOUT_MARGIN_INFLUENCE,
  type ApproachId,
} from '../config/operations';
import { LAWYER_BY_LEVEL } from '../config/lawEnforcement';
import { CANCEL_OPERATION_HEAT } from '../config/heat';
import { ATTRIBUTE_MAX, FEAR, ROLE_ORDER, rankIndex } from '../config/economy';
import { civicRoster } from './civic';
import { bond } from './diplomacy';
import { rivals } from './faction';
import { FAMILIARITY_PER_OPERATION, BEHAVIOUR } from '../config/npcs';
import { DIFFICULTY_BY_ID } from '../config/difficulty';

/**
 * Everything a job's unlock condition is allowed to know about.
 *
 * Built once per call rather than per job: `opsBy` is a pass over the whole
 * operation history, and doing that twenty-three times to draw one table was
 * the obvious way to make a menu expensive.
 */
function opsBoard(state: GameState): OpsBoard {
  const opsBy: Record<string, number> = {};
  for (const r of state.operationHistory) {
    opsBy[r.defId] = (opsBy[r.defId] ?? 0) + 1;
  }
  /*
     Who you know, gathered here so `opens.met` stays a pure function of the
     board. Both are read straight off state that already exists — a favour a
     figure owes you, and the warmest a surviving rival feels toward you.

     `owed` rather than `standing` for the civic half, and that is a design
     decision rather than a convenience: standing drifts toward a target every
     week in `tickCivic`, so a job gated on it would open and shut with nothing
     the player did. A favour owed is the durable thing, and it is capped by
     `CIVIC.maxOwed`, so this cannot become free.
  */
  const favoursOwed: Record<string, number> = {};
  for (const f of civicRoster(state)) favoursOwed[f.id] = f.owed;

  const bestRivalTrust = rivals(state)
    .filter((f) => f.strength > 0)
    .reduce((best, f) => Math.max(best, bond(state, 'player', f.id).trust), -100);

  return {
    rank: rankIndex(state.player.rank),
    districtsHeld: controlledTerritories(state).length,
    fronts: ownedBusinesses(state).length,
    crew: crewList(state).filter((n) => n.status !== 'dead').length,
    opsBy,
    favoursOwed,
    bestRivalTrust,
  };
}

function isOpen(def: OperationDef, board: OpsBoard): boolean {
  return rankIndex(def.minRank) <= board.rank || (def.opens?.met(board) ?? false);
}

/** Jobs the player's standing — or their record — allows them to take on. */
export function availableOperations(state: GameState): OperationDef[] {
  const board = opsBoard(state);
  return OPERATIONS.filter((op) => isOpen(op, board));
}

/** Jobs that exist but are still above the player — shown greyed out, as goals. */
export function lockedOperations(state: GameState): OperationDef[] {
  const board = opsBoard(state);
  return OPERATIONS.filter((op) => !isOpen(op, board));
}

/**
 * How much attention this job actually draws given who the player is now.
 *
 * Work far beneath your standing is close to invisible — nobody building a
 * case against a Capo cares about a corner shakedown. This is the player's
 * main lever against heat: earn quietly on small work while attention decays,
 * then spend that headroom on something big.
 *
 * It used to read rank and nothing else, which meant the lever did not exist
 * for anybody who had not already climbed — and measurement put that at 0
 * careers in 24. See `heatDistance`: rank is now one contributor among four,
 * and the other three are things a player can build on the way up.
 *
 * `crew` and `territoryId` are optional so that a caller with nothing in hand
 * — the job table, which is drawn before you have picked anybody — still gets
 * the honest figure for the job on its own. Whoever you end up sending only
 * ever makes it quieter, so the table under-promises rather than over-promises.
 */
export function heatScale(
  state: GameState,
  def: OperationDef,
  crew: Npc[] = [],
  territoryId?: string,
): number {
  const sentSeniority = crew.reduce(
    (top, npc) => Math.max(top, ROLE_ORDER.indexOf(npc.role)),
    0,
  );
  const territory = territoryId ? state.territories[territoryId] : undefined;
  return heatScaleForDistance(
    heatDistance({
      rankGap: rankIndex(state.player.rank) - rankIndex(def.minRank),
      sentSeniority,
      stewarded: !!territory?.stewardId,
      crew: crewList(state).filter((n) => n.status !== 'dead').length,
    }),
  );
}

// ------------------------------------------------------- success formula ---

/**
 * How good the assigned crew is at this. Skill carries most of the weight,
 * but discipline matters — a talented sloppy crew is worse than a merely
 * competent careful one, because sloppiness is what gets noticed.
 */
export function crewCompetence(crew: Npc[]): number {
  /*
     Nobody is neutral, not terrible.

     Competence is centred on 50, so returning 0 for an empty crew scored a job
     with no crew as though it had the worst possible one — a full negative
     weight against the odds. That was harmless while every job needed at least
     one body. `work_it_yourself` needs none, and on that job the crew term
     should simply not apply: what carries it is the player's own attribute,
     which `successBreakdown` already counts separately.
  */
  if (crew.length === 0) return 50;
  const total = crew.reduce(
    (sum, n) =>
      sum +
      n.stats.skill * CREW_SKILL_VS_DISCIPLINE +
      n.stats.discipline * (1 - CREW_SKILL_VS_DISCIPLINE),
    0,
  );
  return total / crew.length;
}

export interface ChanceBreakdown {
  base: number;
  crew: number;
  attribute: number;
  heat: number;
  /**
   * Being actively watched, which is a case rather than a heat level.
   *
   * Separate from `heat` because the two have different cures: heat bleeds off
   * when you stop, a case does not. See successBreakdown.
   */
  watched: number;
  territory: number;
  difficulty: number;
  /** What the city is doing this month. Zero when nothing is going on. */
  world: number;
  /** How you chose to do it. Zero on the straight approach. */
  approach: number;
  total: number;
}

/** Every term is exposed so the UI can show the player *why* the number is what it is. */
/**
 * What this job will do to the district, said before it is launched.
 *
 * F10 was the refusal: the game turned you away from every front in a district
 * and never named the number doing it. That is fixed, and round 13 read the
 * repaired sentence, understood it, and still filed the front gate as its
 * First hour blocker — because a refusal can only be read after you have spent
 * two weeks earning it. F12 is the other half. The coupling itself is never
 * taught: work a district, its feeling falls, and below the bar nobody there
 * will sell you anything.
 *
 * The only warning that existed was the words "the street minds" on the Heavy
 * button. No district, no figure, no consequence.
 *
 * Written to match the heat line that sits above the district picker — where
 * you stand, what it costs, what it costs if it goes wrong — because that line
 * was added for this exact complaint about heat and it worked. One sentence in
 * the place the decision is made beats a page that explains the system.
 *
 * A string in sim rather than in the panel, for the same reason `canAcquire`
 * puts its refusal here: there is no jsdom in this project, and a sentence
 * that carries a rule has to be testable.
 */
export function sentimentOutlook(
  state: GameState,
  territoryId: string,
  approach: ApproachId = DEFAULT_APPROACH,
): string {
  const t = state.territories[territoryId];
  if (!t) return '';
  const name = territoryDef(territoryId).name;
  const now = Math.round(t.sentiment);
  const ofApproach = Math.abs(APPROACH_BY_ID[approach].sentiment);

  // Named in the order they bite: what you have chosen, then what luck can add.
  const costs = ofApproach
    ? `${ofApproach} on its own, a job that goes wrong costs ${Math.abs(SENTIMENT_ON_FAILURE)} more ` +
      `and violence costs ${Math.abs(SENTIMENT_ON_VIOLENCE)}`
    : `nothing on its own, but a job that goes wrong costs ${Math.abs(SENTIMENT_ON_FAILURE)} ` +
      `and violence costs ${Math.abs(SENTIMENT_ON_VIOLENCE)}`;

  return (
    `Public feeling in ${name} is ${now}. This costs ${costs}. ` +
    `Below ${SENTIMENT_HOSTILE_BELOW} nobody there sells you a business.`
  );
}

/**
 * How a job is being done, for a state that may predate the choice existing.
 * Never read `op.approach` directly — old saves do not have one.
 */
export function approachOf(op: { approach?: ApproachId }): ApproachId {
  return op.approach ?? DEFAULT_APPROACH;
}

export function successBreakdown(
  state: GameState,
  def: OperationDef,
  crew: Npc[],
  territoryId: string,
  approach: ApproachId = DEFAULT_APPROACH,
): ChanceBreakdown {
  const diff = DIFFICULTY_BY_ID[state.difficulty];
  // Competence is centred on 50, so an average crew is neutral rather than a bonus.
  const crewTerm = ((crewCompetence(crew) - 50) / 50) * CREW_COMPETENCE_WEIGHT;
  const attrTerm =
    (state.player.attributes[def.attribute] / ATTRIBUTE_MAX) * ATTRIBUTE_WEIGHT;
  /*
     Two costs, two rows, because they are two different problems.

     These used to be one term labelled "Current heat", on the reasoning that
     being watched was not something a player could act on separately. Round 11
     read that row against the top bar on four days and found it charging more
     at *lower* heat — heat 27 cost 8 points, heat 11 cost 13 — reproduced 155
     days apart. The arithmetic was never wrong; the total has always been
     honest. The label was, and it named one thing while reporting two.

     It cost that tester roughly $10,500 and 28 idle days across two lay-lows,
     bought to move a number that was only partly the number they were moving.
     Laying low sheds heat. It does not close a case. Being told those are one
     figure is exactly what makes a player pay for the wrong cure.
  */
  const heatTerm = -heatSuccessPenalty(state);
  const watchedTerm = -surveillancePenalty(state);
  const diffTerm = diff.successModifier;

  const territory = state.territories[territoryId];
  const territoryTerm = territory
    ? successModifier(territory, territoryDef(territoryId), !hasPresence(territory))
    : 0;

  const worldTerm = worldSuccessDelta(state);

  const approachTerm = APPROACH_BY_ID[approach].success;

  const total = clamp(
    def.baseSuccess +
      crewTerm +
      attrTerm +
      heatTerm +
      watchedTerm +
      territoryTerm +
      diffTerm +
      worldTerm +
      approachTerm,
    MIN_SUCCESS_CHANCE,
    MAX_SUCCESS_CHANCE,
  );

  return {
    base: def.baseSuccess,
    crew: crewTerm,
    attribute: attrTerm,
    heat: heatTerm,
    watched: watchedTerm,
    territory: territoryTerm,
    difficulty: diffTerm,
    world: worldTerm,
    approach: approachTerm,
    total,
  };
}

// ---------------------------------------------------------------- launch ---

export interface LaunchCheck {
  ok: boolean;
  reason: string | null;
}

export function canLaunch(
  state: GameState,
  def: OperationDef,
  crewIds: string[],
  territoryId: string,
  approach: ApproachId = DEFAULT_APPROACH,
): LaunchCheck {
  /*
     Quiet work is the one thing that still moves while you are dark.

     Going quiet used to stop everything, and round 13 spent about 60 of its 300
     days in that state across four stretches: "the punishment for heat is not
     danger, it is 14 days of pressing +1 week." A cost that takes the game away
     is not a cost inside the game, and it was the round's first MUST FIX.

     The heat maths below is deliberately untouched. A job launched while dark
     still resets `quietDays` and still costs that day's decay, which is exactly
     what keeps this a decision instead of a free lunch — take the reduced money
     and do not cool today, or stay dark and cool at four times the rate, every
     day for a fortnight. Quiet only, because the whole point of the state is
     that nobody is supposed to be hearing about you.

     `approach` defaults to the loud one so that every existing caller — and the
     probes, which model bots that simply stop — keeps meaning what it meant.
  */
  if (isLayingLow(state) && approach !== 'quiet') {
    return {
      ok: false,
      reason: 'You are laying low. Only quiet work moves until that ends.',
    };
  }
  if (!state.territories[territoryId]) {
    return { ok: false, reason: 'Pick somewhere to run it.' };
  }
  if (!canOperateIn(state, territoryId)) {
    return {
      ok: false,
      reason: `You have no way into ${territoryDef(territoryId).name}. Work somewhere next to it first.`,
    };
  }
  if (crewIds.length !== def.crewRequired) {
    return {
      ok: false,
      reason: `Needs exactly ${def.crewRequired} available crew.`,
    };
  }
  /*
     The one job whose body is you, and there is only one of you.

     Everything else in this function limits work by occupying people, which is
     why nothing ever needed to say this: assign a man and he is busy. A job
     with `crewRequired: 0` occupies nobody, so the crew check above passed
     forever and `work_it_yourself` could be launched as many times as the
     player had patience for — unlimited income at no cost but attention.

     A round-7 tester found it on day 2 and had tripled their income before
     they understood the game. Three of this project's own probe bots carry a
     line skipping zero-crew jobs when one is already running, written to stop
     the measurements being distorted; nobody asked why the guard was needed.
  */
  if (def.crewRequired === 0) {
    const alreadyOut = Object.values(state.activeOperations).some(
      (op) => (OPERATION_BY_ID[op.defId]?.crewRequired ?? 1) === 0,
    );
    if (alreadyOut) {
      return {
        ok: false,
        reason: 'You are already out on one of these. There is only one of you.',
      };
    }
  }
  for (const id of crewIds) {
    const npc = state.npcs[id];
    if (!npc || npc.status !== 'active') {
      return { ok: false, reason: 'One of the selected crew is not available.' };
    }
  }
  if (totalFunds(state) < operationCost(state, def)) {
    return { ok: false, reason: 'You cannot cover the up-front cost.' };
  }
  return { ok: true, reason: null };
}

/** What this job costs to put together, in this year's money. */
export function operationCost(state: GameState, def: OperationDef): number {
  return priced(state, def.investment);
}

export function launchOperation(
  state: GameState,
  defId: string,
  crewIds: string[],
  territoryId: string,
  approach: ApproachId = DEFAULT_APPROACH,
): ActiveOperation | null {
  const def = OPERATION_BY_ID[defId];
  if (!def) return null;
  const check = canLaunch(state, def, crewIds, territoryId, approach);
  if (!check.ok) return null;

  const cost = operationCost(state, def);
  if (!spend(state, cost)) return null;

  const crew = crewIds.map((id) => state.npcs[id]);
  const chance = successBreakdown(state, def, crew, territoryId, approach).total;

  for (const npc of crew) {
    npc.status = 'busy';
    npc.unavailableUntilDay = state.day + def.durationDays;
    // If he was told he had the next one, this was it.
    keepPromise(state, npc.id, 'next_job');
  }

  const op: ActiveOperation = {
    id: nextId(state, 'op'),
    defId,
    territoryId,
    crewIds: [...crewIds],
    startDay: state.day,
    endDay: state.day + def.durationDays,
    investment: cost,
    successChance: chance,
    approach,
    projectedPayout: priced(
      state,
      Math.round(((def.payout[0] + def.payout[1]) / 2) * APPROACH_BY_ID[approach].payout),
    ),
  };
  state.activeOperations[op.id] = op;

  addLog(
    state,
    `${def.name} is underway in ${territoryDef(territoryId).name}. ${crew.length} on it, ${
      def.durationDays
    } ${def.durationDays === 1 ? 'day' : 'days'}.`,
    'neutral',
  );
  return op;
}

/** Pulling the plug refunds most of the money but leaves loose ends. */
export function cancelOperation(state: GameState, opId: string): void {
  const op = state.activeOperations[opId];
  if (!op) return;
  const def = OPERATION_BY_ID[op.defId];

  for (const id of op.crewIds) {
    const npc = state.npcs[id];
    if (npc && npc.status === 'busy') {
      npc.status = 'active';
      npc.unavailableUntilDay = null;
    }
  }
  // Handed back, not earned — see `refundDirty`. A partner taking a share of
  // your own returned stake is a leak, and one that only shows up on a week
  // that is already going badly.
  refundDirty(state, Math.round(op.investment * 0.7));
  delete state.activeOperations[opId];
  addHeat(state, CANCEL_OPERATION_HEAT, 'street', 'aborted job');
  addLog(state, `${def?.name ?? 'An operation'} was called off. Not cleanly.`, 'neutral');
}

// -------------------------------------------------------------- resolve ----

export function tickOperations(state: GameState, rng: Rng): void {
  for (const op of Object.values(state.activeOperations)) {
    if (state.day >= op.endDay) resolveOperation(state, rng, op);
  }
}

function resolveOperation(state: GameState, rng: Rng, op: ActiveOperation): void {
  const def = OPERATION_BY_ID[op.defId];
  const diff = DIFFICULTY_BY_ID[state.difficulty];
  delete state.activeOperations[op.id];

  const crew = op.crewIds.map((id) => state.npcs[id]).filter(Boolean);
  // Free everyone first — consequences below may take some of them again.
  for (const npc of crew) {
    if (npc.status === 'busy') {
      npc.status = 'active';
      npc.unavailableUntilDay = null;
    }
    gainFamiliarity(npc, FAMILIARITY_PER_OPERATION);
  }

  const roll = rng.next();
  const success = roll < op.successChance;
  // Margin: how comfortably the roll cleared (or missed) the bar, 0..1.
  const margin = success
    ? (op.successChance - roll) / Math.max(op.successChance, 0.0001)
    : (roll - op.successChance) / Math.max(1 - op.successChance, 0.0001);

  /*
     The ordinary night, which was the one going unrecorded.

     Notes were written when somebody was hurt or arrested and at no other
     time, so a man could run thirty clean jobs and have a blank sheet. That is
     the record a player is supposed to read who-carries-what from, and it held
     only the disasters.

     Failure is `neutral` rather than `bad`. The job going wrong is not
     something that was done *to* him, and `bad` is reserved for that — being
     left unpaid, being passed over, taking a charge on your account.
  */
  /*
     No note is written here. `creditOperation` in npc.ts already writes this
     man one for this job, and for a long time both did — so round 11 read
     every entry twice, "Worked the Debt Collection. It went clean." directly
     under "Out on the Debt Collection. It went clean." That doubles the length
     of the one screen in this game that makes a person out of a row.
  */

  const territory = state.territories[op.territoryId];
  const tDef = territoryDef(op.territoryId);
  // Whether they knew you here is decided at launch, not after the fact.
  const unfamiliar = !hasPresence(territory);
  const influenceStep =
    INFLUENCE_PER_OPERATION + rankIndex(def.minRank) * INFLUENCE_PER_OPERATION_TIER;

  const result: OperationResult = {
    id: op.id,
    defId: op.defId,
    name: def.name,
    territoryId: op.territoryId,
    day: state.day,
    success,
    margin: success ? margin : -margin,
    payout: 0,
    heat: 0,
    crewIds: [...op.crewIds],
    consequence: null,
  };

  for (const npc of crew) creditOperation(npc, state.day, success, def.name);
  result.approach = approachOf(op);

  const approach = APPROACH_BY_ID[approachOf(op)];

  if (success) {
    const [lo, hi] = def.payout;
    const scaled = lo + (hi - lo) * Math.pow(margin, 1 / PAYOUT_MARGIN_INFLUENCE);
    // A rich district is worth more than a poor one, whatever the job is —
    // and what the city is doing this month sits on top of that.
    let payout = Math.round(
      scaled *
        approach.payout *
        diff.payout *
        payoutMultiplier(state, op.territoryId) *
        worldMod(state, 'payout') *
        // The two halves of the long economy. `prices` is the number getting
        // longer and means nothing on its own, because the cost of the job
        // moved with it — `activity` is the part a player can feel, because
        // nothing else moved with that.
        prices(state) *
        activity(state),
    );

    // Skimmers take theirs off the top. The player is not told; the only clue
    // is that the number came in lower than the job should have paid.
    let skimmed = 0;
    for (const npc of crew) {
      if (!npc.isSkimming) continue;
      const share = rng.float(BEHAVIOUR.skimShare[0], BEHAVIOUR.skimShare[1]);
      const take = Math.round(payout * share);
      npc.skimTotal += take;
      skimmed += take;
    }
    payout -= skimmed;

    // Who you sent decides how loud it was. A sloppy crew and a careful one
    // do the same job for different money and very different attention.
    const heat =
      def.heatOnSuccess *
      approach.heat *
      heatScale(state, def, crew, territory.id) *
      heatMultiplier(territory, tDef, unfamiliar) *
      crewTraitEffect(crew, 'heat');
    result.payout = payout;
    result.heat = heat;
    earnDirty(state, payout);
    addHeat(state, heat, 'street', def.name);
    gainRespect(state, def.respect * approach.respect);
    /*
       Doing it loudly buys a different currency.

       Fear and the neighbourhood's opinion are the two things the job list
       never touched, and they are what makes the approach a real decision
       rather than a payout slider: a heavy score in the district your fronts
       trade in costs you their health months later, and fear collects its own
       bill from the crew and the city.
    */
    if (approach.fear > 0) gainFear(state, approach.fear);
    if (approach.sentiment !== 0) adjustSentiment(state, op.territoryId, approach.sentiment);
    trainAttribute(state, def.attribute, 1);
    state.player.opsCompleted += 1;

    // Working a district well is how you come to hold it — and how the
    // families already standing there come to resent you.
    addInfluence(state, op.territoryId, influenceStep);
    /*
     * How quietly it was done decides whether anybody can prove it was you.
     *
     * Discipline is most of it, and the traits that govern how much somebody
     * leaves behind do the rest — which is the first time `exposure` has paid
     * for itself twice: the same carelessness that feeds an investigator also
     * tells a rival family whose people were on their street.
     */
    const care = clamp(
      (crewCompetence(crew) / 100) * 0.8 + (1 - crewTraitEffect(crew, 'exposure')) * 0.5,
      0,
      1,
    );
    noteInfluenceTaken(state, rng, op.territoryId, influenceStep, care);
    adjustSentiment(state, op.territoryId, SENTIMENT_ON_SUCCESS);

    addLog(
      state,
      `${def.name} in ${tDef.name} paid out $${payout.toLocaleString('en-US')}.`,
      'success',
    );
  } else {
    const recovered = Math.round(op.investment * FAILURE_INVESTMENT_RECOVERY);
    // Recovered outlay, not takings. See the note on the cancel path above.
    refundDirty(state, recovered);
    const heat =
      def.heatOnFailure *
      approach.heat *
      heatScale(state, def, crew, territory.id) *
      heatMultiplier(territory, tDef, unfamiliar) *
      crewTraitEffect(crew, 'heat');
    result.heat = heat;
    addHeat(state, heat, 'street', `${def.name} went wrong`);
    gainRespect(state, -Math.ceil(def.respect / 3));
    // Being feared is a claim about what happens to people who cross you.
    // Failing in public is the claim being tested and found wanting.
    gainFear(state, FEAR.onFailure);
    trainAttribute(state, def.attribute, 0.4);
    state.player.opsFailed += 1;

    // A botched job still puts your name on the district, just far less of it.
    addInfluence(state, op.territoryId, influenceStep * INFLUENCE_ON_FAILURE_SHARE);
    adjustSentiment(state, op.territoryId, SENTIMENT_ON_FAILURE);

    result.consequence = applyFailureConsequence(state, rng, def, crew, op.territoryId);
    addLog(state, `${def.name} in ${tDef.name} failed. ${result.consequence}`, 'failure');
  }

  // Men who worked a job together come out of it knowing each other slightly
  // better than they did, which over years is where every alliance and every
  // faction inside the organization comes from.
  tiesFromOperation(state, rng, crew);

  state.operationHistory.unshift(result);
  if (state.operationHistory.length > 200) state.operationHistory.length = 200;
}

/**
 * Failure is not just "no money". Which of these lands is what makes two
 * failed jobs feel like different events.
 */
const VIOLENT_OUTCOMES = ['crew_injured', 'crew_arrested', 'heat_spike'];

function applyFailureConsequence(
  state: GameState,
  rng: Rng,
  def: OperationDef,
  crew: Npc[],
  territoryId: string,
): string {
  /*
   * Who was on it decides how it goes wrong.
   *
   * The trait config has always claimed that a hot-headed man "escalates
   * situations that did not need escalating" and a brutal one is "expensive in
   * attention" — and until this weighting existed, both of them failed a job
   * in exactly the same way as a disciplined one. The table is reweighted
   * rather than replaced, so every outcome stays reachable for every crew.
   */
  const escalation = crewTraitEffect(crew, 'escalation');
  const table = FAILURE_CONSEQUENCES[def.risk].map((entry) => ({
    ...entry,
    weight: VIOLENT_OUTCOMES.includes(entry.id) ? entry.weight * escalation : entry.weight,
  }));
  const choice = weightedPick(table, rng.next());
  const victim = crew.length > 0 ? rng.pick(crew) : null;

  switch (choice.id) {
    case 'extra_loss': {
      const share = rng.float(EXTRA_LOSS_SHARE[0], EXTRA_LOSS_SHARE[1]);
      const loss = Math.round(operationCost(state, def) * share);
      spend(state, loss);
      return `Another $${loss.toLocaleString('en-US')} went with it.`;
    }

    case 'crew_injured': {
      if (!victim) return 'Everyone got out.';
      const days = rng.int(INJURY_DAYS[0], INJURY_DAYS[1]);
      victim.status = 'injured';
      victim.unavailableUntilDay = state.day + days;
      victim.stats.grievance = clamp(victim.stats.grievance + INJURY_GRIEVANCE, 0, 100);
      addNote(victim, state.day, `Hurt on the ${def.name}. Out for ${days} days.`, 'bad');
      // He was hurt on a job the rest of them walked away from, and he knows
      // which of them decided it was worth doing.
      tookTheBlame(state, victim, crew);
      remember(victim, state.day, 'was_hurt');
      // Blood in the street is remembered by the people who live on it, and
      // read about by everybody else.
      adjustSentiment(state, territoryId, SENTIMENT_ON_VIOLENCE);
      cover(state, rng, 'street_violence', { territoryId, who: victim.name });
      gainFear(state, FEAR.fromViolence);
      return `${victim.name} is hurt — out for ${days} days.`;
    }

    case 'crew_arrested': {
      if (!victim) return 'Everyone got out.';
      /*
         Counsel you already retain is counsel that turns up for this.

         The retainer used to buy a slower case and a better trial and nothing
         at all for the man in the cell, which is both wrong about lawyers and
         the reason a run of arrests felt like the game going away.
      */
      const rolled = rng.int(ARREST_DAYS[0], ARREST_DAYS[1]);
      const days = Math.max(7, Math.round(rolled * LAWYER_BY_LEVEL[state.law.lawyer].sentenceMultiplier));
      victim.status = 'arrested';
      victim.unavailableUntilDay = state.day + days;
      victim.stats.fear = clamp(victim.stats.fear + ARREST_FEAR_INCREASE, 0, 100);
      victim.stats.loyalty = clamp(victim.stats.loyalty - ARREST_LOYALTY_HIT, 0, 100);
      addNote(victim, state.day, `Arrested on the ${def.name}.`, 'bad');
      addEvidence(state, {
        day: state.day,
        source: 'operation',
        strength: Math.round(rng.int(12, 28) * traitEffect(victim, 'exposure')),
        npcIds: [victim.id],
        detail: `${victim.name} was taken in connection with the ${def.name} in ${
          territoryDef(territoryId).name
        }.`,
      });
      tookTheBlame(state, victim, crew);
      // The single heaviest thing that can happen to somebody in this game,
      // and the one an investigator will find him carrying years later.
      remember(victim, state.day, 'took_a_charge');
      adjustSentiment(state, territoryId, SENTIMENT_ON_VIOLENCE / 2);
      cover(state, rng, 'arrest', { territoryId, who: victim.name });
      return `${victim.name} was taken. Nobody knows what they are saying.`;
    }

    case 'heat_spike': {
      const spike = rng.int(HEAT_SPIKE_RANGE[0], HEAT_SPIKE_RANGE[1]);
      addHeat(state, spike, 'street', 'the job drew attention');
      return 'It drew far more attention than it should have.';
    }

    case 'evidence_left': {
      addEvidence(state, {
        day: state.day,
        source: 'operation',
        strength: Math.round(
          rng.int(EVIDENCE_STRENGTH_RANGE[0], EVIDENCE_STRENGTH_RANGE[1]) *
            crewTraitEffect(crew, 'exposure'),
        ),
        npcIds: crew.map((n) => n.id),
        detail: `Something was left behind at the ${def.name}.`,
      });
      return 'Something was left behind.';
    }

    case 'clean_break':
    default:
      return 'It came apart, but everyone walked away.';
  }
}
