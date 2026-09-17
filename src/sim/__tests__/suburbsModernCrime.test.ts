/**
 * The dual life: a plan, a street of civilians, and somewhere that is not work.
 *
 * Three systems, and what is worth pinning down is not the arithmetic but the
 * five facts the design rests on:
 *
 * 1. **The plan buys the calendar back, and it has to be earned.** An insured
 *    boss reads exactly zero on the `aging` line. An uninsured one does not,
 *    and no amount of money changes that — the routes in are a union local or
 *    a real payroll.
 * 2. **The cardiologist clears more per night.** The evening is the scarce
 *    resource, not the fee, which is why the covered visit costs more and is
 *    still the better deal.
 * 3. **A favour is good for you and it compromises a civilian.** Both halves
 *    in the same call, or the feature is a free standing shop.
 * 4. **Civilians fold, and they fold once.** Under questioning only, into a
 *    real case, and never twice.
 * 5. **The quiet place stops being quiet.** Contagion eats the relief before
 *    it ever gets anybody raided, and the sweep that fixes it is paid for in
 *    what the captains think.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { figure } from '../civic';
import { advanceDay } from '../clock';
import {
  consultCost,
  consultDoctor,
  playerStress,
  stressPressure,
} from '../personal';
import { hasHealthInsurance, canRunBoilerRoom, runBoilerRoom } from '../corporate';
import {
  canRequestSuburbanFavour,
  civiliansAreBeingQuestioned,
  neighbour,
  requestSuburbanFavour,
  suburbanState,
  tickSuburban,
} from '../suburbs';
import {
  buyPetProject,
  canSanitizePetProject,
  petProjectState,
  reliefScale,
  sanitizePetProject,
  tickPetProject,
  visitPetProject,
} from '../petProject';
import { HEALTH_INSURANCE, BOILER_ROOM } from '../../config/corporate';
import { SUBURBAN_FAVOUR_BY_ID, SUBURBS } from '../../config/suburbs';
import { CONTAGION, PET_PROJECT_BY_ID } from '../../config/petProject';
import { STRESS } from '../../config/personal';
import { NEPOTISM } from '../../config/succession';
import type { GameState, Investigation, Npc } from '../types';
import type { StageId } from '../../config/lawEnforcement';

function game(seed = 515): GameState {
  return newGame({ name: 'Suburb', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 8181, calls }), role);
  npc.status = 'active';
  npc.isSkimming = false;
  state.npcs[npc.id] = npc;
  return npc;
}

/** `n` operating fronts, which is one of the two routes to a group plan. */
function fronts(state: GameState, n: number, defId = 'laundromat'): void {
  state.businesses = {};
  const territoryId = Object.keys(state.territories)[0];
  for (let i = 0; i < n; i++) {
    state.businesses[`b${i}`] = {
      id: `b${i}`,
      defId,
      territoryId,
      purchasedDay: 1,
      exposure: 0,
      revenueTotal: 0,
      launderedTotal: 0,
      lastLaundered: 0,
      health: 100,
      status: 'operating',
    } as unknown as (typeof state.businesses)[string];
  }
}

function caseAt(state: GameState, stage: StageId, strength = 40): Investigation {
  const investigation: Investigation = {
    id: `case_${stage}`,
    agencyId: 'federal_bureau',
    stage,
    openedDay: 1,
    stageSince: 1,
    strength,
    suspectIds: [],
    businessIds: [],
    lastProgressDay: state.day,
    status: 'open',
    verdict: null,
    verdictDay: null,
    history: [],
  };
  state.law.investigations[investigation.id] = investigation;
  return investigation;
}

/** A stream whose next `chance(p)` lands, or does not. Scanned, not hard-coded. */
function rngWhere(p: number, fires: boolean): Rng {
  for (let calls = 0; calls < 20_000; calls++) {
    if (new Rng({ seed: 31, calls }).chance(p) === fires) return new Rng({ seed: 31, calls });
  }
  throw new Error('no such stream');
}

// ------------------------------------------------- executive healthcare ---

