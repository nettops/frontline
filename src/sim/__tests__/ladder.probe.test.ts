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
import {
  availableOperations,
  crewNeeded,
  launchOperation,
  operationCost,
  opsBoard,
  standing,
} from '../operations';
import { canOpenScore, liveScores, openScore, scoreOn, setupsLeft } from '../scores';
import { SCORE_TARGETS } from '../../config/scores';
import { OPERATION_BY_ID } from '../../config/operations';
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
import { isLayingLow, startLayLow } from '../heat';
import { fearLevel, maxCrew } from '../player';
import { acquireBusiness, canAcquire, healthPressure, launderCut, launderOutlook } from '../business';
import { BUSINESSES, HEALTH } from '../../config/businesses';
import {
  FEAR,
  PAYDAY_INTERVAL,
  RANKS,
  ROLE_ORDER,
  rankIndex,
} from '../../config/economy';
import { claimStrength, eligibleHeirs, heirOf, nameHeir } from '../succession';
import { CLAIM } from '../../config/succession';
import { estate } from '../estate';
import { TERRITORIES } from '../../config/territories';
import { OPERATIONS, DEFAULT_APPROACH, type ApproachId } from '../../config/operations';
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
import { answerCheaply, ev, idle, mean as meanOf, median, pairedGap } from './helpers';
import { borrow, canBorrow, priced } from '../market';
import { readWhispers } from '../whispers';
import { isGenerated } from '../eventgen';
import { civicRead, spendFavour } from '../civic';
import { careerShape, legitimacy } from '../legacy';
import { CIVIC, CIVIC_FIGURES } from '../../config/civic';
import { POSSESSIONS, POSSESSION_BY_ID } from '../../config/possessions';
import {
  buyPossession,
  canBuyPossession,
  cleanPurse,
  heldPossessions,
  possessionValue,
} from '../possessions';
import { TABLES, TABLE_BY_ID } from '../../config/cards';

/**
 * The rungs the weekly respect distribution is read against.
 *
 * Exists so a threshold on respect can be placed off a plotted distribution
 * rather than off an intuition. This project has now put a bar in the wrong
 * place three times for want of exactly this: `demandRespect` went in at 28
 * against a starting value of 30, and the card room's invitation went in at
 * 55 and turned out to be cleared in 77% of weeks.
 */
const RESPECT_BARS = [25, 55, 85, 120, 150, 180, 220, 260];
import { canSit, seatedAt } from '../cards';
import { ledger, ledgerWeeks } from '../ledger';
import { LEDGER_KEYS } from '../../config/ledger';
import { canRetainLauderer, launderer, laundererTrust, retainLaunderer } from '../launderers';
import { LAUNDERERS } from '../../config/launderers';
import {
  armsSupplier,
  buildPlant,
  canBuildPlant,
  canOpenArmsSupply,
  canOpenSupply,
  openArmsSupply,
  openRoute,
  openSupply,
  plantList,
  readTrade,
  throughput,
  tradeUnlocked,
  unitCost,
} from '../contraband';
import {
  ARMS_SUPPLIERS,
  PLANT,
  SUPPLIERS,
  TRADE_IDS,
} from '../../config/contraband';
import { acceptOrder, liveOrders, orderList, refuseOrder } from '../orders';
import { GANGS } from '../../config/orders';
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
  /**
   * The day each rung of the table first opened, keyed by the old rank ids.
   *
   * Keyed by rank name because every assertion, every printed table and every
   * recorded reading in this file is written in those words, and renaming them
   * would make three years of comments describe a different thing. What is
   * measured is `standing` — the top tier of the job table the board actually
   * opens — which is the same 0..5 scale the ranks sat on and is what those
   * ranks were standing in for all along. Rank itself no longer moves.
   */
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
  /**
   * Where the career finished, as the top tier of the job table it could open.
   *
   * Was `state.player.rank`, which no longer moves — so this read
   * `street_criminal` for all thirty-six and the assertion below became "0 of
   * 36 left the bottom", a true statement about a dead field. Same 0..5 scale,
   * still keyed by the old rank ids so the printed tables read as they always
   * have.
   */
  finalRank: RankId;
  finalCrew: number;
  peakClean: number;
  districtsHeld: number;
  fronts: number;
  /** Which requirement was furthest from being met at the end. */
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
  /**
   * The two trades, and the two things built on top of them.
   *
   * Zero on every arm but `trades`. The baseline bot has never opened a supply
   * or a route in its life — F7's oldest and largest blind spot, and one this
   * project did not know the size of until the plant went in: `ladder.probe`
   * reported that 102 careers of 144 are *offered* an order while none of them
   * had a single unit of stock to fill one with.
   */
  trade: {
    /** The day somebody was first put on the books, and the best they thought of you. */
    bookkeeperDay: number | null;
    bestTrust: number;
    /** The rate the wash actually charged, averaged over the weeks of the career. */
    meanCut: number;
    meanHeat: number;
    heats: number[];
    quietShare: number;
    /** Units carried out of the building by somebody with a warrant. */
    seizedUnits: number;
    raids: number;
    /** The ledger's own account of the career, by category. */
    book: Record<string, number>;
    unaccounted: number;
    /** What the stock cost over the career, and what the payroll took. */
    cogs: number;
    wages: number;
    unitsBought: number;
    /** What the estate is actually made of, at the end. */
    estateParts: { cash: number; holdings: number; fronts: number; total: number };
    /** The four payday states, counted only on weeks a source was open. */
    running: { noFronts: number; nothingToWash: number; dirtyBound: number; capacityBound: number };
    /** Dirty money on hand at the end, and the most ever held at once. */
    dirtyEnd: number;
    dirtyPeak: number;
    productOpenedOn: number | null;
    armsOpenedOn: number | null;
    /** Everything the two trades earned, lifetime. */
    income: number;
    /** Plants standing at the end, and the day the first one opened. */
    plants: number;
    plantOn: number | null;
    /** The game said yes at least once, whether or not the bot took it. */
    couldBuild: boolean;
    /** What the outfit paid for a unit of product, averaged over the weeks it bought. */
    unitCostSum: number;
    unitCostWeeks: number;
    offers: number;
    accepted: number;
    refused: number;
    filled: number;
    failed: number;
    /** Paid for units actually handed over, across every order. */
    orderIncome: number;
    unitsToGangs: number;
    /** The lowest public feeling ever seen in a district a gang was supplied in. */
    worstGangSentiment: number;
  };
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
     * Whether the possessions catalogue is reachable at all.
     *
     * The blueprint's own objection to building it: *"a sink only bites
     * somebody with money, and 30 of 36 careers finish under $100,000.
     * Shipped before the fork moves, this is content for the sixth of players
     * who least need content."* The bot does not buy anything — it is not
     * being asked to — so these are counts of *opportunity*, which is the
     * thing actually in question.
     *
     * Clean cash rather than total funds, because that is the pool the
     * catalogue is priced against: dirty money does not buy a car in your own
     * name, and a reading that counted it would report a door open that is
     * shut.
     */
    /**
     * Whether the card game is a room anybody gets into.
     *
     * Same question the possessions reading asks and the same answer shape:
     * the bot does not gamble, so these count *opportunity*. A weekly game
     * whose bottom table nobody can afford is a panel, and its top table is
     * supposed to be somewhere you are eventually invited rather than
     * somewhere you can go — so the interesting figure is the gap between
     * them.
     */
    tables: {
      /** Weeks each room would have let the player sit, by table id. */
      weeksOpen: Record<string, number>;
      /** Weeks the top table seated somebody who decides things. */
      weeksWorthSitting: number;
      /**
       * The weekly respect distribution, as shares clearing a set of bars.
       *
       * Kept separately from `weeksOpen` because the first version of this
       * reading could not tell the two gates apart: it asserted the top room
       * opens less often than the bottom one, which stayed true with the
       * respect bar set to **zero** — $12,000 is more than $400 and that was
       * all it was measuring. A tier that only bites through its price is not
       * a tier.
       *
       * A ladder of bars rather than one, so the next person to size a respect
       * threshold reads the distribution off the log instead of guessing and
       * discovering it later. `RESPECT_BARS` below is the ladder; the first
       * bar this table produced was 55, which turned out to be cleared in 77%
       * of weeks and was therefore no gate at all.
       */
      respectAtLeast: Record<number, number>;
      weeks: number;
    };
    /** What a bot that builds up to the big jobs did with them. */
    scores: {
      opened: number;
      firstDay: number | null;
      setupsRun: number;
      setupsLanded: number;
      preppedOdds: number[];
      bareOdds: number[];
      preppedCrew: number[];
      bareCrew: number[];
      setupSpend: number;
      /** Pieces of gear in hand on each score that reached the night. */
      prepPerScore: number[];
      prepped: number;
      bare: number;
      expired: number;
      /** What stood in the way on the last day, for each expired score. */
      why: string[];
      /** And over every day each of them stood. */
      whyDays: Record<string, number>[];
      recovered: number;
      weeksNobodyIdle: number;
      /** Weeks too hot to work or dark, on every arm, for the paired read. */
      weeksStopped: number;
      weeks: number;
    };
    /** What a bot that actually shops did with the catalogue. */
    shopping: {
      /** Ids bought, in order. */
      bought: string[];
      /** Day of the first purchase on the upkeep tier. Null means never. */
      firstDay: number | null;
      /** Weeks anything on the upkeep tier was owned. */
      weeksKeeping: number;
      /** Weeks the upkeep could not be met. */
      weeksShort: number;
    };
    ownable: {
      /** Weeks with the cheapest item's price in clean cash. */
      weeksAnyAffordable: number;
      /** Weeks with the cheapest *home* affordable — the personal-life hook. */
      weeksHomeAffordable: number;
      /** First day anything at all was in reach. Null means never. */
      firstDay: number | null;
      /** The dearest catalogue item ever affordable, by price. */
      bestReached: number;
      weeks: number;
    };
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
  /** Jobs launched per era, and days the job loop launched nothing. */
  launchEra: number[];
  deadDays: number;
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
  /**
   * Runs the two trades: an arrangement when one is affordable, and a route in
   * every district that will carry one.
   *
   * The baseline bot does neither, which makes every reading this file has
   * ever taken a reading of a career with no contraband income at all. That is
   * the control, and it stays the control — this is the other arm.
   */
  trades?: boolean;
  /**
   * ...and the two things that sit on top of a running trade: a plant of your
   * own, and orders from other people.
   *
   * Separate from `trades` on purpose. Measuring "plant and orders" against a
   * bot that does not trade at all would report the whole contraband economy
   * as the effect of two features added this week.
   */
  ownSupply?: boolean;
  /**
   * Works the pressure dial for one purpose only: clearing a laundering
   * backlog.
   *
   * Isolated from `active`, which also spends favours and reacts to cases —
   * measuring the ceiling coming off against a bot that does four other new
   * things as well would report all four as this. Every front goes to `hard`
   * on a week where there is more dirty money than the premises will take, and
   * back to `normal` when there is not.
   */
  lean?: boolean;
  /**
   * Puts somebody on the books, and keeps them.
   *
   * `LAUNDER_CUT_BASE` was 24% of every dollar any family ever washed, and the
   * ledger said it took $156,255 out of a trading career and bought nothing.
   * It is what a stranger charges now. This arm measures whether the
   * alternative is worth having — the best rate the family can afford, taken
   * as soon as it can afford it, and never dropped.
   */
  books?: boolean;
  /**
   * Buys the things a boss buys, and keeps paying for them.
   *
   * No bot in this project has ever bought a possession. It banks its clean
   * money and it buys fronts, which is a perfectly sensible way to play and is
   * the only way anything here has ever been measured — so the whole luxury
   * tier is invisible to every bar in this file.
   *
   * That matters more than usual for this feature, because the surplus it
   * exists to absorb peaks on **day 294 of 300**. A catalogue only bought in
   * the last fortnight has taken the money without ever having been a
   * decision, and no instrument that does not shop can tell the difference.
   */
  shops?: boolean;
  /**
   * Builds up to the big jobs instead of walking straight at them.
   *
   * F7 in full, and the precedent is direct. The money-sink tier shipped with
   * a shopping arm in the same pass and the first pricing was wrong in a way
   * only that arm could show — the yacht was bought zero times in thirty-six
   * careers. No bot in this project opens a score, so without this every bar
   * in this file would keep reporting confidently about a game with a feature
   * in it that nothing ever touches.
   *
   * The policy is what a patient player does: put somebody on a target the
   * moment one is on the board, run every setup it allows, and hold the job
   * itself back until the kit is together or the window is nearly out.
   */
  scores?: boolean;
}

