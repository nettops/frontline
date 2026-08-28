/**
 * Scores: the machine behind the month in front of a job.
 *
 * The table lives in `config/scores.ts` and the design note is
 * `docs/superpowers/specs/2026-08-23-scores-and-setups-design.md`. This file
 * owns opening one, what the gear is worth on the night, and what happens to
 * the gear afterwards.
 *
 * Two things it deliberately does not own.
 *
 * **Launching anything.** A setup is an ordinary operation and goes through
 * `launchOperation` with a score id attached. That is what buys this feature
 * the whole consequence table for free, and it is the reason nothing here
 * duplicates the crew, district or approach rules.
 *
 * **Resolving anything.** `resolveOperation` calls in here at the two moments
 * that matter — a setup that has landed or blown, and a job that has spent its
 * kit. Putting the resolution here instead would mean a second copy of the
 * roll, and two rolls that are supposed to be one roll always drift.
 */

import { Rng, clamp } from './rng';
import type { GameState, Id, Npc, Score } from './types';
import { addEvidence, addLog, nextId } from './util';
import { spend } from './economy';
import { priced } from './market';
import { playerInfluence, territoryDef } from './territory';
import { crewList, somethingGood } from './npc';
import { isLayingLow } from './heat';
import { availableOperations, crewCompetence, launchOperation } from './operations';
import { nightsWorked } from './standing';
import { DISPOSAL, GEAR_BY_ID, SCORE, SCORE_TARGETS, SETUPS, SETUP_BY_ID } from '../config/scores';
import type { GearDef, SetupDef } from '../config/scores';

/**
 * Everything you are building up to, lazily.
 *
 * Optional state with a lazy initialiser, the same idiom `orders`, `promises`
 * and `civic` use — so `SAVE_VERSION` does not move and a save written before
 * scores existed loads with nobody planning anything.
 */
export function scoreList(state: GameState): Score[] {
  if (!state.scores) state.scores = [];
  return state.scores;
}

/** Scores still standing: setups can run, or the job itself is out. */
export function liveScores(state: GameState): Score[] {
  return (state.scores ?? []).filter((s) => s.status === 'open' || s.status === 'running');
}

/**
 * The score against a given job that is still being built.
 *
 * `open` only, deliberately. Everything that reads this — the odds, the crew
 * requirement, and `launchOperation` deciding which score a job is spending —
 * is asking "what is ready for tonight", and a score whose night is already
 * out is not. The first version returned running ones too, and the probe duly
 * reported 632 prepared jobs against 479 scores: a second launch against the
 * same target picked up the same kit, took the same crew discount, and then
 * whichever job resolved first closed the score out from under the other.
 */
export function scoreOn(state: GameState, defId: string): Score | undefined {
  return (state.scores ?? []).find((s) => s.status === 'open' && s.defId === defId);
}

export function scoreById(state: GameState, id: Id): Score | undefined {
  return (state.scores ?? []).find((s) => s.id === id);
}

/** The setups this target allows, in the order the table writes them. */
export function setupsFor(defId: string): SetupDef[] {
  const ids = SCORE_TARGETS[defId] ?? [];
  return SETUPS.filter((s) => ids.includes(s.id));
}

/** Setups still worth running: not already in the kit, not already out. */
export function setupsLeft(state: GameState, score: Score): SetupDef[] {
  const out = new Set(
    Object.values(state.activeOperations)
      .filter((op) => op.scoreId === score.id)
      .map((op) => op.defId),
  );
  return setupsFor(score.defId).filter((s) => !score.kit.includes(s.yields) && !out.has(s.id));
}

/** What is in hand, as the table rather than as ids. */
export function kitOf(score: Score | undefined): GearDef[] {
  if (!score) return [];
  return score.kit.map((id) => GEAR_BY_ID[id]).filter(Boolean);
}

/** What days of planning are worth on the night, in odds. Negative once noticed. */
export function prepDelta(score: Score | undefined): number {
  if (!score) return 0;
  const gear = kitOf(score).reduce((sum, g) => sum + g.success, 0);
  return gear - score.alertness * SCORE.alertnessWeight;
}

/** Bodies the kit means you no longer have to send. */
export function crewRelief(score: Score | undefined): number {
  return kitOf(score).reduce((sum, g) => sum + g.crewRelief, 0);
}

/** What the kit does to how loud the night is. 1 when there is nothing in it. */
export function kitHeat(score: Score | undefined): number {
  return kitOf(score).reduce((mult, g) => mult * g.heat, 1);
}

// ------------------------------------------------------------- opening ----

export interface ScoreCheck {
  ok: boolean;
  reason: string | null;
}

/** What putting somebody on it costs, in this year's money. */
export function scoreCost(state: GameState): number {
  return priced(state, SCORE.openCost);
}

