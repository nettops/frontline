/**
 * Criminal operations.
 *
 * Everything here is abstract game economy — costs, odds, durations and
 * consequences. Add a new job by adding an entry; no logic changes needed.
 *
 * One rule holds the table together: **capital buys efficiency**. Every rank
 * has exactly one job that costs nothing to start, and it is always the worst
 * money on the board per crew per day, ties up its crew longer than the paid
 * jobs of the same rank, and carries more heat for the same work.
 *
 * "Worst money" means **expected** money — the payout multiplied by the odds,
 * divided by crew times days. Reading the gross figure instead is how the
 * first version of this table shipped broken: Freelance Muscle looked like a
 * step up from the street shakedown at 475 against 425, and once the 76%
 * against 86% was applied it was 361 against 366, which is a step *down*
 * before its heat is counted at all. A 24-world probe measured the broke
 * player earning less with these jobs than without them.
 *
 * That rule exists because for a long time only the very first job in the game
 * was free, at every rank including Boss. A player who ran out of money had
 * one move — the same street shakedown they opened the game with — so being
 * broke did not make the game harder, it made it shorter and identical. The
 * paid jobs are still strictly better whenever you can afford them, which is
 * the point: the no-capital job is the way back to the table, not a way to
 * live at it.
 *
 * A second rule was added later, after measurement found the table breaking
 * it badly: **return on capital rises with the tier**. That is the payout
 * times the odds divided by the stake, and it used to *fall* — a paid mean of
 * 4.7x among street work against 1.9x at Boss. The table asked for more money
 * at every rung and gave back a thinner slice of it, which is backwards for a
 * ladder whose top rungs are gated on a stock of clean cash: $130,000 for
 * Underboss, $420,000 for Boss. Twenty-four careers reached Crew Leader or
 * Capo and none went further, and the five jobs above Capo were shut on 100%
 * of 3,600 measured days.
 *
 * The curve was built by cutting the stakes above the street rather than by
 * raising the payouts, for two reasons. Payouts are the part of this table a
 * player reads as fiction, and a Port Operation that suddenly pays double is a
 * different story rather than a better-priced one. And the stake was itself a
 * gate — 35% of the days Union Local was open, it was open and unaffordable —
 * so the same edit that fixes the ratio also puts the job on the board. The
 * street tier keeps its $150 to $800 stakes untouched: the paragraph above is
 * why, and a tidier curve is not worth taking that floor away.
 *
 * `opReturn.test.ts` guards this; `broke.probe.test.ts` guards the rule above.
 */

import type { OperationDef, OperationRisk } from '../sim/types';
import { SETUPS } from './scores';

