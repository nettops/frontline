/**
 * Round 30's smaller repairs, guarded against raw source.
 *
 * The idiom is `uiEvolution.test.ts`'s and `statesShown.test.ts`'s: the source
 * with its commentary stripped, because every repair in this project is
 * explained in a comment above the code that makes it, and those comments
 * quote the strings they are about. None of these is a sim change and none
 * touches the save.
 */
import { describe, expect, it } from 'vitest';
import statbar from '../StatBar.tsx?raw';
import territory from '../panels/TerritoryPanel.tsx?raw';
import finances from '../panels/FinancesPanel.tsx?raw';
import contraband from '../panels/ContrabandPanel.tsx?raw';
import css from '../../styles/theme.css?raw';

const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const flat = (src: string): string => code(src).replace(/\s+/g, ' ');

const BAR = flat(statbar);
const TERRITORY = flat(territory);
const FINANCES = flat(finances);

function rule(selector: string): string {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const at = bare.indexOf(`${selector} {`);
  if (at === -1) return '';
  return bare.slice(at, bare.indexOf('}', at));
}

describe('the docket watches a case, not only the heat', () => {
  it('has a chip for an open file, sent to the Law screen', () => {
    expect(BAR).toMatch(/key: 'case'/);
    expect(BAR).toMatch(/go: 'law'/);
  });

  it('reads the fogged posture, never a case’s own strength', () => {
    // An exact figure on a strip every screen shows would lift the fog
    // `caseIntel` exists to keep, so the chip is built from `arrestRisk`.
    expect(BAR).toMatch(/arrestRisk\(state\)/);
    const docket = BAR.slice(BAR.indexOf('function Docket'), BAR.indexOf('function Docket') + 4000);
    expect(docket).not.toMatch(/\.strength|evidence/i);
  });
});

describe('a peeked-at memo does not ghost over what is behind it', () => {
  it('goes fully transparent', () => {
    const r = rule('.memo-backdrop.peeking .memo');
    expect(r, 'the peek rule has gone').toBeTruthy();
    expect(r).toMatch(/opacity:\s*0\s*;/);
  });
});

describe('a district that cannot be handed over says why on the page', () => {
  it('prints the refusal under the names, not only in a tooltip', () => {
    expect(TERRITORY).toMatch(/const refusals = /);
    expect(TERRITORY).toMatch(/refusals\.map\(/);
  });
});

describe('the loan slider does not choose the debt for him', () => {
  it('opens on the least he can take', () => {
    expect(FINANCES).toMatch(/const asking = amount \|\| minAmount;/);
    expect(FINANCES).not.toMatch(/amount \|\| Math\.round\(ceiling \/ 2\)/);
  });
});

/*
   The ramp's one screen obligation.

   `ROUTE_RAMP_WEEKS` makes a new route carry a quarter of what the ground is
   worth, and a "Would carry" figure that is going to climb on its own with
   nothing on the page to say so is rule 3 — a number that moved for a reason
   no panel can name. Read against the source for the same reason the rest of
   this file is: the cell is a computed number, not a string a render test
   could match.
*/
describe('a settling route says so on the trade screen', () => {
  it('names the weeks left, and only while there are any', () => {
    const TRADE = flat(contraband);
    expect(TRADE).toMatch(/weeksToSettle\(state, tab, t\.id\) > 0/);
    expect(TRADE).toMatch(/settling in/);
  });
});

/*
   The heat chip and the gauge redden at the same place.

   The chip needed heat above 60 while the Overview's gauge, the stat bar's tone
   and `heatSeverity` all call 41 — Major Investigation, where the tier text says
   resources are being spent — the `hot` edge. So a boss at 55 saw a red gauge
   and a strip with nothing on it. It reads `heatSeverity` rather than a number
   of its own, which is what `config/heat.ts` says two parts of one screen must
   not disagree about.
*/
describe('the docket heat chip follows the gauge', () => {
  it('appears at the tier the gauge reddens at, not at a number of its own', () => {
    expect(BAR).toMatch(/heatSeverity\(state\.org\.heat\) === 'hot'/);
    expect(BAR).not.toMatch(/state\.org\.heat > 60/);
  });
});
