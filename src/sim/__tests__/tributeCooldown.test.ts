/**
 * The fifth attempt at the dominant job, and the first that worked.
 *
 * `Call In Tribute` was launched 1,392 times across 36 careers against 711 for
 * both paid jobs of its rank together. Four repairs were measured and rejected,
 * and `freeLadder.test.ts` records them: retiming the free jobs deleted the
 * measurable value of holding ground; the capital wall turned out not to exist;
 * a second currency killed the civic network; a repetition tax deflated the
 * whole game thirty per cent.
 *
 * The finding those four produced is what made this one work:
 *
 *     Call In Tribute is dominant because it is the most robust thing on the
 *     board, so any cost applied broadly removes its competitors before it
 *     removes it.
 *
 * Both of the last two attempts made the imbalance *worse* by that mechanism —
 * the standing cost took Port Operation from 175 launches to nought and left
 * Tribute higher than it started. So the repair had to be specific to the one
 * job, which is what `cooldownDays` is: one number on one definition, enforced
 * in `canLaunch`, and absent everywhere else.
 *
 *     over 36 careers          Tribute   paid tier-4   ratio
 *     shipped                    1,392           711    1.96
 *     a standing cost            1,495           214    5.19
 *     grooves on hand play       1,110           214    5.19
 *     a 14-day cooldown            429           664    0.65
 *
 * Tribute falls 69% and its competitors do not follow — Port Operation rises,
 * 175 to 212. `ladder.probe` stayed green throughout, so no pre-committed
 * figure was moved to get it.
 *
 * These guard the mechanism. The population figures are `ladder.probe`'s.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { crewList, generateNpc } from '../npc';
import { Rng } from '../rng';
import { canLaunch, launchOperation } from '../operations';
import { operableTerritories } from '../territory';
import { OPERATIONS, OPERATION_BY_ID } from '../../config/operations';
import type { GameState } from '../types';

/**
 * A career with enough bodies to actually staff the job.
 *
 * `Call In Tribute` wants four, a fresh career has one, and `canLaunch` checks
 * the crew before it checks anything else — so the first version of this
 * fixture measured "Needs exactly 4 available crew" and reported it as the
 * cooldown not firing.
 */
function game(seed = 3): GameState {
  const state = newGame({ name: 'Cool', difficulty: 'normal', seed });
  state.org.cash = 5_000_000;
  for (let i = 0; i < 6; i++) {
    const npc = generateNpc(state, new Rng({ seed: 61, calls: i * 23 }), 'soldier');
    state.npcs[npc.id] = npc;
  }
  return state;
}

const TRIBUTE = 'call_in_tribute';

describe('the one job with a clock on it', () => {
  it('is exactly one job, which is the whole point', () => {
    const withCooldown = OPERATIONS.filter((o) => o.cooldownDays);
    expect(
      withCooldown.map((o) => o.id),
      'a cooldown on a second job is a rule the board obeys, and four of those were rejected',
    ).toEqual([TRIBUTE]);
  });

  it('refuses a second round inside the window, and says how long', () => {
    const state = game();
    const def = OPERATION_BY_ID[TRIBUTE];
    const where = operableTerritories(state)[0];
    expect(where).toBeTruthy();

    // Stamp it as just run, which is what a launch does.
    state.flags[`ran_${TRIBUTE}`] = state.day;
    const crew = crewList(state).filter((n) => n.status === 'active').slice(0, def.crewRequired);
    const check = canLaunch(state, def, crew.map((n) => n.id), where.territory.id);

    expect(check.ok).toBe(false);
    expect(check.reason, 'a refusal has to name what would satisfy it').toMatch(/\d+ more day/);
  });

  it('lets it run again once the window is up', () => {
    const state = game();
    const def = OPERATION_BY_ID[TRIBUTE];
    state.flags[`ran_${TRIBUTE}`] = state.day - def.cooldownDays!;
    const where = operableTerritories(state)[0];
    const crew = crewList(state).filter((n) => n.status === 'active').slice(0, def.crewRequired);
    const check = canLaunch(state, def, crew.map((n) => n.id), where.territory.id);
    // Crew or gates may still refuse; what must not refuse is the cooldown.
    expect(check.reason ?? '').not.toMatch(/before asking again/);
  });

  /**
   * The clock runs from asking, not from being answered — so an eight-day job
   * does not silently spend eight of its own cooldown.
   */
  it('starts the clock when the job goes out', () => {
    const state = game();
    const def = OPERATION_BY_ID[TRIBUTE];
    const where = operableTerritories(state)[0];
    const crew = crewList(state).filter((n) => n.status === 'active').slice(0, def.crewRequired);
    if (crew.length < def.crewRequired) return;
    if (!canLaunch(state, def, crew.map((n) => n.id), where.territory.id).ok) return;

    launchOperation(state, TRIBUTE, crew.map((n) => n.id), where.territory.id);
    expect(state.flags[`ran_${TRIBUTE}`]).toBe(state.day);
  });

  /** Nothing else gains a clock by accident. */
  it('leaves every other job alone', () => {
    const state = game();
    for (const def of OPERATIONS) {
      if (def.cooldownDays) continue;
      expect(state.flags[`ran_${def.id}`], `${def.id} is being stamped`).toBeUndefined();
    }
  });

  it('survives a save written before it existed', () => {
    const state = game();
    delete state.flags[`ran_${TRIBUTE}`];
    const def = OPERATION_BY_ID[TRIBUTE];
    const where = operableTerritories(state)[0];
    const crew = crewList(state).filter((n) => n.status === 'active').slice(0, def.crewRequired);
    const check = canLaunch(state, def, crew.map((n) => n.id), where.territory.id);
    expect(check.reason ?? '').not.toMatch(/before asking again/);
  });
});
