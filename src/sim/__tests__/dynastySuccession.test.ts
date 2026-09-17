/**
 * Blood, service, and a body that stops recovering.
 *
 * Milestone 4 gave the household a child who grows up and can be brought into
 * the organization. Until now that child was an ordinary soldier with a
 * first name and no surname — the room had no opinion about him at all. The
 * property under test here is that it does: naming your own blood over men
 * who have carried this family for a decade is the most expensive thing the
 * Succession panel can do, and passing your blood over for one of them is
 * paid for at the kitchen table instead.
 *
 * The second half is the calendar. A career long enough to reach this
 * question is also a body old enough to stop mending on its own, which is
 * what turns a stress meter from weather into a clock.
 */

import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { crewList } from '../npc';
import { home, playerStress, stressPressure, tickStress } from '../personal';
import { eligibleHeirs, isBloodHeir, nameHeir } from '../succession';
import { NAMING, NEPOTISM } from '../../config/succession';
import { HOME, STRESS } from '../../config/personal';
import type { GameState, Npc, RoleId } from '../types';

/**
 * A household with a grown child in it, at a day where that child is
 * unambiguously past eighteen.
 *
 * `eldest` starts at 14-16 (`CHILD_START_AGES`), so four calendar years puts
 * them at 18-20 — `young_adult` on every seed, rather than on the ones where
 * the draw happened to come out high. The household is overwritten rather
 * than drawn for, because which three relations a seed gives you is not what
 * any of this is about.
 */
function houseWithGrownChild(seed = 4242): { state: GameState; childName: string } {
  const state = newGame({ name: 'Test Boss', difficulty: 'normal', seed });
  const house = home(state);
  house.people = [
    { name: 'Carla', relationId: 'eldest' },
    { name: 'Rosa', relationId: 'spouse' },
    { name: 'Vito', relationId: 'parent' },
  ];
  state.day = 365 * 4;
  return { state, childName: 'Carla' };
}

/** Somebody in the crew at a given role, with stats we control. */
function plant(
  state: GameState,
  id: string,
  role: RoleId,
  name: string,
  stats: Partial<Npc['stats']> = {},
): Npc {
  const npc = structuredClone(crewList(state)[0]);
  npc.id = id;
  npc.name = name;
  npc.role = role;
  npc.status = 'active';
  npc.daysInCrew = 200;
  npc.opsCompleted = 12;
  Object.assign(npc.stats, { grievance: 0, loyalty: 60, ambition: 50 }, stats);
  state.npcs[id] = npc;
  return npc;
}

describe('who counts as blood', () => {
  it('recognises the crew member carrying a grown household member\'s name', () => {
    const { state, childName } = houseWithGrownChild();
    const child = plant(state, 'kid', 'soldier', childName);
    expect(isBloodHeir(state, child)).toBe(true);
  });

  it('does not mistake a career capo for family', () => {
    const { state } = houseWithGrownChild();
    const capo = plant(state, 'a', 'capo', 'Sal Marchetti');
    expect(isBloodHeir(state, capo)).toBe(false);
  });

  it('says nothing about a child who is still a child', () => {
    const { state, childName } = houseWithGrownChild();
    // Back to day one: the same name, the same house, a twelve-year-old.
    state.day = 0;
    const child = plant(state, 'kid', 'soldier', childName);
    expect(isBloodHeir(state, child)).toBe(false);
  });
});

describe('naming your own blood', () => {
  it('costs every veteran capo grievance and loyalty on top of being passed over', () => {
    const { state, childName } = houseWithGrownChild();
    const child = plant(state, 'kid', 'soldier', childName);
    const veteran = plant(state, 'a', 'capo', 'Sal Marchetti', { grievance: 0, loyalty: 60 });
    const other = plant(state, 'b', 'capo', 'Nico Ferro', { grievance: 0, loyalty: 60 });

    expect(nameHeir(state, child.id).ok).toBe(true);

    for (const capo of [veteran, other]) {
      expect(capo.stats.grievance).toBe(NAMING.passedOverGrievance + NEPOTISM.capoGrievance);
      expect(capo.stats.loyalty).toBe(60 + NAMING.passedOverLoyalty - NEPOTISM.capoLoyaltyDrop);
    }
    expect(state.log.some((l) => l.text.includes('unearned'))).toBe(true);
  });

  it('costs an outsider nothing extra when there is no blood in the room', () => {
    const { state } = houseWithGrownChild();
    const chosen = plant(state, 'a', 'capo', 'Sal Marchetti');
    const passed = plant(state, 'b', 'capo', 'Nico Ferro', { grievance: 0, loyalty: 60 });

    expect(nameHeir(state, chosen.id).ok).toBe(true);
    expect(passed.stats.grievance).toBe(NAMING.passedOverGrievance);
  });
});