export function canOpenScore(state: GameState, defId: string): ScoreCheck {
  if (!SCORE_TARGETS[defId]) {
    return { ok: false, reason: 'There is nothing to plan about that one.' };
  }
  if (!availableOperations(state).some((o) => o.id === defId)) {
    return { ok: false, reason: 'That job is not on the table yet.' };
  }
  // Live rather than open: a target whose night is out is not a target you can
  // start planning again this afternoon.
  if (liveScores(state).some((s) => s.defId === defId)) {
    return { ok: false, reason: 'You are already building that one.' };
  }
  if (liveScores(state).length >= SCORE.maxLive) {
    return { ok: false, reason: `You have ${SCORE.maxLive} on the go. Finish one.` };
  }
  if (state.org.cash + state.org.dirtyCash < scoreCost(state)) {
    return { ok: false, reason: 'You cannot cover the stake.' };
  }
  /*
     The bill that actually bites, and the panel has to be able to say so.

     Checked here rather than only inside `openScore` because a refusal the
     screen cannot name is F10 all over again — the game turning you away from
     something without saying which number did it.
  */
  if (!crewList(state).some((n) => n.status === 'active')) {
    return { ok: false, reason: 'You have nobody spare to put on it.' };
  }
  return { ok: true, reason: null };
}

/**
 * Put a man on a place, and start the clock.
 *
 * The bill is the body rather than the money. It is the resource the game is
 * short of — the measured cause of a dead week is a shortage of people, never
 * of money — and a flat fee large enough to be felt is unpayable by half the
 * careers this exists for. He comes straight back on a blown setup, a botched
 * score or an expired window: failure costs the prep and the days, not a
 * person held hostage.
 */
export function openScore(
  state: GameState,
  defId: string,
  territoryId: string,
  manId: Id,
): Score | null {
  if (!canOpenScore(state, defId).ok) return null;
  if (!state.territories[territoryId]) return null;
  const man = state.npcs[manId];
  if (!man || man.status !== 'active') return null;
  if (!spend(state, scoreCost(state), 'stakes')) return null;

  man.status = 'busy';
  man.unavailableUntilDay = state.day + SCORE.windowDays;

  const score: Score = {
    id: nextId(state, 'score'),
    defId,
    territoryId,
    openedDay: state.day,
    dueDay: state.day + SCORE.windowDays,
    kit: [],
    botched: [],
    alertness: 0,
    manId,
    status: 'open',
  };
  scoreList(state).push(score);
  // Being the man on a score is a posting, and it counts as going somewhere.
  somethingGood(state, man);
  addLog(
    state,
    `${man.name} is watching ${territoryDef(territoryId).name}. You have ${SCORE.windowDays} days.`,
    'neutral',
  );
  return score;
}

/** How a batch fills its crews. The same two policies the panel offers. */
export type SendPolicy = 'best' | 'rested';

/**
 * Launch everything this score still needs, in one move.
 *
 * Each setup went through the whole assemble panel on its own, so building up
 * to one job was three to five full launches before the job itself. This is a
 * loop over the call the panel already made one at a time — no new rules, and
 * `launchOperation` still refuses anything it would have refused.
 *
 * Filled by policy rather than automatically, for the reason the panel ships
 * two buttons: who you send is the decision `spread.probe` measures, and a
 * silent default would quietly become the strategy.
 *
 * Returns the setups that actually went, so the caller can say so. It stops
 * where the bench runs out rather than refusing the whole batch — half the
 * groundwork is worth having, and a player who is short of people already
 * knows it.
 */
export function readyEverything(
  state: GameState,
  score: Score,
  how: SendPolicy,
): string[] {
  if (score.status !== 'open') return [];
  const sent: string[] = [];

  for (const setup of setupsLeft(state, score)) {
    const free = crewList(state).filter((n) => n.status === 'active');
    if (free.length < setup.crewRequired) continue;
    const order =
      how === 'best'
        ? [...free].sort((a, b) => crewCompetence([b]) - crewCompetence([a]))
        : [...free].sort((a, b) => nightsWorked(state, a.id) - nightsWorked(state, b.id));
    const crew = order.slice(0, setup.crewRequired).map((n) => n.id);
    if (launchOperation(state, setup.id, crew, score.territoryId, undefined, score.id)) {
      sent.push(setup.id);
    }
  }
  return sent;
}

// ------------------------------------------------------------- settling ---

/**
 * Give the man back and lose whatever was in hand.
 *
 * The kit is emptied rather than kept, which is the developer's call and the
 * better one: there is no permanent kit to assemble, so the second target
 * costs as much work as the first and a career cannot solve prep once.
 */