describe('the corporate mob: somebody else pays for the heart', () => {
  it('does not cover a boss with no union and no payroll, however rich', () => {
    const state = game();
    state.org.cash = 500_000;
    fronts(state, 1);
    figure(state, 'union').standing = HEALTH_INSURANCE.minUnionStanding - 1;

    expect(hasHealthInsurance(state)).toBe(false);
  });

  it('covers a boss on either route, and the waste hauler counts on its own', () => {
    const viaUnion = game();
    fronts(viaUnion, 0);
    figure(viaUnion, 'union').standing = HEALTH_INSURANCE.minUnionStanding;
    expect(hasHealthInsurance(viaUnion)).toBe(true);

    const viaFronts = game();
    fronts(viaFronts, HEALTH_INSURANCE.minFronts);
    expect(hasHealthInsurance(viaFronts)).toBe(true);

    const viaHauler = game();
    fronts(viaHauler, 1, 'waste_management');
    expect(hasHealthInsurance(viaHauler)).toBe(true);
  });

  it('zeroes the ageing line for a covered boss and leaves it standing for an uncovered one', () => {
    const bare = game();
    bare.day = NEPOTISM.agingStartDay;
    fronts(bare, 0);
    expect(stressPressure(bare).aging).toBe(NEPOTISM.agingWearinessStress);

    const covered = game();
    covered.day = NEPOTISM.agingStartDay;
    fronts(covered, HEALTH_INSURANCE.minFronts);
    expect(stressPressure(covered).aging).toBe(0);
    // And it is a subtraction, not a branch: the relief is what covers it.
    expect(HEALTH_INSURANCE.wearinessRelief).toBeGreaterThanOrEqual(
      NEPOTISM.agingWearinessStress,
    );
  });

  it('does not zero anything before the calendar starts charging for it', () => {
    const covered = game();
    covered.day = NEPOTISM.agingStartDay - 1;
    fronts(covered, HEALTH_INSURANCE.minFronts);
    expect(stressPressure(covered).aging).toBe(0);
  });

  it('bills the cardiologist and clears the bonus with him', () => {
    const covered = game();
    fronts(covered, HEALTH_INSURANCE.minFronts);
    covered.org.cash = 100_000;
    covered.org.dirtyCash = 0;
    covered.player.stress = 90;
    expect(consultCost(covered)).toBe(HEALTH_INSURANCE.cardiologistCost);

    const before = covered.org.cash;
    consultDoctor(covered);

    expect(playerStress(covered)).toBeCloseTo(
      90 - (STRESS.consultRecovery + HEALTH_INSURANCE.cardiologistRecoveryBonus),
      5,
    );
    expect(before - covered.org.cash).toBeCloseTo(HEALTH_INSURANCE.cardiologistCost, 5);
  });

  it('leaves the uncovered boss on the unmarked office, at the old price and the old relief', () => {
    const bare = game();
    fronts(bare, 0);
    bare.org.cash = 100_000;
    bare.org.dirtyCash = 0;
    bare.player.stress = 90;
    expect(consultCost(bare)).toBe(STRESS.consultCost);

    consultDoctor(bare);

    expect(playerStress(bare)).toBeCloseTo(90 - STRESS.consultRecovery, 5);
  });
});

describe('the boiler room', () => {
  it('refuses without the men, and names how many are missing', () => {
    const state = game();
    state.org.dirtyCash = 100_000;
    for (const npc of Object.values(state.npcs)) npc.status = 'dead';

    const check = canRunBoilerRoom(state);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain(String(BOILER_ROOM.crewRequired));
  });

  it('turns dirty money into clean money, and leaves paper behind', () => {
    const state = game();
    for (let i = 0; i < BOILER_ROOM.crewRequired; i++) hire(state, 'soldier', i * 7 + 1);
    state.org.dirtyCash = 100_000;
    state.org.cash = 0;
    const traces = Object.keys(state.evidence).length;

    const out = runBoilerRoom(state, new Rng({ seed: 4, calls: 0 }));

    expect(out.ok).toBe(true);
    expect(state.org.cash).toBeGreaterThan(0);
    expect(state.org.dirtyCash).toBe(100_000 - BOILER_ROOM.setupCost);
    expect(Object.keys(state.evidence).length).toBe(traces + 1);
    expect(state.org.heat).toBeGreaterThan(0);
  });

  it('will not sell the same stock twice inside the cooldown', () => {
    const state = game();
    for (let i = 0; i < BOILER_ROOM.crewRequired; i++) hire(state, 'soldier', i * 7 + 1);
    state.org.dirtyCash = 500_000;
    runBoilerRoom(state, new Rng({ seed: 4, calls: 0 }));

    const again = canRunBoilerRoom(state);
    expect(again.ok).toBe(false);
    expect(runBoilerRoom(state, new Rng({ seed: 4, calls: 0 })).ok).toBe(false);

    state.day += BOILER_ROOM.cooldownDays;
    expect(canRunBoilerRoom(state).ok).toBe(true);
  });
});