export const OPERATIONS: OperationDef[] = [
  // ---------------------------------------------------- street criminal ---
  {
    /*
       The floor of the whole game, and the only job that needs nobody.

       Measured over 24 careers with no safety net: a fifth of all weeks had
       nothing the player could do, and **every one of those weeks was a
       shortage of bodies, not money**. Not one was a shortage of money — the
       no-capital ladder does its job. What locks a career up is the whole crew
       being in a cell or a hospital at once, which on a three-man outfit is one
       bad night, and the arrest that caused it can hold somebody for months.

       A playtester lived exactly that and reported it as an economic death
       spiral. It is not economic. There was simply nobody left to send.

       So: you go yourself. It pays badly, it is worth less than sending anybody
       else, and no organization with a spare hand would ever choose it — which
       is the point. It exists so that the answer to "what can I do this week" is
       never nothing, at any rank, in any state, with any roster. A game that can
       take away your ability to act has stopped being a game for as long as that
       lasts.
    */
    id: 'work_it_yourself',
    name: 'Work It Yourself',
    description:
      'Nobody to send, so you go. It is beneath you now and it was all you did once. Small money and nobody else to blame.',
    tier: 0,
    risk: 'low',
    crewRequired: 0,
    investment: 0,
    payout: [180, 420],
    durationDays: 1,
    baseSuccess: 0.82,
    heatOnSuccess: 1.2,
    heatOnFailure: 2.5,
    attribute: 'streetSmarts',
    respect: 0,
  },
  {
    id: 'corner_shakedown',
    name: 'Corner Shakedown',
    description:
      'Lean on a few shopkeepers who have nobody to call. Small money, but it is money tonight.',
    tier: 0,
    risk: 'low',
    crewRequired: 1,
    investment: 0,
    payout: [250, 600],
    durationDays: 1,
    baseSuccess: 0.86,
    heatOnSuccess: 1.5,
    heatOnFailure: 3,
    attribute: 'intimidation',
    respect: 1,
  },
  {
    id: 'boost_cars',
    name: 'Boost Cars',
    description: 'Lift vehicles off the street and move them the same night.',
    tier: 0,
    risk: 'low',
    crewRequired: 2,
    investment: 200,
    payout: [600, 1_400],
    durationDays: 1,
    baseSuccess: 0.8,
    heatOnSuccess: 2.5,
    heatOnFailure: 5,
    attribute: 'streetSmarts',
    respect: 2,
  },
  {
    id: 'burglary_run',
    name: 'Burglary Run',
    description: 'A list of empty houses and a short window to work in.',
    tier: 0,
    risk: 'moderate',
    crewRequired: 2,
    investment: 150,
    payout: [600, 1_500],
    durationDays: 1,
    baseSuccess: 0.77,
    heatOnSuccess: 3,
    heatOnFailure: 6,
    attribute: 'streetSmarts',
    respect: 2,
  },

  /*
     Both of the above run overnight, and used to be booked for two days.

     That single number made them dead options. Corner Shakedown is one man
     for one night, so it earned more per man per day than either of the jobs
     that are supposed to replace it — the first upgrade in the game was a
     downgrade, and the correct play from day one to the end of the run was to
     spam the tutorial job. It is also what both descriptions always said: the
     cars move the same night, the houses are a short window.
  */

  // ------------------------------------------------------------ enforcer ---
  {
    id: 'protection_racket',
    name: 'Protection Racket',
    description:
      'A block of businesses paying weekly so nothing happens to them. Steady, visible, hard to walk back.',
    opens: {
      need: 'a district you can work without asking',
      met: (b) => b.districtsHeld >= 1,
    },
    tier: 1,
    risk: 'moderate',
    crewRequired: 2,
    investment: 500,
    payout: [2_200, 4_400],
    durationDays: 3,
    baseSuccess: 0.75,
    heatOnSuccess: 5,
    heatOnFailure: 10,
    attribute: 'intimidation',
    respect: 4,
  },
  /*
     Was three men for four days, which made it the worst money per man per day
     in the game — below the one-man street job it is supposed to succeed. The
     first job of a new rank should not be a pay cut.
  */
  {
    id: 'fence_goods',
    name: 'Fence Stolen Goods',
    description: 'Buy hot merchandise cheap, move it through people who do not ask.',
    opens: {
      need: 'somewhere of your own to move it through',
      met: (b) => b.fronts >= 1,
    },
    tier: 1,
    risk: 'moderate',
    crewRequired: 2,
    investment: 900,
    payout: [3_500, 7_000],
    durationDays: 3,
    baseSuccess: 0.78,
    heatOnSuccess: 4,
    heatOnFailure: 8,
    attribute: 'negotiation',
    respect: 3,
  },
  {
    id: 'truck_hijack',
    name: 'Truck Hijacking',
    description: 'A loaded trailer, a quiet stretch of road, a fifteen minute window.',
    opens: {
      need: 'a district you can work without asking',
      met: (b) => b.districtsHeld >= 1,
    },
    tier: 1,
    risk: 'high',
    crewRequired: 3,
    investment: 800,
    payout: [4_000, 9_000],
    durationDays: 3,
    baseSuccess: 0.68,
    heatOnSuccess: 8,
    heatOnFailure: 16,
    attribute: 'streetSmarts',
    respect: 6,
  },

  {
    id: 'freelance_muscle',
    name: 'Freelance Muscle',
    description:
      'Somebody else has work that needs doing and nobody to do it. Flat fee, their problem, your hands. No outlay — you are selling the only thing you have.',
    opens: {
      need: 'three people on the payroll',
      met: (b) => b.crew >= 3,
    },
    tier: 1,
    risk: 'moderate',
    crewRequired: 1,
    investment: 0,
    payout: [830, 1_650],
    durationDays: 2,
    baseSuccess: 0.76,
    heatOnSuccess: 5,
    heatOnFailure: 10,
    attribute: 'intimidation',
    respect: 3,
  },

  // --------------------------------------------------------- crew leader ---
  {
    id: 'backroom_game',
    name: 'Backroom Card Game',
    description:
      'Run the house on a standing game. Reliable earnings and a room full of people who know your face.',
    opens: {
      need: 'two districts and a room of your own',
      met: (b) => b.districtsHeld >= 2 && b.fronts >= 1,
    },
    tier: 2,
    /*
       A game needs a room, and it needs people who know to come to it.

       Both of those are a district you already stand in and have been leaning
       on. Nobody sets up a table in a neighbourhood where they are a stranger.
    */
    risk: 'moderate',
    crewRequired: 4,
    investment: 3_400,
    payout: [16_000, 32_000],
    durationDays: 7,
    baseSuccess: 0.74,
    heatOnSuccess: 7,
    heatOnFailure: 14,
    attribute: 'negotiation',
    respect: 8,
  },
  {
    id: 'counterfeit_run',
    name: 'Counterfeit Goods Run',
    description: 'Fake product, real distribution, and a paper trail you have to manage.',
    opens: {
      need: 'two fronts and five fencing jobs behind you',
      met: (b) => b.fronts >= 2 && (b.opsBy.fence_goods ?? 0) >= 5,
    },
    tier: 2,
    /*
       Fakes are worth nothing until there is somewhere they can be sold as
       real, and the people who know where that is are the people who have been
       moving goods.
    */
    risk: 'high',
    crewRequired: 4,
    investment: 4_900,
    payout: [25_000, 48_000],
    durationDays: 6,
    baseSuccess: 0.7,
    heatOnSuccess: 9,
    heatOnFailure: 18,
    attribute: 'intelligence',
    respect: 9,
  },
  {
    id: 'warehouse_job',
    name: 'Warehouse Job',
    description:
      'Everything on the floor, out in one night. Big score, big footprint, no way to do it quietly.',
    opens: {
      need: 'somewhere to put it and six to carry it',
      met: (b) => b.fronts >= 2 && b.crew >= 6,
    },
    tier: 2,
    /*
       You learn where the loads go by taking the trucks first, and a load you
       cannot store is a load you have to sell in a hurry.
    */
    risk: 'high',
    crewRequired: 5,
    investment: 6_000,
    payout: [30_000, 70_000],
    durationDays: 5,
    baseSuccess: 0.62,
    heatOnSuccess: 14,
    heatOnFailure: 26,
    attribute: 'strategy',
    respect: 12,
  },

  /*
     Two more at this rank, and they are here for a reason.

     Crew Leader is the longest rank in the game — respect sixty to a hundred
     and forty, fifteen operations to thirty-five, a second district, thirty
     thousand more in clean money — and jobs only unlock when a rank does. A
     playtester ran it from day 100 to day 170 on the same three contracts and
     said the ceiling had been reached seventy days before the rank had.

     They also fill a hole the tier had. Every Crew Leader job wanted four or
     five people and eight thousand up front, so an organization that lost a
     couple of men to a bad month had nothing at its own rank it could still
     staff — the correct play was to drop back to Corner Shakedown, which reads
     as demotion rather than recovery. `Debt Collection` is the cheap one you
     run while rebuilding; `Union Local` is slow, expensive and the best money
     at the tier, for the weeks when nothing else needs the bodies.
  */
  {
    id: 'debt_collection',
    name: 'Debt Collection',
    description:
      'A book of other people’s bad paper, bought at a discount. Collecting it is the job.',
    opens: {
      need: 'four to send and six jobs hired out as muscle',
      met: (b) => b.crew >= 4 && (b.opsBy.freelance_muscle ?? 0) >= 6,
    },
    tier: 2,
    /*
       People come to you to collect once enough of them have watched you do it
       for somebody else — and you need the hands to send when they do.
    */
    risk: 'low',
    crewRequired: 2,
    investment: 1_200,
    payout: [5_000, 11_000],
    durationDays: 4,
    baseSuccess: 0.8,
    heatOnSuccess: 4,
    heatOnFailure: 8,
    attribute: 'intimidation',
    respect: 5,
  },
  {
    id: 'union_local',
    name: 'Union Local',
    description:
      'Put your man in at the hall. Slow, expensive, and afterwards the trucks move when you say so.',
    opens: {
      need: 'two districts and somebody at the hall who owes you',
      met: (b) => b.districtsHeld >= 2 && b.owedFigures >= 1,
    },
    tier: 2,
    /*
       A local is standing in a place rather than a job you can walk into, and
       standing in two places is what makes you worth talking to.
    */
    risk: 'moderate',
    crewRequired: 3,
    investment: 6_250,
    payout: [34_000, 62_000],
    durationDays: 14,
    baseSuccess: 0.68,
    heatOnSuccess: 8,
    heatOnFailure: 16,
    attribute: 'influence',
    respect: 14,
  },

  {
    id: 'rent_the_crew',
    name: 'Rent Out the Crew',
    description:
      'Another outfit is short of bodies for a job of their own. They pay for the bodies, they keep the score. Costs nothing but the fortnight you do not have your people.',
    opens: {
      need: 'six on the payroll',
      met: (b) => b.crew >= 6,
    },
    tier: 2,
    /*
       Nobody rents men they have not seen work, and nobody rents out men they
       cannot spare.
    */
    risk: 'moderate',
    crewRequired: 2,
    investment: 0,
    payout: [3_600, 6_800],
    durationDays: 4,
    baseSuccess: 0.74,
    heatOnSuccess: 7,
    heatOnFailure: 13,
    attribute: 'leadership',
    respect: 4,
  },

  // ---------------------------------------------------------------- capo ---
  {
    id: 'underground_club',
    name: 'Underground Club',
    description:
      'An unlicensed room that prints money six nights a week. Profitable, and a fixed address.',
    opens: {
      need: 'four fronts and two people in the city who owe you',
      met: (b) => b.fronts >= 4 && b.owedFigures >= 2,
    },
    tier: 3,
    risk: 'moderate',
    crewRequired: 5,
    investment: 20_000,
    payout: [120_000, 195_000],
    durationDays: 12,
    baseSuccess: 0.72,
    heatOnSuccess: 10,
    heatOnFailure: 20,
    attribute: 'business',
    respect: 14,
  },
  {
    id: 'smuggling_run',
    name: 'Smuggling Run',
    description:
      'Contraband moved across a long route with too many hands touching it.',
    opens: {
      need: 'a district under your control and three fronts',
      met: (b) => b.districtsControlled >= 1 && b.fronts >= 3,
    },
    tier: 3,
    risk: 'high',
    crewRequired: 6,
    investment: 17_500,
    payout: [110_000, 210_000],
    durationDays: 9,
    baseSuccess: 0.62,
    heatOnSuccess: 16,
    heatOnFailure: 30,
    attribute: 'strategy',
    respect: 18,
  },

  /*
     The cheap way into Capo work.

     Both jobs at this rank ask for fifty to sixty thousand up front, which is
     more than the rank requires you to hold — so arriving at Capo can mean
     being unable to do anything a Capo does. This one is affordable the day
     you get there and pays for the ones that are not.
  */
  {
    id: 'protection_route',
    name: 'Protection Route',
    description:
      'Every business on four blocks, on the same schedule, run as one book rather than forty conversations.',
    opens: {
      need: 'four districts worked and three fronts',
      met: (b) => b.districtsHeld >= 4 && b.fronts >= 3,
    },
    tier: 3,
    risk: 'low',
    crewRequired: 4,
    investment: 7_250,
    payout: [38_000, 66_000],
    durationDays: 10,
    baseSuccess: 0.78,
    heatOnSuccess: 7,
    heatOnFailure: 15,
    attribute: 'intimidation',
    respect: 11,
  },

  {
    id: 'sitdown_fees',
    name: 'Sit-Down Fees',
    description:
      'Two smaller outfits cannot settle something and both would rather you ruled on it than fight. You take a cut of whatever you award. Slow, and it costs you nothing but the weeks.',
    opens: {
      need: 'people in the city who owe you, and three districts to be seen in',
      met: (b) => b.owedTotal >= 2 && b.districtsHeld >= 3,
    },
    tier: 3,
    risk: 'low',
    crewRequired: 3,
    investment: 0,
    payout: [10_500, 20_000],
    durationDays: 6,
    baseSuccess: 0.76,
    heatOnSuccess: 11,
    heatOnFailure: 20,
    attribute: 'negotiation',
    respect: 8,
  },

  // ----------------------------------------------------------- underboss ---
  {
    id: 'financial_scheme',
    name: 'Financial Scheme',
    description:
      'Money moved through instruments nobody in the crew understands, including you.',
    opens: {
      need: 'two districts under your control and six fronts',
      met: (b) => b.districtsControlled >= 2 && b.fronts >= 6,
    },
    tier: 4,
    risk: 'high',
    crewRequired: 6,
    investment: 50_000,
    payout: [350_000, 800_000],
    durationDays: 18,
    baseSuccess: 0.55,
    heatOnSuccess: 18,
    heatOnFailure: 34,
    attribute: 'business',
    respect: 28,
  },
  {
    id: 'port_operation',
    name: 'Port Operation',
    description:
      'Control of a dock and everything that crosses it. The kind of score that builds task forces.',
    opens: {
      need: 'control of two districts, six fronts, and two people who owe you',
      met: (b) => b.districtsControlled >= 2 && b.fronts >= 6 && b.owedFigures >= 2,
    },
    tier: 4,
    risk: 'extreme',
    crewRequired: 8,
    investment: 54_000,
    payout: [400_000, 750_000],
    durationDays: 14,
    baseSuccess: 0.58,
    heatOnSuccess: 22,
    heatOnFailure: 40,
    attribute: 'strategy',
    respect: 30,
  },

  {
    id: 'call_in_tribute',
    name: 'Call In Tribute',
    description:
      'Go round everyone who owes you and ask for it at once. You are spending standing rather than money, and standing spent this way is noticed.',
    opens: {
      need: 'two districts under your control and eight on the books',
      met: (b) => b.districtsControlled >= 2 && b.crew >= 8,
    },
    tier: 4,
    risk: 'moderate',
    crewRequired: 4,
    investment: 0,
    cooldownDays: 14,
    payout: [74_000, 140_000],
    durationDays: 8,
    baseSuccess: 0.70,
    heatOnSuccess: 20,
    heatOnFailure: 36,
    attribute: 'influence',
    respect: 16,
  },

  // ---------------------------------------------------------------- boss ---
  {
    id: 'citywide_network',
    name: 'Citywide Distribution Network',
    description:
      'Every corner of the map feeding one operation. Nothing this size stays invisible.',
    opens: {
      need: 'three districts under your control, eight fronts, and real favours owed',
      met: (b) => b.districtsControlled >= 3 && b.fronts >= 8 && b.owedTotal >= 4,
    },
    tier: 5,
    risk: 'extreme',
    crewRequired: 12,
    investment: 170_000,
    payout: [1_400_000, 2_800_000],
    durationDays: 21,
    baseSuccess: 0.55,
    heatOnSuccess: 28,
    heatOnFailure: 48,
    attribute: 'influence',
    respect: 50,
  },
  {
    id: 'enforce_the_peace',
    name: 'Enforce the Peace',
    description:
      'Every operation in the city pays you to make sure nothing happens to any of them. It takes no investment and most of a month, and everybody knows exactly who is keeping order.',
    opens: {
      need: 'three districts under your control and a rival who genuinely trusts you',
      met: (b) => b.districtsControlled >= 3 && b.bestRivalTrust >= 25,
    },
    tier: 5,
    risk: 'high',
    crewRequired: 6,
    investment: 0,
    payout: [270_000, 510_000],
    durationDays: 12,
    baseSuccess: 0.66,
    heatOnSuccess: 30,
    heatOnFailure: 50,
    attribute: 'influence',
    respect: 30,
  },

  /* ============================================================== connected ==
     PARKED: four relationship-gated jobs, built and measured, not shipped.

     The design was a second axis for the board — jobs that open on who you
     know rather than on rank — to attack the most-quoted line in the score
     record, "the same four jobs". Fix a Case on a judge's favour, Union
     Walkout on the union boss, Police Escort on a captain, Joint Venture on a
     rival who trusts you.

     It worked on the target it was aimed at. `ladder.probe` moved careers
     reaching Capo inside 300 days from **19 of 36 to 23**, the largest move
     that pre-committed figure has ever seen, and it did it without widening
     the gap between the top and the middle once the payouts were cut to
     mid-tier.

     It is parked because the gate is not a gate. Measured across 24 careers:

         held a favour owed by day 150 .................... 24 of 24
         a connected job open at some point in 150 days ... 24 of 24

     `owed >= 1` is not "who you know". It is a timer, and every career clears
     it. That makes these four jobs a delayed rank unlock wearing a
     relationship as a costume — the opposite of the thing they were for, which
     was two bosses on the same rung looking at different boards.

     This is the third bar this project has put in the wrong place for want of
     plotting the distribution first, after `demandRespect` at 28 against a
     starting 30 and the card room's invitation at 55 against 77% of weeks.
     The lesson did not take.

     What it needs, and it is a better design than the one measured: the job
     should **consume** the favour. `civic.ts` already has `spendFavour`.
     Holding one becomes the ticket and using it costs it, so the choice is
     between fixing a case tonight and keeping the judge for the case against
     you — which is a decision rather than an unlock. Then plot what share of
     careers can afford that, and set the bar off the plot.

     Everything else is done: `connections.test.ts` has eight tests, four
     mutants die, `distance.test.ts` covers both route kinds, and `OpsBoard`
     already carries `favoursOwed` and `bestRivalTrust`.
     ========================================================================= */


];

