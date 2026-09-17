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
import {
  CHILD_START_AGES,
  CONFIDANT,
  HOME,
  HOME_LABEL,
  LIFE_STAGES,
  RELATIONS,
  STRESS,
  STRESS_TIERS,
  type HomeTier,
  type LifeStageDef,
  type StressTierDef,
} from '../config/personal';
import { FIRST_NAMES, GIVEN_NAMES } from '../config/npcs';
import { HOME_TERRITORY } from '../config/territories';
import { GEN_SHAPES } from '../config/eventgen';
import { territoryDef } from './territory';
import { addLog } from './util';
import { ownsHome } from './possessions';
import { POSSESSION } from '../config/possessions';
import { NEPOTISM } from '../config/succession';
import { OPERATION_BY_ID } from '../config/operations';
import { playerWars } from './diplomacy';
import { canAfford, spend } from './economy';
import { priced } from './market';
import { activeCases } from './investigation';
import { recordCareerEvent } from './career';
import { hasHealthInsurance, wearinessRelief } from './corporate';
import { HEALTH_INSURANCE } from '../config/corporate';
import type { ConfidantState, GameState, Home, HouseholdMember } from './types';

/** The worst tier's own bar — read rather than retyped, so a cold-reception
 * check below and the label table above cannot drift to different numbers. */
const COLD_RECEPTION_AT = Math.max(...HOME_LABEL.map((t) => t.bar));

/** Which of the four bars a given neglect reading falls in. */
export function homeTier(neglect: number): HomeTier {
  return HOME_LABEL.find((t) => neglect >= t.bar) ?? HOME_LABEL[HOME_LABEL.length - 1];
}

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

/**
 * The one draw an age needs, made once and shared by every reader of it.
 *
 * `Rng.stableNoise`, not the causal stream — a descriptive fact about the
 * world established once at household creation, same as `home()`'s own
 * picks, and the same reasoning: a lazy initialiser that spent real rolls
 * would reshuffle every later draw in a career that loaded an old save.
 * A fresh key (`child_age:...`), distinct from `home()`'s own `home:...`,
 * salted by the person's slot in the household so two children in the same
 * house cannot draw the same age off the same number.
 *
 * `null` for a relation `CHILD_START_AGES` has no entry for — `spouse`,
 * `parent`, `sibling` and `elder` are already adults, and giving them a
 * fabricated birth year would be a number nobody asked for attached to a
 * mechanic that never reads it.
 */
function baseAgeAtDay1(state: GameState, relationId: string): number | null {
  const range = CHILD_START_AGES[relationId];
  if (!range) return null;
  const idx = home(state).people.findIndex((p) => p.relationId === relationId);
  const key = `child_age:${state.rng.seed}`;
  return range.min + Math.floor(Rng.stableNoise(key, 20 + idx) * (range.max - range.min + 1));
}

/**
 * How old a household member is today — `baseAgeAtDay1` plus a year for
 * every 365 days that have passed, per `CLAUDE.md`'s "reach for a derived
 * read before stored state": nothing about age is ever written to `Home`
 * or `HouseholdMember`, so there is no second copy to drift and no
 * `SAVE_VERSION` bump for this milestone. `memberName` is not read by the
 * lookup itself (`home()` never gives two people the same `relationId`) but
 * is kept in the signature because every other caller already has both in
 * hand from a `HouseholdMember`.
 */
export function memberAge(state: GameState, _memberName: string, relationId: string): number | null {
  const base = baseAgeAtDay1(state, relationId);
  return base === null ? null : base + Math.floor(state.day / 365);
}

/** Which of the four bands (`LIFE_STAGES`) a given age falls in. */
export function memberLifeStage(age: number): LifeStageDef {
  return (
    LIFE_STAGES.find((s) => age >= s.minAge && age <= s.maxAge) ?? LIFE_STAGES[LIFE_STAGES.length - 1]
  );
}

