/**
 * The favour network.
 *
 * Round 14, on the system it most wanted and never reached: "People on the
 * inside. $30,240 for City Police... Never affordable at the moment of asking.
 * This is the system I most wanted and it is priced for a run that has already
 * succeeded."
 *
 * So the properties asserted here are mostly about *reachability*. A network
 * that works exactly as designed and opens on day 400 is the defect this was
 * built to fix, and it would pass any test that only checked the mechanics.
 *
 * Written against the machine rather than the prose: nothing here reads a
 * blurb, so the writing in `config/civic.ts` can be rewritten freely.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import {
  callTheLaw,
  callWalkout,
  canCallTheLaw,
  canCallWalkout,
  canPullPermit,
  canSpendFavour,
  civicRead,
  figure,
  helpFigure,
  pullPermit,
  scoreFor,
  spendFavour,
  tickCivic,
} from '../civic';
import { collectIncome } from '../faction';
import { rivalBusinesses } from '../verbs';
import { withFronts } from './helpers';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { CIVIC, CIVIC_BY_ID, CIVIC_FIGURES, FAVOUR_EFFECT } from '../../config/civic';
import { SENTIMENT_HOSTILE_BELOW, HOME_TERRITORY } from '../../config/territories';
import { AI, RIVAL_IDS, type FactionId } from '../../config/factions';
import type { GameState, RivalBusiness } from '../types';

function game(seed = 12): GameState {
  return newGame({ name: 'Pull', difficulty: 'normal', seed });
}

/**
 * Runs the weekly tick `n` times, on the days it actually fires.
 *
 * The first version did `state.day += CIVIC.intervalDays`, which from a day-1
 * start lands on 8, 15, 22 — never a multiple of seven, so `tickCivic`
 * early-returned every single time and thirteen "weeks" moved nothing. That is
 * the trap HANDOFF section 3 names explicitly, and it made every assertion
 * below fail for a reason that had nothing to do with the code under test.
 *
 * Aligning to the interval rather than adding to it, and `ticked()` below
 * proves the alignment still works if the interval ever changes.
 */
function weeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day = (Math.floor(state.day / CIVIC.intervalDays) + 1) * CIVIC.intervalDays;
    tickCivic(state);
  }
}

