/**
 * Four reading problems, and the controls that answer them.
 *
 * Round 29's blind report named them in its own words: a thousand five hundred
 * pixels of finished and forbidden work between the top of Operations and the
 * street job the player wanted; a memo that locks the screen and asks about
 * money the player can no longer see; a payroll cliff and a boiling grudge that
 * happen on a tab nobody is looking at; and rosters that print a man carrying a
 * grievance in the same grey as a man who is fine.
 *
 * All four repairs are presentation — nothing here writes to the save, and
 * `SAVE_VERSION` does not move. Which is exactly why they need a guard: a
 * change that reads nothing and stores nothing has no unit test to break, and
 * the way a sticky bar or a row accent dies is silently, in a refactor.
 *
 * The idiom is `sopranoControls.test.ts`'s — the source with its commentary
 * stripped out, because every repair in this project is explained in a comment
 * directly above itself, and a guard run against raw text would be satisfied by
 * its own justification.
 */
import { describe, expect, it } from 'vitest';

import operations from '../panels/OperationsPanel.tsx?raw';
import memo from '../MemoModal.tsx?raw';
import statbar from '../StatBar.tsx?raw';
import crew from '../panels/CrewPanel.tsx?raw';
import businesses from '../panels/BusinessesPanel.tsx?raw';
import components from '../components.tsx?raw';
import css from '../../styles/theme.css?raw';

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

const OPS = code(operations);
const MEMO = code(memo);
const BAR = code(statbar);
const CREW = code(crew);
const FRONTS = code(businesses);
const COMPONENTS = code(components);

/** One rule block, by selector, with its comments stripped. `tableWidth`'s. */
function rule(selector: string): string {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const at = bare.indexOf(`${selector} {`);
  if (at === -1) return '';
  return bare.slice(at, bare.indexOf('}', at));
}

describe('the instrument', () => {
  it('is reading the sources it asserts about', () => {
    expect(OPS.length).toBeGreaterThan(1000);
    expect(MEMO.length).toBeGreaterThan(1000);
    expect(css.length).toBeGreaterThan(1000);
  });
});

describe('Operations can be crossed without scrolling it', () => {
  const ANCHORS = ['ops-active', 'ops-pitches', 'ops-street', 'ops-standing'];

  it('marks every section the jump bar offers', () => {
    for (const id of ANCHORS) {
      expect(OPS, `no section carries id ${id}`).toContain(`"${id}"`);
    }
  });

  it('lets a Panel carry the id a jump lands on', () => {
    expect(COMPONENTS).toMatch(/id\?:\s*string/);
    expect(COMPONENTS).toMatch(/<section className="panel" id=\{id\}/);
  });

  it('scrolls rather than merely naming them', () => {
    expect(OPS).toMatch(/scrollIntoView/);
    expect(OPS).toMatch(/ops-jump/);
  });

  it('stays on screen while the page runs under it', () => {
    expect(rule('.ops-jump'), '.ops-jump has gone').toBeTruthy();
    expect(rule('.ops-jump')).toMatch(/position:\s*sticky/);
  });
});

describe('a memo can be seen past', () => {
  it('holds a peek state', () => {
    expect(MEMO).toMatch(/const \[peeking, setPeeking\] = useState/);
  });

  it('is held down rather than toggled, by hand and by key', () => {
    expect(MEMO).toMatch(/onMouseDown/);
    expect(MEMO).toMatch(/onMouseUp|mouseup/);
    expect(MEMO).toMatch(/onTouchStart/);
    expect(MEMO).toMatch(/KeyP/);
  });

  it('puts the class on the backdrop and the stylesheet answers it', () => {
    expect(MEMO).toMatch(/memo-backdrop\s*\$\{|memo-backdrop peeking|peeking\s*\?\s*'memo-backdrop peeking'/);
    expect(rule('.memo-backdrop.peeking'), 'the peek rule has gone').toBeTruthy();
    expect(rule('.memo-backdrop.peeking .memo')).toMatch(/pointer-events:\s*none/);
  });

  it('still answers by number', () => {
    expect(MEMO).toMatch(/Number\(e\.key\) - 1/);
  });
});

describe('the docket says what is simmering on another tab', () => {
  it('reads the payroll cliff from the forecast the payday uses', () => {
    expect(BAR).toMatch(/payrollForecast/);
  });

  it('counts the grudges and names the heat', () => {
    expect(BAR).toMatch(/grievance/);
    expect(BAR).toMatch(/heatTier|tier\.name/);
  });

  it('jumps to the panel that owns each one', () => {
    expect(BAR).toMatch(/onGoto/);
  });

  it('has a strip to render into', () => {
    expect(rule('.docket'), '.docket has gone').toBeTruthy();
  });
});

describe('a roster row shows its own trouble', () => {
  it('accents the crew row it belongs to', () => {
    expect(CREW).toMatch(/rowAccent|row-threat|crewAccent/);
  });

  it('accents the fronts by how hard they are being leaned on', () => {
    expect(FRONTS).toMatch(/row-warn|row-ok|rowAccent/);
  });

  it('paints the gutter the way the selected row already does', () => {
    expect(rule('table.data tbody tr.row-threat td:first-child')).toMatch(/inset 4px 0 0/);
    expect(rule('table.data tbody tr.row-warn td:first-child')).toMatch(/inset 4px 0 0/);
    expect(rule('table.data tbody tr.row-ok td:first-child')).toMatch(/inset 4px 0 0/);
  });

  it('keeps the picked row winning over an accent', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(bare.indexOf('tr.row-threat td:first-child')).toBeLessThan(
      bare.indexOf('tr.selected td:first-child'),
    );
  });
});
