/**
 * Eight systems that ran with nobody able to reach them.
 *
 * Phases 1 to 4 shipped tribute envelopes, autonomous delegation, the failing
 * capo, the doctrine, the cul-de-sac, the sanctuary, the boiler room and the
 * Florida account — all of them ticking every week, all of them asserted by
 * their own unit tests, and not one of them with a control on any screen. The
 * simulation was complete and the game did not contain it.
 *
 * That is the same failure `discoverable.test.ts` was written for and this
 * file is deliberately in its idiom: it guards the *route* rather than the
 * screen. A test that called `resolveLightEnvelope` and asserted the money
 * moved would have passed throughout, because the money always moved — what
 * was missing was a button.
 *
 * Two properties, and the second is the one that keeps this honest.
 *
 * **The verb is wired to a click.** Not merely imported: an import with no
 * call site is exactly what a half-finished panel leaves behind, and a bare
 * `includes` would be satisfied by one. The check looks for the name inside an
 * `onClick`.
 *
 * **The commentary does not count.** Every repair in this project is explained
 * in a comment directly above the code that makes it, and those comments name
 * the functions they are about — so a guard run against raw source would be
 * satisfied by its own justification. `prose.test.ts` learned this the same
 * way. The source is stripped of comments before anything is asserted on it.
 */
import { describe, expect, it } from 'vitest';

import operations from '../panels/OperationsPanel.tsx?raw';
import crew from '../panels/CrewPanel.tsx?raw';
import player from '../panels/PlayerPanel.tsx?raw';
import finances from '../panels/FinancesPanel.tsx?raw';
import businesses from '../panels/BusinessesPanel.tsx?raw';
import rivals from '../panels/RivalsPanel.tsx?raw';
import law from '../panels/LawPanel.tsx?raw';

/** The file with its commentary taken out. See the header. */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const PANELS: Record<string, string> = {
  'OperationsPanel.tsx': code(operations),
  'CrewPanel.tsx': code(crew),
  'PlayerPanel.tsx': code(player),
  'FinancesPanel.tsx': code(finances),
  'BusinessesPanel.tsx': code(businesses),
  'RivalsPanel.tsx': code(rivals),
  'LawPanel.tsx': code(law),
};

/**
 * Whether a handler on this panel actually calls the verb.
 *
 * Not anchored on `onClick` directly, and the first version was, which failed
 * on two controls that are genuinely wired: the doctrine goes through a
 * two-line `declare` helper and the pitch goes through an `onDelegate` prop,
 * the same shape `onApprove` and `onReject` have always had on that card. An
 * anchor that forces every call site to be inline is a test about how the
 * file is factored rather than about whether the player can reach the system.
 *
 * What it asks instead is that the verb is **called from inside a callback**.
 * That is the whole of the defect being guarded — a panel that imports a verb
 * and never invokes it is exactly what a half-finished screen leaves behind,
 * and a panel does not run simulation logic for any reason other than a
 * control. The `=>` within 120 characters is what separates a call from a
 * top-level read.
 */
function clickCalls(panel: string, verb: string): boolean {
  return new RegExp(`=>[\\s\\S]{0,120}?\\b${verb}\\(`).test(panel);
}

/** Whether the panel reads the verb at all, wired to a click or not. */
function reads(panel: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(panel);
}

/* Every decision Phases 1-4 built, and the screen it has to be decidable on. */
const ACTIONS: [system: string, panel: string, verb: string][] = [
  ['a light envelope', 'OperationsPanel.tsx', 'resolveLightEnvelope'],
  ['handing a pitch to the capo who brought it', 'OperationsPanel.tsx', 'delegatePitchAutonomous'],
  ['what happens to the capo who is going', 'CrewPanel.tsx', 'assignDementiaCare'],
  ['saying what kind of thing this is', 'PlayerPanel.tsx', 'setDoctrine'],
  ['a favour for a neighbour', 'PlayerPanel.tsx', 'requestSuburbanFavour'],
  ['buying somewhere that is not work', 'PlayerPanel.tsx', 'buyPetProject'],
  ['an evening there', 'PlayerPanel.tsx', 'visitPetProject'],
  ['clearing the crew out of it', 'PlayerPanel.tsx', 'sanitizePetProject'],
  ['moving money somewhere else', 'FinancesPanel.tsx', 'siphonToFlorida'],
  ['leaving', 'FinancesPanel.tsx', 'retireToFlorida'],
  ['the floor', 'BusinessesPanel.tsx', 'runBoilerRoom'],
  /*
     Phase 6. Both of these were systems with nobody able to reach them in
     exactly the sense this file was written for: `openContract` had taken a
     `method` since tradecraft shipped and no caller ever passed one, and
     `SPECIAL_VENTURES` was two priced entries with no route to either.
  */
  ['buying the place with your name on the door', 'BusinessesPanel.tsx', 'acquireSpecialVenture'],
];