/*
   Setups are in here and not in `OPERATIONS`, and the split is the whole of
   how scores were made cheap.

   `launchOperation`, `canLaunch` and `resolveOperation` all look a job up by
   id, so a setup that lives in this map runs through every one of them
   unchanged — same crew, same district, same approach, same consequence table
   when it goes wrong. Keeping them out of `OPERATIONS` is what stops them
   appearing on the job board, being counted by `standing`, or being read by
   the return and gate tests, none of which are about them.
*/
export const OPERATION_BY_ID: Record<string, OperationDef> = Object.fromEntries(
  [...OPERATIONS, ...SETUPS].map((o) => [o.id, o]),
);

/**
 * Heat multiplier by how far below your standing the job is.
 * Index 0 is work at your own level; index 3+ is a Capo running a corner
 * shakedown, which nobody investigating organised crime cares about.
 *
 * This is the main strategic answer to heat: grind quiet, beneath-you work to
 * bank money while attention decays. Without it, heat only ever goes up.
 */
export const HEAT_BY_RANK_GAP = [1, 0.6, 0.38, 0.24, 0.15];

export function heatScaleForGap(gap: number): number {
  const idx = Math.max(0, Math.min(HEAT_BY_RANK_GAP.length - 1, gap));
  return HEAT_BY_RANK_GAP[idx];
}

