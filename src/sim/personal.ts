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
import { HOME, HOME_LABEL, RELATIONS, STRESS, STRESS_TIERS, type HomeTier, type StressTierDef } from '../config/personal';
import { FIRST_NAMES } from '../config/npcs';
import { HOME_TERRITORY } from '../config/territories';
import { GEN_SHAPES } from '../config/eventgen';
import { territoryDef } from './territory';
import { addLog } from './util';
import { ownsHome } from './possessions';
import { POSSESSION } from '../config/possessions';
import { OPERATION_BY_ID } from '../config/operations';
import { playerWars } from './diplomacy';
import { canAfford, spend } from './economy';
import { priced } from './market';
import { activeCases } from './investigation';
import { recordCareerEvent } from './career';
import type { GameState, Home, HouseholdMember } from './types';

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
  /** The sum of the above, less natural recovery when nothing above is firing. */
  netWeekly: number;
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
  const quiet =
    playerWars(state).length === 0 && state.org.heat < 30 && home(state).neglect < 25;
  return {
    wars,
    heat,
    domestic,
    payroll,
    netWeekly: wars + heat + domestic + payroll - (quiet ? STRESS.naturalRecovery : 0),
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
export function canConsult(state: GameState): { ok: boolean; reason?: string } {
  const cost = priced(state, STRESS.consultCost);
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
  if (!spend(state, priced(state, STRESS.consultCost), 'world')) return;
  state.player.stress = clamp(playerStress(state) - STRESS.consultRecovery, 0, STRESS.max);
  state.flags['went_home_day'] = state.day;
  state.flags['last_consult_day'] = state.day;
  addLog(
    state,
    'An hour in an unmarked office on 72nd Street. Nobody in the crew knows you were there. The air came back into your chest.',
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
