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
import {
  atWar,
  bond,
  canDo,
  doDiplomacy,
  factionStrength,
  playerStrength,
  relationship,
  relationshipLabelFor,
} from '../diplomacy';
import { CASE_CLOSED_BELOW, type LawyerLevel } from '../../config/lawEnforcement';
import { retainLawyer, weeklyLegalCost } from '../investigation';
import { AI, RIVAL_IDS } from '../../config/factions';
import {
  BOND,
  DIPLOMACY,
  DIPLOMATIC_ACTIONS,
  DIPLOMATIC_ACTION_BY_ID,
} from '../../config/diplomacy';
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
import { borrow, canBorrow } from '../market';
import { readWhispers } from '../whispers';
import { isGenerated } from '../eventgen';
import { civicRead, spendFavour } from '../civic';
import { careerShape, legitimacy } from '../legacy';
import { CIVIC, CIVIC_FIGURES } from '../../config/civic';
import { SENTIMENT_HOSTILE_BELOW } from '../../config/territories';
import { activeCases, worstStage } from '../investigation';
import { stageIndex } from '../../config/lawEnforcement';
import { ownedBusinesses } from '../business';
import type { PressureId } from '../../config/pressure';

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
  /**
   * Pull, at the end. Named `pull` because `influence` on this record is
   * already the per-district faction share, which is a different quantity
   * entirely.
   *
   * Here because four blind rounds reported not understanding this attribute
   * and no instrument in the project had ever looked at it. The bot retains
   * counsel, which is one of the two routes; it never approaches a family,
   * which is the other. So this is a floor on what a career reaches, not a
   * measure of what is reachable.
   */
  pull: number;
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
  /**
   * The five systems shipped in the Mafia-boss cycle, measured for the first
   * time.
   *
   * All five went in without a single probe touching them, which is F7 five
   * times over: a system no instrument plays is a system nobody has measured,
   * however many unit tests it carries. Their tests prove the code does what
   * the code says. Nothing until now has said whether a career ever meets any
   * of it.
   *
   * Everything in here is read-only against the baseline bot. `readWhispers`,
   * `civicRead`, `legitimacy` and `careerShape` all derive rather than roll —
   * none of them touch the `rng` stream — so recording them cannot move a
   * single number the rest of this file reports. That property is what makes
   * it safe to add to the existing population instead of standing up a second
   * one, and it is asserted below rather than assumed.
   */
  newSystems: {
    whispers: {
      /** Distinct claims that ever appeared in the feed. */
      received: number;
      /** Weeks where the player had anything at all to read. */
      weeksWithAny: number;
      meanConfidence: number;
      /** The weekly sample the two above are shares of. */
      weeks: number;
    };
    civic: {
      /**
       * The best standing any figure ever reached, against bars of 40 to 60.
       *
       * A maximum over four people, and on its own it says almost nothing —
       * the first version of this readout reported 99 for every career and was
       * read as "the network saturates", when all it established was that
       * *one* of the four got there. Which one matters: the captain watches
       * heat and the judge watches the papers, and those are different games.
       * So `byFigure` is the reading and this is the headline.
       */
      peakStanding: number;
      byFigure: Record<string, { peak: number; everOwed: boolean }>;
      /** What the judge watches, and what the alderman watches. */
      peakNotoriety: number;
      meanSentiment: number;
      /** First day anybody owed the player anything. Null means never. */
      firstOwedDay: number | null;
      weeksOwed: number;
      /** Weeks where at least one favour was actually spendable. */
      weeksSpendable: number;
    };
    /** The reading at the end, and the range it moved across. */
    legitimacy: { final: number; peak: number; low: number };
    /** What the career would be called if it stopped here. */
    shape: string;
    /**
     * What an active player did with any of it.
     *
     * Zero on the baseline bot by construction — it does not know these
     * systems exist. Non-zero only in the active population, which is the
     * half that actually closes F7 rather than merely measuring around it.
     */
    favoursSpent: number;
    dialTurns: number;
    /** Weeks the active policy asked for each setting, so it can be read back. */
    dialWeeks: Record<PressureId, number>;
  };
  /**
   * How much the game found to say, and when.
   *
   * Round 14's second MUST FIX is a supply number and it had never been
   * measured: *"Between day 180 and day 300 I met exactly one memo I had not
   * seen before."* Counted by distinct **body** rather than by definition id,
   * because two instances of one shape against two different men are two
   * situations — which is the whole claim the generative half makes, and
   * exactly what counting ids would hide.
   */
  /** Loans taken to reach a front. See `Policy.financeFronts`. */
  borrowed: number;
  /**
   * The other families, and whether anything was ever open against them.
   *
   * F5: *"the rival families never did anything"* — strengths of 84, 100 and
   * 100 and a Neutral stance for 224 days. F17: both diplomatic doors shut for
   * every career, all 300 days. Neither had ever been counted; the probe
   * watched wars and grudges and never once asked what the player could
   * actually press.
   */
  rivals: {
    weeks: number;
    /** Rival-weeks spent at the neutral label, out of `weeks` times three. */
    neutralWeeks: number;
    /** Rivals whose stance ever left neutral in either direction. */
    everMoved: number;
    /** Weeks each diplomatic action was open against at least one family. */
    open: Record<string, number>;
    /** Weeks at least one action of any kind was open. */
    anyOpenWeeks: number;
    /** The best the three bars were ever approached, against any family. */
    peakStanding: number;
    peakRespect: number;
    peakLead: number;
    /** Rival-weeks spent on each objective kind. F5 asks whether they act. */
    doing: Record<string, number>;
    /** And whether they could afford to act. */
    meanWealth: number;
    brokeWeeks: number;
    wealthSamples: number;
  };
  memos: {
    seen: number;
    generated: number;
    /**
     * Distinct *situations*, keyed on the shape and who it was about.
     *
     * The first version of this counted distinct memo **bodies** and reported
     * that a career meets fifteen new ones after day 180 — with the generator
     * switched off. It was counting `oneOf` variants: every authored event
     * carries two to four ways of arriving, so the same memo about the same
     * man reads as new content three times. Round 14 was not fooled by that
     * and neither should the instrument be.
     *
     * A situation is the shape plus its subject. `gen_wants_a_word` about
     * Rocco and the same shape about Gina are two situations; the promotion
     * demand reworded is one.
     */
    early: number;
    lateAndNew: number;
    /** How many of those late situations the generator supplied. */
    lateGenerated: number;
    /** Definition ids never met before day 180, which is round 14's count. */
    lateNewShapes: number;
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
/**
 * What the bot knows about.
 *
 * The default is deliberately the bot exactly as it was before the Mafia-boss
 * cycle: it does not know the favour network or the pressure dial exist. That
 * is not laziness, it is the control. The 300-day distribution in this file is
 * what the rank table was sized against, and a bot that quietly started
 * spending favours would move every number in it while looking like a
 * measurement of the same game.
 *
 * `active` is the other arm. Same bot, same seeds, plus the two systems a
 * player can actually operate.
 */
interface Policy {
  active?: boolean;
  /**
   * Borrows to buy a front when the money is short.
   *
   * F15 says the economy forks on fronts: front income compounds into
   * holdings, so a family that never gets a second one never starts, and the
   * probe reports the gate as **money in 98% of the weeks a career owns
   * nothing**. What no instrument in this project has ever checked is whether
   * the game already answers that — `LENDERS[0]` is a man at the back of a
   * restaurant with a $40,000 ceiling, `minRespect: 0`, `minBusinesses: 0`,
   * available from the first morning.
   *
   * So before touching the economy, the question is whether the route exists
   * and nobody walks it. This arm walks it.
   */
  financeFronts?: boolean;
}

function climb(seed: number, days: number, policy: Policy = {}): Climb {
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
  /** Loans taken to reach a front. Zero on every arm but `financeFronts`. */
  let borrowed = 0;
  const rivalWatch = {
    weeks: 0,
    neutralWeeks: 0,
    open: Object.fromEntries(DIPLOMATIC_ACTIONS.map((a) => [a.id, 0])) as Record<string, number>,
    anyOpenWeeks: 0,
    /* What the three bars are actually sized against. */
    peakStanding: -100,
    peakRespect: 0,
    peakLead: -999,
    /** What the other families were doing, by rival-week. */
    doing: {} as Record<string, number>,
    wealthSum: 0,
    wealthSamples: 0,
    brokeWeeks: 0,
  };
  /** Rivals seen away from neutral at any point. */
  const movedStance = new Set<string>();
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
  /*
     The five systems from the Mafia-boss cycle, watched once a week.

     Whispers are counted by text rather than by feed length because the feed
     is a ring buffer that drops the oldest and hides the stale, so its length
     answers "how much is on the desk today" when the question is "how much
     ever arrived". Confidence is summed over arrivals for the same reason.
  */
  const heard = new Set<string>();
  let whisperConfidence = 0;
  /* Every memo the career was ever shown, captured before it is answered. */
  const memoIds = new Set<string>();
  const memoEarly = new Set<string>();
  const memoLateNew = new Set<string>();
  const memoLateGen = new Set<string>();
  const shapesEarly = new Set<string>();
  const shapesLateNew = new Set<string>();
  const memos = { seen: 0, generated: 0 };
  /** The shape plus who it was about. See the note on `memos` above. */
  const situation = (e: { defId: string; npcId: string | null; data: Record<string, string | number> }) =>
    `${e.defId}:${e.npcId ?? e.data.businessId ?? e.data.territoryId ?? e.data.civicId ?? e.data.caseId ?? ''}`;
  /** The day the back half starts, matching what round 14 reported against. */
  const BACK_HALF = 180;
  const newSys = {
    weeks: 0,
    weeksWithAny: 0,
    peakStanding: 0,
    byFigure: Object.fromEntries(
      CIVIC_FIGURES.map((f) => [f.id, { peak: 0, everOwed: false }]),
    ) as Record<string, { peak: number; everOwed: boolean }>,
    firstOwedDay: null as number | null,
    weeksOwed: 0,
    weeksSpendable: 0,
    legPeak: 0,
    legLow: 100,
    /* What the judge and the alderman are actually looking at. */
    notoriety: 0,
    sentimentSum: 0,
    sentimentWeeks: 0,
    favoursSpent: 0,
    dialTurns: 0,
    dialWeeks: { clean: 0, normal: 0, hard: 0 } as Record<PressureId, number>,
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
    /*
       Read before answering, because answering removes it. A first version
       counted `state.pendingEvents` after the run and reported that a career
       met three memos.
    */
    for (const e of state.pendingEvents) {
      if (memoIds.has(e.id)) continue;
      memoIds.add(e.id);
      memos.seen += 1;
      if (isGenerated(e.defId)) memos.generated += 1;
      const key = situation(e);
      if (state.day < BACK_HALF) {
        memoEarly.add(key);
        shapesEarly.add(e.defId);
      } else {
        if (!memoEarly.has(key)) {
          memoLateNew.add(key);
          if (isGenerated(e.defId)) memoLateGen.add(key);
        }
        if (!shapesEarly.has(e.defId)) shapesLateNew.add(e.defId);
      }
    }
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
      /*
         Borrow the shortfall, when the policy says to.

         Only for the cheapest front on the board and only when nothing is
         affordable outright, because this is a bot modelling somebody who
         wants a second front rather than somebody leveraging themselves into
         the ground. The shark takes no collateral and asks nothing, so the
         only question is whether the repayments can be lived with — which is
         precisely what `tickLoans` is there to answer.
      */
      if (policy.financeFronts && Object.keys(state.market?.loans ?? {}).length === 0) {
        const affordable = territoryList(state).some((t) =>
          BUSINESSES.some((def) => {
            const c = canAcquire(state, def.id, t.id);
            return c.ok && c.cost + reserve <= totalFunds(state);
          }),
        );
        if (!affordable) {
          let want = 0;
          for (const t of territoryList(state)) {
            for (const def of BUSINESSES) {
              const c = canAcquire(state, def.id, t.id);
              if (!c.ok) continue;
              if (want === 0 || c.cost < want) want = c.cost;
            }
          }
          if (want > 0) {
            const facts = {
              respect: state.org.respect,
              businesses: ownedBusinesses(state).length,
              friendlyFactionId: null,
            };
            if (canBorrow(state, 'shark', facts).ok) {
              const short = Math.ceil(want + reserve - totalFunds(state));
              if (short > 0 && borrow(state, 'shark', short).ok) borrowed += 1;
            }
          }
        }
      }

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
       Talk to the other families.

       F7, named directly. No instrument in this project had ever made a
       diplomatic approach, so half of the Influence economy was invisible to
       every measurement ever taken here — and Influence is the attribute four
       blind rounds have reported not understanding. A rate tuned against a bot
       that only ever pulls one of the two taps is tuned against a player who
       does not exist.

       The free demand only. A first version also paid `offer_tribute` when the
       money looked spare, and that is not a play a boss makes — $25,000 for
       0.6 of an attribute — so it was distorting the thing it was added to
       measure: careers that compounded fell from 12 in 36 to 8 because the
       treasury was going on courtesies instead of fronts.

       `doDiplomacy` credits pull on the approach whether or not they say yes,
       and the credit is rate-limited per family, so asking every week costs
       nothing and buys nothing extra.

       **The measurement this produced is that the door is shut.** Every refusal
       across 36 careers is the same sentence — "you lead them by -72 strength
       and would need 15 — or 55 standing with them, against 29" — for all 300
       days. Which is F5 wearing another hat: the player is 40 to 80 strength
       behind every rival for the whole game.

       Not attempted during a war — `canDo` refuses it anyway, and asking is
       how the bot would learn a rule the player already knows.
    */
    if (state.day % 7 === 0) {
      for (const id of RIVAL_IDS) {
        if (atWar(state, 'player', id)) continue;
        if (canDo(state, 'demand_tribute', id).ok) doDiplomacy(state, rng, 'demand_tribute', id);
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
       The other families, once a week: where they stand and what is open.
    */
    if (state.day % 7 === 0) {
      rivalWatch.weeks += 1;
      let anyOpen = false;
      for (const id of RIVAL_IDS) {
        const value = relationship(state, 'player', id);
        const label = relationshipLabelFor(value);
        if (label === 'Neutral') rivalWatch.neutralWeeks += 1;
        else movedStance.add(id);
        rivalWatch.peakStanding = Math.max(rivalWatch.peakStanding, value);
        // Their respect for the player, which is what `canDo` gates on — the
        // first version read this the other way round, copying an inversion
        // that was in `canDo` itself.
        rivalWatch.peakRespect = Math.max(rivalWatch.peakRespect, bond(state, id, 'player').respect);
        rivalWatch.peakLead = Math.max(
          rivalWatch.peakLead,
          playerStrength(state) - factionStrength(state, id),
        );
      }
      for (const id of RIVAL_IDS) {
        const kind = state.factions[id]?.currentObjective?.kind;
        if (kind) rivalWatch.doing[kind] = (rivalWatch.doing[kind] ?? 0) + 1;
        // F5's remaining hypothesis: the families are chronically broke, and
        // `scoreConsolidate` carries a flat 0.45 whenever they are.
        const wealth = state.factions[id]?.wealth ?? 0;
        rivalWatch.wealthSum += wealth;
        rivalWatch.wealthSamples += 1;
        if (wealth < AI.pressure.cost) rivalWatch.brokeWeeks += 1;
      }
      for (const action of DIPLOMATIC_ACTIONS) {
        const openHere = RIVAL_IDS.some((id) => canDo(state, action.id, id).ok);
        if (openHere) {
          rivalWatch.open[action.id] += 1;
          anyOpen = true;
        }
      }
      if (anyOpen) rivalWatch.anyOpenWeeks += 1;
    }

    /*
       And the five that nobody had ever watched.

       Strictly a reading. Every call in here derives rather than rolls, which
       is asserted by its own test — if that ever stops being true this block
       silently reshuffles the whole file.
    */
    if (state.day % 7 === 0) {
      newSys.weeks += 1;

      const feed = readWhispers(state);
      if (feed.length) newSys.weeksWithAny += 1;
      for (const w of feed) {
        if (heard.has(w.text)) continue;
        heard.add(w.text);
        whisperConfidence += w.confidence;
      }

      const civic = civicRead(state);
      let owed = false;
      let spendable = false;
      for (const f of civic) {
        newSys.peakStanding = Math.max(newSys.peakStanding, f.standing);
        const mine = newSys.byFigure[f.id];
        if (mine) {
          mine.peak = Math.max(mine.peak, f.standing);
          if (f.owed > 0) mine.everOwed = true;
        }
        if (f.owed > 0) owed = true;
        if (!f.blocked) spendable = true;
      }
      if (owed) {
        newSys.weeksOwed += 1;
        if (newSys.firstOwedDay === null) newSys.firstOwedDay = state.day;
      }
      if (spendable) newSys.weeksSpendable += 1;

      newSys.notoriety = Math.max(newSys.notoriety, state.city?.notoriety ?? 0);
      const worked = territoryList(state).filter((t) => playerInfluence(t) >= 10);
      if (worked.length) {
        newSys.sentimentSum += worked.reduce((n, t) => n + t.sentiment, 0) / worked.length;
        newSys.sentimentWeeks += 1;
      }

      const leg = legitimacy(state);
      newSys.legPeak = Math.max(newSys.legPeak, leg);
      newSys.legLow = Math.min(newSys.legLow, leg);

      /*
         And the half that actually plays them.

         Competent, not optimal — the same standard as the rest of this bot. It
         calls a favour in when there is something for it to do, and when the
         stock is at its cap, because a favour that accrues past `maxOwed` is a
         favour thrown away. It does not hoard for a rainy day and it does not
         plan; it answers the week in front of it.
      */
      if (policy.active) {
        const cases = activeCases(state);
        const inside = crewList(state).filter((n) => n.status === 'arrested').length > 0;
        const hostile = territoryList(state).some(
          (t) => playerInfluence(t) >= 10 && t.sentiment < SENTIMENT_HOSTILE_BELOW,
        );
        for (const f of civic) {
          if (f.blocked) continue;
          const worthIt =
            f.owed >= CIVIC.maxOwed ||
            (f.id === 'captain' && cases.length > 0) ||
            (f.id === 'judge' && inside) ||
            (f.id === 'union' && hostile) ||
            (f.id === 'alderman' && state.org.heat >= 50);
          if (!worthIt) continue;
          if (spendFavour(state, f.id).ok) newSys.favoursSpent += 1;
        }

        /*
           And the dial, on the only question it asks: how dirty do I want this
           business this week.

           The first version of this policy went clean on any case above 25
           strength or heat above 60, and the probe reported that using the
           dial cost 73% of everything the career ever laundered. That reading
           was about the bot, not the dial: median peak case strength across
           this population is 100, so the condition was true almost every week
           and the measurement was "always clean" against "always normal"
           wearing the costume of a policy.

           So the trigger is now the thing a boss would actually react to —
           a case far enough along that somebody is about to knock, or heat in
           its top band — and the weeks are counted by setting, so the readout
           says what the policy did rather than only what happened afterwards.
        */
        const worst = worstStage(state);
        const closing = worst ? stageIndex(worst) >= stageIndex('warrants') : false;
        const backedUp = state.org.dirtyCash > 20_000;
        const want: PressureId =
          closing || state.org.heat >= 75 ? 'clean' : backedUp && state.org.heat < 40 ? 'hard' : 'normal';
        newSys.dialWeeks[want] += 1;
        for (const b of ownedBusinesses(state)) {
          if ((b.pressure ?? 'normal') === want) continue;
          b.pressure = want;
          newSys.dialTurns += 1;
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
    newSystems: {
      whispers: {
        received: heard.size,
        weeksWithAny: newSys.weeksWithAny,
        meanConfidence: heard.size ? whisperConfidence / heard.size : 0,
        weeks: newSys.weeks,
      },
      civic: {
        peakStanding: newSys.peakStanding,
        byFigure: newSys.byFigure,
        peakNotoriety: newSys.notoriety,
        meanSentiment: newSys.sentimentWeeks ? newSys.sentimentSum / newSys.sentimentWeeks : 0,
        firstOwedDay: newSys.firstOwedDay,
        weeksOwed: newSys.weeksOwed,
        weeksSpendable: newSys.weeksSpendable,
      },
      legitimacy: {
        final: legitimacy(state),
        peak: newSys.legPeak,
        // A career that ended on day one never sampled, and 100 would read as
        // a spotless boss rather than as no reading at all.
        low: newSys.weeks ? newSys.legLow : 0,
      },
      shape: careerShape(state).id,
      favoursSpent: newSys.favoursSpent,
      dialTurns: newSys.dialTurns,
      dialWeeks: newSys.dialWeeks,
    },
    borrowed,
    rivals: {
      weeks: rivalWatch.weeks,
      neutralWeeks: rivalWatch.neutralWeeks,
      everMoved: movedStance.size,
      open: rivalWatch.open,
      anyOpenWeeks: rivalWatch.anyOpenWeeks,
      peakStanding: rivalWatch.peakStanding,
      peakRespect: rivalWatch.peakRespect,
      peakLead: rivalWatch.peakLead,
      doing: rivalWatch.doing,
      meanWealth: rivalWatch.wealthSamples ? rivalWatch.wealthSum / rivalWatch.wealthSamples : 0,
      brokeWeeks: rivalWatch.brokeWeeks,
      wealthSamples: rivalWatch.wealthSamples,
    },
    memos: {
      seen: memos.seen,
      generated: memos.generated,
      early: memoEarly.size,
      lateAndNew: memoLateNew.size,
      lateGenerated: memoLateGen.size,
      lateNewShapes: shapesLateNew.size,
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
    pull: state.player.attributes.influence,
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

/*
   A wider sample, for the one question below that thirty-six cannot answer.

   The back-half memo test asks whether the generator supplies at least a third
   of the late situations. The answer is about 35%, so the bar is inside the
   resampling noise of a thirty-six-career sample: adding two houses to the
   pool in config/houses.ts moved this reading from 34.7% to 32.3% without
   changing any behaviour at all — the same thirty-six seeds simply draw
   different cities out of a larger pool. Substituting personalities that were
   exact copies of houses already in the pool produced the same 32%, which is
   what proves it is the sample and not the families.

   So the sample is widened rather than the bar lowered. At a hundred and
   twenty the reading is 34.5% here and 35.7–36.1% on two disjoint seed
   windows, which is enough resolution to answer a question posed at a third.
   It costs about eight seconds. The threshold below has not moved and must
   not: the point of the number is that it was pre-committed.
*/
const MEMO_RUNS = Array.from({ length: 120 }, (_, i) => climb(700 + i, HUMAN_DAYS));

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
         influence at day ${HUMAN_DAYS}, 40th / median / 75th: ` +
        `${col((r) => r.pull)} (the patron wants 9, a task-force contact 5)` +
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
     Influence, pre-committed before the rate was touched.

     Four rounds have never seen a player above 2, and after the two supply
     defects were fixed the median career still ended on 0. The bar that
     matters is 5 — a task-force contact, the first political door that is not
     already open — and 9 is the patron, which should stay something a career
     works toward rather than passes through.

     So: the median career opens one door and does not reach city hall. Both
     ends are asserted, because a rate raised until everything unlocks has not
     fixed the vertical, it has deleted it.

     This is a target for `INFLUENCE_FROM`, not a threshold on the instrument.
     DIRECTOR section 5 forbids moving it to make the config pass.
  */
  it('lets a career that keeps counsel and talks reach the first political door', () => {
    const pull = RUNS_300.map((r) => r.pull);
    const mid = median(pull);

    expect(mid, 'the median career still cannot open anything').toBeGreaterThanOrEqual(4);
    expect(mid, 'the patron has stopped being something you work toward').toBeLessThanOrEqual(8);
  });

  /*
     Round 14's second MUST FIX, as a number.

     *"The memo pool exhausts, and after Capo it is the only source of new
     content. Between day 180 and day 300 I met exactly one memo I had not seen
     before."* Twenty-two authored events cannot carry three hundred days, and
     no amount of writing fixes that — a twenty-third is met once too.

     Careers that ended before day 180 are excluded rather than counted as
     zero: a family that was wiped out in month five has no back half, and
     folding those in would report a content problem as whatever the death rate
     happens to be.
  */
  it('keeps finding something to say in the back half of a career', () => {
    const lived = MEMO_RUNS.filter((r) => r.days >= 240);
    const late = lived.map((r) => r.memos.lateAndNew);
    const mid = median(late);

    const fromGenerator = lived.reduce((n, r) => n + r.memos.lateGenerated, 0);
    const allLate = lived.reduce((n, r) => n + r.memos.lateAndNew, 0);

    // eslint-disable-next-line no-console
    console.log(
      `memos: ${lived.length}/${MEMO_RUNS.length} careers reached day 240\n` +
        `       distinct situations before day 180, 40th / median / 75th: ` +
        `${pct(lived.map((r) => r.memos.early), 0.4)} / ${median(lived.map((r) => r.memos.early))} / ` +
        `${pct(lived.map((r) => r.memos.early), 0.75)}\n` +
        `       new situations after day 180: ` +
        `${pct(late, 0.4)} / ${mid} / ${pct(late, 0.75)}\n` +
        `       shapes never seen before day 180: ` +
        `${median(lived.map((r) => r.memos.lateNewShapes))} (round 14 reported 1)\n` +
        `       share of the late ones the generator supplied: ` +
        `${Math.round((100 * fromGenerator) / Math.max(1, allLate))}%`,
    );

    /*
       Pre-committed, and stated about the mechanism rather than as a count.

       A count was the wrong shape and it went green before any of this was
       built: counting memo *bodies* counted `oneOf` variants, so a career read
       as meeting fifteen new memos after day 180 on the authored pool alone.
       The number that was supposed to be the finding was measuring the prose.

       What the generative half actually claims is that it carries the back
       half of a career — that when the authored pool has been round twice, the
       new situations are coming from the simulation. A third is the line: below
       that the generator is a rounding error on somebody else's supply, and
       there is no point having built it.

       **This currently fails at about 27%, and it is left failing.** Raising
       the generation rate from 0.07 to 0.11 moved it by one point, because the
       authored pool keeps producing new situations too — the same memo about a
       different man counts for them exactly as it counts for these. So the
       shortfall is not a rate that needs turning up; it is the claim being
       larger than what six shapes against twenty-two can carry.

       The bar stays where it was written. Moving it to 25% would make the suite
       green and would mean nothing, and this project has a rule about that
       which exists because the alternative has cost it four rounds.

       It clears now, at about 35%, and the paragraph above is left standing
       because it is the record of what the number was for. Nothing was turned
       up to get there — more shapes were written. The margin is small enough
       that the sample had to be widened to read it; see `MEMO_RUNS`.
    */
    expect(lived.length, 'nothing lived long enough to have a back half').toBeGreaterThan(8);
    expect(allLate, 'no late situations at all, so the share below is meaningless').toBeGreaterThan(20);
    expect(
      fromGenerator / allLate,
      'the generated half is not carrying the back end of a career',
    ).toBeGreaterThanOrEqual(1 / 3);
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

/*
   The five systems nobody has ever measured.

   Whispers, the favour network, legitimacy, career shapes and the pressure
   dial all shipped inside one cycle, and not one instrument in this project
   touched any of them. That is F7 — "every instrument here plays the same
   narrow game" — five times over, and it is worse than an unmeasured feature:
   a system the bot cannot see is a system whose absence from the numbers
   proves nothing at all.

   This block asks the first question, which is not "is it good" but "does a
   career ever meet it". Read-only, against the population that already exists.
*/
describe('the systems nobody had measured', () => {
  /*
     The instrument, and it has to come first.

     Everything below is a share of a weekly sample. If the sample is zero the
     shares are all zero and every assertion under it passes or fails for a
     reason that has nothing to do with the game.
  */
  it('actually looked', () => {
    const looked = RUNS_300.filter((r) => r.newSystems.whispers.weeks > 0).length;
    expect(
      looked,
      'no career recorded a single weekly reading, so nothing below measures anything',
    ).toBe(RUNS_300.length);
  });

  /*
     The property that makes it safe to measure these on the existing
     population rather than a second one.

     `readWhispers`, `civicRead`, `legitimacy` and `careerShape` are all
     derivations. If any of them ever rolls, adding this measurement silently
     reshuffles every number in this file, and the ladder distribution that
     the rank table was sized against stops describing the same game. Cheap to
     assert, and the exact mistake whispers made on the day it was written —
     it took an `Rng`, and wiring it into the clock broke two unrelated tests
     about operations.
  */
  it('measures without touching the random stream', () => {
    const state = newGame({ name: 'Observer', difficulty: 'normal', seed: 4242 });
    for (let i = 0; i < 120; i++) advanceDay(state);

    const before = state.rng.calls;
    readWhispers(state);
    civicRead(state);
    legitimacy(state);
    careerShape(state);
    expect(
      state.rng.calls,
      'reading these systems advanced the random stream, so measuring them changes the game',
    ).toBe(before);
  });

  it('says whether a whisper ever reaches a career', () => {
    const w = RUNS_300.map((r) => r.newSystems.whispers);
    const withAny = w.filter((x) => x.received > 0).length;

    // eslint-disable-next-line no-console
    console.log(
      `whispers: ${withAny}/${RUNS_300.length} careers ever heard anything\n` +
        `         median claims over ${HUMAN_DAYS} days: ${median(w.map((x) => x.received))}\n` +
        `         weeks with something to read: ` +
        `${Math.round((100 * w.reduce((n, x) => n + x.weeksWithAny, 0)) / Math.max(1, w.reduce((n, x) => n + x.weeks, 0)))}%\n` +
        `         mean stated confidence: ` +
        `${Math.round(median(w.filter((x) => x.received > 0).map((x) => x.meanConfidence)) || 0)}%`,
    );

    /*
       The pre-committed condition. `WHISPERS` rolls weekly at 0.55, so across
       roughly forty-two weeks a career that never hears anything means the
       feed is not reaching the player at all — a supply fault, not a balance
       one. This is a target for the config, not a threshold on the probe.
    */
    expect(withAny, 'a career can play 300 days and never hear a whisper').toBe(RUNS_300.length);
  });

  it('says whether the favour network is reachable by an ordinary career', () => {
    const c = RUNS_300.map((r) => r.newSystems.civic);
    const everOwed = c.filter((x) => x.firstOwedDay !== null);

    // eslint-disable-next-line no-console
    console.log(
      `civic: ${everOwed.length}/${RUNS_300.length} careers were ever owed a favour\n` +
        (everOwed.length
          ? `       median day the first one arrived: ${median(everOwed.map((x) => x.firstOwedDay!))}\n`
          : '') +
        `       by figure, median best standing and careers ever owed:\n` +
        CIVIC_FIGURES.map(
          (f) =>
            `         ${f.id.padEnd(9)} ` +
            `${Math.round(median(c.map((x) => x.byFigure[f.id]?.peak ?? 0)))}` +
            ` (bar ${f.owesAbove}, needs Influence ${f.needsInfluence})` +
            `, owed in ${c.filter((x) => x.byFigure[f.id]?.everOwed).length}/${c.length}`,
        ).join('\n') +
        `\n` +
        `       what they are looking at: peak notoriety ` +
        `${Math.round(median(c.map((x) => x.peakNotoriety)))} (the judge reads 100 minus this), ` +
        `mean sentiment where working ${Math.round(median(c.map((x) => x.meanSentiment)))} ` +
        `(the alderman reads this)
` +
        `       weeks with a favour actually spendable: ` +
        `${c.reduce((n, x) => n + x.weeksSpendable, 0)}`,
    );

    /*
       The pre-committed condition, and the one most likely to come back red.

       `config/civic.ts` states its own design claim: "13 quiet weeks reach 48
       vs a bar of 40". A 300-day career is about forty-two weeks. If half of
       them cannot get a single figure to owe them anything, the network is
       priced for a run that has already succeeded — which is the exact
       complaint round 14 made about police contacts, rebuilt.

       A target for `CIVIC`, not a threshold on this file.
    */
    expect(
      everOwed.length,
      'most careers never get a single civic figure to owe them anything',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_300.length / 2));

    /*
       And the same question of each figure, which is the one that matters.

       The headline above went green while two of the four were broken in
       opposite directions, because it is a maximum over four people: the judge
       owes every career in the population and the alderman has never owed
       anybody, and "36/36 were owed something" reports both as success.

       Two conditions, and they are about content rather than balance. A figure
       no career ever reaches is content nobody will see. A figure every career
       reaches whatever they do is not a relationship, it is a fixture. Both
       are targets for `config/civic.ts`; neither may be moved to make the
       config pass.
    */
    for (const f of CIVIC_FIGURES) {
      const owed = c.filter((x) => x.byFigure[f.id]?.everOwed).length;
      expect(owed, `the ${f.id} is out of reach of almost every career`).toBeGreaterThanOrEqual(9);
      expect(owed, `the ${f.id} owes you regardless of how you play`).toBeLessThanOrEqual(33);
    }
  });

  it('says what legitimacy reads across a population', () => {
    const l = RUNS_300.map((r) => r.newSystems.legitimacy);
    const shapes = new Map<string, number>();
    for (const r of RUNS_300) shapes.set(r.newSystems.shape, (shapes.get(r.newSystems.shape) ?? 0) + 1);

    // eslint-disable-next-line no-console
    console.log(
      `legitimacy at day ${HUMAN_DAYS}, 40th / median / 75th: ` +
        `${Math.round(pct(l.map((x) => x.final), 0.4))} / ` +
        `${Math.round(median(l.map((x) => x.final)))} / ` +
        `${Math.round(pct(l.map((x) => x.final), 0.75))}\n` +
        `         range walked by the median career: ` +
        `${Math.round(median(l.map((x) => x.low)))} to ${Math.round(median(l.map((x) => x.peak)))}\n` +
        `         career shapes: ` +
        [...shapes].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '),
    );

    /*
       Two ways this reading could be worthless, both checked.

       Pinned at one value across thirty-six different careers means it is not
       reading the careers. Outside 0..100 means the weights do not sum the way
       `LEGITIMACY` says they do.
    */
    /*
       The horoscope condition, at the population level.

       `config/legacy.ts` opens by saying a shape must be able to fail to
       match, and `legacy.test.ts` checks that one career at a time. Neither
       can see the failure that matters: a bar set below the population median
       hands the same verdict to most of the game. `unremarkable` is exempt —
       it is the floor, and most careers being unremarkable at day 300 is the
       system working.

       A target for `SHAPE_BARS`, not a threshold on this file.
    */
    const named = [...shapes].filter(([k]) => k !== 'unremarkable').sort((a, b) => b[1] - a[1]);
    if (named.length) {
      expect(
        named[0][1] / RUNS_300.length,
        `"${named[0][0]}" is the verdict on ${named[0][1]} of ${RUNS_300.length} careers`,
      ).toBeLessThanOrEqual(0.4);
    }

    const distinct = new Set(l.map((x) => Math.round(x.final))).size;
    expect(distinct, 'every career reads the same legitimacy, so it is not reading them').toBeGreaterThan(3);
    expect(l.every((x) => x.final >= 0 && x.final <= 100)).toBe(true);
  });
});

/*
   The half that closes F7 rather than measuring around it.

   Everything above is a career that never touches the new systems. It answers
   "does a player meet them", which is worth knowing and is not the same
   question as "does using them do anything". Nothing in this project had ever
   asked the second question about any of the five.

   Same seeds, same bot, plus favours and the dial. The comparison against
   RUNS_300 is a comparison of two populations rather than two runs, because
   any change reshuffles the stream and a single-run diff here would be noise
   with a decimal point on it.
*/
const RUNS_ACTIVE = Array.from({ length: 36 }, (_, i) => climb(700 + i, HUMAN_DAYS, { active: true }));

/*
   F15's arm: the same bot, allowed to borrow its way to a front.

   The finding says the economy forks on fronts and the gate is money in 98% of
   the weeks a career owns nothing. Before changing the economy, this asks
   whether the game already answers it — the first lender in the catalogue is a
   man at the back of a restaurant with a $40,000 ceiling, no collateral, no
   respect requirement and no business requirement, reachable on the first
   morning of the game.
*/
const RUNS_FINANCED = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { financeFronts: true }),
);

describe('the other families', () => {
  it('says whether they ever move, and whether anything is ever open', () => {
    const weeks = RUNS_300.reduce((n, r) => n + r.rivals.weeks, 0);
    const neutral = RUNS_300.reduce((n, r) => n + r.rivals.neutralWeeks, 0);
    const anyOpen = RUNS_300.reduce((n, r) => n + r.rivals.anyOpenWeeks, 0);

    // eslint-disable-next-line no-console
    console.log(
      `rivals: ${RUNS_300.length} careers, ${weeks} weeks each side of three families\n` +
        `        rival-weeks spent at Neutral: ` +
        `${Math.round((100 * neutral) / Math.max(1, weeks * 3))}%\n` +
        `        careers where any family ever left Neutral: ` +
        `${RUNS_300.filter((r) => r.rivals.everMoved > 0).length}/${RUNS_300.length}\n` +
        `        weeks with any diplomatic option open: ` +
        `${Math.round((100 * anyOpen) / Math.max(1, weeks))}%\n` +
        DIPLOMATIC_ACTIONS.map((a) => {
          const w = RUNS_300.reduce((n, r) => n + r.rivals.open[a.id], 0);
          const careers = RUNS_300.filter((r) => r.rivals.open[a.id] > 0).length;
          return `          ${a.id.padEnd(17)} open in ${careers}/${RUNS_300.length} careers, ` +
            `${Math.round((100 * w) / Math.max(1, weeks))}% of weeks`;
        }).join('\n'),
    );

    // eslint-disable-next-line no-console
    console.log(
      `        the three bars, 40th / median / 75th of the best any career reached:
` +
        `          standing (alliance wants 40)  ` +
        `${Math.round(pct(RUNS_300.map((r) => r.rivals.peakStanding), 0.4))} / ` +
        `${Math.round(median(RUNS_300.map((r) => r.rivals.peakStanding)))} / ` +
        `${Math.round(pct(RUNS_300.map((r) => r.rivals.peakStanding), 0.75))}
` +
        `          respect (demand wants ${DIPLOMACY.demandRespect})       ` +
        `${Math.round(pct(RUNS_300.map((r) => r.rivals.peakRespect), 0.4))} / ` +
        `${Math.round(median(RUNS_300.map((r) => r.rivals.peakRespect)))} / ` +
        `${Math.round(pct(RUNS_300.map((r) => r.rivals.peakRespect), 0.75))}
` +
        `        what the families were doing, by rival-week: ` +
        (() => {
          const all: Record<string, number> = {};
          for (const r of RUNS_300) {
            for (const [k, n] of Object.entries(r.rivals.doing)) all[k] = (all[k] ?? 0) + n;
          }
          const total = Object.values(all).reduce((a, b) => a + b, 0) || 1;
          return Object.entries(all)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => `${k} ${Math.round((100 * n) / total)}%`)
            .join(', ');
        })() +
        `
` +
        `        rival-weeks spent short of the ${'$'}${AI.pressure.cost.toLocaleString('en-US')} a push costs: ` +
        `${Math.round((100 * RUNS_300.reduce((n, r) => n + r.rivals.brokeWeeks, 0)) / Math.max(1, RUNS_300.reduce((n, r) => n + r.rivals.wealthSamples, 0)))}%` +
        `, mean wealth ${'$'}${Math.round(median(RUNS_300.map((r) => r.rivals.meanWealth))).toLocaleString('en-US')}
` +
        `          careers whose peak standing cleared the alliance bar of ` +
        `${DIPLOMATIC_ACTION_BY_ID['propose_alliance'].minRelationship}: ` +
        `${RUNS_300.filter((r) => r.rivals.peakStanding >= DIPLOMATIC_ACTION_BY_ID['propose_alliance'].minRelationship).length}/${RUNS_300.length}
` +
        `          strength lead (wants ${DIPLOMACY.demandStrengthLead})    ` +
        `${Math.round(pct(RUNS_300.map((r) => r.rivals.peakLead), 0.4))} / ` +
        `${Math.round(median(RUNS_300.map((r) => r.rivals.peakLead)))} / ` +
        `${Math.round(pct(RUNS_300.map((r) => r.rivals.peakLead), 0.75))}`,
    );

    expect(weeks, 'nothing was sampled').toBeGreaterThan(0);
  });

  /*
     F17, pre-committed.

     Round 13 read the Diplomacy screen four times and wrote *"shows strengths
     and stances but I never found anything on it I could press"*. A screen
     with nothing pressable on it for three hundred days is not a system, and
     the two doors it offers a peaceful career — asking for tribute and
     proposing an alliance — were shut in every career the probe has run.

     The condition is deliberately weak: **one** of the two, in **half** the
     careers, at some point in three hundred days. A target for
     `config/diplomacy.ts`, never a threshold to be moved.
  */
  it('opens at least one door to a career that is not at war', () => {
    const reached = RUNS_300.filter(
      (r) => r.rivals.open['demand_tribute'] > 0 || r.rivals.open['propose_alliance'] > 0,
    ).length;
    expect(
      reached,
      'no career could ever demand tribute or propose an alliance',
    ).toBeGreaterThanOrEqual(RUNS_300.length / 2);
  });
});

describe('the front fork', () => {
  /*
     F15, and the question nobody had asked about it.

     The instrument first: an arm that never actually borrows would report that
     borrowing changes nothing, which is the shape of half the entries in
     HANDOFF section 3.
  */
  it('actually borrowed', () => {
    const loans = RUNS_FINANCED.reduce((n, r) => n + r.borrowed, 0);
    expect(loans, 'no career ever took a loan, so the arm measures nothing').toBeGreaterThan(0);
    expect(
      RUNS_300.reduce((n, r) => n + r.borrowed, 0),
      'the baseline borrowed, so it is not a control',
    ).toBe(0);
  });

  it('says whether borrowing reaches the compounding half', () => {
    const side = (rs: Climb[]) => {
      const compounded = rs.filter((r) => r.bestEstate >= 100_000);
      return {
        n: compounded.length,
        fronts: median(rs.map((r) => r.fronts)),
        estate: Math.round(median(rs.map((r) => r.bestEstate))),
        ended: rs.filter((r) => r.days < HUMAN_DAYS).length,
      };
    };
    const base = side(RUNS_300);
    const fin = side(RUNS_FINANCED);

    // eslint-disable-next-line no-console
    console.log(
      `the front fork: ${RUNS_FINANCED.reduce((n, r) => n + r.borrowed, 0)} loans taken\n` +
        `         careers reaching $100,000:  ${base.n}/${RUNS_300.length} → ${fin.n}/${RUNS_FINANCED.length}\n` +
        `         median fronts held:         ${base.fronts} → ${fin.fronts}\n` +
        `         median best estate:         ${base.estate.toLocaleString('en-US')} → ` +
        `${fin.estate.toLocaleString('en-US')}\n` +
        `         careers that ended early:   ${base.ended} → ${fin.ended}`,
    );

    expect(RUNS_FINANCED.length).toBe(36);
  });
});

describe('a career that uses what the cycle built', () => {
  /*
     The instrument, and for once it is the whole point rather than a guard on
     it: a bot that never manages to spend a favour or turn a dial is exactly
     the F7 state this block exists to leave behind.
  */
  it('actually used them', () => {
    const favours = RUNS_ACTIVE.reduce((n, r) => n + r.newSystems.favoursSpent, 0);
    const dials = RUNS_ACTIVE.reduce((n, r) => n + r.newSystems.dialTurns, 0);

    expect(favours, 'no career ever managed to spend a favour').toBeGreaterThan(0);
    expect(dials, 'no career ever turned the pressure dial').toBeGreaterThan(0);
    expect(
      RUNS_300.reduce((n, r) => n + r.newSystems.favoursSpent + r.newSystems.dialTurns, 0),
      'the baseline population used the new systems, so it is not a control',
    ).toBe(0);
  });

  it('says what using them is worth', () => {
    const cmp = (pick: (r: Climb) => number) =>
      `${Math.round(median(RUNS_300.map(pick)))} → ${Math.round(median(RUNS_ACTIVE.map(pick)))}`;

    // eslint-disable-next-line no-console
    console.log(
      `using them: ${RUNS_ACTIVE.length} careers, ${HUMAN_DAYS} days, same seeds as the baseline\n` +
        `         favours spent: ${RUNS_ACTIVE.reduce((n, r) => n + r.newSystems.favoursSpent, 0)}` +
        `, dial turns: ${RUNS_ACTIVE.reduce((n, r) => n + r.newSystems.dialTurns, 0)}\n` +
        `         weeks the policy asked for each setting: ` +
        (['clean', 'normal', 'hard'] as PressureId[])
          .map((id) => `${id} ${RUNS_ACTIVE.reduce((n, r) => n + r.newSystems.dialWeeks[id], 0)}`)
          .join(', ') +
        `\n         median, baseline → active:\n` +
        `           estate       ${cmp((r) => r.bestEstate)}\n` +
        `           heat-weeks   ${cmp((r) => r.danger.heat)}\n` +
        `           case weight  ${cmp((r) => r.danger.peakCase)}\n` +
        `           laundered    ${cmp((r) => r.wash.laundered)}\n` +
        `           legitimacy   ${cmp((r) => r.newSystems.legitimacy.final)}\n` +
        `           ended early  ${RUNS_300.filter((r) => r.days < HUMAN_DAYS).length} → ` +
        `${RUNS_ACTIVE.filter((r) => r.days < HUMAN_DAYS).length}`,
    );

    expect(RUNS_ACTIVE.length).toBe(36);
  });
});
