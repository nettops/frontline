/**
 * The memos the simulation writes for itself.
 *
 * Round 14's second MUST FIX, in the tester's own words: *"Between day 180 and
 * day 300 I met exactly one memo I had not seen before."*
 *
 * **The supply measurement is not in this file.** It is in `ladder.probe`,
 * against the bot that actually plays — launches jobs, buys fronts, holds
 * ground, draws heat. The first version of this file measured supply against a
 * career that did nothing but answer memos, and reported that four of the six
 * shapes never fire. They never fired because that world has no fronts, no
 * ground and no open cases: it was a measurement of the bot, not of the
 * generator. A world where nothing happens is the one world these shapes are
 * correct to stay quiet in.
 *
 * What is left here is what a unit test can actually settle:
 *
 * **Every shape can fire**, given a world that contains its subject.
 * **Every answer resolves**, on every branch, without leaving the memo behind.
 * **Nothing invents its subject** — no man, front or street that is not there.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { EVENT_DEF_BY_ID, resolveEvent } from '../events';
import { GEN_DEFS, isGenerated } from '../eventgen';
import { GEN_EFFECT, GEN_SHAPES, GEN_WHEN } from '../../config/eventgen';
import { acquireBusiness, ownedBusinesses } from '../business';
import { crewList, generateNpc } from '../npc';
import { HOME_TERRITORY } from '../../config/territories';
import { territoryList } from '../territory';
import { figure } from '../civic';
import { canLaunch } from '../operations';
import { OPERATION_BY_ID } from '../../config/operations';
import { bodySpentTonight, home, memberAge, neglectRisk, playerStress } from '../personal';
import { FAMILY_DILEMMAS, HOME, STRESS } from '../../config/personal';
import { launchOperation } from '../operations';
import { totalFunds } from '../economy';
import { money } from '../memo';
import { priced } from '../market';
import { activeCapos } from '../capoTension';
import { legitimacy } from '../legacy';
import { career } from '../career';
import { answerFirst, runDays } from './helpers';
import type { GameState, Npc } from '../types';

/**
 * A world with one of everything the six shapes ask for.
 *
 * Built rather than played toward. A career that happens to produce all six at
 * once is rare, and waiting for one would make this file's coverage depend on
 * a seed — the branch that is never reached is always the branch that throws.
 */