// ------------------------------------------------------ the cul-de-sac ---

describe('the suburban favour', () => {
  it('buys standing with the neighbour’s figure and compromises the neighbour', () => {
    const state = game();
    state.org.dirtyCash = 50_000;
    const fav = SUBURBAN_FAVOUR_BY_ID['zoning_variance'];
    const before = figure(state, 'captain').standing;

    const out = requestSuburbanFavour(state, 'developer', 'zoning_variance');

    expect(out.ok).toBe(true);
    expect(figure(state, 'captain').standing).toBeCloseTo(before + fav.standing, 5);
    expect(neighbour(state, 'developer')!.exposure).toBe(fav.exposure);
    expect(suburbanState(state).resolvedFavours).toHaveLength(1);
  });

  it('refuses a favour the neighbour cannot arrange, and one asked twice', () => {
    const state = game();
    state.org.dirtyCash = 50_000;
    expect(canRequestSuburbanFavour(state, 'cusamano', 'zoning_variance').ok).toBe(false);

    requestSuburbanFavour(state, 'developer', 'zoning_variance');
    const again = canRequestSuburbanFavour(state, 'developer', 'zoning_variance');
    expect(again.ok).toBe(false);
    // The refusal names what would lift it.
    expect(again.reason).toContain(
      String(SUBURBAN_FAVOUR_BY_ID['zoning_variance'].cooldownDays),
    );
  });

  it('spends nothing when it refuses', () => {
    const state = game();
    state.org.dirtyCash = 10;
    state.org.cash = 0;

    const out = requestSuburbanFavour(state, 'developer', 'zoning_variance');

    expect(out.ok).toBe(false);
    expect(state.org.dirtyCash).toBe(10);
    expect(suburbanState(state).resolvedFavours).toHaveLength(0);
  });
});

describe('the fragile civilian informant', () => {
  it('leaves an uncompromised street alone however loud the boss is', () => {
    const state = game();
    state.day = 70;
    state.org.heat = 90;
    const file = caseAt(state, 'surveillance');

    tickSuburban(state, rngWhere(SUBURBS.panicChancePerExposure * 26, true));

    expect(file.strength).toBe(40);
    expect(suburbanState(state).activeInformantThreats).toEqual([]);
  });

  it('leaves a compromised street alone while nobody is asking', () => {
    const state = game();
    state.org.dirtyCash = 50_000;
    requestSuburbanFavour(state, 'developer', 'zoning_variance');
    state.day = 70;
    state.org.heat = SUBURBS.panicHeatFloor - 1;
    const file = caseAt(state, 'suspicion');
    expect(civiliansAreBeingQuestioned(state)).toBe(false);

    tickSuburban(state, rngWhere(SUBURBS.panicChancePerExposure * 26, true));

    expect(file.strength).toBe(40);
    expect(neighbour(state, 'developer')!.panicked).toBeFalsy();
    expect(suburbanState(state).activeInformantThreats).toEqual([]);
  });

  it('hands over records when the questioning starts, into the strongest file', () => {
    const state = game();
    state.org.dirtyCash = 50_000;
    requestSuburbanFavour(state, 'developer', 'zoning_variance');
    const exposure = neighbour(state, 'developer')!.exposure;
    state.day = 70;
    state.org.heat = 0;
    const weak = caseAt(state, 'surveillance', 10);
    const strong = caseAt(state, 'warrants', 55);
    expect(civiliansAreBeingQuestioned(state)).toBe(true);

    tickSuburban(state, rngWhere(exposure * SUBURBS.panicChancePerExposure, true));

    expect(strong.strength).toBeCloseTo(55 + SUBURBS.panicEvidence, 5);
    expect(weak.strength).toBe(10);
    expect(strong.lastGrowth?.absorbed).toBeCloseTo(SUBURBS.panicEvidence, 5);
    expect(strong.history[0].text).toContain('panicked under federal questioning');
    expect(neighbour(state, 'developer')!.panicked).toBe(true);
  });

  it('only turns a witness once', () => {
    const state = game();
    state.org.dirtyCash = 50_000;
    requestSuburbanFavour(state, 'developer', 'zoning_variance');
    const exposure = neighbour(state, 'developer')!.exposure;
    state.day = 70;
    state.org.heat = 90;
    const file = caseAt(state, 'surveillance');
    const fires = () => rngWhere(exposure * SUBURBS.panicChancePerExposure, true);

    tickSuburban(state, fires());
    const after = file.strength;
    state.day = 77;
    tickSuburban(state, fires());

    expect(file.strength).toBe(after);
    // And a spent witness is off the threat list rather than still on it.
    expect(suburbanState(state).activeInformantThreats).toEqual([]);
  });

  it('has nothing to hand over when heat is up and no file exists', () => {
    const state = game();
    state.org.dirtyCash = 50_000;
    requestSuburbanFavour(state, 'developer', 'zoning_variance');
    state.day = 70;
    state.org.heat = 90;
    state.law.investigations = {};

    tickSuburban(state, rngWhere(SUBURBS.panicChancePerExposure * 26, true));

    expect(neighbour(state, 'developer')!.panicked).toBeFalsy();
    expect(suburbanState(state).activeInformantThreats).toEqual(['developer']);
  });

  it('does nothing off the seven-day cadence', () => {
    const state = game();
    state.org.dirtyCash = 50_000;
    requestSuburbanFavour(state, 'developer', 'zoning_variance');
    state.day = 71;
    state.org.heat = 90;
    const file = caseAt(state, 'surveillance');

    tickSuburban(state, rngWhere(SUBURBS.panicChancePerExposure * 26, true));

    expect(file.strength).toBe(40);
  });
});