function climb(seed: number, days: number, policy: Policy = {}): Climb {
  const state = newGame({ name: 'Ladder', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  const reachedOn = new Map<string, number>();
  const shopping = {
    bought: [] as string[],
    firstDay: null as number | null,
    weeksKeeping: 0,
    weeksShort: 0,
  };
  /**
   * The last thing standing between an open score and its night, and a tally
   * of it over every day the score stood.
   *
   * Here because "a third of windows expire" is a number with at least six
   * different meanings, two of which are defects and four of which are the
   * feature working. Sampled after the day rather than at expiry, because by
   * the time a score is expired the state that shut it has moved on.
   */
  const blocked = new Map<string, string>();
  const blockDays = new Map<string, Record<string, number>>();
  /** Gear that ever reached a kit, and gear the police ever came away with. */
  const landed = new Set<string>();
  const recovered = new Set<string>();
  const scoring = {
    opened: 0,
    firstDay: null as number | null,
    /** Setups launched, and how many of those came off. */
    setupsRun: 0,
    setupsLanded: 0,
    /** Setups run against each score that reached the night, for the spread. */
    prepPerScore: [] as number[],
    /** Targets run with a score behind them, and run bare. */
    prepped: 0,
    bare: 0,
    expired: 0,
    /** Traces the disposal phase wrote. */
    recovered: 0,
    /** Weeks the family had nobody spare at all, which is the §4.2 risk. */
    weeksNobodyIdle: 0,
    weeksStopped: 0,
    weeks: 0,
    /*
       The direct reading, which the estate gap cannot give.

       A paired estate is a whole career and everything in it; whether a month
       of planning actually bought anything is a question about one night. Odds
       and bodies are snapshotted at launch on target jobs only, prepared
       against bare, so the two columns are the same jobs done two ways.
    */
    preppedOdds: [] as number[],
    bareOdds: [] as number[],
    preppedCrew: [] as number[],
    bareCrew: [] as number[],
    /** What the groundwork cost, in this year's money. */
    setupSpend: 0,
  };
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
  /**
   * Jobs launched before day 90, 90-179, and after — and days the job loop was
   * entered and came out having launched nothing.
   *
   * Here because this bot spent years standing still without anybody noticing.
   * A probe that does not work is not a slow probe, it is a probe measuring a
   * different game, and no other reading in this file could see it: every bar
   * was a statement about a family that happened to be idle on two days in
   * five and got quieter the better the board got.
   */
  const launchEra = [0, 0, 0];
  let deadDays = 0;
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
    tableWeeks: Object.fromEntries(TABLES.map((t) => [t.id, 0])) as Record<string, number>,
    worthSitting: 0,
    respectAtLeast: Object.fromEntries(RESPECT_BARS.map((b) => [b, 0])) as Record<number, number>,
    ownWeeks: 0,
    ownHomeWeeks: 0,
    ownFirstDay: null as number | null,
    ownBest: 0,
    dialTurns: 0,
    dialWeeks: { clean: 0, normal: 0, hard: 0 } as Record<PressureId, number>,
  };
  const trade = {
    dirtyEnd: 0,
    dirtyPeak: 0,
    /* What the stock cost, and what the payroll took, over the career. */
    cogs: 0,
    seizedUnits: 0,
    raids: 0,
    wages: 0,
    /* Who kept the books, how long, and what they came to think of you. */
    bookkeeperDay: null as number | null,
    bestTrust: 0,
    cutSum: 0,
    cutWeeks: 0,
    heatSum: 0,
    heatUnder60: 0,
    heats: [] as number[],
    unitsBought: 0,
    /*
       The same four payday states, counted only while a source was open.

       Necessary because the whole-career figures cannot separate "the machine
       was idle" from "the trade had not started yet": the median arrangement
       opens on day 91 of 300, so roughly a third of every trading career is a
       career with nothing to wash for reasons that have nothing to do with
       capacity.
    */
    running: { noFronts: 0, nothingToWash: 0, dirtyBound: 0, capacityBound: 0 },
    productOpenedOn: null as number | null,
    armsOpenedOn: null as number | null,
    plantOn: null as number | null,
    couldBuild: false,
    unitCostSum: 0,
    unitCostWeeks: 0,
    refused: 0,
    unitsToGangs: 0,
    worstGangSentiment: 100,
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

  reachedOn.set(RANKS[standing(state)].id, 0);

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
      /*
         How many people the outfit can actually hold.

         This read `RANKS[rankIndex(player.rank)].maxCrew`, and `player.rank`
         is pinned at the first rung — so `room` was 3 for every career, the
         `held < room` guard below was false from the first week, and none of
         the hiring diagnostics under it were ever collected.
      */
      /*
         §4.2. The bill for a score is a body, and the measured cause of a dead
         week in this game is a shortage of people. Counted on every arm, so
         the baseline says what the shortage was before scores existed.
      */
      scoring.weeks += 1;
      if (idle(state).length === 0) scoring.weeksNobodyIdle += 1;
      // Counted on every arm, so the scores arm can be read against the same
      // bot that never prepares anything.
      if (state.org.heat >= 70 || isLayingLow(state)) scoring.weeksStopped += 1;

      const room = maxCrew(state);
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

    /*
       The counterplay against heat, which no bot in this project has ever had.

       F7, and it was hiding behind a defect. This block used to open
       `if (!isLayingLow(state) && state.org.heat < 70)` — so at 70 the bot
       simply stopped, which is the worst available answer: it loses the
       income *and* does not get the accelerated decay. Round 13's loudest
       complaint was that the punishment for heat is 14 days of pressing +1
       week, and this bot was doing exactly that on purpose.

       The game's actual answer is `startLayLow`: street heat comes off four
       times faster, and since round 13 quiet work still moves while dark.
       Nothing in this project had ever exercised either half.

       So the same 70 the bot already used as its line now triggers the cure
       rather than a wait. No new threshold is invented here — the number was
       already this bot's, it was just being spent on standing still.

       **And while dark it stops, which the first version of this got wrong.**
       Quiet work does still move while laying low, so the obvious rule was to
       keep earning on it. Measured, that took mean heat from 65 to **98.9**:
       `addHeat` resets `quietDays`, so a family that runs one quiet job a day
       while dark pays the respect for going quiet and never cools at all.
       `canLaunch` says so directly — a job launched while dark still costs
       that day's decay, and that is what keeps quiet work a decision rather
       than a free lunch. The bot was taking the lunch.
    */
    if (!isLayingLow(state) && state.org.heat >= 70) startLayLow(state);
    const how: ApproachId = DEFAULT_APPROACH;

    if (!isLayingLow(state)) {
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
      /*
         What the next rung of the *table* asks for, now that no rank asks for
         anything.

         This read `RANKS[rankIndex(player.rank) + 1].requires.territories`, and
         the note above records how much damage that constant did while it was
         a bare 2. It is the same failure in a slower form: the bot expands to
         whatever the progression demands, so the moment the progression stopped
         being the rank table it stopped expanding at all — one district and two
         fronts at day 300, against 25 crew and a $483,000 estate before. A bot
         playing to a rule the game no longer has is not a careful player, it is
         a broken instrument, and every pacing reading taken through it would
         have been a reading of the deleted ladder.

         So it reads the gates. `districtsControlled` on the lowest job the
         board has not opened yet is exactly "how much ground does the next
         thing I want need", which is what the number always meant and is now
         on the locked row for a player to read too.
      */
      const board = opsBoard(state);
      const wanted = OPERATIONS.filter((o) => o.opens && !o.opens.met(board))
        .sort((a, b) => a.tier - b.tier)
        .reduce<number>((need, op) => {
          if (need > 0) return need;
          // How much ground would open it, found by asking rather than by
          // parsing the clause: raise the count until the gate gives way.
          for (let n = board.districtsControlled + 1; n <= TERRITORIES.length; n++) {
            if (op.opens!.met({ ...board, districtsControlled: n, districtsHeld: Math.max(board.districtsHeld, n) })) {
              return n;
            }
          }
          return 0;
        }, 0);
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
        /*
           Build up to it, when the policy says to.

           Three separate moves, and they are deliberately in this order: put
           somebody on a target that is on the board, get whatever that target
           allows, and only then decide whether to move. The third is the one
           that matters — without it the jobs loop below would open a score and
           run the job the same afternoon, which is a bot with the feature
           switched on that never uses any of it.
        */
        if (policy.scores) {
          for (const target of availableOperations(state)) {
            if (!SCORE_TARGETS[target.id]) continue;
            /*
               Only against a job it could actually run.

               The first version put somebody on every target on the board, and
               39% of scores expired — a man held for a month against a job the
               family was never going to be able to stake. That is a bot
               wasting people, not the window being too short, and measuring
               the feature through it would have priced the window against a
               policy no player would follow.
            */
            if (operationCost(state, target) > spendable) continue;
            /*
               And only against a job it could staff.

               A third of the first version's scores expired, and the men held
               against them were the same men the target itself needed. Holding
               somebody for a month to prepare a job you cannot put a crew on
               is the purest form of the §4.2 risk, and no player would do it.
            */
            if (idle(state).length <= crewNeeded(state, target)) continue;
            if (!canOpenScore(state, target.id).ok) continue;
            const man = idle(state)[0];
            if (!man) break;
            if (openScore(state, target.id, where, man.id)) {
              scoring.opened += 1;
              if (scoring.firstDay === null) scoring.firstDay = state.day;
            }
          }
          for (const sc of liveScores(state)) {
            if (sc.status !== 'open') continue;
            for (const setup of setupsLeft(state, sc)) {
              const hands = idle(state);
              if (hands.length < setup.crewRequired) break;
              if (operationCost(state, setup) > spendable) continue;
              const out = clean('jobs', () =>
                launchOperation(
                  state,
                  setup.id,
                  hands.slice(0, setup.crewRequired).map((n) => n.id),
                  sc.territoryId,
                  how,
                  sc.id,
                ),
              );
              if (out) {
                scoring.setupsRun += 1;
                scoring.setupSpend += out.investment;
              }
            }
          }
        }

        const launchedBefore = launchEra[0] + launchEra[1] + launchEra[2];
        const options = availableOperations(state)
          .filter((o) => operationCost(state, o) <= spendable)
          /*
             Hold a target back while its score is still being built.

             `dueDay - 3` rather than the due day itself, because the job takes
             days of its own and a window that shuts while the crew are out is
             the same as never having opened it. Three is the shortest setup in
             the table, so this waits for anything that could still land and
             for nothing that could not.
          */
          .filter((o) => {
            if (!policy.scores) return true;
            const sc = scoreOn(state, o.id);
            if (!sc) return true;
            if (state.day >= sc.dueDay - 3) return true;
            /*
               Nothing left to get *and* nothing still out.

               `setupsLeft` excludes setups that are currently running, so on
               its own it reads "everything is out" as "everything is done" —
               and the bot duly ran 143 jobs with an empty kit while the gear
               for them was three days from arriving. A prepared job that goes
               in bare is the most expensive way to play this.
            */
            const out = Object.values(state.activeOperations).some((op) => op.scoreId === sc.id);
            return setupsLeft(state, sc).length === 0 && !out;
          })
          .sort((a, b) => ev(b) - ev(a));
        for (const def of options) {
          const bodies = crewNeeded(state, def);
          /*
             `continue`, and it was a `break` for years.

             `options` is sorted by expected value, not by how many bodies a
             job needs, so one body-hungry job at the top of the list stopped
             every cheaper job below it from being considered at all. A day
             where the best job wanted twelve and the family had six was a day
             the bot did nothing, while a four-man job it could have run sat
             two rows down.

             Found while diagnosing why score windows expire: on 533 days a
             ready, fully staffable score target sat further down this list
             when the loop broke out — 77% of the days a window was open, ready
             and unused. The line two below it has always been a `continue` for
             exactly this reason, about money.

             The re-baseline this caused is recorded at the bars that moved.
          */
          if (idle(state).length < bodies) continue;
          // The game refuses a second solo job now, so the bot does not have
          // to. Kept as a comment because the line that used to be here was a
          // workaround for a real defect nobody had noticed.
          if (operationCost(state, def) > spendable) continue;
          const sc = policy.scores ? scoreOn(state, def.id) : undefined;
          const out = clean('jobs', () =>
            launchOperation(
              state,
              def.id,
              idle(state)
                .slice(0, bodies)
                .map((n) => n.id),
              // A prepared job runs where it was prepared. Anywhere else and
              // the gear was got ready for somewhere the crew never went.
              sc ? sc.territoryId : where,
              how,
            ),
          );
          if (out) launchEra[state.day < 90 ? 0 : state.day < 180 ? 1 : 2] += 1;
          if (out && policy.scores && SCORE_TARGETS[def.id]) {
            if (sc) {
              scoring.prepped += 1;
              scoring.prepPerScore.push(sc.kit.length);
              scoring.preppedOdds.push(out.successChance);
              scoring.preppedCrew.push(out.crewIds.length);
            } else {
              scoring.bare += 1;
              scoring.bareOdds.push(out.successChance);
              scoring.bareCrew.push(out.crewIds.length);
            }
          }
        }
        if (launchEra[0] + launchEra[1] + launchEra[2] === launchedBefore) deadDays += 1;
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

      /*
         And what a boss spends it on, if he spends it on anything.

         Two rules, and both were wrong in the first draft.

         **He keeps a quarter of the new bill back, not half a year.** The same
         twelve weeks the liquidity buffer above already uses, because a boss
         reasoning about whether he can run a boat is reasoning on the horizon
         he already reasons on. Half a year put the yacht's bar at $817,000,
         which the measured purse curve says six careers in thirty-six reach by
         day 200.

         **And he works up the catalogue rather than splurging.** This took the
         dearest affordable row, which meant the cheap things were never bought
         at all and the one row that *does* something lost to an ornament on a
         technicality — the foundation's heavier upkeep made it qualify later
         than a country club costing more. Cheapest first buys in price order,
         so the entry-level thing is owned longest, which is what "lived with"
         means.

         One purchase a week either way. Nobody buys a boat and a country club
         on the same Friday.
      */
      if (policy.shops) {
        const keeping = heldPossessions(state);
        const owned = new Set(keeping.map((h) => h.defId));
        if (keeping.some((h) => POSSESSION_BY_ID[h.defId]?.upkeep)) shopping.weeksKeeping += 1;

        const affordable = POSSESSIONS.filter((d) => d.upkeep && !owned.has(d.id))
          .map((d) => ({ def: d, price: possessionValue(state, d) }))
          .filter(
            (o) =>
              cleanPurse(state) - o.price >= liquid + priced(state, o.def.upkeep!) * 12 &&
              canBuyPossession(state, o.def.id).ok,
          )
          .sort((a, b) => a.price - b.price);

        if (affordable.length > 0) {
          const pick = affordable[0].def;
          if (buyPossession(state, rng, pick.id).ok) {
            shopping.bought.push(pick.id);
            if (shopping.firstDay === null) shopping.firstDay = state.day;
          }
        }
      }

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

      /*
         The cost of goods, which no instrument in this project had ever added
         up.

         `lifetime` is gross sales revenue. The trade buys before it sells, out
         of the same pocket, so "the trade earned $1.6M" and "the family is
         $1.6M better off" are not the same sentence and nothing had ever
         measured the gap.
      */
      trade.wages += weeklyWageBill(state);
      trade.cutSum += launderCut(state);
      trade.cutWeeks += 1;
      trade.heatSum += state.org.heat;
      trade.heats.push(state.org.heat);
      if (state.org.heat < 60) trade.heatUnder60 += 1;
      const books = launderer(state);
      if (books) {
        if (trade.bookkeeperDay === null) trade.bookkeeperDay = state.day;
        trade.bestTrust = Math.max(trade.bestTrust, laundererTrust(state, books.id));
      }
      for (const id of TRADE_IDS) {
        const bought = state.contraband.lastRun?.[id].bought ?? 0;
        const seized = state.contraband.lastRun?.[id].seized ?? 0;
        if (seized > 0) {
          trade.seizedUnits += seized;
          trade.raids += 1;
        }
        if (bought <= 0) continue;
        trade.unitsBought += bought;
        trade.cogs += bought * unitCost(state, id);
      }

      /*
         What a unit actually cost, and what the neighbourhood made of it.

         Sampled weekly and only while something was being bought, because
         `unitCost` returns the trade's own base figure when there is no source
         at all — averaging that in would report a career with no arrangement
         as paying the cheapest price in the game.
      */
      if (policy.trades && state.contraband.routes.product.length > 0) {
        const sources = state.contraband.supplierId || plantList(state).length > 0;
        if (sources) {
          trade.unitCostSum += unitCost(state, 'product');
          trade.unitCostWeeks += 1;
        }
      }
      for (const gang of GANGS) {
        const supplied = (state.orders ?? []).some(
          (o) => o.buyerId === gang.id && o.delivered > 0,
        );
        if (!supplied) continue;
        const where = state.territories[gang.territoryId];
        if (where) trade.worstGangSentiment = Math.min(trade.worstGangSentiment, where.sentiment);
      }

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
         And whether the boss could have owned anything this week.

         `possessionValue` derives — it is `priced()` and nothing else — so
         this stays inside the no-rolling rule the whole block is held to.
      */
      const clean = state.org.cash;
      let bestNow = 0;
      let homeNow = false;
      for (const def of POSSESSIONS) {
        if (possessionValue(state, def) > clean) continue;
        bestNow = Math.max(bestNow, def.cost);
        if (def.kind === 'home') homeNow = true;
      }
      if (bestNow > 0) {
        newSys.ownWeeks += 1;
        newSys.ownBest = Math.max(newSys.ownBest, bestNow);
        if (newSys.ownFirstDay === null) newSys.ownFirstDay = state.day;
      }
      if (homeNow) newSys.ownHomeWeeks += 1;

      /*
         And the card game. `canSit` and `seatedAt` both derive — `seatedAt`
         is `stableNoise` by construction — so this stays inside the
         no-rolling rule the whole block is held to.
      */
      for (const t of TABLES) {
        if (canSit(state, t.id).ok) newSys.tableWeeks[t.id] += 1;
      }
      if (seatedAt(state, 'upstairs').kind !== 'nobody') newSys.worthSitting += 1;
      for (const bar of RESPECT_BARS) {
        if (state.org.respect >= bar) newSys.respectAtLeast[bar] += 1;
      }

      /*
         And the half that actually plays them.

         Competent, not optimal — the same standard as the rest of this bot. It
         calls a favour in when there is something for it to do, and when the
         stock is at its cap, because a favour that accrues past `maxOwed` is a
         favour thrown away. It does not hoard for a rainy day and it does not
         plan; it answers the week in front of it.
      */
      /*
         The trades, which the baseline bot has never touched.

         Competent, not optimal, the same standard as everything else here: it
         opens the cheapest arrangement it can pay for, runs a route wherever
         one will run, and does not agonise. It does not time the market, hold
         stock back, or pick a supplier on exposure.
      */
      if (policy.trades) {
        for (const id of TRADE_IDS) {
          if (!tradeUnlocked(state, id)) continue;
          for (const t of readTrade(state, id).eligible) {
            if (!state.contraband.routes[id].includes(t.id)) openRoute(state, id, t.id);
          }
        }
        if (tradeUnlocked(state, 'product') && !state.contraband.supplierId) {
          for (const def of [...SUPPLIERS].sort((a, b) => a.retainer - b.retainer)) {
            if (!canOpenSupply(state, def.id).ok) continue;
            openSupply(state, def.id);
            if (trade.productOpenedOn === null) trade.productOpenedOn = state.day;
            break;
          }
        }
        if (tradeUnlocked(state, 'arms') && !armsSupplier(state)) {
          for (const def of [...ARMS_SUPPLIERS].sort((a, b) => a.retainer - b.retainer)) {
            if (!canOpenArmsSupply(state, def.id).ok) continue;
            openArmsSupply(state, def.id);
            if (trade.armsOpenedOn === null) trade.armsOpenedOn = state.day;
            break;
          }
        }
      }

      /*
         A plant, and orders.

         The plant is bought with a reserve rather than with the last dollar —
         $250,000 spent down to nothing is not a decision a competent player
         makes, and a bot that does it would report the plant as a bankruptcy
         engine. Half as much again is the same margin the front-buying policy
         above keeps.

         Orders are accepted when the trade can plausibly cover them and
         refused when it cannot, because the decision this feature exists to
         put in front of a player *is* which ones to take. A bot that accepts
         everything measures nothing except how often an indiscriminate player
         fails, which is a question with a known answer.
      */
      if (policy.ownSupply) {
        if (plantList(state).length === 0) {
          for (const t of controlledTerritories(state)) {
            if (!canBuildPlant(state, t.id).ok) continue;
            trade.couldBuild = true;
            if (totalFunds(state) < priced(state, PLANT.cost) * 1.5) break;
            if (buildPlant(state, t.id).ok && trade.plantOn === null) trade.plantOn = state.day;
            break;
          }
        }
        for (const order of liveOrders(state)) {
          if (order.status !== 'offered') continue;
          const weeks = Math.max(1, (order.dueDay - state.day) / 7);
          const couldMove = throughput(state, order.trade).total * weeks;
          // Half the projected flow, because the street wants the other half
          // and an order that starves it is not a good trade.
          if (couldMove * 0.5 >= order.units) acceptOrder(state, order.id);
          else {
            refuseOrder(state, order.id);
            trade.refused += 1;
          }
        }
      }

      /*
         The dial, on the one question the wall used to answer for you.

         `hard` is the only setting where laundering has no ceiling, so this is
         a player looking at a backlog and deciding to push it through rather
         than watch it sit. Reverting to `normal` the moment the backlog clears
         matters: leaving everything on `hard` for a whole career would measure
         the dial's exposure and wear terms rather than the ceiling coming off.
      */
      /*
         The best terms the family can pay for, taken the day it can pay for
         them and kept from then on.

         Best first rather than cheapest first, because the whole design is
         that the dear one pays for itself over time — a bot that grabbed the
         $45,000 bookkeeper on day 30 and never revisited it would measure the
         cheapest tier and report it as the feature. Switching costs the new
         retainer and resets the relationship to nothing, which is exactly the
         trade a player weighs, so it only moves when it can afford to.
      */
      if (policy.books) {
        const held = launderer(state);
        for (const def of [...LAUNDERERS].sort((a, b) => a.bestCut - b.bestCut)) {
          if (held && held.bestCut <= def.bestCut) break;
          if (!canRetainLauderer(state, def.id).ok) continue;
          /*
             Not with the last dollar. A retainer is priced off *peak* funds,
             and a peak is a moment — the first version of this arm let the bot
             spend its high-water mark on a firm downtown and then had nothing
             left to buy stock with, which read as the feature costing the
             family $850,000 of trade income. Same reserve the front-buying and
             plant-building policies keep.
          */
          if (totalFunds(state) < priced(state, def.retainer) * 1.5) continue;
          retainLaunderer(state, def.id);
          break;
        }
      }

      if (policy.lean) {
        const outlook = launderOutlook(state);
        const backedUp = outlook.heldBack + outlook.capacity < state.org.dirtyCash;
        const want: PressureId = backedUp ? 'hard' : 'normal';
        for (const b of ownedBusinesses(state)) {
          if ((b.pressure ?? 'normal') !== want) b.pressure = want;
        }
      }

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
    /*
       Sampled after the day rather than at the end of the run, because both
       readings are destroyed by the thing that produces them: `closeScore`
       empties the kit, and a disposal trace goes stale and is deleted like any
       other. Counted into sets so a piece of gear held for a fortnight is one
       reading rather than fourteen.
    */
    if (policy.scores) {
      for (const sc of state.scores ?? []) {
        for (const gear of sc.kit) landed.add(`${sc.id}:${gear}`);
      }
      for (const sc of state.scores ?? []) {
        if (sc.status !== 'open') continue;
        const target = OPERATION_BY_ID[sc.defId];
        const out = Object.values(state.activeOperations).some((op) => op.scoreId === sc.id);
        const capacity = launderOutlook(state).capacity;
        const spendableNow = Math.min(
          Math.max(0, state.org.dirtyCash - capacity * WASH_RESERVE) + state.org.cash,
          totalFunds(state) * 0.5,
        );
        const why = isLayingLow(state)
          ? 'laying low'
          : state.org.heat >= 70
            ? 'too hot to work'
            : !availableOperations(state).some((o) => o.id === sc.defId)
              ? 'came off the board'
              : out || setupsLeft(state, sc).length > 0
                ? 'still preparing'
                : operationCost(state, target) > spendableNow
                  ? 'could not stake it'
                  : idle(state).length < crewNeeded(state, target)
                    ? 'nobody to send'
                    : 'ready, not picked';
        blocked.set(sc.id, why);
        const tally = blockDays.get(sc.id) ?? {};
        tally[why] = (tally[why] ?? 0) + 1;
        blockDays.set(sc.id, tally);
      }
      for (const trace of Object.values(state.evidence)) {
        if (trace.source === 'disposal') recovered.add(trace.id);
      }
    }
    trade.dirtyPeak = Math.max(trade.dirtyPeak, state.org.dirtyCash);
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
      const sourced =
        state.contraband.supplierId !== null ||
        state.contraband.armsSupplierId != null ||
        plantList(state).length > 0 ||
        state.contraband.workshops.length > 0;
      if (!r || r.capacity === undefined || r.washable === undefined) {
        wash.noFronts++;
        if (sourced) trade.running.noFronts++;
      } else {
        wash.laundered += r.laundered;
        wash.cut += r.cut;
        wash.revenue += r.revenue;
        wash.capacity += r.capacity;
        const state_ =
          r.washable <= 0 ? 'nothingToWash' : r.laundered >= r.capacity ? 'capacityBound' : 'dirtyBound';
        wash[state_]++;
        if (sourced) trade.running[state_]++;
      }
    }
    // Gross clean income against the peak balance, to separate "never earned
    // it" from "earned it and spent it" — and the same day's outgoings, which
    // are everything the week takes without being asked: wages once dirty is
    // gone, loan payments, tribute, and whatever the city does to you.
    if (state.org.cash > cleanBefore) wash.cleanIn += state.org.cash - cleanBefore;
    else wash.cleanOut.upkeep += cleanBefore - state.org.cash;
    /*
       Every rung the board opened today, not only the top one — `standing` can
       jump two tiers in a week when a district falls, and a rung skipped over
       is still a rung reached.
    */
    for (let t = 0; t <= standing(state); t++) {
      if (!reachedOn.has(RANKS[t].id)) reachedOn.set(RANKS[t].id, state.day);
    }
    if (state.gameOver) break;
  }

  /*
     `blockedBy` was computed here and it is gone.

     It scored the career against `RANKS[next].requires` — respect, crew, clean
     money, operations, districts — and reported whichever share was smallest
     as "the furthest requirement at the end". That table gated promotion,
     promotion has not existed since the ladder came out, and `player.rank` is
     pinned, so `next` was always Enforcer and the answer was always a distance
     to a gate that opens nothing.

     The line it printed was quoted twice in the conversation that removed it,
     both times as evidence for a design decision. Neither claim survived.

     What a career is actually short of is already printed: `standing()` says
     which job tiers the board opens, and the `opens` clauses say what each
     locked one wants. If a single label is wanted again it has to be built
     from those.
  */

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
    trade: {
      estateParts: (() => {
        const e = estate(state);
        return {
          cash: Math.round(e.cash),
          holdings: Math.round(e.holdings),
          fronts: Math.round(e.fronts),
          total: Math.round(e.total),
        };
      })(),
      bookkeeperDay: trade.bookkeeperDay,
      bestTrust: Math.round(trade.bestTrust),
      meanCut: trade.cutWeeks > 0 ? trade.cutSum / trade.cutWeeks : 0,
      meanHeat: trade.cutWeeks > 0 ? trade.heatSum / trade.cutWeeks : 0,
      heats: trade.heats.slice(),
      quietShare: trade.cutWeeks > 0 ? trade.heatUnder60 / trade.cutWeeks : 0,
      seizedUnits: Math.round(trade.seizedUnits),
      raids: trade.raids,
      book: Object.fromEntries(
        LEDGER_KEYS.map((k) => [k, Math.round(ledger(state).lifetime[k])]),
      ) as Record<string, number>,
      unaccounted: Math.round(ledgerWeeks(state).reduce((n, w) => n + w.unaccounted, 0)),
      cogs: Math.round(trade.cogs),
      wages: Math.round(trade.wages),
      unitsBought: Math.round(trade.unitsBought),
      running: { ...trade.running },
      dirtyEnd: Math.max(0, Math.floor(state.org.dirtyCash)),
      dirtyPeak: Math.max(0, Math.floor(trade.dirtyPeak)),
      productOpenedOn: trade.productOpenedOn,
      armsOpenedOn: trade.armsOpenedOn,
      income: state.contraband.lifetime.product + state.contraband.lifetime.arms,
      plants: plantList(state).length,
      plantOn: trade.plantOn,
      couldBuild: trade.couldBuild,
      unitCostSum: trade.unitCostSum,
      unitCostWeeks: trade.unitCostWeeks,
      offers: orderList(state).length,
      accepted: orderList(state).filter((o) => o.acceptedDay != null).length,
      refused: trade.refused,
      filled: orderList(state).filter((o) => o.status === 'filled').length,
      failed: orderList(state).filter((o) => o.status === 'failed').length,
      orderIncome: orderList(state).reduce((sum, o) => sum + o.delivered * o.unitPrice, 0),
      unitsToGangs: orderList(state)
        .filter((o) => o.buyerKind === 'gang')
        .reduce((sum, o) => sum + o.delivered, 0),
      worstGangSentiment: trade.worstGangSentiment,
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
      tables: {
        weeksOpen: newSys.tableWeeks,
        weeksWorthSitting: newSys.worthSitting,
        respectAtLeast: newSys.respectAtLeast,
        weeks: newSys.weeks,
      },
      shopping,
      scores: {
        ...scoring,
        setupsLanded: landed.size,
        recovered: recovered.size,
        expired: (state.scores ?? []).filter((sc) => sc.status === 'expired').length,
        why: (state.scores ?? [])
          .filter((sc) => sc.status === 'expired')
          .map((sc) => blocked.get(sc.id) ?? 'never sampled'),
        whyDays: (state.scores ?? [])
          .filter((sc) => sc.status === 'expired')
          .map((sc) => blockDays.get(sc.id) ?? {}),
      },
      ownable: {
        weeksAnyAffordable: newSys.ownWeeks,
        weeksHomeAffordable: newSys.ownHomeWeeks,
        firstDay: newSys.ownFirstDay,
        bestReached: newSys.ownBest,
        weeks: newSys.weeks,
      },
      favoursSpent: newSys.favoursSpent,
      dialTurns: newSys.dialTurns,
      dialWeeks: newSys.dialWeeks,
    },
    launchEra,
    deadDays,
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
    finalRank: RANKS[standing(state)].id,
    finalCrew: crewList(state).filter((n) => n.status !== 'dead').length,
    peakClean,
    districtsHeld: territoryList(state).filter((t) => playerInfluence(t) >= 25).length,
    fronts: Object.keys(state.businesses).length,
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
            `balance of $${median(RUNS.map((r) => r.peakClean)).toLocaleString('en-US')}` +
            /*
               A block reporting 'careers that ever met each Capo line' stood
               here, scoring the population against `RANK_BY_ID.capo.requires`.
               Those five numbers gated a promotion that has not existed since
               the ladder came out, so it counted careers past a post nothing
               stands behind. The influence and crew figures below were the
               part worth keeping and are unchanged.
            */
            `
         influence, which Control needs 50 of: highest any district ` +
            `reached ${Math.round(median(RUNS.map((r) => r.influence.peak)))} (median career), ` +
            `best of all ${Math.round(Math.max(...RUNS.map((r) => r.influence.peak)))}` +
            `
         districts a career ever got to each band: presence ` +
            `${median(RUNS.map((r) => r.influence.everPresence))}, foothold ` +
            `${median(RUNS.map((r) => r.influence.everFoothold))}, control ` +
            `${median(RUNS.map((r) => r.influence.everControl))} (of 12)` +
            `
         mean influence where the family was working at all: ` +
            `${(RUNS.reduce((n, r) => n + r.influence.meanWhereWorking, 0) / RUNS.length).toFixed(1)}` +
            `
         best crew ever held: median ${median(RUNS.map((r) => r.bestCrew))}, ` +
            `highest ${Math.max(...RUNS.map((r) => r.bestCrew))}` +
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
    const lived = RUNS_300.filter((r) => r.days >= 240);
    const late = lived.map((r) => r.memos.lateAndNew);
    const mid = median(late);

    const fromGenerator = lived.reduce((n, r) => n + r.memos.lateGenerated, 0);
    const allLate = lived.reduce((n, r) => n + r.memos.lateAndNew, 0);

    // eslint-disable-next-line no-console
    console.log(
      `memos: ${lived.length}/${RUNS_300.length} careers reached day 240\n` +
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

       **Red again since the bot was fixed, at 32%.** It read 34% against a bot
       that stood still on two days in five, which is the same claim measured
       against a career with less of everything in it: a family that works
       meets more authored situations early, so the authored pool supplies more
       of the late ones too. The shortfall is unchanged in kind — six generated
       shapes against twenty-two authored ones — and so is the bar.
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
        `(nobody reads this any more — see the alderman's note in config/civic.ts)
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
    /*
       **Two of the four are red since the bot was fixed, in opposite
       directions, and that is this bar working.**

       With the bot idle on two days in five: captain 25, union 29, judge 20,
       alderman 14 — all four inside. A family that actually works reads
       captain 24, union 36, judge 16, alderman 0.

       The union owes every career whatever they do, which makes it a fixture
       rather than a relationship. The alderman owed nobody: he read mean
       sentiment across worked districts, working a district costs sentiment,
       and that figure fell from 44 to 35 the moment the bot stopped standing
       still — so his favour was the one thing in this game that got further
       away the more you played.

       **The alderman is fixed and reads 13/36.** He watches legitimate
       business standing in ground that does not resent you, which is a
       quantity with spread in it and one a player builds; the note in
       `config/civic.ts` carries the plot. The union is still open, and its bar
       does not move — the comment above says so and it said so before either
       of them went red.
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

       **Red since the bot was fixed, and it cannot be fixed here.** With the
       bot idle on two days in five this read kingpin 12, don 10, diplomat 8,
       unremarkable 4, financier 2 — a spread. A family that actually works
       reads kingpin 35 of 36, because `kingpinDistricts` is 4 and the district
       count has collapsed to a point mass: 35 careers hold exactly 4 and one
       holds 3. No value of that bar separates anybody — 4 names everyone, 5
       names nobody.

       So this is not a bar to re-plot. It is `SHAPE_BARS.kingpinDistricts`
       reading a quantity that no longer varies across careers, and the fix is
       to give the Kingpin something with spread in it to read. Recorded in
       `config/legacy.ts` beside the bar.
    */
    /*
       What the Kingpin bar is actually reading, printed because it turned out
       to have no spread at all. See the note under the assertion.
    */
    const d = RUNS_300.map((r) => r.bestDistricts).sort((a, b) => a - b);
    const hist = new Map<number, number>();
    for (const n of d) hist.set(n, (hist.get(n) ?? 0) + 1);
    // eslint-disable-next-line no-console
    console.log(
      `         districts held at day 300 — ` +
        [...hist].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}: ${n}`).join(', ') +
        ` · 40th/median/75th/90th ${pct(d, 0.4)} / ${median(d)} / ${pct(d, 0.75)} / ${pct(d, 0.9)}`,
    );
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

/*
   The contraband arm, in two halves, and why there are two.

   The baseline bot has never opened an arrangement or a route. Every reading
   this file has ever taken is therefore a reading of a career with no
   contraband income at all — the largest F7 blind spot in the project, and one
   nobody had put a number on until the plant went in and `ladder.probe`
   reported that 102 careers of 144 are *offered* an order while not one of them
   held a single unit of stock.

   RUNS_TRADING runs the two trades as they have always existed. RUNS_OWNED runs
   the same bot plus the two things built on top of them. Splitting it is the
   whole point: measured against a bot that does not trade, "plant and orders"
   would report the entire contraband economy as the effect of two features
   added in one afternoon.
*/
const RUNS_TRADING = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { trades: true }),
);
const RUNS_OWNED = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { trades: true, ownSupply: true }),
);

