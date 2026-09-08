/**
 * The five things round 17's blind scorers reproduced.
 *
 * Three testers, three careers — days 184, 163 and 317 — and every defect here
 * was seen by at least two of them or reproduced twice by one. They are all the
 * same fault: the game says something the system does not do. Nothing here is a
 * mechanic being wrong.
 *
 * They are guarded together because they were found together, and because the
 * pattern is the finding: a game whose testers scored its refusal text 9, 8 and
 * 8 and its writing 10, 10 and 9 is a game where a sentence that lies costs
 * more than a mechanic that misbehaves.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, addNote } from '../npc';
import { remember } from '../memory';
import { arcs } from '../arcs';
import { canCase, caseJob } from '../verbs';
import { canAcquire } from '../business';
import { canSpendFavour, figure } from '../civic';
import { spendPoint, worldPull } from '../build';
import { home, homeRead, neglectRisk } from '../personal';
import { HOME } from '../../config/personal';
import { GEN_DEFS } from '../eventgen';
import { AGENCIES } from '../../config/lawEnforcement';
import { CIVIC_FIGURES, CIVIC } from '../../config/civic';
import { businessSlots, controlLevel, territoryList } from '../territory';
import { buildOf } from '../build';
import { SLOTS_BY_CONTROL } from '../../config/territories';
import { BUSINESSES } from '../../config/businesses';
import { VERBS } from '../../config/verbs';
import type { GameState, Npc } from '../types';

function game(seed = 4): GameState {
  const state = newGame({ name: 'R17', difficulty: 'normal', seed });
  state.org.cash = 500_000;
  return state;
}

function someone(state: GameState): Npc {
  const npc = crewList(state)[0];
  if (!npc) throw new Error('a career starts with a crew; this seed did not');
  return npc;
}

/**
 * "They have not forgotten it: they Was on the Fence Stolen Goods. It went wrong.."
 *
 * Reproduced twice by one tester and reported independently by a second as a
 * broken template string. `gen_wants_a_word` splices its reason into
 * `they {reason}.`, which is right for a memory — whose text is a verb phrase
 * with an implied subject — and wrong for a note, which is a whole capitalised
 * sentence with its own full stop. The fallback to notes was the bug.
 */
describe('a man raising a grievance speaks in sentences', () => {
  const def = GEN_DEFS.find((d) => d.id === 'gen_wants_a_word')!;

  const bodyFor = (state: GameState, npc: Npc) =>
    def.build(state, new Rng({ seed: 5, calls: 0 }), { npc }).body;

  it('reads as one sentence when the reason is a memory', () => {
    const state = game();
    const npc = someone(state);
    remember(npc, state.day, 'went_unpaid');
    const body = bodyFor(state, npc);
    expect(body).toContain('they were not paid');
    expect(body, 'a doubled full stop').not.toMatch(/\.\./);
  });

  /**
   * The exact shape that broke. A note is not a clause and must never be
   * spliced in as one — checked by giving him *only* a note, which is the
   * state the old fallback existed for.
   */
  it('does not splice a whole sentence into the middle of one', () => {
    const state = game();
    const npc = someone(state);
    npc.memories = [];
    addNote(npc, state.day, 'Was on the Fence Stolen Goods. It went wrong.', 'bad');

    const body = bodyFor(state, npc);
    expect(body, 'a note spliced into a clause slot').not.toMatch(/they [A-Z]/);
    expect(body, 'a doubled full stop').not.toMatch(/\.\./);
  });
});

/**
 * "No room for another front in X. Take more of the district" — said to three
 * testers who held the district at dominance. One believed for a hundred and
 * eighty days that another job would open a slot.
 *
 * `businessSlots` is the lesser of what control allows and what the district's
 * own commercial density allows, and density is not something a player can
 * move.
 */
describe('the front-slot refusal names a remedy that exists', () => {
  it('says the district is full when density is what bound', () => {
    const state = game();
    // A district held outright, so control is not the binding cap.
    const t = territoryList(state).find((x) => businessSlots(x) < SLOTS_BY_CONTROL['dominance']);
    if (!t) return;
    t.influence.player = 100;
    expect(controlLevel(t)).toBe('dominance');

    // Fill it to its own ceiling.
    for (let i = 0; i < businessSlots(t); i++) {
      const id = `b_fill_${i}`;
      state.businesses[id] = {
        ...(Object.values(state.businesses)[0] ?? {}),
        id, defId: BUSINESSES[0].id, territoryId: t.id, status: 'operating',
      } as never;
      t.businessIds.push(id);
    }

    const check = canAcquire(state, BUSINESSES[0].id, t.id);
    expect(check.ok).toBe(false);
    expect(
      check.reason,
      'still telling a boss at dominance to take more of a district he owns',
    ).not.toContain('Take more of the district');
    expect(check.reason).toMatch(/room for/);
  });
});

