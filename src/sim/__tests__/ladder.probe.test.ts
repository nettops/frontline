/**
 * Can a career reach the top of the ladder at all?
 *
 * There are seven ranks. A hundred-and-eighty-day probe reached the *second*
 * of them in four worlds out of twenty-four, which says nothing about the top
 * five: six months is not a career, and a ladder that takes years to climb is
 * not the same fault as a ladder nobody can climb.
 *
 * So this one runs for years and asks one question. Which rank does a career
 * end at, and on what day did each rung arrive?
 *
 * The distinction it exists to draw:
 *
 *   slow     ranks keep arriving, just a long way apart. A balance question,
 *            and arguably not even a fault.
 *   stuck    ranks stop arriving. Every career piles up against the same rung
 *            no matter how long it is given, which means a requirement is not
 *            reachable by the play the game affords rather than merely being
 *            expensive.
 *
 * Those two look identical in a six-month sample and have completely different
 * repairs, which is the whole reason this file is separate from `floor.probe`
 * rather than another assertion inside it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { availableOperations, launchOperation, operationCost } from '../operations';
import { crewList, isOutOfReach } from '../npc';
import { eligibleStewards, needsSteward, putInCharge } from '../delegation';
import {
  controlledTerritories,
  operableTerritories,
  playerInfluence,
  territoryList,
} from '../territory';
import { canPromote, canRecruit, promote, recruit, recruitCost } from '../crew';
import { cleanWorth, putAway, takeBack, totalFunds, weeklyWageBill } from '../economy';
import { HOLDINGS } from '../../config/economy';
import { isLayingLow } from '../heat';
import { fearLevel } from '../player';
import { acquireBusiness, canAcquire, healthPressure, launderOutlook } from '../business';
import { BUSINESSES, HEALTH } from '../../config/businesses';
import {
  FEAR,
  PAYDAY_INTERVAL,
  RANKS,
  RANK_BY_ID,
  ROLE_ORDER,
  rankIndex,
} from '../../config/economy';
import { claimStrength, eligibleHeirs, heirOf, nameHeir } from '../succession';
import { CLAIM } from '../../config/succession';
import { estate } from '../estate';
import { atWar, bond, factionStrength, playerStrength } from '../diplomacy';
import { CASE_CLOSED_BELOW, type LawyerLevel } from '../../config/lawEnforcement';
import { retainLawyer, weeklyLegalCost } from '../investigation';
import { AI, RIVAL_IDS } from '../../config/factions';
import { BOND } from '../../config/diplomacy';
import {
  availableRegisters,
  canSitDownWith,
  chooseRegister,
  clearSitdown,
  openSitdown,
  sitDownCandidates,
} from '../sitdown';

/** Carrying enough that a careful boss would go and ask about it. */
const SITDOWN_FROM_GRIEVANCE = 35;

/** Frightened enough that it is costing you loyalty every week. */
const SITDOWN_FROM_FEAR = 45;

/**
 * How much of this week's laundering capacity the bot refuses to spend on work.
 *
 * Zero, and measured rather than assumed. At 1 — holding back a full week's
 * capacity before launching anything — utilisation moved from 39% to 38% and
 * the amount laundered *fell*, from $145,587 a career to $135,709. The washing
 * machine is not idle because this bot spends its dirty too eagerly.
 *
 * It is idle because for 37% of paydays there is no front to put anything
 * through. That is the finding the reserve experiment produced, and it is
 * worth more than the experiment.
 */
const WASH_RESERVE = 1;
import { DRIFT, DRIFT_INTERVAL_DAYS } from '../../config/npcs';
import { wageExpectation } from '../npc';
import type { RankId } from '../types';
import { answerCheaply, ev, idle, median } from './helpers';

interface Climb {
  days: number;
  gameOver: boolean;
  /** The opening of the ending text, so a wave of early deaths has a name. */
  endedBy: string | null;
  /**
   * Weeks between the last handover and the day it stopped.
   *
   * `broke and alone` became the leading ending the moment removals started
   * handing over instead of ending the run, which raises the obvious question:
   * is a successor inheriting a family he cannot afford? Null means the run
   * ended under its founder.
   */
  weeksSinceHandover: number | null;
  /** Day each rank was first held. Missing means never reached. */
  reachedOn: Map<string, number>;
  /** Cases the agencies opened across the career. */
  casesOpened: number;
  banked: number;
  soldBack: number;
  heirsNamed: number;
  rankKept: number;
  rankLost: number;
  /**
   * Why a removal ended the family instead of handing it on.
   *
   * `removePlayer` only ends the game when nobody in the room is a serious
   * candidate — `claimStrength >= CLAIM.seriousAt`. So "convicted 12" does not
   * mean twelve convictions; it means twelve convictions that arrived at a
   * table with nobody at it. Counted weekly so the state at the crisis is
   * known rather than inferred.
   */
  succession: {
    weeksWithAnHeir: number;
    weeksWithASeriousCandidate: number;
    weeks: number;
  };
  /** How many bosses the organization got through. */
  handovers: number;
  /** The most the organization was ever worth in clean money, wallet plus held. */
  peakWorth: number;
  /** What the family was worth at the end, and at its best. */
  finalEstate: number;
  peakEstate: number;
  /**
   * The high-water marks the rank table actually reads.
   *
   * Rank asks what the family has ever managed, not what it holds today, so
   * "did this organization ever reach ten men" is the question that decides
   * whether the crew requirement is what stops it — and the crew *now* cannot
   * answer that.
   */
  bestCrew: number;
  bestEstate: number;
  bestOps: number;
  bestRespect: number;
  bestDistricts: number;
  /**
   * What influence actually does over a career.
   *
   * Control needs 50 and only one career in 36 ever held two districts there,
   * while crew and operations were met by 35. The question a count cannot
   * answer is whether influence climbs and stalls short of the line or never
   * approaches it at all — those have different repairs, and the probe has
   * never looked at influence once.
   */
  influence: {
    /** The most influence ever held in any single district. */
    peak: number;
    /** Districts that ever reached each band. */
    everPresence: number;
    everFoothold: number;
    everControl: number;
    /** Average influence across districts the family had any presence in. */
    meanWhereWorking: number;
    samples: number;
  };
  /** Weeks spent on retainer. Zero means the probe proved nothing about it. */
  legalWeeks: number;
  legalQuoted: number;
  legalQuotes: number;
  wageAtQuote: number;
  finalRank: RankId;
  finalCrew: number;
  peakClean: number;
  districtsHeld: number;
  fronts: number;
  /** Which requirement was furthest from being met at the end. */
  blockedBy: string | null;
  hires: number;
  /** Sit-downs actually held. Guards against measuring the remedy switched off. */
  sitdowns: number;
  hiring: { atTheCap: number; nobodyOffered: number; gameRefused: number; botDeclined: number; couldAndDid: number };
  lost: { dead: number; defected: number; inside: number };
  /** Bench marks written across the career. Checks whether standing.ts is a drain. */
  benchMarks: number;
  /** Total loyalty pushed down by each term across the career. */
  pushes: {
    underpaid: number;
    grievance: number;
    heatFear: number;
    fearRent: number;
    stagnation: number;
    samples: number;
  };
  /** What the washing machine did, and what stopped it, week by week. */
  wash: {
    /** Weeks classified by which side ran out first. */
    capacityBound: number;
    dirtyBound: number;
    nothingToWash: number;
    noFronts: number;
    /** Money, summed across the career. */
    laundered: number;
    cut: number;
    revenue: number;
    /** Capacity offered, summed over the same weeks, for a utilisation ratio. */
    capacity: number;
    /** Every dollar that ever landed in the clean pool. */
    cleanIn: number;
    /**
     * The whole organization's takings and its whole bill, per crew-week.
     *
     * The question underneath every other question in this file: does a man
     * bring in more than he costs? If he does not, no adjustment to fronts,
     * laundering, heat or the law lets an organization grow, and the rank
     * requirements are describing a family the arithmetic forbids.
     *
     * Dirty income is counted where it lands rather than where it is earned,
     * because jobs, trades, tribute and events all pay into the same pool and
     * the sum is what a payroll is met out of.
     */
    dirtyIn: number;
    wageBill: number;
    crewWeeks: number;
    /**
     * And where it went again.
     *
     * `spend` takes dirty first and only reaches the clean pool once dirty is
     * empty, so these are not budgets the player chose to pay out of clean —
     * they are the moments the clean pile was the only pile left. Split by who
     * asked for it: the four the bot decides, and everything the week takes
     * whether or not anybody decided anything.
     */
    cleanOut: { hires: number; jobs: number; fronts: number; events: number; upkeep: number };
  };
  /**
   * Why a career had no legitimate side yet.
   *
   * 38% of all paydays across twelve four-year careers happened before the
   * first front existed, and clean money is what the top of the ladder is
   * gated on. Counted once a week for as long as the career owns nothing,
   * against the reason that was *closest* to being met — a district you nearly
   * hold is a different fault from a purchase you cannot afford.
   */
  firstFront: {
    day: number | null;
    /** Weeks spent with nothing, by what stopped it. */
    control: number;
    slots: number;
    sentiment: number;
    money: number;
    /** Could have bought one, but four weeks of wages would not have been left. */
    reserve: number;
  };
  /**
   * Bought against still standing.
   *
   * The first reading of this said 38% of paydays had no front and the first
   * front arrived on day 35, which cannot both describe the same thing. A
   * front that goes under is still a record in `state.businesses` and is no
   * longer in `ownedBusinesses`, so "no fronts" was silently counting two
   * different situations — never having one, and having buried them all.
   */
  /**
   * The two ways a career gets taken off the board, and what fed them.
   *
   * Making fronts durable moved early endings from 13/36 to 23/36, with rival
   * killings and convictions both roughly doubling. Both removals are gated on
   * quantities that grow with the organization, so this counts which gate the
   * career was standing behind each week rather than inferring it afterwards
   * from the ending text.
   */
  danger: {
    /** Weeks the crew was large enough to be worth going to war with at all. */
    weeksWorthAttacking: number;
    /** Weeks a rival was aggrieved enough, strong enough, and facing a target. */
    weeksAllWarClauses: number;
    weeksAtWar: number;
    /** The highest the player's strength ever got, against a threshold of 22. */
    peakStrength: number;
    heat: number;
    caseStrength: number;
    peakCase: number;
    weeks: number;
    /**
     * The same case strength, split at the first year.
     *
     * The point of the split is to tell "the law grows with you" apart from
     * "the law is simply always there". Those two look identical in a career
     * mean and have nothing in common as design problems.
     */
    caseYearOne: number;
    weeksYearOne: number;
    /** The case ledger as `tickInvestigations` wrote it, at career end. */
    ledger: {
      absorbed: number;
      work: number;
      visibility: number;
      decayed: number;
      caseWeeks: number;
      coldWeeks: number;
      closedByDecay: number;
    };
  };
  frontLife: {
    bought: number;
    shuttered: number;
    weeksNone: number;
    weeksAllDead: number;
    /** The four things wearing a front down, averaged per front-week. */
    kill: { sentiment: number; exposure: number; rivals: number; city: number; weeks: number };
  };
}

