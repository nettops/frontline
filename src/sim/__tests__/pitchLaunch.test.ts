/**
 * A pitch is used up by the job it was for, and by nothing else.
 *
 * Round 30's MUST FIX 1. Approving used to consume the pitch on the click
 * (`approvePitch` set `status = 'approved'`, `livePitches` lists only `'open'`),
 * so leaving the assemble screen by any road but Launch — Cancel, another tab,
 * approving a second pitch — threw the offer away with no line in the log. A
 * tester lost a $30–70K Warehouse Job that way, twice.
 *
 * `launchPitched` moves the settling to the one moment that earns it: the job
 * actually going out. These tests pin that down; the panel's half of it — that
 * the Approve click no longer spends anything — is
 * `ui/__tests__/pitchPreservation.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { launchPitched, livePitches, tickCapoPitches } from '../capoPitches';
import { crewNeeded } from '../operations';
import { OPERATION_BY_ID } from '../../config/operations';
import { operableTerritories, territoryList } from '../territory';
import { availableCrew, crewList } from '../npc';
import type { CapoPitch, GameState } from '../types';

/** Enough of an organization for pitched work to be open and staffable. */
function withPitch(): { state: GameState; pitch: CapoPitch } {
  const state = newGame({ name: 'Pitch', difficulty: 'normal', seed: 3 });
  const ts = territoryList(state);
  for (let i = 0; i < 2 && i < ts.length; i++) {
    ts[i].influence = { ...ts[i].influence, player: 95 };
  }
  const src = crewList(state)[0];
  for (let i = crewList(state).length; i < 8; i++) {
    state.npcs[`n${i}`] = { ...src, id: `n${i}`, name: `Hand ${i}`, status: 'active' };
  }
  state.org.cash = 500_000;
  const rng = new Rng(state.rng);
  while (state.day < 7) {
    tickCapoPitches(state, rng);
    state.day += 1;
  }
  tickCapoPitches(state, rng);
  const pitch = livePitches(state)[0];
  expect(pitch, 'the setup produced no pitch to test with').toBeTruthy();
  return { state, pitch };
}

function crewFor(state: GameState, pitch: CapoPitch): string[] {
  const need = crewNeeded(state, OPERATION_BY_ID[pitch.defId]);
  return availableCrew(state)
    .slice(0, need)
    .map((n) => n.id);
}

describe('launching a pitched job', () => {
  it('spends the pitch when the job goes out', () => {
    const { state, pitch } = withPitch();
    const op = launchPitched(state, pitch.id, pitch.defId, crewFor(state, pitch), pitch.territoryId);
    expect(op, 'the setup could not launch the job').not.toBeNull();
    expect(livePitches(state).some((p) => p.id === pitch.id)).toBe(false);
    expect(state.capoPitches!.find((p) => p.id === pitch.id)!.status).toBe('approved');
  });

  it('leaves the pitch open when the launch is refused', () => {
    const { state, pitch } = withPitch();
    // Nobody sent: `canLaunch` refuses, so nothing went out and nothing is spent.
    const op = launchPitched(state, pitch.id, pitch.defId, [], pitch.territoryId);
    expect(op).toBeNull();
    expect(livePitches(state).some((p) => p.id === pitch.id)).toBe(true);
  });

  it('leaves the pitch open when the same job is run somewhere else', () => {
    const { state, pitch } = withPitch();
    const elsewhere = operableTerritories(state).find((o) => o.territory.id !== pitch.territoryId);
    expect(elsewhere, 'the setup left only one district to work').toBeTruthy();
    const op = launchPitched(
      state,
      pitch.id,
      pitch.defId,
      crewFor(state, pitch),
      elsewhere!.territory.id,
    );
    expect(op, 'the setup could not launch the job elsewhere').not.toBeNull();
    // It is not that capo's job in that district, so his offer is still standing.
    expect(livePitches(state).some((p) => p.id === pitch.id)).toBe(true);
  });

  it('launches an offer that lapsed while the assemble screen was open', () => {
    const { state, pitch } = withPitch();
    state.capoPitches!.find((p) => p.id === pitch.id)!.status = 'expired';
    const op = launchPitched(state, pitch.id, pitch.defId, crewFor(state, pitch), pitch.territoryId);
    expect(op, 'a lapsed offer must not stop a job the boss is running anyway').not.toBeNull();
    expect(state.capoPitches!.find((p) => p.id === pitch.id)!.status).toBe('expired');
  });

  it('launches an ordinary job when there was no pitch behind it', () => {
    const { state, pitch } = withPitch();
    const op = launchPitched(state, null, pitch.defId, crewFor(state, pitch), pitch.territoryId);
    expect(op).not.toBeNull();
    // The offer this job happens to match was never the one being answered.
    expect(livePitches(state).some((p) => p.id === pitch.id)).toBe(true);
  });
});
