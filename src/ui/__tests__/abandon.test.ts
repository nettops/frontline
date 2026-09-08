/**
 * The one control that can put a career back on the title screen.
 *
 * Round 20 reported the game returning to the title screen twice, *"both times
 * immediately after a batched answer-then-advance, never on demand
 * afterwards"*, and could not rule out his own scripted input. It was not
 * reproduced and the cause is still unestablished.
 *
 * What could be established is the surface. `state` lives in one module-level
 * variable and there is exactly one function that clears it — `setGame(null)`
 * — with exactly two callers: "Start again", which only exists on the game-over
 * screen, and "Back to title" here. Anything that lands a player on the title
 * screen while their family is alive came through this button.
 *
 * Two faults on it, neither of them the reported one:
 *
 * **It said the run was gone, and the run was not gone.** The copy read
 * *"Anything not written to a slot is lost."* Every day advance goes through
 * `mutate(..., true)`, which writes `AUTOSAVE_SLOT`; the title screen lists that
 * slot under Continue with the boss's name and the day on it. So a player who
 * lost a career to a stray click was told by the screen that they had thrown it
 * away, when Continue was one click below. That is the third rule of this
 * project — everything the player sees is true — and the sentence was false.
 *
 * **And one click did it.** A destructive control with no second step is the
 * one shape a batched or mis-landed input can operate by accident, which is the
 * only mechanism in reach of the report. The confirm does not fix an unknown
 * cause; it removes the only known route to the symptom.
 *
 * Reads the source, in the idiom of `meetingShown.test.ts`: what is guarded is
 * that no path calls `setGame(null)` straight off a click.
 */
import { describe, expect, it } from 'vitest';
import savesPanel from '../panels/SavesPanel.tsx?raw';
import titleScreen from '../TitleScreen.tsx?raw';
import app from '../App.tsx?raw';
import store from '../../store.ts?raw';

describe('abandoning a game', () => {
  it('is the only thing besides the game-over screen that can clear the state', () => {
    /*
       The claim the rest of this file rests on, checked rather than asserted in
       a comment. If a third caller ever appears, the reasoning above stops
       covering the surface and this is where that gets noticed.
    */
    const callers = Object.entries({ app, titleScreen, savesPanel })
      .filter(([, src]) => /setGame\(null\)/.test(src))
      .map(([name]) => name);
    expect(callers.sort()).toEqual(['app', 'savesPanel']);
    // And that clearing it is what puts the title screen back up at all.
    expect(store).toMatch(/export function setGame\(next: GameState \| null\)/);
    expect(app).toMatch(/if \(!state\) return <TitleScreen \/>;/);
  });

  it('does not go on one click', () => {
    const back = /onClick=\{\(\) => ([^}]+)\}>\s*\n?\s*Back to title/.exec(savesPanel);
    expect(back, 'the abandon button is gone or renamed').not.toBeNull();
    expect(
      back?.[1],
      'one click on the saves panel abandons a live career',
    ).toBe('setConfirmAbandon(true)');
    // The real clear happens once, and only behind the second step.
    expect(savesPanel.match(/setGame\(null\)/g)?.length).toBe(1);
  });

  it('asks first, and says so on the button', () => {
    expect(savesPanel).toMatch(/confirm/i);
    expect(savesPanel).toMatch(/Yes, abandon it/);
  });

  it('does not tell the player their career is gone when it is not', () => {
    /*
       The autosave is written on every advance and offered by name on the
       screen this button leads to. Saying otherwise is the fault; the guard is
       against the sentence coming back, in any of the forms it was written in.
    */
    expect(/not written to a slot is lost/.test(savesPanel)).toBe(false);
    expect(savesPanel).toMatch(/autosave/i);
    // And the claim that makes the copy true: the title screen offers it back.
    expect(titleScreen).toMatch(/slot === 'auto' \? 'Autosave'/);
  });
});
