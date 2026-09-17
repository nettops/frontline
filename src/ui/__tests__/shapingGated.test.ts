/**
 * "Shaping into" read the raw, ungated `careerShape(state)` directly, with no
 * familiarity requirement at all — while `perceivedLeadership` (`sim/legacy.ts`)
 * exists precisely to gate this same read behind a crew member's familiarity
 * crossing `GOAL_CERTAIN_ABOVE`. It was built and never wired: this panel
 * reached past `perceive()`'s gate, the same fault CLAUDE.md's rule 1 names.
 */
import { describe, expect, it } from 'vitest';
import playerPanel from '../panels/PlayerPanel.tsx?raw';

describe('the shaping-into read is earned, not free', () => {
  it('reads the gated function, not the raw one', () => {
    expect(playerPanel).toContain('perceivedLeadership');
  });

  it('does not read careerShape directly for this row', () => {
    expect(playerPanel).not.toMatch(/careerShape\(state\)\.name/);
  });

  it('renders the row only when the gated read is not null', () => {
    // The comment above the row (explaining why rank prints above shape)
    // says "Shaping into" too, so anchor on the last occurrence: the render.
    const at = playerPanel.lastIndexOf('Shaping into');
    expect(at, 'the row is gone or renamed').toBeGreaterThan(-1);
    const block = playerPanel.slice(Math.max(0, at - 40), at);
    expect(block, 'the row renders unconditionally').toMatch(/shape\s*&&/);
  });
});
