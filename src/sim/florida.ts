/**
 * Putting money somewhere the organization cannot follow it.
 *
 * The design argument is in `config/florida.ts`. What this file has to keep
 * true is five things:
 *
 * 1. **The money really goes.** `nestEgg` is not counted by `cleanWorth`, is
 *    not spendable, and is not recoverable. There is no `takeBack` here on
 *    purpose — `economy.ts` already has the reversible version of this and it
 *    is called holdings. This one is the decision.
 *
 * 2. **Suspicion is paid to the people who already decide whether there is a
 *    coup.** Nothing here invents a second deposition system. It multiplies
 *    the one `succession.ts` already runs, and puts grievance on the same
 *    capos that system reads.
 *
 * 3. **Nothing draws until the player opts in.** `tickFlorida` returns before
 *    any read of the stream when nothing has been put aside and nothing is
 *    pending, so a career that never siphons is bit-identical to one written
 *    before this existed.
 *
 * 4. **Every refusal names what would lift it.** A short pool says the gap; a
 *    short nest egg says the figure; a trial or a war says which one.
 *
 * 5. **The mutiny reuses `removePlayer`.** There is one door out of the chair
 *    in this game and this does not become a second one — same handover, same
 *    succession roll, same ending. What this adds is the reason.
 */

import { Rng, clamp } from './rng';
import type { FloridaExitState, GameState } from './types';
import { FLORIDA } from '../config/florida';
import { activeCapos } from './capoTension';
import { activeCases } from './investigation';
import { playerWars } from './diplomacy';
import { note } from './ledger';
import { spend } from './economy';
import { removePlayer, wouldTakeIt } from './succession';
import { recordCareerEvent } from './career';
import { addLog } from './util';
import { money } from './memo';

/** Lazy, so a save written before the account existed loads with nothing in it. */
export function floridaState(state: GameState): FloridaExitState {
  if (!state.florida) state.florida = { nestEgg: 0, suspicion: 0, lastSiphonDay: 0 };
  return state.florida;
}

export interface FloridaResult {
  ok: boolean;
  message: string;
}

/**
 * Take money off the organization and put it somewhere it stops being the
 * organization's.
 *
 * `isClean` decides which pool, and the default is the clean one because that
 * is what an offshore account actually takes — money that has already been
 * through a front. Dirty money goes through `spend`, which takes the dirty
 * pile first and is therefore the cheap, loud way to do it.
 *
 * `rng` is optional and is the only reason this function can end a career. A
 * caller with a stream in hand gets the mutiny on the spot; one without
 * latches it and the next weekly pass fires it. Both are the same call —
 * `fireMutiny` below — so there is no second version of what a mutiny is.
 */
export function siphonToFlorida(
  state: GameState,
  amount: number,
  isClean = true,
  rng?: Rng,
): FloridaResult {
  const sum = Math.floor(amount);
  if (sum <= 0) return { ok: false, message: 'Nothing to move.' };

  if (isClean) {
    if (state.org.cash < sum) {
      return {
        ok: false,
        message:
          `You have ${money(state.org.cash)} in clean money. An account like that ` +
          `does not take the other kind without somebody asking where it came from.`,
      };
    }
    state.org.cash -= sum;
    note(state, 'other_out', -sum);
  } else if (!spend(state, sum, 'other_out')) {
    return { ok: false, message: `There is not ${money(sum)} in the place.` };
  }

  const fl = floridaState(state);
  fl.nestEgg += sum;
  fl.lastSiphonDay = state.day;
  /*
     What the room can see.

     Scaled off the size of the move rather than off the act, because the act
     is invisible and the hole it leaves is not: a boss who takes a thousand
     out of a good week is a rounding error, and one who takes fifty thousand
     has a week nobody can explain.
  */
  fl.suspicion = clamp(
    fl.suspicion + (sum / 1_000) * FLORIDA.suspicionPerSiphon,
    0,
    100,
  );

  addLog(
    state,
    `${money(sum)} went somewhere with a different set of laws about it.`,
    'money',
  );

  if (fl.suspicion >= FLORIDA.mutinyThreshold) {
    fl.mutinyPending = true;
    if (rng) fireMutiny(state, rng);
  }

  return { ok: true, message: `${money(fl.nestEgg)} put aside.` };
}

/**
 * Past the bar they stop waiting for a roll.
 *
 * Routed through `removePlayer` with whoever `wouldTakeIt` names — and with
 * nobody, if the room is too loyal to have produced a candidate, in which case
 * the succession roll decides on its own exactly as it does for a conviction.
 */
