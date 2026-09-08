/**
 * A button that was doing something and showing nothing.
 *
 * Round 20 pressed "Call everybody in" twice and filed it as a no-op: *"checked
 * the bar (no cash change), the modal state (none opened), and the log (no new
 * entry) both times. The button's own description promises 'grievances come
 * out, and you find out who did not come' — nothing came out either time."*
 *
 * It was working. `callEverybodyIn` clears grievance, raises regard, writes a
 * note on the file of everybody who spoke, and returns a `Meeting` carrying who
 * was heard, what each had been carrying, and who did not come. The panel
 * called it for its side effects and threw the return value away, so the entire
 * payload the button advertises reached the player as one log line of counts.
 *
 * Reads the source, in the idiom of `oneName.test.ts`. What is guarded is that
 * the panel *uses* the result — a rendered test would have passed throughout,
 * because the button was present, enabled and wired correctly.
 */
import { describe, expect, it } from 'vitest';
import crewPanel from '../panels/CrewPanel.tsx?raw';

describe('what came out of the room', () => {
  it('keeps the meeting rather than discarding it', () => {
    expect(
      /mutate\(\(g\) => callEverybodyIn\(g\), true\)\)?\s*\)?\s*$/m.test(crewPanel) &&
        !crewPanel.includes('setMeeting'),
      'the panel is back to calling the verb for its side effects',
    ).toBe(false);
    expect(crewPanel).toMatch(/setMeeting\(mutate\(\(g\) => callEverybodyIn\(g\), true\)/);
  });

  it('names who spoke and who did not come, which is what the button promises', () => {
    expect(crewPanel).toMatch(/said their piece/);
    expect(crewPanel).toMatch(/Did not come/);
  });

  it('quantifies nothing, because grievance is a hidden stat', () => {
    /*
       The first rule of this game is that everything a player reads about a
       person goes through `perceive`. A meeting is a man saying his piece in a
       room, not a readout, so it names who spoke on the same threshold the sim
       uses for the note it writes on their file and prints no number.
    */
    const block = crewPanel.slice(crewPanel.indexOf('meeting &&'));
    expect(block, 'the meeting is printing a grievance figure').not.toMatch(
      /grievanceBefore\}|grievanceBefore\.toFixed/,
    );
    expect(block).toMatch(/grievanceBefore > VERBS\.meetingClears/);
  });
});