/**
 * How far the work is from you, which is what the table above is really about.
 *
 * The table was indexed on rank gap alone, and a probe of twenty-four careers
 * reached Crew Leader in none of them. So the main strategic answer to heat —
 * the comment above says exactly that — was gated behind a rank nobody gets,
 * while heat turned out to be the only constraint that binds anything: over
 * 4320 measured crew-days, 53% were spent too hot to work and 20% laying low,
 * against 0% blocked by money, bodies or ground.
 *
 * That produced a closed circle. Clean money needs work, work needs heat
 * headroom, heat headroom needs rank, rank needs clean money.
 *
 * Rank is now one contributor to distance rather than the whole of it, and the
 * others are things a player can build without it. All of them say the same
 * thing in different words: how many people and how much organization stand
 * between the boss and a man on a corner. A boss doing his own shakedowns is
 * somebody the police can see. A boss four layers back, whose districts have
 * other people's names on them, is a rumour.
 *
 * The point is not that heat becomes cheaper. It is that growing the
 * organization buys the only thing the organization is ever short of, so that
 * hiring somebody is a decision about attention rather than a wage bill with
 * an idle body attached.
 */
export interface HeatDistance {
  /** Your rank against the job's, as before. */
  rankGap: number;
  /**
   * Seniority of the most senior person you sent, as an index into ROLE_ORDER.
   * Doing it yourself is no distance at all, which is the whole idea.
   */
  sentSeniority: number;
  /** Somebody else's name is on the ground this happened in. */
  stewarded: boolean;
  /** How many people are on the payroll. */
  crew: number;
}