function world(seed = 88): GameState {
  const state = newGame({ name: 'Answer', difficulty: 'normal', seed });
  runDays(state, 60, new Rng(state.rng));

  /*
     Milestone 4: `gen_family_crossroads` needs a household member at or past
     18 — one of the two relations `CHILD_START_AGES` tracks, given real
     years to grow into. This seed's three-of-six household draw will not
     reliably include either one, so the household is nudged directly, same
     as the steward below is set directly rather than played toward.

     The jump runs ahead of every other fixture value below it, so their own
     `state.day - X` deltas — steward tenure, the nickname's age, the front's
     purchase date — land exactly where they did before; nothing downstream
     needs to move with it since all of it is computed relative to
     `state.day` after this point, except `gen_old_owner`'s own upper-bound
     freshness check, which also reads `purchasedDay` set later against the
     same, already-jumped day.
  */
  const house = home(state);
  if (!house.people.some((p) => p.relationId === 'eldest' || p.relationId === 'youngest')) {
    house.people[0].relationId = 'eldest';
  }
  state.day += 18 * 365;

  state.org.cash = 400_000;
  state.org.dirtyCash = 50_000;

  // Ground first. A front cannot be bought without a foothold, and it cannot
  // be bought at all in a district that has turned — so the order here is
  // load-bearing: buy the place, then let the street go sour.
  for (const t of Object.values(state.territories)) t.influence.player = 45;

  // A front, and it is going under.
  acquireBusiness(state, 'laundromat', HOME_TERRITORY);
  const front = ownedBusinesses(state)[0];
  if (front) front.health = 30;

  // And now the street turns.
  for (const t of Object.values(state.territories)) t.sentiment = 20;

  /*
     People.

     A career starts alone and this bot never recruits, so a state played
     forward sixty days has a crew of nought — which is why the first version
     of this file reported four dead shapes. Two of them were correct to be
     silent: there was nobody to be aggrieved.
  */
  const hireRng = new Rng(state.rng);
  for (const role of ['soldier', 'soldier', 'associate'] as const) {
    const npc = generateNpc(state, hireRng, role);
    state.npcs[npc.id] = npc;
  }

  /*
     And somebody running a street for you, a season into the job.

     `gen_steward_asks` is the only shape whose subject is a delegation, and
     this builder had no steward in it — so the shape read as dead against a
     world that was supposed to have one of everything. Set directly rather
     than through `putInCharge`, because the eligibility rules are a separate
     thing being tested elsewhere and this fixture only needs the state.
  */
  const runner = Object.values(state.npcs).find((n) => n.status === 'active');
  const street = state.territories[HOME_TERRITORY];
  if (runner && street) {
    street.stewardId = runner.id;
    street.stewardSince = state.day - 120;
  }

  /*
     Nobody has been dealt with recently.

     The sixty days of warm-up above can raise and answer `gen_wants_a_word`
     themselves, which sets the per-person cooldown added after round 15 — so
     the fixture was handing itself a man the game had correctly decided not to
     ask about again. Cleared, because this builder is constructing a fresh
     situation rather than continuing one.
  */
  for (const key of Object.keys(state.flags)) {
    if (key.startsWith('asked_')) delete state.flags[key];
  }

  // Somebody aggrieved, and two who will not work together.
  const crew = crewList(state).filter((n) => n.status !== 'dead');
  if (crew[0]) {
    crew[0].stats.grievance = 90;
    crew[0].stats.loyalty = 20;
  }
  if (crew[0] && crew[1]) {
    crew[0].ties.push({
      id: crew[1].id,
      trust: 0,
      resentment: 80,
      debt: 0,
      cause: 'passed_over',
      since: state.day,
    });
  }

  // Somebody outside who knows you and owes you nothing.
  const known = figure(state, 'captain');
  known.standing = 30;
  known.owed = 0;

  // Somebody in a cell, and somebody helping himself to a district.
  if (crew[2]) {
    crew[2].status = 'arrested';
    crew[2].unavailableUntilDay = state.day + 30;
  }
  if (crew[1]) {
    crew[1].isSkimming = true;
    crew[1].skimTotal = 9_000;
    const t = territoryList(state)[0];
    if (t) t.stewardId = crew[1].id;
  }

  // And a name somebody has now brought you twice.
  state.whispers = [
    {
      day: state.day,
      kind: 'somebody_talking',
      text: `Somebody says ${crew[0]?.name ?? 'a man'} has been seen where he had no reason to be.`,
      subject: crew[0]?.id ?? '',
      confidence: 0.7,
      truth: true,
      corroborated: true,
    },
  ];

  // And a house that has noticed you are never in it.
  home(state).neglect = 60;

  // And a boss carrying real stress — the subject `gen_panic_episode` reads.
  state.player.stress = STRESS.panicThreshold;

  /*
     And the three subjects the systems built after this file was written need.

     Set directly, same as the steward above. A name arrives on a weekly roll
     from day 120, a front bought on "they keep a piece" needs the acquisition
     scene, and a frightened street needs a career that spent four years being
     frightening — none of which a sixty-day warm-up produces, and waiting for
     one would make this file's coverage depend on a seed.
  */
  state.player.nickname = { id: 'the_hammer', since: state.day - 20 };
  const bought = ownedBusinesses(state)[0];
  if (bought) {
    bought.terms = ['he_stays'];
    bought.purchasedDay = state.day - 30;
  }
  state.org.fear = 70;

  // And a file with something in it.
  state.law.investigations['case_test'] = {
    id: 'case_test',
    agencyId: 'city_police',
    stage: 'suspicion',
    openedDay: 1,
    stageSince: 1,
    strength: 70,
    suspectIds: [],
    businessIds: [],
    lastProgressDay: state.day,
    status: 'open',
    verdict: null,
    verdictDay: null,
    history: [],
  };

  return state;
}

describe('the shapes', () => {
  it('is in the same table the authored events are in', () => {
    // Appended rather than kept in a second list, which is what makes the
    // cooldowns, the pending cap and `refusals.test.ts` apply to them.
    expect(GEN_DEFS.length).toBe(GEN_SHAPES.length);
    for (const def of GEN_DEFS) {
      expect(EVENT_DEF_BY_ID[def.id], `${def.id} is not in EVENT_DEF_BY_ID`).toBeDefined();
    }
  });

  it('every one of them can fire against a world that has its subject', () => {
    const state = world();
    const rng = new Rng(state.rng);
    const dead = GEN_DEFS.filter((def) => !def.applies(state, rng)).map((d) => d.id);
    expect(dead, `never applies: ${dead.join(', ')}`).toEqual([]);
  });

  /*
     And the other half of that, which is the one that would rot quietly: a
     shape that fires against a world with nothing in it is a memo about
     nobody. An empty organization must raise none of these.
  */
  it('none of them fires against an empty world', () => {
    const empty = newGame({ name: 'Nothing', difficulty: 'normal', seed: 3 });
    const rng = new Rng(empty.rng);
    for (const npc of crewList(empty)) {
      npc.stats.grievance = 0;
      npc.stats.loyalty = 80;
      npc.ties = [];
    }
    const fired = GEN_DEFS.filter((def) => def.applies(empty, rng)).map((d) => d.id);
    expect(fired, `fired against nothing: ${fired.join(', ')}`).toEqual([]);
  });

  it('never names a subject that does not exist', () => {
    const state = world();
    const rng = new Rng(state.rng);
    for (const def of GEN_DEFS) {
      const ctx = def.applies(state, rng);
      if (!ctx) continue;
      const built = def.build(state, rng, ctx);
      if (built.npcId) expect(state.npcs[built.npcId], `${def.id} named a stranger`).toBeDefined();
      if (built.data.otherId) expect(state.npcs[String(built.data.otherId)]).toBeDefined();
      if (built.data.businessId) expect(state.businesses[String(built.data.businessId)]).toBeDefined();
      if (built.data.territoryId) expect(state.territories[String(built.data.territoryId)]).toBeDefined();
      expect(built.body.length, `${def.id} has no body`).toBeGreaterThan(40);
      expect(built.choices.length, `${def.id} offers no choice`).toBeGreaterThan(1);
    }
  });
});

