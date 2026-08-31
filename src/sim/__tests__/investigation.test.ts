/**
 * Investigations.
 *
 * The property under test throughout: a case is caused by evidence the player
 * actually left, and can be starved by not leaving any more. Nothing here
 * should be reachable from a difficulty knob alone.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { grantPossession, heldPossessions } from '../possessions';
import { runDaysSolvent } from './helpers';
import { addEvidence } from '../util';
import { crewList } from '../npc';
import {
  activeCases,
  agencyOf,
  buyContact,
  canBuyContact,
  caseIntel,
  contactCost,
  destroyEvidence,
  hasContact,
  launderRestriction,
  looseEvidence,
  pressureWitness,
  readCase,
  retainLawyer,
  surveillancePenalty,
  tickInvestigations,
  weeklyLegalCost,
  worstStage,
} from '../investigation';
import { footprint } from '../investigation';
import {
  AGENCY_BY_ID,
  CASE_CLOSED_BELOW,
  COLD_CASE_AFTER_DAYS,
  EVIDENCE_DECAY_PER_WEEK,
  STAGES,
  stageIndex,
  type StageId,
} from '../../config/lawEnforcement';
import { CHANNEL_OF_SOURCE, HEAT_CHANNELS, type HeatChannel } from '../../config/heat';
import { setHeat, tickHeat } from '../heat';
import type { EvidenceTrace, GameState, Investigation } from '../types';

function fresh(seed = 606): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

/** Drops evidence of a given kind on the floor for somebody to find. */
function drop(
  state: GameState,
  source: EvidenceTrace['source'],
  strength: number,
  npcIds: string[] = [],
): void {
  addEvidence(state, {
    day: state.day,
    source,
    strength,
    npcIds,
    detail: 'test evidence',
  });
}

/** Runs `weeks` of law-enforcement ticks and nothing else. */
function runLaw(state: GameState, weeks: number, rng = new Rng(state.rng)): void {
  for (let i = 1; i <= weeks; i++) {
    state.day = i * 7;
    tickInvestigations(state, rng);
    if (state.gameOver) return;
  }
}

/**
 * Puts the organization at a level of heat of a particular kind.
 *
 * Assigning to `org.heat` stopped meaning anything when heat became three
 * channels — the total is recomputed from the parts. Every test that used to
 * do that now has to say what kind of trouble it is in, which is the point of
 * the split and turns out to make these tests read better.
 */
function heatAt(state: GameState, value: number, channel: HeatChannel = 'street'): void {
  for (const c of HEAT_CHANNELS) setHeat(state, c, 0);
  setHeat(state, channel, value);
}

/**
 * Makes the organization look at least `size` big from outside.
 *
 * Hires men until `footprint` clears the bar, because that is the only lever
 * here with no side effects on heat, money or evidence. Throws rather than
 * looping forever if it cannot get there, which is what would happen if the
 * weights in `footprint` ever changed underneath this.
 */
function bulkUp(state: GameState, size: number): void {
  const seed = Object.values(state.npcs)[0];
  if (!seed) throw new Error('a career starts with somebody');
  let n = 0;
  while (footprint(state) < size && n < 60) {
    const id = `bulk_${n++}`;
    state.npcs[id] = { ...seed, id, name: `Hand ${n}`, stats: { ...seed.stats } };
  }
  // Bodies alone cap out well below what the federal desk needs, which is the
  // point of counting four things rather than one.
  for (const t of Object.values(state.territories)) {
    if (footprint(state) >= size) break;
    t.influence.player = Math.max(t.influence.player ?? 0, 40);
  }
  if (footprint(state) < size) {
    throw new Error(`cannot make this organization look ${size} big any more`);
  }
}

/** Forces a case into existence so stage behaviour can be tested directly. */
function openCaseFor(state: GameState, agencyId: string, strength = 40): Investigation {
  const agency = AGENCY_BY_ID[agencyId];
  heatAt(state, agency.heatFloor + 5, CHANNEL_OF_SOURCE[agency.focus[0]]);
  // Agencies only take an interest in organizations of a certain size, and
  // size is bodies, ground, fronts and paper rather than a rank — so the setup
  // has to hire people rather than award a promotion.
  bulkUp(state, agency.noticesAbove);
  drop(state, agency.focus[0], agency.openThreshold + 10);
  runLaw(state, 1);
  const found = activeCases(state).find((c) => c.agencyId === agencyId)!;
  found.strength = strength;
  return found;
}

