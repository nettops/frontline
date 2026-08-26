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
 * concentration and mentoring hands the skill back. **A convenience, not a
 * strategy**, which is exactly the bar `RUNS_AUTO` sets for anything that
 * plays turns for you: it must not beat playing, it may only save you the
 * clicking.
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
 * **It is not clever about danger.** It does not read heat, it does not read
 * the case being built, and it does not decide tonight is a bad night — the
 * same omission `standingOrders.ts` is built around. Laying low is the one
 * thing it respects, and it gets that for free by asking the same `canLaunch`
 * every other launch asks.
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

  const where = tonightsGround(state);
  if (!where) return;

  const spendable = totalFunds(state);
  let bodiesLeft = availableCrew(state).length;

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
}