/*
   The three shapes built for the systems that shipped after this file.

   Each is checked on the one property the generic sweep above cannot see: that
   the answer moves the thing the shape claims it moves. That is this project's
   standing failure — a lever exported, wired to a button, and connected to
   nothing — and it has been caught twice this cycle already.
*/
describe('the three late shapes', () => {
  function raise(state: GameState, id: string) {
    const def = GEN_DEFS.find((d) => d.id === id)!;
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng);
    if (!ctx) return null;
    const built = def.build(state, rng, ctx);
    state.pendingEvents.push({ ...built, id: 'evt_test', day: state.day });
    return built;
  }

  it('will not tell a nameless boss what the street calls them', () => {
    const state = world();
    delete state.player.nickname;
    const def = GEN_DEFS.find((d) => d.id === 'gen_the_name_stuck')!;
    expect(def.applies(state, new Rng(state.rng))).toBeNull();
  });

  /*
     The one that matters. `he_stays` is read every week by `termRevenueShare`
     and `termExposure`, so buying the old owner out has to take the entry off
     the front or the player has paid for a sentence.
  */
  it('buying the old owner out actually ends the terms', () => {
    const state = world();
    state.org.cash = 500_000;
    const front = ownedBusinesses(state)[0]!;
    expect(front.terms, 'the fixture did not set the terms').toContain('he_stays');

    expect(raise(state, 'gen_old_owner'), 'the shape did not fire').not.toBeNull();
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'buy');

    expect(front.terms ?? [], 'the money bought a line of text').not.toContain('he_stays');
  });

  it('leaves the terms alone when you only lean on them', () => {
    const state = world();
    expect(raise(state, 'gen_old_owner')).not.toBeNull();
    const front = ownedBusinesses(state)[0]!;
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'lean');
    expect(front.terms ?? [], 'frightening somebody bought out their share').toContain('he_stays');
  });

  it('pays the frightened street money the button named', () => {
    const state = world();
    const built = raise(state, 'gen_they_are_frightened');
    expect(built, 'the shape did not fire against a feared family').not.toBeNull();

    const label = built!.choices.find((c) => c.id === 'take')!.label;
    const named = Number(label.replace(/[^0-9]/g, ''));
    expect(named, 'the button does not name a figure').toBeGreaterThan(0);

    const before = state.org.dirtyCash;
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'take');
    expect(state.org.dirtyCash - before, 'the envelope was not what it said').toBe(named);
  });

  it('will not offer a collection to a family nobody is afraid of', () => {
    const state = world();
    state.org.fear = 0;
    const def = GEN_DEFS.find((d) => d.id === 'gen_they_are_frightened')!;
    expect(def.applies(state, new Rng(state.rng))).toBeNull();
  });
});

/*
   2026-09-10 polish pass, Section 17: family occasionally has to conflict
   with business, with a real cost either way — not just a free nag. Checked
   on the property the generic sweep above cannot see: the levers named in
   the choice hints are the levers that actually move.
*/
describe('a real choice between business and family', () => {
  function raise(state: GameState) {
    const def = GEN_DEFS.find((d) => d.id === 'gen_home_or_business')!;
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng);
    if (!ctx) return null;
    const built = def.build(state, rng, ctx);
    state.pendingEvents.push({ ...built, id: 'evt_test', day: state.day });
    return built;
  }

  it('pays a real night\'s take for staying, and refuses the house harder than silence would', () => {
    const state = world();
    home(state).neglect = 60;
    expect(raise(state), 'the shape did not fire against a neglected house').not.toBeNull();

    const beforeCash = state.org.dirtyCash;
    const beforeNeglect = home(state).neglect;
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'stay');

    expect(state.org.dirtyCash, 'staying paid nothing').toBeGreaterThan(beforeCash);
    expect(home(state).neglect, 'refusing outright did not cost more than staying quiet').toBeGreaterThan(
      beforeNeglect,
    );
  });

  it('going home still clears the account, at a small cost to respect', () => {
    const state = world();
    home(state).neglect = 60;
    home(state).lastVisitDay = state.day - 30;
    state.org.respect = 20;
    expect(raise(state), 'the shape did not fire').not.toBeNull();

    const beforeRespect = state.org.respect;
    const beforeNeglect = home(state).neglect;
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'go');

    expect(home(state).neglect, 'going home did not clear anything').toBeLessThan(beforeNeglect);
    expect(state.org.respect, 'going home cost nothing').toBeLessThan(beforeRespect);
  });
});

