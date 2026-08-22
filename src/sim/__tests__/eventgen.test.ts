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
import { EVENT_DEF_BY_ID, resolveEvent } from '../events';
import { GEN_DEFS, isGenerated } from '../eventgen';
import { GEN_SHAPES, GEN_WHEN } from '../../config/eventgen';
import { acquireBusiness, ownedBusinesses } from '../business';
import { crewList, generateNpc } from '../npc';
import { HOME_TERRITORY } from '../../config/territories';
import { territoryList } from '../territory';
import { figure } from '../civic';
import { home } from '../personal';
import { runDays } from './helpers';
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
    const man = crewList(state).filter((n) => n.status !== 'dead')[0];
    man.stats.grievance = 90;
    // The state that made this a subscription: paying could not clear the
    // loyalty branch, so the same man came back every fortnight for ever.
    man.stats.loyalty = 15;
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
