/**
 * The favour network — people outside the family who owe you.
 *
 * The design note is in `config/civic.ts`. What matters here is the shape:
 *
 * **Standing drifts toward what they see.** Nothing in this file is spent or
 * bought. Each figure watches one quantity the simulation already maintains —
 * street heat, districts held, public feeling, notoriety — and their opinion
 * walks toward it a few points a week. So the network is a consequence of how
 * the family is run, which is the thing that distinguishes it from the
 * `contactCost` shop it replaces.
 *
 * **A favour is a stock, not a switch.** `PATRON` and the agency contacts are
 * booleans with timers; you have the arrangement or you do not. Somebody who
 * owes you two and now owes you one is a different relationship, and it is the
 * one every story about this world is actually made of.
 *
 * `state.civic` is optional and lazily created, like `promises` and `leaks`
 * before it. An absent list reads as nobody knowing you, `SAVE_VERSION` does
 * not move, and `save.ts` never validates it.
 */

import { addLog } from './util';
import { activeCases } from './investigation';
import { clamp } from './rng';
import { priced } from './market';
import { earnDirty } from './economy';
import { crewList } from './npc';
import { businessDef, ownedBusinesses } from './business';
import {
  adjustSentiment,
  playerInfluence,
  territoryDef,
  territoryList,
} from './territory';
import {
  CIVIC,
  CIVIC_ATTRIBUTE,
  CIVIC_BY_ID,
  CIVIC_FIGURES,
  CIVIC_WORK,
  FAVOUR_EFFECT,
  PUBLIC_STANDING,
  PUBLIC_STANDING_FIGURES,
  PUBLIC_STANDING_TIERS,
  type CivicFigureDef,
  type PublicStandingTier,
} from '../config/civic';
import { SENTIMENT_HOSTILE_BELOW } from '../config/territories';
import { PATRON } from '../config/perception';
import type { CivicStanding, GameState } from './types';
import { holdingShare } from './holdings';
import { rivals } from './faction';
import { houseShort } from './houses';
import { rivalBusinesses } from './verbs';
import { BUSINESS_BY_ID } from '../config/businesses';
import type { FactionId } from '../config/factions';

/** Lazily created, so a save written before this existed still loads. */
function roster(state: GameState): CivicStanding[] {
  if (!state.civic) {
    state.civic = CIVIC_FIGURES.map((def) => ({
      id: def.id,
      standing: 0,
      owed: 0,
      lastFavourDay: -CIVIC.favourIntervalDays,
    }));
  }
  return state.civic;
}

/** Everybody, for callers that need the whole set rather than one figure. */
export function civicRoster(state: GameState): CivicStanding[] {
  return roster(state);
}

/**
 * Do somebody outside the family a favour, and have it count.
 *
 * Returns whether the standing actually moved. The caller has already spent
 * the money by the time this is asked — that is deliberate, and it is the rule
 * `INFLUENCE_FROM.approachCooldownDays` set: the credit is rate-limited, the
 * action is not. A boss may keep writing cheques to the same councilman every
 * week and the councilman will keep taking them; what he will not do is think
 * twice as well of you for the second one.
 *
 * It grants no influence. Helping a man makes *him* think better of you, which
 * is the fiction and the whole shape of this file: standing is a consequence of
 * how the family is run, never a thing bought. An earlier version paid +1 to
 * the player's influence as well, which made nine memos and $81,000 into the
 * patron's Influence 9 — a `contactCost` shop reintroduced by the back door.
 */
export function helpFigure(state: GameState, id: string, standing: number): boolean {
  const held = figure(state, id);
  const since = state.day - (held.lastHelpedDay ?? -Infinity);
  if (since < CIVIC.helpCooldownDays) return false;
  held.lastHelpedDay = state.day;
  held.standing = clamp(held.standing + standing, 0, 100);
  return true;
}

export function figure(state: GameState, id: string): CivicStanding {
  const found = roster(state).find((f) => f.id === id);
  if (found) return found;
  // A figure added to the catalogue after this save was written.
  const fresh: CivicStanding = {
    id,
    standing: 0,
    owed: 0,
    lastFavourDay: -CIVIC.favourIntervalDays,
  };
  roster(state).push(fresh);
  return fresh;
}