/*
   The milestone occasions: school event, quiet evening, sick relative,
   celebration. Built to close a gap `gen_home_or_business` and
   `gen_asked_for_you` leave: both wait for `house.neglect` to cross
   `GEN_WHEN.neglect`, so a boss who visits home regularly and keeps the
   number down on purpose never meets either one. These four do not read
   neglect at all.
*/
describe('the milestone family dilemmas', () => {
  function raise(state: GameState) {
    const def = GEN_DEFS.find((d) => d.id === 'gen_family_dilemma')!;
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng);
    if (!ctx) return null;
    const built = def.build(state, rng, ctx);
    state.pendingEvents.push({ ...built, id: 'evt_test', day: state.day });
    return built;
  }

  it('offers three choices: attend, send, or stay away', () => {
    const state = world();
    const built = raise(state);
    expect(built, 'the shape did not fire').not.toBeNull();
    expect(built!.choices.map((c) => c.id).sort()).toEqual(['attend', 'send', 'stay']);
  });

  /*
     The property that makes this shape worth having over the two it sits
     beside: it must be reachable by a boss who has been keeping neglect
     down on purpose, not just one the house has already noticed is gone.
     Proven by reverting `applies` to also require
     `house.neglect >= GEN_WHEN.neglect` and watching this go red before
     restoring it — see the session's own report for that run.
  */
  it('fires even though the house is not neglected at all', () => {
    const state = world();
    home(state).neglect = 0;
    const def = GEN_DEFS.find((d) => d.id === 'gen_family_dilemma')!;
    expect(
      def.applies(state, new Rng(state.rng)),
      'a boss who keeps neglect at zero should still meet this shape',
    ).not.toBeNull();
  });

  /*
     Attend spends the same body `goHome` itself spends, and the guard was
     watched failing first: with `goHome(state)` and the extra-clear line
     both commented out of the resolver, this test reported the op still
     launching and neglect unchanged. Restored afterwards.
  */
  it('attending blocks a zero-crew op that same evening, and clears neglect substantially', () => {
    const state = world();
    home(state).neglect = 60;
    const before = home(state).neglect;
    expect(raise(state), 'the shape did not fire').not.toBeNull();

    resolveEvent(state, new Rng(state.rng), 'evt_test', 'attend');

    expect(home(state).neglect, 'attending did not clear anything').toBeLessThan(before);

    const def = OPERATION_BY_ID['work_it_yourself'];
    expect(
      canLaunch(state, def, [], HOME_TERRITORY).ok,
      "the boss's own body was not spent on the visit",
    ).toBe(false);
  });

  it('sending costs money and nudges neglect up, only modestly', () => {
    const state = world();
    home(state).neglect = 20;
    const beforeFunds = totalFunds(state);
    const beforeNeglect = home(state).neglect;
    expect(raise(state), 'the shape did not fire').not.toBeNull();

    resolveEvent(state, new Rng(state.rng), 'evt_test', 'send');

    expect(totalFunds(state), 'sending something instead cost nothing').toBeLessThan(beforeFunds);
    expect(home(state).neglect, 'sending did not move neglect at all').toBeGreaterThan(beforeNeglect);
  });

  it('staying away spikes neglect far harder than sending does', () => {
    const sendState = world();
    home(sendState).neglect = 20;
    raise(sendState);
    resolveEvent(sendState, new Rng(sendState.rng), 'evt_test', 'send');
    const sendRise = home(sendState).neglect - 20;

    const stayState = world();
    home(stayState).neglect = 20;
    raise(stayState);
    resolveEvent(stayState, new Rng(stayState.rng), 'evt_test', 'stay');
    const stayRise = home(stayState).neglect - 20;

    expect(stayRise, 'staying away did not cost more than sending something').toBeGreaterThan(sendRise);
  });

  /*
     `neglectRisk` already reads `home(state).neglect` directly (see
     `personal.ts`), so staying away has to move the deposition multiplier
     with no further plumbing — proving that is proving there is no second,
     separate risk hook to keep in sync with this one.
  */
  it('raises neglectRisk automatically after staying away, with no separate plumbing', () => {
    const state = world();
    home(state).neglect = HOME.depositionFrom - 2;
    const before = neglectRisk(state);
    expect(raise(state), 'the shape did not fire').not.toBeNull();

    resolveEvent(state, new Rng(state.rng), 'evt_test', 'stay');

    expect(neglectRisk(state), 'the spike did not touch the multiplier it is supposed to feed').toBeGreaterThan(
      before,
    );
  });

  it('fires on the same day, with the same content, for the same seed', () => {
    /*
       Everything else has to be drained too, or the first three unrelated
       memos this career raises fill `MAX_PENDING` and `tickEvents` stops
       drawing at all for the rest of the run -- which would make this test
       measure the pending-event cap, not this shape.
    */
    function firstFire(seed: number): { day: number; title: string; body: string } | null {
      const state = newGame({ name: 'Determinism', difficulty: 'normal', seed });
      for (let i = 0; i < 500; i++) {
        advanceDay(state);
        const evt = state.pendingEvents.find((e) => e.defId === 'gen_family_dilemma');
        if (evt) return { day: state.day, title: evt.title, body: evt.body };
        answerFirst(state, new Rng(state.rng));
      }
      return null;
    }

    const a = firstFire(4242);
    const b = firstFire(4242);
    expect(a, 'never fired across 500 days on this seed').not.toBeNull();
    expect(b).toEqual(a);
  });
});