export const HEAT_DISTANCE = {
  /** A rank of separation, worth exactly what it was worth before. */
  perRank: 1,
  /** Per step up the role ladder of whoever you sent. */
  perSeniority: 0.35,
  /** A district with a steward on it. */
  stewarded: 0.5,
  /**
   * Per body on the payroll.
   *
   * Was 1/6, which made six people worth a whole rank of quiet and twelve
   * worth two. That turned out to be enough to make over-hiring *safe*: the
   * probe that hires whenever it can afford to got into trouble in fewer
   * worlds than the probe that hires within its income, inverting the advice
   * the game gives the player on the recruiting screen. A warning that is not
   * true is worse than no warning.
   *
   * Halved on a rule set before the number was re-measured: headcount alone
   * must never be worth more than one rank of separation at a realistic crew
   * size, and realistic is now six to twelve.
   *
   * Note what this deliberately does not fix. Headcount is the one contributor
   * here that is unconditional — you are quieter for having people whether or
   * not you do anything with them, where seniority and a steward both require
   * you to have actually used them. That asymmetry is a fair criticism of the
   * shape rather than the size, and it is left alone until there is a
   * measurement that says the size was not the problem.
   *
   * ## The measurement exists now, and the size was not the problem
   *
   * Round 17's three scorers all reported the same thing from the player's
   * side — *"holding districts drops per-job heat to about 1"*, *"after day 140
   * nothing threatened me"*, *"nothing pushed back"* — with the loop going flat
   * at days 120, 130 and 180. Decomposed across twelve careers, on the best job
   * available each day:
   *
   *     day                          30    60   120   180   240   299
   *     heat multiplier            0.43  0.31  0.31  0.31  0.31  0.31
   *       from the organization    1.18  2.50  2.50  2.50  2.50  2.50
   *          of which headcount    0.75  0.75  0.83  0.83  0.83  0.83
   *
   * **The organization term reaches `maxFromOrganization` on day 60 and never
   * moves again for the remaining eighty per cent of the career.** Headcount is
   * 0.83 of that 2.5, so halving this number — the size repair recorded above —
   * could never have reached it.
   *
   * Nor is headcount's shape the fault. Dropping it from the term entirely was
   * tried and made things *worse*: the cap is then reached on day 30 instead of
   * 60, because sending a senior man into a stewarded district already exceeds
   * 2.5 on seniority and `stewarded` alone. Reverted.
   *
   * So the finding is neither the size nor this contributor's shape. It is that
   * the cap is reachable by ordinary play inside two months and is a constant
   * thereafter, which is what "the cost side evaporates" means mechanically.
   *
   * ## And neither constant is the lever
   *
   * Both were then swept, twelve careers each, reading the heat multiplier on
   * the best job available on the day:
   *
   *     maxFromOrganization       d30   d60  d120  d180  d240  d299
   *       2.5 (shipped)          0.43  0.31  0.31  0.31  0.31  0.31
   *       1.8                    0.42  0.42  0.42  0.42  0.42  0.42
   *       1.2                    0.56  0.56  0.56  0.56  0.56  0.56
   *       0.8                    0.68  0.68  0.68  0.68  0.68  0.68
   *
   *     perSeniority              d30   d60  d120  d180  d240  d299
   *       0.35 (shipped)         0.43  0.31  0.31  0.31  0.31  0.31
   *       0.20                   0.43  0.39  0.38  0.36  0.38  0.38
   *       0.10                   0.52  0.52  0.49  0.49  0.52  0.50
   *       0.05                   0.59  0.59  0.55  0.53  0.55  0.55
   *
   * **Lowering the cap makes it saturate sooner, not later.** Every value is
   * flat from day 30, because the contributors exceed all of them immediately;
   * the constant only sets the height of the line. `perSeniority` behaves the
   * same way, with at best a 0.05 drift across ten months.
   *
   * There is therefore no tuning of these two that turns the organization term
   * back into a decision. The flatness is structural — the contributors
   * saturate inside the first month — and changing it means changing what
   * contributes, not what it is capped at. Left alone, with the sweep recorded
   * so nobody repeats it.
   *
   * A caveat on method, because the table invites a conclusion it cannot
   * support: the sweep bot runs under `runDaysSolvent` with a $250,000 floor,
   * so its economy is propped up by the instrument. The multiplier trajectory
   * is a real reading. Any estate or income figure from that bot is not, and
   * none is quoted here.
   */
  perCrew: 1 / 12,
  /**
   * The most an organization can buy without rank.
   *
   * Without a cap, a large enough outfit reaches the bottom of the table on
   * everything and heat stops existing — which would replace one broken
   * extreme with another. Rank still has to be worth having, so organization
   * gets you most of the way to two ranks of quiet and no further.
   */
  maxFromOrganization: 2.5,
} as const;