/**
 * What the figure is looking at, as a 0..100 score in their favour.
 *
 * All four read something the game already keeps, and all four are stated as
 * "higher is better for you" so the drift below has one direction to worry
 * about.
 */
/**
 * What each of them is looking at, 0..100. Exported so the readings can be
 * tested directly — a figure whose bar sits outside the range of his own
 * quantity is a defect no end-to-end test can see.
 */
export function scoreFor(state: GameState, def: CivicFigureDef): number {
  switch (def.watches) {
    case 'quiet':
      return clamp(100 - state.org.heat, 0, 100);
    case 'payroll': {
      /*
         Who gets hired, which is the first thing his own blurb says he cares
         about — and the second thing this figure has been asked to read.

         He counted districts held. That was right while the ladder asked for
         ground and wrong the moment it stopped: the highest district gate
         anywhere in `OPERATIONS` is three, so ground saturates for every
         player who opens the board and buys nothing after that. Measured
         across 36 careers at day 300, districts controlled read 4 / 4 / 4 with
         a minimum of 3 — a point mass. He owed all thirty-six whatever they
         did.

         Counting footholds instead of control was tried first and failed the
         same way one repair earlier, for the same reason. The quantity is the
         problem, not the threshold on it: nothing in this game asks for a
         fourth district, so a rational player stops where the board stops.

         A payroll has no such ceiling and it is the only candidate that
         measured with real spread — 31 / 34 / 38 across the population, from
         17 to 47. A union boss counts members.
      */
      const onTheBooks = crewList(state).filter((n) => n.status !== 'dead').length;
      return clamp((onTheBooks / CIVIC.unionPayroll) * 100, 0, 100);
    }
    case 'respectability': {
      /*
         What you have built in the neighbourhood, not what it is putting up
         with.

         This read the average public feeling across the districts you work,
         and that quantity ran the wrong way twice over.

         It has no upside: `SENTIMENT_RECOVERY_PER_WEEK` climbs back only as
         far as `SENTIMENT_START`, and nothing in ordinary play pushes a
         district past it. Measured over 36 careers at day 300, the best worked
         district read 49.1 / 50.0 / 50.0 and not one career had a single
         district above 50.

         And it falls with play, because working a district is what costs
         feeling. The mean across worked districts read 34.6 / 37.2 / 38.3 with
         a population maximum of 40.7 — against a bar of 50. He was not
         fragile, he was unreachable by construction, and his favour was the
         one thing in this game that got further away the more you played.

         Fronts are the ward politician's actual interest and the thing
         `lose_the_paperwork` is a favour about. Feeling stays in the reading
         as a gate rather than as the whole of it: a business nobody in the
         district can stand is not something anybody wants to be photographed
         next to.
      */
      const seen = ownedBusinesses(state).filter(
        (b) => (state.territories[b.territoryId]?.sentiment ?? 0) >= SENTIMENT_HOSTILE_BELOW,
      ).length;
      return clamp((seen / CIVIC.respectableFronts) * 100, 0, 100);
    }
    case 'discretion': {
      /*
         Two terms, because one of them does not move.

         Notoriety is the papers, and across 300 days it peaks at 3 — so the
         judge spent the whole game reading 97 and owing everybody. What a
         judge is actually exposed to is a live file with your name in it, and
         that runs the full range.
      */
      const worst = activeCases(state).reduce((n, c) => Math.max(n, c.strength), 0);
      return clamp(
        100 - (state.city?.notoriety ?? 0) - worst * CIVIC.discretionCaseWeight,
        0,
        100,
      );
    }
  }
}

/**
 * A week of everybody quietly forming an opinion.
 *
 * Drift toward the score rather than accumulate from it, so a family that
 * stops being quiet loses the captain without anything having to remember to
 * take it away.
 */