// --------------------------------------------------------------- opening ---

describe('opening a case', () => {
  it('opens nothing against a player who has left nothing behind', () => {
    const state = fresh();
    heatAt(state, 90); // loud, but with no evidence to work from
    runLaw(state, 20);
    expect(activeCases(state)).toHaveLength(0);
  });

  it('opens nothing while the player is beneath an agency’s notice', () => {
    const state = fresh();
    heatAt(state, 0);
    drop(state, 'operation', 200);
    runLaw(state, 20);
    expect(activeCases(state)).toHaveLength(0);
  });

  it('opens a case once there is enough of the right kind of evidence', () => {
    const state = fresh();
    heatAt(state, 40);
    drop(state, 'violence', 30);
    runLaw(state, 2);

    const cases = activeCases(state);
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.some((c) => c.agencyId === 'city_police')).toBe(true);
  });

  it('sends the right agency after the right kind of evidence', () => {
    const financial = fresh();
    heatAt(financial, 45, 'money');
    // Financial Crimes need a real target — an organization with something
    // worth auditing rather than a man with a rank.
    bulkUp(financial, AGENCY_BY_ID.treasury.noticesAbove);
    drop(financial, 'finance', 60);
    runLaw(financial, 2);
    // Financial Crimes care about the books; City Police do not.
    expect(activeCases(financial).some((c) => c.agencyId === 'treasury')).toBe(true);
    expect(activeCases(financial).some((c) => c.agencyId === 'city_police')).toBe(false);
  });

  it('notices what you have built, not what you are called', () => {
    /*
       The whole reason the gate stopped being a rank.

       A rank in this game is a conjunction of five requirements and moves at
       the speed of the slowest, so an organization of thirty men holding half
       the city with nothing laundered stayed an Enforcer — and the Task Force
       could not see it. Meanwhile a small, tidy, well-laundered outfit could be
       a Capo and pull a federal ceiling over four men.

       These two states are deliberately each other's opposite on exactly that
       axis, and the agency has to follow the organization rather than the
       title.
    */
    const big = fresh();
    big.player.rank = 'street_criminal';
    const seed = Object.values(big.npcs)[0]!;
    for (let i = 0; i < 30; i++) {
      const id = `hand_${i}`;
      big.npcs[id] = { ...seed, id, name: `Hand ${i}`, stats: { ...seed.stats } };
    }
    for (const t of Object.values(big.territories)) t.influence.player = 45;

    const small = fresh();
    small.player.rank = 'boss';

    expect(footprint(big)).toBeGreaterThan(AGENCY_BY_ID.state_taskforce.noticesAbove);
    expect(footprint(small)).toBeLessThan(AGENCY_BY_ID.state_taskforce.noticesAbove);

    for (const state of [big, small]) {
      heatAt(state, 45, CHANNEL_OF_SOURCE.operation);
      drop(state, 'operation', 80);
      runLaw(state, 2);
    }

    expect(
      activeCases(big).some((c) => c.agencyId === 'state_taskforce'),
      'thirty men and half the city, and nobody came',
    ).toBe(true);
    expect(
      activeCases(small).some((c) => c.agencyId === 'state_taskforce'),
      'a task force convened over a man with a title',
    ).toBe(false);
  });

  it('takes the evidence off the floor when it opens', () => {
    const state = fresh();
    heatAt(state, 40);
    drop(state, 'violence', 40);
    expect(looseEvidence(state)).toBeGreaterThan(0);

    runLaw(state, 1);
    expect(looseEvidence(state)).toBe(0);
    expect(activeCases(state)[0].strength).toBeGreaterThan(0);
  });

  it('does not open a second case for the same agency', () => {
    const state = fresh();
    heatAt(state, 50);
    drop(state, 'violence', 60);
    runLaw(state, 10);
    const police = activeCases(state).filter((c) => c.agencyId === 'city_police');
    expect(police.length).toBeLessThanOrEqual(1);
  });

  it('names the people the evidence pointed at', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    heatAt(state, 40);
    drop(state, 'violence', 40, [npc.id]);
    runLaw(state, 1);
    expect(activeCases(state)[0].suspectIds).toContain(npc.id);
  });
});