/*
   Milestone 4: `teen_trouble`. Folded into `FAMILY_DILEMMAS`/`gen_family_dilemma`
   itself rather than a separate shape — it is the same attend/send/stay
   structure as the other four occasions, just gated to the teen life stage
   on top of the existing relation check. `celebration`'s own `relationIds`
   cover every relation, so a household with a teenager in it always has at
   least one other dilemma eligible too; these tests draw many times off a
   fixed rng rather than asserting on one draw, the same technique
   `firstFire` above uses for a property that depends on which of several
   eligible occasions gets picked.
*/
describe('teen trouble', () => {
  /** A fresh household of one, aged precisely, and clear to go home. */
  function householdState(relationId: 'eldest' | 'youngest', age: number): GameState {
    const state = newGame({ name: 'Teen', difficulty: 'normal', seed: 5 });
    home(state).people[0] = { name: 'Kid', relationId };
    const base = memberAge(state, 'Kid', relationId)!;
    state.day = (age - base) * 365 + 1;
    home(state).lastVisitDay = state.day - 30;
    return state;
  }

  function drawnDilemmaIds(state: GameState, tries: number): Set<string> {
    const def = GEN_DEFS.find((d) => d.id === 'gen_family_dilemma')!;
    const ids = new Set<string>();
    for (let i = 0; i < tries; i++) {
      const ctx = def.applies(state, new Rng({ seed: 909, calls: i * 11 }));
      if (ctx?.familyDilemmaId) ids.add(String(ctx.familyDilemmaId));
    }
    return ids;
  }

  it('is in FAMILY_DILEMMAS, gated to the teen stage, with an $800 lawyer', () => {
    const def = FAMILY_DILEMMAS.find((d) => d.id === 'teen_trouble')!;
    expect(def.stages).toEqual(['teen']);
    expect(def.relationIds.slice().sort()).toEqual(['eldest', 'youngest']);
    expect(def.sendCost).toBe(800);
  });

  it('can be drawn for a household with a teenager in it', () => {
    const state = householdState('eldest', 15);
    expect(drawnDilemmaIds(state, 80).has('teen_trouble')).toBe(true);
  });

  /*
     The guard that actually justifies the `stages` field: proven failing by
     temporarily dropping the `d.stages` check out of `dilemmaFits`
     (`sim/eventgen.ts`) — with the gate gone, `teen_trouble` also came up
     for both a 10-year-old and a 25-year-old in this same run. Restored
     afterwards; see the session's own report for that run.
  */
  it('is never drawn for the same relation as a child or as an adult', () => {
    expect(drawnDilemmaIds(householdState('eldest', 10), 80).has('teen_trouble')).toBe(false);
    expect(drawnDilemmaIds(householdState('eldest', 25), 80).has('teen_trouble')).toBe(false);
  });

  it('offers the same attend/send/stay shape as every other family dilemma, with the lawyer as "send"', () => {
    const state = householdState('youngest', 15);
    const def = GEN_DEFS.find((d) => d.id === 'gen_family_dilemma')!;
    let built: ReturnType<typeof def.build> | null = null;
    for (let i = 0; i < 200 && !built; i++) {
      const rng = new Rng({ seed: 909, calls: i * 11 });
      const ctx = def.applies(state, rng);
      if (ctx?.familyDilemmaId === 'teen_trouble') built = def.build(state, rng, ctx);
    }
    expect(built, 'teen_trouble never came up to build across 200 tries').not.toBeNull();
    expect(built!.choices.map((c) => c.id).sort()).toEqual(['attend', 'send', 'stay']);
    const send = built!.choices.find((c) => c.id === 'send')!;
    expect(send.hint).toContain(money(priced(state, 800)));
  });
});

