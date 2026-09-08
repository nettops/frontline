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
import {
  APPROACH_BY_ID,
  DEFAULT_APPROACH,
  OPERATION_BY_ID,
  type ApproachId,
} from '../config/operations';
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
  /*
     The approach is named here because the order keeps it for life.

     It is read once, off the picker, and never looked at again — so a boss who
     later switches to Heavy for one score has not switched this. A round-16
     tester did exactly that and spent the rest of the career wrong about how
     their automated nights were going out. The log is where a decision is
     recorded in this game, so it says which one was made.
  */
  addLog(
    state,
    `${def.name} in ${territoryDef(territoryId).name} runs itself now — ` +
      `${APPROACH_BY_ID[approach ?? DEFAULT_APPROACH].name.toLowerCase()}, until you say otherwise.`,
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
export function patternKey(defId: string, territoryId: string): string {
  return `${defId}@${territoryId}`;
}

export function patternOn(state: GameState, defId: string, territoryId: string): number {
  const worn = state.patterns?.[patternKey(defId, territoryId)] ?? 0;
  /*
     Legacy orders are still summed, for exactly as long as it takes the tick
     to fold them in. A save written before the groove moved off the order
     keeps what it earned, and the fold zeroes the order's copy so nothing is
     counted twice on the day after.
  */
  let legacy = 0;
  for (const o of state.standing ?? []) {
    if (o.defId === defId && o.territoryId === territoryId) legacy += o.pattern ?? 0;
  }
  return Math.min(worn + legacy, PATTERN.cap);
}

/**
 * Points off the odds. Mirrors `prepDelta`.
 *
 * It used to be zero for anybody who had never set an order, "for the same
 * reason `prep` is", and that turned out to be the difference between the two.
 * A score is something you opt into; standing on the same corner every week is
 * something you do by default, and it was the thing round 19 spent its back
 * two hundred days doing for free.
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
/**
 * The groove, worn by whoever is standing there — order or not.
 *
 * This is the half the mechanic was described as having and did not have. The
 * config says it plainly: *"charged to anybody working the pair, not only to
 * the order. The police watch the pattern, not your minutes."* But the number
 * lived on the `StandingOrder` record, so a player who never automated
 * anything had nothing for it to live on, and repeating one job on one corner
 * cost him nothing at all.
 *
 * Round 19 is what that is worth. Its tester hand-ran the same five jobs from
 * roughly day 110 to day 300 and reported *"the inputs got bigger; the
 * decision never got new"* — with no pressure anywhere in the game pushing him
 * to stand somewhere else, because the one mechanism that would have was
 * switched off for anybody who had not set an order. Round 18's tester, who
 * had, met it on day 68: *"They know the routine −17%."* Same build, opposite
 * experience, and the difference was a feature neither of them was choosing
 * between.
 *
 * Decay first and on every pair, so a pair worked continuously settles at
 * `perFire / decayShare` rather than running away — the same balance the
 * per-order version had. Pairs that fade to nothing are dropped, so the record
 * does not grow for the life of a career.
 */
function wearPatterns(state: GameState): void {
  const worn = { ...(state.patterns ?? {}) };
  for (const key of Object.keys(worn)) {
    worn[key] *= 1 - PATTERN.decayShare;
    if (worn[key] < 0.5) delete worn[key];
  }
  /*
     Charged off `activeOperations`, which is what makes a long job three days
     of routine rather than one. Three men parked outside the same warehouse
     for three days are three days of pattern, and nobody watching stopped on
     the second morning.

     Safe for the one-day case the rate was swept on: `tickOperations` resolves
     at phase 1 and this runs at 1b4, so a one-day job is already home before
     this sees it and still accrues exactly once.
  */
  for (const op of Object.values(state.activeOperations)) {
    const ordered = (state.standing ?? []).some(
      (o) => o.defId === op.defId && o.territoryId === op.territoryId,
    );
    if (!ordered && !PATTERN.wornByHand) continue;
    /*
       An order is a timetable; a boss turning up himself is not. Charging both
       at `perFire` took Boss from 54 careers of 100 to 24 — see
       `perFireByHand`, which is the rate a night nobody scheduled is worth.
    */
    const rate = ordered ? PATTERN.perFire : PATTERN.perFireByHand;
    const key = patternKey(op.defId, op.territoryId);
    worn[key] = Math.min((worn[key] ?? 0) + rate, PATTERN.cap);
  }
  state.patterns = worn;
}

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
  wearPatterns(state);

  const remaining: StandingOrder[] = [];
  for (const order of standingList(state)) {
    // Fold whatever a pre-move save left on the order into the pair's own
    // record, once, and stop keeping it here.
    if (order.pattern) {
      const key = patternKey(order.defId, order.territoryId);
      state.patterns = state.patterns ?? {};
      state.patterns[key] = Math.min(
        PATTERN.cap,
        (state.patterns[key] ?? 0) + order.pattern,
      );
      order.pattern = 0;
    }

    /*
       And a long job is not one night's work.

       This used to rise once per *firing* and fade once per *day*, so how deep
       a groove got was governed by how long the job took rather than by how
       much of the calendar you spent on that street. Measured, a one-day grind
       settled at 76.8 of 100 and a three-day job at 16.6 — under
       `noticeAbove`, which meant the mechanic was close to invisible on the
       slower half of the board. Nobody chose that; it fell out of the
       arithmetic.

       So a pair being worked *today* wears the groove today, whether or not
       anything was launched this morning. Three men parked outside the same
       warehouse for three days are three days of routine, and nobody watching
       stopped on the second morning.

       Charged off `activeOperations` rather than off the order, so a job the
       player hand-runs on a pair an order already works counts too — the same
       rule `patternOn` follows, for the same reason: the police are watching
       the pattern, not reading your minutes.

       Safe for the one-day case the figures were swept on. `tickOperations`
       resolves at phase 1 and this runs at 1b4, so a one-day job is already
       home before this sees it and still accrues exactly once.
    */
    // A called-off order carried what it left behind. The pair's record does
    // that now, so a stopped order with nothing else to say can go.
    if (order.status !== 'standing') continue;
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