// -------------------------------------------------------------- evidence ---

describe('evidence', () => {
  it('goes cold on its own if nobody ever picks it up', () => {
    const state = fresh();
    heatAt(state, 0); // nobody is interested
    drop(state, 'operation', 20);
    const before = looseEvidence(state);

    runLaw(state, 40);
    expect(looseEvidence(state)).toBeLessThan(before);
  });

  it('is eventually forgotten entirely', () => {
    const state = fresh();
    heatAt(state, 0);
    drop(state, 'operation', 4);
    runLaw(state, 60);
    expect(Object.keys(state.evidence)).toHaveLength(0);
  });

  it('fades slower once a case is holding it, but it does fade', () => {
    /*
       This asserted the strength was unchanged, and that was the bug.

       `decayEvidence` skipped any trace with `attachedTo.length > 0`, so a
       trace a case had picked up was immortal — released only by `closeCase`,
       which fired once in 795 cases. Measured, **98 of 98 surviving traces
       were held**, which made the pile a permanent archive: an agency opening
       a file in year four absorbed year-one evidence at its original strength.

       The intent behind it is sound and lives in `closeCase` — the trail dies
       with the case — but it only holds in a game where cases end. Held
       evidence now fades at `EVIDENCE_HELD_DECAY_SCALE` of the loose rate,
       because somebody is keeping it warm rather than because it is preserved.
    */
    const state = fresh();
    heatAt(state, 40);
    drop(state, 'violence', 40);
    runLaw(state, 2);
    const attached = Object.values(state.evidence).filter((e) => e.attachedTo.length > 0);
    expect(attached.length).toBeGreaterThan(0);
    const strength = attached[0].strength;

    runLaw(state, 20);
    const after = state.evidence[attached[0].id]?.strength ?? 0;
    expect(after, 'a trace in an open file never weakens, however old it gets').toBeLessThan(
      strength,
    );

    // ...and slower than one nobody is working. Twenty weeks at the loose rate
    // would take eleven points off; somebody has this one on their desk.
    expect(strength - after).toBeLessThan(EVIDENCE_DECAY_PER_WEEK * 20);
  });
});

// -------------------------------------------------------------- progress ---

describe('a case in progress', () => {
  it('builds strength week by week', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'city_police', 20);
    const before = investigation.strength;
    heatAt(state, 60);
    runLaw(state, 4, new Rng(state.rng));
    expect(investigation.strength).toBeGreaterThan(before);
  });

  it('walks the stages in order and never skips one', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'federal_bureau', 10);
    heatAt(state, 80);

    const seen: StageId[] = [investigation.stage];
    const rng = new Rng(state.rng);
    for (let week = 1; week <= 120 && !state.gameOver; week++) {
      state.day = week * 7;
      tickInvestigations(state, rng);
      const last = seen[seen.length - 1];
      if (investigation.stage !== last) seen.push(investigation.stage);
    }

    for (let i = 1; i < seen.length; i++) {
      expect(stageIndex(seen[i])).toBe(stageIndex(seen[i - 1]) + 1);
    }
    expect(seen.length).toBeGreaterThan(2);
  });

  it('will not take a case further than the agency can reach', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'city_police', 95);
    heatAt(state, 95);
    runLaw(state, 90);

    // City Police top out at arrests — they cannot indict anybody.
    expect(stageIndex(investigation.stage)).toBeLessThanOrEqual(stageIndex('arrests'));
    expect(state.gameOver).toBeNull();
  });

  it('loses momentum and closes when the player stops feeding it', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'city_police', 10);
    // Absolutely quiet: no heat, no new evidence.
    heatAt(state, 0);
    runLaw(state, 60);

    expect(['cold', 'closed']).toContain(investigation.status);
  });

  it('keeps case strength inside 0..100 under sustained pressure', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'federal_bureau', 50);
    heatAt(state, 100);
    const rng = new Rng(state.rng);
    for (let week = 1; week <= 200 && !state.gameOver; week++) {
      state.day = week * 7;
      drop(state, 'operation', 20);
      tickInvestigations(state, rng);
      expect(investigation.strength).toBeGreaterThanOrEqual(0);
      expect(investigation.strength).toBeLessThanOrEqual(100);
    }
  });
});