export function tickCivic(state: GameState): void {
  if (state.day % CIVIC.intervalDays !== 0) return;

  for (const def of CIVIC_FIGURES) {
    const held = figure(state, def.id);
    const target = scoreFor(state, def);
    const toward = target > held.standing ? CIVIC.driftPerWeek : -CIVIC.driftPerWeek;
    const moved = Math.abs(target - held.standing) < CIVIC.driftPerWeek ? target : held.standing + toward;

    // People forget. Applied after the drift so a figure sitting exactly on
    // their target still slides when nothing is going their way.
    held.standing = clamp(moved - CIVIC.decayPerWeek, 0, 100);

    const ready = state.day - held.lastFavourDay >= favourInterval(state);
    if (held.standing >= def.owesAbove && ready && held.owed < CIVIC.maxOwed) {
      held.owed += 1;
      held.lastFavourDay = state.day;
      addLog(
        state,
        `${def.title} owes you one. That is not a thing to spend twice.`,
        'crew',
      );
    }
  }
}

export interface CivicRead {
  id: string;
  title: string;
  blurb: string;
  standing: number;
  owed: number;
  /** What spending one would do, in a sentence. */
  grants: string;
  /** Null when they will take a meeting; the reason when they will not. */
  blocked: string | null;
}

const GRANT_TEXT: Record<string, string> = {
  bury_a_case: 'Takes the weight off an open case and leaves it cold for a while.',
  open_the_door: 'Gets one of your people out of custody today.',
  quiet_the_street: 'Brings a district back around to you.',
  lose_the_paperwork: 'City hall finds something else to look at for a season.',
};

export function civicRead(state: GameState): CivicRead[] {
  return CIVIC_FIGURES.map((def) => {
    const held = figure(state, def.id);
    return {
      id: def.id,
      title: def.title,
      blurb: def.blurb,
      standing: Math.round(held.standing),
      owed: held.owed,
      grants: GRANT_TEXT[def.grants] ?? '',
      blocked: canSpendFavour(state, def.id).reason ?? null,
    };
  });
}

export interface FavourCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Whether they would do it, and if not, which number is saying no.
 *
 * Every refusal names its threshold and where you stand against it, because
 * `refusals.test.ts` requires it and because F10 was four rounds of a player
 * being turned away by a number nobody would show them.
 */
/**
 * How long between favours, which the ground you hold shortens.
 *
 * Downtown is where the real money is and the Heights is where it arrived two
 * generations ago; holding either means the people who run the city come round
 * more often. Exposed rather than inlined so the panel can say so and a test
 * can read it without ticking a year. See `config/holdings.ts`.
 */
export function favourInterval(state: GameState): number {
  return CIVIC.favourIntervalDays * (1 - holdingShare(state, 'civic'));
}

export function canSpendFavour(state: GameState, id: string): FavourCheck {
  const def = CIVIC_BY_ID[id];
  if (!def) return { ok: false, reason: 'Nobody by that name.' };
  const held = figure(state, id);

  const pull = state.player.attributes[CIVIC_ATTRIBUTE];
  if (pull < def.needsInfluence) {
    return {
      ok: false,
      reason:
        `${def.title} does not take meetings at your level. ` +
        `Needs Influence ${def.needsInfluence}; you have ${Math.floor(pull)}.`,
    };
  }
  if (held.standing < CIVIC.coldBelow) {
    return {
      ok: false,
      reason:
        `${def.title} does not know you. Standing is ${Math.round(held.standing)} ` +
        `and anything below ${CIVIC.coldBelow} is a stranger.`,
    };
  }
  if (held.owed <= 0) {
    /*
       Two different refusals, because the old one named a condition the player
       had already met.

       A round-17 tester paid $9,000 to lift a police captain's standing from 49
       to 71 against a stated bar of 68, came back, and read *"they start owing
       above 68"* on a dead button. The bar was met. What was missing was the
       clock: `tickCivic` grants at most one favour per figure per
       `favourInterval`, so crossing the bar starts a wait nothing on the screen
       mentioned. They filed the whole favour economy as unreachable, and they
       were right to — a refusal that restates a satisfied condition reads as
       broken, not as pending.
    */
    const wait = Math.ceil(favourInterval(state) - (state.day - held.lastFavourDay));
    if (held.standing >= def.owesAbove && wait > 0) {
      return {
        ok: false,
        reason:
          `${def.title} thinks well enough of you — standing is ` +
          `${Math.round(held.standing)}, against ${def.owesAbove}. These things are not ` +
          `asked for twice in a month; give it ${wait} more ${wait === 1 ? 'day' : 'days'}.`,
      };
    }
    return {
      ok: false,
      reason:
        `${def.title} does not owe you anything. Standing is ` +
        `${Math.round(held.standing)}; they start owing above ${def.owesAbove}.`,
    };
  }
  return { ok: true };
}