/**
 * A career played straight, for as long as it lasts.
 *
 * The same competent-but-not-optimal bot as the floor probe: best expected
 * money it can pay for, hires within recent income, delegates ground it holds,
 * buys a front when one is affordable, and stops working when the heat is
 * dangerous. It does not need to be a good player. It needs to be a player who
 * never makes an obviously stupid decision, because the question is whether the
 * ladder is climbable at all, not how fast an expert climbs it.
 */
function climb(seed: number, days: number): Climb {
  const state = newGame({ name: 'Ladder', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  const reachedOn = new Map<string, number>();
  let peakClean = 0;
  let peakWorth = 0;
  let peakEstate = 0;
  /*
     Influence, watched per district rather than in aggregate.

     A family's total influence says nothing useful — three districts at
     Foothold and one at Control are worth completely different things and add
     to the same number. What matters is how high any single district ever got,
     because Control is a per-district line.
  */
  const infBest = new Map<string, number>();
  let infTotal = 0;
  let infSamples = 0;
  const everAt = (min: number) => [...infBest.values()].filter((v) => v >= min).length;
  let hires = 0;
  let sitdowns = 0;
  const pushes = {
    underpaid: 0,
    grievance: 0,
    heatFear: 0,
    fearRent: 0,
    stagnation: 0,
    samples: 0,
  };
  const wash = {
    capacityBound: 0,
    dirtyBound: 0,
    nothingToWash: 0,
    noFronts: 0,
    laundered: 0,
    cut: 0,
    revenue: 0,
    capacity: 0,
    cleanIn: 0,
    dirtyIn: 0,
    wageBill: 0,
    crewWeeks: 0,
    cleanOut: { hires: 0, jobs: 0, fronts: 0, events: 0, upkeep: 0 },
  };
  /** Weeks the bot was paying for representation, so the readout can say so. */
  let legalWeeks = 0;
  /** Clean money moved out of the wallet, and dragged back out of it. */
  let banked = 0;
  let soldBack = 0;
  /** How many times a successor had to be named across the whole run. */
  let heirsNamed = 0;
  /** Handovers where the family's position on the ladder survived, and not. */
  let rankKept = 0;
  let rankLost = 0;
  const succ = { weeksWithAnHeir: 0, weeksWithASeriousCandidate: 0, weeks: 0 };
  /** What a 'firm' retainer would have cost each week, against the wage bill. */
  let legalQuoted = 0;
  let legalQuotes = 0;
  let wageAtQuote = 0;
  const danger = {
    weeksWorthAttacking: 0,
    weeksAllWarClauses: 0,
    weeksAtWar: 0,
    peakStrength: 0,
    heat: 0,
    caseStrength: 0,
    peakCase: 0,
    weeks: 0,
    caseYearOne: 0,
    weeksYearOne: 0,
  };
  const frontLife = {
    bought: 0,
    shuttered: 0,
    weeksNone: 0,
    weeksAllDead: 0,
    kill: { sentiment: 0, exposure: 0, rivals: 0, city: 0, weeks: 0 },
  };
  const firstFront = {
    day: null as number | null,
    control: 0,
    slots: 0,
    sentiment: 0,
    money: 0,
    reserve: 0,
  };
  /*
     Records what a single action moved in the clean pool, both ways.

     The first version counted only the outgoings here and took income solely
     from the day tick, and the buckets promptly summed to $41,000 more than
     the reported income — because an event that *pays* the player was
     invisible to it. Every site has to be measured symmetrically or the two
     totals are quoted in different currencies.
  */
  const clean = <T>(into: keyof typeof wash.cleanOut, act: () => T): T => {
    const before = state.org.cash;
    const out = act();
    if (state.org.cash < before) wash.cleanOut[into] += before - state.org.cash;
    else wash.cleanIn += state.org.cash - before;
    return out;
  };
  const hiring = {
    atTheCap: 0,
    nobodyOffered: 0,
    gameRefused: 0,
    botDeclined: 0,
    couldAndDid: 0,
  };

  reachedOn.set(state.player.rank, 0);

  for (let d = 0; d < days; d++) {
    clean('events', () => answerCheaply(state, rng));

    /*
       Why the payroll stops growing, counted rather than guessed.

       Careers rest at five people and Capo needs ten. That has three possible
       causes with three different repairs: the game refuses (a cap, an empty
       recruit pool, a rule), this bot refuses (its own caution about the wage
       bill), or people leave as fast as they arrive. They are indistinguishable
       from the outside and the probe is the only thing that can tell them
       apart.
    */
    const bill = weeklyWageBill(state);
    if (state.day % 7 === 0) {
      const room = RANKS[rankIndex(state.player.rank)].maxCrew;
      const held = crewList(state).filter((n) => n.status !== 'dead').length;
      if (held < room) {
        const anyOffered = Object.keys(state.recruits).length > 0;
        const anyAllowed = Object.keys(state.recruits).some((id) => canRecruit(state, id).ok);
        if (!anyOffered) hiring.nobodyOffered += 1;
        else if (!anyAllowed) hiring.gameRefused += 1;
        else if (totalFunds(state) < recruitCost(state) * 3 || bill > totalFunds(state) / 4) {
          hiring.botDeclined += 1;
        } else hiring.couldAndDid += 1;
      } else {
        hiring.atTheCap += 1;
      }
    }

    for (const id of Object.keys(state.recruits)) {
      if (totalFunds(state) < recruitCost(state) * 3) break;
      if (bill > totalFunds(state) / 4) break;
      if (canRecruit(state, id).ok) {
        clean('hires', () => recruit(state, id));
        hires += 1;
        break;
      }
    }

    /*
       Work the grievances, which is the counterplay nobody has ever measured.

       Grievance is the largest single force pushing loyalty down — 1.58 a week
       against the 2.5 a boss earns by paying well — and `sitdown.ts` exists to
       clear it. No probe in this project had ever held one, so that 1.58 was
       measured with the remedy switched off, which is the same mistake as the
       bot that never delegated.

       The policy is what a careful player does: find whoever is carrying the
       most, sit down with them under `settle`, and say the plainest true thing
       available rather than the cleverest. `SITDOWN.cooldownDays` stops it
       being spammed at one man.
    */
    const inARoom = !!state.sitdown && !state.sitdown.done;
    if (state.day % 3 === 0 && !inARoom) {
      const sore = sitDownCandidates(state)
        .filter(
          (n) =>
            n.stats.grievance >= SITDOWN_FROM_GRIEVANCE ||
            n.stats.fear >= SITDOWN_FROM_FEAR,
        )
        .sort(
          (a, b) =>
            b.stats.grievance + b.stats.fear - (a.stats.grievance + a.stats.fear),
        );
      for (const npc of sore) {
        if (!canSitDownWith(state, npc.id).ok) continue;
        if (!openSitdown(state, 'crew', npc.id, 'settle').ok) continue;
        // Three beats is the whole conversation; take the plainest each time.
        for (let beat = 0; beat < 3; beat += 1) {
          const open = availableRegisters(state);
          if (open.length === 0) break;
          /*
             Play the line the mechanic was built around, not the first thing
             on the list.

             A sit-down is a chain: `listen` is the opener that finds out what
             a man is carrying, and `name_it` — which only unlocks once you
             have listened — is the register that actually takes it off the
             table, worth `settledGrievance` and `settledLoyalty`.

             The first version of this bot opened with `listen` and then took
             whatever came next, so it started every conversation properly and
             never once finished one. It held 125 sit-downs a career and
             settled nothing, and duly reported that working grievances makes
             them worse. That is the same failure as the bot that never
             delegated, and it is the third time in this file's history.
          */
          const plain =
            open.find((r) => r.id === 'reassure') ??
            open.find((r) => r.id === 'name_it') ??
            open.find((r) => r.id === 'listen') ??
            open.find((r) => r.id === 'level') ??
            open[0];
          if (!chooseRegister(state, rng, plain.id).ok) break;
          if (!state.sitdown || state.sitdown.done) break;
        }
        sitdowns += 1;
        clearSitdown(state);
        break;
      }
    }

    if (state.day % 7 === 0 && needsSteward(state)) {
      const hands = eligibleStewards(state);
      const loose = territoryList(state)
        .filter((t) => !t.stewardId && playerInfluence(t) > 20)
        .sort((a, b) => playerInfluence(b) - playerInfluence(a));
      if (hands.length && loose.length) {
        const man = [...hands].sort(
          (a, b) => ROLE_ORDER.indexOf(b.role) - ROLE_ORDER.indexOf(a.role),
        )[0];
        putInCharge(state, man.id, loose[0].id);
      }
    }

    /*
       The earner comes before the gamble.
       
       This block sat below the jobs loop, which spends the dirty pile down
       to a laundering reserve every single day — so a front was bought only
       out of whatever a job had not already taken. Four a career, against a
       front catalogue that returns $147,628 of clean over the same four
       years and is the one asset on the board that both compounds and
       counts toward the estate the rank table reads.
       
       Nothing about the game changed here. The order did. A boss chasing a
       rank buys the shop before he stakes the truck, and until the probe
       did that, every reading about whether the estate line is reachable
       was a reading about a bot that gambled first.
    */
    // A front when one is affordable and four weeks of wages still covered.
    if (state.day % 7 === 0) {
      const reserve = weeklyWageBill(state) * 4;
      /*
         The best front the money will stretch to, not the first one on the
         list.

         `BUSINESSES` is written cheapest first, so taking the first affordable
         entry meant this bot bought the $12,000 laundromat every time for four
         years. Four fronts a career at $12,000 is a $48,000 estate, and the
         probe reported an estate of $55,038 against the $1,250,000 Boss asks
         for — which reads as a wall in the economy and is in fact a wall in
         the iteration order.

         A boss buying for rank buys the biggest thing he can cover, because
         the estate counts what a front would fetch and a bigger front washes
         more. Reversed here rather than reordered in the config, because the
         catalogue is written cheapest first on purpose and the panel reads it
         that way.
      */
      const catalogue = [...BUSINESSES].sort((a, b) => b.cost - a.cost);
      for (const t of territoryList(state)) {
        let bought = false;
        for (const def of catalogue) {
          const check = canAcquire(state, def.id, t.id);
          if (!check.ok) continue;
          if (check.cost + reserve > totalFunds(state)) continue;
          if (clean('fronts', () => acquireBusiness(state, def.id, t.id))) {
            bought = true;
            frontLife.bought++;
            if (firstFront.day === null) firstFront.day = state.day;
          }
          break;
        }
        if (bought) break;
      }
    }

    if (!isLayingLow(state) && state.org.heat < 70) {
      /*
         Finish the district you started, then start the next one.

         This read `operableTerritories(state)[0]` — the first entry, every
         day, for four years. So the bot poured every job into one
         neighbourhood: the median career took a single district to influence
         100 and never took a second past 50, which is the line Control needs
         and the reason 1 career in 36 ever met Capo's two-district
         requirement.

         It was read as a finding about territory being unreachable. Influence
         is not hard to build — where this bot worked at all, the mean was
         65.6. It only ever worked in one place.

         Round 7's human tester did the opposite unprompted and wrote that
         spreading to The Docks was what finally produced a purchasable front.
         The rule here is theirs: push the district you are closest to holding
         until you hold it, then go and stand somewhere new.
      */
      const options = operableTerritories(state);
      const strongest = [...options].sort(
        (a, b) => playerInfluence(b.territory) - playerInfluence(a.territory),
      );
      const unfinished = strongest.filter((o) => playerInfluence(o.territory) < 50);
      /*
         Most of the work where you are strong, some of it where you are not.

         Working only the best unfinished district was the first correction and
         it overshot: the moment the home district passed 50 it dropped out of
         "unfinished" and the bot abandoned its stronghold for the place it was
         weakest. Districts went from 1 career in 36 meeting Capo's line to 25,
         and everything else fell over — Crew Leader 35/36 to 24/36, respect
         from 29 to 8 — because a job run where you have no standing is a job
         you are likely to fail, and respect is paid on success.

         So: keep earning where you are established, and spend one week in
         three opening the next place up, until two districts are held. That is
         a boss expanding rather than a boss wandering.
      */
      /*
         Two, and the two was written here rather than in the game.

         `controlled < 2` stopped this bot expanding the moment it held what
         Capo asks for, and every reading taken since about how much ground a
         family can hold has been a reading of that constant. The probe duly
         reported "districts a career ever got to control: 2 of 12" and I read
         it as a wall in the territory system. Underboss wants three and Boss
         wants five, so the two ranks above Capo were being measured against a
         bot that had been told to stop below the first of them.

         Fifteenth time this session an instrument returned a believable number
         about itself. The rule is now what the next rank asks for, which is on
         the rank screen for any player to read, and it is counted with
         `controlledTerritories` — the same function the requirement itself
         counts, rather than a bare influence figure that ignores whether a
         rival is standing in the same district with more.
      */
      const wanted = RANKS[rankIndex(state.player.rank) + 1]?.requires.territories ?? 0;
      /*
         And how hard you push depends on how far short you are.

         One week in three was the right effort when the target was Capo's two
         districts and you were opening one more. Boss wants five, and a boss
         three short of five who spends two weeks in three consolidating what
         he already holds is not expanding, he is idling with a plan.
      */
      const short = wanted - controlledTerritories(state).length;
      const expanding =
        short > 0 && unfinished.length > 0 && state.day % 21 < (short === 1 ? 7 : short === 2 ? 14 : 21);
      const where =
        (expanding ? unfinished[0] : (strongest[0] ?? unfinished[0]))?.territory.id ?? null;
      if (where) {
        /*
           Leave the washing machine something to wash.

           The fronts run at 39% of capacity and 37% of paydays arrive with
           nothing to put through them, and the reason is this loop: the bot
           spends its dirty on the next job the moment it has it, so Friday
           finds the pile empty. That is a policy, not a law of the game, and
           until it is tested the claim "the clean share is too small" is a
           claim about a bot that never tried to make clean money.

           A player chasing a rank would hold back what the fronts can take.
           `WASH_RESERVE` is that, as a share of this week's capacity.
        */
        const capacity = launderOutlook(state).capacity;
        /*
           Held out of the *dirty* pile specifically, which the first version
           of this got wrong.

           It subtracted the reserve from `totalFunds` — clean plus dirty — and
           `spend` draws dirty first whatever the budget says, so the dirty
           pile was never protected and the experiment measured nothing. It
           reported that holding money back does not raise laundering, which
           was a statement about a reserve that did not exist.
        */
        const reserve = capacity * WASH_RESERVE;
        /*
           Never stake more than half of what the family has.

           The purse is the wall above Capo and it had never been tested as a
           policy. This bot spent down to the laundering reserve every single
           day, so its median weekly purse across a four-year career was under
           $2,000 against a $2,024 wage bill — and the top of the front
           catalogue costs $260,000. A family that never holds more than one
           Friday cannot buy the thing that compounds, so the estate stalls at
           six cheap shops and Underboss's $300,000 line is unreachable.

           Half is the crudest possible version of the discipline and it is
           deliberately crude: if holding anything back at all is what moves
           the estate, the finding is about the game and the number can be
           argued about afterwards.
        */
        const spendable = Math.min(
          Math.max(0, state.org.dirtyCash - reserve) + state.org.cash,
          totalFunds(state) * 0.5,
        );
        const options = availableOperations(state)
          .filter((o) => operationCost(state, o) <= spendable)
          .sort((a, b) => ev(b) - ev(a));
        for (const def of options) {
          if (idle(state).length < def.crewRequired) break;
          // The game refuses a second solo job now, so the bot does not have
          // to. Kept as a comment because the line that used to be here was a
          // workaround for a real defect nobody had noticed.
          if (operationCost(state, def) > spendable) continue;
          clean('jobs', () =>
            launchOperation(
              state,
              def.id,
              idle(state)
                .slice(0, def.crewRequired)
                .map((n) => n.id),
              where,
            ),
          );
        }
      }
    }

    /*
       Why there is still no legitimate side, asked once a week until there is.

       Ranked by how far down `canAcquire` the attempt got rather than by which
       check happens to be written first. A district held at the wrong control
       level and a purchase two hundred dollars short are both "no", and they
       are not the same finding — one is a territory problem and the other is a
       money problem. Taking the *closest* miss across every district and every
       business is the only reading that distinguishes them.
    */
    if (state.day % 7 === 0 && Object.keys(state.businesses).length === 0) {
      const reserveNow = weeklyWageBill(state) * 4;
      let best = 0; // 0 control, 1 slots, 2 sentiment, 3 money, 4 reserve
      for (const t of territoryList(state)) {
        for (const def of BUSINESSES) {
          const check = canAcquire(state, def.id, t.id);
          const reason = check.reason ?? '';
          const got = check.ok
            ? check.cost + reserveNow > totalFunds(state)
              ? 4
              : 5
            : reason.startsWith('Needs')
              ? 0
              : reason.startsWith('No room')
                ? 1
                : reason.startsWith('Nobody in')
                  ? 2
                  : 3;
          if (got > best) best = got;
        }
      }
      if (best === 0) firstFront.control++;
      else if (best === 1) firstFront.slots++;
      else if (best === 2) firstFront.sentiment++;
      else if (best === 3) firstFront.money++;
      else if (best === 4) firstFront.reserve++;
      // best === 5 means it buys one below on this very tick, so nothing is
      // blocking and the week should not be counted against anything.
    }

    /*
       Counsel, once there is a case and the retainer is affordable.

       Without this the probe cannot test the change it was built to test. The
       bot had never retained a lawyer, so `evidenceMultiplier` was 1 in every
       career, and pointing it at absorbed evidence would have produced a rerun
       identical to the baseline and an entirely confident wrong conclusion.
       Same fault as the bot that opened sit-downs and never closed one.

       Steps up only when four weeks of the bill still leaves the payroll
       covered, which is the same caution it applies to buying a front.
    */
    if (state.day % 7 === 0) {
      const open = Object.values(state.law.investigations).filter(
        (i) => i.status === 'open' || i.status === 'cold',
      ).length;
      /*
         The best representation that does not cost more than the crew does.

         The first version took `firm` whenever four weeks of it were covered,
         which is not caution, it is a boss with $17,000 in the bank signing up
         for $2,909 a week. Bankruptcies rose and the pricing looked wrong when
         the customer was the problem. A player who would not pay their lawyer
         more than their whole payroll is the sane heuristic, and it is the one
         the repricing was aimed at.
      */
      const want: LawyerLevel = open === 0 ? 'none' : open > 1 ? 'firm' : 'local';
      if (open > 0) {
        // Priced against the payroll, which is the comparison a player makes.
        const was = state.law.lawyer;
        state.law.lawyer = 'firm';
        legalQuoted += weeklyLegalCost(state);
        state.law.lawyer = was;
        wageAtQuote += weeklyWageBill(state);
        legalQuotes += 1;
      }
      if (want !== state.law.lawyer) {
        const was = state.law.lawyer;
        retainLawyer(state, want);
        const bill = weeklyLegalCost(state);
        const wages = weeklyWageBill(state);
        /*
           A boss with a case open pays more for a lawyer than he pays his
           crew.

           This capped the retainer at the payroll, which meant the bot spent
           13 weeks a career on counsel costing $163 while the firm that would
           actually have made a difference cost $3,733 against a payroll of
           $2,329. Mean open case strength sits at 86.9 out of 100 across a
           career and five careers in thirty-six end in a conviction; the
           counterplay was priced out by a rule of the bot's own.
        */
        const affordable =
          bill <= wages && bill * 4 + wages * 4 <= totalFunds(state);
        if (!affordable) retainLawyer(state, was);
        else if (want !== 'none') legalWeeks++;
      } else if (want !== 'none') {
        legalWeeks++;
      }
    }

    /*
       Bank the surplus, and sell it back when payroll is in danger.

       Without this the probe cannot see the mechanic at all — holdings start
       empty and nothing else in the loop puts anything in them, so the rerun
       would be the baseline with a new field on it. Fourth time this session
       that the bot had to learn the move before the change could be measured.

       The rule is the one a careful player would use: keep six weeks of the
       whole bill liquid, put the rest where it counts for rank, and take it
       back at a loss rather than miss a payday.
    */
    if (state.day % 7 === 0) {
      /*
         Invest before you bank, or the hoard eats the thing that fills it.

         The first rule kept six weeks of bills liquid and put everything else
         away, and it was measurably worse than not having the mechanic at all:
         peak clean worth fell from $28,711 to $22,755. Two reasons, and both
         are about the money being needed elsewhere. Clean spent on fronts
         collapsed from $3,385 a career to $507 — the deposit was eating the
         front budget, and fronts are the only source of new clean money there
         is. And it churned: $39,586 banked against $30,390 sold back, at a
         15% haircut each way.

         So the buffer has to cover the cheapest front as well as the bills. A
         boss banks what is left after he can still buy the next thing that
         earns.
      */
      const cheapestFront = Math.min(...BUSINESSES.map((b) => b.cost));
      const liquid = (weeklyWageBill(state) + weeklyLegalCost(state)) * 12 + cheapestFront;
      const spare = state.org.cash - liquid;
      if (spare >= HOLDINGS.minimum) {
        if (putAway(state, spare).ok) banked += spare;
      } else if (
        totalFunds(state) < weeklyWageBill(state) &&
        (state.org.holdings ?? 0) > 0 &&
        state.org.holdings! < weeklyWageBill(state) * 26
      ) {
        /*
           And a boss stops raiding the vault once there is a vault.

           This sold back whenever the purse dipped under one Friday, which for
           a bot that stakes its money on jobs every day is most weeks:
           $119,260 put away against $262,969 sold back, at a 15% haircut in
           each direction. The savings were a piggy bank being smashed weekly,
           and the estate — which is what the rank table reads — paid for it
           every time.

           Half a year of payroll is the point where the money stops being a
           buffer and starts being the thing the family is worth. Below it,
           raid; above it, miss the payday and take the grievance instead.
        */
        const need = Math.min(state.org.holdings ?? 0, weeklyWageBill(state) * 4);
        if (takeBack(state, need).ok) soldBack += need;
      }
    }

    /*
       Put people up, because a family made entirely of associates has no line
       of succession at all.

       Sixth time this session the probe could not perform the thing it was
       being asked about. The bot named heirs but had never once promoted
       anybody, and `eligibleHeirs` starts at soldier — so at the moment a
       removal landed, the room was all associates in 18 of the 19 careers
       that ended on one, and "the family had nobody credible" was a statement
       about a boss who never gave anyone a title.

       The rule is the one a careful player would use, and it reads nothing
       hidden: keep three or so people above associate, and pick by how long
       they have been around, which is on the crew screen for anyone to see.
    */
    if (state.day % 7 === 0) {
      const crew = crewList(state);
      const senior = crew.filter((n) => n.role !== 'associate' && !isOutOfReach(n));
      /*
         Three was a succession number being used as an organization number.

         It was written so the family would always have somebody credible to
         inherit, and three is right for that. But `eligibleStewards` needs a
         man above associate who is not already running a district, and a
         steward is the only income in this game that does not occupy a body
         you could otherwise send out on a job — `delegation.ts` says so in its
         own comment. So three seniors meant at most three stewards, which
         meant at most about three districts, and Boss wants five.

         Seventeenth time this session the probe could not perform the thing it
         was being measured on. The rule now covers the ground the family is
         reaching for, and keeps the two spare that succession wanted in the
         first place.
      */
      /*
         Three, and it stayed three after two attempts to raise it.

         The number was written for succession — always have somebody credible
         to inherit — and `eligibleStewards` needs an enforcer, one rung above
         the soldiers this rule produces, so the bot has never deliberately
         appointed a steward. Both repairs measured worse, and for the same
         reason: an enforcer costs $450 a week against a soldier's $300, and a
         family whose median weekly purse is under $2,000 cannot carry the
         hierarchy that holding five districts needs. Promoting to fill the
         steward rank took careers ending early from 16 in 36 to 24.

         So the promotion rule is left as it was and the finding is written
         down instead: the ladder above Capo is not gated on the player failing
         to promote anybody. It is gated on not being able to afford the people
         the next rank needs.
      */
      if (senior.length < 3) {
        const up = crew
          .filter((n) => n.role === 'associate' && canPromote(state, n).ok)
          .sort((a, b) => b.daysInCrew - a.daysInCrew)[0];
        if (up) promote(state, up.id);
      }
    }

    /*
       Keep somebody named, because a family that outlives its boss has to
       have one.

       `removePlayer` only ends the game when there is nobody to hand to, and
       35 careers out of 36 ended anyway — which measured this bot, not the
       game. It had never once named an heir in any run this file has ever
       produced, so every statement made here about how long an organization
       lasts was really a statement about a boss with no will.

       Fifth time this session that the probe could not perform the thing it
       was being asked about. The rule is the one a careful player would use:
       keep the most senior person who is actually available named, and rename
       when that person is gone.
    */
    if (state.day % 7 === 0) {
      if (!heirOf(state)) {
        const pick = eligibleHeirs(state).find((n) => n.status !== 'dead');
        if (pick && nameHeir(state, pick.id).ok) heirsNamed++;
      }
      succ.weeks++;
      if (heirOf(state)) succ.weeksWithAnHeir++;
      if (eligibleHeirs(state).some((n) => claimStrength(state, n) >= CLAIM.seriousAt)) {
        succ.weeksWithASeriousCandidate++;
      }
    }


    /*
       Which term is actually pushing loyalty down, sampled across the crew.

       Sixty-odd people walk out of a four-year career and nothing measured so
       far says why. `driftNpcs` adds up six terms every week; this recomputes
       the three that can be negative, on the same people, at the same moment,
       and adds up how much each one contributed over the whole career. The
       biggest number is the answer.

       Recomputed rather than instrumented in `npc.ts` on purpose — the
       simulation should not carry probe scaffolding, and a term that has to be
       re-derived here is a term whose formula gets read again by whoever next
       changes it.
    */
    if (state.day % DRIFT_INTERVAL_DAYS === 0) {
      for (const npc of crewList(state)) {
        if (npc.status !== 'active' && npc.status !== 'busy') continue;
        const expected = wageExpectation(state, npc);
        if (npc.wage < expected) {
          const shortfall = Math.min(1, Math.max(0, (expected - npc.wage) / expected));
          pushes.underpaid += DRIFT.underpaidLoyalty * shortfall;
        }
        pushes.grievance += npc.stats.grievance * DRIFT.grievanceLoyaltyFactor;
        if (state.org.heat > DRIFT.heatFearThreshold) {
          const pressure = (state.org.heat - DRIFT.heatFearThreshold) / 55;
          pushes.heatFear += DRIFT.heatFearLoyalty * pressure * (npc.stats.fear / 100);
        }
        /*
           What being feared costs, which this readout used to leave out.

           The four terms above mirror `driftNpcs` exactly, and that was the
           error: they are the four things that move loyalty *in that function*,
           not the four things that move loyalty. `tickFear` in player.ts
           charges every man `FEAR.loyaltyPerWeekAtMax` scaled by the level,
           every payday, and it lives in a different file — so the breakdown
           that exists to explain why crews leave was silent about its second
           largest cause.

           The two are not independent either. `tickFear` also raises
           `npc.stats.fear`, which is the multiplier on the heat term above, so
           the fear number partly drives the heat number.
        */
        pushes.fearRent += FEAR.loyaltyPerWeekAtMax * fearLevel(state);

        const daysInRole = state.day - npc.joinedDay;
        if (daysInRole > DRIFT.daysInRoleBeforeStagnation && npc.stats.ambition > 50) {
          pushes.stagnation += DRIFT.stagnationLoyaltyPerTick * (npc.stats.ambition / 100);
        }
        pushes.samples += 1;
      }
    }

    peakClean = Math.max(peakClean, state.org.cash);
    peakWorth = Math.max(peakWorth, cleanWorth(state));
    peakEstate = Math.max(peakEstate, estate(state).total);
    if (state.day % 7 === 0) {
      for (const t of territoryList(state)) {
        const inf = playerInfluence(t);
        infBest.set(t.id, Math.max(infBest.get(t.id) ?? 0, inf));
        if (inf >= 10) {
          infTotal += inf;
          infSamples += 1;
        }
      }
    }
    /*
       Did the family keep its rank when it lost its boss?

       The retention only fires when the man who was named is the man who takes
       it, so it has to be observed rather than assumed — a conditional nobody
       ever satisfies is the same as a conditional nobody wrote. Watched by
       comparing the rank either side of the day the line of succession grows.
    */
    const lineBefore = state.succession?.line?.length ?? 0;
    const rankBefore = state.player.rank;

    const cleanBefore = state.org.cash;
    const dirtyBefore = state.org.dirtyCash;
    advanceDay(state);
    if (state.org.dirtyCash > dirtyBefore) wash.dirtyIn += state.org.dirtyCash - dirtyBefore;
    if ((state.succession?.line?.length ?? 0) > lineBefore) {
      if (state.player.rank === rankBefore) rankKept++;
      else rankLost++;
    }

    /*
       Which side of the washing machine ran out this week.

       It has to be read from `lastLaunderReport` rather than from
       `launderOutlook`, and the difference is the whole reliability of this
       measurement. The outlook is a forecast taken from wherever the caller
       happens to be standing; jobs and trades resolve *earlier in the same
       day* than the fronts do, so a reading taken before `advanceDay` misses
       the morning's dirty money and would report a starved machine that was
       in fact full. The report is written by the tick itself, out of the
       numbers it actually used.
    */
    if (state.day % PAYDAY_INTERVAL === 0) {
      /*
         What was standing over the career this week.

         The war clause is re-evaluated here rather than read off a flag,
         because `chooseAction` only tests it for the one family whose turn it
         is, and the question here is how exposed the player was to *any* of
         them. `declareWarMinTargetStrength` is the interesting one: below it a
         rival will not mobilise at all, and `playerStrength` is crew count
         times quality, so growing across it is what turns an organization from
         something to lean on into something to move against.
      */
      const mine = playerStrength(state);
      danger.peakStrength = Math.max(danger.peakStrength, mine);
      if (mine >= AI.weights.declareWarMinTargetStrength) danger.weeksWorthAttacking++;
      let anyCould = false;
      let inWar = false;
      for (const id of RIVAL_IDS) {
        if (atWar(state, 'player', id)) inWar = true;
        const theirs = factionStrength(state, id);
        const grudge = bond(state, id, 'player').grudge;
        if (
          grudge >= BOND.warGrudge &&
          theirs > mine &&
          mine >= AI.weights.declareWarMinTargetStrength
        ) {
          anyCould = true;
        }
      }
      if (anyCould) danger.weeksAllWarClauses++;
      if (inWar) danger.weeksAtWar++;
      danger.heat += state.org.heat;
      const open = Object.values(state.law.investigations).filter((i) => i.status !== 'closed');
      const worst = open.reduce((n, i) => Math.max(n, i.strength), 0);
      danger.caseStrength += worst;
      danger.peakCase = Math.max(danger.peakCase, worst);
      danger.weeks++;
      if (state.day <= 365) {
        danger.caseYearOne += worst;
        danger.weeksYearOne++;
      }

      /*
         The denominator is the people the wage bill is actually paid for.

         The first version counted `status !== 'dead'`, which keeps everybody
         who ever walked out in the divisor forever and deflates both figures.
         `payable` is not exported, so this matches its shape: the men on the
         books this week.
      */
      wash.wageBill += weeklyWageBill(state);
      wash.crewWeeks += crewList(state).filter(
        (n) => n.status !== 'arrested' && n.status !== 'dead' && n.status !== 'defected',
      ).length;

      const all = Object.values(state.businesses);
      if (all.length === 0) frontLife.weeksNone++;
      else if (!all.some((b) => b.status === 'operating')) frontLife.weeksAllDead++;
      for (const b of all) {
        if (b.status !== 'operating') continue;
        const h = healthPressure(state, b);
        frontLife.kill.sentiment += h.sentiment;
        frontLife.kill.exposure += h.exposure;
        frontLife.kill.rivals += h.rivals;
        frontLife.kill.city += h.city;
        frontLife.kill.weeks += 1;
      }
      const r = state.lastLaunderReport;
      if (!r || r.capacity === undefined || r.washable === undefined) {
        wash.noFronts++;
      } else {
        wash.laundered += r.laundered;
        wash.cut += r.cut;
        wash.revenue += r.revenue;
        wash.capacity += r.capacity;
        if (r.washable <= 0) wash.nothingToWash++;
        else if (r.laundered >= r.capacity) wash.capacityBound++;
        else wash.dirtyBound++;
      }
    }
    // Gross clean income against the peak balance, to separate "never earned
    // it" from "earned it and spent it" — and the same day's outgoings, which
    // are everything the week takes without being asked: wages once dirty is
    // gone, loan payments, tribute, and whatever the city does to you.
    if (state.org.cash > cleanBefore) wash.cleanIn += state.org.cash - cleanBefore;
    else wash.cleanOut.upkeep += cleanBefore - state.org.cash;
    if (!reachedOn.has(state.player.rank)) reachedOn.set(state.player.rank, state.day);
    if (state.gameOver) break;
  }

  /*
     Which requirement was furthest away when the music stopped.

     Stated as a share of what was needed rather than as a raw gap, so that a
     respect shortfall and a two-and-a-half-million-dollar shortfall can be
     compared at all. The answer to "why does nobody get past here" is a
     requirement name, and this is how the probe produces one instead of
     leaving it to be guessed.
  */
  const next = RANKS[rankIndex(state.player.rank) + 1];
  let blockedBy: string | null = null;
  if (next) {
    const held = crewList(state).filter((n) => n.status !== 'dead').length;
    const districts = territoryList(state).filter((t) => playerInfluence(t) >= 25).length;
    const gaps: [string, number][] = [
      ['respect', state.org.respect / Math.max(1, next.requires.respect)],
      ['crew', held / Math.max(1, next.requires.crew)],
      ['clean money', state.org.cash / Math.max(1, next.requires.cleanCash)],
      ['operations', state.player.opsCompleted / Math.max(1, next.requires.opsCompleted)],
      ['districts', districts / Math.max(1, next.requires.territories)],
    ];
    /*
       A NaN here once sorted to the front and was reported as a finding.

       `state.player.respect` does not exist — respect lives on `state.org` —
       so the share was `undefined / 140`, and every career duly reported
       respect as its furthest requirement. The typechecker caught it; the
       probe had been perfectly happy. Filtering non-finite shares means a
       future mistake of the same kind produces no answer instead of a
       confident wrong one.
    */
    const usable = gaps.filter(([, share]) => Number.isFinite(share));
    blockedBy = usable.length ? usable.sort((a, b) => a[1] - b[1])[0][0] : null;
  }

  const everybody = Object.values(state.npcs);
  const lost = {
    dead: everybody.filter((n) => n.status === 'dead').length,
    defected: everybody.filter((n) => n.status === 'defected').length,
    inside: everybody.filter((n) => n.status === 'arrested').length,
  };
  const benchMarks = everybody.reduce(
    (n, npc) => n + npc.memories.filter((m) => m.kind === 'left_on_the_bench').length,
    0,
  );

  return {
    days: state.day,
    gameOver: !!state.gameOver,
    endedBy: state.gameOver?.reason.slice(0, 70) ?? null,
    weeksSinceHandover: (() => {
      const last = state.succession?.line?.[state.succession.line.length - 1];
      if (!last || !state.gameOver) return null;
      return Math.round((state.gameOver.day - last.toDay) / 7);
    })(),
    hires,
    sitdowns,
    hiring,
    lost,
    benchMarks,
    pushes,
    wash,
    danger: {
      ...danger,
      ledger: state.law.ledger ?? {
        absorbed: 0,
        work: 0,
        visibility: 0,
        decayed: 0,
        caseWeeks: 0,
        coldWeeks: 0,
        closedByDecay: 0,
      },
    },
    firstFront,
    frontLife: {
      ...frontLife,
      shuttered: Object.values(state.businesses).filter((b) => b.status === 'shuttered').length,
    },
    reachedOn,
    casesOpened: state.law.casesOpened,
    banked,
    soldBack,
    heirsNamed,
    rankKept,
    rankLost,
    succession: succ,
    handovers: state.succession?.line?.length ?? 0,
    peakWorth,
    finalEstate: estate(state).total,
    peakEstate,
    bestCrew: state.org.record?.crew ?? 0,
    bestEstate: state.org.record?.estate ?? 0,
    bestOps: state.org.record?.ops ?? 0,
    bestRespect: state.org.record?.respect ?? 0,
    bestDistricts: state.org.record?.districts ?? 0,
    influence: {
      peak: Math.max(0, ...infBest.values()),
      everPresence: everAt(10),
      everFoothold: everAt(25),
      everControl: everAt(50),
      meanWhereWorking: infSamples ? infTotal / infSamples : 0,
      samples: infSamples,
    },
    legalWeeks,
    legalQuoted,
    legalQuotes,
    wageAtQuote,
    finalRank: state.player.rank,
    finalCrew: crewList(state).filter((n) => n.status !== 'dead').length,
    peakClean,
    districtsHeld: territoryList(state).filter((t) => playerInfluence(t) >= 25).length,
    fronts: Object.keys(state.businesses).length,
    blockedBy,
  };
}

/** Four years. Long enough that "it just takes a while" stops being an answer. */
const DAYS = 1460;
/*
   Thirty-six, not twelve.

   Twelve was enough while the readings were drift terms averaged over ten
   thousand crew-weeks. It is not enough for anything counted once per career —
   which rank was reached, whether the career ended early, what ended it. A
   one-line change to how a front recovers moved early endings from 2/12 to
   8/12, and at twelve seeds there was no way to tell that from the world
   simply diverging. Three times the sample costs about six seconds.
*/
const RUNS = Array.from({ length: 36 }, (_, i) => climb(700 + i, DAYS));

describe('the ladder', () => {
  it('played long careers', () => {
    // The instrument first, as always. A probe whose careers all end in month
    // two would report a very confident and completely empty answer about the
    // top of a ladder.
    expect(RUNS.length).toBe(36);
    expect(
      RUNS.filter((r) => r.days > 365).length,
      'most careers did not survive a year, so nothing below is about the ladder',
    ).toBeGreaterThanOrEqual(RUNS.length * 0.66);
  });

  it('says how far up a career actually gets in four years', () => {
    const counts = RANKS.map((r) => ({
      rank: r.name,
      reached: RUNS.filter((run) => run.reachedOn.has(r.id)).length,
      day: RUNS.filter((run) => run.reachedOn.has(r.id)).map((run) => run.reachedOn.get(r.id)!),
    }));

    const blockers = new Map<string, number>();
    for (const run of RUNS) {
      if (run.blockedBy) blockers.set(run.blockedBy, (blockers.get(run.blockedBy) ?? 0) + 1);
    }

    // eslint-disable-next-line no-console
    console.log(
      `ladder: over ${DAYS} days (${Math.round(DAYS / 365)} years), ${RUNS.length} careers\n` +
        counts
          .map(
            (c) =>
              `         ${c.rank}: ${c.reached}/${RUNS.length}` +
              (c.reached ? ` (median day ${median(c.day)})` : ''),
          )
          .join('\n') +
        `\n         furthest requirement at the end: ` +
        [...blockers.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${k} ${n}`)
          .join(', ') +
        `\n         hires ${median(RUNS.map((r) => r.hires))} per career, ` +
        `${median(RUNS.map((r) => r.sitdowns))} sit-downs held; lost ` +
        `${median(RUNS.map((r) => r.lost.dead))} dead, ` +
        `${median(RUNS.map((r) => r.lost.defected))} walked, ` +
        `${median(RUNS.map((r) => r.lost.inside))} inside at the end, ` +
        `${median(RUNS.map((r) => r.benchMarks))} bench marks` +
        `\n         weeks below the cap: nobody offered ` +
        `${RUNS.reduce((n, r) => n + r.hiring.nobodyOffered, 0)}, game refused ` +
        `${RUNS.reduce((n, r) => n + r.hiring.gameRefused, 0)}, bot declined ` +
        `${RUNS.reduce((n, r) => n + r.hiring.botDeclined, 0)}, could and did ` +
        `${RUNS.reduce((n, r) => n + r.hiring.couldAndDid, 0)}; at the cap ` +
        `${RUNS.reduce((n, r) => n + r.hiring.atTheCap, 0)}` +
        `\n         what pushes loyalty down, per crew-week: ` +
        (() => {
          const t = RUNS.reduce(
            (a, r) => ({
              underpaid: a.underpaid + r.pushes.underpaid,
              grievance: a.grievance + r.pushes.grievance,
              heatFear: a.heatFear + r.pushes.heatFear,
              fearRent: a.fearRent + r.pushes.fearRent,
              stagnation: a.stagnation + r.pushes.stagnation,
              samples: a.samples + r.pushes.samples,
            }),
            {
              underpaid: 0,
              grievance: 0,
              heatFear: 0,
              fearRent: 0,
              stagnation: 0,
              samples: 0,
            },
          );
          const per = (v: number) => (t.samples ? (v / t.samples).toFixed(2) : '0');
          const total = t.underpaid + t.grievance + t.heatFear + t.fearRent + t.stagnation;
          return (
            `underpaid ${per(t.underpaid)}, grievance ${per(t.grievance)}, ` +
            `heat ${per(t.heatFear)}, being feared ${per(t.fearRent)}, ` +
            `stagnation ${per(t.stagnation)} — total ${per(total)} ` +
            `(over ${t.samples} crew-weeks)`
          );
        })() +
        `\n         the washing machine: ` +
        (() => {
          const t = RUNS.reduce(
            (a, r) => ({
              capacityBound: a.capacityBound + r.wash.capacityBound,
              dirtyBound: a.dirtyBound + r.wash.dirtyBound,
              nothingToWash: a.nothingToWash + r.wash.nothingToWash,
              noFronts: a.noFronts + r.wash.noFronts,
              laundered: a.laundered + r.wash.laundered,
              cut: a.cut + r.wash.cut,
              revenue: a.revenue + r.wash.revenue,
              capacity: a.capacity + r.wash.capacity,
              cleanIn: a.cleanIn + r.wash.cleanIn,
              outHires: a.outHires + r.wash.cleanOut.hires,
              outJobs: a.outJobs + r.wash.cleanOut.jobs,
              outFronts: a.outFronts + r.wash.cleanOut.fronts,
              outEvents: a.outEvents + r.wash.cleanOut.events,
              outUpkeep: a.outUpkeep + r.wash.cleanOut.upkeep,
            }),
            {
              capacityBound: 0,
              dirtyBound: 0,
              nothingToWash: 0,
              noFronts: 0,
              laundered: 0,
              cut: 0,
              revenue: 0,
              capacity: 0,
              cleanIn: 0,
              outHires: 0,
              outJobs: 0,
              outFronts: 0,
              outEvents: 0,
              outUpkeep: 0,
            },
          );
          const weeks = t.capacityBound + t.dirtyBound + t.nothingToWash + t.noFronts;
          const pc = (n: number) => `${Math.round((n / Math.max(1, weeks)) * 100)}%`;
          const money = (n: number) => `$${Math.round(n / RUNS.length).toLocaleString('en-US')}`;
          return (
            `no fronts ${pc(t.noFronts)}, nothing to wash ${pc(t.nothingToWash)}, ` +
            `dirty ran out ${pc(t.dirtyBound)}, capacity ran out ${pc(t.capacityBound)} ` +
            `(${weeks} paydays)` +
            `\n         per career: laundered ${money(t.laundered)} of ` +
            `${money(t.capacity)} offered (` +
            `${Math.round((t.laundered / Math.max(1, t.capacity)) * 100)}% used), ` +
            `${money(t.cut)} lost in the wash, fronts earned ${money(t.revenue)} clean` +
            `\n         clean money in over the career ${money(t.cleanIn)} against a peak ` +
            `balance of $${median(RUNS.map((r) => r.peakClean)).toLocaleString('en-US')} ` +
            `and a Capo requirement of $${RANK_BY_ID.capo.requires.cleanCash.toLocaleString('en-US')}` +
            (() => {
              /*
                 Which of Capo's five requirements a family ever actually met.

                 Rank reads the high-water record, so a requirement is met
                 the moment it is *ever* satisfied. Counting how many careers
                 cleared each line separately says which one is the wall,
                 rather than leaving it to be inferred from a single
                 furthest-requirement label that only names the worst.
              */
              const need = RANK_BY_ID.capo.requires;
              const met = (f: (r: Climb) => number, want: number) =>
                `${RUNS.filter((r) => f(r) >= want).length}/${RUNS.length}`;
              return (
                `\n         careers that ever met each Capo line: ` +
                `crew ${met((r) => r.bestCrew, need.crew)}, ` +
                `worth ${met((r) => r.bestEstate, need.cleanCash)}, ` +
                `respect ${met((r) => r.bestRespect, need.respect)}, ` +
                `operations ${met((r) => r.bestOps, need.opsCompleted)}, ` +
                `districts ${met((r) => r.bestDistricts, need.territories)}` +
                `\n         influence, which Control needs 50 of: highest any district ` +
                `reached ${Math.round(median(RUNS.map((r) => r.influence.peak)))} (median career), ` +
                `best of all ${Math.round(Math.max(...RUNS.map((r) => r.influence.peak)))}` +
                `\n         districts a career ever got to each band: presence ` +
                `${median(RUNS.map((r) => r.influence.everPresence))}, foothold ` +
                `${median(RUNS.map((r) => r.influence.everFoothold))}, control ` +
                `${median(RUNS.map((r) => r.influence.everControl))} (of 12)` +
                `\n         mean influence where the family was working at all: ` +
                `${(RUNS.reduce((n, r) => n + r.influence.meanWhereWorking, 0) / RUNS.length).toFixed(1)}` +
                `\n         best crew ever held: median ${median(RUNS.map((r) => r.bestCrew))}, ` +
                `highest ${Math.max(...RUNS.map((r) => r.bestCrew))} (Capo wants ${need.crew})`
              );
            })() +
            `\n         the estate: $${median(RUNS.map((r) => r.finalEstate)).toLocaleString('en-US')} median at the end, best ever $${Math.max(...RUNS.map((r) => r.peakEstate)).toLocaleString('en-US')}` +
            `\n         put away ${money(RUNS.reduce((n, r) => n + r.banked, 0))} a career, ` +
            `sold back ${money(RUNS.reduce((n, r) => n + r.soldBack, 0))}; peak clean worth ` +
            `$${median(RUNS.map((r) => r.peakWorth)).toLocaleString('en-US')}` +
            (() => {
              const t = RUNS.reduce(
                (a, r) => ({
                  dirtyIn: a.dirtyIn + r.wash.dirtyIn,
                  cleanIn: a.cleanIn + r.wash.cleanIn,
                  wageBill: a.wageBill + r.wash.wageBill,
                  crewWeeks: a.crewWeeks + r.wash.crewWeeks,
                  /*
                     Laundered money is not new money.

                     It lands in `dirtyIn` when the job pays and again in
                     `cleanIn` when the front washes it, so a straight sum of
                     the two counts most of the economy twice. The first
                     reading said a man earns $856 a week against a $194 wage,
                     and a good part of that was one dollar going round a loop.
                  */
                  washedIn: a.washedIn + (r.wash.laundered - r.wash.cut),
                }),
                { dirtyIn: 0, cleanIn: 0, wageBill: 0, crewWeeks: 0, washedIn: 0 },
              );
              const perMan = (v: number) => `$${Math.round(v / Math.max(1, t.crewWeeks))}`;
              return (
                `\n         does a man pay for himself: earned ` +
                `${perMan(t.dirtyIn + t.cleanIn - t.washedIn)} per crew-week against ` +
                `a wage of ${perMan(t.wageBill)} — dirty ${perMan(t.dirtyIn)}, new ` +
                `clean ${perMan(t.cleanIn - t.washedIn)}, plus ${perMan(t.washedIn)} ` +
                `that is dirty coming back round (${t.crewWeeks} crew-weeks)`
              );
            })() +
            `\n         where the clean went: upkeep ${money(t.outUpkeep)}, jobs ` +
            `${money(t.outJobs)}, hires ${money(t.outHires)}, fronts ` +
            `${money(t.outFronts)}, events ${money(t.outEvents)}`
          );
        })() +
        `\n         the first front: ` +
        (() => {
          const t = RUNS.reduce(
            (a, r) => ({
              control: a.control + r.firstFront.control,
              slots: a.slots + r.firstFront.slots,
              sentiment: a.sentiment + r.firstFront.sentiment,
              money: a.money + r.firstFront.money,
              reserve: a.reserve + r.firstFront.reserve,
            }),
            { control: 0, slots: 0, sentiment: 0, money: 0, reserve: 0 },
          );
          const weeks = t.control + t.slots + t.sentiment + t.money + t.reserve;
          const pc = (n: number) => `${Math.round((n / Math.max(1, weeks)) * 100)}%`;
          const arrived = RUNS.map((r) => r.firstFront.day).filter((d): d is number => d !== null);
          return (
            `bought on day ${arrived.length ? median(arrived) : 'never'} in ` +
            `${arrived.length}/${RUNS.length} careers; ` +
            (() => {
              const f = RUNS.reduce(
                (a, r) => ({
                  bought: a.bought + r.frontLife.bought,
                  shuttered: a.shuttered + r.frontLife.shuttered,
                  weeksNone: a.weeksNone + r.frontLife.weeksNone,
                  weeksAllDead: a.weeksAllDead + r.frontLife.weeksAllDead,
                  sentiment: a.sentiment + r.frontLife.kill.sentiment,
                  exposure: a.exposure + r.frontLife.kill.exposure,
                  rivals: a.rivals + r.frontLife.kill.rivals,
                  city: a.city + r.frontLife.kill.city,
                  frontWeeks: a.frontWeeks + r.frontLife.kill.weeks,
                }),
                {
                  bought: 0,
                  shuttered: 0,
                  weeksNone: 0,
                  weeksAllDead: 0,
                  sentiment: 0,
                  exposure: 0,
                  rivals: 0,
                  city: 0,
                  frontWeeks: 0,
                },
              );
              const paydays = RUNS.reduce(
                (n, r) =>
                  n +
                  r.wash.capacityBound +
                  r.wash.dirtyBound +
                  r.wash.nothingToWash +
                  r.wash.noFronts,
                0,
              );
              const share = (n: number) => `${Math.round((n / Math.max(1, paydays)) * 100)}%`;
              return (
                `${Math.round(f.bought / RUNS.length)} bought per career and ` +
                `${Math.round(f.shuttered / RUNS.length)} gone under; weeks with none ` +
                `${share(f.weeksNone)} never owned one, ${share(f.weeksAllDead)} buried them all` +
                (() => {
                  const per = (v: number) => (v / Math.max(1, f.frontWeeks)).toFixed(2);
                  return (
                    `\n         what wears a front down, per front-week: ` +
                    `hostile neighbourhood ${per(f.sentiment)}, being leaned on as a ` +
                    `laundry ${per(f.exposure)}, rivals ${per(f.rivals)}, city mood ` +
                    `${per(f.city)} against +${HEALTH.recoverPerWeek} recovery ` +
                    `(${f.frontWeeks} front-weeks)`
                  );
                })()
              );
            })() +

            `\n         weeks with nothing, by what was closest: control ${pc(t.control)}, ` +
            `slots ${pc(t.slots)}, sentiment ${pc(t.sentiment)}, money ${pc(t.money)}, ` +
            `bot held back a reserve ${pc(t.reserve)} (${weeks} weeks)`
          );
        })() +
        `\n         what stands over a career: ` +
        (() => {
          const d = RUNS.reduce(
            (a, r) => ({
              worth: a.worth + r.danger.weeksWorthAttacking,
              clauses: a.clauses + r.danger.weeksAllWarClauses,
              atWar: a.atWar + r.danger.weeksAtWar,
              heat: a.heat + r.danger.heat,
              caseStrength: a.caseStrength + r.danger.caseStrength,
              weeks: a.weeks + r.danger.weeks,
              caseYearOne: a.caseYearOne + r.danger.caseYearOne,
              weeksYearOne: a.weeksYearOne + r.danger.weeksYearOne,
            }),
            {
              worth: 0,
              clauses: 0,
              atWar: 0,
              heat: 0,
              caseStrength: 0,
              weeks: 0,
              caseYearOne: 0,
              weeksYearOne: 0,
            },
          );
          const pc = (n: number) => `${Math.round((n / Math.max(1, d.weeks)) * 100)}%`;
          return (
            `big enough to be worth attacking ${pc(d.worth)} of weeks, ` +
            `a rival able to declare ${pc(d.clauses)}, at war ${pc(d.atWar)}` +
            `\n         peak strength ${median(RUNS.map((r) => r.danger.peakStrength)).toFixed(1)} ` +
            `against a threshold of ${AI.weights.declareWarMinTargetStrength}; ` +
            `mean heat ${(d.heat / Math.max(1, d.weeks)).toFixed(1)}, mean open case ` +
            `${(d.caseStrength / Math.max(1, d.weeks)).toFixed(1)}, peak case ` +
            `${median(RUNS.map((r) => r.danger.peakCase)).toFixed(1)}` +
            `, of which year one ` +
            `${(d.caseYearOne / Math.max(1, d.weeksYearOne)).toFixed(1)}` +
            (() => {
              const L = RUNS.reduce(
                (a, r) => ({
                  absorbed: a.absorbed + r.danger.ledger.absorbed,
                  work: a.work + r.danger.ledger.work,
                  visibility: a.visibility + r.danger.ledger.visibility,
                  decayed: a.decayed + r.danger.ledger.decayed,
                  caseWeeks: a.caseWeeks + r.danger.ledger.caseWeeks,
                  coldWeeks: a.coldWeeks + r.danger.ledger.coldWeeks,
                  closedByDecay: a.closedByDecay + r.danger.ledger.closedByDecay,
                }),
                {
                  absorbed: 0,
                  work: 0,
                  visibility: 0,
                  decayed: 0,
                  caseWeeks: 0,
                  coldWeeks: 0,
                  closedByDecay: 0,
                },
              );
              const per = (v: number) => (v / Math.max(1, L.caseWeeks)).toFixed(2);
              return (
                `\n         what moves a case, per case-week: evidence +${per(L.absorbed)}, ` +
                `their own work +${per(L.work)}, being visibly loud +${per(L.visibility)}, ` +
                `decay -${per(L.decayed)}` +
                `\n         ${L.caseWeeks} case-weeks, of which cold ` +
                `${Math.round((L.coldWeeks / Math.max(1, L.caseWeeks)) * 100)}%; ` +
                `${L.closedByDecay} files put away under ${CASE_CLOSED_BELOW} against ` +
                `${RUNS.reduce((n, r) => n + r.casesOpened, 0)} opened; ` +
                `${median(RUNS.map((r) => r.legalWeeks))} weeks a career on retainer` +
                (() => {
                  const q = RUNS.reduce((n, r) => n + r.legalQuotes, 0);
                  const bill = RUNS.reduce((n, r) => n + r.legalQuoted, 0) / Math.max(1, q);
                  const wages = RUNS.reduce((n, r) => n + r.wageAtQuote, 0) / Math.max(1, q);
                  return (
                    ` of ${Math.round(q / RUNS.length)} with a case open; a serious firm ` +
                    `would cost $${Math.round(bill).toLocaleString('en-US')} a week against a ` +
                    `payroll of $${Math.round(wages).toLocaleString('en-US')}`
                  );
                })()
              );
            })()
          );
        })() +
        `\n         careers: ${RUNS.filter((r) => r.gameOver).length}/${RUNS.length} ended early, ` +
        `median length ${median(RUNS.map((r) => r.days))} days, ` +
        (() => {
          const t = RUNS.reduce(
            (a, r) => ({
              heir: a.heir + r.succession.weeksWithAnHeir,
              serious: a.serious + r.succession.weeksWithASeriousCandidate,
              weeks: a.weeks + r.succession.weeks,
            }),
            { heir: 0, serious: 0, weeks: 0 },
          );
          const pc = (n: number) => `${Math.round((n / Math.max(1, t.weeks)) * 100)}%`;
          return (
            `\n         a successor was in place ${pc(t.heir)} of weeks, and somebody the ` +
            `room would actually follow ${pc(t.serious)}` +
            `\n         `
          );
        })() +
        `${RUNS.reduce((n, r) => n + r.handovers, 0)} handovers across ` +
        `${RUNS.filter((r) => r.handovers > 0).length}/${RUNS.length} organizations, ` +
        `${RUNS.reduce((n, r) => n + r.heirsNamed, 0)} heirs named in all; rank held ` +
        `${RUNS.reduce((n, r) => n + r.rankKept, 0)} handovers, lost ` +
        `${RUNS.reduce((n, r) => n + r.rankLost, 0)}` +
        (() => {
          const by = new Map<string, number>();
          for (const r of RUNS) {
            if (!r.endedBy) continue;
            const cause = /got to them/.test(r.endedBy)
              ? 'killed by a rival'
              : /make it stick|jury/.test(r.endedBy)
                ? 'convicted'
                : /Nobody left|pay anyone/.test(r.endedBy)
                  ? 'broke and alone'
                  : r.endedBy;
            by.set(cause, (by.get(cause) ?? 0) + 1);
          }
          return by.size
            ? ` — ${[...by.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => `${k} ${n}`)
                .join(', ')}`
            : '';
        })() +
        (() => {
          const ended = RUNS.filter((r) => r.endedBy);
          const after = ended.filter((r) => r.weeksSinceHandover !== null);
          return (
            `
         of ${ended.length} endings, ${after.length} came after a handover, ` +
            `${median(after.map((r) => r.weeksSinceHandover!))} weeks median after one`
          );
        })() +
        `\n         median final crew ${median(RUNS.map((r) => r.finalCrew))}, ` +
        `districts ${median(RUNS.map((r) => r.districtsHeld))}, ` +
        `fronts ${median(RUNS.map((r) => r.fronts))}, ` +
        `peak clean ${median(RUNS.map((r) => r.peakClean))}`,
    );

    /*
       The only assertion, and it is on the shape rather than the height.

       A ladder can be slow without being broken. What it cannot be is a ladder
       where every career in four years piles up against the same rung — that
       is a requirement the game does not afford a way to meet, and no amount
       of patience fixes it. This asserts only that careers get past the first
       rung, so that the printed table above is what carries the finding.

       Stated as a share rather than a count, because the sample changed.

       This read `RUNS.length - 2` when there were twelve runs — "at most two
       of twelve pile up at the bottom", which is 83%. Left as an absolute it
       would have meant 34 of 36, silently making the rule three times stricter
       for no reason anybody decided. The share is the thing that was meant.
    */
    expect(
      RUNS.filter((r) => rankIndex(r.finalRank) >= 1).length,
      'too many careers cannot even leave the bottom rank in four years',
    ).toBeGreaterThanOrEqual(Math.floor(RUNS.length * (10 / 12)));
  });
});

/*
   The same ladder, measured over the window a person actually plays.

   `DAYS` above is 1460 because the question there was whether the top of the
   ladder can be climbed at all, and six months could not answer it. That
   probe reports Capo at a median of day 380, Underboss 435, Boss 582.

   Every blind round this project has ever run is one year. Round 13 stopped
   at day 300. Round 12's informed run — a tester who already knew the game —
   reached Capo on day 324. So the four-year answer describes an observer who
   does not exist, which is exactly what HANDOFF §5 was written to stop.

   The rank table in `config/economy.ts` was built by taking the distribution
   of what careers reach and setting each requirement between the median and
   the 75th percentile. That method is sound. Its window was four years.

   This block runs the identical bot against 300 days and asks the same
   question of the same five columns, so the table can be re-sized by the
   author's own method against the right horizon.
*/
const HUMAN_DAYS = 300;
const RUNS_300 = Array.from({ length: 36 }, (_, i) => climb(700 + i, HUMAN_DAYS));

/** Nearest-rank percentile. Small samples, so no interpolation to argue about. */
function pct(xs: number[], p: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

describe('the ladder, over the 300 days a person plays', () => {
  it('says what a career has reached by day 300', () => {
    const col = (pick: (r: (typeof RUNS_300)[number]) => number) => {
      const xs = RUNS_300.map(pick);
      return `${Math.round(pct(xs, 0.4))} / ${Math.round(median(xs))} / ${Math.round(pct(xs, 0.75))}`;
    };

    // eslint-disable-next-line no-console
    console.log(
      `pacing: ${RUNS_300.length} careers, ${HUMAN_DAYS} days each\n` +
        RANKS.map((r) => {
          const got = RUNS_300.filter((run) => run.reachedOn.has(r.id));
          return (
            `         ${r.name}: ${got.length}/${RUNS_300.length}` +
            (got.length ? ` (median day ${median(got.map((g) => g.reachedOn.get(r.id)!))})` : '')
          );
        }).join('\n') +
        `\n         what a career has at day 300, as 40th / median / 75th:` +
        `\n           respect     ${col((r) => r.bestRespect)}` +
        `\n           crew        ${col((r) => r.bestCrew)}` +
        `
           estate      ${col((r) => r.bestEstate)}` +
        `\n           operations  ${col((r) => r.bestOps)}` +
        `\n           districts   ${col((r) => r.bestDistricts)}` +
        `
         furthest requirement at the end: ` +
        [
          ...RUNS_300.reduce((m, r) => {
            if (r.blockedBy) m.set(r.blockedBy, (m.get(r.blockedBy) ?? 0) + 1);
            return m;
          }, new Map<string, number>()),
        ]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${k} ${n}`)
          .join(', ') +
        `
         careers that ended before day ${HUMAN_DAYS}: ` +
        `${RUNS_300.filter((r) => r.days < HUMAN_DAYS).length}/${RUNS_300.length}` +
        /*
           The population splits in two, and this says on what.

           Front income is paid into holdings (business.ts:579) where it
           compounds, so a career either gets fronts running and the estate
           takes off, or it does not and the estate sits flat for the whole
           300 days. There is almost nothing in between: sorted by estate, the
           bottom twenty-five careers hold 0 to 2 fronts and the top eleven
           hold 2 to 13.

           This is printed rather than asserted because the split itself is not
           a fault — an economy where building something pays more than not
           building it is the design. What it locates is where the money rung
           is really decided, which is the front gate rather than the ladder.
        */
        (() => {
          const rows = RUNS_300.map((r) => ({ est: r.bestEstate, fronts: r.fronts }));
          const side = (rs: typeof rows) =>
            `${rs.length} careers, median ${median(rs.map((r) => r.fronts))} fronts`;
          return (
            `
         compounded (estate >= $100,000): ${side(rows.filter((r) => r.est >= 100_000))}` +
            `
         flat (under $100,000): ${side(rows.filter((r) => r.est < 100_000))}`
          );
        })(),
    );

    expect(RUNS_300.length).toBe(36);
  });

  /*
     The pre-committed condition, written before the table was touched.

     Shape rather than generosity. Each rung is meant to be harder than the one
     below it, and Boss is meant to stay what `config/economy.ts` calls it — a
     filter that the better half of families pass, not a participation award.
     So the counts fall away as the ladder rises, and the last rung is guarded
     from below as well as above.

     These are design targets for the rank table, not thresholds on an
     instrument. DIRECTOR §5 forbids moving the second to make a probe pass.
     Nothing here may be moved to make `RANKS` pass either: if the table cannot
     meet these inside 300 days, that is the finding.
  */
  it('gives a 300-day career more than three rungs', () => {
    const reached = (id: string) => RUNS_300.filter((r) => r.reachedOn.has(id));
    const medianDay = (id: string) => median(reached(id).map((r) => r.reachedOn.get(id)!));

    expect(reached('capo').length, 'most careers should make Capo inside 300 days').toBeGreaterThanOrEqual(24);
    expect(medianDay('capo'), 'Capo arrives too late to be a mid-game rung').toBeLessThanOrEqual(150);

    expect(reached('underboss').length, 'Underboss is out of reach in a human career').toBeGreaterThanOrEqual(15);
    expect(medianDay('underboss'), 'Underboss arrives too late').toBeLessThanOrEqual(220);

    expect(reached('boss').length, 'Boss is out of reach in a human career').toBeGreaterThanOrEqual(8);
    expect(medianDay('boss'), 'Boss arrives too late').toBeLessThanOrEqual(285);
  });

  /*
     The other side of the same condition. A ladder re-sized until everything
     is reachable has not been fixed, it has been flattened, and Crime Lord is
     the rung that would show it first. It stays a thing you play a long career
     for.
  */
  it('keeps Crime Lord out of reach of a single 300-day career', () => {
    expect(
      RUNS_300.filter((r) => r.reachedOn.has('crime_lord')).length,
      'Crime Lord has stopped being a stretch',
    ).toBeLessThanOrEqual(3);
  });
});