/*
   The alderman, and the reading that ran the wrong way.

   He watched the average public feeling across the districts you work. Two
   things about that turned out to be fatal, and neither was visible until
   `ladder.probe`'s bot stopped standing still on two days in five.

   **It has no upside.** `SENTIMENT_RECOVERY_PER_WEEK` climbs back only as far
   as `SENTIMENT_START`, which is 50, and nothing in ordinary play pushes a
   district above it. Measured at day 300 across 36 careers: the best worked
   district reads 49.1 / 50.0 / 50.0 and *no* career had a single district over
   50. The quantity is a ceiling the game presses everybody against from below.

   **It falls with play.** Working a district is what costs feeling, so the
   mean across worked districts read 34.6 / 37.2 / 38.3 with a maximum of 40.7
   — against a bar of 50. The figure was not fragile, he was unreachable by
   construction, and his favour was the one thing in this game that got further
   away the more you played.

   So he reads what you have *built* in the neighbourhood instead: legitimate
   businesses standing in ground that does not resent you. That is a ward
   politician's actual interest, it is what `lose_the_paperwork` is a favour
   about, and it keeps public feeling in the reading as a gate rather than as
   the whole of it — a front nobody there can stand does not count.
*/
/*
   The union boss, and the ground that stopped meaning anything.

   He counted districts held, over four. That was right when the ladder asked
   for ground and wrong the moment it stopped: the highest district gate
   anywhere in `OPERATIONS` is three, so ground saturates for every player who
   opens the board and buys nothing after that. Measured across 36 careers at
   day 300, districts controlled read 4 / 4 / 4 with a minimum of 3 and a
   maximum of 4 — a point mass, and a bar of 60 wants 2.4 of it. He owed every
   career in the population whatever they did, which is a subscription rather
   than a relationship.

   This is not the probe's stopping rule showing through. Nothing in the game
   asks for a fourth district, so a rational player stops where the bot stops.

   He reads the payroll now, which is the first thing his own blurb says he is
   interested in and the only candidate with real spread in it:

       districts controlled    4.0 / 4.0 / 4.0   (min 3, max 4)
       districts at dominance  3.0 / 3.0 / 4.0   (min 1, max 4)
       districts with a man    3.0 / 4.0 / 4.0   (min 1, max 5)
       crew on the books        31 /  34 /  38   (min 17, max 47)
       influence, all told     323 / 357 / 386
*/
describe('a union boss', () => {
  const union = CIVIC_BY_ID['union'];

  function hire(state: GameState, n: number): void {
    const rng = new Rng(state.rng);
    for (let i = 0; i < n; i++) {
      const npc = generateNpc(state, rng, 'soldier');
      state.npcs[npc.id] = npc;
    }
  }

  it('rises with people on the books', () => {
    const state = game();
    const before = scoreFor(state, union);
    hire(state, 12);
    const after = scoreFor(state, union);
    expect(after).toBeGreaterThan(before);
  });

  /*
     The defect. Ground saturates at what the job board asks for, so a figure
     reading it owes everybody who ever progressed.
  */
  it('is not bought by holding the ground the board already asked for', () => {
    const state = game();
    for (const t of Object.values(state.territories)) t.influence.player = 80;
    expect(scoreFor(state, union)).toBeLessThan(union.owesAbove);
  });

  it('does not count men who are gone', () => {
    const state = game();
    hire(state, 20);
    const full = scoreFor(state, union);
    for (const npc of crewList(state).slice(0, 10)) npc.status = 'dead';
    expect(scoreFor(state, union)).toBeLessThan(full);
  });

  it('is reachable — a real payroll clears him', () => {
    const state = game();
    hire(state, CIVIC.unionPayroll);
    expect(scoreFor(state, union)).toBeGreaterThanOrEqual(union.owesAbove);
  });
});

describe('somebody in office', () => {
  /**
   * `n` real fronts through the real acquisition path, then public feeling set
   * where the test wants it. A hand-built Business object was tried first and
   * `ownedBusinesses` correctly refused to count it.
   */
  function fronts(state: GameState, n: number, sentiment: number[] = []): string[] {
    const made = withFronts(state, n);
    made.forEach((b, i) => {
      const t = state.territories[b.territoryId];
      if (sentiment[i] !== undefined) t.sentiment = sentiment[i];
    });
    return made.map((b) => b.territoryId);
  }

  const alderman = CIVIC_BY_ID['alderman'];

  it('reads nothing when there is nothing to be seen with', () => {
    expect(scoreFor(game(), alderman)).toBe(0);
  });

  it('rises with legitimate business in ground that does not resent you', () => {
    const state = game();
    fronts(state, 1, [50]);
    const one = scoreFor(state, alderman);
    fronts(state, 2, [50, 50]);
    const two = scoreFor(state, alderman);

    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(one);
  });

  it('does not count a front nobody in the district can stand', () => {
    const state = game();
    const made = fronts(state, 2, [50, 50]);
    const before = scoreFor(state, alderman);
    state.territories[made[1]].sentiment = SENTIMENT_HOSTILE_BELOW - 5;
    expect(scoreFor(state, alderman)).toBeLessThan(before);
  });

  /*
     The defect itself, as a test. Working a district costs public feeling, and
     under the old reading that alone pushed him away.
  */
  it('does not fall because you worked the neighbourhood', () => {
    const state = game();
    fronts(state, 3, [50, 50, 50]);
    const before = scoreFor(state, alderman);

    for (const t of Object.values(state.territories)) {
      t.sentiment = Math.max(SENTIMENT_HOSTILE_BELOW + 1, t.sentiment - 15);
    }
    expect(scoreFor(state, alderman)).toBe(before);
  });

  it('is reachable — a bar above what the reading can ever return is not a bar', () => {
    const state = game();
    const made = fronts(state, CIVIC.respectableFronts);
    for (const id of made) {
      state.territories[id].sentiment = Math.max(
        state.territories[id].sentiment,
        SENTIMENT_HOSTILE_BELOW + 1,
      );
    }
    expect(scoreFor(state, alderman)).toBeGreaterThanOrEqual(alderman.owesAbove);
  });
});

