/**
 * A refusal a player can read, on the row they are looking at.
 *
 * Rule 4 of this project: a gate is fine and a refusal is fine, but a control
 * that takes a click and does nothing, or a refusal that does not say what
 * would lift it, is forbidden.
 *
 * The buy table on `BusinessesPanel` has now failed this four times. Round 7's
 * repair was a tooltip on the Territory panel, round 11 promoted the blocker
 * into the panel header, round 12 put the sentence in the panel body — and
 * that third one only rendered when **every** row was blocked:
 *
 *     {!options.some((o) => o.check.ok) && <p>{...check.reason}</p>}
 *
 * Round 21 held one district that would not sell and had two buyable rows
 * elsewhere on the map, so the guard was false, the paragraph never rendered,
 * and the reason for the rows he was actually looking at lived only in a
 * `title`. He found it by inspecting the DOM: *"a player clicking normally
 * would just see nothing happen and have no idea why."* Confirmed in source —
 * `check.reason` appeared exactly twice in that file, once in the all-blocked
 * paragraph and once in a tooltip.
 *
 * So the reason goes on the row, the way `CityPanel` has always done it for the
 * card tables, and the all-blocked paragraph goes, because a sentence printed
 * twice on one screen reads as a bug.
 *
 * And the second one, from the same round. The lay-low confirmation prices the
 * whole fortnight correctly — `perPayday * paydays + wagesOwed`, which is a
 * repair an earlier round already paid for — and never says whether you can
 * cover it. Round 21 read the bill, went dark, and came out on day 182 having
 * missed $1,063 of payroll: two soldiers quit on the spot and the rank went
 * with them. His diagnosis was that the preview priced one week. It priced
 * two. What it never did was the subtraction.
 */
import { describe, expect, it } from 'vitest';
import businesses from '../panels/BusinessesPanel.tsx?raw';
import dashboard from '../panels/Dashboard.tsx?raw';
import city from '../panels/CityPanel.tsx?raw';
import law from '../panels/LawPanel.tsx?raw';
import rivals from '../panels/RivalsPanel.tsx?raw';

describe('a refusal on the row that was refused', () => {
  it('prints why a business cannot be bought beside its own button', () => {
    /*
       Structural rather than a bare `includes`: the sentence has to be inside
       the cell that holds the button, so a reason rendered somewhere else on
       the page — which is what the last three repairs did — does not pass.
    */
    const cell = /See the \{def\.name\}[\s\S]*?<\/td>/.exec(businesses);
    expect(cell, 'the buy button is gone or renamed').not.toBeNull();
    expect(
      /\{check\.reason\}/.test(cell?.[0] ?? ''),
      'the reason a row is refused is back to living in a tooltip',
    ).toBe(true);
  });

  it('does not hold that sentence back until every row is blocked', () => {
    expect(businesses).not.toMatch(/!options\.some\(\(o\) => o\.check\.ok\)/);
  });

  it('is the same thing the card tables have always done', () => {
    // The panel this was copied from, so the two screens cannot drift apart.
    expect(city).toMatch(/\{!check\.ok && <div className="tiny faint">\{check\.reason\}<\/div>\}/);
  });
});

describe('a contract that cannot be sent, and why', () => {
  /*
     Round 27: `canContract` has always returned a real, specific reason —
     nobody by that name any more, a cooldown with days left, not enough
     crew free, the cost uncovered — and both places that gate a Contract
     button put that reason only in a `title` and printed "not possible" (or
     "Not possible") on the button face itself. `refusalShown.test.ts` had
     scanned every other refusal-shaped control in this codebase since round
     21 and never reached these two, because the Contract mechanic did not
     exist yet when this file was written. Same rule 4 defect, same fix: the
     reason a control is refused has to be readable without a hover, on the
     control itself.
  */
  it('says why on the witness-contract row, not only in the hover', () => {
    expect(law).not.toMatch(/:\s*'not possible'/);
    expect(law).toMatch(/check\.ok \? formatMoney\(check\.cost \?\? 0\) : check\.message/);
  });

  it('says why on the shared ContractButton, not only in the hover', () => {
    expect(rivals).not.toMatch(/:\s*'Not possible'/);
    expect(rivals).toMatch(/check\.ok \? `Send somebody.*?` : check\.message/);
  });

  it('says why a poach offer cannot be made, not only in the hover', () => {
    // Same file, same defect, a third instance found alongside the other two:
    // `canApproach`'s refusal also lived only in a title.
    expect(rivals).toMatch(/: check\.message\}\s*\n\s*<\/button>/);
  });
});

describe('going dark on money you have not got', () => {
  it('says the fortnight is more than you can cover, rather than only its price', () => {
    expect(dashboard).toMatch(/const covered = totalFunds\(state\) >= cost;/);
    // The sentence itself, on the confirmation, not in the hover.
    const line = /\{!covered &&[\s\S]{0,400}/.exec(dashboard);
    expect(line, 'the shortfall is no longer rendered at all').not.toBeNull();
    expect(line?.[0]).toMatch(/short of that/);
    expect(line?.[0]).toMatch(/formatMoney\(short\)/);
  });

  it('still prices both paydays and the arrears, which an earlier round paid for', () => {
    expect(dashboard).toMatch(/perPayday \* paydays \+ \(state\.org\.wagesOwed \?\? 0\)/);
  });
});
