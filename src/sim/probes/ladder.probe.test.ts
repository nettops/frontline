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
  crewCompetence,
  crewNeeded,
  launchOperation,
  operationCost,
  opsBoard,
  standing,
} from '../operations';
import { canOpenScore, liveScores, openScore, scoreOn, setupsLeft } from '../scores';
import { liveTraining, startTraining } from '../training';
import { cancelStanding, liveStanding, setStanding } from '../standingOrders';
import { canSilence, silence } from '../silence';
import { SILENCE, MARK } from '../../config/silence';
import { liveMarks } from '../marks';
import { SCORE_TARGETS, SETUP_BY_ID } from '../../config/scores';
import { PATTERN } from '../../config/standingOrders';
import { workingHoldings, yieldOf, yieldsHeld } from '../holdings';
import { spendPoint } from '../build';
import type { StatId } from '../../config/build';
import { home, neglectRisk } from '../personal';
import { possessionsWorth } from '../possessions';
import { HOLDING, YIELDS, type YieldKind } from '../../config/holdings';
import { setAutopilot } from '../autopilot';
import { OPERATION_BY_ID } from '../../config/operations';
import { crewList, isOutOfReach } from '../npc';
import { eligibleStewards, needsSteward, putInCharge } from '../delegation';
import {
  controlLevel,
  controlledTerritories,
  hasPresence,
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
import { SHAPE_BARS } from '../../config/legacy';
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
import { answerCheaply, ev, idle, mean as meanOf, median, pairedGap, resolves } from '../__tests__/helpers';
import { borrow, canBorrow, priced } from '../market';
import { readWhispers } from '../whispers';
import { isGenerated } from '../eventgen';
import { civicRead, spendFavour } from '../civic';
import { careerShape, legitimacy } from '../legacy';
import { CIVIC, CIVIC_FIGURES } from '../../config/civic';
import { POSSESSIONS } from '../../config/possessions';
import {
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
import { APPARATUS_CAP } from '../../config/heat';
import { activeCases, pressureWitness, worstStage } from '../investigation';
import { PRESSURE_WITNESS } from '../../config/lawEnforcement';
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
    /**
     * Districts at *dominance* on the last day, which is what names a Kingpin.
     *
     * `careerShape` counts this band and nothing in this file ever captured
     * it, so the two times the Kingpin bar has had to be re-plotted it was
     * re-plotted against a histogram printed by hand into a comment. A bar
     * goes between the median and the 75th of a plotted distribution, and the
     * distribution has to be here for that to be possible.
     */
    dominatedAtEnd: number;
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
    /**
     * And the same for the player's own routes, which nothing measured.
     *
     * This file has run the trade for thirty-six careers at a time since the
     * trade existed and never once looked at what it did to the streets it ran
     * through. That is why `sentimentPerUnit` sat at a tenth of the figure it
     * needed for the whole life of the feature: the cost was in the config,
     * the comment claimed it bit, and no instrument pointed at it.
     */
    worstRouteSentiment: number;
    /** Careers that took one of their own districts below the hostile bar. */
    routeWentHostile: boolean;
    /**
     * The paired reading, which is the one that can attribute anything.
     *
     * `worstRouteSentiment` above answers "how bad did it get on a street the
     * trade ran through", and that turned out to be unattributable: the bot
     * works jobs and standing orders in the same districts, and a career of
     * either alone bottoms a neighbourhood out. Correcting `sentimentPerUnit`
     * by a factor of eight moved that statistic not at all — median 1 before
     * and after — because it was never measuring the trade.
     *
     * These are the mean end-of-career feeling in the districts a career ran
     * through against the districts it held and did not, within the same
     * career, so what is left when you subtract them is the route.
     */
    routedFeeling: number | null;
    unroutedFeeling: number | null;
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
    /** What the family is worth at the end, which is what the shapes read. */
    finalEstate: number;
    /**
     * And the respect it holds at the end, for the same reason.
     *
     * `donRespect` was the one bar in `SHAPE_BARS` placed with no percentile
     * beside it, and it became the verdict on 42% of careers the moment
     * nicknames started paying grip. Nothing captured the quantity it reads,
     * so no re-plot was possible without adding this.
     */
    finalRespect: number;
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
    /** Men still on the books at the end — not dead, not inside, not gone. */
    crewLeft: number;
    /** Crew skill at the end, which is what both halves of training move. */
    crewSkill: { median: number; best: number; floor: number };
    /** What the risk-matched allocator did. */
    matched: { launched: number; oddsSum: number };
    /** The one standing order, for the arm that hands the loop over. */
    auto: {
      setDay: number | null;
      job: string | null;
      launched: number;
      /** Times the order was re-pointed somewhere else. Zero on every arm but one. */
      moves: number;
    };
    /**
     * What a bot that deals with its worst people did.
     *
     * F7: nothing in this project has ever cut anybody, so `silence.ts` and
     * `marks.ts` shipped invisible to every bar in this file.
     */
    cutting: {
      /** Men the bot decided had to go. */
      tried: number;
      /** ...and how many of those went the way it wanted, first time. */
      landed: number;
      /** Marks left standing by the ones that did not. */
      marksOut: number;
      /** How those marks ended. A mechanic where one of these is zero is not a race. */
      marksLanded: number;
      marksLapsed: number;
      /** Evidence filed by men who were still out there talking. */
      talked: number;
      firstDay: number | null;
    };
    /**
     * What a bot that takes ground for what it gives ended up with.
     *
     * Counted at the end rather than accumulated, because a yield is a fact
     * about the map this morning and not a thing that banks. `working` is the
     * number that matters — ground held *and* staffed, which is the only kind
     * that pays.
     */
    ground: {
      /** Districts held at `control` with somebody standing in them. */
      working: number;
      /** ...and how many distinct kinds that adds up to, out of six. */
      kinds: number;
      /** Districts held at control, staffed or not. The gap is the waste. */
      controlled: number;
      /** Men tied up running ground, which is the price of all of it. */
      stewards: number;
    };
    /**
     * The three things nothing in this project has ever measured.
     *
     * Fear, what a boss owns, and whether anybody is waiting at home. All
     * three are built, all three are wired, and no probe arm, bar or blind
     * round has ever looked at one of them. `ladder.probe` searches the word
     * "fear" and finds it only inside a loyalty-drift table where it
     * contributes -0.02 of -1.45 — which is either a system that does nothing
     * or a system nothing switches on, and a reading of -0.02 cannot tell you
     * which.
     */
    /** What leaning on the people who talk actually did. */
    leaning: { tried: number; landed: number; backfired: number; strengthMoved: number };
    self: {
      /** Jobs deliberately run loud, for the arm that picks its moments. */
      heavyRuns: number;
      /** The most frightening the family ever was, and where it settled. */
      peakFear: number;
      finalFear: number;
      /** Weeks spent above the level where fear starts paying for itself. */
      weeksFeared: number;
      /** What the boss owns, and what it is worth. */
      owned: number;
      ownedWorth: number;
      /** How far from home it got, and how often anybody went back. */
      peakNeglect: number;
      finalNeglect: number;
      visits: number;
      /** The multiplier neglect was putting on being deposed, at the end. */
      depositionRisk: number;
    };
    /** What a bot that puts its green men with its good ones did. */
    teaching: {
      started: number;
      finished: number;
      gained: number;
      weeksPaired: number;
      firstDay: number | null;
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
  /*
     Reporting only, added to answer one question and asserted nowhere.

     Round 16's tester said the game solved itself at day 92 because Call In
     Tribute was the only thing they could reach. Measurement showed it is the
     *worst* money at its own rank — the two jobs beating it ask $50,000 and
     $54,000 — so the question is not whether it is overpriced but whether a
     player ever has that much when the rank opens. Nothing in this file could
     say, because the record counts jobs per era and never which ones.

     A retiming built on the guess was measured by this probe and rejected: it
     took "what the ground is for" to exactly 18 of 36, because both free jobs
     at the top are district-gated and slowing them removed the payoff for
     holding ground. So this time the reading comes first.
  */
  /** Every job the bot launched, by definition id. */
  launchedBy: Record<string, number>;
  /** Clean + dirty at the moment tier-4 work first became available. */
  fundsAtTier4: number | null;
  /** Day that happened, and the first day $50,000 was in hand after it. */
  tier4Day: number | null;
  couldAffordDay: number | null;
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
  /**
   * Puts the green men with the good ones.
   *
   * F7 again. Work teaching moves skill on every arm whether anybody asks for
   * it or not, but nothing in this project pairs two men and takes them both
   * off the board for a fortnight — so the half of the feature that is a
   * decision would be invisible while every bar around it reported
   * confidently.
   *
   * The policy is what a patient boss does: when somebody is spare and
   * somebody much better is also spare, put them together.
   */
  trains?: boolean;
  /**
   * Hands the job loop over and stops choosing.
   *
   * The only automation in this game that plays turns for you, and the only
   * one whose bar is *not* "does it pay". It must **not** beat the played
   * line: if setting an order and pressing +1 month is the strongest way to
   * play, the game has been automated out of itself.
   *
   * The bot sets one standing order on the best job it can see and then leaves
   * the jobs loop alone entirely. That is the honest model of somebody who
   * turned it on and stopped paying attention, which is the case the bar is
   * about.
   *
   * Measured 0/36 ahead at −$2,105,689 once repetition started costing
   * something, on 115 firings a career against the 234 it managed when nothing
   * in the game noticed. Both figures moved when the pattern landed and both
   * are recorded here rather than left describing the old game.
   */
  auto?: boolean;
  /**
   * ...and the same order, kept *alongside* playing by hand.
   *
   * The arm above models somebody who turned it on and walked away, which is
   * the "does the game solve itself" question. This one is the realistic use
   * and the more dangerous one: a standing order grinding the street job while
   * the player keeps hand-running everything above it. If that beats playing,
   * the feature is a free win rather than a trade, and no amount of the order
   * being stupid about heat would matter — it would be stupid about a job the
   * player had stopped caring about anyway.
   */
  autoPlus?: boolean;
  /**
   * ...and the same order again, moved before it wears a groove.
   *
   * The two arms above model the only two things a player could do with a
   * standing order while it had no memory: leave it, or leave it and keep
   * playing. Both were priced, and both lose. That is a mechanic with one
   * setting, not a decision — and the reason it has one setting is that
   * nothing in the game noticed the order firing on the same job in the same
   * district 234 times in a career.
   *
   * This arm is the third thing, and it exists to ask whether *rotation* is
   * worth anything at all. It is deliberately written before the pattern
   * mechanic does, so what it reads now is the confound measured on its own:
   * moving an order also spreads work across districts, and this file already
   * found that spreading is worth a great deal by itself. Whatever separates
   * this from `autoPlus` today is that spreading and nothing else. Whatever
   * separates them afterwards, minus this, is the pattern.
   *
   * It moves on a fixed schedule rather than by reading the pattern, so the
   * arm behaves identically before and after the mechanic exists. That is the
   * only reason the two runs can be compared at all.
   */
  autoCycled?: boolean;
  /**
   * The whole operations loop handed over to something that allocates well.
   *
   * A test rather than a shipped policy. The two arms above hand over to a
   * standing order that is deliberately stupid — one job, picked once, never
   * re-pointed — so they never asked the question that actually matters: does
   * automation *with a good rule inside it* beat playing by hand?
   *
   * The rule is the obvious one a player would want: your best and most
   * careful people on the riskiest work, and whoever is left on the safe jobs.
   * It runs every day and the player chooses nothing.
   *
   * Note what this is really comparing. The baseline bot already launches
   * every day; it just takes `idle().slice(0, bodies)`, which is arbitrary. So
   * this measures the *allocation rule* on its own, which is the honest way to
   * ask whether an operations autopilot would be strictly better than the
   * hand it replaces.
   */
  matchOps?: boolean;
  /**
   * ...and the same allocator, given the judgement call it deliberately lacks.
   *
   * The shipped autopilot does not read heat, and that omission is the same
   * one `standingOrders.ts` is built around: reading the room is what a player
   * does, and an automation that does it too is the game solving itself.
   *
   * The counter-argument is that it is silly — a real outfit does not grind on
   * while a task force forms. This arm exists to settle that with a number
   * rather than an opinion. It throttles as attention climbs and stops
   * entirely when it is bad, on top of the lay-low every arm already does.
   *
   * The bar is `RUNS_AUTO`'s: if it stays level with playing by hand it should
   * ship, and if it starts beating it then the omission was load-bearing.
   */
  matchOpsSmart?: boolean;
  /**
   * Deals with the people who keep costing it money.
   *
   * F7, and the plainest case of it this file has had. Nothing in this project
   * has ever cut anybody — not a probe, not a bot, not once — so `silence.ts`
   * and `marks.ts` shipped with unit tests and nothing else, invisible to every
   * bar around them while they all reported confidently.
   *
   * The policy is the one the feature was asked for: a man whose record is bad
   * enough, often enough, is dealt with rather than let go. What happens next
   * is not the bot's decision — a botched attempt leaves a mark and the mark
   * plays itself, which is the half that needs measuring most.
   */
  cuts?: boolean;
  /**
   * ...and the same thing done sparingly, which is how anybody would do it.
   *
   * The arm above uses this nineteen times a career and shows that is ruinous.
   * That is a real finding and it answers only half the question: it measures
   * *indiscriminate* use, so it cannot say whether there is a good use of the
   * mechanic at all — and a mechanic that is never the right call is a trap
   * rather than a decision.
   *
   * So: only against somebody genuinely catastrophic, and no more than three
   * times in four years. **The rule is fixed before the result is read**, and
   * it is not iterated afterwards. Raising a threshold until an arm comes out
   * ahead is tuning a bot to flatter a mechanic, which is DIRECTOR section 5
   * wearing a different hat.
   */
  cutsRarely?: boolean;
  /**
   * Takes ground for what it gives, and puts somebody in it.
   *
   * F7 again, and this time the blindness was measured before the arm existed.
   * `holdings.ts` gave each of the twelve districts a thing it yields — cheaper
   * hiring, cheaper washing, better prices, faster favours, quieter streets,
   * fatter takings — wired into six systems, and the whole rework moved the
   * probe by nothing at all. Stagnation read -0.60 before it and -0.60 after,
   * districts held stayed at six, and the only figure that moved was peak clean
   * by five percent, which is district income arriving passively.
   *
   * That is not evidence the yields are worthless. It is evidence the
   * instrument cannot see them. The baseline bot takes ground to whatever the
   * job gates demand and then stops, and it hands a district over only when it
   * happens to have a spare senior man on a Sunday. **Making ground more
   * valuable cannot change a bot that never asked what ground was worth.**
   *
   * So this arm plays the map the way the rework assumes a player would:
   *
   * - it expands toward a yield it does not already have, rather than toward
   *   the district it is nearest to finishing;
   * - it staffs every district it controls, because an unstaffed holding is a
   *   line on a map and yields nothing;
   * - and it keeps going after the gates are satisfied, because the gates stop
   *   asking at five and there are six kinds.
   *
   * Paired against `RUNS_300`, which plays identically in every other respect.
   * The difference between them is what the map is worth to somebody who wants
   * what is on it — and if that difference is nothing, the rework is nothing
   * and should be said so rather than shipped on faith.
   */
  chasesGround?: boolean;
  /**
   * ...and the same boss, with the work handed to the shipped autopilot.
   *
   * F7, and a bad one: `setAutopilot` has never been called by anything in
   * this project outside its own unit tests. The probe's `matchOps` arm
   * measured the *rule* that went into `autopilot.ts` and then the feature
   * shipped and no instrument has touched it since. Every reading this file
   * has about automation is a reading of a policy written inside the probe.
   *
   * The question the arm asks is the one that follows from the run above.
   * Taking the whole map turned out to be free, and it was free because the
   * bot spends its own jobs opening ground. So: does a boss who hands the
   * work over still get the map?
   *
   * There is a specific reason to think not, and it is visible in the source
   * rather than guessed. `tickAutopilot` works `operableTerritories(state)[0]`
   * — the first entry, every night, for the whole career. That is the exact
   * defect this file found in its own bot years ago and fixed, and the
   * shipped feature has it. Influence is built by working a district, so an
   * autopilot that only ever works one district cannot open a second.
   *
   * If that is what happens, the finding is not about territory. It is that
   * handing over the operations loop quietly hands over the map with it.
   */
  handsOver?: boolean;
  /**
   * What it buys a front *for*.
   *
   * F7, and this one was created by the repair it is measuring. The catalogue
   * used to be a price ladder — seven of ten entries beaten on every quality
   * axis by something else, revenue per dollar flat at 50 per $1,000, capacity
   * and discretion correlating at -0.41 while the file's own header claimed
   * they pulled against each other. So "buy the dearest thing you can cover",
   * which is what this bot has always done, was a perfectly good rule: dearest
   * was strictly best.
   *
   * It is not any more. After the re-cost the dearest front a rich family can
   * buy is `real_estate`, which earns more than anything but the casino and
   * washes $6,000 a week — the *worst* washer on the board. A bot buying by
   * price now walks straight into the lowest-capacity entry in the game, and
   * the probe duly reports that laundering capacity is the binding constraint
   * on 58% of paydays.
   *
   * That reading cannot distinguish two very different worlds:
   *
   *   - the clean economy is structurally short of capacity, which is a real
   *     problem and the thing the third piece of this work was going to fix;
   *   - or a bot is buying badly into a catalogue that stopped rewarding what
   *     it optimises for, and the wall is a *choice* rather than a gap.
   *
   * So: one arm that buys for what a front can move, one that buys for what it
   * earns, both against the baseline that buys for what it costs. The
   * catalogue re-cost was supposed to make those three different families.
   * If they come out the same, it was not a repair, it was a reshuffle.
   */
  frontTaste?: 'washing' | 'earning';
  /**
   * Runs the work heavy, and lets the street see who took it.
   *
   * F7, and the third time in one session that a system read as dead because
   * nothing here had ever chosen it.
   *
   * The first look at fear on 36 ordinary careers came back peak 10 of 100,
   * ending at 0, with **no career ever above 30**, and the obvious reading was
   * that a mechanic with nine tuned constants was delivering a tenth of its
   * value. That reading was wrong, and the reason is one line in this file:
   * `const how: ApproachId = DEFAULT_APPROACH`. Straight carries `fear: 0`.
   * Heavy carries `fear: 2`. **This bot has never once chosen to be
   * frightening**, so every point of fear those careers had was something that
   * happened *to* them — a man hurt on a job that went wrong, a clash in a war,
   * an event answered under pressure.
   *
   * So the arm plays the approach the fear is on. Everything else is
   * unchanged, which makes the pairing exact: `APPROACHES` says heavy takes
   * 30% more, costs four points of odds, runs 1.8x the heat and 3 points of
   * public feeling a job. Whether being feared is worth that bill is the
   * question the game has been asking since approaches were written, and
   * nothing has ever answered it.
   */
  heavy?: boolean;
  /**
   * ...and the same thing done where it actually pays.
   *
   * The arm above runs every job heavy for four years and loses $2.4M on 35
   * careers of 36, which prices *indiscriminate* use and nothing else. This
   * file has made that mistake once already and caught it: cutting people
   * measured -$1,110,650 used nineteen times a career and +$7 used three
   * times, and the distance between those two numbers was the entire feature.
   *
   * Heavy takes 30% more, so it pays in proportion to the size of the job —
   * a third of a big score is real money and a third of a shakedown is not.
   * It costs 1.8x heat, so it is affordable when the street is quiet and not
   * when a task force is forming. Both halves of that are readable off the
   * board before launching, which is what makes this a decision rather than a
   * dice roll, and neither is a figure this bot has to be told.
   *
   * **The rule is fixed before the result is read** and is not iterated
   * afterwards. Raising the bar until an arm comes out ahead is tuning a bot
   * to flatter a mechanic, which is DIRECTOR section 5 in a false beard.
   */
  heavyWhenItPays?: boolean;
  /**
   * What this boss put his points into.
   *
   * Defaults to `BASELINE_BUILD`. An arm that wants a different man supplies
   * one, which is the only way anything in this file will ever price a build
   * against another build.
   */
  build?: Partial<Record<StatId, number>>;
  /**
   * Leans on the people who are talking to them.
   *
   * F7, and the fourth system this session that read as dead because nothing
   * had ever chosen it. `pressureWitness` lives in `investigation.ts`, is
   * reachable from the Law panel, has its own unit test, and **has never been
   * called by anything in this project** — no arm, no bar, no blind round.
   *
   * It matters more than the other three because it is what fear is *for*. The
   * supply side has been tuned twice today without anybody looking at the
   * demand side, and the demand side is this:
   *
   *     costs        $12,000
   *     succeeds at  50% + intimidation x 2.5pts + fear x 25pts
   *     on success   strips 6-14 case strength, and buys 4 more fear
   *     on failure   +16 evidence and +12 heat, on the case you were killing
   *
   * So being feared is not only a discount on defection. It is a 25-point
   * swing on a coin-flip that decides whether an investigation reaches a
   * verdict, and the failure puts sixteen points of evidence into the file you
   * were trying to empty. Whether fear pays for itself is a question about
   * *this* loop, and it has never once been asked.
   *
   * The rule is the plain one and it is fixed before the arm runs: lean on a
   * named suspect when a case is worth worrying about and the money is there.
   */
  leansOnWitnesses?: boolean;
}

/**
 * Days a cycled order is left on one job-and-district pair before it moves.
 *
 * Provisional and due a sweep beside the pattern rate itself. Three weeks is
 * the design target rather than a measured figure: long enough that setting an
 * order still means forgetting about it, against the 234 firings a career this
 * file measured an order making when nothing ever moved it.
 */
const CYCLE_DAYS = 21;

/**
 * How badly a man has to be doing before this bot deals with him.
 *
 * Three losses and more losses than wins. Not a tuned figure and not meant to
 * be: it is the plainest reading of "messing up too many jobs", and the arm
 * exists to find out what happens next rather than to find the best moment to
 * pull the trigger.
 */
/**
 * Where the heat-managing allocator gets quiet, and where it stops.
 *
 * Crude on purpose. The question this arm asks is whether *any* heat sense
 * pushes automation past playing by hand, not whether a well-tuned one does —
 * so a clever policy here would be answering a different question.
 */
const SMART_QUIET_ABOVE = 40;
const SMART_STOP_ABOVE = 65;

/**
 * Where fear starts paying for itself.
 *
 * Not a tuned figure and not a bar. `FEAR.defectionAtMax` and
 * `FEAR.witnessBonusAtMax` both scale from zero, so there is no threshold in
 * the design to read — this is a line drawn across the middle of the scale so
 * "weeks spent frightening" means something countable. It is used for
 * reporting and nothing asserts against it.
 */
/**
 * What the baseline boss puts his points into.
 *
 * One point in each of the seven, which is level two, and seven of the
 * fourteen held back.
 *
 * **The rule is that a baseline must not sit on a threshold.** `worldShare` is
 * zero at and below `WORLD_AT`, which is three, and thirteen of the fourteen
 * nicknames grant a point in a stat. A build that stops exactly on three
 * therefore turns every name the street hands out into world pull for that
 * career — the control moves whenever the thing being measured fires. Level
 * two absorbs a granted point and stays at zero, which is the same rule
 * DIRECTOR section 5 states for bars, applied to the control instead.
 *
 * The seven unspent points are the cost of that and are not hidden: nothing in
 * the simulation reads `pointsLeft`, so they change nothing, and a player who
 * holds points back is a real player. What this bot is not is a player with a
 * *good* build. No bar in this file can say whether a build is worth having.
 * That needs its own arm with its own `build`, paired against this one.
 *
 * ## Two versions of this were wrong, and the second was wrong quietly
 *
 * **The first was concentrated and it revalued the game.** It read
 * `{ method: 4, grip: 3, ledger: 5, word: 2 }`, and these numbers are points
 * spent *above the floor* — so `ledger: 5` is level six, `worldPull` 0.43, and
 * a laundering cut of 0.133 against the 0.24 every recorded figure in this
 * file was taken at. Nearly halved. Four bars went red at once.
 *
 * **The second was a flat fourteen — two everywhere, level three, and
 * numerically inert.** `worldPull` 0.000 on all seven and no verb open, which
 * looked like the answer and was not: it put every stat on the cliff edge
 * above, so a single granted point crossed it. Four bars stayed red, and a
 * *different* four.
 *
 * ## What the sweep actually found
 *
 * Four full runs, one variable at a time, red bars in the last column:
 *
 *     baseline              nicknames  top shape verdict            red
 *     3/3/2/2/2/1/1         on         don 15, fin 13, king  6       3
 *     flat 2 (level 3)      on         fin 17, don  9, king  8       4
 *     flat 2 (level 3)      OFF        don 14, king 11, fin  8       2
 *     1 each (level 2)      on         fin 15, king 10, don  9       4
 *     1 each + own stream   on         don 15, king 10, fin  8       1
 *
 * The one bar left standing after that was the shape verdicts, and it was not
 * about builds either: `donRespect` had never been plotted and sat below the
 * 25th percentile of the respect it reads. Re-plotted against the distribution
 * this file now prints, the suite is green.
 *
 * The build was never the whole story. Nicknames were, through two channels,
 * and the third row is what separated them: with the weekly roll switched off
 * the population came back to within one career of what this file had
 * recorded, on a baseline that was otherwise unchanged.
 *
 * The first channel was the roll itself. `tickNickname` drew from `state.rng`,
 * so a cosmetic weekly check moved every job outcome, defection test and heat
 * event by one call a week from day 120 on, and four bars that sit within one
 * to three careers of their thresholds flipped. That is fixed in
 * `sim/nicknames.ts`, which now derives its own stream from seed and day; the
 * precedent is `Rng.stableNoise`, written for exactly this hazard.
 *
 * The second channel is real and stays: a granted point is a granted point,
 * and the shape verdicts moved because grip keeps crews together. That is the
 * feature working.
 *
 * That is the risk the standing-order plan wrote down in as many words —
 * *"recorded numbers move"* — walked into by the person who wrote it, twice,
 * and it took four runs to separate the instrument from the thing it measures.
 */
const BASELINE_BUILD: Partial<Record<StatId, number>> = {
  method: 1,
  grip: 1,
  ledger: 1,
  word: 1,
  muscle: 1,
  instinct: 1,
  stomach: 1,
};

const FEARED_ABOVE = 30;

/**
 * When a job is worth doing loudly, and when the street is quiet enough for it.
 *
 * Heavy pays 30% more and costs four points of odds, 1.8x heat and three
 * points of public feeling. So it earns its keep on the jobs where 30% is a
 * large number, and only while there is heat budget to spend. $20,000 is the
 * top of the ordinary board and 45 is comfortably under the 70 this bot lays
 * low at — both chosen before the arm ran once, and neither revisited after.
 */
/**
 * How strong a case has to be before it is worth leaning on somebody.
 *
 * `PRESSURE_WITNESS` strips 6 to 14 points and puts 16 back on a miss, so
 * leaning on a case weaker than the backfire is spending $12,000 to make
 * things worse. Twenty is comfortably above that and comfortably below the
 * strength that convicts. Fixed before the arm ran once.
 */
const LEAN_ON_CASE_ABOVE = 20;

const HEAVY_WORTH_IT = 20_000;
const HEAVY_QUIET_BELOW = 45;

const CUT_FAILURES_BEFORE = 3;

/**
 * And what "genuinely a disaster" means, for the arm that does this sparingly.
 *
 * Six losses against fewer than half as many wins, at most three times in four
 * years. Both fixed before that arm was run once, and not revisited after.
 */
const CUT_FAILURES_SPARING = 6;
const CUT_MOST_SPARING = 3;

function climb(seed: number, days: number, policy: Policy = {}): Climb {
  const state = newGame({ name: 'Ladder', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  // The shipped switch, thrown on the first morning and never touched again.
  if (policy.handsOver) setAutopilot(state, true);

  /*
     The boss places his points, because a boss who does not is nobody.

     F7, and the fourth of the session. `config/build.ts` gives a career 14
     points to distribute across seven stats and this bot placed none of them,
     so every figure in this file was describing a man at the floor of
     everything — a career no player would ever have. It is the same defect as
     a bot that never chose the heavy approach, never bought for capacity and
     never wanted a district for what it yields.

     It showed up as a regression rather than as a blind spot, which is the
     only luck in it. `launderCut` used to read `attributes.business`, an
     attribute that grew by use, so the bot bought its own cut down over a
     career without ever deciding to. Ledger replaced it, the bot places
     nothing, and the cut stayed at the ceiling for three hundred days.

     The spread below is not a build a player would call clever. It is the
     plainest reading of "spend it on the things this bot actually does": it
     works, it holds people, it launders. Whether a *good* build beats it is a
     separate question and wants its own arms — the point here is only that the
     baseline stops being a man with nothing.
  */
  const chosen = policy.build ?? BASELINE_BUILD;
  for (const id of Object.keys(chosen) as StatId[]) {
    for (let i = 0; i < (chosen[id] ?? 0); i++) spendPoint(state, id);
  }
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
  /** Where each student started, and which pairings have been counted. */
  const before = new Map<string, number>();
  const settled = new Set<string>();
  /** Gear that ever reached a kit, and gear the police ever came away with. */
  const landed = new Set<string>();
  const recovered = new Set<string>();
  /** Where the one standing order went, and how much it ever ran. */
  const auto = {
    setDay: null as number | null,
    job: null as string | null,
    moves: 0,
  };
  /** What the risk-matched allocator did, for the arm that tests it. */
  const matched = { launched: 0, oddsSum: 0 };
  /** What a bot that deals with its worst people did, for the arm that tests it. */
  const cutting = {
    tried: 0,
    landed: 0,
    marksOut: 0,
    marksLanded: 0,
    marksLapsed: 0,
    talked: 0,
    firstDay: null as number | null,
  };
  /** Marks already counted, so an ending is tallied once and not every day. */
  const marksSeen = new Set<string>();
  /*
     Fear, what the boss owns, and whether anybody is still at home.

     Watched weekly rather than read at the end, because two of the three are
     claims that expire — fear decays 1.4 a week and neglect only ever rises
     between visits, so a final reading of either says what last Tuesday was
     like and nothing about the career.
  */
  const leaning = { tried: 0, landed: 0, backfired: 0, strengthMoved: 0 };
  let heavyRuns = 0;
  let peakFear = 0;
  let weeksFeared = 0;
  let peakNeglect = 0;
  let homeVisits = 0;
  let neglectBefore = 0;

  const teaching = {
    started: 0,
    finished: 0,
    /** Points of skill the students actually came back with. */
    gained: 0,
    /** Weeks a pairing was holding two men off the board. */
    weeksPaired: 0,
    firstDay: null as number | null,
  };
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
  const launchedBy: Record<string, number> = {};
  let fundsAtTier4: number | null = null;
  let tier4Day: number | null = null;
  let couldAffordDay: number | null = null;
  /** The cheapest paid tier-4 job, which is the bar a player has to clear. */
  const TIER4_BAR = 50_000;
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
    worstRouteSentiment: 100,
    routeWentHostile: false,
    routedFeeling: null as number | null,
    unroutedFeeling: null as number | null,
    /** Districts a route was ever open in, for the paired reading at the end. */
    routedIds: new Set<string>(),
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
    /*
       The three unmeasured systems, watched every week.

       A visit is counted by the neglect *falling*, because the bot never
       presses the button — `goHome` is reachable only through an event choice
       in `eventgen.ts` and through a control on the Yourself screen, and
       neither is something this bot does. If this counter reads zero across
       thirty-six careers then nothing in four years of play ever went home,
       which is itself the finding.
    */
    if (state.day % 7 === 0) {
      peakFear = Math.max(peakFear, state.org.fear);
      if (state.org.fear >= FEARED_ABOVE) weeksFeared += 1;
      const now = home(state).neglect;
      peakNeglect = Math.max(peakNeglect, now);
      if (now < neglectBefore - 1) homeVisits += 1;
      neglectBefore = now;
    }

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

    /*
       Dealing with the people who keep costing you money.

       Weekly, like the hiring above it and for the same reason: this is a
       decision a boss makes looking at a sheet, not one he makes every
       morning. The rule is the one the feature was asked for — a man with a
       bad enough record, once there is a record to read.

       Deliberately not clever about *which* bad earner. Picking the cheapest
       to remove would be the bot playing the mechanic rather than exercising
       it, and what needs measuring is what happens after the roll, not whether
       a bot can optimise a roll.
    */
    /*
       Leaning on somebody who is talking, which is the only thing fear is
       ever spent on.

       Weekly, like every other decision this bot takes. One a week at most —
       a family that leans on four people in an afternoon is not being careful,
       and the backfire puts evidence into the case rather than taking it out.
    */
    if (policy.leansOnWitnesses && state.day % 7 === 0) {
      const worth = activeCases(state)
        .filter((c) => c.strength >= LEAN_ON_CASE_ABOVE && c.suspectIds.length > 0)
        .sort((a, b) => b.strength - a.strength)[0];
      if (worth && totalFunds(state) >= PRESSURE_WITNESS.cost * 2) {
        const who = worth.suspectIds.find((id) => state.npcs[id]?.status === 'active');
        if (who) {
          /*
             Counted before the result is read, and the first version was not.

             `pressureWitness` returns `ok: false` when the witness goes
             straight to them, so `if (out.ok) leaning.tried += 1` counted only
             the attempts that worked. The arm duly reported "tried 16, landed
             16" on both populations — a 100% success rate on an action whose
             own config puts the ceiling at 90% — and the bar asking whether
             fear helps it land passed against two numbers that were the same
             number by construction. An attempt is an attempt whatever came of
             it.
          */
          const before = worth.strength;
          leaning.tried += 1;
          const out = pressureWitness(state, rng, worth.id, who);
          if (out.ok) {
            leaning.landed += 1;
            leaning.strengthMoved += before - worth.strength;
          } else {
            leaning.backfired += 1;
          }
        }
      }
    }

    if ((policy.cuts || policy.cutsRarely) && state.day % 7 === 0) {
      // A boss who only does this when somebody is a genuine disaster, and
      // even then not often. Both figures fixed before the arm was ever run.
      const sparing = !!policy.cutsRarely;
      const needs = sparing ? CUT_FAILURES_SPARING : CUT_FAILURES_BEFORE;
      const spent = sparing && cutting.tried >= CUT_MOST_SPARING;
      const worst = spent
        ? undefined
        : crewList(state)
            .filter(
              (n) =>
                n.status === 'active' &&
                n.opsFailed >= needs &&
                (sparing ? n.opsFailed > n.opsCompleted * 2 : n.opsFailed > n.opsCompleted),
            )
            .sort((a, b) => b.opsFailed - a.opsFailed)[0];
      if (worst && canSilence(state, worst.id).ok) {
        cutting.tried += 1;
        cutting.firstDay = cutting.firstDay ?? state.day;
        const before = liveMarks(state).length;
        silence(state, rng, worst.id);
        if (worst.status === 'dead') cutting.landed += 1;
        if (liveMarks(state).length > before) cutting.marksOut += 1;
      }
    }

    /*
       And how the marks ended, tallied once each.

       Both endings matter and a zero in either is a finding: a mechanic that
       always lands is a delayed certainty, and one that never does is
       decoration with a heat cost.
    */
    for (const mark of state.marks ?? []) {
      if (mark.status === 'out' || marksSeen.has(mark.id)) continue;
      marksSeen.add(mark.id);
      if (mark.status === 'landed') cutting.marksLanded += 1;
      if (mark.status === 'lapsed') cutting.marksLapsed += 1;
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
       And the arm that actually wants what the ground gives fills every one.

       The block above hands over one district a week and only while
       `needsSteward` says so, which is a bot tidying up rather than a bot
       collecting yields. A holding with nobody in it is worth nothing at all —
       that is the whole condition `workingHoldings` enforces — so a player
       chasing yields staffs everything he holds, every time, and the arm has
       to do the same or it is measuring the rework with the rework switched
       off.

       Controlled ground only, because that is the bar a yield is paid at.
    */
    if (policy.chasesGround && state.day % 7 === 0) {
      for (const t of controlledTerritories(state)) {
        if (t.stewardId) continue;
        const man = [...eligibleStewards(state)].sort(
          (a, b) => ROLE_ORDER.indexOf(b.role) - ROLE_ORDER.indexOf(a.role),
        )[0];
        if (!man) break;
        putInCharge(state, man.id, t.id);
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

      /*
         What it is shopping for.

         The default is unchanged and is the rule every recorded figure in this
         file was taken under: the dearest thing the money covers. The two
         tastes rank the same catalogue by what a front gives per dollar spent,
         which is the comparison a player makes standing in front of the panel
         and the one the re-cost exists to make answerable.
      */
      const catalogue =
        policy.frontTaste === 'washing'
          ? [...BUSINESSES].sort((a, b) => b.launderCapacity / b.cost - a.launderCapacity / a.cost)
          : policy.frontTaste === 'earning'
            ? [...BUSINESSES].sort((a, b) => b.revenue / b.cost - a.revenue / a.cost)
            : [...BUSINESSES].sort((a, b) => b.cost - a.cost);
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
    /*
       Put the green men with the good ones, when the policy says to.

       Weekly rather than daily, and only when the bench can afford it: a
       pairing takes two men for twelve days, and this bot already competes
       with itself for bodies through scores, stewards and the jobs loop. The
       rule is the plainest one that is still a decision — the widest gap on
       the bench, and only while somebody is still spare afterwards.
    */
    if (policy.trains && state.day % 7 === 0) {
      const spare = idle(state);
      if (spare.length >= TRAIN_BENCH) {
        const ranked = [...spare].sort((a, b) => b.stats.skill - a.stats.skill);
        const teacher = ranked[0];
        const student = ranked[ranked.length - 1];
        if (startTraining(state, teacher.id, student.id)) {
          teaching.started += 1;
          if (teaching.firstDay === null) teaching.firstDay = state.day;
        }
      }
    }
    if (policy.trains && state.day % 7 === 0) {
      if (liveTraining(state).length > 0) teaching.weeksPaired += 1;
    }

    /*
       Hand it over, when the policy says to.

       Set once, on the best job on the board, and never revisited — no
       re-pointing it as the board opens and no calling it off when the heat
       climbs. `tickStandingOrders` in the pipeline does the launching from
       here on, and the jobs loop below is skipped entirely for this arm.
    */
    if ((policy.auto || policy.autoPlus || policy.autoCycled) && !isLayingLow(state)) {
      /*
         Move it on before the pair wears a groove.

         On a clock rather than on a reading of the pattern, for two reasons.
         It is what a player actually does once the game has told them once —
         nobody sits watching a meter — and it keeps this arm's behaviour
         identical before and after the pattern mechanic exists, which is the
         only thing that makes the control run above worth having.
      */
      const live = liveStanding(state);
      if (policy.autoCycled && live[0] && state.day - live[0].setDay >= CYCLE_DAYS) {
        cancelStanding(state, live[0].id);
        auto.moves += 1;
      }

      if (liveStanding(state).length === 0) {
        /*
           The hand-over arm takes the best job it can see. The alongside arms
           take the *worst* one worth running — which is what a player actually
           automates: the grind they no longer want to click, while they keep
           the big work for themselves.
        */
        const board = [...availableOperations(state)]
          .filter((o) => !SETUP_BY_ID[o.id] && o.crewRequired > 0)
          .sort((a, b) => ev(b) - ev(a));
        /*
           The job is chosen once and then kept, which the first version of
           this arm got wrong.

           It re-ran the line below on every move, so a "rotation" changed the
           district *and* the job — and `board[board.length - 1]` is the worst
           thing on the board, which gets worse as the board grows. The arm
           was therefore drifting onto longer and more expensive work over a
           career while claiming to isolate the district. That is most of why
           its firing collapsed from 170 to 79, and it had nothing to do with
           the mechanic under test.

           Keeping the job fixed is what makes this a rotation arm rather than
           two changes wearing one name.
        */
        const pick = auto.job
          ? OPERATION_BY_ID[auto.job]
          : policy.auto
            ? board[0]
            : board[board.length - 1];
        /*
           And somewhere new each time — but somewhere this family already
           stands, which is not the same thing.

           The first version walked round every district it was *allowed* to
           work, in whatever order `operableTerritories` returned them. That
           reads like the counterplay and is not: a district with no presence
           in it carries `UNFAMILIAR_SUCCESS_PENALTY` and whatever police sit
           on it, so the naive rotation was buying the groove's cure by
           walking into a worse room. Measured, with the pattern live, it cut
           the arm's firing from 207 a career to 109 and left the gap between
           moving and leaving exactly where it had been without the mechanic
           at all — the mechanic was charging the static arm properly and the
           counterplay was paying for itself twice.

           A player rotating a grind moves it between places they already
           work. `hasPresence` is the same condition the odds model reads, so
           this asks for nothing the game does not already say out loud.

           The static arms are untouched: they always land on the first entry,
           which is what they did before this branch existed.
        */
        const spots = operableTerritories(state);
        const known = spots.filter((s) => hasPresence(s.territory));
        const round = known.length > 0 ? known : spots;
        const spot = round[auto.moves % Math.max(1, round.length)]?.territory.id;
        if (spot && pick && setStanding(state, pick.id, spot, 'best')) {
          auto.setDay = auto.setDay ?? state.day;
          auto.job = pick.id;
        }
      }
    }

    if (!isLayingLow(state) && state.org.heat >= 70) startLayLow(state);
    /*
       How the work gets done.

       Hard-coded to `standard` since approaches were written, which is why
       fear read as a dead system: the only deliberate source of it in the
       whole game is the heavy approach, and nothing here ever picked it.
    */
    const how: ApproachId = policy.heavy ? 'heavy' : DEFAULT_APPROACH;
    /*
       And the version that reads the room first.

       Big enough to be worth the odds, quiet enough to afford the heat. Both
       thresholds written before the arm was ever run.
    */
    const heavyNow = (def: { payout: readonly number[] | number[] }) =>
      policy.heavyWhenItPays &&
      def.payout[1] >= HEAVY_WORTH_IT &&
      state.org.heat <= HEAVY_QUIET_BELOW;

    if (!isLayingLow(state) && !policy.auto && !policy.handsOver) {
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

      /*
         The capital wall, watched rather than assumed.

         Tier 4 opens on ground and bodies and says nothing about money, so the
         day it opens is the day the player is *allowed* to take work they may
         not be able to pay for. What is recorded is the gap: funds the day it
         opened, and the first day after that they could cover the cheapest
         paid job at that rank.
      */
      if (tier4Day === null && OPERATIONS.some((o) => o.tier === 4 && (o.opens?.met(board) ?? true))) {
        tier4Day = state.day;
        fundsAtTier4 = state.org.cash + state.org.dirtyCash;
      }
      if (tier4Day !== null && couldAffordDay === null &&
          state.org.cash + state.org.dirtyCash >= TIER4_BAR) {
        couldAffordDay = state.day;
      }

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
      /*
         ...or, for the arm that wants what the ground gives, how many kinds
         it is still missing.

         The gates ask for five districts and stop asking. There are six
         yields, and a career that satisfies the gates has no reason under the
         baseline rule to take a sixth — so the rework's central claim, that
         the map is a set of competing reasons, has never once been tested by
         anything in this file. This substitutes the yield count for the gate
         count and leaves the effort rule below exactly as it is, so the two
         arms differ in *where* they push and *how long*, and in nothing else.
      */
      const missing = policy.chasesGround
        ? (Object.keys(YIELDS) as YieldKind[]).filter((k) => !yieldsHeld(state).includes(k)).length
        : 0;
      const short = policy.chasesGround
        ? missing
        : wanted - controlledTerritories(state).length;
      /*
         And it goes where the thing it does not have is.

         `unfinished[0]` is the district nearest to being held, which is the
         right rule for a bot that only wants ground. A bot that wants a
         *reason* takes the nearest district carrying a yield it is missing,
         and falls back to the nearest district when every kind is already in
         hand. Same ordering underneath — only the first key is new.
      */
      const queue = policy.chasesGround
        ? [...unfinished].sort((a, b) => {
            const held = yieldsHeld(state);
            const wantA = held.includes(yieldOf(a.territory.id)!) ? 1 : 0;
            const wantB = held.includes(yieldOf(b.territory.id)!) ? 1 : 0;
            if (wantA !== wantB) return wantA - wantB;
            return playerInfluence(b.territory) - playerInfluence(a.territory);
          })
        : unfinished;
      const expanding =
        short > 0 && queue.length > 0 && state.day % 21 < (short === 1 ? 7 : short === 2 ? 14 : 21);
      const where =
        (expanding ? queue[0] : (strongest[0] ?? queue[0]))?.territory.id ?? null;
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
        /*
           The allocator under test: best and most careful on the worst work.

           Jobs by risk descending, and for each one the strongest crew still
           standing. By the time it reaches the safe jobs only the weaker men
           are left, which is exactly the arrangement a player would set up by
           hand if they were willing to do it every single morning.

           It replaces the loop below rather than reordering it, because the
           thing being measured is the *assignment*, and the loop below hands
           out `idle().slice(0, bodies)` — whoever happens to be first.
        */
        if (policy.matchOps || policy.matchOpsSmart) {
          /*
             Managing the attention, for the arm that is allowed to.

             Two levers and both are the obvious ones: get quieter as it
             climbs, and stop when it is bad. Deliberately crude — the question
             is whether *any* heat sense crosses the line, not whether a clever
             one does.
          */
          const smartHeat = policy.matchOpsSmart ? state.org.heat : 0;
          if (smartHeat >= SMART_STOP_ABOVE) {
            if (launchEra[0] + launchEra[1] + launchEra[2] === launchedBefore) deadDays += 1;
          } else {
          /*
             Two passes, so that only the *assignment* differs from the hand.

             The first version of this also reordered which jobs ran — risk
             first instead of expected value — and duly lost by a million: it
             spent the bench and the stake on the most dangerous work on the
             board before it got to the work that pays. That was a test of two
             changes at once, and only one of them was the idea.

             So: pass one picks the same jobs the hand would pick, in the same
             expected-value order, against a running count of bodies. Pass two
             hands the crews out — riskiest job first, strongest men first — so
             the best people end up on the worst work and whoever is left takes
             the safe jobs. Nothing about *what* runs has changed.
          */
          const byRisk = { extreme: 3, high: 2, moderate: 1, low: 0 } as const;
          const taking: typeof options = [];
          let bodiesLeft = idle(state).length;
          for (const def of options) {
            // Quieter work only, once they are already looking at you.
            if (smartHeat >= SMART_QUIET_ABOVE && byRisk[def.risk] > 1) continue;
            const bodies = crewNeeded(state, def);
            if (bodies > bodiesLeft) continue;
            if (operationCost(state, def) > spendable) continue;
            taking.push(def);
            bodiesLeft -= bodies;
          }

          for (const def of [...taking].sort((a, b) => byRisk[b.risk] - byRisk[a.risk])) {
            const bodies = crewNeeded(state, def);
            const free = idle(state);
            if (free.length < bodies) continue;
            const best = [...free].sort((a, b) => crewCompetence([b]) - crewCompetence([a]));
            const sc = scoreOn(state, def.id);
            const out = clean('jobs', () =>
              launchOperation(
                state,
                def.id,
                best.slice(0, bodies).map((n) => n.id),
                sc ? sc.territoryId : where,
              ),
            );
            if (out) {
              launchEra[state.day < 90 ? 0 : state.day < 180 ? 1 : 2] += 1;
              launchedBy[def.id] = (launchedBy[def.id] ?? 0) + 1;
              matched.launched += 1;
              matched.oddsSum += out.successChance;
            }
          }
          if (launchEra[0] + launchEra[1] + launchEra[2] === launchedBefore) deadDays += 1;
          }
        }

        for (const def of policy.matchOps ? [] : options) {
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
              heavyNow(def) ? 'heavy' : how,
            ),
          );
          if (out) {
            if (heavyNow(def)) heavyRuns += 1;
            launchEra[state.day < 90 ? 0 : state.day < 180 ? 1 : 2] += 1;
            launchedBy[def.id] = (launchedBy[def.id] ?? 0) + 1;
            // Recorded on every arm, not only the allocator's, or the two
            // columns would be quoted in different currencies.
            matched.launched += 1;
            matched.oddsSum += out.successChance;
          }
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
      /*
         The shopping block stood here and the shop it used is gone.

         See the note above the deleted `somewhere for the money to go` block:
         0 of 36 ordinary careers ever bought a possession, so every figure
         this arm produced was a figure about a bot that had been told to.
      */
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

      for (const trade_ of TRADE_IDS) {
        for (const id of state.contraband?.routes[trade_] ?? []) {
          const where = state.territories[id];
          if (!where) continue;
          trade.routedIds.add(id);
          trade.worstRouteSentiment = Math.min(trade.worstRouteSentiment, where.sentiment);
          if (where.sentiment < SENTIMENT_HOSTILE_BELOW) trade.routeWentHostile = true;
        }
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
    if (policy.trains) {
      for (const run of state.training ?? []) {
        if (run.status !== 'done' || settled.has(run.id)) continue;
        settled.add(run.id);
        teaching.finished += 1;
        teaching.gained += (state.npcs[run.studentId]?.stats.skill ?? 0) - (before.get(run.id) ?? 0);
      }
      for (const run of liveTraining(state)) {
        if (!before.has(run.id)) {
          before.set(run.id, state.npcs[run.studentId]?.stats.skill ?? 0);
        }
      }
    }
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
      worstRouteSentiment: trade.worstRouteSentiment,
      routeWentHostile: trade.routeWentHostile,
      ...(() => {
        // Held districts, split by whether anything was ever run through them.
        // Both sides come from the same career, so the ordinary business of
        // being a family — jobs, orders, the standing orders that grind a
        // corner — is on both sides of the subtraction.
        const held = territoryList(state).filter((t) => playerInfluence(t) >= 10);
        const mean_ = (xs: number[]) =>
          xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
        return {
          routedFeeling: mean_(
            held.filter((t) => trade.routedIds.has(t.id)).map((t) => t.sentiment),
          ),
          unroutedFeeling: mean_(
            held.filter((t) => !trade.routedIds.has(t.id)).map((t) => t.sentiment),
          ),
        };
      })(),
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
      /*
         What `careerShape` actually compares against: the estate *now*, not
         the peak `bestEstate` keeps. Two placements of `financierEstate` were
         sized against the wrong one of those.
      */
      finalEstate: estate(state).total,
      finalRespect: state.org.respect,
      tables: {
        weeksOpen: newSys.tableWeeks,
        weeksWorthSitting: newSys.worthSitting,
        respectAtLeast: newSys.respectAtLeast,
        weeks: newSys.weeks,
      },
      matched,
      auto: {
        ...auto,
        launched: (state.standing ?? []).reduce((n, o) => n + o.launched, 0),
      },
      cutting: {
        ...cutting,
        /*
           What the men who got away told them, totalled at the end.

           Read off the evidence rather than counted as it is filed, because
           the point is what is on the books when the career finishes — a trace
           that went cold on its own never cost anybody anything.
        */
        talked: Object.values(state.evidence)
          .filter((e) => e.detail.includes('has been talking to somebody again'))
          .reduce((sum, e) => sum + e.strength, 0),
      },
      leaning,
      self: {
        heavyRuns,
        peakFear: Math.round(peakFear),
        finalFear: Math.round(state.org.fear),
        weeksFeared,
        owned: heldPossessions(state).length,
        ownedWorth: Math.round(possessionsWorth(state)),
        peakNeglect: Math.round(peakNeglect),
        finalNeglect: Math.round(home(state).neglect),
        visits: homeVisits,
        depositionRisk: Number(neglectRisk(state).toFixed(2)),
      },
      ground: {
        working: workingHoldings(state).length,
        kinds: yieldsHeld(state).length,
        controlled: controlledTerritories(state).length,
        stewards: territoryList(state).filter((t) => t.stewardId).length,
      },
      teaching,
      /*
         Who is still standing at the end, and who is on the books.

         `lost` and `wash.crewWeeks` were already collected on every arm and
         never read by any automation bar, so a mechanic could have been
         hollowing out a roster while every figure those bars print — estate,
         firings, odds, heat — stayed exactly the same. That is the same blind
         spot F7 keeps naming, one level down: the instrument was measuring the
         money an organization made and not whether an organization was left.
      */
      crewLeft: crewList(state).filter(
        (n) => n.status !== 'dead' && n.status !== 'arrested' && n.status !== 'defected',
      ).length,
      /** What the roster is actually worth, which is the point of all this. */
      crewSkill: (() => {
        const xs = crewList(state)
          .filter((n) => n.status !== 'dead')
          .map((n) => n.stats.skill)
          .sort((a, b) => a - b);
        return {
          median: xs.length ? xs[Math.floor(xs.length / 2)] : 0,
          best: xs[xs.length - 1] ?? 0,
          floor: xs[0] ?? 0,
        };
      })(),
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
    launchedBy,
    fundsAtTier4,
    tier4Day,
    couldAffordDay,
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
      dominatedAtEnd: territoryList(state).filter((t) => controlLevel(t) === 'dominance').length,
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
/**
 * Bodies that have to be spare before the bot will pair two of them.
 *
 * A pairing costs two men for twelve days and this bot already competes with
 * itself for bodies. Four is the plainest guard that leaves somebody behind to
 * work — it is not a claim about the right number, it is what stops the arm
 * measuring a family that trained itself into having nobody to send.
 */
const TRAIN_BENCH = 4;

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

   **A hundred and twenty was not quite enough, and the arithmetic says so.**
   `helpers.resolves` puts the reading at 35.2% on 2,562 late situations
   against a bar of 33.3% — a margin of 1.8 points against a sampling error of
   0.9 — and asks for about 2,642. Eighty short. The note above is its own
   evidence for this without meaning to be: two disjoint seed windows read
   35.7% and 36.1% against 34.5% here, a spread across windows as wide as the
   margin over the bar.

   And the binomial error there is the generous reading. Late situations
   cluster inside careers rather than arriving independently, so the effective
   sample is nearer the number of careers than the number of memos, and the
   real error is larger than 0.9.

   ## And it is not the only bar that needs it, so it is not named for one

   `helpers.resolves` was pointed at the three share bars in this file that
   have flipped on somebody else's change, and it refused all three:

       bar                     reading            error   needs
       the generated supply    35.2% vs 33.3%      0.9%   2,642 situations
       the shape verdicts      30.6% vs 40.0%      8.2%     108 careers
       the prepared job        38.9% vs 33.3%      7.9%     288 careers

   This population is `climb(700 + i, HUMAN_DAYS)`, which is exactly what
   `RUNS_300` is — the same call on the same seeds, thirty-six of them. So it
   is a strict superset, the other two bars can read it instead of their own
   thirty-six, and the widest of the three requirements costs nothing that was
   not already being paid.

   288, which is the largest of the three. Renamed off `WIDE` because a
   name that says "memo" would be wrong for a population three bars read.
*/
const WIDE = Array.from({ length: 288 }, (_, i) => climb(700 + i, HUMAN_DAYS));

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
    const lived = WIDE.filter((r) => r.days >= 240);
    const late = lived.map((r) => r.memos.lateAndNew);
    const mid = median(late);

    const fromGenerator = lived.reduce((n, r) => n + r.memos.lateGenerated, 0);
    const allLate = lived.reduce((n, r) => n + r.memos.lateAndNew, 0);

    // eslint-disable-next-line no-console
    console.log(
      `memos: ${lived.length}/${WIDE.length} careers reached day 240\n` +
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

       **Green, at 34%, and the bar never moved.** Three more shapes, for the
       three systems that shipped after `eventgen.ts` was written: the name the
       street gave you, the old owner still sitting in a front you bought off
       somebody, and a street that pays because it is frightened of you. All
       three are gated on things only a long career has, which is where the
       supply was thin — every earlier shape fires on a man, a front, a street
       or a case, all of which an eight-week-old family already owns.

           reading                                     before   after
           new situations after day 180 (median)          21       21
           shapes never seen before day 180                6        7
           the generator's share of them                  31%      34%

       The volume did not move and was never the problem. What moved is where
       the late situations come from, which is the thing the claim was about.

       One thing about how it is read, not about the number: the margin over
       the bar is small enough that thirty-six careers cannot resolve it, so
       this test alone runs a wider sample — see `WIDE`. Adding two houses
       to the pool in config/houses.ts once moved this reading 2.4 points
       without changing any behaviour at all, because the same thirty-six seeds
       draw different cities out of a larger pool.
    */
    expect(lived.length, 'nothing lived long enough to have a back half').toBeGreaterThan(8);
    expect(allLate, 'no late situations at all, so the share below is meaningless').toBeGreaterThan(20);
    /*
       Rule 4. This bar is the reason the helper exists: it read 34% against a
       third on thirty-six careers, and two houses added to `config/houses.ts`
       moved it to 32.3% with no behaviour change at all. The sample was
       widened to a hundred and twenty for exactly this, and the guard is what
       stops the next person having to find that out the way the last two did.
    */
    const supply = resolves(fromGenerator, allLate, 1 / 3);
    expect(supply.ok, supply.why).toBe(true);
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

       **Both are fixed, and both were the same defect.** Each was reading a
       quantity the game presses every career against and then stops: public
       feeling cannot rise past `SENTIMENT_START`, and nothing anywhere asks
       for a fourth district. A bar cannot be placed inside a range that has no
       inside. The alderman reads legitimate business in ground that does not
       resent you; the union reads the payroll. `config/civic.ts` carries both
       plots.

           before   captain 24 · union 36 · judge 16 · alderman  0
           after    captain 28 · union 17 · judge 15 · alderman 17
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

       **Went red when the bot was fixed, and the bar was not the problem.**
       With the bot idle on two days in five this read kingpin 12, don 10,
       diplomat 8, unremarkable 4, financier 2. A family that actually works
       read kingpin 35 of 36, because the shape counted districts at a
       *foothold* and the histogram of that was `2:1 3:1 4:31 5:3` — a point
       mass, where no value of any bar separates anybody.

       `careerShape` counts dominance now, and after `donRespect` was re-plotted
       it reads kingpin 10, financier 8, unremarkable 8, diplomat 7, don 3.
       Recorded in `config/legacy.ts` beside both bars.

       **The Don was the next one to go, and for the same reason.** Nicknames
       pay grip, grip keeps crews together, crews that stay earn respect — and
       `donRespect` was the one bar in `SHAPE_BARS` nobody had ever plotted, at
       260 against a population reading 396 / 558 / 669 / 862. Below the 25th
       percentile. It became the verdict on 42% of careers and the fault was
       never in the careers.

       That is three placements in this pass — the union boss, the alderman and
       now the Don — where the reading was wrong before the bar was, and it is
       the same lesson every time: print the distribution first.

       The instrument, not the bar. That is the third time in this pass, after
       the union boss and the alderman.
    */
    /*
       What the Kingpin bar is actually reading, printed because it turned out
       to have no spread at all. See the note under the assertion.
    */
    const d = RUNS_300.map((r) => r.bestDistricts).sort((a, b) => a - b);
    const hist = new Map<number, number>();
    for (const n of d) hist.set(n, (hist.get(n) ?? 0) + 1);
    /*
       And the band the Kingpin bar actually counts, which is not the one above.

       `careerShape` reads districts at *dominance* on the last day.
       `bestDistricts` is the record's high-water mark at a lower band, and the
       two previous re-plots of `kingpinDistricts` were done against a
       histogram typed into a comment by hand because nothing captured this.
    */
    const dom = RUNS_300.map((r) => r.influence.dominatedAtEnd).sort((a, b) => a - b);
    const domHist = new Map<number, number>();
    for (const n of dom) domHist.set(n, (domHist.get(n) ?? 0) + 1);
    /*
       And the half the Kingpin is about to gain, plotted before it is placed.

       Dominating four districts cannot separate anybody: the histogram above
       tops out at four and sixteen careers of thirty-six sit on the ceiling,
       so there is no value between the median and the 75th that satisfies the
       horoscope condition. Ground you actually *run* — held at control with
       your own people standing in it — is the quantity the shape's own verdict
       already claims, and this is what it looks like across a population.
    */
    const ran = RUNS_300.map((r) => r.newSystems.ground.working).sort((a, b) => a - b);
    const ranHist = new Map<number, number>();
    for (const n of ran) ranHist.set(n, (ranHist.get(n) ?? 0) + 1);
    // eslint-disable-next-line no-console
    console.log(
      `         districts RUN at day 300 (held and staffed) — ` +
        [...ranHist].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}: ${n}`).join(', ') +
        ` · median/60th/75th/90th ${median(ran)} / ${pct(ran, 0.6)} / ${pct(ran, 0.75)}` +
        ` / ${pct(ran, 0.9)}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `         districts DOMINATED at day 300 — ` +
        [...domHist].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}: ${n}`).join(', ') +
        ` · median/60th/75th/90th ${median(dom)} / ${pct(dom, 0.6)} / ${pct(dom, 0.75)}` +
        ` / ${pct(dom, 0.9)} (the kingpin bar is ${SHAPE_BARS.kingpinDistricts})`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `         districts held at day 300 — ` +
        [...hist].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}: ${n}`).join(', ') +
        ` · 40th/median/75th/90th ${pct(d, 0.4)} / ${median(d)} / ${pct(d, 0.75)} / ${pct(d, 0.9)}`,
    );
    /*
       What the Financial Boss is actually compared against, printed because
       two placements of that bar were sized against the wrong number.

       `careerShape` reads `estate(state).total` — what the family is worth
       now. `bestEstate` is the peak the record keeps, and they are different
       distributions. Nobody had noticed, because the bar happened to land
       somewhere defensible anyway.
    */
    const es = RUNS_300.map((r) => r.newSystems.finalEstate).sort((a, b) => a - b);
    const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
    // eslint-disable-next-line no-console
    console.log(
      `         estate now, 25th / median / 60th / 75th: ` +
        `${money(pct(es, 0.25))} / ${money(median(es))} / ${money(pct(es, 0.6))} / ` +
        `${money(pct(es, 0.75))} (the financier bar is ${money(SHAPE_BARS.financierEstate)})`,
    );
    /*
       And the same for the Don, which had never been plotted at all.

       Every other bar in `SHAPE_BARS` carries a percentile in its comment.
       `donRespect` carried the words "Respect for the Old-School Don" and a
       number, and nothing in this project had ever printed the distribution it
       sits in.
    */
    const rs = RUNS_300.map((r) => r.newSystems.finalRespect).sort((a, b) => a - b);
    // eslint-disable-next-line no-console
    console.log(
      `         respect now, 25th / median / 60th / 75th: ` +
        `${Math.round(pct(rs, 0.25))} / ${Math.round(median(rs))} / ${Math.round(pct(rs, 0.6))} / ` +
        `${Math.round(pct(rs, 0.75))} (the don bar is ${SHAPE_BARS.donRespect})`,
    );

    /*
       The horoscope condition, counted on the wide population.

       `resolves` asks for 108 careers to tell 30.6% from a bar of 40%, and
       thirty-six is where three re-plots of this bar were argued from. The
       context above stays on `RUNS_300` because `config/legacy.ts` records its
       figures, and the wide histogram is printed beside it — the first version
       widened only the assertion and left the reader looking at thirty-six
       careers while a bar failed on two hundred and eighty-eight, which makes
       a real finding unreadable.
    */
    const wideShapes = new Map<string, number>();
    for (const r of WIDE) wideShapes.set(r.newSystems.shape, (wideShapes.get(r.newSystems.shape) ?? 0) + 1);
    // eslint-disable-next-line no-console
    console.log(
      `         career shapes across ${WIDE.length} careers — ` +
        [...wideShapes]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${k} ${n} (${Math.round((100 * n) / WIDE.length)}%)`)
          .join(', '),
    );
    /*
       And the two quantities the top two shapes read, on the same wide
       population the bar is now asserted against.

       Plotting a `SHAPE_BARS` value off thirty-six careers is what put the
       Financial Boss on 42% of the game: `financierEstate` was placed at "the
       60th percentile" and the wide reading has it under the median.
    */
    const wideEstate = WIDE.map((r) => r.newSystems.finalEstate).sort((a, b) => a - b);
    const wideRespect = WIDE.map((r) => r.newSystems.finalRespect).sort((a, b) => a - b);
    // eslint-disable-next-line no-console
    console.log(
      `         across ${WIDE.length}, estate now 25th / median / 60th / 75th: ` +
        `${money(pct(wideEstate, 0.25))} / ${money(median(wideEstate))} / ` +
        `${money(pct(wideEstate, 0.6))} / ${money(pct(wideEstate, 0.75))} ` +
        `(financier bar ${money(SHAPE_BARS.financierEstate)})` +
        String.fromCharCode(10) +
        `         across ${WIDE.length}, respect now 25th / median / 60th / 75th: ` +
        `${Math.round(pct(wideRespect, 0.25))} / ${Math.round(median(wideRespect))} / ` +
        `${Math.round(pct(wideRespect, 0.6))} / ${Math.round(pct(wideRespect, 0.75))} ` +
        `(don bar ${SHAPE_BARS.donRespect})`,
    );
    const named = [...wideShapes].filter(([k]) => k !== 'unremarkable').sort((a, b) => b[1] - a[1]);
    if (named.length) {
      /*
         Rule 4, on the bar that has been re-plotted three times this cycle —
         the union boss, the alderman and the Don — every time because the
         reading moved rather than because the shape was wrong.
      */
      const spread = resolves(named[0][1], WIDE.length, 0.4);
      expect(spread.ok, spread.why).toBe(true);
      expect(
        named[0][1] / WIDE.length,
        `"${named[0][0]}" is the verdict on ${named[0][1]} of ${WIDE.length} careers`,
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

/*
   And the same population wide, for the one bar that pairs.

   `resolves` asks for 288 careers to tell 38.9% from a third — the share of
   careers that come out ahead for having built up to a job. That bar was one
   of the two a numerically inert baseline build flipped, at 11 of 36 against a
   floor of 12, and the fix was never the baseline.

   Paired against `WIDE`, which is the same seeds in the same order with the
   policy off, so the rule about arms being separate worlds still holds.
*/
const WIDE_SCORES = Array.from({ length: 288 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { scores: true }),
);

/*
   A bot that puts its green men with its good ones, against the same bot that
   never pairs anybody.

   Work teaching moves skill on every arm whether the policy asks or not — it
   is a consequence of going out. This arm measures the other half, which is a
   decision: two men off the board for twelve days against what the student
   comes back with.
*/
const RUNS_TRAINS = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { trains: true }),
);

/*
   A bot that hands the job loop over and stops choosing.

   The only arm in this file whose bar is that the thing it measures must
   **lose**. Automation that beats playing is not a convenience, it is the game
   solving itself, and the whole of `standingOrders.ts` is built around one
   property meant to stop that: a standing order does not read the room.
*/
const RUNS_AUTO = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { auto: true }),
);

/*
   And the realistic use: an order grinding the street job while the player
   keeps hand-running everything above it.

   This is the arm that could actually embarrass the feature. The one above
   measures walking away, which nobody sensible does; this measures the
   convenience, which everybody would.
*/
const RUNS_AUTO_PLUS = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { autoPlus: true }),
);

/*
   And the same order again, moved every three weeks instead of left.

   Paired against `RUNS_AUTO_PLUS`, which does everything this does except move
   it — so the only thing between the two populations is the rotation.

   Written before the pattern mechanic exists, deliberately. Rotation is not a
   free variable: moving an order also spreads work across districts, and this
   file already found that spreading is worth a great deal on its own. So what
   this reads *now* is the confound, priced separately and for nothing, and
   what it reads afterwards minus that is what the pattern actually bought.
*/
const RUNS_AUTO_CYCLED = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { autoCycled: true }),
);

/*
   A bot that deals with the people who keep costing it money.

   The plainest case of F7 this file has had. Nothing in this project has ever
   cut anybody — not a probe, not a bot, not once — so `silence.ts` and
   `marks.ts` shipped with unit tests and nothing else. Every bar around them
   went on reporting confidently about a game containing two mechanics that
   nothing exercised.

   Three questions, and only the first is about the feature paying off:

   **Is it ever reachable?** A career has to actually arrive at a man bad
   enough to be worth the decision, or this is a button nobody presses.

   **Does removing your worst people beat keeping them?** It must not. A boss
   who can improve the family by shooting the bottom of the roster has been
   handed a free upgrade, and the informant trace exists precisely so that is
   not true.

   **Is a mark a race or a formality?** Some have to land and some have to
   lapse. A zero in either direction is the mechanic failing in a way no
   estate figure would show.
*/
const RUNS_CUTS = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { cuts: true }),
);

/*
   The same decision, taken the way a person would take it.

   Paired against the same seeds and the same baseline as the arm above, so the
   only thing between the two populations is how freely the thing is used.
*/
const RUNS_CUTS_RARE = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { cutsRarely: true }),
);

/*
   The allocator with the judgement call it was deliberately denied.

   Paired against `RUNS_MATCHED`, which allocates identically and ignores heat,
   and against `RUNS_300`, which is the bar that actually matters: automation
   must not beat playing.
*/
const RUNS_AUTO_SMART = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { matchOpsSmart: true }),
);

/*
   The operations loop handed to something that allocates properly.

   Best and most careful on the riskiest work, whoever is left on the safe
   jobs, every day, with the player choosing nothing. The two standing-order
   arms hand over to a rule that is deliberately stupid; this one hands over to
   the rule a player would actually want, which is the only way to ask whether
   an operations autopilot would be strictly better than the hand it replaces.
*/
const RUNS_MATCHED = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { matchOps: true }),
);

/*
   The allocator again, in a family that also develops its people.

   These two mechanics should compound, and not in a comfortable direction.
   Matching sends the same good men at the same dangerous work night after
   night, and `TRAINING.perTier` makes high-tier work teach roughly three times
   what street work teaches — so the men who are already best get better
   fastest, and the allocator keeps choosing them because they are best.

   Paired against `RUNS_TRAINS`, which trains identically and assigns by hand,
   so the only thing between the two populations is still the assignment.
*/
const RUNS_MATCHED_TRAINED = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { matchOps: true, trains: true }),
);

/*
   A boss who wants what the ground gives, against one who wants ground.

   Paired seed-for-seed against `RUNS_300`, which is the hand this replaces:
   same jobs, same fronts, same crew rules, same everything except where it
   expands and whether it bothers to staff what it holds.

   This arm exists because the territory rework measured as nothing and the
   reason was the instrument, not the rework. Six yields were wired into six
   systems and every bar in this file stayed where it was, because no bot in
   this project has ever asked what a district was for. That is F7 in its
   purest form: the mechanic was invisible to the measurement, and the honest
   response is to build the eye rather than to argue about the number.
*/
const RUNS_GROUND = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { chasesGround: true }),
);

/*
   A family that lets the street see who took it.

   Paired seed-for-seed against `RUNS_300`, which plays the identical career
   straight. The only difference is the approach on every job, and the approach
   is the only deliberate source of fear in the game.
*/
const RUNS_HEAVY = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { heavy: true }),
);

/*
   The same thing done where it pays, which is how anybody would do it.

   Same seeds, same baseline. The only thing between this population and the
   one above is how freely the approach is used.
*/
const RUNS_HEAVY_SMART = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { heavyWhenItPays: true }),
);

/*
   Spending fear instead of only earning it.

   Two arms, because the question is a pair. `RUNS_LEAN` leans on witnesses
   while playing straight, so it reads what the action is worth to an ordinary
   family. `RUNS_LEAN_FEARED` does the same while running heavy where it pays,
   which is the only way a family ever has fear to spend — and the difference
   between them is what being feared is actually worth.
*/
const RUNS_LEAN = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { leansOnWitnesses: true }),
);
/*
   The feared half of the pair, and the policy matters more than it looks.

   This ran `heavyWhenItPays`, which is the arm that only goes loud on jobs
   where thirty percent is real money — it runs 44 loud jobs in four years and
   peaks at fear 29. Against `leansOnWitnesses` alone, peaking at 42, that is
   not a feared family and an unfeared one. It is two unfeared families, and
   the bar under it was reading the gap between them as a finding about fear.

   `heavy` is the arm that is actually frightening: 37 weeks of 42 above
   `FEARED_ABOVE`, against zero. It loses money doing it, and that is priced by
   its own bar two blocks up — this pair is about whether the witness lands,
   and for that the arm has to have the thing being tested.
*/
const RUNS_LEAN_FEARED = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { leansOnWitnesses: true, heavy: true }),
);

/*
   Two families shopping for two different things, against one shopping by price.

   All three play identically in every other respect and run the same seeds.
   The only difference is how `BUSINESSES` is sorted before the affordability
   check, which is exactly the decision the catalogue re-cost created and
   exactly the decision nothing in this project has ever made.
*/
const RUNS_WASHERS = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { frontTaste: 'washing' }),
);
const RUNS_EARNERS = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { frontTaste: 'earning' }),
);

/*
   ...and the same boss, on a map where holding things gives nothing.

   The control, and the arm above is worthless without it. Read against
   `RUNS_300` the yield-chasing bot came out ahead on 36 careers of 36 at a
   median of +$6,498,661, which is not a mechanic, it is a confound with a
   dollar sign on it. It controlled twelve districts against the hand's four
   and laundered $8.3M against $2.1M — this file established years ago that
   spreading across the map is worth a great deal on its own, and that is what
   that number is measuring. The yields were barely switched on: working
   holdings moved 3 to 4.

   So the honest control is not a differently-behaved bot at all. It is the
   *same* bot, on the same seeds, taking the same ground and staffing the same
   districts, with `HOLDING.share` set to zero so the six multipliers do
   nothing. Everything the expansion is worth appears in both populations and
   cancels. What is left between them is the rework and nothing else.

   The config is restored immediately, in the idiom the pattern and silence
   sweeps in this file already use.
*/
/*
   The same boss again, with the nights handed to the shipped autopilot.

   Paired against `RUNS_GROUND`, which wants exactly the same map and runs its
   own jobs to get it. The only difference between the two populations is who
   picks the crews and where they go, so whatever separates them is what
   handing the operations loop over costs a boss who is trying to hold ground.

   First time anything in this project has turned `setAutopilot` on outside its
   own unit tests.
*/
const RUNS_GROUND_AUTO = Array.from({ length: 36 }, (_, i) =>
  climb(700 + i, HUMAN_DAYS, { chasesGround: true, handsOver: true }),
);

const RUNS_GROUND_DEAD = (() => {
  const was = HOLDING.share;
  (HOLDING as unknown as Record<string, number>).share = 0;
  const runs = Array.from({ length: 36 }, (_, i) =>
    climb(700 + i, HUMAN_DAYS, { chasesGround: true }),
  );
  (HOLDING as unknown as Record<string, number>).share = was;
  return runs;
})();
/*
   The catalogue was a shop, and nobody ever went in.

   This block measured `RUNS_SHOPS` — an arm told to buy possessions — and it
   is gone along with the shop. What killed it was a reading taken for the
   first time today, on the baseline rather than on an arm built to exercise
   the feature: **0 of 36 ordinary careers ever bought anything.**

   Everything this file had said about possessions was said about a bot that
   had been instructed to use them. The paired estate gap of -$782,674 was
   real and it priced the wrong thing: not "is this a bad buy" but "what
   happens when you make somebody do it". Nobody was choosing it, because front
   income compounds and a possession does not, so every dollar spent in the
   shop was a dollar not spent on premises that pay for four years.

   The object stays. It counts toward the estate, the law can take one, the
   post-mortem lists it, and a roof of your own makes an evening at home worth
   more — five systems, none of them a catalogue. It arrives from a landed
   score now, through `takeSomething`, so a possession is a record of something
   the family did rather than something it went out and purchased.
*/
describe('handing the job loop over', () => {
  it('says whether automating beats playing, and it must not', () => {
    const ran = RUNS_AUTO.filter((r) => r.newSystems.auto.launched > 0);
    const launched = RUNS_AUTO.map((r) => r.newSystems.auto.launched).sort((a, b) => a - b);
    const rows = RUNS_AUTO.map((r, i) => ({ r, against: RUNS_300[i] })).filter(
      ({ r }) => r.newSystems.auto.launched > 0,
    );
    const gaps = rows
      .map(({ r, against }) => r.bestEstate - against.bestEstate)
      .sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;
    const jobs = new Map<string, number>();
    for (const r of RUNS_AUTO) {
      if (r.newSystems.auto.job) {
        jobs.set(r.newSystems.auto.job, (jobs.get(r.newSystems.auto.job) ?? 0) + 1);
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `auto: ${ran.length}/${RUNS_AUTO.length} careers ran on a standing order alone
` +
        `      set on, median day ` +
        `${median(RUNS_AUTO.filter((r) => r.newSystems.auto.setDay !== null).map((r) => r.newSystems.auto.setDay!))}` +
        `; jobs it picked: ` +
        [...jobs].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') +
        `
      times it fired, 25th / median / 75th: ` +
        `${pct(launched, 0.25)} / ${median(launched)} / ${pct(launched, 0.75)}
` +
        `      estate against playing it yourself, 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `      careers where the automation came out ahead: ${ahead}/${gaps.length}`,
    );

    /*
       The instrument first: an arm where the order never fired would pass the
       bar below by doing nothing at all, which is the shape of every false
       negative this project has ever shipped.
    */
    expect(
      ran.length,
      'no standing order ever fired, so the comparison below is against nothing',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_AUTO.length / 2));

    /*
       And the bar this feature exists to satisfy.

       A career that sets one order and stops paying attention must not end up
       richer than one played by hand. If it does, the correct play is to
       automate and press +1 month, and the order needs to get *worse* when
       conditions change — not smarter.

       On the share of careers rather than on the median, because the median of
       thirty-odd paired careers has now twice failed to price a mechanic in
       this file. Half is the line: automation matching the played line on a
       coin flip is a convenience, beating it on most careers is a solution.
    */
    expect(
      ahead,
      'handing the job loop over beats playing it, so the game solves itself',
    ).toBeLessThan(Math.ceil(gaps.length / 2));
  });

  /*
     The question the two arms above could not ask.

     Both hand over to a rule that is deliberately stupid, so "automation
     loses" was partly a statement about the rule rather than about automating.
     This hands the whole operations loop to the allocation a player would
     actually want — best and most careful on the riskiest work, whoever is
     left on the safe jobs — running every day with nothing chosen by hand.

     Read carefully: the baseline bot already launches every day. It just takes
     whoever is standing nearest, `idle().slice(0, bodies)`. So what separates
     these two populations is the *assignment rule* and nothing else, which is
     the honest way to ask whether an operations autopilot beats the hand it
     replaces.
  */
  it('says whether allocating well beats allocating at all', () => {
    const rows = RUNS_MATCHED.map((r, i) => ({ r, against: RUNS_300[i] }));
    const gaps = rows
      .map(({ r, against }) => r.bestEstate - against.bestEstate)
      .sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;
    const odds = (rs: typeof RUNS_MATCHED) =>
      median(
        rs
          .filter((r) => r.newSystems.matched.launched > 0)
          .map((r) => r.newSystems.matched.oddsSum / r.newSystems.matched.launched),
      );

    // eslint-disable-next-line no-console
    console.log(
      `matched: the operations loop allocated best-to-riskiest, every day —
` +
        `         jobs launched, median ${median(RUNS_MATCHED.map((r) => r.launchEra.reduce((a, b) => a + b, 0)))}` +
        ` against ${median(RUNS_300.map((r) => r.launchEra.reduce((a, b) => a + b, 0)))} by hand` +
        `, at median odds ${(odds(RUNS_MATCHED) * 100).toFixed(0)}%
` +
        `         estate against the hand it replaces, 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `         careers where the allocator came out ahead: ${ahead}/${gaps.length}
` +
        `         median odds by hand ${(odds(RUNS_300) * 100).toFixed(0)}%
` +
        `         crew skill floor, allocator ` +
        `${median(RUNS_MATCHED.map((r) => r.newSystems.crewSkill.floor))}` +
        ` against ${median(RUNS_300.map((r) => r.newSystems.crewSkill.floor))} by hand` +
        `; heat-weeks ${median(RUNS_MATCHED.map((r) => r.danger.heat))}` +
        ` against ${median(RUNS_300.map((r) => r.danger.heat))}`,
    );

    /*
       What it measured, 36 careers at day 300:

           jobs launched          435 against 420 by hand
           median odds            58% against 57%
           estate difference      -$593,512 / +$202,308 / +$1,019,682
           careers ahead          19/36
           crew skill floor       23 against 20
           heat-weeks             1,826 against 2,043

       **Matching helps, and does not solve anything.** A coin flip on careers
       with a tilt worth about a tenth of an estate.

       **And it is not doing it by raising the odds.** The median launch is 58%
       against 57% — one point, which is nothing. Matching does not make the
       family better at its work, it *moves* the quality: the risky jobs get
       the good men and the safe jobs get whoever is left, so the median barely
       shifts while the two ends swap places.

       That is where the rest of the reading comes from, and it is an inference
       from these figures rather than a separate measurement:
       `FAILURE_CONSEQUENCES` is far harsher at the top — 24% of extreme
       failures take somebody in against 12% of low ones hurting somebody — so
       moving the good crews onto the dangerous work buys fewer *expensive*
       failures rather than fewer failures. Heat-weeks down a tenth and a skill
       floor three points higher are consistent with that and with little
       else.

       Two things this is *not*:

       **It is not a comparison against a human.** The hand it beats is
       `idle().slice(0, bodies)` — whoever is standing nearest. A player using
       the *Send your best* button is already taking most of this, and the gap
       against that would be far smaller.

       **The first version measured the wrong thing and lost by a million.** It
       also reordered which jobs ran, risk first instead of expected value, and
       read 6/36 ahead at -$1,029,008. Sorting the board by danger spends the
       bench and the stake on the most dangerous work before it reaches the
       work that pays. Worth keeping: *how* you rank the board matters far more
       than who you send, and in the opposite direction.
    */
    expect(
      median(RUNS_MATCHED.map((r) => r.launchEra.reduce((a, b) => a + b, 0))),
      'the allocator never launched anything, so the comparison is against nothing',
    ).toBeGreaterThan(20);
  });

  /*
     Whether the omission was load-bearing.

     The shipped autopilot does not read heat. That is the same omission every
     automation in this game carries, and the argument for it is that reading
     the room is what a player does. The argument against is that it is silly:
     a real outfit does not grind on while a task force forms.

     This settles it. Same allocator, plus two crude levers — quieter work
     above `SMART_QUIET_ABOVE`, nothing at all above `SMART_STOP_ABOVE` — read
     against the allocator that ignores heat and against the hand.

     The bar is `RUNS_AUTO`'s and it is the only one that matters: **automation
     must not beat playing.** If it stays level the omission was superstition
     and heat management should ship. If it wins, the omission was the feature.
  */
  it.skip('says whether letting the autopilot watch the heat crosses the line', () => {
    const at = (rs: typeof RUNS_AUTO_SMART, f: (r: (typeof RUNS_AUTO_SMART)[number]) => number) =>
      median(rs.map(f));
    const gapsVsHand = RUNS_AUTO_SMART.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate).sort(
      (a, b) => a - b,
    );
    const gapsVsPlain = RUNS_AUTO_SMART.map(
      (r, i) => r.bestEstate - RUNS_MATCHED[i].bestEstate,
    ).sort((a, b) => a - b);
    const plainVsHand = RUNS_MATCHED.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate).sort(
      (a, b) => a - b,
    );
    const launched = (rs: typeof RUNS_AUTO_SMART) =>
      median(rs.map((r) => r.launchEra.reduce((a, b) => a + b, 0)));

    // eslint-disable-next-line no-console
    console.log(
      `smart: the allocator with a heat sense, quiet above ${SMART_QUIET_ABOVE}` +
        `, stopped above ${SMART_STOP_ABOVE}
` +
        `       jobs launched ${launched(RUNS_AUTO_SMART)}` +
        ` against ${launched(RUNS_MATCHED)} ignoring heat and ${launched(RUNS_300)} by hand
` +
        `       estate against the hand, 25th / median / 75th: ` +
        `$${Math.round(pct(gapsVsHand, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gapsVsHand)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gapsVsHand, 0.75)).toLocaleString('en-US')}
` +
        `       careers ahead of the hand: ${gapsVsHand.filter((g) => g > 0).length}/36` +
        ` against ${plainVsHand.filter((g) => g > 0).length}/36 ignoring heat
` +
        `       estate against the allocator that ignores heat, median ` +
        `$${Math.round(median(gapsVsPlain)).toLocaleString('en-US')}` +
        `; ahead on ${gapsVsPlain.filter((g) => g > 0).length}/36
` +
        `       heat-weeks ${Math.round(at(RUNS_AUTO_SMART, (r) => r.danger.heat))}` +
        ` against ${Math.round(at(RUNS_MATCHED, (r) => r.danger.heat))} and ` +
        `${Math.round(at(RUNS_300, (r) => r.danger.heat))} by hand` +
        `; men left ${at(RUNS_AUTO_SMART, (r) => r.newSystems.crewLeft)}` +
        ` against ${at(RUNS_300, (r) => r.newSystems.crewLeft)}`,
    );

    /*
       Instrument first: an arm that never launched would satisfy anything
       below by doing nothing, which is the shape of every false negative here.
    */
    expect(
      launched(RUNS_AUTO_SMART),
      'the heat-aware allocator never launched anything',
    ).toBeGreaterThan(20);

    /*
       And the bar, which FAILED. Measured, 36 careers at day 300:

           jobs launched     452, against 435 ignoring heat and 432 by hand
           estate v hand     −$598,678 / +$347,540 / +$1,478,593
           careers ahead     20/36, against 18/36 ignoring heat
           v plain allocator +$210,165, ahead on 19/36
           heat-weeks        2,006 against 1,937 and 1,994 by hand

       **Letting the autopilot watch the heat beats playing by hand**, which is
       the one thing this bar exists to forbid. So heat management does not
       ship, and the reason is a number rather than a design slogan.

       The mechanism is the reverse of what it looks like. It launches *more*
       jobs than the version that ignores heat, and runs slightly *hotter* —
       because throttling to quiet work above 40 stops it ever grinding into a
       forced lay-low at 70. It trades a handful of dangerous nights for a
       great many ordinary ones. Managing heat is not a realism nicety that
       makes an autopilot behave sensibly; it is the strongest single lever in
       the feature, because never being benched is worth more than any
       allocation rule.

       Skipped rather than left red: the shipped autopilot does not do this, so
       the game passes. This is a concluded experiment kept for its finding, the
       same way the two sweeps in this file are.
    */
    expect(
      gapsVsHand.filter((g) => g > 0).length,
      'an autopilot that watches the heat beats playing by hand, so the game solves itself',
    ).toBeLessThan(Math.ceil(gapsVsHand.length / 2));
  });

  it('says what the allocator does once the family also trains people', () => {
    const rows = RUNS_MATCHED_TRAINED.map((r, i) => ({ r, against: RUNS_TRAINS[i] }));
    const gaps = rows
      .map(({ r, against }) => r.bestEstate - against.bestEstate)
      .sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;
    const at = (rs: typeof RUNS_TRAINS, f: (r: (typeof RUNS_TRAINS)[number]) => number) =>
      median(rs.map(f));
    const odds = (rs: typeof RUNS_TRAINS) =>
      median(
        rs
          .filter((r) => r.newSystems.matched.launched > 0)
          .map((r) => r.newSystems.matched.oddsSum / r.newSystems.matched.launched),
      );
    const spread = (rs: typeof RUNS_TRAINS) =>
      median(rs.map((r) => r.newSystems.crewSkill.best - r.newSystems.crewSkill.floor));

    // eslint-disable-next-line no-console
    console.log(
      `matched: both arms training, one allocating — against the hand that also trains
` +
        `         median odds ${(odds(RUNS_MATCHED_TRAINED) * 100).toFixed(0)}%` +
        ` against ${(odds(RUNS_TRAINS) * 100).toFixed(0)}%
` +
        `         crew skill median / best / floor: allocator ` +
        `${at(RUNS_MATCHED_TRAINED, (r) => r.newSystems.crewSkill.median)} / ` +
        `${at(RUNS_MATCHED_TRAINED, (r) => r.newSystems.crewSkill.best)} / ` +
        `${at(RUNS_MATCHED_TRAINED, (r) => r.newSystems.crewSkill.floor)}` +
        `; by hand ${at(RUNS_TRAINS, (r) => r.newSystems.crewSkill.median)} / ` +
        `${at(RUNS_TRAINS, (r) => r.newSystems.crewSkill.best)} / ` +
        `${at(RUNS_TRAINS, (r) => r.newSystems.crewSkill.floor)}
` +
        `         top-to-bottom spread: ${spread(RUNS_MATCHED_TRAINED)} against ${spread(RUNS_TRAINS)}
` +
        `         pairings run: ${at(RUNS_MATCHED_TRAINED, (r) => r.newSystems.teaching.finished)}` +
        ` against ${at(RUNS_TRAINS, (r) => r.newSystems.teaching.finished)}
` +
        `         estate difference 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `         careers where the allocator came out ahead: ${ahead}/${gaps.length}
` +
        `         heat-weeks ${Math.round(at(RUNS_MATCHED_TRAINED, (r) => r.danger.heat))}` +
        ` against ${Math.round(at(RUNS_TRAINS, (r) => r.danger.heat))}`,
    );

    /*
       **The prediction above this arm was wrong, and the arm is worth keeping
       for that reason.**

       The reasoning was that matching and training would compound: the same
       good men on the same dangerous work, `TRAINING.perTier` teaching roughly
       three times as much up there, so the best get better fastest and the
       allocator keeps picking them. Rich get richer.

       Measured, they cancel.

           against the hand that also trains
             median odds        59% against 59%
             skill med/best/floor   44/69/24 against 44/69/24
             top-to-bottom spread   47 against 46
             estate difference  -$505,003 / +$71,570 / +$1,185,782
             careers ahead      18/36
             heat-weeks         1,914 against 1,945

       Every distribution is the same to the point. And against the arms with
       no training at all, the allocator's whole edge has gone:

             estate median      +$202,308  ->  +$71,570
             heat-weeks gap        217     ->      31

       The likely reason is that the pairing rule works directly against
       concentration — it takes the best man off the board for twelve days and
       spends him on the worst — while work-teaching pays out to whoever went
       out, regardless of who chose them. So matching decides *who* gets the
       skill and mentoring hands it back, and the shape of the roster ends up
       governed by the pairing rather than by the assignment.

       Which makes the allocator a convenience and not a strategy, in a family
       that develops anybody at all.
    */
    /*
       The instrument. Both arms have to actually be training, or this is the
       previous comparison with a longer name.
    */
    expect(
      at(RUNS_MATCHED_TRAINED, (r) => r.newSystems.teaching.finished),
      'the allocator arm never trained anybody',
    ).toBeGreaterThan(0);
    expect(
      at(RUNS_TRAINS, (r) => r.newSystems.teaching.finished),
      'the hand arm never trained anybody',
    ).toBeGreaterThan(0);
  });

  it('says whether keeping one alongside playing is a free win', () => {
    const rows = RUNS_AUTO_PLUS.map((r, i) => ({ r, against: RUNS_300[i] })).filter(
      ({ r }) => r.newSystems.auto.launched > 0,
    );
    const gaps = rows
      .map(({ r, against }) => r.bestEstate - against.bestEstate)
      .sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;
    const fired = RUNS_AUTO_PLUS.map((r) => r.newSystems.auto.launched).sort((a, b) => a - b);
    const left = RUNS_AUTO_PLUS.map((r) => r.newSystems.crewLeft).sort((a, b) => a - b);
    const jobs = new Map<string, number>();
    for (const r of RUNS_AUTO_PLUS) {
      if (r.newSystems.auto.job) {
        jobs.set(r.newSystems.auto.job, (jobs.get(r.newSystems.auto.job) ?? 0) + 1);
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `auto: kept alongside playing by hand — ${rows.length}/${RUNS_AUTO_PLUS.length} careers
` +
        `      it ground away at: ` +
        [...jobs].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') +
        `
      times it fired, 25th / median / 75th: ` +
        `${pct(fired, 0.25)} / ${median(fired)} / ${pct(fired, 0.75)}
` +
        `      estate against playing everything, 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `      careers where it came out ahead: ${ahead}/${gaps.length}
` +
        `      men left at the end, 25th / median / 75th: ` +
        `${pct(left, 0.25)} / ${median(left)} / ${pct(left, 0.75)}` +
        ` against ${median(RUNS_300.map((r) => r.newSystems.crewLeft))} playing by hand
` +
        `      buried / inside / gone per career, median: ` +
        `${median(RUNS_AUTO_PLUS.map((r) => r.lost.dead))} / ` +
        `${median(RUNS_AUTO_PLUS.map((r) => r.lost.inside))} / ` +
        `${median(RUNS_AUTO_PLUS.map((r) => r.lost.defected))}` +
        ` against ${median(RUNS_300.map((r) => r.lost.dead))} / ` +
        `${median(RUNS_300.map((r) => r.lost.inside))} / ` +
        `${median(RUNS_300.map((r) => r.lost.defected))} by hand
` +
        `      careers that ended with nobody left: ` +
        `${left.filter((n) => n === 0).length}/${RUNS_AUTO_PLUS.length}` +
        ` against ${RUNS_300.filter((r) => r.newSystems.crewLeft === 0).length}/${RUNS_300.length} by hand`,
    );

    /*
       Expensive is the design. Unrecoverable is not.

       Asked because a hand-played browser career with an order left grinding
       ran the family down to nought men by day 135 — and nothing in this file
       would have shown it, because every automation bar reads money and none
       of them reads whether an organization was left at the end. That career
       was one seed and it never recruited, so it is not evidence; this is the
       instrument that would be.

       All of these arms *do* replace people. Hiring sits above the
       `!policy.auto` guard, so it runs on every arm — one man a day, up to
       `maxCrew`, while the outfit holds three times a recruit's price and the
       wage bill stays under a quarter of funds. None of them ever *cuts*
       anybody, because nothing in this project has ever modelled a boss
       letting somebody go.

       So the bar is the floor rather than a level: a standing order may be a
       bad decision and may cost a fortune, but it must not be able to end the
       organization, because there is no way back from an empty roster and the
       game would have shipped a button that quietly loses the save.
    */
    expect(
      left.filter((n) => n === 0).length,
      'leaving a standing order running can end the organization outright',
    ).toBe(0);

    /*
       The bar that actually protects the feature.

       A standing order kept on the grind while you play everything else has to
       cost something real — the bench it eats, the heat it draws on a job you
       stopped watching. If most careers come out ahead anyway, then turning it
       on is free and the only reason not to would be forgetting it exists.

       Re-recorded when the pattern landed, because both figures moved and the
       old ones stood in this comment claiming to describe a game that no
       longer existed:

                                 before the pattern   after
           times it fired        178                  167
           estate against hand   −$73,022             −$495,910
           careers ahead         16/36                12/36
           men left at the end   —                    29 against 32 by hand

       It held at 16/36 by two careers and 3% of an estate, which is to say it
       barely held. Charging for repetition is what made the bar mean anything.
    */
    expect(
      ahead,
      'a standing order kept alongside playing is a free win, so it is not a trade',
    ).toBeLessThan(Math.ceil(gaps.length / 2));
  });

  /*
     The arm that asks whether automation can ever be the *right* call.

     Every bar above it is flat — automation must not beat playing — and a flat
     bar cannot detect a strategy. It passes a mechanic that always loses and
     fails one that always wins, and a strategy is neither of those. What a
     strategy looks like in an instrument is two arms of the same feature whose
     required results disagree: `autoPlus` leaves the order and must lose, this
     one moves it and must win.

     Read against `RUNS_AUTO_PLUS` rather than against the hand, because those
     two differ in exactly one thing. Both automate the same job, both keep
     hand-playing everything else; only this one re-points it.
  */
  it('says what moving an order is worth, against leaving it', () => {
    const paired = RUNS_AUTO_CYCLED.map((r, i) => ({ r, against: RUNS_AUTO_PLUS[i] })).filter(
      ({ r, against }) => r.newSystems.auto.launched > 0 && against.newSystems.auto.launched > 0,
    );
    const gaps = paired
      .map(({ r, against }) => r.bestEstate - against.bestEstate)
      .sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;

    // And against the hand as well, which is the bar the feature is sold on.
    const vsHand = RUNS_AUTO_CYCLED.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate).sort(
      (a, b) => a - b,
    );
    const moves = RUNS_AUTO_CYCLED.map((r) => r.newSystems.auto.moves).sort((a, b) => a - b);
    const fired = RUNS_AUTO_CYCLED.map((r) => r.newSystems.auto.launched).sort((a, b) => a - b);

    // eslint-disable-next-line no-console
    console.log(
      `auto: the same order moved every ${CYCLE_DAYS} days, against leaving it put
` +
        `      times it was re-pointed, 25th / median / 75th: ` +
        `${pct(moves, 0.25)} / ${median(moves)} / ${pct(moves, 0.75)}
` +
        `      times it fired: ${pct(fired, 0.25)} / ${median(fired)} / ${pct(fired, 0.75)}` +
        ` against ${median(RUNS_AUTO_PLUS.map((r) => r.newSystems.auto.launched))} left put
` +
        `      estate against leaving it, 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `      careers where moving it came out ahead: ${ahead}/${gaps.length}
` +
        `      estate against playing everything by hand, median ` +
        `$${Math.round(median(vsHand)).toLocaleString('en-US')}` +
        `; ahead on ${vsHand.filter((g) => g > 0).length}/${vsHand.length}
` +
        `      heat-weeks ${Math.round(median(RUNS_AUTO_CYCLED.map((r) => r.danger.heat)))}` +
        ` against ${Math.round(median(RUNS_AUTO_PLUS.map((r) => r.danger.heat)))} left put
` +
        `      men left at the end, moved ` +
        `${median(RUNS_AUTO_CYCLED.map((r) => r.newSystems.crewLeft))}` +
        ` against ${median(RUNS_AUTO_PLUS.map((r) => r.newSystems.crewLeft))} left put` +
        `, ${median(RUNS_300.map((r) => r.newSystems.crewLeft))} by hand
` +
        `      buried per career, moved ${median(RUNS_AUTO_CYCLED.map((r) => r.lost.dead))}` +
        ` against ${median(RUNS_AUTO_PLUS.map((r) => r.lost.dead))} left put` +
        `; emptied out ` +
        `${RUNS_AUTO_CYCLED.filter((r) => r.newSystems.crewLeft === 0).length}/36` +
        ` against ${RUNS_AUTO_PLUS.filter((r) => r.newSystems.crewLeft === 0).length}/36`,
    );

    /*
       The instrument first, as always. An arm that never moved the order is
       the alongside arm with a longer name, and would satisfy anything below
       by being a copy of what it is supposed to be compared against.
    */
    expect(
      median(moves),
      'the order was never re-pointed, so this arm is the static one under another name',
    ).toBeGreaterThan(0);

    /*
       MEASURED BEFORE THE PATTERN MECHANIC EXISTED. Do not delete this.

           re-pointed             12 / 13 / 13 times a career
           fired                  168 / 207 / 233, against 178 left put
           estate against leaving it   +$509,847 / +$1,912,037 / +$3,096,459
           careers ahead of leaving it 30/36
           against playing by hand     +$2,399,308, ahead on 27/36
           heat-weeks             1,747 against 2,070 left put

       **The confound is not a nuisance here, it is the whole result, and it
       was worth running this arm before writing anything to find that out.**

       Moving an order around the districts beat the hand-played line on 27
       careers of 36 by nearly two and a half million — with nothing in the
       game charging a penny for repetition. None of that is automation. All
       of it is *spreading*: `RUNS_300` works one district until it is done and
       this file already recorded that as the reason one career in 36 ever met
       Capo's two-district requirement, and both static auto arms park on
       `operableTerritories[0]` and never leave. So this arm changed the
       automation and the map at the same time, and the map won.

       That is a live finding about the shipped build rather than about
       anything new: **a player who re-points a standing order every three
       weeks is already ahead of one who plays every night by hand**, and no
       bar in this file caught it because no bot had ever moved one. F7, in
       the exact shape the file keeps finding it.

       It also kills the bar this arm was written with. "The cycled arm must
       come out ahead" passes at 30/36 today, for a reason that has nothing to
       do with the mechanic it was meant to measure — which is the definition
       of an instrument that returns a believable number while measuring
       nothing, and section 3 of HANDOFF is about exactly that.

       So the bar moves to the only quantity the pattern can own: **the gap
       between moving and leaving has to widen.** Rotation is worth what it is
       worth either way; if charging for repetition does anything at all, the
       arm that leaves the order put now pays a bill that grows while this one
       keeps walking away from it. Anything above the figures recorded here is
       the mechanic. Anything at or below them is the map, and the mechanic
       did nothing.

       ------------------------------------------------------------------
       WHAT IT READS NOW, and how much of it took two goes to see.

       The arm went through three versions and the first two were wrong in
       ways that each swamped the mechanic under test:

       **It rotated into districts the family had no presence in.** That reads
       like the counterplay and is not — an unfamiliar district carries
       `UNFAMILIAR_SUCCESS_PENALTY` and its own police, and the arm was
       simultaneously buying influence and new ground, which this file has
       already recorded as worth more than almost anything else. It read
       30/36 and +$1.9M *before the mechanic existed at all.*

       **It re-picked the job on every move.** `board[board.length - 1]` is
       the worst thing on the board, and the board grows, so a "rotation" was
       quietly walking onto longer and more expensive work over a career. That
       is most of why an early reading showed its firing collapse from 170 a
       career to 79 while the static arm barely moved.

       With both fixed, the control row of the sweep says what rotation is
       worth on its own, with the pattern switched off entirely:

           mechanic off      moving ahead 20/36 at +$132,110
                             fired 86 against 178 left put
                             against the hand: moved −$4,753, left −$73,022

       That is the honest confound, and it is small: automating one grind job
       was a wash whichever way you did it, which is exactly what the earlier
       `autoPlus` bar had already found. Against it, the mechanic at the swept
       figures:

           mechanic on       moving ahead 22/36 at +$683,082
                             fired 81 against 167 left put
                             against the hand: moved +$46,920, left −$495,910

       **The cost lands on the lazy option and nowhere else.** Leaving an
       order where it is goes from −$73,022 to −$495,910, near seven times
       worse. Moving it goes from −$4,753 to +$46,920 — level, within noise of
       where it already was. The gap between them opens by a factor of five.

       So the shape the feature was supposed to have: automate well and you
       finish level with playing by hand, automate lazily and it is expensive,
       and neither answer dominates. Note carefully that moving is *level*
       and not ahead — 20/36 against the hand at 2% of an estate is a coin
       flip, which is what a convenience should be. The moment it stops being
       one, `RUNS_AUTO` above is the bar that should catch it.

       One thing found by hand rather than by the grid, and worth keeping
       because it was never designed: **the plateau is governed by how long
       the job is, not by how long the order stands.** A pattern rises per
       firing and fades per day, so a one-day job settles at 76.8 of 100 and a
       three-day job at 16.6 — under `noticeAbove`, which means the mechanic
       is close to invisible on the slower half of the board. Arguably correct
       (a job you do every night is a routine, one you do twice a month is
       not) but it fell out of the arithmetic rather than being chosen, and
       anybody re-sizing this should know it is there.
       ------------------------------------------------------------------
    */
    /*
       The bar, restated once — and the old one is left above rather than
       edited out, because what it said was true when it was written.

       It required the gap to beat 30/36 and $1,912,037, and those figures came
       from an arm with two defects in it. It rotated into districts the family
       had no presence in, so it was buying influence and new ground while
       claiming to measure rotation; and it re-picked the *job* on every move,
       drifting onto longer and worse work as the board grew. Both are fixed
       and both are recorded where they happened. A threshold inherited from a
       broken instrument is not a threshold.

       So this is the design property instead of a remembered number: **moving
       an order has to beat leaving it on most careers.** That is the whole
       claim the feature makes. The number it currently clears by is recorded
       below and deliberately not written into the assertion, because the next
       person to change a rate should see the bar fail on the claim rather than
       on somebody's high-water mark.
    */
    expect(
      ahead,
      'leaving a standing order where it is beats moving it, so there is no decision',
    ).toBeGreaterThan(Math.floor(gaps.length / 2));
  });

  /*
     The sweep the arm above asked for, on the two knobs it named.

     Not a bar. This prints a grid and asserts only that the grid was actually
     swept, because the whole point of DIRECTOR section 5 is that a number gets
     chosen off a plotted distribution rather than nudged until a bar goes
     green. What is being looked for is a sign flip: a cell where leaving an
     order put is worse than moving it, on most careers, for a reason that is
     the mechanic rather than the map.

     Both arms are recomputed inside each cell rather than read from the
     module-level ones, which were built with the shipped figures. Comparing a
     swept arm against an unswept one would be measuring the sweep against
     itself.

     Two knobs, and they are deliberately not `perFire` and `decayShare`:

     **How much it costs when parked** — `weight` and `heatAtFull` moved
     together, because splitting them asks a question nobody is going to act
     on separately.

     **How fast it clears when moved** — the decay half-life, with `perFire`
     scaled alongside it so the plateau stays where it is. Otherwise faster
     decay silently makes the parked order cheaper too, and the cell measures
     nothing.
  */
  it.skip('sweeps what a groove costs and how fast it clears', () => {
    const was = { ...PATTERN };
    const cell = (weight: number, heatAtFull: number, decayShare: number) => {
      const knobs = PATTERN as unknown as Record<string, number>;
      knobs.weight = weight;
      knobs.heatAtFull = heatAtFull;
      knobs.decayShare = decayShare;
      // Hold the plateau where it is: it is `perFire / decayShare`.
      knobs.perFire = was.perFire * (decayShare / was.decayShare);

      const moved = Array.from({ length: 36 }, (_, i) =>
        climb(700 + i, HUMAN_DAYS, { autoCycled: true }),
      );
      const left = Array.from({ length: 36 }, (_, i) =>
        climb(700 + i, HUMAN_DAYS, { autoPlus: true }),
      );
      const gaps = moved
        .map((r, i) => r.bestEstate - left[i].bestEstate)
        .sort((a, b) => a - b);
      return {
        ahead: gaps.filter((g) => g > 0).length,
        gap: median(gaps),
        movedFired: median(moved.map((r) => r.newSystems.auto.launched)),
        leftFired: median(left.map((r) => r.newSystems.auto.launched)),
        leftVsHand: median(left.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate)),
        movedVsHand: median(moved.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate)),
      };
    };

    /*
       The range is bounded by arithmetic before it is bounded by taste.

       A parked order plateaus at `perFire / decayShare`, which is 77 of 100.
       So `weight` 0.004 already takes 31 points off the odds and 0.008 takes
       62 — enough to turn an 85% corner shakedown into a 23% one. Anything
       past about 0.012 is 92 points, which is more than the whole usable
       scale: every cell above it would read as a flipped sign for the
       uninteresting reason that the job had been deleted rather than priced.

       A first grid ran x1 / x2.5 / x5 and was thrown away unread for exactly
       that: two of its three columns were off the end of the instrument.
    */
    const rows: string[] = [];
    for (const [w, h, label] of [
      /*
         The control, and the grid is not readable without it.

         This arm was rewritten twice — once to rotate only where the family
         already stands, once to stop re-picking the job on every move — and
         both rewrites moved it more than any knob below. So a cell where
         moving wins proves nothing on its own; it has to be read against the
         same corrected arm with the mechanic switched off, which is this row.
      */
      [0, 1, 'off'],
      [0.004, 2, '0.004/2'],
      [0.006, 2.5, '0.006/2.5'],
      [0.008, 3, '0.008/3'],
    ] as [number, number, string][]) {
      for (const [d, half] of [
        [was.decayShare, '27d'],
        [0.06, '12d'],
      ] as [number, string][]) {
        const r = cell(w, h, d);
        rows.push(
          `  cost ${label.padEnd(10)} half-life ${half.padEnd(4)}` +
            ` moving ahead ${String(r.ahead).padStart(2)}/36` +
            ` at $${Math.round(r.gap).toLocaleString('en-US').padStart(12)}` +
            ` | fired ${String(r.movedFired).padStart(3)} vs ${String(r.leftFired).padStart(3)}` +
            ` | vs hand, moved $${Math.round(r.movedVsHand).toLocaleString('en-US')}` +
            ` left $${Math.round(r.leftVsHand).toLocaleString('en-US')}`,
        );
      }
    }

    Object.assign(PATTERN as unknown as Record<string, number>, was);

    // eslint-disable-next-line no-console
    console.log(`pattern sweep — moving an order against leaving it put\n${rows.join('\n')}`);

    expect(rows.length, 'the grid was not actually swept').toBeGreaterThanOrEqual(6);
    expect(
      rows.some((r) => r.includes('off')),
      'the grid was swept without the control, so none of it can be attributed',
    ).toBe(true);
  });
});

