/**
 * A table where every row's button said the same thing.
 *
 * Round 19: *"the AVAILABLE TO BUY table lists up to ten rows, several sharing
 * the exact label 'Go and see' for different businesses in different districts
 * distinguishable only by a narrow district column. This isn't just an
 * automation problem — a mouse player skimming that list is one misclick away
 * from opening a negotiation for the wrong property."* The same tester saw a
 * negotiation open, once, for a business he had not clicked, and could not
 * separate that from this.
 *
 * Reads the source, in the same idiom as `oneName.test.ts` and for the same
 * reason: what is guarded is a property of the screen rather than of a run, and
 * a test that rendered the panel and asserted its contents would have passed
 * throughout the failure — every button was present, enabled, and wired to the
 * right row. They were only indistinguishable to a person.
 */
import { describe, expect, it } from 'vitest';
import businesses from '../panels/BusinessesPanel.tsx?raw';

describe('a row that can be told apart from the row above it', () => {
  it('names the premises in the button, not only in the far column', () => {
    // The exact string the whole list used to carry.
    expect(
      /^\s*Go and see\s*$/m.test(businesses),
      'the buy list is back to one label on every row',
    ).toBe(false);
    expect(businesses).toMatch(/See the \{def\.name\}/);
  });

  it('adds the district only when the premises alone would repeat', () => {
    /*
       Two Auto Shops in two districts need separating; one Auto Shop does not,
       and a label that always carried both would be long in a narrow cell for
       no gain. The condition is what makes every label unique without making
       every label unwieldy.
    */
    expect(businesses).toMatch(/options\.filter\(\(o\) => o\.def\.id === def\.id\)\.length > 1/);
    expect(businesses).toMatch(/territoryDef\(territory\.id\)\.name/);
  });
});