export interface FavourResult {
  ok: boolean;
  message: string;
}

/**
 * Call it in.
 *
 * `target` is whatever the favour needs — a case id, a district id — and is
 * ignored by the ones that do not need one. Deliberately not a union type:
 * the panel passes what the player picked, and a favour that cannot find its
 * target refuses rather than silently doing nothing, which is how `PATRON`
 * used to behave when its ninety days were already running.
 */
export function spendFavour(state: GameState, id: string, target?: string): FavourResult {
  const check = canSpendFavour(state, id);
  if (!check.ok) return { ok: false, message: check.reason ?? 'No.' };

  const def = CIVIC_BY_ID[id];
  const held = figure(state, id);
  const done = apply(state, def, target);
  if (!done.ok) return done;

  held.owed -= 1;
  addLog(state, done.message, 'crew');
  return done;
}

/**
 * Whether they will find you work, and why not.
 *
 * Same three gates as calling in the favour for anything else — they must know
 * you, take meetings at your level, and actually owe you one. Deliberately not
 * a looser set: this is a second use of one currency, not a cheaper one.
 */
export function canAskForWork(state: GameState, id: string): FavourCheck {
  return canSpendFavour(state, id);
}

/**
 * Call in a favour as money instead of as protection.
 *
 * Spends the favour and takes `CIVIC_WORK.standingCost` off the relationship,
 * which is the actual price — see the note in `config/civic.ts` for why the
 * favour alone is not one. The money is dirty: it is a job, not a gift.
 */
export function askForWork(state: GameState, id: string): FavourResult {
  const check = canAskForWork(state, id);
  if (!check.ok) return { ok: false, message: check.reason ?? 'No.' };

  const def = CIVIC_BY_ID[id];
  const held = figure(state, id);

  const pay = Math.round(
    priced(state, CIVIC_WORK.basePay + def.owesAbove * CIVIC_WORK.payPerOwesAbove),
  );

  held.owed -= 1;
  held.standing = clamp(held.standing - CIVIC_WORK.standingCost, 0, 100);
  earnDirty(state, pay);

  const message =
    `${def.title} put something your way. $${pay.toLocaleString('en-US')}, and they ` +
    `will remember that you asked for it.`;
  addLog(state, message, 'money');
  return { ok: true, message };
}

/**
 * The first of three favours in this network spent outward, on a rival,
 * rather than inward on a problem of the player's own.
 *
 * Every one of `apply()`'s four grants fixes something happening to the
 * player — a case, a man in custody, a district, city-hall pressure. Three
 * of the four figures turn out to have an honest reading pointed the other
 * way as well. The union boss does not just calm a street, he can also
 * empty one, and there is nothing else in this game that lets a boss reach
 * a rival's payroll without a bullet involved. See `callTheLaw` for the
 * captain's own outward reading, added the same day for the same reason,
 * and `pullPermit` for the alderman's — added later the same day, once
 * `RivalBusiness` gave a rival's fronts a real identity to point a permit
 * at, which this comment originally (and at the time correctly) said did
 * not exist.
 *
 * Deliberately not extended to all four. The judge is the one grant with
 * no honest outward reading and none has turned up since: `open_the_door`
 * springs a specific man from a specific cell, and a rival's own men are
 * `Capo[]` and a count rather than individuals the sim can name one of.
 * Inventing a use for him would be manufacturing parity rather than
 * following where a relationship actually reaches, which is the same
 * judgment call this comment's own history has already made twice.
 */