// --------------------------------------------------------- consequences ---

describe('what a case does to you', () => {
  it('makes operations harder once they are watching', () => {
    const state = fresh();
    expect(surveillancePenalty(state)).toBe(0);
    const investigation = openCaseFor(state, 'city_police');
    investigation.stage = 'surveillance';
    expect(surveillancePenalty(state)).toBeGreaterThan(0);
  });

  it('chokes the laundering pipeline once they are in the books', () => {
    const state = fresh();
    expect(launderRestriction(state)).toBe(1);
    const investigation = openCaseFor(state, 'treasury');
    investigation.stage = 'financial';
    expect(launderRestriction(state)).toBeLessThan(1);
  });

  it('takes money when a warrant lands', () => {
    const state = fresh();
    state.org.cash = 500_000;
    const investigation = openCaseFor(state, 'city_police', 70);
    investigation.stage = 'arrests'; // one before warrants going backwards
    investigation.stage = 'witnesses';
    investigation.stageSince = 0;
    investigation.strength = 70;
    state.day = 700;

    const before = state.org.cash + state.org.dirtyCash;
    const rng = new Rng(state.rng);
    // Walk it forward to warrants.
    for (let i = 0; i < 40 && stageIndex(investigation.stage) < stageIndex('warrants'); i++) {
      state.day += 7;
      investigation.strength = 80;
      tickInvestigations(state, rng);
    }
    expect(stageIndex(investigation.stage)).toBeGreaterThanOrEqual(stageIndex('warrants'));
    expect(state.org.cash + state.org.dirtyCash).toBeLessThan(before);
  });

  /*
     The wiring, not the unit.

     `possessions.test.ts` proves `seizeOnePossession` takes the best thing in
     the house, and that test stayed green when the call was cut out of the
     warrants stage entirely — the unit worked and nothing reached it. That is
     the project's recurring failure mode wearing its most ordinary costume, so
     the claim is made here, where a case can actually be walked to a warrant.
  */
  it('takes the boss\'s own things when a warrant lands', () => {
    const state = fresh();
    state.org.cash = 500_000;
    expect(grantPossession(state, new Rng(state.rng), 'roadster')).toBeTruthy();
    expect(heldPossessions(state).length).toBe(1);

    const investigation = openCaseFor(state, 'city_police', 70);
    investigation.stage = 'witnesses';
    investigation.stageSince = 0;
    investigation.strength = 70;
    state.day = 700;

    const rng = new Rng(state.rng);
    for (let i = 0; i < 40 && stageIndex(investigation.stage) < stageIndex('warrants'); i++) {
      state.day += 7;
      investigation.strength = 80;
      tickInvestigations(state, rng);
    }
    expect(stageIndex(investigation.stage)).toBeGreaterThanOrEqual(stageIndex('warrants'));
    expect(heldPossessions(state)).toEqual([]);
    // And it is on the case record, not only in the log.
    expect(investigation.history.some((h) => /italian car/i.test(h.text))).toBe(true);
  });

  it('reports the furthest any live case has got', () => {
    const state = fresh();
    expect(worstStage(state)).toBeNull();
    const investigation = openCaseFor(state, 'city_police');
    investigation.stage = 'witnesses';
    expect(worstStage(state)).toBe('witnesses');
  });
});

// ---------------------------------------------------------- counterplay ---

