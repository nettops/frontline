/**
 * The tick pipeline.
 *
 * The order of these calls is game balance, so it lives in one visible place
 * rather than being scattered across the systems. Phases 4-8 insert into this
 * list; they do not restructure it.
 */

import { Rng } from './rng';
import type { GameState } from './types';
import { addEvidence, addLog } from './util';
import { tickOperations } from './operations';
import { tickBusinesses } from './business';
import { tickContraband } from './contraband';
import { tickOrders } from './orders';
import { tickScores } from './scores';
import { tickTraining } from './training';
import { tickStandingOrders } from './standingOrders';
import { tickMarks } from './marks';
import { tickAutopilot } from './autopilot';
import { closeWeek } from './ledger';
import { tickPossessions } from './possessions';
import { tickLaunderer } from './launderers';
import { tickTerritory } from './territory';
import { tickDelegation } from './delegation';
import { tickPromises } from './promises';
import { markStanding } from './standing';
import { tickInformants } from './informants';
import { tickDeposition } from './succession';
import { tickFactions } from './faction';
import { tickInvestigations } from './investigation';
import { tickWars } from './diplomacy';
import { spend, tickEconomy, tickHoldings } from './economy';
import { tickLoans, tickMarket, type LoanHooks } from './market';
import { tickHeat } from './heat';
import { addNote, driftNpcs, tickNpcs, crewList } from './npc';
import { tickAging, type AgingHooks } from './aging';
import { ageCapos, tickCapos } from './capos';
import { tickPerception } from './perception';
import { tickCivic } from './civic';
import { tickHome } from './personal';
import { tickCards } from './cards';
import { tickWhispers } from './whispers';
import { tickEvents } from './events';
import { tickWorld } from './world';
import { tickFear, tickRecord, tickStanding } from './player';
import { refreshRecruits } from './crew';
import { addInfluence, territoryDef } from './territory';
import { bond } from './diplomacy';
import { DRIFT_INTERVAL_DAYS } from '../config/npcs';
import { PAYDAY_INTERVAL } from '../config/economy';
import { RIVAL_IDS, type FactionId } from '../config/factions';
import { houseShort } from './houses';

