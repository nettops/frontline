/**
 * NPC generation, perception, and the loyalty drift that turns employees into
 * people with agendas.
 *
 * The rule this file exists to enforce: the player reads people through
 * perceive(), never through npc.stats. Everything else follows from that.
 */

import { Rng, clamp } from './rng';
import type {
  GameState,
  Npc,
  NpcStatId,
  NpcStats,
  RoleId,
} from './types';
import { addEvidence, addLog, nextId, pushEvent } from './util';
import { applyGoalDrift, goalBoard, goalEffect, reviewGoal } from './goals';
import { decayTies, followDeparture, tieDrift } from './ties';
import {
  AGE_RANGE,
  BEHAVIOUR,
  DRIFT,
  FAMILIARITY_MAX,
  FAMILIARITY_PER_DAY,
  NICKNAMES,
  NICKNAME_CHANCE,
  PERCEPTION_TIERS,
  SECRETS,
  SECRET_CHANCE,
  STARTING_FAMILIARITY,
  STAT_BANDS,
  STAT_RANGE,
  TRAITS,
  TRAIT_BY_ID,
  TRAIT_COUNT,
  type TraitEffects,
} from '../config/npcs';
import {
  CREW_MIX,
  NATIONALITIES,
  nationalityDef,
  type NationalityDef,
} from '../config/nationalities';
import { GOAL_BY_ID, GOAL_CERTAIN_ABOVE, GOAL_VISIBLE_ABOVE } from '../config/goals';
import { DAYS_PER_YEAR, FEAR, ROLE_WAGE } from '../config/economy';
import { priced, prices } from './market';
import { DIFFICULTY_BY_ID } from '../config/difficulty';

const STAT_IDS = Object.keys(STAT_RANGE) as NpcStatId[];

// ------------------------------------------------------------ generation ---

/**
 * Which community the next recruit comes out of.
 *
 * Mostly yours, because that is who is on your blocks and who your mother
 * vouches for — and never only yours, because an outfit with nobody from
 * anywhere else in it is a caricature rather than a family. `CREW_MIX` holds
 * the range and the argument for it.
 *
 * The share is derived from the seed with `stableNoise` rather than rolled,
 * so it is a fact about this city and not about how many people you happen to
 * have hired. Rolling it would have made the eleventh recruit depend on
 * whether you hired the previous ten, which is not a thing about the world.
 *
 * `crewShare` is exported and separately tested only because it could not be
 * tested through this function. The first version of the "the mix varies by
 * city" test inferred the share by counting a sampled crew, and a hardcoded
 * 0.7 passed it — two hundred draws carry about a tenth of sampling spread on
 * their own, which was the whole size of the effect being looked for. The
 * test was reading its own noise. Measured directly there is no noise.
 */
export function crewShare(seed: number): number {
  return CREW_MIX.min + Rng.stableNoise(`crewmix:${seed}`, 0) * (CREW_MIX.max - CREW_MIX.min);
}

function poolFor(state: GameState): NationalityDef {
  const home = nationalityDef(state.player.nationality);

  /*
     Both draws below come off `stableNoise`, not off `rng`, and that is the
     whole reason this function takes no Rng.

     The first version rolled the pool with `rng.chance` and picked the
     outsider's community with `rng.pick`, which added one or two draws to
     every person the game creates. Names are generated during world setup, so
     every later roll in the game shifted — and the probes moved with them:
     careers reaching Capo in 300 days fell from 19 of 36 to 10, the floor
     probe's stuck-career cash went from under 40k to 65k, and four other
     population readings broke. None of that was a balance change. It was the
     same simulation reading a different part of the stream.

     Keyed on `rng.calls`, the position in the stream, so it still varies from
     person to person without consuming any of it. Net draws per NPC: two,
     exactly as before.
  */
  const at = state.rng.calls;
  if (Rng.stableNoise(`crew:${state.rng.seed}:${at}`, 0) < crewShare(state.rng.seed)) return home;

  const others = NATIONALITIES.filter((n) => n.id !== home.id);
  if (!others.length) return home;
  return others[Math.floor(Rng.stableNoise(`crewother:${state.rng.seed}:${at}`, 0) * others.length)];
}

