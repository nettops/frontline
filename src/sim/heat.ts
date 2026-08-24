/**
 * Heat: how much attention the organization is attracting, and from whom.
 *
 * Three rules make this a system rather than a meter:
 *  1. It only decays after consecutive quiet days, and slower the higher it is.
 *  2. It feeds back into operation success, so heat causes failures which
 *     cause heat.
 *  3. It arrives on one of three channels, and the channels do not respond to
 *     the same counterplay. Going quiet cools the street and does nothing at
 *     all about somebody who is already talking.
 *
 * `org.heat` remains the sum of the channels, clamped, and every threshold in
 * the game still reads it. That is deliberate: the split changes who is looking
 * and what you can do about it, and changes no balance figure at all.
 */

import { clamp } from './rng';
import type { GameState } from './types';
import { addLog } from './util';
import { worldMod } from './world';
import {
  DECAY_BY_CHANNEL,
  HEAT_CHANNELS,
  HEAT_DECAY_SHARE,
  HEAT_SUCCESS_PENALTY_AT_MAX,
  LAY_LOW_BY_CHANNEL,
  LAY_LOW_DURATION_DAYS,
  LAY_LOW_RESPECT_COST,
  QUIET_DAYS_BEFORE_DECAY,
  HEAT_ABSORPTION,
  heatTier,
  type HeatChannel,
} from '../config/heat';
import { DIFFICULTY_BY_ID } from '../config/difficulty';

/** Zeroed channels, for a new game and for anything that resets. */
export function newHeatChannels(): Record<HeatChannel, number> {
  return { street: 0, money: 0, inside: 0 };
}

function channels(state: GameState): Record<HeatChannel, number> {
  if (!state.org.heatBy) state.org.heatBy = newHeatChannels();
  return state.org.heatBy;
}

export function channelHeat(state: GameState, channel: HeatChannel): number {
  return channels(state)[channel] ?? 0;
}

/**
 * The total, recomputed from the parts.
 *
 * Called after every change rather than derived on read, because `org.heat` is
 * read from roughly forty places including config-driven conditions and the
 * save file, and turning all of those into function calls would be a very large
 * diff in exchange for nothing.
 */
function resettle(state: GameState): void {
  const by = channels(state);
  state.org.heat = clamp(
    HEAT_CHANNELS.reduce((sum, c) => sum + (by[c] ?? 0), 0),
    0,
    100,
  );
}

/** Anything that draws attention routes through here. */
export function addHeat(
  state: GameState,
  amount: number,
  channel: HeatChannel,
  reason?: string,
): void {
  if (amount <= 0) return;
  const diff = DIFFICULTY_BY_ID[state.difficulty];
  const tierBefore = heatTier(state.org.heat).name;

  const by = channels(state);
  by[channel] = clamp(
    (by[channel] ?? 0) + amount * diff.heatGain * worldMod(state, 'heatGain'),
    0,
    100,
  );
  resettle(state);
  state.org.quietDays = 0;

  const tierAfter = heatTier(state.org.heat).name;
  if (tierAfter !== tierBefore) {
    addLog(
      state,
      `Attention on the organization has risen: ${tierAfter}.${reason ? ` (${reason})` : ''}`,
      'heat',
    );
  }
}

/**
 * Put a channel at an exact figure.
 *
 * Assigning to `org.heat` used to be how anything set up a pressure situation,
 * and it no longer does anything useful — the total is recomputed from the
 * parts the moment anything touches them. This is the replacement, and it makes
 * the caller say which kind of trouble it means.
 */
export function setHeat(state: GameState, channel: HeatChannel, value: number): void {
  channels(state)[channel] = clamp(value, 0, 100);
  resettle(state);
}

/** Counterplay always names the channel it addresses. There is no blanket cure. */
export function reduceHeat(state: GameState, amount: number, channel: HeatChannel): void {
  const by = channels(state);
  by[channel] = clamp((by[channel] ?? 0) - amount, 0, 100);
  resettle(state);
}

/**
 * Daily decay. Quiet days only — activity resets the counter via addHeat.
 *
 * The per-channel rates and the lay-low multipliers are the entire behavioural
 * difference between this and the single meter it replaced.
 */