describe('the people who are not in your family', () => {
  it('starts everybody at arm’s length rather than absent', () => {
    // The instrument first: an empty roster passes most of what follows.
    const state = game();
    const all = civicRead(state);
    expect(all.length).toBe(CIVIC_FIGURES.length);
    expect(all.every((f) => f.standing >= 0 && f.standing <= 100)).toBe(true);
    expect(all.every((f) => f.owed === 0)).toBe(true);
  });

  /*
     And the helper has to actually run the tick.

     Guarding the instrument rather than the code: `tickCivic` early-returns
     off `day % intervalDays`, so a helper that steps the clock wrongly turns
     every test in this file green-or-red for the wrong reason. One quiet week
     has to move a captain.
  */
  it('ticked at all', () => {
    const state = game();
    state.org.heat = 0;
    const before = figure(state, 'captain').standing;
    weeks(state, 1);
    expect(
      figure(state, 'captain').standing,
      'the weekly tick never fired — the helper is stepping the clock wrongly',
    ).toBeGreaterThan(before);
  });

  /*
     A save written before this existed has to load, and read as nobody knowing
     you — which for those saves is exactly true.
  */
  it('reads an absent roster as nobody owing you anything', () => {
    const state = game();
    delete state.civic;
    expect(() => civicRead(state)).not.toThrow();
    expect(civicRead(state).every((f) => f.owed === 0)).toBe(true);
  });

  /*
     The reachability property, and the reason this file exists.

     A captain watches how quiet you keep things. A family that keeps heat down
     for a season should have somebody in the division who owes them one, well
     inside the 300 days a person plays — not at day 400, and not for $30,240.
  */
  it('owes a quiet family a favour inside a season', () => {
    const state = game();
    state.org.heat = 5;

    weeks(state, 13);

    const captain = figure(state, 'captain');
    expect(
      captain.standing,
      'thirteen quiet weeks moved a police captain almost not at all',
    ).toBeGreaterThan(CIVIC_BY_ID['captain'].owesAbove);
    expect(captain.owed, 'nobody owed anything after a season of good behaviour').toBeGreaterThan(0);
  });

  /*
     And the other direction, which is what stops this being free money.
  */
  it('does not owe a family that runs hot', () => {
    const state = game();
    state.org.heat = 95;

    weeks(state, 13);

    expect(figure(state, 'captain').owed).toBe(0);
  });

  it('never stockpiles past the cap', () => {
    const state = game();
    state.org.heat = 0;

    weeks(state, 60);

    expect(figure(state, 'captain').owed).toBeLessThanOrEqual(CIVIC.maxOwed);
  });
});

