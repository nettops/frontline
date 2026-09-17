/**
 * Blood and the calendar, on the page.
 *
 * Source-text assertions rather than a render, matching every other file in
 * this directory — there is no DOM harness here, and what these guard is that
 * the wiring exists at all, which is exactly the class of fault a panel that
 * silently never renders produces.
 *
 * Two rules are on the line. Rule 4, "no button lies": naming a blood heir is
 * the most expensive irreversible click on the Succession screen and its cost
 * cannot live only in a `title`, which is the fault `refusalShown.test.ts`
 * documents four separate rounds of. And rule 3, "a number that moved moved
 * for a reason a panel can name": a boss whose stress quietly stops falling
 * past day 300 has to be able to read why on the screen the meter is on.
 */
import { describe, expect, it } from 'vitest';
import succession from '../panels/SuccessionPanel.tsx?raw';
import player from '../panels/PlayerPanel.tsx?raw';

describe('the blood heir, on the succession screen', () => {
  it('reads the sim rather than guessing at the name itself', () => {
    expect(succession).toContain('isBloodHeir(state, npc)');
  });

  it('tags the candidate the room already knows the parentage of', () => {
    expect(succession).toContain('Blood Heir');
  });

  /*
     The warning in the body, not only in the button's `title`. Asserted by
     finding the control and reading what is beside it, so moving the sentence
     into a tooltip fails this rather than passing it.
  */
  it('prints what naming them costs where it can be read without hovering', () => {
    const at = succession.indexOf('bloodWarning');
    expect(at, 'the warning is gone or renamed').toBeGreaterThan(-1);
    expect(succession).toMatch(/\{blood && !isHeir && \(/);
    expect(succession).toMatch(/<p className="hot tiny"[\s\S]{0,120}\{bloodWarning\}/);
  });

  /*
     Built out of the config rather than typed as a sentence with a 25 in it.
     A warning that names a number the simulation no longer applies is a lie
     with a decimal point on it.
  */
  it('quotes the real figures rather than a copy of them', () => {
    expect(succession).toContain('NEPOTISM.capoGrievance');
    expect(succession).toContain('NEPOTISM.capoLoyaltyDrop');
    expect(succession).not.toMatch(/\+25 grievance/);
  });
});

describe('the aging body, on the player screen', () => {
  it('says the recovery has stopped, and why', () => {
    expect(player).toContain('isAging(state)');
    expect(player).toContain('Career Weariness (Aging)');
    expect(player).toContain('NEPOTISM.agingStartDay');
  });

  it('itemises the weariness in the same breakdown as every other driver', () => {
    expect(player).toContain('pressure.aging');
  });
});