export function generateNpc(state: GameState, rng: Rng, role: RoleId): Npc {
  // First name and surname come from the same pool: a Murphy is a Patrick far
  // more often than a Stanislaw, and splitting them produced people who read
  // as a random-name-generator rather than as somebody's cousin.
  const pool = poolFor(state);
  const first = rng.pick(pool.first);
  const last = rng.pick(pool.last);
  const name = rng.chance(NICKNAME_CHANCE)
    ? `${first} "${rng.pick(NICKNAMES)}" ${last}`
    : `${first} ${last}`;

  const traitCount = rng.int(TRAIT_COUNT[0], TRAIT_COUNT[1]);
  const traits = rng.sample(TRAITS, traitCount).map((t) => t.id);

  const stats = {} as NpcStats;
  for (const id of STAT_IDS) {
    const [min, max] = STAT_RANGE[id];
    stats[id] = rng.bell(min, max);
  }
  // Traits pull the base roll around. Applied after so a trait always reads
  // in the direction it claims, even on an unlucky roll.
  for (const traitId of traits) {
    const bias = TRAIT_BY_ID[traitId]?.bias ?? {};
    for (const [statId, delta] of Object.entries(bias)) {
      const key = statId as NpcStatId;
      stats[key] = clamp(stats[key] + (delta as number), 0, 100);
    }
  }

  return {
    id: nextId(state, 'npc'),
    name,
    age: rng.int(AGE_RANGE[0], AGE_RANGE[1]),
    role,
    traits,
    secret: rng.chance(SECRET_CHANCE) ? rng.pick(SECRETS) : null,
    stats,
    // Who he is before anything has happened to him. Read after trait bias, so
    // a cowardly man settles back to being cowardly rather than to average.
    fearBase: stats.fear,
    familiarity: STARTING_FAMILIARITY,
    daysInCrew: 0,
    opsCompleted: 0,
    opsFailed: 0,
    wage: priced(state, ROLE_WAGE[role]),
    status: 'active',
    unavailableUntilDay: null,
    notes: [],
    // Nobody arrives wanting anything in particular or knowing anybody. Both
    // are earned: the goal on their first drift tick, the ties by working.
    goal: null,
    goalSince: state.day,
    ties: [],
    // Nothing has happened to him yet. Everything in here will have a date.
    memories: [],
    isSkimming: false,
    skimTotal: 0,
    joinedDay: state.day,
  };
}

export function addNote(
  npc: Npc,
  day: number,
  text: string,
  kind: 'neutral' | 'good' | 'bad' = 'neutral',
): void {
  npc.notes.unshift({ day, text, kind });
  if (npc.notes.length > 40) npc.notes.length = 40;
}

export function gainFamiliarity(npc: Npc, amount: number): void {
  npc.familiarity = clamp(npc.familiarity + amount, 0, FAMILIARITY_MAX);
}

// ---------------------------------------------------------------- traits ---

/**
 * What somebody's traits do to a number the simulation is about to use.
 *
 * Multiplicative keys compose across traits and default to 1; additive ones
 * sum and default to 0. Sloppy *and* hot-headed is 1.3 × 1.25 of the heat, and
 * that compounding is the point — a man with two loud traits is genuinely
 * dangerous to run a job with, rather than being the worse of the two.
 */
const ADDITIVE: (keyof TraitEffects)[] = ['loyaltyPerWeek'];

export function traitEffect(npc: Npc, key: keyof TraitEffects): number {
  const additive = ADDITIVE.includes(key);
  let value = additive ? 0 : 1;
  for (const id of npc.traits) {
    const effect = TRAIT_BY_ID[id]?.effects?.[key];
    if (effect === undefined) continue;
    value = additive ? value + effect : value * effect;
  }
  return value;
}

/** The same, averaged over a group — for anything a whole crew causes. */
export function crewTraitEffect(crew: Npc[], key: keyof TraitEffects): number {
  if (crew.length === 0) return ADDITIVE.includes(key) ? 0 : 1;
  const total = crew.reduce((sum, n) => sum + traitEffect(n, key), 0);
  return total / crew.length;
}

// ------------------------------------------------------------ perception ---

export interface Perception {
  /** False when the player has no usable read at all. */
  known: boolean;
  /** The phrase to show. Never a number. */
  band: string;
  /** How confident this read is, for the UI to convey. */
  confidence: string;
  /** 0..4 band index of the estimate — for bar/colour rendering only. */
  bandIndex: number;
}