/*
   The third arm: the same trading bot, willing to lean on its premises.

   F22 said the wall between dirty money and standing was shut on 74% of
   trading paydays. The repair took the wall off `hard` and left it everywhere
   else, so the question this arm answers is whether the door the player was
   given is worth walking through — and what it costs them when they do.
*/
const RUNS_LEANING = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { trades: true, lean: true }),
);

/*
   The fourth arm: the same trading bot, with somebody keeping its books.

   The ledger said a trading career sells $1,632,268, pays $694,777 for stock
   and $105,821 in wages, and hands **$156,255 to nobody at all** — the wash
   cut, the only charge in this game that buys nothing. 24% is what a stranger
   charges now, and this measures what the alternative is worth.
*/
const RUNS_BOOKS = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { trades: true, books: true }),
);

/*
   A bot that buys things, against the same bot that does not.

   Everything measured in this file until now was measured on a family that
   banks its clean money and buys fronts with it, which is why the possessions
   catalogue has never appeared in a single reading. F7: an instrument blind to
   a system reports confidently about everything around it.
*/
const RUNS_SHOPS = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { shops: true }),
);

/*
   A bot that builds up to the big jobs, against the same bot that walks
   straight at them.

   Same seeds, same everything else. F7 §4.3: no instrument in this project has
   ever opened a score, so without this arm every bar in this file would keep
   reporting confidently about a game with a month-long feature in it that
   nothing ever touches. The precedent is the money-sink tier, whose first
   pricing was wrong in a way only its own arm could show.
*/
const RUNS_SCORES = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { scores: true }),
);