export function heatDistance(d: HeatDistance): number {
  const organization = Math.min(
    HEAT_DISTANCE.maxFromOrganization,
    d.sentSeniority * HEAT_DISTANCE.perSeniority +
      (d.stewarded ? HEAT_DISTANCE.stewarded : 0) +
      d.crew * HEAT_DISTANCE.perCrew,
  );
  return Math.max(0, d.rankGap * HEAT_DISTANCE.perRank + organization);
}

/**
 * The same table, read at fractional distances.
 *
 * Interpolated rather than rounded because every contributor above is
 * fractional, and rounding would make a hire worth nothing four times out of
 * six and a whole rank the fifth. At integer distances this returns exactly
 * what `heatScaleForGap` always returned, so nothing about work at your own
 * level or four ranks beneath it has moved.
 */
export function heatScaleForDistance(distance: number): number {
  const top = HEAT_BY_RANK_GAP.length - 1;
  const x = Math.max(0, Math.min(top, distance));
  const lo = Math.floor(x);
  const hi = Math.min(top, lo + 1);
  return HEAT_BY_RANK_GAP[lo] + (HEAT_BY_RANK_GAP[hi] - HEAT_BY_RANK_GAP[lo]) * (x - lo);
}

export const RISK_LABEL: Record<OperationRisk, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  extreme: 'Extreme',
};

