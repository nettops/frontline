/**
 * What the street decides to call you.
 *
 * See `config/nicknames.ts` for the design. The short of it: you do not pick
 * it, the roll only ever draws from names the career actually earned, and what
 * it grants is a point in a stat or a share of what comes in.
 *
 * A leaf module in the same shape as `build.ts` — it reads the world, derives
 * a name, and hands out an answer when asked. The one place it reaches outward
 * is `statLevel`, which adds the granted point so that a name counts toward a
 * verb. That is deliberate and it is the whole reason a name is worth having.
 */

import type { GameState } from './types';
import { Rng } from './rng';
import { addLog } from './util';
import { crewList } from './npc';
import { controlledTerritories } from './territory';
import { ownedBusinesses } from './business';
import { legitimacy } from './legacy';
import {
  NICKNAME,
  NICKNAMES,
  NICKNAME_BY_ID,
  type CareerFacts,
  type NicknameDef,
} from '../config/nicknames';
import type { StatId } from '../config/build';

/** The name, if the street has settled on one. */
export function nicknameOf(state: GameState): NicknameDef | null {
  const held = state.player.nickname;
  return held ? (NICKNAME_BY_ID[held.id] ?? null) : null;
}

/**
 * What the street has actually seen, gathered once.
 *
 * Every figure is read off state that already exists. A name that needed a
 * counter invented for it would be a name about something the game does not
 * model, which is how flavour ends up describing a world nobody is playing.
 */
export function careerFacts(state: GameState): CareerFacts {
  const crew = crewList(state);
  return {
    day: state.day,
    fear: state.org.fear,
    respect: state.org.respect,
    notoriety: state.city?.notoriety ?? 0,
    legitimacy: legitimacy(state),
    heat: state.org.heat,
    done: state.player.opsCompleted,
    failed: state.player.opsFailed,
    districts: controlledTerritories(state).length,
    fronts: ownedBusinesses(state).length,
    crew: crew.filter((n) => n.status === 'active' || n.status === 'busy').length,
    /*
       Summed off the fronts rather than kept as a running total.

       `Business.launderedTotal` is already the record of what each front has
       moved, and adding a second counter beside it would be a second thing to
       keep true — the failure this project names in its own handoff.
    */
    laundered: ownedBusinesses(state).reduce((sum, b) => sum + (b.launderedTotal ?? 0), 0),
    estate: state.org.record?.estate ?? 0,
    /*
       People dealt with, counted off the notes rather than tallied.

       `silence.ts` writes a note on the man it happened to and keeps no
       counter, which is correct — the record of a thing like that belongs on
       the person it happened to.
    */
    silenced: crew.filter((n) => n.notes?.some((x) => x.text.includes('You decided they were finished'))).length,
    walked: crew.filter((n) => n.status === 'defected').length,
    wentInside: (state.org.insideUntilDay ?? 0) > 0,
  };
}

/**
 * The names this career could be given.
 *
 * The pool, not the catalogue. A boss who never hurt anybody cannot come out
 * of this called The Hammer however the roll falls, and that is the property
 * the whole feature rests on.
 */
export function earnedNames(state: GameState): NicknameDef[] {
  if (state.day < NICKNAME.notBeforeDay) return [];
  if (state.org.respect < NICKNAME.respectFrom) return [];
  const facts = careerFacts(state);
  return NICKNAMES.filter((def) => def.id !== state.player.nickname?.id && def.needs(facts));
}

/**
 * Weekly. The street reconsiders.
 *
 * Low chance on purpose, so a name arrives at a moment the player was not
 * counting down to. A career that has been one thing for long enough will get
 * one; a career that has been three things may wait a while for the city to
 * decide which.
 */
export function tickNickname(state: GameState): void {
  if (state.day % NICKNAME.everyDays !== 0) return;

  /*
     Its own stream, derived from the seed and the day rather than drawn from
     the one everything else shares.

     This roll happens every week of every career from day 120 and it is not
     about anything the rest of the simulation is doing. Taking it off
     `state.rng` moved every job outcome, every defection check and every heat
     event by one call a week, for no reason, and the probe read it as four
     bars flipping by one or two careers each: the shape verdicts, the standing
     order, the prepared job and the witness arm. None of those bars is about
     nicknames.

     Determinism holds — `seed` and `day` are both saved and the generator is a
     pure hash of them, which is the property `rng.ts` opens by stating. The
     precedent is `Rng.stableNoise` in the same file, written for exactly this
     hazard: a draw that must not advance the stream.
  */
  const rng = new Rng({ seed: state.rng.seed ^ 0x5bf03635, calls: state.day });

  const held = state.player.nickname;
  if (held) {
    // The street can change its mind, once, and only about a career that has
    // become something else since. See `canBeRenamedAfterDays`.
    if (state.day - held.since < NICKNAME.canBeRenamedAfterDays) return;
    if (state.player.renamed) return;
  }

  const pool = earnedNames(state);
  if (pool.length === 0) return;
  if (!rng.chance(NICKNAME.chance)) return;

  const total = pool.reduce((sum, d) => sum + d.weight, 0);
  let roll = rng.next() * total;
  let picked = pool[pool.length - 1];
  for (const def of pool) {
    roll -= def.weight;
    if (roll <= 0) {
      picked = def;
      break;
    }
  }

  if (held) state.player.renamed = true;
  state.player.nickname = { id: picked.id, since: state.day };
  addLog(
    state,
    held
      ? `They have stopped calling you ${NICKNAME_BY_ID[held.id]?.name ?? 'that'}. It is ${picked.name} now.`
      : `They have started calling you ${picked.name}. ${picked.blurb}`,
    'neutral',
  );
}

/**
 * The point a name adds to a stat, if it adds one to that stat.
 *
 * Read by `statLevel` rather than written into the build, so taking the name
 * away — which nothing does yet, but a conviction or a handover might — cannot
 * leave a phantom point behind in somebody's saved allocation.
 */
export function statBonus(state: GameState, id: StatId): number {
  const def = nicknameOf(state);
  if (!def) return 0;
  return 'stat' in def.grants && def.grants.stat === id ? def.grants.points : 0;
}

/** And the share of what comes in, for the names that pay in money instead. */
export function earningsBonus(state: GameState): number {
  const def = nicknameOf(state);
  if (!def) return 0;
  return 'earnings' in def.grants ? def.grants.earnings : 0;
}

/** How it reads on a screen: the name and why they say it. */
export function nicknameRead(state: GameState) {
  const def = nicknameOf(state);
  if (!def) return null;
  const grant =
    'stat' in def.grants
      ? `${def.grants.points === 1 ? 'A point' : `${def.grants.points} points`} of ${def.grants.stat}, because that is what people expect of you now.`
      : `${Math.round(def.grants.earnings * 100)}% more comes in, because of who they think they are dealing with.`;
  return { name: def.name, blurb: def.blurb, grant };
}