// ------------------------------------------------------ the pet project ---

describe('the pet project', () => {
  it('will not be bought with a bag of cash', () => {
    const state = game();
    state.org.dirtyCash = 500_000;
    state.org.cash = 0;

    const out = buyPetProject(state, 'stables');

    expect(out.ok).toBe(false);
    expect(out.message).toContain(PET_PROJECTS_COST('stables'));
    expect(petProjectState(state).current).toBeNull();
    expect(state.org.dirtyCash).toBe(500_000);
  });

  it('takes clean money and only clean money', () => {
    const state = game();
    state.org.cash = 40_000;
    state.org.dirtyCash = 9_000;

    expect(buyPetProject(state, 'stables').ok).toBe(true);

    expect(state.org.cash).toBe(40_000 - PET_PROJECT_BY_ID['stables'].cost);
    expect(state.org.dirtyCash).toBe(9_000);
    expect(petProjectState(state).current?.defId).toBe('stables');
    // One is the whole idea.
    expect(buyPetProject(state, 'bakery').ok).toBe(false);
  });

  it('spends the evening and clears stress, and clears less once the crew is in', () => {
    const clean = game();
    clean.org.cash = 40_000;
    buyPetProject(clean, 'stables');
    clean.player.stress = 80;
    expect(visitPetProject(clean).ok).toBe(true);
    expect(playerStress(clean)).toBeCloseTo(80 - CONTAGION.visitStressRelief, 5);
    expect(clean.flags['went_home_day']).toBe(clean.day);
    // The body is only spent once a night.
    expect(visitPetProject(clean).ok).toBe(false);

    const dirty = game();
    dirty.org.cash = 40_000;
    buyPetProject(dirty, 'stables');
    petProjectState(dirty).contagion = 50;
    dirty.player.stress = 80;
    visitPetProject(dirty);
    expect(playerStress(dirty)).toBeCloseTo(80 - CONTAGION.visitStressRelief * 0.5, 5);
  });

  it('gives back the week and then lets the crew in a little further', () => {
    const state = game();
    state.org.cash = 40_000;
    buyPetProject(state, 'stables');
    hire(state, 'capo', 1);
    state.player.stress = 80;
    state.day = 70;

    tickPetProject(state, rngWhere(CONTAGION.raidChance, false));

    const def = PET_PROJECT_BY_ID['stables'];
    expect(playerStress(state)).toBeCloseTo(80 - def.weeklyStressRelief, 5);
    expect(petProjectState(state).contagion).toBeCloseTo(
      CONTAGION.baseWeeklyDrift + CONTAGION.driftPerCapo,
      5,
    );
  });

  it('does nothing off the seven-day cadence, and nothing without a place', () => {
    const owned = game();
    owned.org.cash = 40_000;
    buyPetProject(owned, 'stables');
    owned.player.stress = 80;
    owned.day = 71;
    tickPetProject(owned, rngWhere(CONTAGION.raidChance, false));
    expect(playerStress(owned)).toBe(80);
    expect(petProjectState(owned).contagion).toBe(0);

    const bare = game();
    bare.player.stress = 80;
    bare.day = 70;
    tickPetProject(bare, rngWhere(CONTAGION.raidChance, false));
    expect(playerStress(bare)).toBe(80);
  });

  it('gets raided once the crew has taken the place over, and not before', () => {
    const below = game();
    below.org.cash = 40_000;
    buyPetProject(below, 'stables');
    // Set so that this week's drift lands it exactly on the bar — no capos, so
    // the drift is `baseWeeklyDrift` alone. The threshold is not crossed by
    // reaching it.
    petProjectState(below).contagion = CONTAGION.raidThreshold - CONTAGION.baseWeeklyDrift;
    below.day = 70;
    const heatBefore = below.org.heat;
    tickPetProject(below, rngWhere(CONTAGION.raidChance, true));
    expect(petProjectState(below).contagion).toBe(CONTAGION.raidThreshold);
    expect(below.org.heat).toBe(heatBefore);

    const over = game();
    over.org.cash = 40_000;
    buyPetProject(over, 'stables');
    petProjectState(over).contagion = CONTAGION.raidThreshold + 1;
    over.day = 70;
    const traces = Object.keys(over.evidence).length;
    tickPetProject(over, rngWhere(CONTAGION.raidChance, true));
    expect(over.org.heat).toBeGreaterThan(0);
    expect(Object.keys(over.evidence).length).toBe(traces + 1);
  });

  it('sweeps the place clean and every capo hears about it', () => {
    const state = game();
    state.org.cash = 40_000;
    buyPetProject(state, 'stables');
    const capo = hire(state, 'capo', 1);
    const grievance = capo.stats.grievance;
    const respect = state.org.respect;
    petProjectState(state).contagion = 60;

    expect(sanitizePetProject(state).ok).toBe(true);

    expect(petProjectState(state).contagion).toBe(0);
    expect(capo.stats.grievance).toBeCloseTo(grievance + CONTAGION.sanitizeCapoGrievance, 5);
    expect(state.org.respect).toBe(Math.max(0, respect - CONTAGION.sanitizeInfluenceCost));
    // And saying it again the same month is nagging, not an order.
    petProjectState(state).contagion = 60;
    const again = canSanitizePetProject(state);
    expect(again.ok).toBe(false);
    expect(again.message).toContain(String(CONTAGION.sanitizeCooldownDays));
  });

  it('refuses to sweep a place that is already clean, and one that does not exist', () => {
    const owned = game();
    owned.org.cash = 40_000;
    buyPetProject(owned, 'stables');
    expect(canSanitizePetProject(owned).ok).toBe(false);
    expect(canSanitizePetProject(game()).ok).toBe(false);
  });

  it('scales relief the same way for the evening and for the week', () => {
    expect(reliefScale(0)).toBe(1);
    expect(reliefScale(100)).toBe(0);
    expect(reliefScale(150)).toBe(0);
    expect(reliefScale(25)).toBeCloseTo(0.75, 5);
  });
});