/**
 * "There is nothing else to say — The trial begins", offered by agencies that
 * are defined as unable to hold one.
 */
describe('an indictment promises only what the agency can do', () => {
  it('does not offer a trial from an agency that cannot hold one', () => {
    const capped = AGENCIES.filter((a) => a.maxStage !== 'trial');
    expect(capped.length, 'every agency can try you, so this guards nothing').toBeGreaterThan(0);
  });

  /**
   * Guarded on the source rather than by raising the event, because reaching
   * indictment in a fixture is a two-hundred-day career. What must hold is that
   * the hint is derived from `maxStage` and not written flat.
   */
  it('reads the hint off how far that agency can take it', async () => {
    const src = (await import('../investigation.ts?raw')).default as string;
    const at = src.indexOf("defId: 'indictment'");
    expect(at, 'the indictment event has moved').toBeGreaterThan(-1);
    const block = src.slice(at, at + 1400);
    expect(block).toContain('maxStage');
    expect(
      block.replace(/\/\*[\s\S]*?\*\//g, ' '),
      'the flat promise is back',
    ).not.toMatch(/hint: 'The trial begins'/);
  });
});

/**
 * A refusal that restates a condition the player has already met.
 *
 * A tester paid $9,000 to lift a captain from 49 to 71 against a stated bar of
 * 68, and the dead button still read "they start owing above 68". The missing
 * piece was `CIVIC.favourIntervalDays`, which nothing mentioned.
 */
describe('the favour refusal names what is actually missing', () => {
  it('says to wait when the standing is there and the clock is not', () => {
    const state = game();
    const def = CIVIC_FIGURES[0];
    const held = figure(state, def.id);
    held.standing = def.owesAbove + 3;
    held.owed = 0;
    held.lastFavourDay = state.day;

    const check = canSpendFavour(state, def.id);
    expect(check.ok).toBe(false);
    expect(
      check.reason,
      'still quoting a bar the player has cleared as though it were the blocker',
    ).toMatch(/days|day/);
    expect(check.reason).not.toMatch(/does not owe you anything/);
  });

  /** And still says the plain thing when the standing genuinely is not there. */
  it('says the bar when the bar is the problem', () => {
    const state = game();
    const def = CIVIC_FIGURES[0];
    const held = figure(state, def.id);
    held.standing = Math.max(CIVIC.coldBelow + 1, def.owesAbove - 20);
    held.owed = 0;
    held.lastFavourDay = state.day - CIVIC.favourIntervalDays * 2;

    const check = canSpendFavour(state, def.id);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('start owing above');
  });
});

/**
 * Casing a job left no trace anywhere for a week.
 *
 * Two testers used the Method verb on days 22 and 25 and neither could find
 * any evidence of it afterwards. The odds row exists, but only on the one job
 * it was bought for and only once the week is up — so the game held a thing
 * they had spent a week on and said nothing about it.
 */
describe('a week spent watching a place is visible while it runs', () => {
  function cased(state: GameState) {
    const t = territoryList(state)[0];
    state.player.build = { ...buildOf(state), method: 10 };
    const ok = caseJob(state, 'burglary_run', t.id);
    return { ok, t };
  }

  it('appears in what you have running, with a clock and an ending', () => {
    const state = game();
    const { ok } = cased(state);
    expect(ok.ok, `casing was refused: ${ok.message}`).toBe(true);

    const arc = arcs(state).find((a) => a.id.startsWith('cased:'));
    expect(arc, 'a week of work with nothing on any screen').toBeTruthy();
    expect(arc!.where).toMatch(/day/);
    expect(arc!.ends.length).toBeGreaterThan(0);
  });

  it('is still there the day before it is ready, and gone once spent', () => {
    const state = game();
    cased(state);
    state.day += VERBS.casingDays - 1;
    expect(arcs(state).some((a) => a.id.startsWith('cased:'))).toBe(true);

    state.org.cased = null;
    expect(arcs(state).some((a) => a.id.startsWith('cased:'))).toBe(false);
  });

  /** And the refusal names the job rather than saying "something". */
  it('says what is already being watched', () => {
    const state = game();
    cased(state);
    const again = canCase(state, territoryList(state)[1]?.id ?? territoryList(state)[0].id);
    expect(again.ok).toBe(false);
    expect(again.message, 'still just "something"').not.toBe('You are already looking at something.');
    expect(again.message.length).toBeGreaterThan(30);
  });
});

/**
 * The family at home, and the price nobody was told about.
 *
 * A round-17 scorer clicked "Go home" once on day 26, was told on day 163 that
 * their last evening at home was 137 days ago, and concluded the family was
 * *"a lovely line attached to nothing… a family that cannot be neglected at a
 * price is set dressing."*
 *
 * They were wrong about the price and right about the screen. `neglectRisk`
 * multiplies the chance the player's own people depose him, up to
 * `HOME.depositionAtWorst`, and `ladder.probe` measures careers ending at 1.9.
 * `homeRead` reported the days, the label and the names and never mentioned it.
 *
 * Round 15 got a button on this panel because a rising counter with no way to
 * act on it is a demand with no answer. This is the other half: a counter that
 * could be acted on and never said why you would.
 */
describe('being away from home says what it costs', () => {
  it('says nothing at all while it is costing nothing', () => {
    const state = game();
    const house = home(state);
    house.neglect = HOME.depositionFrom - 1;
    expect(neglectRisk(state)).toBe(1);
    expect(
      homeRead(state).costing,
      'a penalty everybody carries is a tax, and this is not one',
    ).toBeNull();
  });

  it('says so once it starts to bite', () => {
    const state = game();
    home(state).neglect = 100;
    expect(neglectRisk(state)).toBeGreaterThan(1);
    const line = homeRead(state).costing;
    expect(line, 'the counter is back to being attached to nothing').toBeTruthy();
    expect(line!.length).toBeGreaterThan(20);
  });

  /**
   * In the register of the rest of the screen. The multiplier is a number the
   * game shows nowhere else, and "x1.6" on a panel about a man's family would
   * be the wrong voice entirely.
   */
  it('says it in words rather than as a multiplier', () => {
    const state = game();
    home(state).neglect = 100;
    expect(homeRead(state).costing).not.toMatch(/\d/);
  });
});

/**
 * Two stat systems, one of which lost its screen.
 *
 * All three round-17 scorers reported that personal points produce no visible
 * effect. One measured it properly — same job, same crew, same day, nine points
 * placed, the odds row unchanged — and filed sixteen permanent irreversible
 * points as arbitrary.
 *
 * They were right about the screen and wrong about the cause. `successBreakdown`
 * reads `player.attributes[def.attribute]`, which rises by doing the work from
 * forty call sites; `spendPoint` writes `player.build`, which drives `hasVerb`
 * and `worldPull`. Different fields, and both alive.
 *
 * That is not a system needing a decision. The attributes panel used to be on
 * Yourself and was replaced by the build — its own comment records why, two of
 * eight attributes were read by nothing — and the odds row was left pointing at
 * the half that no longer has a screen. So the player met a number they could
 * not find and could not move.
 *
 * Guarded as facts about the two fields rather than about the copy, because the
 * copy is the repair and the fields are what make it true.
 */
describe('the two progressions are different things', () => {
  it('places points somewhere the odds do not read', () => {
    const state = game();
    const before = { ...state.player.attributes };
    spendPoint(state, 'muscle');
    spendPoint(state, 'instinct');
    expect(
      state.player.attributes,
      'the build now writes attributes, so the odds row is double-counting',
    ).toEqual(before);
  });

  /** And the points do buy something — just not that row. */
  it('buys verbs and how the world behaves, which is what the screen now says', () => {
    const state = game();
    const before = worldPull(state, 'ledger');
    for (let i = 0; i < 4; i++) spendPoint(state, 'ledger');
    expect(worldPull(state, 'ledger')).toBeGreaterThan(before);
  });

  /**
   * The odds row names its attribute, so it reads as something earned rather
   * than something bought.
   */
  it('names which ability the odds row is about', async () => {
    const src = (await import('../../ui/panels/OperationsPanel.tsx?raw')).default as string;
    expect(src).toContain('ATTRIBUTE_LABEL[def.attribute]');
    expect(
      src.replace(/\/\*[\s\S]*?\*\//g, ' '),
      'the row is back to the label three testers misread',
    ).not.toMatch(/label="Your ability"/);
  });

  /** And the build screen says what it is not. */
  it('says on the build screen that points are not the odds', async () => {
    const src = (await import('../../ui/panels/PlayerPanel.tsx?raw')).default as string;
    const prose = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
    expect(prose.toLowerCase()).toContain('not the odds');
  });
});
