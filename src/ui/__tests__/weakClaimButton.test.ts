/**
 * A live button that read like a dead one.
 *
 * `nameHeir` never reads claim strength — it refuses only for a rank too
 * junior to be `eligibleHeirs` at all ("Nobody would follow {role}. Move
 * them up first."). The worst claim band's own label is "Nobody would
 * follow them" — the same sentence, for a different thing — sitting beside
 * a "Name them" button that was never disabled for it. Round 28's blind
 * report never once tried naming a successor across a 300-day career for
 * exactly this reason.
 *
 * A source scan, matching this project's no-jsdom convention: what matters
 * is that the button's own label and title change for a weak-claim
 * candidate, not the exact wording (free to change).
 */
import { describe, expect, it } from 'vitest';
import panel from '../panels/SuccessionPanel.tsx?raw';

describe('the succession panel says a weak claim can still be named', () => {
  it('imports weakClaim from the sim', () => {
    expect(panel).toMatch(/weakClaim/);
  });

  it('changes the button label for a weak-claim candidate', () => {
    expect(panel).toMatch(/weakClaim\(claim\)\s*\?\s*'Name them anyway'/);
  });
});
