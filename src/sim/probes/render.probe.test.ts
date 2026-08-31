/**
 * Every page of every event, built for real.
 *
 * A variant is a template literal referencing whatever happened to be in scope
 * where it was written. TypeScript catches a name that does not exist; it does
 * not catch a name that exists and is undefined on the draw that reaches it, and
 * a variant only reaches the screen when the seeded rng picks it. So this
 * builds every event many times over and reads what came out.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { tickEvents } from '../events';
import { advanceDay } from '../clock';
import { availableOperations, launchOperation } from '../operations';
import { crewList } from '../npc';
import { canRecruit, recruit } from '../crew';
import { operableTerritories } from '../territory';
import { totalFunds } from '../economy';
import type { GameState } from '../types';

describe('every event page', () => {
  it('renders without leaking a placeholder or an undefined', () => {
    const seen = new Map<string, Set<string>>();
    const broken: string[] = [];

    for (let seed = 1; seed <= 40; seed++) {
      const state: GameState = newGame({ name: 'Render', difficulty: 'normal', seed });
      const rng = new Rng(state.rng);
      for (let d = 0; d < 220; d++) {
        /*
           A bot that actually plays, because most events are gated on state a
           passive one never reaches: somebody in custody, a front under audit,
           a district you half-hold. Sitting still raised nine of twenty-two.
        */
        for (const id of Object.keys(state.recruits)) {
          if (canRecruit(state, id).ok) recruit(state, id);
        }
        const spots = operableTerritories(state);
        if (spots.length) {
          for (const def of availableOperations(state)) {
            const free = crewList(state).filter((n) => n.status === 'active');
            if (free.length < def.crewRequired || def.investment > totalFunds(state)) continue;
            launchOperation(
              state,
              def.id,
              free.slice(0, def.crewRequired).map((n) => n.id),
              spots[Math.floor(d / 30) % spots.length].territory.id,
            );
          }
        }
        tickEvents(state, rng);
        for (const e of state.pendingEvents) {
          const page = `${e.title}\n${e.body}`;
          if (/undefined|NaN|\$\{|\[object/.test(page)) {
            broken.push(`${e.defId}: ${page.slice(0, 120)}`);
          }
          if (!seen.has(e.defId)) seen.set(e.defId, new Set());
          seen.get(e.defId)!.add(e.title);
        }
        state.pendingEvents.length = 0;
        advanceDay(state);
      }
    }

    expect(broken.slice(0, 5), broken.slice(0, 5).join('\n')).toHaveLength(0);

    // And the variation is real at runtime, not only in the source: anything
    // raised often enough to notice must have been seen with more than one
    // headline.
    const single = [...seen.entries()]
      .filter(([, titles]) => titles.size === 1)
      .map(([id]) => id);
    // eslint-disable-next-line no-console
    console.log(
      `  ${seen.size} events raised across 40 worlds; ` +
        `${seen.size - single.length} seen with more than one headline`,
    );
    expect(seen.size).toBeGreaterThan(14);
  });
});