/*
   Milestone 3: the panic episode. The only shape whose subject is the boss
   himself — gated on `playerStress` alone, per `STRESS.panicThreshold` in
   `config/personal.ts`.
*/
describe('the panic episode', () => {
  function raise(state: GameState) {
    const def = GEN_DEFS.find((d) => d.id === 'gen_panic_episode')!;
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng);
    if (!ctx) return null;
    const built = def.build(state, rng, ctx);
    state.pendingEvents.push({ ...built, id: 'evt_test', day: state.day });
    return built;
  }

  /*
     Item 6 of the brief's own list: refuses below the threshold, fires at
     and above it.

     Watched to fail: with the `playerStress(state) < STRESS.panicThreshold`
     guard in `applies` commented out, this shape fired against the untouched
     `world()` fixture (stress 0) and the first assertion below went red.
     Restored afterwards.
  */
  it('refuses below the threshold and fires at or above it', () => {
    const low = world();
    low.player.stress = STRESS.panicThreshold - 1;
    const defLow = GEN_DEFS.find((d) => d.id === 'gen_panic_episode')!;
    expect(defLow.applies(low, new Rng(low.rng)), 'fired below its own threshold').toBeNull();

    const high = world();
    high.player.stress = STRESS.panicThreshold;
    expect(raise(high), 'did not fire at the threshold').not.toBeNull();
  });

  it('does not fire while the boss is already spoken for tonight', () => {
    const state = world();
    launchOperation(state, 'work_it_yourself', [], HOME_TERRITORY);
    expect(bodySpentTonight(state), 'the fixture should have the body spent').toBe(true);
    const def = GEN_DEFS.find((d) => d.id === 'gen_panic_episode')!;
    expect(def.applies(state, new Rng(state.rng))).toBeNull();
  });

  it('offers three choices: a house call, pushing through, or sedatives', () => {
    const state = world();
    const built = raise(state);
    expect(built, 'the shape did not fire').not.toBeNull();
    expect(built!.choices.map((c) => c.id).sort()).toEqual(['house_call', 'push_through', 'sedatives']);
  });

  it('the house call clears stress at cost and spends the evening', () => {
    const state = world();
    expect(raise(state)).not.toBeNull();
    const before = totalFunds(state);
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'house_call');

    expect(totalFunds(state)).toBeLessThan(before);
    expect(playerStress(state)).toBeCloseTo(STRESS.panicThreshold - GEN_EFFECT.panicHouseCallClear, 5);
    expect(state.flags['went_home_day']).toBe(state.day);
  });

  it('pushing through is free, spikes stress, and costs a little respect', () => {
    const state = world();
    state.org.respect = 50; // room for the penalty to show against the floor at 0
    expect(raise(state)).not.toBeNull();
    const cashBefore = totalFunds(state);
    const respectBefore = state.org.respect;
    const wentHomeBefore = state.flags['went_home_day'];
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'push_through');

    expect(totalFunds(state), 'push through is supposed to be free').toBe(cashBefore);
    expect(playerStress(state)).toBeCloseTo(STRESS.panicThreshold + GEN_EFFECT.panicPushThroughStressSpike, 5);
    expect(state.org.respect).toBeLessThan(respectBefore);
    expect(state.flags['went_home_day'], 'pushing through should not spend the evening').toBe(wentHomeBefore);
  });

  /*
     Item 7: the sedatives debuff, proven at the exact boundary.

     Watched to fail: with the `sedated_until_day` stamp commented out of the
     `sedatives` branch in `resolveGenerated`, `stressLeadershipMultiplier`
     read 1 on both days below and this test's second half went red.
     Restored afterwards.
  */
  it('sedatives clear less, do not spend the evening, and dull for a fixed week', () => {
    const state = world();
    expect(raise(state)).not.toBeNull();
    const wentHomeBefore = state.flags['went_home_day'];
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'sedatives');

    expect(playerStress(state)).toBeCloseTo(STRESS.panicThreshold - GEN_EFFECT.panicSedativeClear, 5);
    expect(
      GEN_EFFECT.panicSedativeClear,
      'the pills are supposed to clear less than the house call',
    ).toBeLessThan(GEN_EFFECT.panicHouseCallClear);
    expect(state.flags['went_home_day'], 'sedatives should not spend the evening').toBe(wentHomeBefore);
    expect(state.flags['sedated_until_day']).toBe(state.day + STRESS.sedatedDays);
  });
});