export function fireMutiny(state: GameState, rng: Rng): void {
  const fl = floridaState(state);
  if (!fl.mutinyPending || state.gameOver) return;
  fl.mutinyPending = false;

  removePlayer(
    state,
    rng,
    'deposed',
    `Somebody found the account. Nobody shouted about it — they simply stopped ` +
      `bringing things to you, and by the end of the week the only person who did ` +
      `not know it was over was you.`,
    wouldTakeIt(state) ?? undefined,
  );
}

/**
 * Weekly. What a quiet week takes back, and what a loud one costs.
 *
 * Returns before touching anything when there is nothing put aside and nothing
 * pending — so a career that never opens the account never enters this.
 */
export function tickFlorida(state: GameState, rng: Rng): void {
  if (state.gameOver) return;
  if (state.day % 7 !== 0) return;
  const fl = state.florida;
  if (!fl) return;

  if (fl.mutinyPending) {
    fireMutiny(state, rng);
    return;
  }

  // A week without a move fades it. A week with one does not — the decay is
  // what makes the plan something a boss has to keep quiet about rather than
  // something he can pay off.
  if (state.day - fl.lastSiphonDay >= 7) {
    fl.suspicion = Math.max(0, fl.suspicion - FLORIDA.suspicionDecayWeekly);
  }

  if (fl.suspicion > FLORIDA.coupRiskSuspicionThreshold) {
    /*
       And the people whose grievance already decides this.

       Deliberately lands on `activeCapos` rather than everybody: a soldier
       does not see the book. Two points a week is small next to anything
       `DELEGATION` or `DEMENTIA` moves, and it does not have to be large —
       what it is doing is feeding `disaffected()`, which is a bar rather than
       a curve, and a slow push across a bar is exactly the shape of a boss
       whose people are working it out.
    */
    for (const capo of activeCapos(state)) {
      capo.stats.grievance = clamp(
        capo.stats.grievance + FLORIDA.grievancePerWeekOverThreshold,
        0,
        100,
      );
    }
  }

  if (fl.suspicion >= FLORIDA.mutinyThreshold) {
    fl.mutinyPending = true;
    fireMutiny(state, rng);
  }
}

// ------------------------------------------------------------- the ending --

/**
 * Whether the plane can actually leave.
 *
 * Three bars and each refusal says which one and what it would take. A trial
 * and a war are both "not now" rather than "not ever", which is the honest
 * shape: nothing about either is permanent.
 */
export function canRetireToFlorida(state: GameState): { ok: boolean; message: string } {
  const fl = floridaState(state);
  if (fl.nestEgg < FLORIDA.targetNestEgg) {
    const short = FLORIDA.targetNestEgg - fl.nestEgg;
    return {
      ok: false,
      message:
        `${money(fl.nestEgg)} of ${money(FLORIDA.targetNestEgg)} put aside. ` +
        `${money(short)} short of a life down there rather than a long holiday.`,
    };
  }

  if (activeCases(state).some((c) => c.stage === 'trial')) {
    return {
      ok: false,
      message: 'You are in the middle of a trial. Nobody leaves the state during a trial.',
    };
  }

  const wars = playerWars(state);
  if (wars.length > 0) {
    return {
      ok: false,
      message:
        `There is a war on. Walking out of one is not retiring, it is running, ` +
        `and they would find you down there inside a month.`,
    };
  }

  return { ok: true, message: 'There is nothing left to stay for.' };
}

/**
 * Take it.
 *
 * The only ending in this game that is not a removal. `state.gameOver` is the
 * one field that stops a career, and it carries prose rather than a verdict —
 * so a win writes a win and the same panel reads it.
 */
export function retireToFlorida(state: GameState): { ok: boolean; message: string } {
  const check = canRetireToFlorida(state);
  if (!check.ok) return check;
  if (state.gameOver) return { ok: false, message: 'It is already over.' };

  const fl = floridaState(state);
  const generations =
    state.succession.generation > 1
      ? ` ${state.succession.generation} people ran this. You are the only one who got to stop.`
      : '';

  recordCareerEvent(state, `Retired to Florida with ${money(fl.nestEgg)}.`, 'good');
  state.gameOver = {
    day: state.day,
    reason:
      `You did not tell anybody you were going. There was a Tuesday, and a flight, and ` +
      `by the Thursday somebody else was sitting in the back room answering questions ` +
      `about a man who had stopped returning calls.\n\n` +
      `${money(fl.nestEgg)} was waiting for you, in an account with a different set of ` +
      `laws about it. Nobody came. Nobody was ever going to — there was no case with ` +
      `your name at the top of it and no war anybody still wanted to finish, which is ` +
      `the entire reason this worked and the entire reason almost nobody manages it.` +
      generations,
  };
  addLog(state, 'You left on the Tuesday and did not tell anybody.', 'success');
  return { ok: true, message: 'Gone.' };
}