function perceptionTier(familiarity: number) {
  let tier = PERCEPTION_TIERS[0];
  for (const t of PERCEPTION_TIERS) {
    if (familiarity >= t.minFamiliarity) tier = t;
  }
  return tier;
}

/**
 * What the player thinks a hidden stat is.
 *
 * The estimate is stable for a given (npc, stat, familiarity tier) — it does
 * not reshuffle on every render — but it *does* change as familiarity crosses
 * a tier, which reads as your understanding of someone sharpening over time.
 */
export function perceive(npc: Npc, statId: NpcStatId): Perception {
  const tier = perceptionTier(npc.familiarity);
  if (tier.noise >= 999) {
    return { known: false, band: '—', confidence: tier.label, bandIndex: -1 };
  }

  const tierIndex = PERCEPTION_TIERS.indexOf(tier);
  const roll = Rng.stableNoise(`${npc.id}:${statId}`, tierIndex + 1);
  const offset = (roll * 2 - 1) * tier.noise;
  const estimate = clamp(npc.stats[statId] + offset, 0, 99);
  const bandIndex = Math.floor(estimate / 20);

  return {
    known: true,
    band: STAT_BANDS[statId][bandIndex],
    confidence: tier.label,
    bandIndex,
  };
}

/** Traits marked obvious are visible immediately; the rest need familiarity. */
export function visibleTraits(npc: Npc): string[] {
  return npc.traits.filter((id) => {
    const def = TRAIT_BY_ID[id];
    if (!def) return false;
    return def.obvious || npc.familiarity >= 55;
  });
}

export function secretKnown(npc: Npc): boolean {
  return npc.familiarity >= 80;
}

/**
 * What the player thinks somebody is after.
 *
 * Lives here rather than in goals.ts because it needs `perceive`, and goals.ts
 * has to stay below npc.ts in the import order. Same rule as every hidden
 * stat: below the first threshold you get nothing, in the middle you get the
 * obvious reading — built from the stats a middling acquaintance can already
 * see, and therefore frequently wrong — and only close up do you get what the
 * man is actually doing.
 */
export function perceivedGoal(npc: Npc): { text: string; certain: boolean } | null {
  if (npc.familiarity < GOAL_VISIBLE_ABOVE) return null;

  if (npc.familiarity >= GOAL_CERTAIN_ABOVE) {
    const def = npc.goal ? GOAL_BY_ID[npc.goal] : null;
    return def
      ? { text: def.label, certain: true }
      : { text: 'Not reaching for anything', certain: true };
  }

  const ambition = perceive(npc, 'ambition');
  const greed = perceive(npc, 'greed');
  const fear = perceive(npc, 'fear');
  return {
    text:
      fear.bandIndex >= 3
        ? 'Looks like they are worried about something'
        : ambition.bandIndex >= 3
          ? 'Looks like they want to move up'
          : greed.bandIndex >= 3
            ? 'Looks like they are here for the money'
            : 'Hard to say what they are after',
    certain: false,
  };
}

/** The longer line for the crew sheet, only once you actually know. */
export function goalBlurb(npc: Npc): string | null {
  if (npc.familiarity < GOAL_CERTAIN_ABOVE || !npc.goal) return null;
  return GOAL_BY_ID[npc.goal]?.blurb ?? null;
}

// ------------------------------------------------------------ crew query ---

/**
 * Dead, gone, or running the place — either way they are not crew any more.
 *
 * The last of those is why this is a function rather than three comparisons
 * spread around: a successor stays on file so every evidence trace and suspect
 * list naming them still resolves, and every headcount in the game has to know
 * to skip them.
 */
export function isFormerCrew(npc: Npc): boolean {
  return npc.status === 'dead' || npc.status === 'defected' || npc.status === 'boss';
}

/**
 * Somebody you cannot do anything with, whether or not they are still yours.
 *
 * A man in a cell is still on the roster — he still has a wage, a grievance
 * and a history, and the crew sheet should keep showing him. What he cannot do
 * is take a promotion, accept a raise or sit in a back room with you. A round-7
 * tester found all seven actions live on a man whose own status line read
 * "HELD · 53D", because every guard was written against `isFormerCrew` and
 * being arrested is not being former crew.
 *
 * One predicate rather than a status check per action, so the next thing that
 * can happen to a person is handled in one place instead of four.
 */
