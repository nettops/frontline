/**
 * Handing the operations loop over.
 *
 * The one thing in this project that was measured properly and then never
 * shipped. `ladder.probe` has carried this as its `matchOps` arm for a while:
 * your best and most careful people on the riskiest work, whoever is left on
 * the safe jobs, every day, with nothing chosen by hand.
 *
 * What it measured as is what it ships as. Nineteen careers of thirty-six came
 * out ahead at +$202,308 — and eighteen of thirty-six at +$71,570 once the
 * family also trains people, because the pairing rule works directly against
 * concentration and mentoring hands the skill back. With the heat sense it
 * reads 20/36 ahead at +$347,540: **a real way to play**, and that is the bar
 * now — the loop must play as well as a careful hand, because laziness is a
 * supported way to enjoy the game, not a penalty.
 *
 * Two properties carry it, and the second was expensive to learn:
 *
 * **It changes who goes, never what runs.** Jobs are still taken in
 * expected-value order — the same order a hand would take them. The first
 * version of the arm also sorted the board by danger, and lost by a million:
 * it spent the bench and the stake on the most dangerous work before it ever
 * reached the work that pays. That was two changes tested at once and only one
 * of them was the idea. *How* you rank the board matters far more than who you
 * send, and in the opposite direction.
 *
 * **It reads the heat, crudely, and that reversal was a decision.** For years
 * the omission was deliberate — the `matchOpsSmart` experiment in ladder.probe
 * measured a heat sense at level-to-ahead of careful hand play, and the old
 * `RUNS_AUTO` bar ("automation must not beat playing") kept it out. The
 * project owner reversed that bar on 2026-08-29: the autopilot is a supported
 * way to play the game, not a handicapped convenience, so it should play as
 * well as a careful hand. The two levers that ship are exactly the two that
 * were measured — quieter work above `AUTOPILOT.quietAbove`, nothing at all
 * above `AUTOPILOT.stopAbove` — and nothing cleverer, because the finding
 * belongs to those numbers. It still does not read the case being built, and
 * it still respects laying low through the same `canLaunch` as everything
 * else.
 *
 * **And a third pass, added when contracts shipped.** A hand player gained a
 * verb the loop did not have, which is exactly the gap the bar above exists to
 * close. It sends people after a rival capo — but *only inside a war the
 * player already chose*, and that is a safety property rather than a
 * threshold: a contract can start a war, and a loop that decides whether a war
 * is worth starting is making the largest decision in the game on somebody's
 * behalf. Handing over the operations loop was never consent to that. Last in
 * the tick, so it can only spend what the work left behind. See
 * `AUTOPILOT_CONTRACTS`.
 */

import type { GameState, OperationDef } from './types';
import { Rng } from './rng';
import { addLog } from './util';
import { availableCrew } from './npc';
import { isLayingLow } from './heat';
import { totalFunds } from './economy';
import {
  availableOperations,
  crewCompetence,
  crewNeeded,
  launchOperation,
  operationCost,
} from './operations';
import { scoreOn, setupsLeft } from './scores';
import { controlLevel, operableTerritories } from './territory';
import { AUTOPILOT, AUTOPILOT_CONTRACTS } from '../config/autopilot';
import { CONTRACT } from '../config/contract';
import { canContract, contractCost, openContract, openContracts } from './contract';
import { caposOf } from './capos';
import { playerWars } from './diplomacy';
import { SETUP_BY_ID } from '../config/scores';

/** Higher is more dangerous. The order crews are handed out in. */
const BY_RISK = { extreme: 3, high: 2, moderate: 1, low: 0 } as const;

export function autopilotOn(state: GameState): boolean {
  return state.autopilot === true;
}

/**
 * Off unless asked for, and off again leaves nothing behind.
 *
 * A plain optional boolean rather than a settings object, so a save written
 * before this existed loads with the loop in the player's hands, which is
 * where it was.
 */
export function setAutopilot(state: GameState, on: boolean): void {
  state.autopilot = on;
  addLog(
    state,
    on
      ? 'The work runs itself from here. Your best people go where it is worst.'
      : 'You are picking the crews again.',
    'neutral',
  );
}

/**
 * What a night is worth, per body and per day it ties them up.
 *
 * The same figure the probe ranked its board on, and the reason it is here
 * rather than in `operations.ts` is that it is a *policy* — one opinion about
 * what is worth doing, held by this feature and by nothing else in the game.
 */
function worth(def: OperationDef): number {
  const bodies = Math.max(1, def.crewRequired);
  return (
    (((def.payout[0] + def.payout[1]) / 2) * def.baseSuccess) / (bodies * def.durationDays)
  );
}

/**
 * Where tonight's work goes.
 *
 * This read `operableTerritories(state)[0]`, and that list is sorted by
 * influence descending — so the autopilot worked the district it was already
 * strongest in, every night, for the entire career. Ground is built by working
 * it, which means a boss who threw this switch could never open a second
 * district again. The map stopped moving and nothing said so.
 *
 * `ladder.probe` found precisely this defect in its own bot years ago and the
 * note above the repair is still in that file: the median career took a single
 * district to influence 100 and never took a second past 50, and one career in
 * thirty-six ever met Capo's two-district requirement. The shipped feature had
 * the same line in it, and no instrument had ever turned the shipped feature on.
 *
 * The rule here is that file's rule, because it is the one the game already
 * teaches on the territory screen: **finish the district you started, then go
 * and stand somewhere new.** Work the strongest place you do not yet hold; once
 * everything you can reach is held, work the strongest of those.
 *
 * Deliberately not a strategy. It does not chase yields, it does not weigh a
 * district against what it pays, and it will not open ground a hand would not
 * have opened — it declines to pour every night into ground that is already
 * yours, and nothing more. Choosing the map is still the player's, which is
 * the same line `standingOrders.ts` draws.
 */