describe('counterplay', () => {
  it('charges nothing for representation you have not hired', () => {
    const state = fresh();
    expect(weeklyLegalCost(state)).toBe(0);
  });

  it('charges more the better the lawyer and the bigger the case load', () => {
    const state = fresh();
    retainLawyer(state, 'local');
    const quiet = weeklyLegalCost(state);
    openCaseFor(state, 'federal_bureau');
    const busy = weeklyLegalCost(state);
    expect(busy).toBeGreaterThan(quiet);

    retainLawyer(state, 'best');
    expect(weeklyLegalCost(state)).toBeGreaterThan(busy);
  });

  it('slows a case down when you are represented', () => {
    const build = (level: 'none' | 'best') => {
      const state = fresh(4242);
      const investigation = openCaseFor(state, 'federal_bureau', 20);
      retainLawyer(state, level);
      heatAt(state, 70);
      runLaw(state, 8, new Rng({ seed: 1, calls: 0 }));
      return investigation.strength;
    };
    expect(build('best')).toBeLessThan(build('none'));
  });

  it('will not sell you a federal contact on street credibility alone', () => {
    const state = fresh();
    state.org.cash = 5_000_000;
    state.player.attributes.influence = 0;
    expect(canBuyContact(state, 'federal_bureau').ok).toBe(false);
    // The local force is a different matter.
    expect(canBuyContact(state, 'city_police').ok).toBe(true);
  });

  it('gives you sight of a case once you have somebody inside', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'city_police');
    const blind = readCase(state, investigation);
    expect(blind.strength).toBe('unknown');

    state.org.cash = 500_000;
    expect(buyContact(state, 'city_police').ok).toBe(true);
    expect(hasContact(state, 'city_police')).toBe(true);

    const informed = readCase(state, investigation);
    expect(informed.strength).not.toBe('unknown');
    expect(informed.stageName).not.toBeNull();
  });

  it('makes a contact cheaper the more pull you have', () => {
    const state = fresh();
    const plain = contactCost(state, 'city_police');
    state.player.attributes.influence = 20;
    expect(contactCost(state, 'city_police')).toBeLessThan(plain);
  });

  it('turns a burned contact into evidence against you', () => {
    const state = fresh();
    state.org.cash = 500_000;
    buyContact(state, 'city_police');
    const contact = state.law.contacts['city_police'];

    // Force the discovery rather than waiting on a 1.2% weekly roll.
    contact.burned = false;
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    runLaw(state, 1);
    // Unable to pay, the arrangement ends.
    expect(state.law.contacts['city_police'].burned).toBe(true);
  });

  it('either removes evidence or makes the case worse', () => {
    const state = fresh();
    state.org.cash = 500_000;
    const investigation = openCaseFor(state, 'city_police', 50);
    const before = investigation.strength;

    const result = destroyEvidence(state, new Rng({ seed: 5, calls: 0 }), investigation.id);
    if (result.ok) expect(investigation.strength).toBeLessThan(before);
    else expect(investigation.strength).toBeGreaterThan(before);
  });

  it('either quiets a witness or hands them a reason to talk', () => {
    const state = fresh();
    state.org.cash = 500_000;
    const npc = crewList(state)[0];
    const investigation = openCaseFor(state, 'city_police', 50);
    investigation.suspectIds = [npc.id];
    const before = investigation.strength;

    const result = pressureWitness(
      state,
      new Rng({ seed: 9, calls: 0 }),
      investigation.id,
      npc.id,
    );
    if (result.ok) {
      expect(investigation.strength).toBeLessThan(before);
      expect(investigation.suspectIds).not.toContain(npc.id);
    } else {
      expect(investigation.strength).toBeGreaterThan(before);
    }
  });

  it('refuses counterplay the player cannot pay for', () => {
    const state = fresh();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    const investigation = openCaseFor(state, 'city_police', 40);
    expect(destroyEvidence(state, new Rng(state.rng), investigation.id).ok).toBe(false);
    expect(state.org.cash).toBe(0);
  });
});

// ----------------------------------------------------------------- trial ---