export function tickHeat(state: GameState): void {
  const { org } = state;

  if (org.layLowUntilDay !== null && state.day >= org.layLowUntilDay) {
    org.layLowUntilDay = null;
    addLog(state, 'You surface again. Business can resume.', 'heat');
  }

  org.quietDays += 1;
  const diff = DIFFICULTY_BY_ID[state.difficulty];

  /*
     What the organization makes go away whether or not it was quiet.

     See HEAT_ABSORPTION. The quiet-days gate below is what an outfit earns by
     stopping; this is what it has by being large, and it is the only thing in
     the heat system that grows with the payroll. Without it, heat removed per
     day was a constant while heat generated per day rose with the number of
     people working, so no organization could grow past the size at which those
     two met — measured at three.
  */
  const hands = Object.values(state.npcs).filter(
    (n) => n.status === 'active' || n.status === 'busy',
  ).length;
  const apparatus = Math.max(0, hands - HEAT_ABSORPTION.fromCrew);
  const absorbed =
    Math.min(HEAT_ABSORPTION.max, apparatus * HEAT_ABSORPTION.perCrew) *
    heatTier(org.heat).decayMultiplier *
    diff.heatDecay;
  const soaking = channels(state);
  if (absorbed > 0 && (soaking[HEAT_ABSORPTION.channel] ?? 0) > 0) {
    soaking[HEAT_ABSORPTION.channel] = clamp(
      (soaking[HEAT_ABSORPTION.channel] ?? 0) - absorbed,
      0,
      100,
    );
    resettle(state);
  }

  if (org.quietDays < QUIET_DAYS_BEFORE_DECAY) return;

  // Read from the total, so what comes off is decided by how much trouble the
  // family is in altogether rather than by any one channel's share of it.
  const tierBefore = heatTier(org.heat).name;
  const laying = isLayingLow(state);

  const by = channels(state);
  for (const channel of HEAT_CHANNELS) {
    if ((by[channel] ?? 0) <= 0) continue;
    /*
       A share of the load, not a flat figure. See `HEAT_DECAY_SHARE`.

       The channel multipliers still do the work they always did: the street
       forgets fastest, paper does not go away because you stopped, and a man
       already sitting with a federal agent is not affected by any of this.
    */
    const decay =
      org.heat *
      HEAT_DECAY_SHARE *
      diff.heatDecay *
      DECAY_BY_CHANNEL[channel] *
      (laying ? LAY_LOW_BY_CHANNEL[channel] : 1);
    by[channel] = clamp((by[channel] ?? 0) - decay, 0, 100);
  }
  resettle(state);

  const tierAfter = heatTier(org.heat).name;
  if (tierAfter !== tierBefore) {
    addLog(state, `Pressure is easing. Now: ${tierAfter}.`, 'heat');
  }
}

export function isLayingLow(state: GameState): boolean {
  return state.org.layLowUntilDay !== null && state.day < state.org.layLowUntilDay;
}

/**
 * Go quiet. Street heat bleeds off much faster, but no operations can be
 * launched and the street reads it as weakness.
 *
 * It does nothing for the books and nothing at all for somebody who is already
 * sitting in a room with a federal agent, which is the point.
 */
export function startLayLow(state: GameState): void {
  if (isLayingLow(state)) return;
  state.org.layLowUntilDay = state.day + LAY_LOW_DURATION_DAYS;
  state.org.respect = Math.max(0, state.org.respect - LAY_LOW_RESPECT_COST);
  state.org.quietDays = QUIET_DAYS_BEFORE_DECAY; // no warm-up when it is deliberate
  /*
     Work already out is not on hold, and the line used to say it was.

     Men in the middle of a job cannot be recalled — that is the right
     mechanic — but "Nothing moves" promised otherwise. Round 11 paid $5,154 to
     go quiet on day 130 and read "Attention on the organization has risen:
     Intensive Task Force. (the job drew attention)" on day 132.
  */
  const running = Object.keys(state.activeOperations).length;
  addLog(
    state,
    running > 0
      ? `You put everything on hold for ${LAY_LOW_DURATION_DAYS} days. Nothing new goes out — ` +
          `but ${running === 1 ? 'the job already out' : `the ${running} jobs already out`} ` +
          `will finish, and will be noticed finishing.`
      : `You put everything on hold for ${LAY_LOW_DURATION_DAYS} days. Nothing moves, nobody earns.`,
    'heat',
  );
}

/** Success chance lost to current heat, as a fraction (0..0.3). */
export function heatSuccessPenalty(state: GameState): number {
  return (state.org.heat / 100) * HEAT_SUCCESS_PENALTY_AT_MAX;
}
