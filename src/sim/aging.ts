/**
 * Time happening to people.
 *
 * The organization had no clock of its own. Nobody got older, nobody declined,
 * nobody wanted out, and nothing died of anything but violence — which meant
 * every crisis in a long game had to be caused by the player or by an agency,
 * and a succession could only ever be a disaster rather than a fact of life.
 *
 * Runs once a year, on the day the calendar turns. A leaf module: it takes
 * callbacks for the two things that need other systems (an heir standing down
 * is a succession concern, a death is an evidence concern) so nothing here
 * imports upward.
 */

import { Rng, clamp } from './rng';
import type { GameState, Npc } from './types';
import { addLog, withArticle } from './util';
import { AGING } from '../config/succession';
import { ROLE_LABEL, ROLE_ORDER, DAYS_PER_YEAR } from '../config/economy';

const SENIOR_FROM = ROLE_ORDER.indexOf('lieutenant');

function note(npc: Npc, day: number, text: string, kind: 'neutral' | 'good' | 'bad'): void {
  npc.notes.unshift({ day, text, kind });
  if (npc.notes.length > 40) npc.notes.length = 40;
}

/**
 * What another year does to somebody.
 *
 * Not simply decline. Skill and nerve go, and judgement arrives — an old
 * soldier is a worse man to send through a door and a better one to ask about
 * it, which is what makes keeping him a real decision rather than a sentimental
 * one.
 */
function applyDecline(npc: Npc): void {
  const years = npc.age - AGING.declineFrom;
  if (years <= 0) return;

  npc.stats.skill = clamp(npc.stats.skill + AGING.skillPerYear, 0, 100);
  npc.stats.courage = clamp(npc.stats.courage + AGING.couragePerYear, 0, 100);
  npc.stats.intelligence = clamp(npc.stats.intelligence + AGING.intelligencePerYear, 0, 100);
  npc.stats.discipline = clamp(npc.stats.discipline + AGING.disciplinePerYear, 0, 100);
  npc.stats.ambition = clamp(npc.stats.ambition + AGING.ambitionPerYear, 0, 100);
}

function chanceOver(base: number, perYear: number, age: number, from: number): number {
  if (age < from) return 0;
  return clamp(base + (age - from) * perYear, 0, 0.6);
}

export interface AgingHooks {
  /** Somebody has died in their bed. The organization still has to react. */
  onDeath(npc: Npc): void;
  /** Somebody wants out, with their dignity. */
  onRetire(npc: Npc): void;
}

/**
 * The yearly pass. Called from the clock on the day the calendar turns, after
 * ages have been incremented.
 */
export function tickAging(state: GameState, rng: Rng, hooks: AgingHooks): void {
  if (state.day % DAYS_PER_YEAR !== 0) return;

  for (const npc of Object.values(state.npcs)) {
    if (npc.status === 'dead' || npc.status === 'defected' || npc.status === 'boss') continue;

    applyDecline(npc);

    // Dying quietly. Checked before retirement, because a man who was going to
    // go this year does not get to announce it first.
    if (rng.chance(chanceOver(AGING.deathBase, AGING.deathPerYear, npc.age, AGING.deathFrom))) {
      npc.status = 'dead';
      npc.unavailableUntilDay = null;
      note(npc, state.day, 'Died. They were not young and it was not violent.', 'bad');
      addLog(
        state,
        `${npc.name} died at ${npc.age}. Everybody went, and it was the largest room any of them had been in for years.`,
        'crew',
      );
      hooks.onDeath(npc);
      continue;
    }

    const senior = ROLE_ORDER.indexOf(npc.role) >= SENIOR_FROM;
    const retire =
      chanceOver(AGING.retireBase, AGING.retirePerYear, npc.age, AGING.retireFrom) *
      (senior ? AGING.retireSeniorMultiplier : 1);

    if (rng.chance(retire)) {
      /*
       * Retirement is not defection, and it matters that the game says so.
       *
       * A man who walks out angry becomes a thread an investigator pulls. A
       * man who is sixty-eight and has had enough leaves with everybody's
       * blessing and takes nothing with him but what he knows, which he has
       * no reason to say. The status is the same because the roster has one
       * way of losing people; the consequences are not.
       */
      npc.status = 'defected';
      npc.unavailableUntilDay = null;
      note(npc, state.day, 'Stood down. Nobody argued with them about it.', 'neutral');
      addLog(
        state,
        `${npc.name} is finished. Forty years and ${withArticle(ROLE_LABEL[npc.role].toLowerCase())}'s pension nobody will ever write down.`,
        'crew',
      );
      hooks.onRetire(npc);
    }
  }
}