describe('trial', () => {
  it('is the one thing that can end the player', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'federal_bureau', 100);
    investigation.stage = 'trial';
    investigation.stageSince = state.day;
    investigation.suspectIds = crewList(state).map((n) => n.id);
    retainLawyer(state, 'none');

    // A maximal case with no defence should convict on almost any roll.
    // Investigations tick weekly, so the clock has to land on a payday.
    state.day += 35;
    tickInvestigations(state, new Rng({ seed: 3, calls: 0 }));

    expect(investigation.status).toBe('resolved');
    expect(investigation.verdict).not.toBeNull();
    if (investigation.verdict === 'convicted') {
      expect(state.gameOver).not.toBeNull();
    }
  });

  it('lets a well-defended player walk', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'federal_bureau', 40);
    investigation.stage = 'trial';
    investigation.stageSince = state.day;
    investigation.suspectIds = [];
    state.org.cash = 5_000_000;
    retainLawyer(state, 'best');
    state.player.attributes.influence = 20;
    buyContact(state, 'federal_bureau');

    // Investigations tick weekly, so the clock has to land on a payday.
    state.day += 35;
    tickInvestigations(state, new Rng({ seed: 11, calls: 0 }));

    expect(investigation.verdict).toBe('acquitted');
    expect(state.gameOver).toBeNull();
  });
});

// ------------------------------------------------------------ invariants ---

describe('investigations do not break the world', () => {
  it('survives a long reckless game without corrupting state', () => {
    const state = fresh(8080);
    const rng = new Rng(state.rng);

    for (let day = 0; day < 700 && !state.gameOver; day++) {
      state.day = day + 1;
      if (day % 5 === 0) drop(state, 'operation', 6);
      if (day % 11 === 0) drop(state, 'finance', 5);
      heatAt(state, 70);
      tickInvestigations(state, rng);

      for (const c of Object.values(state.law.investigations)) {
        expect(Number.isFinite(c.strength)).toBe(true);
        expect(c.strength).toBeGreaterThanOrEqual(0);
        expect(c.strength).toBeLessThanOrEqual(100);
        for (const id of c.suspectIds) expect(state.npcs[id]).toBeDefined();
      }
      for (const trace of Object.values(state.evidence)) {
        expect(trace.strength).toBeGreaterThan(0);
        for (const caseId of trace.attachedTo) {
          expect(state.law.investigations[caseId]).toBeDefined();
        }
      }
    }
  });

  it('stays deterministic with law enforcement active', () => {
    const a = fresh(1357);
    const b = fresh(1357);
    runDaysSolvent(a, 300);
    runDaysSolvent(b, 300);
    expect(JSON.stringify(a.law)).toEqual(JSON.stringify(b.law));
    expect(JSON.stringify(a.evidence)).toEqual(JSON.stringify(b.evidence));
  });

  it('shows nothing about a case the player has no way of knowing', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'treasury');
    const read = readCase(state, investigation);
    expect(caseIntel(state, investigation)).toBe(0);
    expect(read.stageName).toBeNull();
    expect(read.suspects).toBeNull();
    expect(read.strength).toBe('unknown');
  });

  it('cannot hide a raid, whatever the player knows', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'city_police');
    investigation.stage = 'arrests';
    expect(readCase(state, investigation).stageName).not.toBeNull();
  });

  it('never leaves an agency working a case it already closed', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'city_police', 8);
    heatAt(state, 0);
    runLaw(state, 80);
    if (investigation.status === 'closed') {
      const stillHeld = Object.values(state.evidence).filter((e) =>
        e.attachedTo.includes(investigation.id),
      );
      expect(stillHeld).toHaveLength(0);
    }
  });
});

describe('agencies', () => {
  it('exposes a definition for every case', () => {
    const state = fresh();
    const investigation = openCaseFor(state, 'state_taskforce');
    expect(agencyOf(investigation)).toBeDefined();
    expect(agencyOf(investigation).name).toBeTruthy();
  });

  it('defines every stage in the design', () => {
    expect(STAGES.map((s) => s.id)).toEqual([
      'suspicion',
      'intelligence',
      'surveillance',
      'witnesses',
      'financial',
      'warrants',
      'arrests',
      'indictment',
      'trial',
    ]);
  });
});

/**
 * The heat an ordinary career sits at, measured — median 49 across 74,585
 * career-days after the heat work. The tests below run here rather than at
 * zero, because a starvation mechanic that only works for a family generating
 * no attention whatsoever is not a counterplay, it is a technicality.
 */