describe('passing your own blood over', () => {
  it('is paid for at the kitchen table', () => {
    const { state, childName } = houseWithGrownChild();
    const child = plant(state, 'kid', 'soldier', childName);
    const capo = plant(state, 'a', 'capo', 'Sal Marchetti');
    expect(eligibleHeirs(state).some((n) => n.id === child.id)).toBe(true);

    home(state).neglect = 10;
    expect(nameHeir(state, capo.id).ok).toBe(true);

    expect(home(state).neglect).toBe(10 + NEPOTISM.domesticNeglectOnCapoNamed);
    expect(state.log.some((l) => l.text.includes('over your own blood'))).toBe(true);
  });

  it('leaves the house alone when there was never a child in the crew', () => {
    const { state } = houseWithGrownChild();
    const capo = plant(state, 'a', 'capo', 'Sal Marchetti');
    home(state).neglect = 10;
    nameHeir(state, capo.id);
    expect(home(state).neglect).toBe(10);
  });
});

describe('a body past three hundred days', () => {
  /**
   * A week where nothing else is bearing down: no war, no heat, no arrears.
   *
   * Rounded up to a week boundary, because `tickStress` only runs on one —
   * an earlier draft of this helper picked days that were not multiples of
   * `HOME.intervalDays` and every aging assertion in it passed on a tick
   * that had returned early.
   */
  function quietWeek(day: number): GameState {
    const state = newGame({ name: 'Test Boss', difficulty: 'normal', seed: 77 });
    home(state).neglect = 0;
    state.org.heat = 0;
    state.org.wagesOwed = 0;
    state.day = Math.ceil(day / HOME.intervalDays) * HOME.intervalDays;
    return state;
  }

  it('still mends before the threshold', () => {
    const state = quietWeek(NEPOTISM.agingStartDay - 14);
    expect(state.day).toBeLessThan(NEPOTISM.agingStartDay);
    expect(stressPressure(state).aging).toBe(0);
    expect(stressPressure(state).netWeekly).toBe(-STRESS.naturalRecovery);
  });

  it('stops mending after it, and carries weariness instead', () => {
    const state = quietWeek(NEPOTISM.agingStartDay);
    expect(state.day).toBeGreaterThanOrEqual(NEPOTISM.agingStartDay);
    const pressure = stressPressure(state);
    expect(pressure.aging).toBe(NEPOTISM.agingWearinessStress);
    expect(pressure.netWeekly).toBe(NEPOTISM.agingWearinessStress);
  });

  it('accrues that weariness on the weekly tick', () => {
    const state = quietWeek(NEPOTISM.agingStartDay);
    state.player.stress = 20;
    tickStress(state);
    expect(playerStress(state)).toBe(20 + NEPOTISM.agingWearinessStress);
  });

  it('says so out loud once the meter is already in the red, and not weekly', () => {
    const state = quietWeek(NEPOTISM.agingStartDay);
    state.player.stress = STRESS.panicThreshold + 5;
    tickStress(state);
    const warnings = () => state.log.filter((l) => l.text.includes('cannot endure')).length;
    expect(warnings()).toBe(1);

    // The following week says nothing. A line every seven days about the same
    // heart is a subscription, not a warning.
    state.day += HOME.intervalDays;
    tickStress(state);
    expect(warnings()).toBe(1);

    // Far enough past the bar, on a week boundary, and it is allowed again.
    while (state.day - (state.flags['aging_warning_day'] as number) < NEPOTISM.agingWarningEveryDays) {
      state.day += HOME.intervalDays;
    }
    tickStress(state);
    expect(warnings()).toBe(2);
  });

  it('says nothing to a boss who is merely old and coping', () => {
    const state = quietWeek(NEPOTISM.agingStartDay);
    state.player.stress = 10;
    tickStress(state);
    expect(state.log.some((l) => l.text.includes('cannot endure'))).toBe(false);
  });
});