// ------------------------------------------------------- success formula ---

/**
 * Crew competence contributes up to this much success chance. Crew quality is
 * skill weighted with discipline — a talented sloppy crew is worse than a
 * merely competent careful one.
 */
export const CREW_COMPETENCE_WEIGHT = 0.25;
export const CREW_SKILL_VS_DISCIPLINE = 0.7;

/** Player attribute at max (20) contributes this much. */
export const ATTRIBUTE_WEIGHT = 0.18;

/** Success chance is clamped into this band — nothing is ever certain. */
export const MIN_SUCCESS_CHANCE = 0.05;
export const MAX_SUCCESS_CHANCE = 0.95;

/**
 * Payout scales with how comfortably the roll cleared the bar: a bare pass
 * pays the low end, a decisive success pays the top.
 */
export const PAYOUT_MARGIN_INFLUENCE = 1.0;

/** A failed job still returns this share of the up-front investment. */
export const FAILURE_INVESTMENT_RECOVERY = 0.25;

// ---------------------------------------------------------- consequences ---

export type ConsequenceId =
  | 'clean_break'
  | 'extra_loss'
  | 'crew_injured'
  | 'crew_arrested'
  | 'heat_spike'
  | 'evidence_left';

/** Weighted failure outcomes per risk level. Higher risk, uglier failures. */
export const FAILURE_CONSEQUENCES: Record<
  OperationRisk,
  { id: ConsequenceId; weight: number }[]
