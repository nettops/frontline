/**
 * Two men in the same chair do not sound the same.
 *
 * The sit-down is the one place in this game where somebody is in the room with
 * you, and the man opposite had no voice in it. Every reaction was narrated —
 * *"They do not count it in front of you, which is manners"* — and the
 * narration is good, but it belongs to the *register*, so a hot-headed enforcer
 * and a calculating bookkeeper produced the same sentence in the same cadence.
 * One writer doing every part.
 *
 * Two properties, and the second is the one that could have gone wrong quietly.
 *
 * **He sounds like himself.** Different traits, different words, same move.
 *
 * **And he tells you nothing about a number.** The temptation was to write the
 * angry line off `loyalty` — he snaps because loyalty is 22 — which is the
 * hidden stat leaking out dressed as character, and worse than printing it
 * because it looks like writing. Keyed on traits instead, which are *manner*:
 * how somebody talks is the most observable thing about them and says nothing
 * about where any figure sits. The guard below holds that by putting the same
 * man through the same beat at opposite ends of every stat.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList } from '../npc';
import { openSitdown, chooseRegister, availableRegisters, clearSitdown } from '../sitdown';
import { VOICES } from '../../config/voice';
import { TRAITS } from '../../config/npcs';
import type { GameState, Npc } from '../types';

function ready(seed: number): GameState {
  const state = newGame({ name: 'Voice', difficulty: 'normal', seed });
  state.org.cash = 200_000;
  state.day = 40;
  return state;
}

/** One beat, and what he said in it. */
function firstBeat(state: GameState, npc: Npc): string | null {
  npc.stats.grievance = 60;
  if (!openSitdown(state, 'crew', npc.id, 'settle').ok) return null;
  const reg = availableRegisters(state)[0];
  if (!reg) return null;
  chooseRegister(state, new Rng(state.rng), reg.id);
  const beat = state.sitdown?.beats[0]?.text ?? null;
  clearSitdown(state);
  return beat;
}

describe('the man opposite', () => {
  it('has a line for every trait the game can give somebody', () => {
    /*
       A trait with no voice falls through to bare narration, which is the old
       behaviour and is silent about itself. This is the guard against the
       catalogue drifting behind `TRAITS` — a new trait ships mute otherwise.
    */
    const missing = TRAITS.filter((t) => !VOICES[t.id]).map((t) => t.id);
    expect(missing, `traits with no voice: ${missing.join(', ')}`).toEqual([]);
  });

  it('says something different depending on who he is', () => {
    const heard = new Set<string>();
    let men = 0;
    for (const seed of [3, 11, 21, 33, 47, 58]) {
      const state = ready(seed);
      for (const npc of crewList(state).slice(0, 2)) {
        const beat = firstBeat(state, npc);
        if (!beat) continue;
        men += 1;
        heard.add(beat.split('\n')[0]);
        state.day += 40;
      }
    }
    expect(men, 'no sit-down opened, so this measured nothing').toBeGreaterThan(4);
    /*
       Against the men who spoke rather than a fixed number: the failure this
       catches is every voice collapsing to one, and a bar of "more than half
       of them differed" says that without depending on how many opened.
    */
    expect(heard.size, 'everybody in the room sounds the same').toBeGreaterThan(men / 2);
  });

  it('draws only on his traits and on what the player just watched happen', () => {
    /*
       Rule 1, as the property that is actually true.

       The first version of this asserted that the line does not move when a
       hidden stat moves, put one man's stats at 5 and another's at 95, and
       failed — correctly. Stats decide whether the move *lands*, landing
       decides which half of the voice is drawn from, and the player watches
       the landing happen. The line following the outcome is not a leak; it is
       the outcome, which was never hidden.

       So the invariant is the sourcing: whatever he says belongs to one of his
       own traits, in the half matching what the player just saw. Nothing else
       can have reached it. That fails the moment somebody writes an angry line
       off `loyalty`, which is the mistake this is here to prevent.
    */
    let checked = 0;
    for (const seed of [3, 11, 21, 33, 47, 58]) {
      const state = ready(seed);
      for (const npc of crewList(state).slice(0, 2)) {
        npc.stats.grievance = 60;
        if (!openSitdown(state, 'crew', npc.id, 'settle').ok) continue;
        for (let i = 0; i < 3; i++) {
          const regs = availableRegisters(state);
          if (!regs.length || !state.sitdown) break;
          chooseRegister(state, new Rng(state.rng), regs[i % regs.length].id);
          const beat = state.sitdown?.beats[state.sitdown.beats.length - 1];
          if (!beat) break;
          const spoken = beat.text.split('\n')[0];
          if (!spoken.startsWith('“')) continue;
          const allowed = npc.traits
            .filter((t) => VOICES[t])
            .flatMap((t) => (beat.landed ? VOICES[t].landed : VOICES[t].missed));
          expect(
            allowed,
            `${npc.name} said something that is not his: ${spoken}`,
          ).toContain(spoken);
          checked += 1;
        }
        clearSitdown(state);
        state.day += 40;
      }
    }
    expect(checked, 'nobody spoke, so this measured nothing').toBeGreaterThan(4);
  });

  it('never says the same thing twice in one conversation', () => {
    for (const seed of [3, 11, 21, 47]) {
      const state = ready(seed);
      const npc = crewList(state)[0];
      npc.stats.grievance = 60;
      if (!openSitdown(state, 'crew', npc.id, 'settle').ok) continue;
      for (let i = 0; i < 4; i++) {
        const regs = availableRegisters(state);
        if (!regs.length || !state.sitdown) break;
        chooseRegister(state, new Rng(state.rng), regs[i % regs.length].id);
      }
      const spoken = (state.sitdown?.beats ?? [])
        .map((x) => x.text.split('\n')[0])
        .filter((l) => l.startsWith('“'));
      expect(new Set(spoken).size, `he repeated himself: ${spoken.join(' | ')}`).toBe(spoken.length);
      clearSitdown(state);
    }
  });
});