export function isOutOfReach(npc: Npc): boolean {
  return isFormerCrew(npc) || npc.status === 'arrested';
}

export function crewList(state: GameState): Npc[] {
  return Object.values(state.npcs).filter((n) => !isFormerCrew(n));
}

/** Crew who can be assigned to an operation right now. */
export function availableCrew(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status === 'active');
}

/**
 * What he thinks the job is worth this year.
 *
 * Indexed to prices while `npc.wage` is not, which is the whole of the sticky
 * wage mechanic: a man hired in a cheap year is quietly underpaid a decade
 * later, and the loyalty drift below reads the gap without anything new having
 * to be written. Nobody asks for a raise. They just get unhappier.
 */
export function wageExpectation(state: GameState, npc: Npc): number {
  const indexed = 1 + (prices(state) - 1) * DRIFT.wageIndexation;
  const base = ROLE_WAGE[npc.role] * indexed;
  const multiple =
    DRIFT.wageExpectationBase + (npc.stats.greed / 100) * DRIFT.wageExpectationFromGreed;
  return Math.round(base * multiple * traitEffect(npc, 'wageExpectation'));
}

// ------------------------------------------------------- daily / drift ----

/** Runs every day: availability timers and slow familiarity growth. */
export function tickNpcs(state: GameState): void {
  /*
   * Everybody has a birthday on the same day.
   *
   * `age` was rolled at generation, printed twice in the crew panel, and never
   * touched again — fifteen in-game years of tenure and a man was still the age
   * he was hired at. Ages turning over together at New Year is a small
   * inaccuracy that buys a large simplification: no per-person birthday to
   * store, and one obvious place for everything annual to hang off.
   */
  const newYear = state.day % DAYS_PER_YEAR === 0;

  for (const npc of Object.values(state.npcs)) {
    if (isFormerCrew(npc)) continue;

    if (newYear) npc.age += 1;
    npc.daysInCrew += 1;
    gainFamiliarity(npc, FAMILIARITY_PER_DAY);

    if (npc.unavailableUntilDay !== null && state.day >= npc.unavailableUntilDay) {
      const was = npc.status;
      npc.status = 'active';
      npc.unavailableUntilDay = null;
      if (was === 'injured') {
        addNote(npc, state.day, 'Recovered and back to work.', 'neutral');
        addLog(state, `${npc.name} has recovered and is available again.`, 'crew');
      } else if (was === 'arrested') {
        addNote(npc, state.day, 'Released. Did not say what they told them.', 'neutral');
        addLog(state, `${npc.name} is out. Nobody has asked what they said.`, 'crew');
      }
    }
  }
}

/**
 * The weekly re-evaluation. Every person weighs pay, standing, danger and
 * whatever they are still holding against you, and adjusts.
 *
 * This is deliberately not visible to the player. You find out what happened
 * here through behaviour, not through a report.
 */