/**
 * Days until a household member turns 18, for the PlayerPanel's near-
 * birthday prompt. `null` for a relation with no tracked age, or one
 * already grown — the same "say nothing until there is something to say"
 * rule `homeRead`'s `costing` field follows.
 *
 * Checked against the *current* day crossing the birthday, not merely
 * whether the base age started below 18 — a base age always does, for
 * every relation this tracks, so that alone would have kept reporting a
 * countdown of 0 forever after the day it actually passed.
 */
export function daysUntilAdult(state: GameState, relationId: string): number | null {
  const base = baseAgeAtDay1(state, relationId);
  if (base === null) return null;
  const turnsAdultOnDay = (18 - base) * 365;
  return state.day >= turnsAdultOnDay ? null : turnsAdultOnDay - state.day;
}

/** A week of not being there, or of having been. */
export function tickHome(state: GameState): void {
  if (state.day % HOME.intervalDays !== 0) return;
  const house = home(state);
  house.neglect = clamp(house.neglect + HOME.perWeekAway, 0, 100);
}

/**
 * The one body, spent already.
 *
 * `operations.ts`'s own `canLaunch` refuses a zero-crew job with "there is
 * only one of you" — the boss's own body is the resource, not a crew slot.
 * An evening at home, a consultation with a doctor, and `gen_panic_episode`'s
 * own house-call choice (`sim/eventgen.ts`) all spend that same body over
 * the same one day, so all three read this one definition table rather than
 * each copying a name out of it, which would be a second place for "which
 * job is this" to drift from the first the day another zero-crew job joins
 * the roster. Exported for that third call site.
 */