/* And the things that are a reading rather than a decision. */
const READS: [what: string, panel: string, name: string][] = [
  ['who is actually earning', 'CrewPanel.tsx', 'capoTributeLeaderboard'],
  ['which envelopes came up light', 'OperationsPanel.tsx', 'pendingEnvelopes'],
  ['who is going', 'CrewPanel.tsx', 'failingCapos'],
  ['who is paying for the hour', 'PlayerPanel.tsx', 'hasHealthInsurance'],
  ['whether anybody is knocking on ordinary doors', 'PlayerPanel.tsx', 'civiliansAreBeingQuestioned'],
  ['what is in the account down there', 'FinancesPanel.tsx', 'floridaState'],
  ['the covers with a name on them', 'BusinessesPanel.tsx', 'SPECIAL_VENTURES'],
  ['what it would take to buy one', 'BusinessesPanel.tsx', 'canAcquireSpecialVenture'],
];

/**
 * How the order gets said, on both screens that send somebody.
 *
 * A toggle rendered and never read would satisfy a bare `includes`, so this
 * asks for the two halves separately: the control is on the screen, and the
 * value it holds reaches `openContract`. That call is the only place the
 * choice can possibly take effect — it is where `transmitOrder` runs.
 */
const SENDS: [panel: string][] = [['RivalsPanel.tsx'], ['LawPanel.tsx']];

describe('every system built in phases 1-4 has a way in', () => {
  it('is reading the panels it asserts about', () => {
    /*
       The guard on the instrument. A `?raw` import that silently resolved to
       an empty string would make every check below vacuous, which is the
       mistake `tableWidth.test.ts` shipped once and caught the same way.
    */
    for (const [name, src] of Object.entries(PANELS)) {
      expect(src.length, `${name} came back empty`).toBeGreaterThan(4_000);
      expect(src, `${name} is all comment`).toContain('onClick=');
    }
  });

  it.each(ACTIONS)('lets the player decide about %s', (_system, panel, verb) => {
    expect(
      clickCalls(PANELS[panel], verb),
      `${verb} is not wired to a button on ${panel} — the system runs and nobody can reach it`,
    ).toBe(true);
  });

  it.each(READS)('shows %s', (_what, panel, name) => {
    expect(reads(PANELS[panel], name), `${panel} no longer reads ${name}`).toBe(true);
  });
});

/**
 * Rule 4, on the controls this round added.
 *
 * `refusalShown.test.ts` holds the same line for the buy table, the witness
 * contract and the poach offer, and every one of those was a repair rather
 * than a design — the reason a control was refused lived in a `title`, which
 * is a thing you find by already suspecting it is there. Every new gate below
 * prints its own refusal as text beside the button.
 */
describe('the tradecraft choice reaches the contract', () => {
  it.each(SENDS)('%s renders the selector', (panel) => {
    expect(PANELS[panel]).toContain('<TradecraftToggle');
    expect(PANELS[panel]).toMatch(/useState<TransmissionMethod>\('phone_euphemism'\)/);
  });

  it.each(SENDS)('%s passes the chosen method into openContract', (panel) => {
    expect(PANELS[panel]).toMatch(/openContract\([^)]*\bmethod\b[^)]*\)/);
  });
});

describe('a refusal you can read without hovering', () => {
  it('says why a favour cannot be asked for, on the row that refused it', () => {
    expect(PANELS['PlayerPanel.tsx']).toMatch(
      /\{!can\.ok && <div className="tiny faint">\{can\.reason\}<\/div>\}/,
    );
  });

  it('says why the sanctuary cannot be bought or swept', () => {
    expect(PANELS['PlayerPanel.tsx']).toMatch(/\{can\.message\}/);
    expect(PANELS['PlayerPanel.tsx']).toMatch(/\{why\}/);
  });

  it('says why the doctrine cannot be changed yet', () => {
    expect(PANELS['PlayerPanel.tsx']).toMatch(/locked !== null && \(/);
  });

  it('says why the floor cannot be opened, and why a venture cannot be bought', () => {
    expect(PANELS['BusinessesPanel.tsx']).toMatch(/\{can\.reason\}/);
    expect(PANELS['BusinessesPanel.tsx']).toMatch(
      /\{!can\.ok && <div className="tiny faint">\{can\.reason\}<\/div>\}/,
    );
  });

  it('says why a capo cannot be looked at', () => {
    expect(PANELS['OperationsPanel.tsx']).toMatch(/!auditable && \(/);
  });

  it('always says how far the retirement is from being possible', () => {
    // Not conditional on the refusal: the message is the distance, and a boss
    // building toward it needs the figure on the screen every week.
    expect(PANELS['FinancesPanel.tsx']).toMatch(/\{leaving\.message\}/);
  });
});