const ORDINARY_HEAT = 50;

/*
   The file that never closed.

   Measured over 17,051 case-weeks: mean open case strength 94.6 of 100, every
   career peaking at 100, and **one case closed by decay against 795 opened**.
   Inflow beat outflow 62 to 1.

   The starvation mechanic was not missing. It fired on 13% of case-weeks and
   the case got *stronger* in 90.4% of them:

       their own work      +1.61
       being visibly loud  +2.07   ungated by momentum
       decay               -1.80
                           ------
       net                 +1.88

   See `docs/specs/2026-08-24-evidence-design.md`.
*/
describe('starving a case', () => {
  it('gives them nothing from ambient attention once the trail is cold', () => {
    /*
       `work` was multiplied by `momentum` and `visibility` was not, so the one
       term a player could not starve was the term standing for *why they are
       looking* rather than anything they found. At 2.07 a week it beat the
       cold-case decay on its own.
    */
    const state = fresh();
    const c = openCaseFor(state, 'city_police', 50);
    heatAt(state, ORDINARY_HEAT, 'street');
    c.lastProgressDay = state.day - COLD_CASE_AFTER_DAYS - 1;
    const before = c.strength;

    runLaw(state, 1);

    expect(
      c.strength,
      `a cold case at heat ${ORDINARY_HEAT} still gained on ambient attention alone`,
    ).toBeLessThan(before);
  });

  it('takes more off a strong file than a weak one', () => {
    /*
       `COLD_CASE_DECAY_PER_WEEK` was a flat 1.80, so a file at 100 shed what a
       file at 10 shed, and the cases a player most needs to starve were
       proportionally the hardest to kill: 52 weeks of perfect silence from 100
       down to `CASE_CLOSED_BELOW`. The same defect the heat meter had, and the
       same repair.
    */
    const shed = (at: number): number => {
      const state = fresh();
      const c = openCaseFor(state, 'city_police', at);
      heatAt(state, ORDINARY_HEAT, 'street');
      c.lastProgressDay = state.day - COLD_CASE_AFTER_DAYS - 1;
      const before = c.strength;
      runLaw(state, 1);
      return before - c.strength;
    };

    const strong = shed(90);
    const weak = shed(20);
    expect(
      strong,
      `a file at 90 shed ${strong.toFixed(2)}, one at 20 shed ${weak.toFixed(2)}`,
    ).toBeGreaterThan(weak);
  });

  it('closes a file on a family that has gone quiet for a year', () => {
    /*
       The claim the whole system is built to make, and the one it could not
       keep: nothing new, nothing loud, for long enough, and the file goes in a
       drawer.

       A year is the horizon, and it is not an arbitrary one — at
       `COLD_CASE_DECAY_SHARE` a file at 60 reaches `CASE_CLOSED_BELOW` in
       about forty-one weeks of total silence. Before this change the same
       forty weeks took it from 60 to **89**.

       Heat decays as the family stays quiet, because that is what going quiet
       means — an earlier draft of this pinned heat at a constant and was
       asking the case to die while the street was still talking about you.

       Starved specifically, not resolved. A case that reaches indictment and
       goes to trial also ends up `closed`, so asserting the status alone
       passes on the opposite of what this is about — which it did, before this
       comment was written.
    */
    const state = fresh();
    const c = openCaseFor(state, 'city_police', 60);
    heatAt(state, ORDINARY_HEAT, 'street');
    c.lastProgressDay = state.day - COLD_CASE_AFTER_DAYS - 1;

    const rng = new Rng(state.rng);
    for (let week = 1; week <= 52 && c.strength >= CASE_CLOSED_BELOW; week++) {
      for (let d = 0; d < 7; d++) {
        state.day += 1;
        state.org.quietDays += 1;
        tickHeat(state);
      }
      tickInvestigations(state, rng);
    }

    expect(
      c.strength,
      `after a year of quiet the file still holds ${c.strength.toFixed(1)}`,
    ).toBeLessThan(CASE_CLOSED_BELOW);
  });
});
