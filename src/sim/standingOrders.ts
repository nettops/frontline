/**
 * Telling them to keep doing it.
 *
 * The only piece of this game's job loop that plays turns for you. The crew
 * fills and the batch groundwork that shipped beside it remove the ticking and
 * leave every decision exactly where it was; this one takes a decision away,
 * which is why it is opt-in and why it has a cost written into its shape.
 *
 * **A standing order does not read the room.**
 *
 * It keeps sending men at a job whose odds have collapsed, because that is
 * what you told it to do. It does not look at heat, it does not look at the
 * case being built, and it does not look at what the night is now worth. A
 * player would have stopped. It is deliberately not clever, in the same way
 * `config/delegation.ts` makes handing a man a district a bet on him rather
 * than a stat bonus. You give up the judgement call and read the record
 * afterwards.
 *
 * **That property was true and cost nothing, which is a different problem.**
 *
 * Measured, an order left running alone lost all thirty-six careers; the same
 * order kept alongside hand play came out ahead on sixteen of thirty-six at a
 * median of −$73,022, which on a $2.1M estate is noise. Not reading the room
 * only costs something when the room changes, and the room did not: the order
 * fired on the same job in the same district a median of **234 times in a
 * career** and nothing in the game ever noticed it was the same crime. So
 * automating was either free or a trap, and which one never depended on
 * anything the player did.
 *
 * The pattern below is the missing half. Repetition wears a groove on the
 * job-and-district pair; the groove costs heat and odds and fades when nobody
 * is working the pair. The counterplay is to go and stand somewhere else,
 * which hands this feature to the map rather than to a timer. See
 * `config/standingOrders.ts`.
 *
 * The order still does not read the room. **The player has to.**
 *
 * Two things it therefore does *not* need rules for. It pauses while the
 * family is dark because `canLaunch` refuses anything but quiet work then, and
 * it stops when the money runs out because `launchOperation` will not spend
 * what is not there. Both fall out of asking the same function every other
 * launch asks.
 */

import type { GameState, Id, StandingOrder } from './types';
import { addLog, nextId } from './util';
import { crewList } from './npc';
import { nightsWorked } from './standing';
import {
  crewCompetence,
  crewNeeded,
  launchOperation,
  operationCost,
} from './operations';
import { totalFunds } from './economy';
import { OPERATION_BY_ID, type ApproachId } from '../config/operations';
import { PATTERN } from '../config/standingOrders';
import { territoryDef } from './territory';
import type { SendPolicy } from './scores';

/**
 * Everything standing, lazily.
 *
 * Optional state with a lazy initialiser, the same idiom `orders`, `scores`
 * and `training` use — so `SAVE_VERSION` does not move and a save written
 * before this existed loads with nothing running itself.
 *
 * Named `standing` rather than `orders` because `state.orders` is the
 * contraband trade's, and two things called orders in one save file is a bug
 * waiting for somebody tired.
 */
export function standingList(state: GameState): StandingOrder[] {
  if (!state.standing) state.standing = [];
  return state.standing;
}

export function liveStanding(state: GameState): StandingOrder[] {
  return (state.standing ?? []).filter((o) => o.status === 'standing');
}

export function standingFor(state: GameState, defId: string): StandingOrder | undefined {
  return liveStanding(state).find((o) => o.defId === defId);
}

/**
 * One per job, deliberately.
 *
 * Two standing orders on the same work is not a second decision, it is the
 * same decision typed twice — and it would race itself for the same bench.
 */
export function setStanding(
  state: GameState,
  defId: string,
  territoryId: string,
  how: SendPolicy,
  approach?: ApproachId,
): StandingOrder | null {
  const def = OPERATION_BY_ID[defId];
  if (!def || !state.territories[territoryId]) return null;
  if (standingFor(state, defId)) return null;

  const order: StandingOrder = {
    id: nextId(state, 'std'),
    defId,
    territoryId,
    how,
    approach,
    setDay: state.day,
    launched: 0,
    status: 'standing',
  };
  standingList(state).push(order);
  addLog(
    state,
    `${def.name} in ${territoryDef(territoryId).name} runs itself now, until you say otherwise.`,
    'neutral',
  );
  return order;
}