export function advanceDay(state: GameState): void {
  if (state.gameOver) return;

  state.day += 1;
  const rng = new Rng(state.rng);

  // 0. What a dollar is worth today. First, because every figure produced by
  //    every system below is quoted in it.
  tickMarket(state, rng);

  // 1. Jobs that finish today resolve first — everything else reacts to them.
  tickOperations(state, rng);
  // 1a. The trades move what the streets and the people allow. Before the
  //     fronts, so what a trade earns this week can be washed this week —
  //     which is the join between the two halves of the economy, and the
  //     first thing that has ever strained the laundering system.
  tickContraband(state, rng);
  // 1b. And whatever is left on the shelf goes to whoever was promised it.
  //     After the trade, always: the buy aims at the street plus the orders,
  //     the street takes everything that is not reserved, and this hands over
  //     what that leaves. Daily rather than weekly, because a deadline is a
  //     day.
  tickOrders(state);
  // 1b2. Windows that have shut. Beside the orders and for the same reason: a
  //      deadline is a day, not a week. A job that is already out when its
  //      window shuts still gets to finish — the window is about when you had
  //      to move, not about how long the night takes.
  tickScores(state);
  // 1b3. And anybody being shown how. Beside the scores and for the same
  //      reason — a deadline is a day — and after them, so a man freed by a
  //      score that has just shut is free this morning rather than tomorrow.
  tickTraining(state);
  // 1b4. And anything you told to keep running itself. Last of the three, so
  //      it draws on a bench that scores and pairings have already taken from
  //      — the automation gets what is left rather than the first pick.
  tickStandingOrders(state);
  // 1b5. And anybody still being looked for. After the bench work, because a
  //      mark takes nobody off the board — it is other people's problem, and
  //      the only thing it competes for is the attention it draws.
  tickMarks(state, rng);
  // 1b6. And the whole operations loop, if it has been handed over. Last of
  //      the lot, so it draws on a bench that scores, pairings and standing
  //      orders have already taken from — the autopilot gets what is left
  //      rather than the first pick, exactly as a standing order does.
  tickAutopilot(state, rng);
  // 1c. Whoever keeps the books takes their fee and forms an opinion. Before
  //     the fronts, because `launderCut` reads the opinion and the fronts
  //     apply it the same morning — a week where somebody walks has to be a
  //     week the family pays the stranger's rate, not one where the panel and
  //     the payday disagree.
  tickLaunderer(state, rng);
  // 2. Fronts earn and launder, before wages — a business should be able to
  //    fund the crew that holds the district it sits in.
  tickBusinesses(state, rng);
  // 3. Everybody you owe collects, before the crew get paid — they are the
  //    only creditors in the game who do something about it.
  if (state.day % PAYDAY_INTERVAL === 0) {
    tickLoans(state, rng, (amount) => spend(state, amount, 'debt'), loanHooks(state, rng));
  }
  // 3a. Wages out.
  tickEconomy(state);
  // 3b. What the boss keeps, and what keeping it does for him.
  //
  //     After wages, because the upkeep on a yacht is a standing bill and
  //     belongs beside the other standing bills. Before the book is ruled off
  //     at 5d, or the charge lands in `unaccounted`. And before influence and
  //     feeling drift at 7, for the reason 6a runs where it does — a district
  //     the foundation worked this morning should read as worked when the
  //     drift asks about it this afternoon.
  tickPossessions(state);
  // 4. Heat decays only if nothing above generated any.
  tickHeat(state);
  // 4a. Being feared fades, and charges rent while it lasts.
  tickFear(state);
  tickStanding(state);
  tickHoldings(state);
  // 5. Availability timers, familiarity, and the calendar turning over.
  tickNpcs(state);
  // 5a. Once a year: decline, retirement, and the deaths that are nobody's
  //     fault. The organization's own clock, which it did not have before —
  //     every crisis in a long game used to have to be caused by the player
  //     or by an agency.
  tickAging(state, rng, agingHooks(state));
  // 5b. Anything you said you would do, checked against what you did. Before
  //     the weekly drift, so a man who was let down this morning is aggrieved
  //     when the drift asks him how he feels about you this afternoon.
  tickPromises(state);
  // 5c. Who has been carrying the work, and who has been watching it happen.
  //     Before the weekly drift for the same reason `tickPromises` is: a man
  //     marked this morning should be aggrieved when the drift asks him this
  //     afternoon how he feels about you.
  if (state.day % DRIFT_INTERVAL_DAYS === 0) markStanding(state);
  // 5d. Rule off the week's book.
  //
  //     After every phase that moves money and before anything that only
  //     reads it. The close differences the wallet against what was written
  //     down and books the gap as `unaccounted`, so a category nobody has
  //     labelled yet shows up on the panel rather than disappearing.
  if (state.day % PAYDAY_INTERVAL === 0) closeWeek(state);
  // 6. The weekly re-evaluation of everybody's position.
  if (state.day % DRIFT_INTERVAL_DAYS === 0) driftNpcs(state, rng);
  // 6a. Anybody holding a district of yours decides what to do with it this
  //     week. Before `tickTerritory`, because a man working a district keeps
  //     your name alive in it and the decay pass below reads exactly that —
  //     running it the other way round would bleed influence out of districts
  //     somebody is standing in.
  tickDelegation(state, rng);
  // 7. Influence bleeds where you stopped showing up; feeling drifts back.
  if (state.day % 7 === 0) tickTerritory(state);
  // 7a. Whatever reached you this week, and how sure whoever brought it was.
  //
  //     Before the civic tick only because it reads nothing that tick writes;
  //     it takes the world as it stands at the end of the day's events, which
  //     is what somebody would actually be repeating.
  tickWhispers(state);
  // 7a2. And the people who are not in the family at all.
  //
  //      Reads nothing any other tick writes and writes only its own record,
  //      so it can sit anywhere in the week. Here, beside the other opinions
  //      being formed about you.
  tickHome(state);
  // 7a3. And the room slowly stops watching your hands.
  //
  //      Decay only — sitting down is a player action, never a tick. Touches
  //      nothing but its own record, so it sits with the other quiet weekly
  //      readings rather than anywhere load-bearing.
  tickCards(state);
  // 7b. The people outside the family form an opinion.
  //
  //     After `tickTerritory` on purpose: a union boss counts the ground you
  //     hold and a judge reads the districts you work, so they should be
  //     looking at this week's map rather than last week's. Reads state and
  //     writes only its own roster, so nothing downstream depends on it.
  tickCivic(state);
  // 8. Anybody at war fights this week, before decisions are taken — a family
  //    that has just been beaten should be deciding with that in front of it.
  if (state.day % 7 === 0) tickWars(state, rng);
  // 8a. The men under the other bosses form a view about the week their family
  //     has had. After the fighting and before the decisions, because a capo
  //     who has just watched his side lose should be deciding with that in
  //     front of him — same principle as the families themselves.
  tickCapos(state, rng);
  ageCapos(state, rng);
  // 9. The other families look at the same board and decide what to do about it.
  tickFactions(state, rng);
  // 9a. Anybody frightened enough finds somebody to talk to, and anybody
  //     already talking hands over a night. Before the agencies read the
  //     board, because what was said this week is part of what they read —
  //     and after the crew drift, so a man who lost something this week is
  //     reachable this week rather than next.
  tickInformants(state, rng);
  // 9b. And the question the organization asks about you every week. After the
  //     rivals and before the agencies, because it is neither of their doing —
  //     it is the only way out of the chair that is entirely the player's own
  //     work, and the only one a boss who is thirty can reach.
  tickDeposition(state, rng);
  if (state.gameOver) return;
  // 10. Agencies read what you left behind. This is where the bill comes due.
  tickInvestigations(state, rng);
  if (state.gameOver) return;
  // 10a. The city reads about all of the above and forms a view; city hall
  //      catches up with the city some weeks later. This has to sit after
  //      everything that generates coverage and before the conditions that
  //      read the mood.
  tickPerception(state, rng);
  // 11. The city gets on with its own month, independently of any of this.
  //     After the systems that can cause a condition, before the ones that
  //     react to one.
  tickWorld(state, rng);
  // The last three steps are the only ones in this pipeline that exist because
  // somebody is playing. In Simulation there is no player to recruit for, no
  // desk for a memo to land on, and no rank to earn — everything above this
  // line is the city, and the city runs the same either way.
  if (state.mode !== 'simulation') {
    // 12. New faces become available periodically.
    refreshRecruits(state, rng);
    // 13. The world raises something, based on all of the above.
    tickEvents(state, rng);
    /*
       14. What the family has ever managed, then whether that earns a rank.
           In this order, because the rank table reads the record — a peak
           reached today should count today rather than tomorrow.
    */
    tickRecord(state);
    // 15. Has the organization earned the next rank?
  }

}