export function canCallWalkout(state: GameState, targetFactionId: FactionId): FavourCheck {
  const check = canSpendFavour(state, 'union');
  if (!check.ok) return check;
  const target = rivals(state).find((f) => f.id === targetFactionId);
  if (!target || target.strength <= 0) return { ok: false, reason: 'There is nobody there to walk out.' };
  if (target.walkoutUntilDay && state.day < target.walkoutUntilDay) {
    const left = target.walkoutUntilDay - state.day;
    return {
      ok: false,
      reason: `${houseShort(state, targetFactionId)} is already sitting idle — ${left} ${left === 1 ? 'day' : 'days'} left on it.`,
    };
  }
  return { ok: true };
}

export function callWalkout(state: GameState, targetFactionId: FactionId): FavourResult {
  const check = canCallWalkout(state, targetFactionId);
  if (!check.ok) return { ok: false, message: check.reason ?? 'No.' };

  const held = figure(state, 'union');
  held.owed -= 1;
  const target = state.factions[targetFactionId];
  target.walkoutUntilDay = state.day + FAVOUR_EFFECT.walkoutDays;

  const message =
    `Nobody is showing up to work for the ${houseShort(state, targetFactionId)} for ` +
    `${FAVOUR_EFFECT.walkoutDays} days. Their fronts are not making them anything until it lifts.`;
  addLog(state, message, 'crew');
  return { ok: true, message };
}

/**
 * The captain's own outward reading — see `canCallWalkout`'s doc comment
 * for why he and the union boss are the two figures this applies to.
 *
 * `bury_a_case` cools a live file of the player's own; this is the same
 * lever pointed at a rival. A rival family has no individually tracked
 * case the way the player does, so there is nothing here to bury or build
 * — what exists instead is `Faction.heat`, a real number their own weekly
 * decisions already read (a hot family scores every option more
 * cautiously, and `AGENDA`'s go-quiet option scores higher above
 * `quietAbove`), so a captain's division taking an interest in somebody
 * else genuinely changes how that family behaves, not only what it feels
 * like to have spent the favour.
 *
 * No duration to track, unlike the walkout: heat already decays on its
 * own every week (`AI.heatDecayPerWeek`), so a one-time addition ages out
 * by the mechanism the game already has rather than needing a second one.
 */
export function canCallTheLaw(state: GameState, targetFactionId: FactionId): FavourCheck {
  const check = canSpendFavour(state, 'captain');
  if (!check.ok) return check;
  const target = rivals(state).find((f) => f.id === targetFactionId);
  if (!target || target.strength <= 0) {
    return { ok: false, reason: 'There is nobody there for a division to take an interest in.' };
  }
  return { ok: true };
}

export function callTheLaw(state: GameState, targetFactionId: FactionId): FavourResult {
  const check = canCallTheLaw(state, targetFactionId);
  if (!check.ok) return { ok: false, message: check.reason ?? 'No.' };

  const held = figure(state, 'captain');
  held.owed -= 1;
  const target = state.factions[targetFactionId];
  target.heat = clamp(target.heat + FAVOUR_EFFECT.heatOnRival, 0, 100);

  const message = `A division has started asking questions about the ${houseShort(state, targetFactionId)}. That is their problem now.`;
  addLog(state, message, 'crew');
  return { ok: true, message };
}

/**
 * The alderman's own outward reading — see `canCallWalkout`'s doc comment
 * for the third of the three figures this applies to, and why.
 *
 * Scoped narrower than the other two on purpose: a permit is pulled on one
 * specific business, not on a family generally, because that is genuinely
 * what an alderman controls and a captain or a union boss does not — a
 * signature on one particular building rather than a division or a
 * membership. The mechanism is the walkout's own, at the scale of one
 * business rather than a whole payroll: `collectIncome` in `faction.ts`
 * already reads `businessCount` for its income term, so pulling a permit
 * simply excludes this one business from that count for the duration
 * rather than needing a second formula.
 */