export function closeScore(state: GameState, score: Score, how: 'done' | 'expired'): void {
  if (score.status === 'done' || score.status === 'expired') return;
  score.status = how;
  score.settledDay = state.day;
  score.kit = [];

  const man = state.npcs[score.manId];
  // Only if he is still standing on the corner. A man who was hurt or taken on
  // one of the setups has a timer of his own and it is not this one's to clear.
  if (man && man.status === 'busy' && man.unavailableUntilDay === score.dueDay) {
    man.status = 'active';
    man.unavailableUntilDay = null;
  }
}

/**
 * Daily, beside `tickOrders` and for the same reason: a deadline is a day.
 *
 * The clock stops while the family is dark, and that is the one place this
 * feature reaches into another system's rules. Measured across every day in
 * the life of a score that expired: 14% were spent laying low, and
 * `LAY_LOW_DURATION_DAYS` is 14 — exactly half a window. `canLaunch` refuses
 * anything but quiet work while dark, so those are days the game took rather
 * than days the player spent, and losing a month of planning to the correct
 * cure for heat is round 13's complaint with a deadline bolted on: *the
 * punishment for heat is not danger, it is 14 days of pressing +1 week.*
 *
 * Heat on its own is deliberately **not** in here. At 85 the odds carry a 25
 * point penalty and nothing is refused — a player who works through it is
 * making a bad decision, not being stopped from deciding, and a clock that
 * paused for that would be pausing for a choice.
 */
export function tickScores(state: GameState): void {
  const dark = isLayingLow(state);
  for (const score of liveScores(state)) {
    if (dark && score.status === 'open') {
      score.dueDay += 1;
      // The man is held to the day it shuts on, and `closeScore` recognises
      // him by exactly that. Moving one without the other strands him.
      const held = state.npcs[score.manId];
      if (held && held.status === 'busy' && held.unavailableUntilDay === score.dueDay - 1) {
        held.unavailableUntilDay = score.dueDay;
      }
      continue;
    }
    if (state.day < score.dueDay) continue;
    // A job that is out when the window shuts still gets to finish. The window
    // is about when you have to move, not about how long the night takes.
    if (score.status === 'running') continue;
    const name = territoryDef(score.territoryId).name;
    closeScore(state, score, 'expired');
    addLog(state, `The window on ${name} has shut. Whatever you had is gone.`, 'neutral');
  }
}

/** A setup came in. The gear is in hand. */
export function landSetup(state: GameState, score: Score, setupId: string): void {
  const def = SETUP_BY_ID[setupId];
  if (!def || score.kit.includes(def.yields)) return;
  score.kit.push(def.yields);
  addLog(state, `${GEAR_BY_ID[def.yields].name}, ready for when you move.`, 'success');
}

/**
 * A setup blew.
 *
 * The prep and a warning. It wastes its stake and days, takes the ordinary
 * consequence roll on its way out, and raises how closely the place is being
 * watched. The score stays open — burning it outright on one bad roll means a
 * player opens exactly one score in a career.
 */
export function botchSetup(state: GameState, score: Score, setupId: string): void {
  score.botched.push(setupId);
  score.alertness = clamp(score.alertness + SCORE.alertnessPerBotch, 0, 100);
  addLog(state, `They are watching ${territoryDef(score.territoryId).name} harder now.`, 'failure');
}

// ------------------------------------------------------------- disposal ---

/**
 * Getting rid of it, which is the third phase.
 *
 * The job is not over when the job is over. What the police recover is written
 * through `addEvidence`, which carries `npcIds` — so a recovered car names the
 * specific men who were in it, and that feeds arrests, the informant gate and
 * every memory those men form about you afterwards.
 *
 * Deliberately not included: a purchasable disposal setup, which is a tax you
 * always pay, and crew skill, which is a fifth roll on a night that has enough.
 */
export function disposeOf(
  state: GameState,
  rng: Rng,
  score: Score,
  crew: Npc[],
  approach: string,
  worked: boolean,
): void {
  const gear = kitOf(score);
  const held = playerInfluence(state.territories[score.territoryId]) / 100;
  const where = territoryDef(score.territoryId).name;
  const chance = clamp(
    (DISPOSAL.base + DISPOSAL.perControl * held) *
      (DISPOSAL.byApproach[approach] ?? 1) *
      (worked ? 1 : DISPOSAL.onFailure),
    0.05,
    0.95,
  );

  let found = 0;
  for (const piece of gear) {
    if (rng.chance(chance)) continue;
    found += 1;
    addEvidence(state, {
      day: state.day,
      source: 'disposal',
      strength: Math.round(DISPOSAL.strengthPerBulk * piece.bulk),
      npcIds: crew.map((n) => n.id),
      detail: `${piece.name} from the ${where} job turned up where it should not have.`,
    });
  }
  if (found > 0) {
    addLog(
      state,
      found === 1
        ? 'One piece of it did not go in the river.'
        : `${found} pieces of it did not go in the river.`,
      'failure',
    );
  }
}
