/**
 * The half of a boss that is not the business.
 *
 * The design note is in `config/personal.ts`. The mechanics that matter:
 *
 * **The household is built without touching the random stream.** It is derived
 * from the world's own seed through `Rng.stableNoise`, the way `perceive` and
 * the whisper feed are, so a save created before this existed can grow one on
 * load without every later roll in that career moving. Lazily initialising a
 * system off the causal `rng` is the mistake whispers made on the day it was
 * written, and it broke two unrelated tests about operations.
 *
 * **Neglect is the only number, and it does exactly one thing.** It makes the
 * boss easier to depose. Nothing else in the game reads it, there is nothing
 * to spend it on, and a boss who goes home occasionally never meets it.
 */

import { Rng, clamp } from './rng';
import { HOME, HOME_LABEL, RELATIONS } from '../config/personal';
import { FIRST_NAMES } from '../config/npcs';
import { HOME_TERRITORY } from '../config/territories';
import { territoryDef } from './territory';
import { addLog } from './util';
import { ownsHome } from './possessions';
import { POSSESSION } from '../config/possessions';
import type { GameState, Home, HouseholdMember } from './types';

/**
 * The house, made the first time anybody asks.
 *
 * Optional state with a lazy initialiser, exactly as `promises`, `civic` and
 * `whispers` do it — so `SAVE_VERSION` does not move and a save written before
 * this loads with a family it turns out it always had.
 */
export function home(state: GameState): Home {
  if (state.home) return state.home;

  const key = `home:${state.rng.seed}`;
  const pick = <T>(items: readonly T[], salt: number): T =>
    items[Math.min(items.length - 1, Math.floor(Rng.stableNoise(key, salt) * items.length))];

  const people: HouseholdMember[] = [];
  const used = new Set<string>();
  for (let i = 0; i < HOME.household; i++) {
    // Distinct relations, so nobody has two mothers.
    let relation = pick(RELATIONS, 10 + i);
    for (let tries = 0; used.has(relation.id) && tries < RELATIONS.length; tries++) {
      relation = RELATIONS[(RELATIONS.indexOf(relation) + 1) % RELATIONS.length];
    }
    used.add(relation.id);
    people.push({
      name: pick(FIRST_NAMES, 40 + i),
      relationId: relation.id,
    });
  }

  state.home = {
    districtId: HOME_TERRITORY,
    people,
    lastVisitDay: state.day,
    neglect: 0,
  };
  return state.home;
}

/** A week of not being there, or of having been. */
export function tickHome(state: GameState): void {
  if (state.day % HOME.intervalDays !== 0) return;
  const house = home(state);
  house.neglect = clamp(house.neglect + HOME.perWeekAway, 0, 100);
}

/**
 * Whether there is any point going home tonight.
 *
 * Refuses by naming its own bar, like every other refusal in this project.
 */
export function canGoHome(state: GameState): { ok: boolean; reason?: string } {
  const house = home(state);
  const since = state.day - house.lastVisitDay;
  if (since < HOME.visitAgainAfterDays) {
    return {
      ok: false,
      reason:
        `You were there ${since === 0 ? 'today' : `${since} ${since === 1 ? 'day' : 'days'} ago`}. ` +
        `Going again inside ${HOME.visitAgainAfterDays} days is not worth anything to anybody.`,
    };
  }
  return { ok: true };
}

/**
 * An evening at home.
 *
 * Not priced in money — what it costs is the evening, and the game charges
 * that by the memo arriving on a week when something else also wanted doing.
 * There is no way to buy this back.
 */
export function goHome(state: GameState): void {
  if (!canGoHome(state).ok) return;
  const house = home(state);
  /*
     An evening under your own roof is worth more than an evening in a rented
     room you are never in.

     The one place possessions reach into this layer, and it is deliberately
     the smallest hook that is not decoration — no new number for the player to
     manage, just a better return on a thing they were already deciding whether
     to do. See `config/possessions.ts`.
  */
  const cleared = ownsHome(state) ? POSSESSION.clearedByVisitAtHome : HOME.clearedByVisit;
  house.neglect = clamp(house.neglect - cleared, 0, 100);
  house.lastVisitDay = state.day;
  addLog(
    state,
    `You went home. Nobody there wanted anything from you, which took some getting used to.`,
    'crew',
  );
}

/**
 * The multiplier on being removed by your own people.
 *
 * 1 for any boss who is around, walking to `depositionAtWorst` for one who is
 * not. The floor matters as much as the ceiling: a penalty everybody carries
 * is a tax, and this is supposed to be a thing the player can be wrong about.
 */
export function neglectRisk(state: GameState): number {
  const { neglect } = home(state);
  if (neglect <= HOME.depositionFrom) return 1;
  const past = (neglect - HOME.depositionFrom) / (100 - HOME.depositionFrom);
  return 1 + past * (HOME.depositionAtWorst - 1);
}

export interface HomeRead {
  where: string;
  neglect: number;
  label: string;
  /** Who is there, said the way the boss would say it. */
  people: string[];
  /** Days since the last evening at home. */
  since: number;
  /**
   * What being away is costing, said rather than left to be inferred.
   *
   * Empty for a boss who is around. `neglectRisk` is 1 up to
   * `HOME.depositionFrom` on purpose — a penalty everybody carries is a tax
   * rather than a thing the player can be wrong about — so this says nothing
   * until there is something to say.
   */
  costing: string | null;
}

export function homeRead(state: GameState): HomeRead {
  const house = home(state);
  return {
    where: territoryDef(house.districtId).name,
    neglect: Math.round(house.neglect),
    label:
      HOME_LABEL.find(([bar]) => house.neglect >= bar)?.[1] ?? 'You have been home',
    people: house.people.map((p) => {
      const def = RELATIONS.find((r) => r.id === p.relationId);
      return `${p.name}, ${def ? def.label : 'family'}`;
    }),
    since: state.day - house.lastVisitDay,
    /*
       The consequence, on the screen that shows the counter.

       A round-17 scorer wrote: *"I have a wife and two children, I clicked Go
       home once on day 26, and on day 163 the game told me 'Last evening at
       home: 137 days ago'. That is a lovely line attached to nothing. It never
       cost me anything, and a family that cannot be neglected at a price is set
       dressing."*

       They were wrong about the price and right about the screen. Neglect
       multiplies the chance the player's own people remove him, up to
       `HOME.depositionAtWorst` — `ladder.probe` measures careers ending at
       x1.9 — and `homeRead` reported the days, the label and the names, and
       never once mentioned it. A cost nobody is told about is not a cost the
       player can decide to pay, which is the whole of what that scorer met.

       Said as a direction rather than as the multiplier, because the number is
       one the game does not show anywhere else and a bare "x1.6" on a screen
       about a man's family would be the wrong register entirely.
    */
    costing:
      neglectRisk(state) <= 1
        ? null
        : neglectRisk(state) >= 1 + (HOME.depositionAtWorst - 1) * 0.6
          ? 'Your own people have no reason to stand with you beyond the work, and it shows when a room turns.'
          : 'You are becoming somebody your own people only know as the work.',
  };
}
