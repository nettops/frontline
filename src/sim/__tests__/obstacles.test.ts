/**
 * An obstacle a broke boss cannot answer is not an obstacle.
 *
 * Round 15 spent 126 days in a state where every priced option on every event
 * was greyed out:
 *
 *   *"On day 202 I was offered three ways to stop Maria Vitale flipping and
 *   could afford none of them; the only clickable option was 'Leave them to
 *   it.' That is not a decision, it is a cutscene with a button."*
 *
 * The game keeps six things a boss can spend other than money — people, ground,
 * standing, reputation, time and favours — and the back half of that run never
 * asked for any of them. Every problem resolved to a price.
 *
 * So: **an event that asks for money must also offer something that does not.**
 * Not a "leave it" — leaving it is always available and is the absence of a
 * decision. Something that changes the world, reachable by somebody holding
 * nothing.
 *
 * This is a property of the catalogue rather than of any one event, which is
 * why it is checked here rather than in `events.test.ts`: the failure mode is
 * a *class* of memo drifting toward being priced, and nobody notices because
 * each one is individually reasonable.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { EVENT_DEF_BY_ID, resolveEvent } from '../events';
import { crewList, generateNpc } from '../npc';
import { acquireBusiness, ownedBusinesses } from '../business';
import { figure } from '../civic';
import { home } from '../personal';
import { territoryList } from '../territory';
import { HOME_TERRITORY } from '../../config/territories';
import { runDays } from './helpers';
import type { GameState, PendingEvent } from '../types';

/**
 * A world rich enough to raise most of the catalogue, then emptied of cash.
 *
 * Built rather than played toward, for the same reason `eventgen.test.ts`
 * builds its own: waiting for a seed that happens to produce all of this makes
 * the coverage depend on luck, and the branch that is never reached is always
 * the branch that matters.
 */
function brokeButBusy(seed = 31): GameState {
  const state = newGame({ name: 'Skint', difficulty: 'normal', seed });
  runDays(state, 45, new Rng(state.rng));

  const hireRng = new Rng(state.rng);
  for (const role of ['soldier', 'soldier', 'soldier', 'associate'] as const) {
    const npc = generateNpc(state, hireRng, role);
    state.npcs[npc.id] = npc;
  }
  for (const t of territoryList(state)) t.influence.player = 45;

  state.org.cash = 400_000;
  acquireBusiness(state, 'laundromat', HOME_TERRITORY);
  const front = ownedBusinesses(state)[0];
  if (front) front.health = 30;

  for (const t of territoryList(state)) t.sentiment = 20;
  const crew = crewList(state).filter((n) => n.status !== 'dead');
  if (crew[0]) {
    crew[0].stats.grievance = 90;
    crew[0].stats.loyalty = 20;
  }
  if (crew[1]) {
    crew[1].status = 'arrested';
    crew[1].unavailableUntilDay = state.day + 30;
  }
  figure(state, 'captain').standing = 30;
  home(state).neglect = 60;
  state.org.heat = 70;

  // And then the thing the whole file is about.
  state.org.cash = 0;
  state.org.dirtyCash = 0;
  state.org.holdings = 0;
  for (const key of Object.keys(state.flags)) {
    if (key.startsWith('asked_')) delete state.flags[key];
  }
  return state;
}

/** A cheap reading of "did anything happen at all". */
function fingerprint(state: GameState): string {
  const crew = crewList(state)
    .map((n) => `${n.id}:${Math.round(n.stats.loyalty)}:${Math.round(n.stats.grievance)}:${n.status}:${n.notes.length}:${n.memories.length}`)
    .join('|');
  const ground = territoryList(state)
    .map((t) => `${Math.round(t.sentiment)}:${Math.round(t.influence.player ?? 0)}`)
    .join('|');
  const fronts = Object.values(state.businesses)
    .map((b) => `${Math.round(b.health)}:${Math.round(b.exposure)}:${b.status}:${b.pressure ?? ''}`)
    .join('|');
  /*
     Civic standing belongs here, and leaving it out produced a false finding
     on the first run: `gen_someone_outside`'s free answer moves a figure's
     regard and nothing else, so a fingerprint that could not see standing
     reported the option as inert. An instrument that cannot see the effect it
     is looking for will report that the effect is missing.
  */
  const outside = (state.civic ?? []).map((f) => `${f.id}:${Math.round(f.standing)}:${f.owed}`).join('|');
  return [
    outside,
    state.log.length,
    Math.round(state.org.respect),
    Math.round(state.org.fear),
    Math.round(state.org.heat),
    state.org.layLowUntilDay ?? 0,
    state.law.lawyer,
    Math.round(state.home?.neglect ?? 0),
    crew,
    ground,
    fronts,
  ].join('#');
}

/** Every event the catalogue can raise against the world above. */
function raisable(): { id: string; built: Omit<PendingEvent, 'id' | 'day'> }[] {
  const out: { id: string; built: Omit<PendingEvent, 'id' | 'day'> }[] = [];
  for (const def of Object.values(EVENT_DEF_BY_ID)) {
    const state = brokeButBusy();
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng);
    if (!ctx) continue;
    out.push({ id: def.id, built: def.build(state, rng, ctx) });
  }
  return out;
}

describe('what a boss with nothing can still do', () => {
  /*
     The instrument. A world that raises three events would pass everything
     below while measuring almost none of the catalogue.
  */
  it('raises enough of the catalogue to be worth asserting about', () => {
    const raised = raisable();
    expect(
      raised.length,
      'the fixture raises almost nothing, so nothing below is a statement about the game',
    ).toBeGreaterThanOrEqual(8);
  });

  /*
     The rule.

     Only events that ask for money are held to it — an event with no price
     never put anybody in round 15's position. And a free choice only counts if
     it *does* something: "Leave them to it" is always available and is the
     absence of a decision, which is exactly what the tester was complaining
     about being handed.
  */
  it('never asks for money without offering something that is not money', () => {
    const mute: string[] = [];

    for (const { id, built } of raisable()) {
      const priced = built.choices.filter((c) => (c.cost ?? 0) > 0);
      if (priced.length === 0) continue;

      const free = built.choices.filter((c) => !(c.cost ?? 0));
      let anyFreeChoiceDidSomething = false;

      for (const choice of free) {
        const state = brokeButBusy();
        const rng = new Rng(state.rng);
        const def = EVENT_DEF_BY_ID[id];
        const ctx = def.applies(state, rng);
        if (!ctx) continue;
        const fresh = def.build(state, rng, ctx);
        state.pendingEvents.push({ ...fresh, id: 'evt_probe', day: state.day });

        const before = fingerprint(state);
        resolveEvent(state, rng, 'evt_probe', choice.id);
        if (fingerprint(state) !== before) {
          anyFreeChoiceDidSomething = true;
          break;
        }
      }

      if (!anyFreeChoiceDidSomething) {
        mute.push(`${id}: ${priced.length} priced, ${free.length} free, none of the free ones move anything`);
      }
    }

    expect(
      mute,
      'a boss holding nothing is shown a problem and given no answer to it:' +
        String.fromCharCode(10) +
        mute.join(String.fromCharCode(10)),
    ).toEqual([]);
  });

  /*
     And the weaker half, which catches the case above before it gets that far:
     an event whose every option carries a price cannot be answered at all.
  */
  it('never presents a problem where every answer costs money', () => {
    const allPriced = raisable()
      .filter(({ built }) => built.choices.every((c) => (c.cost ?? 0) > 0))
      .map(({ id }) => id);

    expect(allPriced, 'every option on these costs money').toEqual([]);
  });
});