export function canPullPermit(state: GameState, businessId: string): FavourCheck {
  const check = canSpendFavour(state, 'alderman');
  if (!check.ok) return check;
  const biz = rivalBusinesses(state)[businessId];
  if (!biz) return { ok: false, reason: 'No such business.' };
  if (biz.permitPulledUntilDay && state.day < biz.permitPulledUntilDay) {
    const left = biz.permitPulledUntilDay - state.day;
    return {
      ok: false,
      reason: `Already tied up in paperwork — ${left} ${left === 1 ? 'day' : 'days'} left on it.`,
    };
  }
  return { ok: true };
}

export function pullPermit(state: GameState, businessId: string): FavourResult {
  const check = canPullPermit(state, businessId);
  if (!check.ok) return { ok: false, message: check.reason ?? 'No.' };

  const held = figure(state, 'alderman');
  held.owed -= 1;
  const biz = rivalBusinesses(state)[businessId];
  biz.permitPulledUntilDay = state.day + FAVOUR_EFFECT.permitPulledDays;

  const name = BUSINESS_BY_ID[biz.defId]?.name ?? 'The business';
  const message = `${name} has a permit problem that will take ${FAVOUR_EFFECT.permitPulledDays} days to sort out. It is not making anybody anything until then.`;
  addLog(state, message, 'crew');
  return { ok: true, message };
}

function apply(state: GameState, def: CivicFigureDef, target?: string): FavourResult {
  switch (def.grants) {
    case 'bury_a_case': {
      const open = Object.values(state.law.investigations).filter(
        (i) => i.status === 'open' || i.status === 'cold',
      );
      const found = target ? state.law.investigations[target] : open[0];
      if (!found || (found.status !== 'open' && found.status !== 'cold')) {
        return { ok: false, message: 'There is no open file for them to lose.' };
      }
      found.strength = clamp(found.strength - FAVOUR_EFFECT.buryEvidence, 0, 100);
      found.lastProgressDay = state.day + FAVOUR_EFFECT.buryColdDays;
      return {
        ok: true,
        message:
          `A file went quiet. ${FAVOUR_EFFECT.buryEvidence} points off the case, and nobody ` +
          `is expected to look at it for ${FAVOUR_EFFECT.buryColdDays} days.`,
      };
    }

    case 'open_the_door': {
      const inside = crewList(state).filter((n) => n.status === 'arrested');
      const who = target ? inside.find((n) => n.id === target) : inside[0];
      if (!who) return { ok: false, message: 'Nobody of yours is inside.' };
      who.status = 'active';
      who.unavailableUntilDay = null;
      return { ok: true, message: `${who.name} walked out this afternoon. No charges recorded.` };
    }

    case 'quiet_the_street': {
      const t = target
        ? state.territories[target]
        : territoryList(state)
            .filter((x) => playerInfluence(x) >= 10)
            .sort((a, b) => a.sentiment - b.sentiment)[0];
      if (!t) return { ok: false, message: 'You do not work anywhere they have any pull.' };
      adjustSentiment(state, t.id, FAVOUR_EFFECT.quietSentiment);
      return {
        ok: true,
        message:
          `Word went round ${territoryDef(t.id).name} that you are not the problem. ` +
          `Public feeling is ${Math.round(t.sentiment)}; below ${SENTIMENT_HOSTILE_BELOW} ` +
          `nobody there sells you a business.`,
      };
    }

    case 'lose_the_paperwork': {
      if (!state.city) return { ok: false, message: 'Nothing is pending at the building.' };
      state.city.patronUntilDay = state.day + FAVOUR_EFFECT.paperworkDays;
      return {
        ok: true,
        message:
          `The file is at the bottom of somebody's tray for ${FAVOUR_EFFECT.paperworkDays} days. ` +
          `Pressure is held to ${Math.round(PATRON.pressureShare * 100)}% of where it would be.`,
      };
    }
  }
}

// ------------------------------------------------------- public standing ---

/**
 * The three real, already-tracked facts `publicStanding` synthesizes.
 *
 * Split out so `publicStanding` and `publicStandingRead` (the UI's one call)
 * share a single computation rather than two copies that could drift.
 */