/*
   Milestone 4: the family crossroads. One household member's 18th birthday,
   handled once per person rather than as a recurring occasion — see
   `state.flags['crossroads_resolved_<relationId>']` in `sim/eventgen.ts`.
   No fourth term on `legitimacy()` for any of the three answers: that
   formula (`sim/legacy.ts`) is untouched by this milestone on purpose — see
   `CLAUDE.md`'s own correction on this point.
*/
describe('the family crossroads', () => {
  /** A fresh household of one, aged precisely relative to their 18th year,
   * with money enough that affordability is never what is under test. */
  function adultState(relationId: 'eldest' | 'youngest' = 'eldest', yearsPast18 = 2): GameState {
    const state = newGame({ name: 'Crossroads', difficulty: 'normal', seed: 7 });
    home(state).people[0] = { name: 'Junior', relationId };
    const base = memberAge(state, 'Junior', relationId)!;
    state.day = (18 - base + yearsPast18) * 365 + 1;
    state.org.cash = 50_000;
    return state;
  }

  function crossroadsDef() {
    return GEN_DEFS.find((d) => d.id === 'gen_family_crossroads')!;
  }

  function raise(state: GameState) {
    const def = crossroadsDef();
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng);
    if (!ctx) return null;
    const built = def.build(state, rng, ctx);
    state.pendingEvents.push({ ...built, id: 'evt_test', day: state.day });
    return built;
  }

  it('does not apply before 18', () => {
    const state = adultState('eldest', -3); // three years shy of 18
    expect(crossroadsDef().applies(state, new Rng(state.rng))).toBeNull();
  });

  it('applies at 18, offers all three choices, and does not itself move legitimacy', () => {
    const state = adultState();
    const before = legitimacy(state);
    const built = raise(state);
    expect(built, 'the shape did not fire').not.toBeNull();
    expect(built!.choices.map((c) => c.id).sort()).toEqual(['bring_in', 'college', 'let_go']);
    // Raising the memo alone changes nothing yet — legitimacy is a read, not
    // a side effect of a memo merely existing.
    expect(legitimacy(state)).toBe(before);
  });

  /*
     Point 5's own requirement: a flag, not a re-derivable "eligible" check,
     so the same member cannot be offered this twice. Watched to fail: with
     `state.flags[crossroads_resolved_...]` commented out of the 'let_go'
     path in `resolveGenerated`, this went red — `applies` fired again for
     the same member on the very next check. Restored afterwards.
  */
  it('fires at most once for the same household member', () => {
    const state = adultState();
    expect(raise(state)).not.toBeNull();
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'let_go');

    expect(
      crossroadsDef().applies(state, new Rng(state.rng)),
      'the same member should not be offered the crossroads twice',
    ).toBeNull();
  });

  it('college: real money, real neglect clear, no Npc, and a career record instead of a fabricated number', () => {
    const state = adultState();
    home(state).neglect = 50;
    const beforeCash = totalFunds(state);
    const beforeNeglect = home(state).neglect;
    const beforeNpcs = Object.keys(state.npcs).length;
    const beforeCareer = career(state).length;
    expect(raise(state)).not.toBeNull();

    resolveEvent(state, new Rng(state.rng), 'evt_test', 'college');

    expect(totalFunds(state)).toBeLessThan(beforeCash);
    expect(home(state).neglect).toBeLessThan(beforeNeglect);
    expect(Object.keys(state.npcs).length).toBe(beforeNpcs);
    expect(career(state).length).toBeGreaterThan(beforeCareer);
  });

  it('bring_in: real money, real neglect clear, and a real Npc on the roster', () => {
    const state = adultState();
    home(state).neglect = 50;
    const beforeCash = totalFunds(state);
    const beforeNeglect = home(state).neglect;
    expect(raise(state)).not.toBeNull();

    resolveEvent(state, new Rng(state.rng), 'evt_test', 'bring_in');

    expect(totalFunds(state)).toBeLessThan(beforeCash);
    expect(home(state).neglect).toBeLessThan(beforeNeglect);
    const hire = Object.values(state.npcs).find((n) => n.name === 'Junior');
    expect(hire, 'no Npc was created for the household member brought in').toBeDefined();
    expect(hire!.role).toBe('soldier');
  });

  it('bring_in: lands a real grievance on a real active capo, when there is one', () => {
    const state = adultState();
    const capo = generateNpc(state, new Rng(state.rng), 'capo');
    capo.stats.grievance = 10;
    state.npcs[capo.id] = capo;
    expect(activeCapos(state)).toHaveLength(1);
    expect(raise(state)).not.toBeNull();

    resolveEvent(state, new Rng(state.rng), 'evt_test', 'bring_in');

    expect(capo.stats.grievance).toBeGreaterThan(10);
  });

  /*
     Point 7's own requirement: silently skipped, not forced, when there is
     no capo to carry it. Watched to fail: with the `capos.length` guard
     removed from the `bring_in` branch, this threw calling `rng.pick` on an
     empty array instead of completing quietly. Restored afterwards.
  */
  it('bring_in: skips the capo grievance silently when there is no capo at all', () => {
    const state = adultState();
    expect(activeCapos(state)).toHaveLength(0);
    expect(raise(state)).not.toBeNull();
    expect(() => resolveEvent(state, new Rng(state.rng), 'evt_test', 'bring_in')).not.toThrow();
  });

  it('let_go: costs nothing, and neglect rises rather than falls', () => {
    const state = adultState();
    home(state).neglect = 50;
    const beforeCash = totalFunds(state);
    expect(raise(state)).not.toBeNull();

    resolveEvent(state, new Rng(state.rng), 'evt_test', 'let_go');

    expect(totalFunds(state)).toBe(beforeCash);
    expect(home(state).neglect).toBeGreaterThan(50);
  });
});

describe('answering one', () => {
  it('resolves every choice of every shape without leaving the memo behind', () => {
    let checked = 0;

    for (const def of GEN_DEFS) {
      const probe = world();
      const probeRng = new Rng(probe.rng);
      const ctx = def.applies(probe, probeRng);
      const choices = ctx ? def.build(probe, probeRng, ctx).choices : [];
      expect(choices.length, `${def.id} produced no choices to exercise`).toBeGreaterThan(0);

      for (const choice of choices) {
        // A fresh world per choice, so one branch cannot set up the next.
        const state = world();
        const rng = new Rng(state.rng);
        const fresh = def.applies(state, rng);
        if (!fresh) continue;
        const built = def.build(state, rng, fresh);
        state.pendingEvents.push({ ...built, id: 'evt_test', day: state.day });

        expect(() => resolveEvent(state, rng, 'evt_test', choice.id)).not.toThrow();
        expect(
          state.pendingEvents.find((e) => e.id === 'evt_test'),
          `${def.id}/${choice.id} left the memo in the queue`,
        ).toBeUndefined();
        expect(Number.isFinite(state.org.cash), `${def.id}/${choice.id} broke the money`).toBe(true);
        expect(state.org.cash, `${def.id}/${choice.id} spent past zero`).toBeGreaterThanOrEqual(0);
        checked += 1;
      }
    }

    // The instrument: a loop that checked nothing would pass in silence.
    expect(checked, 'no generated choice was actually exercised').toBeGreaterThanOrEqual(15);
  });

  /*
     A priced answer the player cannot afford must not quietly do the free
     thing. That is the defect `loyalty_gesture` carries a comment about, and
     the generated memos price three of their answers.
  */
  it('does not hand over the goods when the money is not there', () => {
    const state = world();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    const rng = new Rng(state.rng);

    const def = GEN_DEFS.find((d) => d.id === 'gen_street_turning')!;
    const ctx = def.applies(state, rng)!;
    const built = def.build(state, rng, ctx);
    const before = state.territories[String(built.data.territoryId)].sentiment;

    state.pendingEvents.push({ ...built, id: 'evt_broke', day: state.day });
    resolveEvent(state, rng, 'evt_broke', 'spend');

    expect(
      state.territories[String(built.data.territoryId)].sentiment,
      'the street was bought with money that did not exist',
    ).toBe(before);
  });

  it('marks its own memos so the resolver can find them', () => {
    expect(GEN_DEFS.every((d) => isGenerated(d.id))).toBe(true);
    expect(isGenerated('promotion_demand')).toBe(false);
  });
});