/**
 * What the rest of the organization has to do about somebody being gone.
 *
 * Kept here rather than in aging.ts because both branches are succession
 * business, and aging.ts is a leaf module by design — it knows about bodies
 * and birthdays and deliberately nothing else.
 */
function agingHooks(state: GameState): AgingHooks {
  return {
    onDeath(npc) {
      if (state.succession.heirId === npc.id) {
        state.succession.heirId = null;
        state.succession.heirNamedDay = null;
        addLog(
          state,
          'The man you had said was next is not next any more. Somebody should be told.',
          'crew',
        );
      }
    },
    onRetire(npc) {
      if (state.succession.heirId === npc.id) {
        state.succession.heirId = null;
        state.succession.heirNamedDay = null;
      }
      // He left on good terms and owes nobody an explanation, so this is a
      // fraction of what a dismissal writes. It is not nothing: he is outside
      // now, and he was inside for forty years.
      addEvidence(state, {
        day: state.day,
        source: 'informant',
        strength: 3,
        npcIds: [npc.id],
        detail: `${npc.name} is no longer with the organization.`,
      });
    },
  };
}

/**
 * What a lender does when there is nothing to collect.
 *
 * Same arrangement as `agingHooks`: market.ts sits below the crew, the evidence
 * chain and the diplomacy matrix, so it describes the consequence and this file
 * carries it out.
 */