> = {
  low: [
    { id: 'clean_break', weight: 55 },
    { id: 'extra_loss', weight: 20 },
    { id: 'crew_injured', weight: 12 },
    { id: 'heat_spike', weight: 8 },
    { id: 'evidence_left', weight: 5 },
  ],
  moderate: [
    { id: 'clean_break', weight: 35 },
    { id: 'extra_loss', weight: 20 },
    { id: 'crew_injured', weight: 18 },
    { id: 'crew_arrested', weight: 10 },
    { id: 'heat_spike', weight: 9 },
    { id: 'evidence_left', weight: 8 },
  ],
  high: [
    { id: 'clean_break', weight: 20 },
    { id: 'extra_loss', weight: 18 },
    { id: 'crew_injured', weight: 20 },
    { id: 'crew_arrested', weight: 18 },
    { id: 'heat_spike', weight: 12 },
    { id: 'evidence_left', weight: 12 },
  ],
  extreme: [
    { id: 'clean_break', weight: 10 },
    { id: 'extra_loss', weight: 15 },
    { id: 'crew_injured', weight: 20 },
    { id: 'crew_arrested', weight: 24 },
    { id: 'heat_spike', weight: 15 },
    { id: 'evidence_left', weight: 16 },
  ],
};

export const INJURY_DAYS: [min: number, max: number] = [5, 20];
export const ARREST_DAYS: [min: number, max: number] = [30, 120];
/** Extra cash lost on an 'extra_loss' failure, as a share of investment. */
export const EXTRA_LOSS_SHARE: [min: number, max: number] = [0.3, 0.8];
export const HEAT_SPIKE_RANGE: [min: number, max: number] = [6, 15];
export const EVIDENCE_STRENGTH_RANGE: [min: number, max: number] = [5, 20];

/** An arrest terrifies everyone who was on the job. */
export const ARREST_FEAR_INCREASE = 15;
export const ARREST_LOYALTY_HIT = 6;
export const INJURY_GRIEVANCE = 8;

// ------------------------------------------------------------- approaches ---

export type ApproachId = 'quiet' | 'standard' | 'heavy';

export interface ApproachDef {
  id: ApproachId;
  name: string;
  /** One line, in the language of the street rather than of a stat block. */
  blurb: string;
  /** Added to the success chance, before clamping. */
  success: number;
  /** Multiplies what the job pays. */
  payout: number;
  /** Multiplies the attention it draws, win or lose. */
  heat: number;
  /** Multiplies the standing it earns. */
  respect: number;
  /** Fear gained on a success. Only violence buys this. */
  fear: number;
  /** What it does to how the district feels about you, on a success. */
  sentiment: number;
}

/**
 * How you do it, as opposed to what you do.
 *
 * The second decision axis on a job, and the reason it exists: two playtesters
 * independently reported that the Operations panel stops teaching anything
 * after the first rank tier. Both were right, and both diagnosed it the same
 * way — new jobs arrive with bigger numbers on an identical decision, so by
 * the twentieth launch the only question left is which row pays most. One of
 * them proposed exactly this: a loud/quiet choice that trades payout against
 * attention differently from the existing risk tiers.
 *
 * It earns its place by touching systems the job list never did. Heat feeds
 * the odds of every future job and the evidence a case is built from; district
 * sentiment feeds business health, territory control and what the trade can
 * move through; fear is a separate currency with its own costs. So the same
 * contract can be the right job done the wrong way — a heavy score in the
 * district your fronts live in is a bill that arrives three months later.
 *
 * Deliberately three, not five. The choice has to be readable in the second it
 * takes to launch a job, and a fourth option would be a slider pretending to
 * be a decision.
 */
export const APPROACHES: ApproachDef[] = [
  {
    id: 'quiet',
    name: 'Quiet',
    blurb: 'Nobody hears about it. Nobody is impressed by it either.',
    success: 0.05,
    payout: 0.75,
    heat: 0.5,
    respect: 0.8,
    fear: 0,
    sentiment: 0,
  },
  {
    id: 'standard',
    name: 'Straight',
    blurb: 'The job as it was described to you.',
    success: 0,
    payout: 1,
    heat: 1,
    respect: 1,
    fear: 0,
    sentiment: 0,
  },
  {
    id: 'heavy',
    name: 'Heavy',
    blurb: 'Take more, and let the street see who took it.',
    success: -0.04,
    payout: 1.3,
    heat: 1.8,
    respect: 1.4,
    /*
       Was 2, against a failure cost of 3 charged on every job.

       That put the break-even success rate at 60% while the work runs at 52%
       heavy and 58% straight, so being loud drained fear for every career in
       the game. See the note on `FEAR.onFailure`, which carries the
       measurement. At 3 against 2 the line falls to 40%.
    */
    fear: 3,
    sentiment: -3,
  },
];

export const APPROACH_BY_ID: Record<ApproachId, ApproachDef> = Object.fromEntries(
  APPROACHES.map((a) => [a.id, a]),
) as Record<ApproachId, ApproachDef>;

/** Saves written before approaches existed have none. */
export const DEFAULT_APPROACH: ApproachId = 'standard';