/*
   Round 15's second MUST FIX, and the guard against it coming back.

   The tester paid Emilio Petrosino on day 202, again on day 215, again on day
   225, each time against an option reading "and the matter is closed". They
   paid Dana Vitale on days 45, 101, 174 and 226 — four times, always about the
   same injury from day 9.

     "It turned the whole crew-management layer into a subscription. I stopped
     believing that anything I did for my people mattered — which is precisely
     the emotional register the rest of the game is built to earn."

   The shape fires on grievance **or** low loyalty, and paying moved loyalty by
   seven. A man at "looking for the door" was still at "looking for the door"
   afterwards, so the loyalty branch re-armed immediately.
*/
describe('answering somebody settles it', () => {
  function aggrieved(): { state: GameState; man: Npc } {
    const state = world();
    const crew = crewList(state).filter((n) => n.status !== 'dead');
    const man = crew[0];
    man.stats.grievance = 90;
    // The state that made this a subscription: paying could not clear the
    // loyalty branch, so the same man came back every fortnight for ever.
    man.stats.loyalty = 15;
    /*
       Only `man` should be eligible for `gen_wants_a_word`. `world()`'s sixty
       real days of warm-up drift every crew member's loyalty and grievance
       for genuine, in-fiction reasons — before this pass, that never happened
       to land a second person on the wrong side of GEN_WHEN's bar for this
       fixed seed, but nothing here ever guaranteed it wouldn't, and it now
       does. Normalized explicitly rather than left to the luck of one seed's
       sixty-day drift, so this test is deterministic by construction.
    */
    for (const other of crew) {
      if (other.id === man.id) continue;
      other.stats.grievance = 0;
      other.stats.loyalty = 70;
    }
    return { state, man };
  }

  it('does not raise the same person again straight away', () => {
    const { state, man } = aggrieved();
    const def = GEN_DEFS.find((d) => d.id === 'gen_wants_a_word')!;
    const rng = new Rng(state.rng);

    const ctx = def.applies(state, rng);
    expect(ctx?.npc?.id, 'the aggrieved man was not the subject').toBe(man.id);

    const built = def.build(state, rng, ctx!);
    state.pendingEvents.push({ ...built, id: 'evt_word', day: state.day });
    resolveEvent(state, rng, 'evt_word', 'pay');

    // Same day, and for a good while after.
    expect(def.applies(state, new Rng(state.rng))).toBeNull();
    state.day += GEN_WHEN.askedAgainAfterDays - 1;
    expect(
      def.applies(state, new Rng(state.rng)),
      'the same man came back inside the cooldown',
    ).toBeNull();
  });

  /*
     And it is the answer that settles it, not merely the asking. A cooldown
     alone would be a mute button; paying has to actually move the man.
  */
  it('leaves a paid man out of the state that raised it', () => {
    const { state, man } = aggrieved();
    const def = GEN_DEFS.find((d) => d.id === 'gen_wants_a_word')!;
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng)!;
    const built = def.build(state, rng, ctx);
    state.pendingEvents.push({ ...built, id: 'evt_word', day: state.day });
    resolveEvent(state, rng, 'evt_word', 'pay');

    expect(man.stats.grievance, 'paying did not settle the grievance').toBeLessThan(
      GEN_WHEN.grievance,
    );
    expect(
      man.stats.loyalty,
      'paying could not clear the loyalty bar that also raises this memo',
    ).toBeGreaterThan(GEN_WHEN.loyaltyUnder - 10);
  });

  /*
     A man raises what happened to him recently. Round 15 watched the same
     injury from day 9 cited on days 45, 101, 174 and 226.
  */
  it('does not raise a grievance from another year', () => {
    const state = world();
    const man = crewList(state).filter((n) => n.status !== 'dead')[0];
    man.stats.grievance = 90;
    man.memories = [
      { kind: 'was_hurt', day: state.day - (GEN_WHEN.grievanceStaleAfterDays + 60), aboutId: null, weight: 40 },
    ];
    man.notes = [];

    const def = GEN_DEFS.find((d) => d.id === 'gen_wants_a_word')!;
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng)!;
    const built = def.build(state, rng, ctx);

    expect(
      built.body,
      'a two-hundred-day-old injury is still being walked into the room',
    ).not.toMatch(/hurt working for you/);
  });
});