describe('dealing with the people who cost you money', () => {
  it('says whether an ordinary career ever arrives at that decision', () => {
    const did = RUNS_CUTS.filter((r) => r.newSystems.cutting.tried > 0);
    const days = did
      .map((r) => r.newSystems.cutting.firstDay!)
      .sort((a, b) => a - b);
    const tries = RUNS_CUTS.map((r) => r.newSystems.cutting.tried).sort((a, b) => a - b);
    const landed = RUNS_CUTS.reduce((t, r) => t + r.newSystems.cutting.landed, 0);
    const tried = RUNS_CUTS.reduce((t, r) => t + r.newSystems.cutting.tried, 0);

    // eslint-disable-next-line no-console
    console.log(
      `cutting: ${did.length}/${RUNS_CUTS.length} careers ever decided somebody had to go
` +
        (did.length
          ? `         first time, 25th / median / 75th day: ` +
            `${pct(days, 0.25)} / ${median(days)} / ${pct(days, 0.75)}
`
          : '') +
        `         times a career, 25th / median / 75th: ` +
        `${pct(tries, 0.25)} / ${median(tries)} / ${pct(tries, 0.75)}
` +
        `         ${tried} attempted, ${landed} went right first time` +
        ` (${tried ? Math.round((landed / tried) * 100) : 0}%)`,
    );

    /*
       Reachable, and reachable while there is still a game left to play in.

       Same shape as the bars on the possessions catalogue and on teaching: a
       feature only met in the last fortnight has not been a decision, it has
       been a footnote.
    */
    expect(
      did.length,
      'no career ever arrives at a man bad enough to be worth the decision',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_CUTS.length / 2));
    expect(
      median(days),
      'the decision is only ever reached at the very end of a career',
    ).toBeLessThan(240);
  });

  it('says whether a mark is a race or a formality', () => {
    const out = RUNS_CUTS.reduce((t, r) => t + r.newSystems.cutting.marksOut, 0);
    const landed = RUNS_CUTS.reduce((t, r) => t + r.newSystems.cutting.marksLanded, 0);
    const lapsed = RUNS_CUTS.reduce((t, r) => t + r.newSystems.cutting.marksLapsed, 0);
    const talked = RUNS_CUTS.map((r) => r.newSystems.cutting.talked).sort((a, b) => a - b);

    // eslint-disable-next-line no-console
    console.log(
      `cutting: ${out} marks left standing by attempts that missed
` +
        `         ${landed} were eventually found, ${lapsed} got beyond reach` +
        `, ${out - landed - lapsed} still open at the end
` +
        `         evidence filed by men still out there talking, ` +
        `25th / median / 75th: ${pct(talked, 0.25)} / ${median(talked)} / ${pct(talked, 0.75)}`,
    );

    /*
       The instrument, then the property.

       An arm where nothing ever missed would satisfy everything below by never
       creating a mark at all — which is the shape of every false negative this
       project has shipped.
    */
    expect(out, 'no attempt ever missed, so the mark system is untouched').toBeGreaterThan(0);

    /*
       And both endings have to happen.

       All landing makes a mark a delayed certainty and the first roll
       irrelevant. None landing makes it decoration with a heat bill. The
       mechanic is only a race if the man sometimes wins.
    */
    expect(landed, 'a mark never once landed, so it is decoration').toBeGreaterThan(0);
    expect(lapsed, 'nobody ever got beyond reach, so a mark is a delayed certainty').toBeGreaterThan(
      0,
    );
    expect(
      median(talked),
      'men at large never told anybody anything, so a mark costs nothing to leave standing',
    ).toBeGreaterThan(0);
  });

  /*
     The half the arm above could not answer.

     "Doing this constantly is ruinous" is a true statement about a bot, not
     about the mechanic. What a player needs to know is whether there is ever a
     right moment for it — and a mechanic with no right moment is a trap with a
     button, not a decision.

     Read against the same baseline as the indiscriminate arm, so the three
     numbers sit on one scale.
  */
  it('says whether doing it rarely reads any differently from doing it always', () => {
    const gapsFor = (rs: typeof RUNS_CUTS) =>
      rs
        .map((r, i) => ({ r, against: RUNS_300[i] }))
        .filter(({ r }) => r.newSystems.cutting.tried > 0)
        .map(({ r, against }) => r.bestEstate - against.bestEstate)
        .sort((a, b) => a - b);
    const rare = gapsFor(RUNS_CUTS_RARE);
    const often = gapsFor(RUNS_CUTS);
    const at = (rs: typeof RUNS_CUTS, f: (r: (typeof RUNS_CUTS)[number]) => number) =>
      median(rs.map(f));

    // eslint-disable-next-line no-console
    console.log(
      `cutting: done sparingly — ${rare.length}/${RUNS_CUTS_RARE.length} careers ever did it
` +
        `         used ${at(RUNS_CUTS_RARE, (r) => r.newSystems.cutting.tried)} times a career` +
        ` against ${at(RUNS_CUTS, (r) => r.newSystems.cutting.tried)} doing it freely
` +
        `         estate against never cutting, 25th / median / 75th: ` +
        `$${Math.round(pct(rare, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(rare)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(rare, 0.75)).toLocaleString('en-US')}
` +
        `         careers ahead: ${rare.filter((g) => g > 0).length}/${rare.length}` +
        ` against ${often.filter((g) => g > 0).length}/${often.length} doing it freely
` +
        `         men left ${at(RUNS_CUTS_RARE, (r) => r.newSystems.crewLeft)}` +
        ` against ${at(RUNS_CUTS, (r) => r.newSystems.crewLeft)} and ` +
        `${at(RUNS_300, (r) => r.newSystems.crewLeft)} never cutting
` +
        `         skill floor ${at(RUNS_CUTS_RARE, (r) => r.newSystems.crewSkill.floor)}` +
        ` against ${at(RUNS_300, (r) => r.newSystems.crewSkill.floor)}` +
        `; heat-weeks ${Math.round(at(RUNS_CUTS_RARE, (r) => r.danger.heat))}` +
        ` against ${Math.round(at(RUNS_300, (r) => r.danger.heat))}`,
    );

    /*
       The instrument only. **No bar on the money here, deliberately.**

       Either answer is informative and neither is a defect. If restraint reads
       the same as excess, then the mechanic simply does not pay and it is a
       pressure valve rather than a play — which is a legitimate thing for a
       game about this world to contain. If restraint reads better, there is a
       right moment and the arm above was measuring a bot rather than a
       feature. Writing a threshold here would be deciding the answer before
       reading it.
    */
    /*
       What it measured, 36 careers at day 300, against the same baseline:

                              sparingly (3x)      freely (19x)
           reached            34/36               36/36
           estate, median     +$7                 −$1,110,650
           25th / 75th        −$654,305/+$358,418 −$1,538,094/+$335,267
           careers ahead      17/34               11/36
           men left           30                  27   (32 never cutting)
           skill floor        22                  23   (20 never cutting)
           heat-weeks         2,055               2,327 (2,043 never cutting)

       **Restraint does not read like excess. It reads like nothing at all.**

       A median of seven dollars on a $2.1M estate and a 17-of-34 split is a
       dead heat — the mechanic used properly is free, and it hands back a
       roster floor two points higher for twelve extra heat-weeks. Used freely
       the same mechanic costs a million.

       That distance is the feature. It is not a trap, because there is a right
       way to use it and the right way costs nothing; it is not a free upgrade,
       because there is a wrong way and the wrong way is ruinous. What separates
       them is knowing when — the same question this game asks about a
       sit-down, a district handed to somebody, and a standing order left where
       it is.

       **The prediction written before this ran was wrong**, and it is worth
       recording how. The reasoning was that the gain is small (one man off a
       roster of thirty-two) against a long-tailed bill (heat, a trace, and a
       mark leaking evidence for months), so even careful use should lose. The
       bill and the gain cancel almost exactly instead. The error was
       over-estimating what a mark costs when there are only three of them.

       Note also that the sparing arm reached 34/36 careers. Restraint here is
       not rarity of *opportunity* — the opportunity is everywhere. It is
       rarity of *decision*, which is the only kind worth measuring.
    */
    expect(
      rare.length,
      'the sparing arm never cut anybody, so it is the baseline under another name',
    ).toBeGreaterThan(0);
    expect(
      at(RUNS_CUTS_RARE, (r) => r.newSystems.cutting.tried),
      'the sparing arm was not actually sparing',
    ).toBeLessThan(at(RUNS_CUTS, (r) => r.newSystems.cutting.tried));
  });

  /*
     The figures behind all of it, which were never plotted.

     Everything in `config/silence.ts` was chosen from shape — what a botched
     hit ought to feel like, what a man at large ought to cost — and then two
     arms were built on top of them. That is the wrong order and it is the one
     thing DIRECTOR section 5 exists to forbid, so this is the sweep that
     should have come first.

     Two levers, crossed rather than gridded. Each is varied with the other
     held where it is, which answers "is this number defensible" for five
     cells rather than nine.

     **How often it works first time** (`SILENCE.base`) decides whether the
     mark system is ever reached at all. Too high and a botched attempt is a
     curiosity; too low and every removal is a six-month manhunt.

     **How loud a survivor is** (`MARK.talksHeat`) is what stops a botched
     attempt from being a free retry, and therefore what stops careful use from
     being a free upgrade.

     That lever started as `talksStrength`, an evidence trace, and the first
     run of this grid found it did **nothing** — 2.5, 5 and 10 returned the
     same estate to the dollar on both use-patterns. Case strength already
     reads 100 in an ordinary career, so a trace added to it goes nowhere, and
     a claim made confidently in three files rested on a number that was inert.
     It now costs heat on the inside channel, which is the thread `dismiss`
     cuts, and this grid re-runs against that.

     Read against both use-patterns, because the interesting failure is one
     that moves them the same way: if a knob makes sparing *and* indiscriminate
     use both better, it is not pricing the decision, it is just a discount.
  */
  it.skip('sweeps what a botched hit costs and how loud a survivor is', () => {
    const wasS = { ...SILENCE };
    const wasM = { ...MARK };
    const cell = (base: number, talks: number) => {
      (SILENCE as unknown as Record<string, number>).base = base;
      (MARK as unknown as Record<string, number>).talksHeat = talks;

      const often = Array.from({ length: 36 }, (_, i) =>
        climb(700 + i, HUMAN_DAYS, { cuts: true }),
      );
      const rare = Array.from({ length: 36 }, (_, i) =>
        climb(700 + i, HUMAN_DAYS, { cutsRarely: true }),
      );
      const gap = (rs: typeof often) => {
        const gs = rs
          .map((r, i) => ({ r, against: RUNS_300[i] }))
          .filter(({ r }) => r.newSystems.cutting.tried > 0)
          .map(({ r, against }) => r.bestEstate - against.bestEstate)
          .sort((a, b) => a - b);
        return { median: median(gs), ahead: gs.filter((g) => g > 0).length, n: gs.length };
      };
      const tried = often.reduce((t, r) => t + r.newSystems.cutting.tried, 0);
      const landed = often.reduce((t, r) => t + r.newSystems.cutting.landed, 0);
      return {
        rare: gap(rare),
        often: gap(often),
        firstTime: tried ? landed / tried : 0,
        marksLanded: often.reduce((t, r) => t + r.newSystems.cutting.marksLanded, 0),
        marksLapsed: often.reduce((t, r) => t + r.newSystems.cutting.marksLapsed, 0),
      };
    };

    const rows: string[] = [];
    const cells: [number, number, string][] = [
      [0.6, wasM.talksHeat, 'base 0.60'],
      [wasS.base, wasM.talksHeat, 'as shipped'],
      [0.84, wasM.talksHeat, 'base 0.84'],
      [wasS.base, 1, 'heat 1.0 '],
      [wasS.base, 5, 'heat 5.0 '],
    ];
    for (const [b, t, label] of cells) {
      const r = cell(b, t);
      rows.push(
        `  ${label.padEnd(11)} first-time ${(r.firstTime * 100).toFixed(0).padStart(2)}%` +
          ` | sparingly ${String(r.rare.ahead).padStart(2)}/${r.rare.n}` +
          ` at $${Math.round(r.rare.median).toLocaleString('en-US').padStart(11)}` +
          ` | freely ${String(r.often.ahead).padStart(2)}/${r.often.n}` +
          ` at $${Math.round(r.often.median).toLocaleString('en-US').padStart(12)}` +
          ` | marks ${r.marksLanded} found / ${r.marksLapsed} lost`,
      );
    }

    Object.assign(SILENCE as unknown as Record<string, number>, wasS);
    Object.assign(MARK as unknown as Record<string, number>, wasM);

    // eslint-disable-next-line no-console
    console.log('silence sweep — against never cutting anybody\n' + rows.join('\n'));

    /*
       Instrument only, and no threshold on the money, for the same reason the
       sparing arm carries none: a bar here would be deciding the answer before
       reading it. What the grid is for is seeing whether the shipped column
       sits somewhere defensible on a curve rather than at an arbitrary point
       nobody ever looked at.
    */
    expect(rows.length, 'the grid was not actually swept').toBe(cells.length);
    expect(SILENCE.base, 'the sweep did not put the config back').toBe(wasS.base);
    expect(MARK.talksHeat, 'the sweep did not put the config back').toBe(wasM.talksHeat);
  });

  it('says whether shooting your worst people beats keeping them, and it must not', () => {
    const rows = RUNS_CUTS.map((r, i) => ({ r, against: RUNS_300[i] })).filter(
      ({ r }) => r.newSystems.cutting.tried > 0,
    );
    const gaps = rows
      .map(({ r, against }) => r.bestEstate - against.bestEstate)
      .sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;
    const at = (rs: typeof RUNS_CUTS, f: (r: (typeof RUNS_CUTS)[number]) => number) =>
      median(rs.map(f));

    // eslint-disable-next-line no-console
    console.log(
      `cutting: estate against never cutting anybody, 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `         careers where cutting came out ahead: ${ahead}/${gaps.length}
` +
        `         men left at the end ${at(RUNS_CUTS, (r) => r.newSystems.crewLeft)}` +
        ` against ${at(RUNS_300, (r) => r.newSystems.crewLeft)} never cutting` +
        `; crew skill floor ${at(RUNS_CUTS, (r) => r.newSystems.crewSkill.floor)}` +
        ` against ${at(RUNS_300, (r) => r.newSystems.crewSkill.floor)}
` +
        `         heat-weeks ${Math.round(at(RUNS_CUTS, (r) => r.danger.heat))}` +
        ` against ${Math.round(at(RUNS_300, (r) => r.danger.heat))}` +
        `; case strength ${Math.round(at(RUNS_CUTS, (r) => r.danger.peakCase))}` +
        ` against ${Math.round(at(RUNS_300, (r) => r.danger.peakCase))}`,
    );

    /*
       The bar the feature is sold on.

       Removing the bottom of your own roster must not be a free upgrade. If it
       is, the correct play is to shoot anybody who has a bad month, and the
       informant trace that exists to stop exactly that is not doing its job.

       On the share of careers rather than the median, for the reason this file
       has now recorded three times: the median of thirty-odd paired careers has
       repeatedly failed to price a mechanic here.
    */
    /*
       What it measured, 36 careers at day 300:

           reached                36/36 careers, first on day 35
           used                   19 times a career (25th 16, 75th 22)
           landed first time      363 of 663, 55%
           marks left standing    300 — 214 found, 49 beyond reach, 37 still open
           men at large talking   46.2 of evidence, median career
           estate against never   −$1,538,094 / −$1,110,650 / +$335,267
           careers ahead          11/36
           men left               27 against 32; skill floor 23 against 20
           heat-weeks             2,327 against 2,043

       **The mechanic does the thing it claims and it is not worth it.** The
       floor of the roster genuinely rises — 23 against 20, because the bottom
       of it keeps being removed — and the family is a million poorer for it.
       That is the shape a decision is supposed to have: what you wanted
       happens, and the bill is larger than the gain.

       55% landing first time is the arithmetic working. `SILENCE.base` is 0.72
       less up to 0.34 for competence, so a roster averaging 50 should land
       just over half the time, and it does.

       And a mark is a race rather than a formality: about five in six are
       eventually found and one in six gets away for good. The man sometimes
       wins, which is the only reason the first roll matters.

       **The caveat, and it is a real limit on what this arm proves.** The bot
       does this nineteen times a career, which nobody would. So this measures
       *indiscriminate* use and shows it is ruinous — it does not establish
       that there is a good use of it, because no arm here uses it sparingly.
       A career that cut two men in four years would read nothing like this,
       and the honest statement of what is known is: cutting people is not a
       free upgrade. Whether it is ever the right call is unmeasured.

       Resisted the obvious move of raising the bot's threshold until the arm
       came out ahead. That is tuning a bot to make a mechanic look good, which
       is DIRECTOR section 5 wearing a different hat.

       One reading here discriminates nothing and is kept only so nobody adds
       it again expecting more: **case strength is 100 on both arms.** It is at
       its ceiling in an ordinary career already, so it cannot say anything
       about what this costs.
    */
    expect(
      ahead,
      'shooting your worst earners is a free upgrade, so the trace they leave costs nothing',
    ).toBeLessThan(Math.ceil(gaps.length / 2));
  });
});

describe('putting a man with somebody', () => {
  it('says whether an ordinary career ever does it', () => {
    const did = RUNS_TRAINS.filter((r) => r.newSystems.teaching.started > 0);
    const days = did.map((r) => r.newSystems.teaching.firstDay!).sort((a, b) => a - b);
    const runs = RUNS_TRAINS.map((r) => r.newSystems.teaching.started).sort((a, b) => a - b);
    const finished = RUNS_TRAINS.reduce((t, r) => t + r.newSystems.teaching.finished, 0);
    const started = RUNS_TRAINS.reduce((t, r) => t + r.newSystems.teaching.started, 0);
    const gained = RUNS_TRAINS.reduce((t, r) => t + r.newSystems.teaching.gained, 0);

    // eslint-disable-next-line no-console
    console.log(
      `teaching: ${did.length}/${RUNS_TRAINS.length} careers ever paired anybody
` +
        (did.length
          ? `          first pairing, 25th / median / 75th day: ` +
            `${pct(days, 0.25)} / ${median(days)} / ${pct(days, 0.75)}
`
          : '') +
        `          pairings per career, 25th / median / 75th: ` +
        `${pct(runs, 0.25)} / ${median(runs)} / ${pct(runs, 0.75)}
` +
        `          ${started} started, ${finished} ran to the end, ` +
        `${started - finished} came apart
` +
        `          skill the students came back with: ${gained.toFixed(0)} points in all, ` +
        `${finished ? (gained / finished).toFixed(1) : '0'} a pairing
` +
        `          weeks holding two men off the board, median ` +
        `${median(RUNS_TRAINS.map((r) => r.newSystems.teaching.weeksPaired))}`,
    );

    /*
       Reachable, and reachable early enough to compound. A man taught on day
       280 is a man taught for twenty days of play, which is the same failure
       the possessions catalogue was guarded against.
    */
    expect(
      did.length,
      'nobody ever puts one man with another',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_TRAINS.length / 2));
    expect(
      median(days),
      'pairing is only reachable in the last stretch of a career',
    ).toBeLessThan(240);
    /*
       And it has to be a decision rather than a standing order. A bot pairing
       every single week has found a button, not a trade.
    */
    expect(
      started - finished,
      'no pairing ever came apart, so losing a man to a cell costs nothing here',
    ).toBeGreaterThan(0);
  });

  it('says what the roster is actually worth at the end', () => {
    const at = (rs: typeof RUNS_TRAINS, f: (r: (typeof RUNS_TRAINS)[number]) => number) =>
      median(rs.map(f));

    // eslint-disable-next-line no-console
    console.log(
      `teaching: crew skill at day 300, median man / best / floor — ` +
        `teaching ${at(RUNS_TRAINS, (r) => r.newSystems.crewSkill.median)} / ` +
        `${at(RUNS_TRAINS, (r) => r.newSystems.crewSkill.best)} / ` +
        `${at(RUNS_TRAINS, (r) => r.newSystems.crewSkill.floor)}` +
        `; never teaching ${at(RUNS_300, (r) => r.newSystems.crewSkill.median)} / ` +
        `${at(RUNS_300, (r) => r.newSystems.crewSkill.best)} / ` +
        `${at(RUNS_300, (r) => r.newSystems.crewSkill.floor)}`,
    );

    /*
       The direct reading, and the one the estate gap could not give.

       Whether a fortnight of two men bought anything is a question about the
       roster, not about the whole career — and unlike the estate, this is a
       quantity the mechanic moves on purpose. The floor is where it should
       show first: the bot pairs its worst spare man with its best.
    */
    expect(
      at(RUNS_TRAINS, (r) => r.newSystems.crewSkill.floor),
      'teaching does not raise the floor of the roster, so it bought nothing',
    ).toBeGreaterThan(at(RUNS_300, (r) => r.newSystems.crewSkill.floor));
  });

  it('says whether it is worth the two men it holds', () => {
    const rows = RUNS_TRAINS.map((r, i) => ({ r, against: RUNS_300[i] })).filter(
      ({ r }) => r.newSystems.teaching.finished > 0,
    );
    const gaps = rows
      .map(({ r, against }) => r.bestEstate - against.bestEstate)
      .sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;
    const idle = (rs: typeof RUNS_TRAINS) =>
      rs
        .map((r) => (r.newSystems.scores.weeks ? r.newSystems.scores.weeksNobodyIdle / r.newSystems.scores.weeks : 0))
        .sort((a, b) => a - b);

    // eslint-disable-next-line no-console
    console.log(
      `teaching: paired against the same seeds, ${rows.length} careers that taught somebody —
` +
        `          estate difference 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `          careers that came out ahead: ${ahead}/${gaps.length}
` +
        `          weeks with nobody spare — teaching ` +
        `${(median(idle(RUNS_TRAINS)) * 100).toFixed(0)}%, never teaching ` +
        `${(median(idle(RUNS_300)) * 100).toFixed(0)}%`,
    );

    /*
       The same two bars the scores arm carries, and for the same reason: the
       median of thirty-odd paired careers cannot price a feature at this
       sample size, but the share of careers ahead can say whether it is a trap
       or free money. Both ends, because a fortnight of two men that always
       pays is not a decision either.
    */
    expect(ahead, 'teaching somebody makes almost every career poorer').toBeGreaterThan(
      Math.floor(gaps.length / 4),
    );
    expect(ahead, 'teaching somebody is free money').toBeLessThan(gaps.length);
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
    /*
       **Read against the windows a player opens, not against the ones that
       shut.** It was `/ expired`, and that denominator gets the sign wrong:
       repair the other six causes and this share *rises* while the number of
       scores the game takes away falls. It also has no resolution — the run
       that caught this had ten expiries in six hundred and twenty-four
       windows, so a bar of 5% on a denominator of 10 is a bar of "exactly
       zero" wearing a percentage, and it had been passing at 0 of N by luck
       rather than by design.

       Same defect as the witness bar two blocks up, which compared counts
       while claiming a rate. Both are the denominator, and both were found by
       something else moving the population rather than by anybody reading the
       assertion.

       The threshold is unchanged and it is a harder bar against this
       denominator: the comment above records 33 expiries in 148 windows before
       `tickScores` stopped the clock, which is 22% and would have failed
       loudly. It reads 1 in 624 now.
    */
    expect(
      (last.get('laying low') ?? 0) / Math.max(1, opened),
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
    const rows = WIDE_SCORES.map((r, i) => ({ r, against: WIDE[i] })).filter(
      ({ r }) => r.newSystems.scores.prepped > 0,
    );
    const gaps = rows.map(({ r, against }) => r.bestEstate - against.bestEstate).sort((a, b) => a - b);
    const ahead = gaps.filter((g) => g > 0).length;
    // Same populations as the gap above it, or the two lines in one readout
    // are about different worlds.
    const heat = pairedGap(
      WIDE_SCORES,
      WIDE,
      (r) => r.danger.heat,
      (r) => (r as (typeof WIDE_SCORES)[number]).newSystems.scores.prepped > 0,
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
    /*
       Rule 4. This is one of the two bars a numerically inert baseline build
       flipped, at 11 of 36 against a floor of 12.
    */
    const worth = resolves(ahead, gaps.length, 1 / 3);
    expect(worth.ok, worth.why).toBe(true);
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
    // Only the careers that actually ran something. A career that never opened
    // a route has a `worstRouteSentiment` of 100 and would drag the median up
    // into a pass no matter what the trade did to anybody.
    const ran = RUNS_TRADING.filter((r) => r.trade.worstRouteSentiment < 100);
    // Careers that held ground on both sides of the comparison. A career with
    // a route in everything it owns has no control in it and belongs in
    // neither column.
    const paired = RUNS_TRADING.filter(
      (r) => r.trade.routedFeeling !== null && r.trade.unroutedFeeling !== null,
    );

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
        `${Math.round(median(base))} vs ${Math.round(median(trading))}\n` +
        `        worst feeling in a district they ran through: median ` +
        `${Math.round(median(ran.map((r) => r.trade.worstRouteSentiment)))}, ` +
        `p10 ${Math.round(pct(ran.map((r) => r.trade.worstRouteSentiment), 0.1))} · ` +
        `took one below ${SENTIMENT_HOSTILE_BELOW}: ` +
        `${ran.filter((r) => r.trade.routeWentHostile).length}/${ran.length}\n` +
        `        feeling at the end, paired within each career: ran through ` +
        `${Math.round(median(paired.map((r) => r.trade.routedFeeling!)))} vs held and left ` +
        `alone ${Math.round(median(paired.map((r) => r.trade.unroutedFeeling!)))} ` +
        `(${paired.length} careers held both)`,
    );

    /*
       Three conditions now, and they are about whether the trade is a real
       option rather than about how much it pays.

       A trade most careers cannot get into is content nobody sees. A trade
       that leaves a family no better off is a button that costs a retainer.

       And the third, which is here because its absence is what let the fault
       ship: a trade the street never notices is not the dangerous half of this
       game's economy, whatever its blurb says. `SENTIMENT_START` is 50 and the
       recovery is 2.0 a week, so a district that ends a career of trading at
       50 was never touched at all — the drain lost the race to the recovery
       every single week. The bar is deliberately loose: it asks that the trade
       leaves a mark, not that it ruins anybody.
    */
    expect(
      opened.length,
      'most careers can never get into the trade at all',
    ).toBeGreaterThanOrEqual(Math.ceil(RUNS_TRADING.length / 2));
    expect(
      median(trading),
      'running both trades for 300 days leaves a family no better off',
    ).toBeGreaterThan(median(base));
    /*
       Paired, because the unpaired version could not attribute anything. The
       bot works jobs and standing orders in the districts it runs product
       through, and either of those alone bottoms a neighbourhood out — so
       "worst feeling on a routed street" read a median of 1 both before and
       after `sentimentPerUnit` was corrected by a factor of eight. It was
       never measuring the trade. This is.
    */
    expect(
      median(paired.map((r) => r.trade.routedFeeling!)),
      'the streets a career ran product through end no worse than the ones it left alone',
    ).toBeLessThan(median(paired.map((r) => r.trade.unroutedFeeling!)));
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

/*
   What the map is worth to somebody who wants what is on it.

   The territory rework gave each of the twelve districts a yield and wired six
   of them into six systems — hiring, laundering, prices, favours, heat decay,
   payouts. Then the probe ran and reported that nothing had happened:
   stagnation -0.60 before and -0.60 after, six districts held both times, and
   peak clean up five percent, which is district income arriving by itself.

   That reading was worthless and it was worthless for a knowable reason. The
   baseline bot expands until the job gates stop asking and then stops, and it
   hands a district over only when a spare senior man happens to coincide with
   a Sunday. It has never evaluated ground for what ground gives, because until
   the rework ground did not give anything. **A mechanic that creates a
   decision cannot be measured by a bot that does not take the decision.**

   So the arm goes where the thing it does not have is, and puts somebody in
   what it holds.

   The first version of this block read that arm against `RUNS_300` and the
   result was 36 careers of 36 ahead at a median of +$6,498,661. That is a
   confound rather than a finding and it is recorded below rather than
   quietly replaced, because the shape of the mistake is the useful part: the
   arm took the whole map, and taking the whole map is worth a fortune for
   reasons this file priced long ago. The yields hardly ran at all.

   The bar therefore reads against `RUNS_GROUND_DEAD` — the same bot, same
   seeds, same twelve districts, same four stewards, with the yields paying
   nothing. Expansion appears in both and cancels.
*/
/*
   The capital wall at tier 4, read before anything is changed about it.

   Round 16's tester stopped having decisions at day 92: Call In Tribute was
   free, everything comparable asked $50,000, and they had $5,600. A retiming
   built on that diagnosis was measured by this file and rejected — it took
   "what the ground is for" to exactly 18 of 36 — so this reads the situation
   instead of guessing at it again.

   Reporting only. Nothing here asserts, because the question is what the
   numbers are, and a bar invented before the reading is the mistake that
   produced the reverted commit.
*/
describe('the wall at tier four', () => {
  it('says what a career has when tier-4 work opens, and whether it can pay for any', () => {
    const opened = RUNS_300.filter((r) => r.tier4Day !== null);
    const funds = opened.map((r) => r.fundsAtTier4 ?? 0).sort((a, b) => a - b);
    const afforded = opened.filter((r) => r.couldAffordDay !== null);
    const wait = afforded
      .map((r) => (r.couldAffordDay ?? 0) - (r.tier4Day ?? 0))
      .sort((a, b) => a - b);

    const census = new Map<string, number>();
    for (const r of RUNS_300) {
      for (const [id, n] of Object.entries(r.launchedBy)) {
        census.set(id, (census.get(id) ?? 0) + n);
      }
    }
    const top = [...census].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const paidTier4 = OPERATIONS.filter((o) => o.tier === 4 && o.investment > 0);

    // eslint-disable-next-line no-console
    console.log(
      `wall: ${opened.length}/${RUNS_300.length} careers ever opened tier-4 work` +
        `, median day ${opened.length ? median(opened.map((r) => r.tier4Day ?? 0)) : '-'}
` +
        `      funds the day it opened, 25th / median / 75th: ` +
        `${pct(funds, 0.25)} / ${median(funds)} / ${pct(funds, 0.75)}   (bar is 50,000)
` +
        `      careers that ever reached the bar afterwards: ${afforded.length}/${opened.length}` +
        `${wait.length ? `, median ${median(wait)} days later` : ''}
` +
        `      paid tier-4 jobs ever launched: ` +
        paidTier4
          .map((o) => `${o.name} ${census.get(o.id) ?? 0}`)
          .join(', ') +
        `
      free tier-4: Call In Tribute ${census.get('call_in_tribute') ?? 0}
` +
        `      most-run jobs overall: ` +
        top.map(([id, n]) => `${id} ${n}`).join(', '),
    );
  });
});

describe('what the ground is for', () => {
  it('says whether what a district gives is worth anything', () => {
    const at = (rs: typeof RUNS_GROUND, f: (r: (typeof RUNS_GROUND)[number]) => number) =>
      median(rs.map(f));
    const gaps = RUNS_GROUND.map((r, i) => r.bestEstate - RUNS_GROUND_DEAD[i].bestEstate).sort(
      (a, b) => a - b,
    );
    const ahead = gaps.filter((g) => g > 0).length;
    const sprawl = RUNS_GROUND.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate).sort(
      (a, b) => a - b,
    );

    // eslint-disable-next-line no-console
    console.log(
      `ground: ${RUNS_GROUND.length} careers, ${HUMAN_DAYS} days, same seeds throughout
` +
        `        what the bot did, chasing / yields dead / by hand:
` +
        `          districts controlled  ${at(RUNS_GROUND, (r) => r.newSystems.ground.controlled)}` +
        ` / ${at(RUNS_GROUND_DEAD, (r) => r.newSystems.ground.controlled)}` +
        ` / ${at(RUNS_300, (r) => r.newSystems.ground.controlled)}
` +
        `          of those, staffed    ${at(RUNS_GROUND, (r) => r.newSystems.ground.working)}` +
        ` / ${at(RUNS_GROUND_DEAD, (r) => r.newSystems.ground.working)}` +
        ` / ${at(RUNS_300, (r) => r.newSystems.ground.working)}
` +
        `          kinds held (of 6)    ${at(RUNS_GROUND, (r) => r.newSystems.ground.kinds)}` +
        ` / ${at(RUNS_GROUND_DEAD, (r) => r.newSystems.ground.kinds)}` +
        ` / ${at(RUNS_300, (r) => r.newSystems.ground.kinds)}
` +
        `          crew left            ${at(RUNS_GROUND, (r) => r.newSystems.crewLeft)}` +
        ` / ${at(RUNS_GROUND_DEAD, (r) => r.newSystems.crewLeft)}` +
        ` / ${at(RUNS_300, (r) => r.newSystems.crewLeft)}
` +
        `        the yields, against the same bot on a map that pays nothing:
` +
        `          estate 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}
` +
        `          careers ahead: ${ahead}/${gaps.length}
` +
        `          heat-weeks ${Math.round(at(RUNS_GROUND, (r) => r.danger.heat))}` +
        ` against ${Math.round(at(RUNS_GROUND_DEAD, (r) => r.danger.heat))}` +
        `; hires ${at(RUNS_GROUND, (r) => r.hires)}` +
        ` against ${at(RUNS_GROUND_DEAD, (r) => r.hires)}
` +
        `        and the confound, kept because it is the reason for the control:
` +
        `          same bot against playing by hand, median ` +
        `$${Math.round(median(sprawl)).toLocaleString('en-US')}` +
        `, ahead on ${sprawl.filter((g) => g > 0).length}/${sprawl.length}`,
    );

    /*
       Instrument first, and the first version of this got it wrong.

       It asked whether the arm held more ground and more kinds than the hand,
       which it did — and both passed while the thing under test was almost
       switched off, because staffing is what turns a yield on and staffing
       barely moved. The right question is whether the arm ran enough working
       holdings for the six multipliers to be doing anything measurable at all.
    */
    expect(
      at(RUNS_GROUND, (r) => r.newSystems.ground.working),
      'the arm staffed almost no ground, so the yields were never switched on',
    ).toBeGreaterThanOrEqual(3);
    expect(
      at(RUNS_GROUND, (r) => r.newSystems.ground.controlled),
      'the two populations took different amounts of ground, so they are not a pair',
    ).toBe(at(RUNS_GROUND_DEAD, (r) => r.newSystems.ground.controlled));

    /*
       And the claim. A sign flip between two populations rather than a
       threshold on a median, because the median of thirty-six paired careers
       has now failed to price a mechanic three separate times in this file.

       If this loses, the six yields are a tax on attention dressed as a
       decision, and the right response is to cut them rather than defend them.

       Measured, 36 paired careers at day 300:

           districts controlled  12 / 12 / 4     chasing / dead / by hand
           of those, staffed      4 /  4 / 3
           kinds held (of 6)      4 /  4 / 3
           crew left             58 / 57 / 31
           estate v dead map     -$1,898,146 / +$579,789 / +$3,390,204
           careers ahead         23/36
           heat-weeks            1,635 against 1,736
           v playing by hand     +$6,498,661, ahead on 36/36  (the confound)

       It passes, and it passes narrowly enough to be worth stating precisely.
       Twenty-three careers of thirty-six is a sign flip rather than a
       landslide, and the quartiles straddle zero by nearly two million in
       either direction — so the yields are worth roughly half a million to a
       family that has already taken the whole map, with enormous variance in
       whether any individual career sees it.

       Two things that number is not. It is not the +$6.5M above, which is
       expansion. And it is not the rework at full strength: this bot holds
       four kinds of six and staffs four districts of twelve, so a third of the
       mechanic has still never been exercised by anything. The ceiling is
       unmeasured and the bench is why.

       The mechanism shows in the two rows underneath. Heat-weeks fall by 101
       and hires rise by one on the same seeds — quieter streets and cheaper
       men, which is `quiet` and `labour` doing exactly what they say. The
       populations diverge in behaviour rather than only in money, which is the
       right shape: a yield that only moved the estate would be a rebate.
    */
    expect(
      ahead,
      'holding ground paid the same whether or not the ground gave anything',
    ).toBeGreaterThan(gaps.length / 2);
  });

  /*
     And the thing the arm found on the way, which contradicts the design.

     `config/holdings.ts` says in three places that you are not supposed to end
     up holding everything, and that the reason is that every district you want
     the use of costs you a man. The first half is wrong and the second half is
     right about the wrong thing.

     A bot that simply keeps expanding controls all twelve districts inside 300
     days. Taking ground is not the constraint — nothing in the game stops it.
     What it cannot do is *staff* them: it ran four stewards against twelve
     districts held, with fifty-eight men on the books, because the bench is
     full of people too junior to be given anything.

     So the constraint the rework leans on is real, but it is not the one
     written down. Holding the map is free; having the use of it is not.
  */
  it('says whether holding everything is actually out of reach', () => {
    const held = median(RUNS_GROUND.map((r) => r.newSystems.ground.controlled));
    const staffed = median(RUNS_GROUND.map((r) => r.newSystems.ground.working));

    // eslint-disable-next-line no-console
    console.log(
      `ground: a boss who never stops expanding controlled ${held} districts of ` +
        `${TERRITORIES.length} by day ${HUMAN_DAYS}
` +
        `        and had somebody standing in ${staffed} of them, out of ` +
        `${median(RUNS_GROUND.map((r) => r.newSystems.crewLeft))} men`,
    );

    expect(
      staffed,
      'the map was fully staffed, so nothing at all limits how much ground pays',
    ).toBeLessThan(held);
  });

  /*
     And whether a boss who hands the nights over still gets the map.

     Taking all twelve districts turned out to be free, and it was free for a
     reason worth naming: the bot builds influence by working a district, so
     expanding costs it nothing except which district tonight's job runs in.
     That makes the map and the operations loop the same decision wearing two
     hats — and this game now ships a switch that takes the operations loop
     away from you.

     `tickAutopilot` works `operableTerritories(state)[0]`. The first entry,
     every night, for the whole career. This file found that exact defect in
     its own bot and the note above the fix is still there: "the median career
     took a single district to influence 100 and never took a second past 50".
     The shipped feature has the same line in it.

     So this is not really a test about territory. It asks whether turning the
     autopilot on quietly hands over the map as well as the crews, and it is
     read against a boss who wants the identical map and works for it himself.
  */
  it('says whether a boss who hands the work over still takes the ground', () => {
    const at = (rs: typeof RUNS_GROUND, f: (r: (typeof RUNS_GROUND)[number]) => number) =>
      median(rs.map(f));
    const gaps = RUNS_GROUND_AUTO.map((r, i) => r.bestEstate - RUNS_GROUND[i].bestEstate).sort(
      (a, b) => a - b,
    );

    // eslint-disable-next-line no-console
    console.log(
      `ground: the same boss, handing the nights to the shipped autopilot
` +
        `        handed over / running it himself:
` +
        `          districts controlled  ${at(RUNS_GROUND_AUTO, (r) => r.newSystems.ground.controlled)}` +
        ` / ${at(RUNS_GROUND, (r) => r.newSystems.ground.controlled)} of ${TERRITORIES.length}
` +
        `          of those, staffed    ${at(RUNS_GROUND_AUTO, (r) => r.newSystems.ground.working)}` +
        ` / ${at(RUNS_GROUND, (r) => r.newSystems.ground.working)}
` +
        `          kinds held (of 6)    ${at(RUNS_GROUND_AUTO, (r) => r.newSystems.ground.kinds)}` +
        ` / ${at(RUNS_GROUND, (r) => r.newSystems.ground.kinds)}
` +
        `          peak influence       ${at(RUNS_GROUND_AUTO, (r) => r.influence.peak)}` +
        ` / ${at(RUNS_GROUND, (r) => r.influence.peak)}` +
        `; districts ever at control ${at(RUNS_GROUND_AUTO, (r) => r.influence.everControl)}` +
        ` / ${at(RUNS_GROUND, (r) => r.influence.everControl)}
` +
        `          jobs finished       ${at(RUNS_GROUND_AUTO, (r) => r.bestOps)}` +
        ` / ${at(RUNS_GROUND, (r) => r.bestOps)}
` +
        `          crew left            ${at(RUNS_GROUND_AUTO, (r) => r.newSystems.crewLeft)}` +
        ` / ${at(RUNS_GROUND, (r) => r.newSystems.crewLeft)}
` +
        `          estate 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}` +
        `; ahead on ${gaps.filter((g) => g > 0).length}/${gaps.length}`,
    );

    /*
       Instrument first, and the first version of this bar was itself the bug.

       It read `launchEra`, which is a counter the probe increments inside its
       own job loop — the loop `handsOver` deliberately switches off. So it
       reported "jobs launched 0" for a population that was launching jobs
       every night, and failed the run for the wrong reason. Sixteenth time in
       this project that an instrument has confidently measured itself.

       `bestOps` is `state.org.record.ops`, kept by the game across every boss,
       and it counts a job whoever ordered it.
    */
    expect(
      at(RUNS_GROUND_AUTO, (r) => r.bestOps),
      'the shipped autopilot finished nothing, so this measures an idle career',
    ).toBeGreaterThan(20);

    /*
       And the claim, which is the bar every automation in this game is held
       to, applied to the one thing nobody thought to apply it to: **handing
       the work over must not hand the map over.** A convenience may cost you
       clicking. It may not cost you a system you were playing.

       Measured, 36 paired careers at day 300, handed over / by his own hand:

                                  before the fix     after
           districts controlled      1 / 12         12 / 12
           of those, staffed         1 /  4          4 /  4
           kinds held (of 6)         1 /  4          4 /  4
           districts ever at control 1 / 12         12 / 12
           crew left                 8 / 58         51 / 58
           jobs finished             —              139 / 291
           estate median         -$8,455,488        -$2,250
           careers ahead              0/36            17/36

       The before column is what the shipped switch did. One district, ever, on
       all thirty-six careers, with peak influence at 100 — it worked a single
       neighbourhood to saturation and never touched another. The crew fell
       from fifty-eight men to eight and the family lost eight and a half
       million. Throwing the switch did not cost clicking; it cost the map, the
       crew and the career, and nothing in the game said a word about it.

       The after column is the bar being met almost exactly. Same twelve
       districts, same four staffed, same four kinds, and an estate gap of
       -$2,250 on an eight-figure estate with seventeen careers of thirty-six
       ahead. That is a coin flip, which is what a convenience is supposed to
       read as: it must not beat playing, and it may not cost you anything
       either.

       One figure worth not over-reading. The autopilot finishes 139 jobs
       against the hand's 291 and arrives at the same map with seven fewer men.
       It is doing roughly half the work for roughly the same result, and this
       instrument cannot say whether that is efficiency or the hand wasting
       nights. It is not a claim, it is a thing to look at later.
    */
    expect(
      at(RUNS_GROUND_AUTO, (r) => r.newSystems.ground.controlled),
      'handing the nights to the autopilot cost the boss the map he was taking',
    ).toBeGreaterThanOrEqual(at(RUNS_GROUND, (r) => r.newSystems.ground.controlled));
  });
});

/*
   Where a career actually stalls, now that fronts have been reworked twice.

   The third piece of the front work was going to be "fix the money wall", sold
   on F15: money blocks 97% of the weeks a career owns no front, and 30 careers
   of 36 finish under $100,000 holding exactly one. That is no longer what this
   build does — every career compounds, the median holds ten fronts at the end,
   and fronts are missing on 2% of paydays. F15 is stale, and when it went stale
   is not knowable from here: the heat-decay repair, the wash-cut repair and the
   job-table restake all moved estates a long way.

   What the probe reports instead is that **laundering capacity is the binding
   constraint on 58% of paydays**. Before building anything against that, this
   asks whether it is a property of the economy or a property of the bot.
*/
describe('where the clean money stops', () => {
  it('says whether the capacity wall is the economy or the shopping', () => {
    const at = (rs: typeof RUNS_300, f: (r: (typeof RUNS_300)[number]) => number) =>
      median(rs.map(f));
    const share = (rs: typeof RUNS_300, f: (w: (typeof RUNS_300)[number]['wash']) => number) => {
      const weeks = median(rs.map((r) => r.wash.capacityBound + r.wash.dirtyBound + r.wash.nothingToWash + r.wash.noFronts));
      return weeks > 0 ? Math.round((median(rs.map((r) => f(r.wash))) / weeks) * 100) : 0;
    };
    const used = (rs: typeof RUNS_300) =>
      Math.round((median(rs.map((r) => r.wash.laundered)) / median(rs.map((r) => r.wash.capacity))) * 100);

    const rows: [string, typeof RUNS_300][] = [
      ['by price ', RUNS_300],
      ['for washing', RUNS_WASHERS],
      ['for earning', RUNS_EARNERS],
    ];

    // eslint-disable-next-line no-console
    console.log(
      `fronts: what a career buys them for, ${HUMAN_DAYS} days, same seeds
` +
        rows
          .map(
            ([name, rs]) =>
              `        ${name}  capacity-bound ${share(rs, (w) => w.capacityBound)}%` +
              ` · dirty-bound ${share(rs, (w) => w.dirtyBound)}%` +
              ` · no fronts ${share(rs, (w) => w.noFronts)}%
` +
              `                     laundered $${Math.round(at(rs, (r) => r.wash.laundered)).toLocaleString('en-US')}` +
              ` of $${Math.round(at(rs, (r) => r.wash.capacity)).toLocaleString('en-US')} offered (${used(rs)}% used)` +
              `; front revenue $${Math.round(at(rs, (r) => r.wash.revenue)).toLocaleString('en-US')}
` +
              `                     fronts ${at(rs, (r) => r.fronts)}` +
              `; estate $${Math.round(at(rs, (r) => r.bestEstate)).toLocaleString('en-US')}`,
          )
          .join('\n'),
    );

    /*
       Instrument first. Three arms that bought the same fronts would produce
       three identical rows and a confident-looking table saying nothing, which
       is this project's signature failure and has been caught four times.
    */
    expect(
      at(RUNS_WASHERS, (r) => r.wash.capacity),
      'buying for capacity bought the same capacity as buying by price, so the arms are not different',
    ).not.toBe(at(RUNS_300, (r) => r.wash.capacity));

    /*
       And the question. If shopping for capacity clears the wall, the wall is
       a decision the player is making badly and the catalogue re-cost is what
       made it a decision — there is nothing structural to repair. If it does
       not, the shortage is real and the third piece of this work has a target.

       Written as a comparison rather than a threshold, and recorded either way.
    */
    expect(
      at(RUNS_WASHERS, (r) => r.wash.capacity),
      'buying deliberately for capacity got less capacity than buying by price',
    ).toBeGreaterThan(at(RUNS_300, (r) => r.wash.capacity));
  });
});

/*
   The half of a boss that is not the business.

   Three systems — being feared, what the man owns, and whether anybody is
   still at home — all built, all wired, and none of them ever measured. A
   search of this file for "fear" before today found it in exactly one place: a
   loyalty-drift table where it contributes -0.02 of -1.45. That reading cannot
   distinguish a system that does nothing from a system nothing switches on,
   and the difference decides whether the repair is to the mechanic or to the
   reasons to reach for it.

   This asks nothing and asserts almost nothing. It is a diagnosis, and it is
   written before any design so the design has something to answer to.
*/
describe('the half that is not the business', () => {
  it('says what fear, property and home actually do across a career', () => {
    const at = (f: (r: (typeof RUNS_300)[number]) => number) => median(RUNS_300.map(f));
    const any = (f: (r: (typeof RUNS_300)[number]) => number) => RUNS_300.filter((r) => f(r) > 0).length;

    // eslint-disable-next-line no-console
    console.log(
      `self: ${RUNS_300.length} careers, ${HUMAN_DAYS} days
` +
        `      FEAR   peak ${at((r) => r.newSystems.self.peakFear)}, ended ${at((r) => r.newSystems.self.finalFear)}` +
        `; weeks above ${FEARED_ABOVE}: ${at((r) => r.newSystems.self.weeksFeared)} of ${Math.floor(HUMAN_DAYS / 7)}` +
        `; careers that were ever frightening: ${any((r) => r.newSystems.self.weeksFeared)}/${RUNS_300.length}
` +
        `      OWNS   ${at((r) => r.newSystems.self.owned)} things worth ` +
        `$${Math.round(at((r) => r.newSystems.self.ownedWorth)).toLocaleString('en-US')}` +
        `; careers that ever bought anything: ${any((r) => r.newSystems.self.owned)}/${RUNS_300.length}
` +
        `      HOME   neglect peak ${at((r) => r.newSystems.self.peakNeglect)}, ended ${at((r) => r.newSystems.self.finalNeglect)}` +
        `; visits ${at((r) => r.newSystems.self.visits)}` +
        `; careers that ever went home: ${any((r) => r.newSystems.self.visits)}/${RUNS_300.length}` +
        `; deposition risk at the end x${at((r) => r.newSystems.self.depositionRisk)}`,
    );

    /*
       The only assertion, and it is on the instrument rather than the game.

       Every figure above could be zero for a true and interesting reason, so
       none of them gets a bar until somebody has decided what these systems
       are for. What must not be zero is the reading itself — a career that
       ran 300 days has a home whether or not anybody visited it, and if this
       comes back empty the capture is broken and the table above is furniture.
    */
    expect(
      RUNS_300.filter((r) => r.newSystems.self.peakNeglect > 0).length,
      'no career accumulated any neglect at all, so the home is not being ticked',
    ).toBe(RUNS_300.length);
  });
});

/*
   Whether being frightening is a way to run a family.

   `FEAR` has nine tuned constants. Fear suppresses defection, helps witness
   pressure and shakedowns, and costs loyalty, public feeling and recruiting.
   The first reading this project ever took of it said peak 10 of 100 on 36
   careers with nobody ever above 30 — and the honest-looking conclusion was
   that an entire mechanic was running at a tenth strength.

   That conclusion was wrong and the cause was one line in this file. The only
   deliberate source of fear in the game is the heavy approach, worth 2 a job,
   and this bot has always run `DEFAULT_APPROACH`, worth 0. Every point those
   careers ever had arrived from something that happened *to* them.

   So this asks the question the game has been posing since approaches were
   written and nothing ever answered: heavy takes 30% more and costs four
   points of odds, 1.8x the heat and three points of public feeling a job. Is
   the fear worth the bill?
*/
describe('being frightening', () => {
  it('says what running heavy actually buys', () => {
    const at = (rs: typeof RUNS_300, f: (r: (typeof RUNS_300)[number]) => number) =>
      median(rs.map(f));
    const gaps = RUNS_HEAVY.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate).sort(
      (a, b) => a - b,
    );
    const smart = RUNS_HEAVY_SMART.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate).sort(
      (a, b) => a - b,
    );

    // eslint-disable-next-line no-console
    console.log(
      `heavy: ${RUNS_HEAVY.length} careers, ${HUMAN_DAYS} days, heavy / straight
` +
        `       fear peak ${at(RUNS_HEAVY, (r) => r.newSystems.self.peakFear)}` +
        ` / ${at(RUNS_300, (r) => r.newSystems.self.peakFear)}` +
        `; ended ${at(RUNS_HEAVY, (r) => r.newSystems.self.finalFear)}` +
        ` / ${at(RUNS_300, (r) => r.newSystems.self.finalFear)}
` +
        `       weeks above ${FEARED_ABOVE}: ${at(RUNS_HEAVY, (r) => r.newSystems.self.weeksFeared)}` +
        ` / ${at(RUNS_300, (r) => r.newSystems.self.weeksFeared)} of ${Math.floor(HUMAN_DAYS / 7)}` +
        `; careers ever frightening ${RUNS_HEAVY.filter((r) => r.newSystems.self.weeksFeared > 0).length}` +
        `/${RUNS_HEAVY.length}
` +
        `       what it cost: heat-weeks ${Math.round(at(RUNS_HEAVY, (r) => r.danger.heat))}` +
        ` / ${Math.round(at(RUNS_300, (r) => r.danger.heat))}` +
        `; walked ${at(RUNS_HEAVY, (r) => r.lost.defected)} / ${at(RUNS_300, (r) => r.lost.defected)}` +
        `; crew ${at(RUNS_HEAVY, (r) => r.newSystems.crewLeft)} / ${at(RUNS_300, (r) => r.newSystems.crewLeft)}
` +
        `       what it bought: districts ${at(RUNS_HEAVY, (r) => r.bestDistricts)}` +
        ` / ${at(RUNS_300, (r) => r.bestDistricts)}` +
        `; respect ${at(RUNS_HEAVY, (r) => r.bestRespect)} / ${at(RUNS_300, (r) => r.bestRespect)}
` +
        `       estate 25th / median / 75th: ` +
        `$${Math.round(pct(gaps, 0.25)).toLocaleString('en-US')} / ` +
        `$${Math.round(median(gaps)).toLocaleString('en-US')} / ` +
        `$${Math.round(pct(gaps, 0.75)).toLocaleString('en-US')}` +
        `; ahead on ${gaps.filter((g) => g > 0).length}/${gaps.length}
` +
        `       picking its moments: ${at(RUNS_HEAVY_SMART, (r) => r.newSystems.self.heavyRuns)}` +
        ` jobs run loud, fear peak ${at(RUNS_HEAVY_SMART, (r) => r.newSystems.self.peakFear)}` +
        `; walked ${at(RUNS_HEAVY_SMART, (r) => r.lost.defected)}` +
        `; estate $${Math.round(median(smart)).toLocaleString('en-US')}` +
        `, ahead on ${smart.filter((g) => g > 0).length}/${smart.length}
` +
        /*
           The number that explains the other six.

           Fear is granted +2 only when a loud job *succeeds* and taken away 3
           whenever any job fails, and heavy costs four points of odds on top.
           So the break-even success rate is 60%: below that, running heavy
           destroys fear faster than it builds it, which is why total
           commitment peaks at 34 and ends at 5.
        */
        `       odds the work actually ran at: heavy ` +
        `${Math.round(at(RUNS_HEAVY, (r) => (r.newSystems.matched.oddsSum / Math.max(1, r.newSystems.matched.launched)) * 100))}%` +
        `, straight ${Math.round(at(RUNS_300, (r) => (r.newSystems.matched.oddsSum / Math.max(1, r.newSystems.matched.launched)) * 100))}%` +
        ` — fear breaks even at ${Math.round((-FEAR.onFailure / (2 - FEAR.onFailure)) * 100)}%`,
    );

    /*
       Instrument first, and this is the bar that decides whether the earlier
       reading was about the game or about the bot. If an arm that runs every
       job heavy still never reaches a level where `FEAR`'s constants do
       anything, then fear really is unreachable and the repair is to the
       mechanic. If it climbs, the repair is to the reasons, and the table
       above is the first honest look this project has had at it.
    */
    expect(
      at(RUNS_HEAVY, (r) => r.newSystems.self.peakFear),
      'running every job heavy for 300 days built no more fear than playing straight',
    ).toBeGreaterThan(at(RUNS_300, (r) => r.newSystems.self.peakFear));
  });
});

/*
   What fear is for.

   Every reading this project has ever taken of fear was a reading of the
   supply: how much a family has, how fast it drains, what it costs to build.
   Nothing has ever looked at the demand, and the demand is one action —
   `pressureWitness` — which has never been called by any arm, bar or blind
   round in the history of this repository.

   It is the thing being feared buys. A witness who stops talking takes 6 to 14
   points off a case; a witness who does not adds 16 and twelve points of heat
   to the case you were trying to empty. Fear is worth 25 points of that
   coin-flip at maximum, which is the largest single modifier on any action in
   the law system.
*/
describe('what being feared is for', () => {
  it('says whether leaning on the people who talk is worth doing', () => {
    const at = (rs: typeof RUNS_300, f: (r: (typeof RUNS_300)[number]) => number) =>
      median(rs.map(f));
    const gap = (rs: typeof RUNS_300) =>
      rs.map((r, i) => r.bestEstate - RUNS_300[i].bestEstate).sort((a, b) => a - b);

    const plain = gap(RUNS_LEAN);
    const feared = gap(RUNS_LEAN_FEARED);

    // eslint-disable-next-line no-console
    console.log(
      `leaning: ${RUNS_LEAN.length} careers, ${HUMAN_DAYS} days
` +
        `         straight and leaning: tried ${at(RUNS_LEAN, (r) => r.newSystems.leaning.tried)}` +
        `, landed ${at(RUNS_LEAN, (r) => r.newSystems.leaning.landed)}` +
        `, case strength taken off ${Math.round(at(RUNS_LEAN, (r) => r.newSystems.leaning.strengthMoved))}` +
        ` (${Math.round(at(RUNS_LEAN, (r) => (r.newSystems.leaning.landed / Math.max(1, r.newSystems.leaning.tried)) * 100))}%)` +
        `; fear peak ${at(RUNS_LEAN, (r) => r.newSystems.self.peakFear)}
` +
        `         feared and leaning:   tried ${at(RUNS_LEAN_FEARED, (r) => r.newSystems.leaning.tried)}` +
        `, landed ${at(RUNS_LEAN_FEARED, (r) => r.newSystems.leaning.landed)}` +
        `, case strength taken off ${Math.round(at(RUNS_LEAN_FEARED, (r) => r.newSystems.leaning.strengthMoved))}` +
        ` (${Math.round(at(RUNS_LEAN_FEARED, (r) => (r.newSystems.leaning.landed / Math.max(1, r.newSystems.leaning.tried)) * 100))}%)` +
        `; fear peak ${at(RUNS_LEAN_FEARED, (r) => r.newSystems.self.peakFear)}
` +
        `         what it did to the law: peak case ` +
        `${Math.round(at(RUNS_LEAN, (r) => r.danger.peakCase))} straight-leaning / ` +
        `${Math.round(at(RUNS_LEAN_FEARED, (r) => r.danger.peakCase))} feared-leaning / ` +
        `${Math.round(at(RUNS_300, (r) => r.danger.peakCase))} neither
` +
        `         estate against playing straight: leaning ` +
        `$${Math.round(median(plain)).toLocaleString('en-US')}` +
        ` (ahead ${plain.filter((g) => g > 0).length}/36)` +
        `; feared and leaning $${Math.round(median(feared)).toLocaleString('en-US')}` +
        ` (ahead ${feared.filter((g) => g > 0).length}/36)`,
    );

    /*
       Instrument first, and this file has been bitten by exactly this: an arm
       that never took the action would report a believable nothing and look
       like a finding about the mechanic.
    */
    expect(
      at(RUNS_LEAN, (r) => r.newSystems.leaning.tried),
      'nobody ever leaned on anybody, so this measures a career that did not use the feature',
    ).toBeGreaterThan(0);

    /*
       And the property the whole supply side was tuned for: a family with fear
       to spend should land this more often than one without. If it does not,
       then `FEAR.witnessBonusAtMax` is decoration and everything done to the
       supply of fear today was in service of nothing.

       **This compared counts, and "more often" is a rate.** The two arms do
       not lean the same number of times — they meet different cases and only
       lean on the ones above `LEAN_ON_CASE_ABOVE` — so one reading had the
       feared arm at 18 attempts and 14 landings against 19 and 17, failed, and
       was reporting that fear had made leaning *worse* when the rates were 79%
       against 77% the other way. That is the denominator defect this file
       caught once already this session in the capture itself, arriving a
       second time in the assertion built on top of it.

       Rates now, with a floor under both denominators so the comparison
       cannot be two small numbers arguing.
    */
    const leanRate = (runs: typeof RUNS_LEAN) =>
      at(runs, (r) => r.newSystems.leaning.landed / Math.max(1, r.newSystems.leaning.tried));
    expect(
      at(RUNS_LEAN_FEARED, (r) => r.newSystems.leaning.tried),
      'the feared arm barely leaned on anybody, so its rate is not a reading',
    ).toBeGreaterThanOrEqual(5);
    expect(
      leanRate(RUNS_LEAN_FEARED),
      'being feared did not make leaning on a witness land any more often',
    ).toBeGreaterThanOrEqual(leanRate(RUNS_LEAN));
  });
});


// ============================================== sizing the apparatus =====

/**
 * The instrument that was missing when the apparatus cap was measured.
 *
 * `HEAT_ABSORPTION` is a flat subsidy per head per day and nothing compares it
 * to what the outfit is producing, so a family of sixteen absorbs seven times
 * what a full narcotics operation generates and street heat settles at exactly
 * zero — see `heatApparatus.test.ts`, which holds that fault open.
 *
 * The repair is `APPARATUS_CAP.ofIntake`. It was built and backed out, because
 * three settings measured against this file gave 5 of 53 bars failing at 0.7,
 * none at 0.9 and 3 at 0.95, while the weekly heat distribution barely moved
 * across all three. A weaker setting making the ladder worse is not physical.
 * The bars were flipping on where a handful of 36 careers fell against a
 * threshold, and picking the value whose draw came out green would have been
 * choosing a number and calling it a measurement.
 *
 * The fault was in the reading, not in the change. Every one of those bars is
 * an *unpaired* count: 36 careers under one config against a fixed number.
 * Boss inside 300 days runs at roughly one career in five, so a 36-sample
 * count carries about plus or minus two and a half careers of noise before
 * anything is done to the game — which is the whole size of the effect being
 * argued about.
 *
 * This pairs it. The same seed is run under both settings and compared with
 * itself, so a seed that was never going to reach Boss cannot vote. What comes
 * out is who changed and in which direction, which is a signal the unpaired
 * count cannot produce at any sample size this project can afford.
 */
describe('sizing the apparatus cap', () => {
  /** Runs the population under one setting, restoring the shipped one after. */
  function under(cap: number | null, seeds: number[]): Climb[] {
    const was = APPARATUS_CAP.ofIntake;
    APPARATUS_CAP.ofIntake = cap;
    try {
      return seeds.map((s) => climb(s, HUMAN_DAYS));
    } finally {
      APPARATUS_CAP.ofIntake = was;
    }
  }

  it('says whether a setting can be told apart from shipping it off', () => {
    const seeds = Array.from({ length: 36 }, (_, i) => 700 + i);
    const off = under(null, seeds);
    const candidates: (number | null)[] = [0.7, 0.9, 0.95];

    const bossOff = off.map((r) => r.reachedOn.has('boss'));
    const heatOff = off.map((r) => r.trade.meanHeat);
    const estateOff = off.map((r) => r.bestEstate);

    const lines: string[] = [];
    const readings: { cap: number; lost: number; gained: number; heat: number }[] = [];

    for (const cap of candidates) {
      const on = under(cap, seeds);
      const bossOn = on.map((r) => r.reachedOn.has('boss'));

      /*
         McNemar's two cells, which is the whole point of pairing. A seed that
         reaches Boss under both, or under neither, carries no information
         about the change and is excluded — an unpaired count includes all of
         them and buries the signal in their variance.
      */
      let lost = 0;
      let gained = 0;
      for (let i = 0; i < seeds.length; i++) {
        if (bossOff[i] && !bossOn[i]) lost += 1;
        if (!bossOff[i] && bossOn[i]) gained += 1;
      }

      const heatGap = meanOf(on.map((r, i) => r.trade.meanHeat - heatOff[i]));
      const estateGap = meanOf(on.map((r, i) => r.bestEstate - estateOff[i]));
      readings.push({ cap: cap!, lost, gained, heat: heatGap });

      lines.push(
        `        ${String(cap).padEnd(5)} Boss ${bossOn.filter(Boolean).length}/36 ` +
          `(off: ${bossOff.filter(Boolean).length}/36) · ` +
          `${lost} seeds lost it, ${gained} gained it · ` +
          `weekly heat ${heatGap >= 0 ? '+' : ''}${heatGap.toFixed(1)} · ` +
          `estate ${estateGap >= 0 ? '+' : ''}${Math.round(estateGap).toLocaleString('en-US')}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      `the apparatus cap, ${seeds.length} seeds run under each setting and ` +
        `paired against themselves\n` +
        lines.join('\n') +
        `\n        (lost + gained is the sample. Seeds that reach Boss under ` +
        `both, or neither, say nothing about the change.)`,
    );

    /*
       Two properties, and neither is a bar on the game.

       The first is that the instrument works: at least one setting has to move
       *somebody*, or 36 seeds is too few to see this change at all and the
       honest answer is a bigger population rather than a number.

       The second is the discipline the unpaired version could not enforce. A
       reading where seeds move both ways in similar numbers is noise wearing a
       direction, and it may not be quoted as an effect. `resolves` refuses the
       same way when a share sits inside its own sampling error.
    */
    const moved = readings.reduce((n, r) => n + r.lost + r.gained, 0);
    expect(
      moved,
      'no seed changed outcome under any setting, so this population cannot see the change',
    ).toBeGreaterThan(0);

    for (const r of readings) {
      const sample = r.lost + r.gained;
      if (sample === 0) continue;
      const lean = Math.abs(r.lost - r.gained);
      const verdict = lean >= Math.max(3, sample * 0.6) ? 'resolves' : 'does not resolve';
      // eslint-disable-next-line no-console
      console.log(
        `        ${r.cap}: ${sample} seeds moved, ${r.lost} down and ${r.gained} up — ${verdict}`,
      );
    }

    // The heat effect is the thing the change is actually about, and it is the
    // reading that held still across all three settings when the rank bars did
    // not. It has to point one way.
    for (const r of readings) {
      expect(
        r.heat,
        `capping the apparatus at ${r.cap} did not raise weekly heat, so the ` +
          `change does not do what it is for`,
      ).toBeGreaterThan(0);
    }
  });
});