function tonightsGround(state: GameState): string | undefined {
  const options = operableTerritories(state);
  const unfinished = options.find(
    (o) => controlLevel(o.territory) !== 'control' && controlLevel(o.territory) !== 'dominance',
  );
  return (unfinished ?? options[0])?.territory.id;
}

/**
 * Daily, beside the other things that run themselves.
 *
 * Two passes, and keeping them apart is the whole design. The first picks the
 * same jobs a hand would pick, in the same expected-value order, against a
 * running count of bodies and money. The second hands the crews out — riskiest
 * job first, strongest people first — so the best end up on the worst work and
 * whoever is left takes the safe jobs.
 */
export function tickAutopilot(state: GameState, _rng: Rng): void {
  if (!autopilotOn(state) || state.gameOver) return;
  if (isLayingLow(state)) return;
  // The heat sense, upper lever: past the stop line nothing goes out until
  // it cools. See config/autopilot.ts for where both numbers come from.
  if (state.org.heat >= AUTOPILOT.stopAbove) return;

  const where = tonightsGround(state);
  if (!where) return;

  const spendable = totalFunds(state);
  let bodiesLeft = availableCrew(state).length;

  /*
     Two men held back, if there is a war on and somebody to send them after.

     Before the jobs pass, because after it there is never anybody left — the
     loop fills the board every night by design, and the first version of this
     took only leftovers and therefore fired about once a career. See
     `AUTOPILOT_CONTRACTS` for the trace.
  */
  const reserving = wantsToSend(state);
  if (reserving) bodiesLeft -= CONTRACT.crew;

  /*
     Pass one: what runs.

     Setups are left alone — groundwork is a decision about a score, and a
     score is a month of planning the player opened on purpose. A job with a
     score still being built is held back for the same reason: firing it early
     spends the window for nothing.
  */
  const taking: OperationDef[] = [];
  for (const def of [...availableOperations(state)].sort((a, b) => worth(b) - worth(a))) {
    if (SETUP_BY_ID[def.id] || def.crewRequired <= 0) continue;
    // Lower lever: once they are already looking, only the quieter work goes.
    if (state.org.heat >= AUTOPILOT.quietAbove && BY_RISK[def.risk] > 1) continue;
    const score = scoreOn(state, def.id);
    if (score && setupsLeft(state, score).length > 0 && state.day < score.dueDay - 3) continue;

    const bodies = crewNeeded(state, def);
    if (bodies > bodiesLeft) continue;
    if (operationCost(state, def) > spendable) continue;
    taking.push(def);
    bodiesLeft -= bodies;
  }

  /*
     Pass two: who goes.

     Sorted by danger here and only here. Ranking the *board* this way is what
     cost the probe a million; ranking the handout this way is the feature.
  */
  for (const def of taking.sort((a, b) => BY_RISK[b.risk] - BY_RISK[a.risk])) {
    const bodies = crewNeeded(state, def);
    const free = availableCrew(state);
    if (free.length < bodies) continue;

    const best = [...free].sort((a, b) => crewCompetence([b]) - crewCompetence([a]));
    const score = scoreOn(state, def.id);
    launchOperation(
      state,
      def.id,
      best.slice(0, bodies).map((n) => n.id),
      score ? score.territoryId : where,
      undefined,
      score?.id,
    );
  }

  // Pass three, with the two men pass one was told not to spend.
  if (reserving) sendSomebody(state);
}

/**
 * Whether tonight is a night for it, asked before anything is allocated.
 *
 * Every condition that does not depend on who ends up where, so the jobs pass
 * can be told to hold two men back without the answer changing underneath it.
 *
 * "Only at war" is a safety property rather than a threshold: a contract can
 * start a war, and a loop that weighs whether a war is worth starting is
 * making the largest decision in the game unasked. Handing over the operations
 * loop was never consent to that.
 */
function wantsToSend(state: GameState): boolean {
  if (openContracts(state).length >= AUTOPILOT_CONTRACTS.maxOpen) return false;
  if (playerWars(state).length === 0) return false;
  if (availableCrew(state).length < AUTOPILOT_CONTRACTS.minRoster) return false;
  return true;
}

/**
 * Going after their people, during a war that is already running.
 *
 * Their biggest man, which is also their hardest to reach — `share` drives
 * both. Taking the largest share off the board is what shortens a war, and the
 * odds falling as the target grows is what keeps it from being an obvious
 * move.
 */
function sendSomebody(state: GameState): void {
  for (const faction of playerWars(state)) {
    const target = [...caposOf(state, faction.id)].sort((a, b) => b.share - a.share)[0];
    if (!target) continue;
    const wanted = { kind: 'capo' as const, factionId: faction.id, capoId: target.id };
    if (totalFunds(state) < contractCost(state, wanted) * AUTOPILOT_CONTRACTS.fundsMultiple) {
      continue;
    }
    if (!canContract(state, wanted).ok) continue;
    openContract(state, wanted);
    addLog(state, 'Somebody has been sent. It is a war, and that is what a war is.', 'crew');
    return;
  }
}
