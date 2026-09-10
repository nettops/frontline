/**
 * Naming the uncertainty the sit-down is already built on.
 *
 * `sim/sitdown.ts`'s own design doc calls this "inference under uncertainty
 * against a perception of a man that is noisy and banded" — and it is: a
 * register only unlocks its targeted follow-up on a landed check
 * (`sim/sitdown.ts`'s `revealed` push is gated on `landed`), and whether a
 * register lands is judged against a hidden stat the player reads through
 * `perceive()`, which is deliberately noisy at low familiarity. A sit-down
 * early in a relationship is correctly a near-guess — that is the design —
 * but nothing on the room screen ever said so. The only number shown was a
 * bare familiarity percentage, with no context for what it meant, so a
 * mechanic working exactly as designed read as a coin flip instead of an
 * honest "you do not know him yet."
 *
 * `PERCEPTION_TIERS` already carries the right words for this
 * ("First impressions only", "You barely know them") and is already shown
 * on the crew sheet (`CrewPanel.tsx`). This is the same reading, surfaced on
 * the one screen where the player is about to spend a choice against it.
 */
import { describe, expect, it } from 'vitest';
import sitdownModal from '../SitdownModal.tsx?raw';

describe('the sit-down names how shaky its own reads are', () => {
  it('imports the same perception tiers the crew sheet already shows', () => {
    expect(sitdownModal).toMatch(/PERCEPTION_TIERS/);
  });

  it('computes a tier from the person being read, not a stored number', () => {
    // Structural rather than a bare `includes`: it has to be a live
    // computation off `npc.familiarity`, the same field the subtitle already
    // reads, not a copy that could drift from it.
    expect(sitdownModal).toMatch(/npc\.familiarity\s*>=\s*t\.minFamiliarity/);
  });

  it('renders the tier label on the room screen, not only computes it', () => {
    const cell = /<p className="room-sub">\{subtitle\}<\/p>[\s\S]{0,400}/.exec(sitdownModal);
    expect(cell, 'the subtitle line is gone or renamed').not.toBeNull();
    expect(
      /tier[?.]*\.?label/.test(cell?.[0] ?? ''),
      'the perception tier is computed but never printed near the subtitle',
    ).toBe(true);
  });
});