describe('spending a favour', () => {
  /**
   * A captain who owes you one, and a file for them to lose.
   *
   * The case matters: `spendFavour` refuses when the favour has nothing to act
   * on, and refusing does not spend the favour. Without one, "spends one, and
   * only one" fails on a correct refusal and reads like a counting bug.
   */
  function owed(): GameState {
    const state = game();
    state.org.heat = 0;
    weeks(state, 20);
    if (Object.keys(state.law.investigations).length === 0) {
      state.law.investigations['case_test'] = {
        id: 'case_test',
        agencyId: 'city_police',
        stage: 'suspicion',
        openedDay: 1,
        stageSince: 1,
        strength: 80,
        suspectIds: [],
        businessIds: [],
        lastProgressDay: state.day,
        status: 'open',
        verdict: null,
        verdictDay: null,
        history: [],
      };
    }
    return state;
  }

  /*
     Two different bars, and each refusal has to name its own.

     A stranger and somebody who knows you but owes you nothing are different
     positions, and telling both of them "they do not owe you anything, they
     start owing above 40" would be the F10 failure again — a true sentence
     about the wrong number.
  */
  it('tells a stranger they are a stranger, and names that bar', () => {
    const state = game();
    const check = canSpendFavour(state, 'captain');

    expect(check.ok).toBe(false);
    expect(check.reason).toContain(String(CIVIC.coldBelow));
  });

  it('tells somebody who knows you what they start owing above', () => {
    const state = game();
    figure(state, 'captain').standing = CIVIC.coldBelow + 5;
    const check = canSpendFavour(state, 'captain');

    expect(check.ok).toBe(false);
    expect(check.reason).toContain(String(CIVIC_BY_ID['captain'].owesAbove));
  });

  it('refuses a figure whose pull requirement you have not met', () => {
    const state = game();
    state.player.attributes.influence = 0;
    const check = canSpendFavour(state, 'alderman');

    expect(check.ok).toBe(false);
    expect(check.reason).toContain(String(CIVIC_BY_ID['alderman'].needsInfluence));
  });

  it('spends one, and only one', () => {
    const state = owed();
    const before = figure(state, 'captain').owed;
    expect(before, 'the setup produced no favour to spend').toBeGreaterThan(0);

    spendFavour(state, 'captain');
    expect(figure(state, 'captain').owed).toBe(before - 1);
  });

  /*
     A buried case has to change what happens next week, or the favour is a
     log line. Asserted on the case, not on the return value.
  */
  it('takes real weight off a case when the captain buries one', () => {
    const state = owed();
    const investigation = Object.values(state.law.investigations)[0] ?? null;
    if (!investigation) {
      // Better than skipping: a setup that grows no case measures nothing.
      state.law.investigations['case_test'] = {
        id: 'case_test',
        agencyId: 'city_police',
        stage: 'suspicion',
        openedDay: 1,
        stageSince: 1,
        strength: 80,
        suspectIds: [],
        businessIds: [],
        lastProgressDay: state.day,
        status: 'open',
        verdict: null,
        verdictDay: null,
        history: [],
      };
    }
    const target = Object.values(state.law.investigations)[0];
    const was = target.strength;

    spendFavour(state, 'captain', target.id);

    expect(
      was - target.strength,
      'burying a case took no evidence off it',
    ).toBeGreaterThanOrEqual(FAVOUR_EFFECT.buryEvidence - 1);
  });

  /*
     The lawyer. Same shape as every other figure — reads a quantity the
     simulation already keeps, grants a favour the machinery already knows how
     to do — so nothing here should need a new case in either `scoreFor` or
     `apply`. Watches the same thing the judge does (legal exposure) and
     grants what the captain grants (bury a case), a combination no existing
     figure uses.
  */
  it('is on the roster and reads the same quantity the judge does', () => {
    const state = game();
    expect(CIVIC_BY_ID['lawyer']).toBeDefined();
    const lawyer = CIVIC_BY_ID['lawyer'];
    const judge = CIVIC_BY_ID['judge'];
    expect(lawyer.watches).toBe(judge.watches);
    expect(scoreFor(state, lawyer)).toBe(scoreFor(state, judge));
  });

  it('buries a case when the lawyer is owed one, the same way the captain does', () => {
    const state = game();
    state.law.investigations['case_test'] = {
      id: 'case_test',
      agencyId: 'city_police',
      stage: 'suspicion',
      openedDay: 1,
      stageSince: 1,
      strength: 80,
      suspectIds: [],
      businessIds: [],
      lastProgressDay: state.day,
      status: 'open',
      verdict: null,
      verdictDay: null,
      history: [],
    };
    state.player.attributes.influence = CIVIC_BY_ID['lawyer'].needsInfluence;
    const lawyer = figure(state, 'lawyer');
    lawyer.standing = 100;
    lawyer.owed = 1;

    const target = state.law.investigations['case_test'];
    const was = target.strength;
    const result = spendFavour(state, 'lawyer', target.id);

    expect(result.ok).toBe(true);
    expect(figure(state, 'lawyer').owed).toBe(0);
    expect(was - target.strength).toBeGreaterThanOrEqual(FAVOUR_EFFECT.buryEvidence - 1);
  });

  /*
     The union favour exists to answer F10, F12 and F15 at once: a district
     below the bar sells you nothing, fronts are what makes a career compound,
     and 25 of 36 careers never get a second one.

     So it has to clear the bar with room, not land on it.
  */
  it('brings a hostile district back over the bar fronts need', () => {
    const state = game();
    state.player.attributes.influence = 9;
    /*
       A payroll rather than ground. The union boss counted districts when this
       was written and counts members now, and a fixture that grants the old
       precondition grants nothing — it left him owing nothing and the
       assertion below measuring an empty room.
    */
    const rng = new Rng(state.rng);
    for (let i = 0; i < CIVIC.unionPayroll; i++) {
      const npc = generateNpc(state, rng, 'soldier');
      state.npcs[npc.id] = npc;
    }
    weeks(state, 20);

    const home = state.territories[HOME_TERRITORY];
    home.sentiment = 4;

    const union = figure(state, 'union');
    expect(union.owed, 'the union boss owed nothing, so nothing was measured').toBeGreaterThan(0);

    spendFavour(state, 'union', HOME_TERRITORY);

    expect(
      home.sentiment,
      'the district is still below the bar that refuses to sell you a front',
    ).toBeGreaterThan(SENTIMENT_HOSTILE_BELOW);
  });
});