// ----------------------------------------------------------- the pipeline ---

describe('both layers are actually in the clock', () => {
  it('runs a week of days without throwing, and moves both', () => {
    const state = game();
    state.org.cash = 60_000;
    state.org.dirtyCash = 50_000;
    buyPetProject(state, 'stables');
    requestSuburbanFavour(state, 'developer', 'zoning_variance');
    // A file with a van outside, so ordinary doors are being knocked on and
    // the threat list has something true to say. A case rather than heat:
    // heat decays across the eight days and would leave this asserting on
    // whether the decay curve happened to clear the bar.
    caseAt(state, 'surveillance');
    state.day = 1;

    for (let i = 0; i < 8; i++) advanceDay(state);

    expect(petProjectState(state).contagion).toBeGreaterThan(0);
    /*
       And the suburban half, asserted on something only the tick writes.
       Checking that the block merely exists would have passed with
       `tickSuburban` deleted from the pipeline entirely, because the
       accessor this test calls builds it — `activeInformantThreats` is set
       by the weekly tick and by nothing else.
    */
    expect(suburbanState(state).activeInformantThreats).toEqual(['developer']);
  });
});

/** The price, formatted the way the refusal formats it. */
function PET_PROJECTS_COST(id: string): string {
  return PET_PROJECT_BY_ID[id].cost.toLocaleString('en-US');
}