describe('somewhere for the money to go', () => {
  it('says whether an ordinary career ever buys any of it', () => {
    const bought = RUNS_SHOPS.filter((r) => r.newSystems.shopping.bought.length > 0);
    const days = bought
      .map((r) => r.newSystems.shopping.firstDay!)
      .sort((a, b) => a - b);
    // Distinct rows, not purchases: a warrant takes things, and the bot buys
    // another one, so `bought` runs past the size of the catalogue.
    const counts = RUNS_SHOPS.map((r) => new Set(r.newSystems.shopping.bought).size);
    const tier = POSSESSIONS.filter((d) => d.upkeep).length;
    const tally = new Map<string, number>();
    for (const r of RUNS_SHOPS) {
      for (const id of r.newSystems.shopping.bought) tally.set(id, (tally.get(id) ?? 0) + 1);
    }

    // eslint-disable-next-line no-console
    console.log(
      `sinks: ${bought.length}/${RUNS_SHOPS.length} careers bought something on the ` +
        `upkeep tier
` +
        (bought.length
          ? `       first purchase, 25th / median / 75th day: ` +
            `${pct(days, 0.25)} / ${median(days)} / ${pct(days, 0.75)}
`
          : '') +
        `       how many things a career ended up with: ` +
        Array.from({ length: tier + 1 }, (_, n) => n)
          .map((n) => `${n}: ${counts.filter((c) => c === n).length}`)
          .join(', ') +
        `  (of ${tier} rows; ` +
        `${RUNS_SHOPS.reduce((t, r) => t + r.newSystems.shopping.bought.length, 0)} purchases ` +
        `in all, the extras being things a warrant took)` +
        `
       purchases by row (a seized thing gets replaced): ` +
        POSSESSIONS.filter((d) => d.upkeep)
          .map((d) => `${d.id} ${tally.get(d.id) ?? 0}/${RUNS_SHOPS.length}`)
          .join(', ') +
        `
       weeks keeping something, median ` +
        `${median(RUNS_SHOPS.map((r) => r.newSystems.shopping.weeksKeeping))}` +
        `; estate median $${median(RUNS_SHOPS.map((r) => r.bestEstate)).toLocaleString('en-US')}` +
        ` against $${median(RUNS_300.map((r) => r.bestEstate)).toLocaleString('en-US')} not shopping`,
    );

    /*
       Reachable, and reachable in time to be lived with.

       The surplus peaks on day 294 of 300. A catalogue only bought in the last
       fortnight has absorbed the money without ever having been a decision,
       which is the specific way this feature fails while looking like it
       worked. Both ends are asserted for the same reason the patron test
       asserts both: a price low enough that everybody buys everything has not
       fixed the sink, it has deleted the choice.
    */
    expect(
      bought.length,
      'nobody ever buys anything on the upkeep tier',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_SHOPS.length / 2));
    expect(
      median(days),
      'the catalogue is only reachable in the last fortnight of a career',
    ).toBeLessThan(240);
    expect(
      counts.filter((c) => c === tier).length,
      'every career buys the entire catalogue, so none of it is a choice',
    ).toBeLessThan(RUNS_SHOPS.length);
  });

  it('says whether keeping it costs anything worth noticing', () => {
    /*
       Paired against the same seeds, participants only, per HANDOFF section 3.
       A family that never bought anything cannot be told apart from one that
       did, and averaging the two hides the whole effect.
    */
    const gap = pairedGap(
      RUNS_SHOPS,
      RUNS_300,
      (r) => r.bestEstate,
      (r) => (r as (typeof RUNS_SHOPS)[number]).newSystems.shopping.bought.length > 0,
    );

    // eslint-disable-next-line no-console
    console.log(
      `sinks: paired estate gap for careers that shopped: ` +
        `$${Math.round(gap).toLocaleString('en-US')}
` +
        `       weeks the upkeep could not be met, median ` +
        `${median(RUNS_SHOPS.map((r) => r.newSystems.shopping.weeksShort))}`,
    );

    /*
       It has to cost something. A sink that leaves the family exactly as rich
       is not absorbing anything — it is a purchase that happens to sit in the
       estate at face, which is what `holdings` already does for free.
    */
    expect(gap, 'buying and keeping all of it costs the family nothing').toBeLessThan(0);
  });
});