export function bodySpentTonight(state: GameState): boolean {
  return Object.values(state.activeOperations).some(
    (op) => (OPERATION_BY_ID[op.defId]?.crewRequired ?? 1) === 0,
  );
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
  if (bodySpentTonight(state)) {
    return {
      ok: false,
      reason: 'You are out on a job that needs you personally tonight. That is where you are.',
    };
  }
  /*
     And the other half of "you cannot be in two places", which was missing.

     `went_home_day` is stamped by an evening at home, by
     `gen_panic_episode`'s house call, and now by an evening across the river
     (`visitConfidant`). Only the first of those three also moves
     `lastVisitDay`, so the `since` check above caught one case in three: a
     boss could spend the night at an address nobody in the house knows about
     and then go home the same evening as well. Checked here rather than in
     each caller, so a fourth thing that spends the night is covered the day
     it is written.
  */
  if (state.flags['went_home_day'] === state.day) {
    return { ok: false, reason: 'Tonight is already spoken for. You cannot be in two places.' };
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
  const baseline = ownsHome(state) ? POSSESSION.clearedByVisitAtHome : HOME.clearedByVisit;
  /*
     A cold reception, at the worst of the four tiers.

     A visit was worth the same fixed amount at any neglect at all, which made
     the button read as a top-up meter rather than a relationship: a boss who
     let it run to `COLD_RECEPTION_AT` (see `HOME_LABEL`, the same bar
     `homeTier` reads) got exactly the welcome of one who dropped in every
     week. Halved rather than zeroed — an evening still counts for something,
     it is just not undone by showing up once.
  */
  const cold = house.neglect >= COLD_RECEPTION_AT;
  const cleared = cold ? baseline * 0.5 : baseline;
  house.neglect = clamp(house.neglect - cleared, 0, 100);
  house.lastVisitDay = state.day;
  /*
     Stamped separately from `lastVisitDay`. That field is also the day
     `home()` was first lazily built for a career that has never actually
     visited, so `operations.ts` reading it directly to see "did the boss
     spend his body here today" would misread the day the household happened
     to be generated as a visit. This flag is only ever set by an actual
     evening at home.
  */
  state.flags['went_home_day'] = state.day;
  addLog(
    state,
    cold
      ? `You went home. It was not the evening it would have been a year ago — half of it was spent being looked at like a guest.`
      : `You went home. Nobody there wanted anything from you, which took some getting used to.`,
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
  /** The full tier the label came from — blurb and tone included, so a
   * screen with room for more than the one line does not re-derive it. */
  tier: HomeTier;
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
  /** What doing nothing costs per week, at the game's own configured rate. */
  weeklyVelocity: number;
  /**
   * Days until neglect crosses `HOME.depositionFrom`, at that same rate, if
   * nothing between now and then changes it. 0 once already there.
   *
   * A projection, not a promise — a visit any day before then moves the
   * number this is computed from. Worded on screen as "if nothing changes"
   * for the same reason.
   */
  daysUntilDepositionRisk: number;
  /**
   * Household members within `HOME.comingOfAgeWithinDays` of their 18th
   * birthday — empty for a household with no child in it, or none close
   * enough to be worth a line on the panel. See `daysUntilAdult`.
   */
  comingOfAge: { name: string; relationId: string; daysUntil: number }[];
}

export function homeRead(state: GameState): HomeRead {
  const house = home(state);
  const tier = homeTier(house.neglect);
  return {
    where: territoryDef(house.districtId).name,
    neglect: Math.round(house.neglect),
    label: tier.label,
    tier,
    people: house.people.map((p) => {
      const def = RELATIONS.find((r) => r.id === p.relationId);
      const label = `${p.name}, ${def ? def.label : 'family'}`;
      const age = memberAge(state, p.name, p.relationId);
      return age === null ? label : `${label} (${age}, ${memberLifeStage(age).label})`;
    }),
    comingOfAge: house.people.flatMap((p) => {
      const daysUntil = daysUntilAdult(state, p.relationId);
      return daysUntil === null ? [] : [{ name: p.name, relationId: p.relationId, daysUntil }];
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
    weeklyVelocity: HOME.perWeekAway,
    daysUntilDepositionRisk:
      house.neglect >= HOME.depositionFrom
        ? 0
        : Math.ceil(
            (HOME.depositionFrom - house.neglect) / (HOME.perWeekAway / HOME.intervalDays),
          ),
  };
}

/**
 * How soon the family-dilemma shape (`gen_family_dilemma`, `sim/eventgen.ts`)
 * could come up again — the honest half of a preview, not the whole one.
 *
 * What is *not* here is which occasion or which face. `applies()` draws that
 * off the causal `rng` at the moment the day's eligibility scan actually
 * runs, and that draw is not reproducible ahead of time without simulating
 * the rest of a day that has not happened yet — the same failure mode
 * CLAUDE.md's "no button lies" rule exists to catch. A deterministic
 * `Rng.stableNoise` pick was the other option on the table: it would make the
 * occasion itself knowable in advance, but only by removing the `rng.pick`
 * call from `applies()`, and that call fires on every eligible day, not only
 * the day the shape wins the slot — pulling it out shifts the causal stream's
 * call count for the rest of any save that reaches this code, reshuffling
 * every later roll in the game, silently, which is exactly the damage
 * CLAUDE.md's determinism section warns a reporting system can do to the
 * causal stream. Not worth it for a name. So this reports only the one
 * number that is true regardless: the day the cooldown floor lifts.
 *
 * That day is a floor, not a schedule — `tickEvents` still has to win a
 * shared daily lottery against the rest of the generated table on top of it,
 * so most days after it clears, nothing happens, or something else does.
 * Worded on screen as "could come up as soon as", never "arrives" or "is in".
 */
export interface FamilyHorizon {
  /** Earliest day the shape is eligible to fire again. */
  eligibleFromDay: number;
  /** Days from today until then, floored at 0. 0 means eligible now. */
  daysUntil: number;
  /**
   * Whether the shape has ever actually fired.
   *
   * Before the first time, `daysUntil` reads permanently 0 — honestly, the
   * shape really has been eligible since day one — but a screen that says so
   * from the opening day of a career is wallpaper, not a heads-up about a
   * pattern. Callers gate the line on this rather than on `daysUntil` alone.
   */
  everFired: boolean;
}

export function familyHorizon(state: GameState): FamilyHorizon {
  const cooldownDays =
    GEN_SHAPES.find((s) => s.id === 'gen_family_dilemma')?.cooldownDays ?? 32;
  const flagged = state.flags['evt_gen_family_dilemma'];
  // Same sentinel `events.ts`'s own `eligible()` uses for "never fired" —
  // guarantees the shape reads as eligible from the start of a career.
  const lastFired = flagged ?? -9999;
  const eligibleFromDay = lastFired + cooldownDays;
  return {
    eligibleFromDay,
    daysUntil: Math.max(0, eligibleFromDay - state.day),
    everFired: flagged !== undefined,
  };
}

// -------------------------------------------------------------- stress ---

/**
 * The condition itself, 0..100.
 *
 * Optional on `state.player`, lazily read exactly as the rest of this file's
 * state is — a save from before this existed loads as a boss who has been
 * carrying nothing, which is correct: it only ever moves once `tickStress`
 * has had a week to run.
 */
export function playerStress(state: GameState): number {
  return clamp(state.player.stress ?? 0, 0, STRESS.max);
}

/** Which of the four bars a given stress reading falls in. */
export function stressTier(value: number): StressTierDef {
  return STRESS_TIERS.find((t) => value >= t.bar) ?? STRESS_TIERS[STRESS_TIERS.length - 1];
}

export interface StressPressure {
  /** Weekly stress from every war currently running. */
  wars: number;
  /** Weekly stress from real federal attention. */
  heat: number;
  /** Weekly stress from a house that has gone from missed to distant. */
  domestic: number;
  /** Weekly stress from wages carried unpaid. */
  payroll: number;
  /**
   * Weekly stress from the calendar itself, past `NEPOTISM.agingStartDay`.
   *
   * Itemised like every other term rather than folded silently into the net,
   * because a boss who suddenly stops recovering has to be able to read why —
   * the same rule the odds on a job follow.
   */
  aging: number;
  /** The sum of the above, less natural recovery when nothing above is firing. */
  netWeekly: number;
}

/** Whether the body has stopped mending on its own. See `NEPOTISM`. */
export function isAging(state: GameState): boolean {
  return state.day >= NEPOTISM.agingStartDay;
}

/**
 * What is bearing down this week, itemised.
 *
 * Every term reads a fact another system already owns — `playerWars`,
 * `org.heat`, `home().neglect`, `org.wagesOwed` — so nothing here can drift
 * from what actually happened, the same discipline `homeRead`'s `costing`
 * line follows.
 */
export function stressPressure(state: GameState): StressPressure {
  const wars = playerWars(state).length * STRESS.perWar;
  const heat = state.org.heat >= 50 ? STRESS.highHeat : 0;
  const domestic = home(state).neglect >= 50 ? STRESS.domesticStrain : 0;
  const payroll = (state.org.wagesOwed ?? 0) > 0 ? STRESS.wageArrears : 0;
  /*
     The calendar's weekly withdrawal, less whatever somebody else is paying
     for.

     `wearinessRelief` is a subtraction rather than a branch on purpose — see
     `HEALTH_INSURANCE.wearinessRelief`, which is set equal to the weariness
     so an insured boss reads exactly zero here and the two constants cannot
     drift apart without somebody deciding they should. Floored at zero: a
     plan stops the body giving out, it does not make a man younger.
  */
  const aging = isAging(state)
    ? Math.max(0, NEPOTISM.agingWearinessStress - wearinessRelief(state))
    : 0;
  /*
     Recovery is the calendar's to withdraw.

     Past `NEPOTISM.agingStartDay` a quiet week is merely a week that did not
     make it worse. Written as an extra term on `quiet` rather than as a
     separate branch so there is one expression producing `netWeekly` and no
     second place for the two to disagree.
  */
  const quiet =
    !isAging(state) &&
    playerWars(state).length === 0 &&
    state.org.heat < 30 &&
    home(state).neglect < 25;
  return {
    wars,
    heat,
    domestic,
    payroll,
    aging,
    netWeekly: wars + heat + domestic + payroll + aging - (quiet ? STRESS.naturalRecovery : 0),
  };
}

/**
 * A week of carrying it, or a week of quiet.
 *
 * Same weekly gate `tickHome` uses (`HOME.intervalDays`) rather than a second
 * constant of its own — both are "everybody forms an opinion once a week",
 * `tickHome`'s own words, and a household's and a body's are the same week.
 * Kept as its own call in `clock.ts` alongside `tickHome` rather than nested
 * inside it, because two of this function's four drivers (wars, heat) are
 * not household facts at all — `tickHome`'s header scopes that function to
 * the household specifically.
 */
export function tickStress(state: GameState): void {
  if (state.day % HOME.intervalDays !== 0) return;
  state.player.stress = clamp(playerStress(state) + stressPressure(state).netWeekly, 0, STRESS.max);

  /*
     And the one line that says out loud what the meter has been doing.

     Gated on the same bar `gen_panic_episode` fires from, so it never arrives
     before the boss has felt anything — an aging warning to a man who is
     coping is a birthday card. Rate-limited on its own flag rather than on
     the weekly tick, for the reason the confidant's wiretap beat is: the
     heart is not new information every seven days.
  */
  if (!isAging(state) || playerStress(state) < STRESS.panicThreshold) return;
  const last = state.flags['aging_warning_day'];
  if (last !== undefined && state.day - last < NEPOTISM.agingWarningEveryDays) return;
  state.flags['aging_warning_day'] = state.day;
  addLog(
    state,
    'The doctor quietly warned you that your heart cannot endure another year of street wars.',
    'crew',
  );
}

/**
 * The extra dulling stress itself leaves on a sit-down.
 *
 * Read against the true `leadership` stat in `sitdown.ts`'s own `lands()` —
 * not a cosmetic meter, a real term in a real check. Only `critical` bites,
 * for the reason `HOME.depositionFrom` only starts penalising neglect once
 * it is real: a penalty that starts at the first tier is a tax on every
 * career that ever fights a war, which is most of them. The sedatives half
 * is independent and stacks — see `STRESS.sedatedLeadershipPenalty`.
 */
export function stressLeadershipMultiplier(state: GameState): number {
  let m = 1;
  if (stressTier(playerStress(state)).id === 'critical') m *= STRESS.criticalLeadershipPenalty;
  if (state.day < (state.flags['sedated_until_day'] ?? -Infinity)) {
    m *= STRESS.sedatedLeadershipPenalty;
  }
  return m;
}

/**
 * Whether a discreet consultation is worth anything tonight.
 *
 * Reuses `bodySpentTonight` rather than `canGoHome` wholesale — `canGoHome`
 * also refuses inside `HOME.visitAgainAfterDays`, a rule about a *visit*
 * being worth less so soon after the last one, which has nothing to say
 * about a doctor's office.
 */
/**
 * What an hour on the chest costs tonight.
 *
 * A covered boss sees a cardiologist rather than a man in an unmarked office,
 * and pays more for it. That is not a penalty: the scarce resource here is
 * the evening, not the money — `consultCooldownDays` is the same seven either
 * way — so more cleared per night is strictly the better deal for anybody who
 * can reach it, and reaching it is the whole point of building something
 * legitimate.
 */
export function consultCost(state: GameState): number {
  return hasHealthInsurance(state) ? HEALTH_INSURANCE.cardiologistCost : STRESS.consultCost;
}

export function canConsult(state: GameState): { ok: boolean; reason?: string } {
  const cost = priced(state, consultCost(state));
  if (!canAfford(state, cost)) {
    return { ok: false, reason: `A discreet doctor runs ${Math.round(cost).toLocaleString('en-US')}, and you do not have it.` };
  }
  if (bodySpentTonight(state)) {
    return {
      ok: false,
      reason: 'You are out on a job that needs you personally tonight. That is where you are.',
    };
  }
  const since = state.day - (state.flags['last_consult_day'] ?? -9999);
  if (since < STRESS.consultCooldownDays) {
    return {
      ok: false,
      reason: `You saw him ${since === 0 ? 'today' : `${since} ${since === 1 ? 'day' : 'days'} ago`}. Going back inside ${STRESS.consultCooldownDays} days is not worth anything to anybody.`,
    };
  }
  return { ok: true };
}

/**
 * An hour nobody in the crew knows about.
 *
 * Spends the same evening `goHome` does (`went_home_day`) — the body is the
 * resource, and it is only ever spent once a night.
 */
export function consultDoctor(state: GameState): void {
  if (!canConsult(state).ok) return;
  if (!spend(state, priced(state, consultCost(state)), 'world')) return;
  // See `HEALTH_INSURANCE.cardiologistRecoveryBonus`: more of the hour goes on
  // the heart when it is not also going on not being seen.
  const covered = hasHealthInsurance(state);
  const cleared = STRESS.consultRecovery + (covered ? HEALTH_INSURANCE.cardiologistRecoveryBonus : 0);
  state.player.stress = clamp(playerStress(state) - cleared, 0, STRESS.max);
  state.flags['went_home_day'] = state.day;
  state.flags['last_consult_day'] = state.day;
  addLog(
    state,
    covered
      ? 'A cardiologist in a building with a lobby, billed to a local you have never set foot in. He put you on a machine for an hour and told you what you already knew.'
      : 'An hour in an unmarked office on 72nd Street. Nobody in the crew knows you were there. The air came back into your chest.',
    'crew',
  );
  /*
     The secrecy risk: real federal attention, or an open case, means an
     unexplained hour is the kind of thing that gets noticed and written
     down. `recordCareerEvent` rather than a whisper — `whispers.ts`'s own
     supply is generated from real subjects (a man, a district, a figure)
     through `compose()`, and there is no "write this exact sentence" door
     into it. A lasting mark on the record is what this actually is.
  */
  if (state.org.heat >= STRESS.secrecyRiskHeat || activeCases(state).length > 0) {
    recordCareerEvent(
      state,
      'A sedan with federal plates was seen parked down the block from your physician\'s office.',
      'bad',
    );
  }
}

// ------------------------------------------------------------ confidant ---

/**
 * The apartment, made the first time anybody asks.
 *
 * Same lazy `Rng.stableNoise` idiom as `home()` above, and for the same
 * reason: a save written before this existed has to be able to grow one on
 * load without every later roll in that career moving. A fresh key
 * (`confidant:...`) so the name draw cannot collide with the household's own.
 *
 * Drawn from the women of `GIVEN_NAMES` rather than the flat `FIRST_NAMES`
 * pool, which is thirty-two men followed by sixteen women — see that pool's
 * own comment in `config/npcs.ts`. Nothing in this game's state records a
 * gender and the four roles do not require one, but a household whose spouse
 * is deliberately unnamed as to sex sits beside a panel that would otherwise
 * read "Sal, Lounge Singer" three times in four.
 */
const CONFIDANT_NAMES = GIVEN_NAMES.filter((n) => n.sex === 'f').map((n) => n.name);

export function confidant(state: GameState): ConfidantState {
  if (state.confidant) return state.confidant;

  const key = `confidant:${state.rng.seed}`;
  const pick = <T>(items: readonly T[], salt: number): T =>
    items[Math.min(items.length - 1, Math.floor(Rng.stableNoise(key, salt) * items.length))];

  state.confidant = {
    name: pick(CONFIDANT_NAMES, 1),
    role: pick(CONFIDANT.roles, 2),
    discretion: CONFIDANT.initialDiscretion,
    lastVisitDay: state.day,
    active: true,
    discovered: false,
  };
  return state.confidant;
}

/**
 * Moves discretion and keeps it inside its own bar. One place, so no branch
 * clamps differently — exported for `gen_affair_fallout`'s three answers
 * (`sim/eventgen.ts`), which are the only writers outside this file.
 */
export function setDiscretion(state: GameState, value: number): void {
  confidant(state).discretion = clamp(value, 0, 100);
}

/**
 * Whether there is anywhere to go tonight.
 *
 * Refuses by naming its own bar, like `canGoHome` and `canConsult` above.
 * Spends the same one body all three do — see `bodySpentTonight` — and also
 * refuses a night already given to the house, since a boss cannot be at
 * dinner and across town at the same time.
 */
export function canVisitConfidant(state: GameState): { ok: boolean; reason?: string } {
  const her = confidant(state);
  if (!her.active) {
    return { ok: false, reason: 'That is over. There is nowhere to go.' };
  }
  const cost = priced(state, CONFIDANT.visitCost);
  if (!canAfford(state, cost)) {
    return {
      ok: false,
      reason: `An evening across town runs ${Math.round(cost).toLocaleString('en-US')}, and you do not have it.`,
    };
  }
  if (bodySpentTonight(state)) {
    return {
      ok: false,
      reason: 'You are out on a job that needs you personally tonight. That is where you are.',
    };
  }
  if (state.flags['went_home_day'] === state.day) {
    return { ok: false, reason: 'Tonight is already spoken for. You cannot be in two places.' };
  }
  return { ok: true };
}

/**
 * An evening that is not about anybody else.
 *
 * Spends the same `went_home_day` an evening at home does, and deliberately
 * does *not* clear any neglect: the whole point is that this is the night the
 * house thought it was getting. A boss who answers every pull toward home
 * with this one is a boss whose neglect climbs at the full `HOME.perWeekAway`
 * while his stress does not — which is the trade the layer is for.
 */
export function visitConfidant(state: GameState): void {
  if (!canVisitConfidant(state).ok) return;
  if (!spend(state, priced(state, CONFIDANT.visitCost), 'world')) return;
  const her = confidant(state);
  state.player.stress = clamp(playerStress(state) - CONFIDANT.visitStressRelief, 0, STRESS.max);
  setDiscretion(state, her.discretion + CONFIDANT.visitDiscretionGain);
  her.lastVisitDay = state.day;
  state.flags['went_home_day'] = state.day;
  addLog(
    state,
    `An evening on the other side of the river, at an address that is not in anybody's book. Nobody called and nobody asked.`,
    'crew',
  );
}

/**
 * Money instead of time.
 *
 * Buys back more discretion than an evening does and costs no evening at all,
 * which is the point: rent paid on time, a dressmaker settled up, a doorman
 * who has a reason not to remember faces. What it does not buy is the stress
 * relief — that only comes from actually being there.
 */
export function canPayAllowance(state: GameState): { ok: boolean; reason?: string } {
  const her = confidant(state);
  if (!her.active) return { ok: false, reason: 'That is over. There is nobody to send it to.' };
  const cost = priced(state, CONFIDANT.allowanceCost);
  if (!canAfford(state, cost)) {
    return {
      ok: false,
      reason: `The envelope is ${Math.round(cost).toLocaleString('en-US')}, and you do not have it.`,
    };
  }
  return { ok: true };
}

export function payConfidantAllowance(state: GameState): void {
  if (!canPayAllowance(state).ok) return;
  if (!spend(state, priced(state, CONFIDANT.allowanceCost), 'world')) return;
  setDiscretion(state, confidant(state).discretion + CONFIDANT.allowanceDiscretionGain);
  addLog(
    state,
    `An envelope, hand to hand, nothing written down. The rent is current and the doorman has a reason not to remember faces.`,
    'crew',
  );
}

/**
 * A week of it going quiet, or a week of it not.
 *
 * Same weekly gate `tickHome` and `tickStress` use, and kept as its own call
 * in `clock.ts` beside them for the same reason `tickStress` is: this is not
 * a household fact, and `tickHome`'s own header scopes that function to the
 * household specifically.
 *
 * The one coupling to the household is `neglectDecayMultiplier` — a house
 * that is already cold notices faster. Nothing here runs once it is over.
 */
export function tickConfidant(state: GameState): void {
  if (state.day % HOME.intervalDays !== 0) return;
  const her = confidant(state);
  if (!her.active) return;
  const cold = home(state).neglect >= CONFIDANT.neglectDecayFrom;
  const decay = CONFIDANT.weeklyDiscretionDecay * (cold ? CONFIDANT.neglectDecayMultiplier : 1);
  setDiscretion(state, her.discretion - decay);
}

/**
 * Whether a case that is already listening would hear anything.
 *
 * The one read `investigation.ts` takes on this layer, kept here rather than
 * inlined there so the bar and the "is it still going on" check cannot drift
 * from the panel's own reading of the same two facts.
 */
export function confidantIsExposed(state: GameState): boolean {
  const her = confidant(state);
  return her.active && her.discretion < CONFIDANT.wiretapDiscretionThreshold;
}