/*
   Doing a councilman a favour, and the shop that was hiding inside it.

   `gen_someone_outside` offered $9,000 to fix a civic figure's problem, and
   paid out +1 to the player's influence and +12 to that figure's standing. It
   was uncapped and the memo pool regenerates, so nine of them bought the
   patron's Influence 9 for $81,000 — in an economy whose median career peaks
   at $982,554.

   `INFLUENCE_FROM` already records this exact bug in another form:
   `demand_tribute` cost nothing and "twenty demands in one afternoon were
   credited ten times over, on the attribute the game presents as the hard one
   to train." It was fixed with a fortnight's cooldown on the credit. The memo
   route had the identical hole and nobody found it, because until the heat
   work landed the bot was too poor to walk through it.

   Two things changed. The influence grant is gone — helping a man makes *him*
   think better of you, which is the fiction; it does not buy general political
   pull, which is the shop `civic.ts` exists to refuse. And the standing is
   rate-limited on the same terms `approach` is: the credit is capped, the
   action is not. You may help as often as you like and the money goes either
   way.
*/
describe('helping somebody outside the family', () => {
  it('makes that man think better of you', () => {
    const state = game();
    const before = figure(state, 'captain').standing;
    expect(helpFigure(state, 'captain', 12)).toBe(true);
    expect(figure(state, 'captain').standing).toBeGreaterThan(before);
  });

  it('credits it once a fortnight and not twice', () => {
    const state = game();
    helpFigure(state, 'captain', 12);
    const after = figure(state, 'captain').standing;

    state.day += 1;
    expect(helpFigure(state, 'captain', 12)).toBe(false);
    expect(figure(state, 'captain').standing).toBe(after);
  });

  it('credits it again once the fortnight is up', () => {
    const state = game();
    helpFigure(state, 'captain', 12);
    const after = figure(state, 'captain').standing;

    state.day += CIVIC.helpCooldownDays;
    expect(helpFigure(state, 'captain', 12)).toBe(true);
    expect(figure(state, 'captain').standing).toBeGreaterThan(after);
  });

  it('is per person, so one man on the phone does not silence the rest', () => {
    const state = game();
    helpFigure(state, 'captain', 12);
    expect(helpFigure(state, 'judge', 12)).toBe(true);
  });

  /*
     The one favour this network spends outward, rather than on a problem of
     the player's own.

     Reuses the same setup `civic.test.ts` already uses to get the union boss
     owing one — a real payroll, through the real tick — because a fixture
     that grants the favour by hand measures nothing about reachability.
  */
  function unionOwed(state: GameState): void {
    const rng = new Rng(state.rng);
    for (let i = 0; i < CIVIC.unionPayroll; i++) {
      const npc = generateNpc(state, rng, 'soldier');
      state.npcs[npc.id] = npc;
    }
    weeks(state, 20);
  }

  describe('calling a walkout on a rival', () => {
    const target: FactionId = RIVAL_IDS[0];

    it('refuses when the union boss owes you nothing', () => {
      const state = game();
      expect(canCallWalkout(state, target).ok).toBe(false);
    });

    /*
       Isolated to `collectIncome` directly, on the same faction run twice,
       rather than the full weekly tick or two different houses — `tickFactions`
       also runs each faction's own decision (invest, expand, pressure) through
       the shared `rng` stream, and two different houses start with different
       territory and strength, either of which would confound a diff. Running
       the identical object once plain and once walked-out, from the same
       restored wealth, isolates exactly the term this feature is supposed to
       zero.
    */
    it('costs a rival exactly their businesses’ worth of income for the week', () => {
      const state = game();
      unionOwed(state);
      const owedBefore = figure(state, 'union').owed;
      expect(owedBefore, 'the setup produced no favour to spend').toBeGreaterThan(0);

      const rival = state.factions[target];
      rival.businessCount = 4;
      const wealthBefore = 500_000;

      rival.wealth = wealthBefore;
      collectIncome(state, rival);
      const normalDelta = rival.wealth - wealthBefore;

      rival.wealth = wealthBefore;
      const result = callWalkout(state, target);
      expect(result.ok).toBe(true);
      expect(figure(state, 'union').owed).toBe(owedBefore - 1);
      expect(rival.walkoutUntilDay).toBe(state.day + FAVOUR_EFFECT.walkoutDays);

      collectIncome(state, rival);
      const walkedOutDelta = rival.wealth - wealthBefore;

      expect(
        normalDelta - walkedOutDelta,
        'a walked-out rival earned the same as one nobody touched',
      ).toBe(rival.businessCount * AI.invest.incomePerBusiness);
    });

    it('refuses a second walkout on the same house while the first is running', () => {
      const state = game();
      unionOwed(state);
      callWalkout(state, target);
      expect(canCallWalkout(state, target).ok).toBe(false);
    });

    it('is open again once the walkout runs out', () => {
      const state = game();
      unionOwed(state);
      callWalkout(state, target);
      state.day = state.factions[target].walkoutUntilDay!;
      unionOwed(state);
      expect(canCallWalkout(state, target).ok).toBe(true);
    });
  });

  describe('having a rival looked at', () => {
    const target: FactionId = RIVAL_IDS[0];

    /** A quiet family the captain has come to owe, same setup the captain's own tests use. */
    function captainOwed(state: GameState): void {
      state.org.heat = 0;
      weeks(state, 20);
    }

    it('refuses when the captain owes you nothing', () => {
      const state = game();
      expect(canCallTheLaw(state, target).ok).toBe(false);
    });

    it('spends the captain’s favour and puts real heat on the house', () => {
      const state = game();
      captainOwed(state);
      const owedBefore = figure(state, 'captain').owed;
      expect(owedBefore, 'the setup produced no favour to spend').toBeGreaterThan(0);

      const rival = state.factions[target];
      const before = rival.heat;

      const result = callTheLaw(state, target);
      expect(result.ok).toBe(true);
      expect(figure(state, 'captain').owed).toBe(owedBefore - 1);
      expect(rival.heat).toBe(Math.min(100, before + FAVOUR_EFFECT.heatOnRival));
    });

    it('has nothing to spend it on once that house is finished', () => {
      const state = game();
      captainOwed(state);
      state.factions[target].strength = 0;
      expect(canCallTheLaw(state, target).ok).toBe(false);
    });
  });

  describe('pulling a permit on a rival’s front', () => {
    const target: FactionId = RIVAL_IDS[0];

    /** A ward the alderman has come to respect, same shape the alderman's own tests use. */
    function aldermanOwed(state: GameState): void {
      const made = withFronts(state, CIVIC.respectableFronts);
      for (const b of made) {
        state.territories[b.territoryId].sentiment = Math.max(
          state.territories[b.territoryId].sentiment,
          SENTIMENT_HOSTILE_BELOW + 1,
        );
      }
      state.player.attributes.influence = CIVIC_BY_ID['alderman'].needsInfluence;
      weeks(state, 20);
    }

    function aFront(state: GameState): RivalBusiness {
      const biz: RivalBusiness = {
        id: 'rbiz_permit_test',
        factionId: target,
        defId: 'laundromat',
        territoryId: 'northside',
      };
      rivalBusinesses(state)[biz.id] = biz;
      return biz;
    }

    it('refuses when the alderman owes you nothing', () => {
      const state = game();
      const biz = aFront(state);
      expect(canPullPermit(state, biz.id).ok).toBe(false);
    });

    it('spends the alderman’s favour and stops the business earning', () => {
      const state = game();
      aldermanOwed(state);
      const owedBefore = figure(state, 'alderman').owed;
      expect(owedBefore, 'the setup produced no favour to spend').toBeGreaterThan(0);

      const biz = aFront(state);
      const rival = state.factions[target];
      rival.businessCount = 4;
      const wealthBefore = 500_000;

      rival.wealth = wealthBefore;
      collectIncome(state, rival);
      const normalDelta = rival.wealth - wealthBefore;

      rival.wealth = wealthBefore;
      const result = pullPermit(state, biz.id);
      expect(result.ok).toBe(true);
      expect(figure(state, 'alderman').owed).toBe(owedBefore - 1);
      expect(biz.permitPulledUntilDay).toBe(state.day + FAVOUR_EFFECT.permitPulledDays);

      collectIncome(state, rival);
      const pulledDelta = rival.wealth - wealthBefore;

      expect(
        normalDelta - pulledDelta,
        'pulling one permit cost the whole family’s payroll, not one business’ worth',
      ).toBe(AI.invest.incomePerBusiness);
    });

    it('refuses a second pull on the same business while the first is running', () => {
      const state = game();
      aldermanOwed(state);
      // A favour still in hand afterwards, so the refusal below is provably
      // about the permit already pulled and not about the account running dry.
      figure(state, 'alderman').owed = 2;
      const biz = aFront(state);
      pullPermit(state, biz.id);
      expect(figure(state, 'alderman').owed, 'the setup left nothing to isolate the guard with').toBeGreaterThan(0);
      const check = canPullPermit(state, biz.id);
      expect(check.ok).toBe(false);
      expect(check.reason).toMatch(/paperwork/i);
    });
  });

  it('buys nothing at all in the way of general pull', () => {
    /*
       The whole point. A man you helped thinks better of you; the city does
       not hand you influence for it. Influence is what `INFLUENCE_FROM` is
       for, and it is deliberately the hard one.
    */
    const state = game();
    const before = state.player.attributes.influence;
    for (let i = 0; i < 12; i++) {
      state.day += CIVIC.helpCooldownDays;
      helpFigure(state, 'captain', 12);
    }
    expect(state.player.attributes.influence).toBe(before);
  });
});