function publicStandingTerms(state: GameState): {
  sentiment: number;
  legitimacy: number;
  alliance: number;
} {
  // "Controlled" here is real presence, not a `SLOTS_BY_CONTROL` tier — the
  // same bar `delegation.ts` uses to decide a district is yours at all.
  const held = territoryList(state).filter((t) => playerInfluence(t) > 0);
  const sentiment =
    held.length > 0
      ? held.reduce((sum, t) => sum + t.sentiment, 0) / held.length
      : PUBLIC_STANDING.neutralSentimentDefault;

  const owned = ownedBusinesses(state);
  const legitimacy =
    owned.length > 0
      ? owned.reduce((sum, b) => sum + businessDef(b).legitimacy, 0) / owned.length
      : PUBLIC_STANDING.neutralLegitimacyDefault;

  /*
     Same neutral-default reasoning as the two terms above — a figure nobody
     has ever engaged has not been measured, which is not the same as a
     figure genuinely run down to zero through real anger. The distinction
     lives in whether the id is already in `state.civic`, checked here by
     reading that field directly rather than through `figure()`/`roster()` —
     both of those auto-create the entry (and, via `roster()`'s own lazy
     init, every other figure in `CIVIC_FIGURES` alongside it, in one shot)
     the instant they are called, which would make "never engaged" mean
     nothing by the time this function finished asking the question.

     Averaged only over whichever of the four already exist; a figure that
     exists and has genuinely decayed to a real 0 still counts as that 0 —
     only "not in the roster at all" gets the neutral substitute.
  */
  const engaged = PUBLIC_STANDING_FIGURES
    .map((id) => state.civic?.find((f) => f.id === id))
    .filter((f): f is CivicStanding => f !== undefined);
  const alliance =
    engaged.length > 0
      ? engaged.reduce((sum, f) => sum + f.standing, 0) / engaged.length
      : PUBLIC_STANDING.neutralAllianceDefault;

  return { sentiment, legitimacy, alliance };
}

function publicStandingComposite(
  terms: { sentiment: number; legitimacy: number; alliance: number },
  heat: number,
): number {
  const heatDrag = Math.round(heat * PUBLIC_STANDING.heatDragScale);
  const raw =
    terms.sentiment * PUBLIC_STANDING.sentimentWeight +
    terms.legitimacy * PUBLIC_STANDING.legitimacyWeight +
    terms.alliance * PUBLIC_STANDING.allianceWeight -
    heatDrag;
  return clamp(Math.round(raw), 0, 100);
}

function tierFor(score: number): PublicStandingTier {
  return (
    PUBLIC_STANDING_TIERS.find((tier) => score >= tier.bar) ??
    PUBLIC_STANDING_TIERS[PUBLIC_STANDING_TIERS.length - 1]
  );
}

/**
 * The boss's public identity, 0..100. Derived only — see `config/civic.ts`'s
 * `PublicStandingTier` header for why this is never stored.
 *
 * Synthesizes district sentiment, front legitimacy and civic-figure standing
 * — three facts the simulation already keeps — and docks federal heat. The
 * weights and the two no-ground/no-fronts defaults live in `PUBLIC_STANDING`.
 */
export function publicStanding(state: GameState): number {
  return publicStandingComposite(publicStandingTerms(state), state.org.heat);
}

/** Which of the four `PUBLIC_STANDING_TIERS` the current score reads as. */
export function publicStandingTier(state: GameState): PublicStandingTier {
  return tierFor(publicStanding(state));
}

export interface PublicStandingRead {
  score: number;
  tier: PublicStandingTier;
  /** Average sentiment across districts actually held. */
  sentiment: number;
  /** Average legitimacy of owned fronts. */
  legitimacy: number;
  /** Average standing with the four civic figures the meter reads. */
  alliance: number;
}

/** Everything the Public Standing card needs, in one call. See `PlayerPanel.tsx`. */
export function publicStandingRead(state: GameState): PublicStandingRead {
  const terms = publicStandingTerms(state);
  const score = publicStandingComposite(terms, state.org.heat);
  return { score, tier: tierFor(score), ...terms };
}