// ------------------------------------------------------------- pattern ----

/**
 * How well-read this job in this district has become.
 *
 * Summed across every order that ever worked the pair, live or called off,
 * which is what makes taking the order back and setting it again cost the same
 * as leaving it. Stopped orders already linger in the list; `tickStandingOrders`
 * fades them and drops them once there is nothing left to remember.
 *
 * Keyed on the pair rather than on the job, because that is the entire
 * counterplay: the answer to a groove is to go and stand somewhere else, not
 * to stop. See `config/standingOrders.ts`.
 */
export function patternOn(state: GameState, defId: string, territoryId: string): number {
  let total = 0;
  for (const o of state.standing ?? []) {
    if (o.defId === defId && o.territoryId === territoryId) total += o.pattern ?? 0;
  }
  return Math.min(total, PATTERN.cap);
}

/**
 * Points off the odds. Mirrors `prepDelta`, and is zero for the same reason —
 * nobody who has never set an order pays anything here.
 */
export function patternDelta(pattern: number): number {
  return pattern * PATTERN.weight;
}

/** What the routine does to how loud the night is. 1 when there is no routine. */
export function patternHeat(pattern: number): number {
  return 1 + (pattern / PATTERN.cap) * (PATTERN.heatAtFull - 1);
}

export function cancelStanding(state: GameState, id: Id): void {
  const order = (state.standing ?? []).find((o) => o.id === id);
  if (!order || order.status !== 'standing') return;
  order.status = 'stopped';
  order.settledDay = state.day;
  addLog(state, `${OPERATION_BY_ID[order.defId]?.name ?? 'That'} is your call again.`, 'neutral');
}

/**
 * Daily, beside the other things with a clock on them.
 *
 * Nothing here checks whether tonight is a good night. See the header — that
 * omission is the feature.
 */
export function tickStandingOrders(state: GameState): void {
  /*
     The groove fades first, on every order and every day.

     Including days the order goes on to fire, which is what makes a pattern
     settle rather than run away: the rise per firing and this share of the
     load balance at `perFire / decayShare`. Doing it that way costs no extra
     state — no record of when a pair was last worked, and no quiet-day gate
     like the heat meter needs, because an order either sent somebody today or
     it did not.
  */
  const remaining: StandingOrder[] = [];
  for (const order of standingList(state)) {
    order.pattern = (order.pattern ?? 0) * (1 - PATTERN.decayShare);
    // A called-off order is only still here to carry what it left behind.
    if (order.status !== 'standing' && order.pattern < 0.5) continue;
    remaining.push(order);
  }
  state.standing = remaining;

  for (const order of liveStanding(state)) {
    const def = OPERATION_BY_ID[order.defId];
    if (!def) continue;

    // One at a time. A standing order is "keep this running", not "run as many
    // of these at once as the bench allows".
    const alreadyOut = Object.values(state.activeOperations).some(
      (op) => op.defId === order.defId,
    );
    if (alreadyOut) continue;

    const free = crewList(state).filter((n) => n.status === 'active');
    const want = crewNeeded(state, def);
    if (free.length < want) continue;
    if (operationCost(state, def) > totalFunds(state)) continue;

    const order_ =
      order.how === 'best'
        ? [...free].sort((a, b) => crewCompetence([b]) - crewCompetence([a]))
        : [...free].sort((a, b) => nightsWorked(state, a.id) - nightsWorked(state, b.id));

    const out = launchOperation(
      state,
      order.defId,
      order_.slice(0, want).map((n) => n.id),
      order.territoryId,
      order.approach,
    );
    if (out) {
      order.launched += 1;
      // And one more night on the same corner, for anybody who is counting.
      order.pattern = Math.min((order.pattern ?? 0) + PATTERN.perFire, PATTERN.cap);
    }
  }
}
