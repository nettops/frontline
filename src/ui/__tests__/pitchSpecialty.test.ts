/**
 * A pitch names the trade behind it.
 *
 * `capoSpecialty` (`sim/capoPitches.ts`) already exists and biases which jobs
 * a real capo brings, but nothing said so on the card — the board read like
 * pitches came from nowhere in particular. The operation itself (name,
 * description, payout) is shown on the card with no familiarity gate at all,
 * and a capo's role is the same: always visible, never earned through
 * `perceive()`. A trade is the same kind of fact — occupational, not a
 * psychological read like a stat or a trait — so it follows that precedent
 * rather than `perceive()`'s.
 */
import { describe, expect, it } from 'vitest';
import type { Npc, RoleId } from '../../sim/types';
import { specialtyLine } from '../../sim/capoPitches';
import operationsPanel from '../panels/OperationsPanel.tsx?raw';

function npc(id: string, role: RoleId, name = 'Paulie'): Npc {
  return {
    id, name, age: 45, role, familiarity: 50,
    traits: [], secret: null, stats: {} as Npc['stats'], daysInCrew: 0,
    opsCompleted: 0, opsFailed: 0, wage: 100, status: 'active',
    unavailableUntilDay: null, notes: [], goal: null, goalSince: 0, ties: [],
    memories: [], isSkimming: false, skimTotal: 0, joinedDay: 0,
  } as Npc;
}

describe('a pitch names the trade behind it', () => {
  it("names a real capo's trade, and stably — the same id always reads the same line", () => {
    const capo = npc('npc-paulie', 'capo');
    const line = specialtyLine(capo);
    expect(line).toContain(capo.name);
    expect(line).toBe(specialtyLine(npc('npc-paulie', 'capo')));
  });

  it('says nothing for the seniority fallback — there is no capo yet to have a trade', () => {
    expect(specialtyLine(npc('npc-nobody', 'soldier'))).toBeNull();
  });

  it('is read on the pitch card, not only computed', () => {
    expect(operationsPanel).toContain('specialtyLine');
  });
});