export function driftNpcs(state: GameState, rng: Rng): void {
  const diff = DIFFICULTY_BY_ID[state.difficulty];
  const leadershipResist =
    state.player.attributes.leadership * DRIFT.leadershipResistFactor;
  // Computed once rather than per person: with forty people this was scanning
  // every open investigation forty times a week.
  const board = goalBoard(state);
  /*
   * Fear read locally rather than through player.ts, which imports this file.
   * One line of arithmetic is a cheaper price than a cycle — the same call
   * diplomacy.ts makes about its two accessors.
   */
  const fear = clamp(state.org.fear / FEAR.max, 0, 1);
  const defectionChill = 1 - fear * (1 - FEAR.defectionAtMax);

  for (const npc of Object.values(state.npcs)) {
    if (isFormerCrew(npc) || npc.status === 'arrested') continue;

    // What he wants, re-read before it is allowed to affect anything.
    reviewGoal(state, rng, npc, board);
    applyGoalDrift(npc);
    decayTies(state, npc);

    let loyaltyDelta = 0;

    /*
     * Who he is, who he has to work with, and what he is after.
     *
     * Scaled together by `characterWeight` so the three of them colour the
     * drift rather than deciding it — at full strength they roughly cancelled
     * the +2.5 a week that paying somebody properly earns, which quietly made
     * the main lever the player has stop working.
     */
    loyaltyDelta +=
      (traitEffect(npc, 'loyaltyPerWeek') +
        goalEffect(npc, 'loyaltyPerWeek') +
        tieDrift(state, npc)) *
      DRIFT.characterWeight;

    // Pay against expectation.
    const expected = wageExpectation(state, npc);
    if (npc.wage >= expected) {
      loyaltyDelta += DRIFT.wellPaidLoyalty;
    } else {
      const shortfall = clamp((expected - npc.wage) / expected, 0, 1);
      loyaltyDelta += DRIFT.underpaidLoyalty * shortfall;
    }

    // Ambition with nowhere to go.
    const daysInRole = state.day - npc.joinedDay;
    if (
      daysInRole > DRIFT.daysInRoleBeforeStagnation &&
      npc.stats.ambition > 50
    ) {
      loyaltyDelta +=
        DRIFT.stagnationLoyaltyPerTick * (npc.stats.ambition / 100);
    }

    // Heat frightens the people who scare easily.
    if (state.org.heat > DRIFT.heatFearThreshold) {
      const pressure = (state.org.heat - DRIFT.heatFearThreshold) / 55;
      loyaltyDelta += DRIFT.heatFearLoyalty * pressure * (npc.stats.fear / 100);
    }

    // Unresolved grievances.
    loyaltyDelta += npc.stats.grievance * DRIFT.grievanceLoyaltyFactor;
    npc.stats.grievance = clamp(
      npc.stats.grievance - DRIFT.grievanceDecayPerTick,
      0,
      100,
    );

    /*
       And his nerve comes back, toward whatever it was to begin with.

       Every other number on this list has a way down. Grievance decays on the
       line above, loyalty is pushed both ways by the six terms around it, and
       the organization's own fear bleeds off every payday in `tickFear`. A
       man's fear did not: seventeen places add to it, five event choices take
       from it, and nothing else touched it ever again.

       So it went one way. Rolled between 15 and 70, the median man on the crew
       sheet read 76 by day 91 and about 90 for the rest of a four-year career.
       `heatFearLoyalty` scales entirely on `fear / 100`, so every crew in the
       game was taking close to the maximum weekly drain from it no matter who
       was in the room or how the boss played — and the crew sheet said
       "terrified of something" about a man hired as hard to rattle, with no
       route back for the player to find.

       Saves written before `fearBase` existed have no record of who anybody
       was, so they settle toward the middle of the roll instead. That is a
       guess, and it is a better one than leaving an existing crew pinned.
    */
    const settled = npc.fearBase ?? (STAT_RANGE.fear[0] + STAT_RANGE.fear[1]) / 2;
    const gap = settled - npc.stats.fear;
    if (gap !== 0) {
      const step = Math.min(Math.abs(gap), DRIFT.fearSettlePerTick);
      npc.stats.fear = clamp(npc.stats.fear + Math.sign(gap) * step, 0, 100);
    }

    // Your leadership only resists losses; it does not manufacture devotion.
    if (loyaltyDelta < 0) {
      loyaltyDelta = Math.min(0, loyaltyDelta * diff.loyaltyDecay + leadershipResist);
    }

    npc.stats.loyalty = clamp(npc.stats.loyalty + loyaltyDelta, 0, 100);

    /*
       Standing with you decays, and nothing here builds it back.

       This read `(rankIndex(player.rank) * DRIFT.respectDriftPerRank) / 4 - 1`
       and the comment said "standing with you tracks your rank". `player.rank`
       is pinned at the first rung, so `rankIndex` is 0 for every career ever
       played and the whole expression was `-1`. The rank half was removed when
       the ladder went; this term kept referencing it and kept compiling.

       Left as the plain decay it has always actually been, rather than
       repointed at `standing()` — what should build respect for the boss back
       up is a design question, not a cleanup, and inventing an answer inside a
       dead-code sweep is how the last one got missed.
    */
    npc.stats.respectForBoss = clamp(npc.stats.respectForBoss - 1, 0, 100);

    // --- behaviour thresholds -------------------------------------------

    // Skimming starts silently. The player is not told.
    if (
      !npc.isSkimming &&
      npc.stats.loyalty < BEHAVIOUR.skimLoyaltyBelow &&
      npc.stats.greed > BEHAVIOUR.skimGreedAbove &&
      rng.chance(BEHAVIOUR.skimChancePerTick * diff.eventPressure)
    ) {
      npc.isSkimming = true;
    }

    /*
       Walking away entirely — unless he is more frightened of leaving than of
       staying, which is exactly what fear buys and exactly what it costs.

       And unless he is talking to somebody. A man who has started giving an
       investigator his nights has the strongest possible reason to stay exactly
       where he is: what he is selling is access, and it stops being worth
       anything the day he walks out. Without this the informant mechanic could
       not run at all — the gate that makes a man reachable is low loyalty, and
       low loyalty is the same gate that makes him leave, so every informant
       defected within a month of turning and never handed over a single night.
    */
    if (
      npc.informingSince === undefined &&
      npc.stats.loyalty < BEHAVIOUR.defectLoyaltyBelow &&
      rng.chance(BEHAVIOUR.defectChancePerTick * diff.eventPressure * defectionChill)
    ) {
      npc.status = 'defected';
      npc.unavailableUntilDay = null;
      addNote(npc, state.day, 'Left the organization.', 'bad');
      addLog(
        state,
        `${npc.name} is gone. No message, no meeting, and they knew a great deal.`,
        'crew',
      );

      /*
         If it was the man you named, you are told to your face.

         Losing a successor arrived as one line in the log, between two other
         lines, on a day the player was probably reading something else — and
         the next thing that happened was `removePlayer` finding nobody to hand
         to. A round-7 tester lost an heir and did not find out until the run
         ended. The succession panel has always been honest about who the heir
         is; it is not honest about the moment he stops being one, because
         nothing points at the moment.

         `heirId` is cleared here rather than left dangling. `heirOf` already
         refuses to return a defector, so this changes no behaviour — it stops
         the panel showing a name it is going to ignore.
      */
      if (state.succession?.heirId === npc.id) {
        state.succession.heirId = null;
        pushEvent(state, {
          defId: 'heir_gone',
          title: `${npc.name} is not coming back`,
          body:
            `The person you named to take over has left the organization. ` +
            `Whatever they were owed, they decided it was not coming. Nobody is ` +
            `named now, and if something happens to you before somebody is, ` +
            `there is nothing to hand over.`,
          severity: 'danger',
          npcId: npc.id,
          data: {},
          choices: [
            {
              id: 'continue',
              label: 'Name somebody else',
              hint: 'Succession, when you have decided who',
            },
          ],
        });
      }
      // Someone who leaves angry is a thread for an investigator to pull.
      addEvidence(state, {
        day: state.day,
        source: 'informant',
        strength: Math.round(8 * traitEffect(npc, 'exposure') * goalEffect(npc, 'exposure')),
        npcIds: [npc.id],
        detail: `${npc.name} left the organization on bad terms.`,
      });

      /*
       * And he does not necessarily leave alone.
       *
       * This is what the tie system is for. A man walking out used to be one
       * hole in the roster; now it is a hole with a shape, because the people
       * who trusted *him* rather than you have a decision to make about it.
       * The player's only warning was the crew sheet, which has been quietly
       * saying who follows whom for as long as they cared to look.
       */
      const followers = followDeparture(state, rng, npc, (other) => {
        other.status = 'defected';
        other.unavailableUntilDay = null;
      });
      if (followers.length > 0) {
        addLog(
          state,
          `${followers.map((f) => f.name).join(' and ')} went with them. Nobody put it to a vote.`,
          'failure',
        );
      }
    }
  }
}

/** Applied when an operation resolves — success breeds ambition. */
export function creditOperation(npc: Npc, day: number, success: boolean, opName: string): void {
  if (success) {
    npc.opsCompleted += 1;
    npc.stats.ambition = clamp(npc.stats.ambition + DRIFT.ambitionPerSuccess, 0, 100);
    addNote(npc, day, `Worked the ${opName}. It went clean.`, 'good');
  } else {
    npc.opsFailed += 1;
    addNote(npc, day, `Was on the ${opName}. It went wrong.`, 'bad');
  }
}