function loanHooks(state: GameState, rng: Rng): LoanHooks {
  return {
    onViolence(injuryDays, evidence) {
      const available = crewList(state).filter((n) => n.status === 'active');
      if (available.length === 0) return;
      const victim = rng.pick(available);
      victim.status = 'injured';
      victim.unavailableUntilDay = state.day + injuryDays;
      addNote(victim, state.day, 'Was hurt over money you owe somebody else.', 'bad');
      addEvidence(state, {
        day: state.day,
        source: 'violence',
        strength: evidence,
        npcIds: [victim.id],
        detail: `${victim.name} was assaulted in a dispute over money.`,
      });
      addLog(
        state,
        `${victim.name} was hurt. Nobody has said why, and everybody knows why.`,
        'failure',
      );
    },

    onPaper(evidence) {
      // No violence and no warning. A bank in default produces eighteen months
      // of your accounts to somebody who reads accounts for a living, and the
      // Financial Crimes Division has been waiting for exactly this.
      addEvidence(state, {
        day: state.day,
        source: 'finance',
        strength: evidence,
        npcIds: [],
        detail: 'A lender has filed against the businesses. The filing is very thorough.',
      });
    },

    onObligation(factionId, grudge, influence) {
      const id = (factionId ?? RIVAL_IDS[0]) as FactionId;
      const faction = state.factions[id];
      if (!faction) return;
      bond(state, id, 'player').grudge = Math.min(100, bond(state, id, 'player').grudge + grudge);

      // They do not ask for the money again. They take a street instead, which
      // is what they wanted the whole time and why the terms were friendly.
      const target = Object.values(state.territories)
        .filter((t) => (t.influence.player ?? 0) > influence)
        .sort((a, b) => (b.influence[id] ?? 0) - (a.influence[id] ?? 0))[0];
      if (target) {
        addInfluence(state, target.id, -influence);
        target.influence[id] = Math.min(100, (target.influence[id] ?? 0) + influence);
        addLog(
          state,
          `${houseShort(state, id)} took their money out of ${territoryDef(target.id).name}. They did not take it in money.`,
          'failure',
        );
      }
    },
  };
}

/**
 * Advances up to `days`, stopping early when something needs the player.
 * Returns how many days actually passed, so the UI can say why it stopped.
 */
export function advanceDays(state: GameState, days: number): number {
  const startingEvents = state.pendingEvents.length;
  for (let i = 0; i < days; i++) {
    advanceDay(state);
    if (state.gameOver) return i + 1;
    if (state.pendingEvents.length > startingEvents) return i + 1;
  }
  return days;
}

/*
   There is no bankruptcy ending any more, and there never should have been.

   `checkGameOver` used to stop a career with no crew, no work running and less
   money than a recruit costs. It read as a floor and it was a declaration: the
   game deciding, on the player's behalf, that a bad run was a finished one.

   It was also not true. `work_it_yourself` asks for no crew, no investment and
   one day, pays $180 to $420 at 82%, and is open from the first rank. Every
   morning that function fired, the player had something they could do — the
   run was taken away at the exact point it got interesting.

   A career now ends the two ways a 1935 boss's career ends: a conviction, or
   somebody kills you. Both go through `removePlayer` in succession.ts, and
   both still only stop the game when there is nobody left to hand it to.
   `careerEnd.test.ts` holds all of that, including the part that makes it
   safe — that there is always a job on the board.
*/