describe('the month in front of the job', () => {
  it('says whether an ordinary career ever builds up to one', () => {
    const opened = RUNS_SCORES.filter((r) => r.newSystems.scores.opened > 0);
    const days = opened.map((r) => r.newSystems.scores.firstDay!).sort((a, b) => a - b);
    const prep = RUNS_SCORES.flatMap((r) => r.newSystems.scores.prepPerScore);
    const spread = Array.from({ length: 6 }, (_, n) => prep.filter((p) => p === n).length);

    // eslint-disable-next-line no-console
    console.log(
      `scores: ${opened.length}/${RUNS_SCORES.length} careers opened at least one
` +
        (opened.length
          ? `        first score, 25th / median / 75th day: ` +
            `${pct(days, 0.25)} / ${median(days)} / ${pct(days, 0.75)}
`
          : '') +
        `        opened ${RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.opened, 0)}, ` +
        `${RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.prepped, 0)} reached the night, ` +
        `${RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.expired, 0)} expired, ` +
        `${RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.bare, 0)} targets run bare
` +
        `        setups: ${RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.setupsRun, 0)} run, ` +
        `${RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.setupsLanded, 0)} landed
` +
        `        pieces in hand on the night: ` +
        spread.map((n, i) => `${i}: ${n}`).join(', ') +
        `
        gear the police came away with: ` +
        `${RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.recovered, 0)}`,
    );

    /*
       Reachable, and reachable in time to be lived with. Both ends, for the
       same reason the possessions bars assert both: a feature nobody opens is
       decoration, and a feature only reachable in the last fortnight has taken
       the days without ever having been a decision.
    */
    expect(
      opened.length,
      'nobody ever builds up to anything',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_SCORES.length / 2));
    expect(
      median(days),
      'scores are only reachable in the last stretch of a career',
    ).toBeLessThan(240);
  });

  it('says whether preparing is a decision or a chore', () => {
    const prep = RUNS_SCORES.flatMap((r) => r.newSystems.scores.prepPerScore);
    const most = Math.max(...RUNS_SCORES.flatMap((r) => r.newSystems.scores.prepPerScore), 0);
    const atNone = prep.filter((p) => p === 0).length;
    const atAll = prep.filter((p) => p === most).length;

    // eslint-disable-next-line no-console
    console.log(
      `scores: ${prep.length} scores reached the night; ` +
        `${atNone} went in with nothing, ${atAll} with everything (${most})
` +
        `        setups landed per score, median ${median(prep)}`,
    );

    /*
       The `opGates` rule in a different coat. Prep is meant to be a dial, so a
       distribution piled at both ends is the feature having become a chore you
       either do or skip. Only meaningful once something actually happened.
    */
    if (prep.length > 0) {
      expect(
        atNone + atAll,
        'preparing is all-or-nothing, which makes it a chore rather than a dial',
      ).toBeLessThan(prep.length);
    }
  });

  it('says whether the bodies it ties up are felt', () => {
    /*
       §4.2. A score holds a man for the whole window and its setups tie up
       more. The measured cause of a dead week is a shortage of people, so this
       is the risk the feature carries — and it is a paired reading against the
       same bot without it, because a career with more crew has more idle crew
       for reasons that have nothing to do with scores.
    */
    const share = (r: (typeof RUNS_SCORES)[number]) =>
      r.newSystems.scores.weeks ? r.newSystems.scores.weeksNobodyIdle / r.newSystems.scores.weeks : 0;
    const withScores = RUNS_SCORES.map(share).sort((a, b) => a - b);
    const without = RUNS_300.map(share).sort((a, b) => a - b);

    // eslint-disable-next-line no-console
    console.log(
      `scores: weeks with nobody spare, share of weeks — ` +
        `building up 25th/median/75th ` +
        `${(pct(withScores, 0.25) * 100).toFixed(0)}% / ${(median(withScores) * 100).toFixed(0)}% / ` +
        `${(pct(withScores, 0.75) * 100).toFixed(0)}%` +
        `; walking straight at it ` +
        `${(pct(without, 0.25) * 100).toFixed(0)}% / ${(median(without) * 100).toFixed(0)}% / ` +
        `${(pct(without, 0.75) * 100).toFixed(0)}%`,
    );

    /*
       The bar goes on the 75th, per §4.2 and DIRECTOR §5 — the quarter of
       careers that are shortest of people are the ones this can break, and a
       median would hide them. Three weeks in four with nobody spare is a game
       that has stopped rather than a game that costs something.
    */
    expect(
      pct(withScores, 0.75),
      'building up to jobs leaves the family with nobody spare most weeks',
    ).toBeLessThan(0.75);
  });

  it('says whether the bot works at all, which it did not', () => {
    const era = [0, 1, 2].map((i) => median(RUNS_300.map((r) => r.launchEra[i])));
    const dead = RUNS_300.map((r) => r.deadDays).sort((a, b) => a - b);

    // eslint-disable-next-line no-console
    console.log(
      `work: jobs launched per career, median — before day 90 ${era[0]}, ` +
        `day 90-179 ${era[1]}, day 180-299 ${era[2]}
` +
        `      days the loop ran and launched nothing, 25th/median/75th ` +
        `${pct(dead, 0.25)} / ${median(dead)} / ${pct(dead, 0.75)} of 300`,
    );

    /*
       The bar that would have caught it, added after it did not.

       This bot's job loop ended `if (idle(state).length < bodies) break;`
       against a list sorted by expected value rather than by bodies, so one
       twelve-man job at the top stopped every cheaper job below it from being
       considered. On a day the family could not crew its best option it did
       nothing at all — and because the best option gets bigger as the board
       opens, the freeze deepened over a career:

           jobs launched per career, median      before day 90 / 90-179 / 180+
             with the break                            46 / 22 / 21
             with continue                            109 / 84 / 94
           days the loop ran and launched nothing
             with the break                       116 of 300
             with continue                          0

       Every pre-committed figure in this file was set against the first row.
       The four bars that moved when it was fixed carry their own notes.

       A bar on idleness rather than on volume, because volume is a policy and
       standing still is a defect. A quarter of a career is generous — the
       point is to catch a return to a third or a half, not to pin a rate.
    */
    expect(
      median(dead) / 300,
      'the bot is idle on most of the days it could be working',
    ).toBeLessThan(0.25);
  });

  it('says why a window shuts, and whether the game took it', () => {
    const last = new Map<string, number>();
    const days = new Map<string, number>();
    let dayTotal = 0;
    for (const r of RUNS_SCORES) {
      for (const w of r.newSystems.scores.why) last.set(w, (last.get(w) ?? 0) + 1);
      for (const t of r.newSystems.scores.whyDays) {
        for (const [w, n] of Object.entries(t)) {
          days.set(w, (days.get(w) ?? 0) + n);
          dayTotal += n;
        }
      }
    }
    const expired = RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.expired, 0);
    const opened = RUNS_SCORES.reduce((t, r) => t + r.newSystems.scores.opened, 0);
    const stopped = (rs: typeof RUNS_SCORES) =>
      rs
        .map((r) =>
          r.newSystems.scores.weeks ? r.newSystems.scores.weeksStopped / r.newSystems.scores.weeks : 0,
        )
        .sort((a, b) => a - b);
    const building = stopped(RUNS_SCORES);
    const never = stopped(RUNS_300);

    // eslint-disable-next-line no-console
    console.log(
      `expiry: ${expired} of ${opened} windows shut. What stood in the way on the last day —
` +
        [...last.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([w, n]) => `        ${w}: ${n}`)
          .join(String.fromCharCode(10)) +
        `
        and across every open-score day of an expired one (${dayTotal} days) —
` +
        [...days.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([w, n]) => `        ${w}: ${n} (${Math.round((n / dayTotal) * 100)}%)`)
          .join(String.fromCharCode(10)) +
        `
        weeks too hot or dark, share of all weeks — building up ` +
        `${(pct(building, 0.25) * 100).toFixed(0)}% / ${(median(building) * 100).toFixed(0)}% / ` +
        `${(pct(building, 0.75) * 100).toFixed(0)}%; never preparing ` +
        `${(pct(never, 0.25) * 100).toFixed(0)}% / ${(median(never) * 100).toFixed(0)}% / ` +
        `${(pct(never, 0.75) * 100).toFixed(0)}%`,
    );

    /*
       §2.4, as a bar rather than as a sentence: a window expires because the
       player was slow, never because the game moved the job out from under
       them. Two of the seven things that can be in the way are the game
       itself, and both were live before this feature shipped.

       **The gate behind the target shutting.** `opens` reads live state, so a
       front closing or a favour lapsing could take the job away from a player
       who had already put a man and most of a month into it. Two expiries in
       121. `availableOperations` now holds a scored target on the board.

       **Going dark.** `canLaunch` refuses anything but quiet work while laying
       low, and `LAY_LOW_DURATION_DAYS` is 14 — exactly half a window. 33
       expiries in 148, and 14% of every day a doomed score ever lived.
       `tickScores` now stops the clock while the family is dark.

       Everything else in the list is the player: too hot because of what they
       did, unable to stake it, nobody to send, or still preparing on the last
       morning. Those are supposed to happen and the bars leave them alone.

       The one figure worth keeping beside this: the family is too hot or dark
       in 44% of weeks when it builds up to jobs and 40% when it never does.
       Preparing does not cause the weather it expires in, which is why heat is
       deliberately not in the pause above — at 85 the odds carry a 25-point
       penalty and nothing is refused, so working through it is a bad decision
       rather than a wall, and a clock that paused for that would be pausing
       for a choice.
    */
    expect(
      last.get('came off the board') ?? 0,
      'the game took the job away from somebody already building up to it',
    ).toBe(0);
    expect(
      (last.get('laying low') ?? 0) / Math.max(1, expired),
      'going dark is still killing scores outright',
    ).toBeLessThan(0.05);
  });

  it('says whether the night itself goes better', () => {
    const prepped = RUNS_SCORES.flatMap((r) => r.newSystems.scores.preppedOdds).sort((a, b) => a - b);
    const bare = RUNS_SCORES.flatMap((r) => r.newSystems.scores.bareOdds).sort((a, b) => a - b);
    const preppedCrew = RUNS_SCORES.flatMap((r) => r.newSystems.scores.preppedCrew);
    const bareCrew = RUNS_SCORES.flatMap((r) => r.newSystems.scores.bareCrew);

    // eslint-disable-next-line no-console
    console.log(
      `scores: the same targets done two ways —
` +
        `        odds at launch, prepared ${(median(prepped) * 100).toFixed(0)}% ` +
        `(${prepped.length} nights) against bare ${(median(bare) * 100).toFixed(0)}% ` +
        `(${bare.length} nights)
` +
        `        bodies sent, prepared ${median(preppedCrew)} against bare ${median(bareCrew)}
` +
        `        the groundwork bill, median career ` +
        `$${median(RUNS_SCORES.map((r) => r.newSystems.scores.setupSpend)).toLocaleString('en-US')}`,
    );

    /*
       The mechanic itself, isolated from the career around it. If a prepared
       night is not a better night, nothing above this line matters and no
       amount of policy tuning will make it matter.
    */
    if (prepped.length > 0 && bare.length > 0) {
      expect(
        median(prepped),
        'a month of planning does not make the night any better',
      ).toBeGreaterThan(median(bare));
    }
  });

  it('says what it does to the career around it', () => {
    /*
       The whole distribution, not the median of it.

       This asserted on `pairedGap` — the median of thirty-five paired career
       differences — and a sweep of the setup stakes across four scales
       returned -61,322 / +81,306 / -61,322 / +68,318 for stakes at 100%, 50%,
       25% and 10% of what they cost. Two different scales returning the *same*
       figure to the dollar is the tell: the median lands on one career, and
       which career that is moves for reasons that have nothing to do with the
       thing being swept.

       So the median of this quantity at n=36 cannot price this feature, and a
       bar on it would have been a coin flip wearing a threshold. The
       distribution and the share of careers ahead are what the arm can carry;
       the median is printed as context and asserted on by nothing.
    */
    const rows = RUNS_SCORES.map((r, i) => ({ r, against: RUNS_300[i] })).filter(
      ({ r }) => r.newSystems.scores.prepped > 0,
    );
    const gaps = rows.map(({ r, against }) => r.bestEstate - against.bestEstate).sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;
    const heat = pairedGap(
      RUNS_SCORES,
      RUNS_300,
      (r) => r.danger.heat,
      (r) => (r as (typeof RUNS_SCORES)[number]).newSystems.scores.prepped > 0,
    );

    // eslint-disable-next-line no-console
    console.log(
      `scores: paired against the same seeds, ${rows.length} careers that ran a prepared job —
` +
        `        estate difference 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `        careers that came out ahead: ${ahead}/${gaps.length}
` +
        `        heat-weeks ${Math.round(heat)}`,
    );

    /*
       Two bars, and neither of them is "it pays".

       **It must not be a one-way loss.** A month of planning that leaves every
       career poorer is a trap, and the correct play would be to never touch
       it. A third of careers ahead is the floor; the measured share sits well
       above it.

       **It must not be free money either.** If every career comes out ahead,
       prep has stopped being a decision and become a tax on not reading the
       manual — the same failure the possessions catalogue is guarded against.
    */
    expect(ahead, 'building up to a job makes almost every career poorer').toBeGreaterThan(
      Math.floor(gaps.length / 3),
    );
    expect(ahead, 'building up to a job is free money').toBeLessThan(gaps.length);
  });
});

describe('the trades, and the two things built on top of them', () => {
  it('says whether running them is worth doing at all', () => {
    const base = RUNS_300.map((r) => r.bestEstate);
    const trading = RUNS_TRADING.map((r) => r.bestEstate);
    const income = RUNS_TRADING.map((r) => r.trade.income);
    const opened = RUNS_TRADING.filter((r) => r.trade.productOpenedOn !== null);
    const armed = RUNS_TRADING.filter((r) => r.trade.armsOpenedOn !== null);

    // eslint-disable-next-line no-console
    console.log(
      `trades: ${RUNS_TRADING.length} careers, ${HUMAN_DAYS} days each\n` +
        `        opened a product arrangement: ${opened.length}/${RUNS_TRADING.length}` +
        (opened.length
          ? `, median day ${Math.round(median(opened.map((r) => r.trade.productOpenedOn!)))}`
          : '') +
        `\n` +
        `        opened an arms source:        ${armed.length}/${RUNS_TRADING.length}` +
        (armed.length
          ? `, median day ${Math.round(median(armed.map((r) => r.trade.armsOpenedOn!)))}`
          : '') +
        `\n` +
        `        trade income over the career: p10 ${Math.round(pct(income, 0.1))} ` +
        `median ${Math.round(median(income))} p75 ${Math.round(pct(income, 0.75))}\n` +
        `        best estate, not trading vs trading: ` +
        `${Math.round(median(base))} vs ${Math.round(median(trading))}`,
    );

    /*
       Two conditions, and they are about whether the trade is a real option
       rather than about how much it pays.

       A trade most careers cannot get into is content nobody sees. A trade
       that leaves a family no better off is a button that costs a retainer.
    */
    expect(
      opened.length,
      'most careers can never get into the trade at all',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_TRADING.length / 2));
    expect(
      median(trading),
      'running both trades for 300 days leaves a family no better off',
    ).toBeGreaterThan(median(base));
  });

  it('says what a plant does for the careers that build one', () => {
    const built = RUNS_OWNED.filter((r) => r.trade.plants > 0);
    const unit = (rs: typeof RUNS_OWNED) =>
      rs
        .filter((r) => r.trade.unitCostWeeks > 0)
        .map((r) => r.trade.unitCostSum / r.trade.unitCostWeeks);

    /*
       Paired by seed, and only the careers that actually built one.

       The first version of both assertions below compared the median of the
       whole owning population against the median of the whole buying one, and
       a mutation check found what that is worth: **making a plant add 40 units
       a week of throughput left the volume assertion green.** Seven careers in
       thirty-six build a plant, so the median career in the owning arm does
       not have one and a minority effect cannot move the statistic. That is
       instance thirty-six of an instrument reporting confidently about
       something it is not measuring.

       The two arms share seeds, so a plant-holder can be compared against the
       same career that did not buy one. The arms do diverge — a quarter of a
       million dollars leaving the account changes what the bot can afford next
       week and therefore what it rolls — so this is a paired comparison of
       two related careers rather than a controlled experiment. That is enough
       to catch a sign error and enough to catch a volume upgrade smuggled in
       as a price cut, which is what it is for.
    */
    const pairs = RUNS_OWNED.map((owned, i) => ({ owned, bought: RUNS_TRADING[i] })).filter(
      (x) =>
        x.owned.trade.plants > 0 &&
        x.owned.trade.unitCostWeeks > 0 &&
        x.bought.trade.unitCostWeeks > 0,
    );
    const mean = (r: (typeof RUNS_OWNED)[number]) => r.trade.unitCostSum / r.trade.unitCostWeeks;

    // eslint-disable-next-line no-console
    console.log(
      `plant: the game offered one to ${RUNS_OWNED.filter((r) => r.trade.couldBuild).length}/${RUNS_OWNED.length}, built in ${built.length}` +
        (built.length
          ? `, median day ${Math.round(median(built.map((r) => r.trade.plantOn!)))}`
          : '') +
        `\n       whole populations, mean paid per load: ` +
        `${Math.round(median(unit(RUNS_TRADING)))} buying vs ${Math.round(median(unit(RUNS_OWNED)))} owning\n` +
        `       the ${pairs.length} careers that built one, against themselves without it:\n` +
        `         paid per load  ` +
        `${Math.round(median(pairs.map((x) => mean(x.bought))))} -> ` +
        `${Math.round(median(pairs.map((x) => mean(x.owned))))}\n` +
        `         trade income   ` +
        `${Math.round(median(pairs.map((x) => x.bought.trade.income)))} -> ` +
        `${Math.round(median(pairs.map((x) => x.owned.trade.income)))}`,
    );

    /*
       The reachability condition, and the one that killed the mirror design.

       `WORKSHOP` was the PATRON shape at fewer than one career in ten. A
       quarter is the bar because a plant is a late capital purchase rather
       than something every career does — but a quarter reaching it is the
       difference between an ambition and a museum piece.

       ## What this watches, and what it deliberately does not

       It reads `couldBuild` — the game said yes — and not `plants`, the number
       the bot actually bought. That distinction was not obvious and cost a red
       test to find. The bar went in at a quarter before anything was plotted,
       which is the right order; the plot then read **7 of 36 built** and it
       failed. The diagnostic is the line above it: the game offered a plant to
       **16 of 36**. The gap is entirely the bot's own reserve rule, which
       refuses to spend below one and a half times the price, because a boss
       who empties the account on a building is not the competent-but-not-
       optimal player the rest of this file models.

       So the bar was pointed at reachability rather than at appetite. Note
       what did *not* happen: the number did not move. A bar reading a quantity
       that answers a different question is the alderman's fault in a different
       costume, and the repair for that is the same — change what it watches,
       not where it sits.

       Take-up stays in the log, unasserted, because it is a fact about this
       bot's caution and not about the game.
    */
    expect(
      RUNS_OWNED.filter((r) => r.trade.couldBuild).length,
      'a plant is priced for a run that has already succeeded — PATRON again',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_OWNED.length / 4));

    /*
       And that it does the one thing it exists to do. A plant produces
       nothing; the whole feature is the price of a unit.
    */
    if (pairs.length > 0) {
      expect(
        median(pairs.map((x) => mean(x.owned) - mean(x.bought))),
        'the same career pays no less for a load after building premises of its own',
      ).toBeLessThan(0);
    }

    /*
       "Cheaper units must not become more units" is checked, and not here.

       It was here, as a bound on trade income, and the bound was wrong twice
       over. Income is revenue rather than volume, and a plant-holder who also
       fills orders books revenue a street-only career never sees — the paired
       figures above read $1.8M against $2.3M for exactly that reason, which is
       orders working rather than throughput leaking. Bounding it would have
       been a bar against the wrong quantity, placed to make a true claim look
       tested.

       The claim is a claim about one function, so it is tested on that
       function: `plant.test.ts` asserts `throughput` is byte-identical either
       side of `buildPlant`, and reinstating a plant that adds capacity turns
       it red. A population statistic could not have caught it anyway — seven
       careers in thirty-six hold a plant, and the median of the other
       twenty-nine does not move when they gain forty units a week.
    */
  });

  /*
     Where trade income goes, and why almost none of it reaches the estate.

     Two findings were open and looked like one. The trade earns a median
     $1.6M over 300 days and moves what the family is *worth* by 6.5%; and the
     estate accumulates at 0.18x annual income against a real-world 1-2x. The
     obvious shared cause is the washing machine, because `estate` counts clean
     cash, holdings and fronts and **never counts dirty money** — so every
     dollar the trade earns has to pass through a front to become standing.

     Two populations, same seeds, one difference: whether the bot trades. If
     capacity is the constraint, the trading arm should be pinned against it.
  */
  it('says where trade income goes, and whether laundering is what stops it', () => {
    const roll = (rs: typeof RUNS_300) => {
      const t = rs.reduce(
        (a, r) => ({
          capacityBound: a.capacityBound + r.wash.capacityBound,
          dirtyBound: a.dirtyBound + r.wash.dirtyBound,
          nothingToWash: a.nothingToWash + r.wash.nothingToWash,
          noFronts: a.noFronts + r.wash.noFronts,
          laundered: a.laundered + r.wash.laundered,
          capacity: a.capacity + r.wash.capacity,
          dirtyIn: a.dirtyIn + r.wash.dirtyIn,
          cleanIn: a.cleanIn + r.wash.cleanIn,
          cut: a.cut + r.wash.cut,
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
          capacity: 0,
          dirtyIn: 0,
          cleanIn: 0,
          cut: 0,
          outHires: 0,
          outJobs: 0,
          outFronts: 0,
          outEvents: 0,
          outUpkeep: 0,
        },
      );
      const paydays = t.capacityBound + t.dirtyBound + t.nothingToWash + t.noFronts;
      return {
        ...t,
        paydays,
        used: t.laundered / Math.max(1, t.capacity),
        washedShare: t.laundered / Math.max(1, t.dirtyIn),
        estate: median(rs.map((r) => r.bestEstate)),
        dirtyHeld: median(rs.map((r) => r.trade.dirtyEnd)),
        dirtyPeak: median(rs.map((r) => r.trade.dirtyPeak)),
        /*
           Every money figure on the ledger line is a **median career**, and
           saying so matters: the aggregate sums above are divided by 36, which
           is a mean, and this population has a long right tail (F15 — a
           quarter of careers run away with it). An earlier version of this
           readout put a mean and a median inside the same subtraction.
        */
        tradeIncome: median(rs.map((r) => r.trade.income)),
        /** What the legitimate side took in over the career. */
        frontRevenue: median(rs.map((r) => r.wash.revenue)),
        cutPaid: median(rs.map((r) => r.wash.cut)),
        washed: median(rs.map((r) => r.wash.laundered)),
        cogs: median(rs.map((r) => r.trade.cogs)),
        book: Object.fromEntries(
          LEDGER_KEYS.map((k) => [k, median(rs.map((r) => r.trade.book[k] ?? 0))]),
        ) as Record<string, number>,
        unexplained: median(rs.map((r) => r.trade.unaccounted)),
        seized: median(rs.map((r) => r.trade.seizedUnits)),
        raids: median(rs.map((r) => r.trade.raids)),
        meanCut: median(rs.map((r) => r.trade.meanCut)),
        meanHeat: median(rs.map((r) => r.trade.meanHeat)),
        heatQ: (() => { const all = rs.flatMap((r) => r.trade.heats); return [10,25,50,75,90].map((q) => Math.round(pct(all, q/100))).join('/'); })(),
        quietShare: median(rs.map((r) => r.trade.quietShare)),
        wages: median(rs.map((r) => r.trade.wages)),
        units: median(rs.map((r) => r.trade.unitsBought)),
        fronts: median(rs.map((r) => r.fronts)),
        eCash: median(rs.map((r) => r.trade.estateParts.cash)),
        eHold: median(rs.map((r) => r.trade.estateParts.holdings)),
        eFronts: median(rs.map((r) => r.trade.estateParts.fronts)),
        eTotal: median(rs.map((r) => r.trade.estateParts.total)),
        days: median(rs.map((r) => r.days)),
        died: rs.filter((r) => r.gameOver).length,
        cases: median(rs.map((r) => r.casesOpened)),
        handovers: median(rs.map((r) => r.handovers)),
        shuttered: median(rs.map((r) => r.frontLife.shuttered)),
        runNoFronts: rs.reduce((n, r) => n + r.trade.running.noFronts, 0),
        runNothing: rs.reduce((n, r) => n + r.trade.running.nothingToWash, 0),
        runDirty: rs.reduce((n, r) => n + r.trade.running.dirtyBound, 0),
        runCapacity: rs.reduce((n, r) => n + r.trade.running.capacityBound, 0),
        runWeeks: rs.reduce(
          (n, r) =>
            n +
            r.trade.running.noFronts +
            r.trade.running.nothingToWash +
            r.trade.running.dirtyBound +
            r.trade.running.capacityBound,
          0,
        ),
      };
    };
    const base = roll(RUNS_300);
    const trading = roll(RUNS_TRADING);
    const leaning = roll(RUNS_LEANING);
    const books = roll(RUNS_BOOKS);
    const hired = RUNS_BOOKS.filter((r) => r.trade.bookkeeperDay !== null);
    const hiredCut = median(hired.map((r) => r.trade.meanCut));
    /*
       Paired against the same seed, because the arms are not the same world.

       `trading`, `leaning` and `books` are separate simulations that diverge at
       the first decision a policy changes, so a median-to-median revenue
       comparison across them is two different populations quoted side by side
       rather than a controlled measurement. Sales read $359,270 lower in
       `books` than in `trading` on the medians while stock spend was flat,
       which is not a difference either arm's policy can produce. The paired
       figures below are the only ones entitled to attribute anything.
    */
    /*
       Paired, and restricted to the careers that actually used the thing —
       both halves of the rule on `helpers.pairedGap`. Without the second half
       the median gap for `books` reads exactly zero, because nine careers in
       thirty-six never hire anybody and their pairs are identical.
    */
    const gap = (
      arm: typeof RUNS_BOOKS,
      pick: (r: (typeof RUNS_BOOKS)[number]) => number,
      took: (r: (typeof RUNS_BOOKS)[number]) => boolean,
    ) => Math.round(pairedGap(arm, RUNS_TRADING, pick, took));
    const traded = (r: (typeof RUNS_BOOKS)[number]) => r.trade.income > 0;
    const onBooks = (r: (typeof RUNS_BOOKS)[number]) => r.trade.bookkeeperDay !== null;
    const neverCut = median(
      RUNS_BOOKS.filter((r) => r.trade.bookkeeperDay === null).map((r) => r.trade.meanCut),
    );
    const pc = (n: number, of: number) => `${Math.round((100 * n) / Math.max(1, of))}%`;
    /**
     * A per-career **mean**, formatted, and named for what it is.
     *
     * Kept apart from `median` on purpose — see the rule on `helpers.mean`.
     * This population has a long right tail, so a mean and a median describe
     * different families, and an earlier version of this readout quoted one
     * against the other inside a single subtraction. Every figure on the
     * ledger line below is a median; every figure on a line marked `— means`
     * is not.
     */
    const mean = (n: number, over = 36) => `$${Math.round(n / over).toLocaleString('en-US')}`;
    void meanOf;
    const dollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
    const line = (name: string, t: typeof base) =>
      `        ${name.padEnd(9)} laundered ${mean(t.laundered)} of ${mean(t.capacity)} offered ` +
      `(${Math.round(100 * t.used)}% used), ${mean(t.cut)} lost in the wash — means\n` +
      `                  paydays: no fronts ${pc(t.noFronts, t.paydays)}, ` +
      `nothing to wash ${pc(t.nothingToWash, t.paydays)}, ` +
      `dirty ran out ${pc(t.dirtyBound, t.paydays)}, ` +
      `capacity ran out ${pc(t.capacityBound, t.paydays)}\n` +
      `                  weekly heat p10/25/50/75/90 ${t.heatQ}, mean ` +
      `${Math.round(t.meanHeat)}, weeks under 60 ${Math.round(100 * t.quietShare)}%\n` +
      `                  revenue, median career: trade ${dollars(t.tradeIncome)} + fronts ` +
      `${dollars(t.frontRevenue)} = ${dollars(t.tradeIncome + t.frontRevenue)}\n` +
      `                  the ledger, all medians: sold ${dollars(t.tradeIncome)} ` +
      `- stock ${dollars(t.cogs)} - payroll ${dollars(t.wages)} ` +
      `- the cut ${dollars(t.cutPaid)} (${(100 * t.meanCut).toFixed(1)}% of ` +
      `${dollars(t.washed)} washed) = ` +
      `${dollars(t.tradeIncome - t.cogs - t.wages - t.cutPaid)}\n` +
      `                  units bought ${t.units} · seized ${t.seized} in ${t.raids} raids
` +
      `                  the book, median career: ` +
      LEDGER_KEYS.filter((k) => Math.round(t.book[k]) !== 0)
        .map((k) => `${k} ${dollars(t.book[k])}`)
        .join(', ') +
      ` · unexplained ${dollars(t.unexplained)}
` +
      `                  clean in ${mean(t.cleanIn)}, out on ` +
      `hires ${mean(t.outHires)} · jobs ${mean(t.outJobs)} · fronts ${mean(t.outFronts)} · ` +
      `events ${mean(t.outEvents)} · upkeep ${mean(t.outUpkeep)} — means\n` +
      `                  fronts at the end ${t.fronts} · gone under ${t.shuttered} · ` +
      `lived ${t.days}d · ended ${t.died}/36 · cases ${t.cases} · handovers ${t.handovers}\n` +
      `                  estate at the end ${t.eTotal.toLocaleString('en-US')} = ` +
      `cash ${t.eCash.toLocaleString('en-US')} + put away ${t.eHold.toLocaleString('en-US')} + ` +
      `fronts ${t.eFronts.toLocaleString('en-US')} · peak ${dollars(t.estate)}` +
      (t.runWeeks > 0
        ? `\n                  and only on weeks a source was open (${t.runWeeks} paydays): ` +
          `no fronts ${pc(t.runNoFronts, t.runWeeks)}, ` +
          `nothing to wash ${pc(t.runNothing, t.runWeeks)}, ` +
          `dirty ran out ${pc(t.runDirty, t.runWeeks)}, ` +
          `capacity ran out ${pc(t.runCapacity, t.runWeeks)}`
        : '');

    // eslint-disable-next-line no-console
    console.log(
      `washing: two populations, same seeds, one difference\n` +
        line('no trade', base) +
        `\n` +
        line('trading', trading) +
        `\n` +
        line('leaning', leaning) +
        `\n` +
        line('books', books) +
        `\n        paired against the same seeds, against trading:` +
        `\n          leaning  sold ${gap(RUNS_LEANING, (r) => r.trade.income, traded).toLocaleString('en-US')}` +
        `, units ${gap(RUNS_LEANING, (r) => r.trade.unitsBought, traded)}` +
        `, stock ${gap(RUNS_LEANING, (r) => r.trade.cogs, traded).toLocaleString('en-US')}` +
        `, estate ${gap(RUNS_LEANING, (r) => r.bestEstate, traded).toLocaleString('en-US')}` +
        `\n          books    sold ${gap(RUNS_BOOKS, (r) => r.trade.income, onBooks).toLocaleString('en-US')}` +
        `, units ${gap(RUNS_BOOKS, (r) => r.trade.unitsBought, onBooks)}` +
        `, stock ${gap(RUNS_BOOKS, (r) => r.trade.cogs, onBooks).toLocaleString('en-US')}` +
        `, estate ${gap(RUNS_BOOKS, (r) => r.bestEstate, onBooks).toLocaleString('en-US')}` +
        `\n        somebody on the books: ` +
        `${RUNS_BOOKS.filter((r) => r.trade.bookkeeperDay !== null).length}/36` +
        (RUNS_BOOKS.some((r) => r.trade.bookkeeperDay !== null)
          ? `, median day ${Math.round(
              median(
                RUNS_BOOKS.filter((r) => r.trade.bookkeeperDay !== null).map(
                  (r) => r.trade.bookkeeperDay!,
                ),
              ),
            )}` +
            `, best standing among those who hired: median ${Math.round(
              median(
                RUNS_BOOKS.filter((r) => r.trade.bookkeeperDay !== null).map(
                  (r) => r.trade.bestTrust,
                ),
              ),
            )}, p75 ${Math.round(
              pct(
                RUNS_BOOKS.filter((r) => r.trade.bookkeeperDay !== null).map(
                  (r) => r.trade.bestTrust,
                ),
                0.75,
              ),
            )}, max ${Math.max(...RUNS_BOOKS.map((r) => r.trade.bestTrust))}/100` +
            `
        the cut those careers paid: ${(100 * hiredCut).toFixed(1)}% ` +
            `against ${(100 * trading.meanCut).toFixed(1)}% for the same bot with nobody` +
            (Number.isFinite(neverCut) ? ` (${(100 * neverCut).toFixed(1)}% for the 9 who never hired)` : '')
          : ''),
    );

    /*
       `wash.dirtyIn` is not usable here, and finding that out is half the
       result.

       It is the sum of the *daily net rise* in dirty cash, and the trade earns
       and spends dirty on the same tick — `tickContraband` buys next week's
       stock out of the same pocket the sale just filled. So the trading arm
       reports **less** dirty in ($750k against $866k) while laundering more
       than twice as much, and "laundered 100% of dirty income" is the
       arithmetic of a denominator that cancelled itself out rather than a fact
       about the game. Left in the accumulator because the rest of this file
       reads it for a bot that does not trade, where it is fine; not read here.

       So the guard is on the quantity the comparison is actually about. If
       running two trades does not put materially more through the fronts, the
       two arms are the same experiment and nothing below means anything.

       ## Why it is not a ratio of any kind

       It read `trading.laundered > base.laundered * 1.5` and failed at 1.39x —
       not because the trade stopped working, but because the **base arm got
       richer**. Heat decaying as a share of the load took the median estate
       from $541,253 to about $1.48M, so a family that never touches contraband
       now earns enough dirty money from jobs alone to fill most of the same
       eight fronts.

       Repointing it at a *ratio* of capacity-bound weeks failed the same way
       for the same reason, one change later: any ratio of two quantities that
       are both pressed against the same ceiling converges on 1, and it says
       nothing about what is behind them.

       So it is a line rather than a ratio, drawn between the two arms and
       stating what the section is named for. Measured:

           no trade   laundered $1,175,109 of $1,583,488 offered — 74% used
           trading    laundered $1,606,761 of $1,771,352 offered — 91% used
                      and 89% of the weeks a source was open, capacity-bound

       The trading arm runs its fronts flat out. The arm with no trade has a
       quarter of its capacity spare. If the second one ever saturates too, the
       experiment has stopped being an experiment and this fires and says so —
       which a ratio quietly would not.
    */
    const used = (a: ReturnType<typeof roll>) => a.laundered / Math.max(1, a.capacity);
    expect(
      used(trading),
      'the trading arm is not running its fronts flat out, so the wash is not what stops it',
    ).toBeGreaterThan(0.85);
    expect(
      used(base),
      'a career with no trade fills its fronts too, so the two arms compare nothing',
    ).toBeLessThan(0.85);

    /*
       And the repair, which is the reason `lean` exists as its own arm.

       F22: the wall between dirty money and standing was shut on 74% of
       trading paydays, `estate` counts clean money and never counts dirty, so
       a trade earning $1.6M moved what the family is worth by 6.5%. Taking the
       ceiling off `hard` has to actually open that door — a dial that does not
       move the money is a dial with a warning label and nothing behind it —
       and it has to cost something, or it is not a decision.

       ## What is asserted, and what is only printed

       Both halves below are large, directional and robust: leaning puts 56%
       more through the fronts, and it takes 11% off what those fronts are
       worth, because exposure feeds health and health feeds value. Either one
       reversing would mean the feature is not doing what it says.

       What is **not** asserted is the estate total. Measured, leaning ends
       $586,738 against $576,661 — 1.7% on a median of 36 careers, which is
       inside the noise this file has been burned by before (a Capo shift of
       16 to 10 that turned out to be 34 to 29 at 96 seeds). The honest reading
       is that the extra clean money and the lost front value roughly cancel,
       and whether that is the right price is a tuning question with a
       plotted answer rather than a bar.
    */
    expect(
      leaning.laundered,
      'leaning on the premises put no more through them than not leaning',
    ).toBeGreaterThan(trading.laundered * 1.2);
    /*
       Paired and restricted, like everything else that compares two arms. This
       read `leaning.eFronts < trading.eFronts` — two medians over two
       populations that are not the same worlds — until the rule on
       `helpers.pairedGap` was written down.
    */
    expect(
      gap(RUNS_LEANING, (r) => r.trade.estateParts.fronts, traded),
      'leaning on the premises for a whole career cost nothing at all',
    ).toBeLessThan(0);

    /*
       And the cut, which is the charge the ledger said buys nothing.

       Two conditions. Somebody has to actually be reachable — a roster priced
       out of the game is the PATRON shape again — and keeping them has to move
       the rate materially, or the retainer, the weekly fee and the name on the
       paperwork are being charged for a rounding error. A fifth of the charge
       is the bar, pre-committed before anything was plotted.

       ## What it reads, and the mistake that took three goes to stop making

       It reads the careers that **actually hired somebody**, not the whole
       population. Pointed at the population it failed at 18.4% against 17.4%
       needed — and the reason was the nine careers in thirty-six that never
       retained anybody at all, sitting in the average at 22.8% and dragging it
       up. Mixing adoption into an effect size measures neither.

       That is the third bar in this file to be pointed at a population
       containing people who never touched the thing being measured: the
       plant's take-up, the plant's volume, and this. The number did not move
       in any of the three. HANDOFF §3.
    */
    expect(
      hired.length,
      'nobody in the game can afford to have their books kept',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_BOOKS.length / 2));
    expect(
      hiredCut,
      'keeping somebody on the books barely changes what the wash takes',
    ).toBeLessThan(trading.meanCut * 0.8);
  });

  it('says whether an order is a decision rather than a payout', () => {
    const offered = RUNS_OWNED.filter((r) => r.trade.offers > 0);
    const took = RUNS_OWNED.filter((r) => r.trade.accepted > 0);
    const accepted = RUNS_OWNED.reduce((n, r) => n + r.trade.accepted, 0);
    const filled = RUNS_OWNED.reduce((n, r) => n + r.trade.filled, 0);
    const failed = RUNS_OWNED.reduce((n, r) => n + r.trade.failed, 0);
    const refused = RUNS_OWNED.reduce((n, r) => n + r.trade.refused, 0);
    const supplied = RUNS_OWNED.filter((r) => r.trade.unitsToGangs > 0);

    // eslint-disable-next-line no-console
    console.log(
      `orders: offered to ${offered.length}/${RUNS_OWNED.length} careers, ` +
        `taken by ${took.length}\n` +
        `        accepted ${accepted}, refused ${refused}, filled ${filled}, failed ${failed}\n` +
        `        order income: median ${Math.round(
          median(RUNS_OWNED.map((r) => r.trade.orderIncome)),
        )} p75 ${Math.round(pct(RUNS_OWNED.map((r) => r.trade.orderIncome), 0.75))}\n` +
        `        careers that ever supplied a gang: ${supplied.length}` +
        (supplied.length
          ? `, worst feeling seen in their neighbourhood: median ${Math.round(
              median(supplied.map((r) => r.trade.worstGangSentiment)),
            )}`
          : ''),
    );

    /*
       Reach first. An order book nobody is ever handed is the PATRON shape a
       third time, and this is the condition the whole feature was gated on.
    */
    expect(
      offered.length,
      'most careers are never asked for anything',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_OWNED.length / 2));

    /*
       And then the two ways it could be hollow.

       A player who takes only what they can carry should mostly deliver — if
       they cannot, the sizing is wrong and the feature is a tax. But if
       *nothing* ever fails, the deadline is decoration and `ORDER_FAILURE` is
       dead config. The bot here refuses what it cannot cover, which is what
       makes both halves of that a fair question to ask.
    */
    if (accepted > 0) {
      expect(
        filled,
        'a bot that only accepts what it can carry still fills nothing',
      ).toBeGreaterThan(0);
      expect(
        refused,
        'every order offered was coverable, so accepting is not a decision',
      ).toBeGreaterThan(0);
    }
  });
});

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

describe('owning something of your own', () => {
  /*
     Whether the possessions catalogue is content anybody meets.

     The blueprint argued against building this third rather than first, on the
     grounds that *"a sink only bites somebody with money, and 30 of 36 careers
     finish under $100,000. Shipped before the fork moves, this is content for
     the sixth of players who least need content"* — which is exactly the
     mistake that put the diplomatic doors at the 75th percentile of a
     distribution nobody had plotted, twice.

     So the distribution is plotted here, before anybody claims the layer
     works. The bot buys nothing; these count weeks where it *could* have,
     against clean cash, which is the pool the catalogue is priced in.

     One pre-committed condition and it is deliberately modest: **most careers
     must be able to own something**. Not a house, not the Merriweather place —
     something. A catalogue the median career never opens is a panel.
  */
  it('is reachable by an ordinary career', () => {
    const own = RUNS_300.map((r) => r.newSystems.ownable);
    const ever = own.filter((o) => o.firstDay !== null);
    const share = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

    // eslint-disable-next-line no-console
    console.log(
      `something of your own: ${ever.length}/${own.length} careers could ever afford anything, ` +
        `median first day ${ever.length ? median(ever.map((o) => o.firstDay as number)) : '—'}\n` +
        `         weeks affordable: any ` +
        `${share(own.reduce((n, o) => n + o.weeksAnyAffordable, 0), own.reduce((n, o) => n + o.weeks, 0))}%` +
        `, a home of your own ` +
        `${share(own.reduce((n, o) => n + o.weeksHomeAffordable, 0), own.reduce((n, o) => n + o.weeks, 0))}%\n` +
        `         dearest ever in reach, median ` +
        `$${Math.round(median(own.map((o) => o.bestReached))).toLocaleString('en-US')}` +
        `, best $${Math.max(...own.map((o) => o.bestReached)).toLocaleString('en-US')}`,
    );

    expect(
      ever.length,
      'most careers can never afford anything in the catalogue, so it is a panel rather than a decision',
    ).toBeGreaterThanOrEqual(Math.ceil(own.length / 2));

    /*
       And the hook specifically.

       A home of your own is the one item that reaches into the personal-life
       layer, and the first pricing put it above the median career's ceiling —
       36/36 could afford *something*, but the dearest thing the median career
       could ever reach was $14,000 against an apartment at $22,000. This
       condition exists because that price was corrected after seeing the
       reading rather than before it, which is the weaker kind of evidence and
       should not be left resting on a comment.
    */
    const homes = own.filter((o) => o.weeksHomeAffordable > 0).length;
    expect(
      homes,
      'half the careers in the game never get within reach of a place of their own',
    ).toBeGreaterThanOrEqual(Math.ceil(own.length / 2));
  });
});

describe('the game every week', () => {
  /*
     Whether the card tables are rooms anybody gets into.

     The blueprint asked for gambling as *"a sink with teeth, once there is
     money to sink"*, and the qualifier is the whole risk: a sink priced for
     the twelve careers in thirty-six that compound is a panel for the other
     twenty-four. The bot never sits down, so this counts weeks it *could*
     have.

     Two pre-committed conditions, both about shape rather than about size.
     **The bottom room has to be open most of the time** — it is the one that
     is supposed to be available from the first morning. And **the top room has
     to be mostly shut**, because a room you are eventually invited to that
     turns out to be open all along is just another button.
  */
  it('opens the bottom room to everybody and the top room to almost nobody', () => {
    const t = RUNS_300.map((r) => r.newSystems.tables);
    const weeks = t.reduce((n, x) => n + x.weeks, 0);
    const open = (id: string) => t.reduce((n, x) => n + x.weeksOpen[id], 0);
    const share = (n: number) => (weeks ? Math.round((n / weeks) * 100) : 0);

    // eslint-disable-next-line no-console
    console.log(
      `the game every week: weeks each room would have seated you — ` +
        TABLES.map((def) => `${def.name} ${share(open(def.id))}%`).join(', ') +
        `\n         the top table seated somebody worth an evening in ` +
        `${share(t.reduce((n, x) => n + x.weeksWorthSitting, 0))}% of weeks`,
    );

    /*
       The respect gate on its own, with the money taken out of it.

       The first version of this test asserted only that the top room opens
       less often than the bottom one, and that stayed true with the respect
       bar set to zero — $12,000 is more than $400, which is all it was
       measuring. Two conditions instead, and they pull against each other:
       the invitation has to be **earnable** and it has to be **earned**.
    */
    const atLeast = (bar: number) => share(t.reduce((n, x) => n + x.respectAtLeast[bar], 0));
    const welcome = atLeast(TABLE_BY_ID.upstairs.respectAbove);
    // eslint-disable-next-line no-console
    console.log(
      `         weekly respect, share of weeks at or above: ` +
        RESPECT_BARS.map((b) => `${b} ${atLeast(b)}%`).join(', ') +
        `\n         the top room asks for ${TABLE_BY_ID.upstairs.respectAbove}, ` +
        `which ${welcome}% of weeks clear`,
    );

    expect(
      share(open('back_room')),
      'the room that is meant to be open on the first morning is mostly shut',
    ).toBeGreaterThanOrEqual(50);
    /*
       And how many careers ever got in, which a share of weeks hides.

       27% of weeks is the same number whether a quarter of careers are welcome
       always or every career is welcome eventually, and those are completely
       different features. An invitation should be the second one.
    */
    const everWelcome = t.filter((x) => x.respectAtLeast[TABLE_BY_ID.upstairs.respectAbove] > 0).length;
    // eslint-disable-next-line no-console
    console.log(`         careers ever invited upstairs: ${everWelcome}/${t.length}`);

    expect(
      everWelcome,
      'nobody in thirty-six careers is ever respected enough for the top room, so it is scenery',
    ).toBeGreaterThan(0);
    expect(
      welcome,
      'the top room lets everybody in, so the tiers are decoration',
    ).toBeLessThan(70);
  });
});

describe('the second front', () => {
  /*
     F15's pre-committed condition, written before the pricing was touched.

     The middle of the game goes quiet because it runs out of capital, not
     because it runs out of content: `ladder.probe` puts the blocker on a
     career with no front at **money in 97% of those weeks**, and round 15 said
     the same thing in prose — *"the two things that would have opened new
     decisions were both gated behind capital I could no longer accumulate."*

     Front income compounds into holdings, so the second one is the step that
     decides a career. Today 30 careers in 36 finish under $100,000 holding one
     front, and the six that compound hold five.

     Two conditions, and the second matters as much as the first. **A majority
     of careers should own more than one front**, which is a median of two. And
     **the top must not run further away while that happens** — a repair that
     doubles the estate of the six who are already fine and leaves the thirty
     where they are has widened the fork rather than closed it.

     Targets for `config/businesses.ts`, not thresholds on this file.
  */
  it('is reachable by an ordinary career', () => {
    const fronts = RUNS_300.map((r) => r.fronts);
    const compounded = RUNS_300.filter((r) => r.bestEstate >= 100_000).length;

    // eslint-disable-next-line no-console
    console.log(
      `the second front: median fronts ${median(fronts)}, ` +
        `compounding careers ${compounded}/${RUNS_300.length}, ` +
        `estate 40th/median/75th ` +
        `${Math.round(pct(RUNS_300.map((r) => r.bestEstate), 0.4)).toLocaleString('en-US')} / ` +
        `${Math.round(median(RUNS_300.map((r) => r.bestEstate))).toLocaleString('en-US')} / ` +
        `${Math.round(pct(RUNS_300.map((r) => r.bestEstate), 0.75)).toLocaleString('en-US')}`,
    );

    expect(median(fronts), 'the median career still never gets a second front').toBeGreaterThanOrEqual(2);
    expect(
      compounded,
      'the compounding half of the economy is still out of reach of most careers',
    ).toBeGreaterThanOrEqual(12);
  });

  /*
     And the other side of it. The 75th percentile of the estate is what the
     already-comfortable careers reach; if this repair moves that more than it
     moves the median, it has made the fork worse in the name of closing it.
  */
  it('does not simply pay the careers that were already fine', () => {
    const mid = median(RUNS_300.map((r) => r.bestEstate));
    const top = pct(RUNS_300.map((r) => r.bestEstate), 0.75);
    expect(top / Math.max(1, mid), 'the top pulled away from the middle').toBeLessThan(4);
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
