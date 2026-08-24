/**
 * Bringing people in, moving them up, and cutting them loose.
 *
 * Every one of these actions is also a relationship event: promotion buys
 * loyalty, dismissal creates someone who knows things and owes you nothing.
 */

import { Rng, clamp } from './rng';
import type { GameState, Npc, RoleId } from './types';
import { addEvidence, addLog, withArticle } from './util';
import {
  addNote,
  crewList,
  generateNpc,
  isOutOfReach,
  traitEffect,
} from './npc';
import { passedOver } from './ties';
import { remember } from './memory';
import { spend, totalFunds } from './economy';
import { reduceHeat } from './heat';
import { fearLevel, maxCrew } from './player';
import { controlledTerritories } from './territory';
import {
  FEAR,
  ROLE_LABEL,
  ROLE_ORDER,
  ROLE_WAGE,
  RECRUIT_COST,
} from '../config/economy';
import { WAGE_CEILING_MULTIPLE } from '../config/economy';
import { DISMISSAL, PROMOTION, RECRUIT_POOL_SIZE, RECRUIT_REFRESH_DAYS } from '../config/npcs';
import { DISMISS_HEAT_REDUCTION } from '../config/heat';
import { priced } from './market';

// -------------------------------------------------------------- recruits ---

/**
 * Cheaper to bring someone in when you can talk, dearer when they have heard
 * what happens to people who work for you.
 */
export function recruitCost(state: GameState): number {
  const discount = state.player.attributes.negotiation * 0.02;
  const frightening = 1 + fearLevel(state) * (FEAR.recruitCostAtMax - 1);
  return Math.round(priced(state, RECRUIT_COST) * (1 - clamp(discount, 0, 0.35)) * frightening);
}

export function refreshRecruits(state: GameState, rng: Rng, force = false): void {
  if (!force && state.day - state.recruitsRefreshedDay < RECRUIT_REFRESH_DAYS) return;

  const had = Object.keys(state.recruits).length;
  state.recruits = {};
  for (let i = 0; i < RECRUIT_POOL_SIZE; i++) {
    const npc = generateNpc(state, rng, 'associate');
    state.recruits[npc.id] = npc;
  }
  state.recruitsRefreshedDay = state.day;
  /*
     Say that the list turned over.

     It replaces itself wholesale every RECRUIT_REFRESH_DAYS and said nothing.
     Round 11 read the list on day 6, went back on day 14 to hire two specific
     men, and found both gone and four strangers in their place with no
     indication the list had ever been perishable.
  */
  if (had > 0) {
    addLog(
      state,
      'The people asking around are not the same people as last week.',
      'crew',
    );
  }
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Whether somebody can be brought in, and why not.
 *
 * Split out of recruit for the panel's sake. The button used to guard the crew
 * cap and nothing else, so a boss who could not cover the fee got a live button
 * that took the click and did nothing — the cap is the visible limit and money
 * is the one that actually stops you most of the time.
 */
export function canRecruit(state: GameState, recruitId: string): ActionResult {
  const npc = state.recruits[recruitId];
  if (!npc) return { ok: false, message: 'That person is no longer around.' };

  if (crewList(state).length >= maxCrew(state)) {
    /*
       Names the figure, the bar and the way back.

       It used to say "A Street Criminal cannot hold more than 3 people. Move
       up first." — a title the game no longer shows anywhere, and a remedy
       ("move up") that pointed at a ladder that has been taken out. Ground is
       both the real constraint now and something the player can go and get.
    */
    const held = controlledTerritories(state).length;
    return {
      ok: false,
      message:
        `You hold ${held} ${held === 1 ? 'district' : 'districts'}, which feeds ` +
        `${maxCrew(state)} people. Take more ground before you take on anybody else.`,
    };
  }

  const cost = recruitCost(state);
  if (totalFunds(state) < cost) {
    return {
      ok: false,
      message: `Bringing them in costs $${cost.toLocaleString(
        'en-US',
      )} and you have $${totalFunds(state).toLocaleString('en-US')}.`,
    };
  }
  return { ok: true, message: `$${cost.toLocaleString('en-US')} to bring them in.` };
}

export function recruit(state: GameState, recruitId: string): ActionResult {
  const check = canRecruit(state, recruitId);
  if (!check.ok) return check;
  const npc = state.recruits[recruitId]!;

  const cost = recruitCost(state);
  if (!spend(state, cost, 'crew')) {
    return { ok: false, message: 'You cannot cover what it takes to bring them in.' };
  }

  delete state.recruits[recruitId];
  npc.joinedDay = state.day;
  npc.daysInCrew = 0;
  state.npcs[npc.id] = npc;

  addNote(npc, state.day, 'Brought into the organization.', 'neutral');
  addLog(state, `${npc.name} is with you now. You do not know them yet.`, 'crew');
  return { ok: true, message: `${npc.name} joined the organization.` };
}

// ------------------------------------------------------------- promotion ---

function nextRole(role: RoleId): RoleId | null {
  const idx = ROLE_ORDER.indexOf(role);
  return idx >= 0 && idx < ROLE_ORDER.length - 1 ? ROLE_ORDER[idx + 1] : null;
}

export function canPromote(_state: GameState, npc: Npc): ActionResult {
  const next = nextRole(npc.role);
  if (!next) return { ok: false, message: 'There is nowhere higher to put them.' };

  /*
     No ceiling on who you can promote.

     `rankDef(state).maxRole` used to stop a player naming a capo before the
     ladder said they were senior enough to have one. You are the boss of this
     outfit from the first morning, so there is nobody above you to withhold
     permission — and the appointment already carries its own costs, in wages
     and in what a disappointed man remembers.
  */
  if (isOutOfReach(npc)) {
    return {
      ok: false,
      message:
        npc.status === 'arrested'
          ? 'They are in a cell. Nothing you decide reaches them there.'
          : 'They are not around to promote.',
    };
  }
  return { ok: true, message: `Promote to ${ROLE_LABEL[next]}` };
}

/**
 * Promotion is the main loyalty lever you have — and the main way you hand
 * an ambitious person enough standing to move against you later.
 */
export function promote(state: GameState, npcId: string): ActionResult {
  const npc = state.npcs[npcId];
  if (!npc) return { ok: false, message: 'No such person.' };

  const check = canPromote(state, npc);
  if (!check.ok) return check;

  /*
   * Everybody at or above the rung he just reached watched him reach it.
   *
   * This is the edge the whole tie system was built for: the design brief's
   * example story starts "A wants a promotion, B blocks him", and before ties
   * existed there was nowhere in the state to put the resentment that follows.
   * Collected before the promotion so the man being promoted is not counted
   * among the people passed over.
   */
  const watching = crewList(state).filter(
    (n) => n.id !== npc.id && ROLE_ORDER.indexOf(n.role) >= ROLE_ORDER.indexOf(nextRole(npc.role)!),
  );

  const next = nextRole(npc.role)!;
  npc.role = next;
  npc.wage = priced(state, ROLE_WAGE[next]);
  npc.stats.loyalty = clamp(npc.stats.loyalty + PROMOTION.loyaltyGain, 0, 100);
  npc.stats.respectForBoss = clamp(
    npc.stats.respectForBoss + PROMOTION.respectForBossGain,
    0,
    100,
  );
  npc.stats.ambition = clamp(npc.stats.ambition - PROMOTION.ambitionRelief, 0, 100);
  npc.stats.grievance = clamp(npc.stats.grievance - PROMOTION.grievanceRelief, 0, 100);

  passedOver(state, npc, watching);
  remember(npc, state.day, 'promoted');
  for (const other of watching) remember(other, state.day, 'passed_over', npc.id);

  addNote(npc, state.day, `Made ${ROLE_LABEL[next]}.`, 'good');
  addLog(state, `${npc.name} is ${withArticle(ROLE_LABEL[next])} now.`, 'crew');
  return { ok: true, message: `${npc.name} promoted to ${ROLE_LABEL[next]}.` };
}

// ------------------------------------------------------------- dismissal ---

/**
 * Cutting someone loose reduces your exposure through them — and creates a
 * person on the outside who knows how you work.
 */
export function dismiss(state: GameState, npcId: string): ActionResult {
  const npc = state.npcs[npcId];
  if (!npc) return { ok: false, message: 'No such person.' };
  if (npc.status === 'busy') {
    return { ok: false, message: 'They are in the middle of a job.' };
  }

  npc.status = 'defected';
  npc.unavailableUntilDay = null;
  addNote(npc, state.day, 'Dismissed from the organization.', 'bad');
  // Cutting somebody loose cuts an *inside* thread, which is the one
  // channel going quiet cannot touch. It is now the counterplay to it.
  reduceHeat(state, DISMISS_HEAT_REDUCTION, 'inside');

  addEvidence(state, {
    day: state.day,
    source: 'informant',
    // A careful man takes his silence with him; a sloppy one takes his mouth.
    strength: Math.round(
      (DISMISSAL.evidenceStrength + npc.familiarity / 10) * traitEffect(npc, 'exposure'),
    ),
    npcIds: [npc.id],
    detail: `${npc.name} was dismissed and knows how the organization operates.`,
  });

  addLog(
    state,
    `${npc.name} is out. That is one less thread — and one more person who knows things.`,
    'crew',
  );
  return { ok: true, message: `${npc.name} dismissed.` };
}

// ------------------------------------------------------------------ wages ---

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** The most anybody in this role will ever be paid, at today's prices. */
export function wageCeiling(state: GameState, npc: Npc): number {
  return Math.round(priced(state, ROLE_WAGE[npc.role]) * WAGE_CEILING_MULTIPLE);
}

/**
 * Whether there is any room left to pay him more.
 *
 * Exists because the button that offers a raise was, at the ceiling, an
 * unmarked trap: `setWage` clamps, the clamped figure equals what he already
 * earns, `raised` comes out false — and the man was given a note saying he had
 * had his pay *cut* and eight points of grievance for it. Pressing "Raise pay"
 * made him angrier. The guard is what the UI needed; the branch below is the
 * actual repair.
 */
export function canRaise(state: GameState, npcId: string): ActionResult {
  const npc = state.npcs[npcId];
  if (!npc) return { ok: false, message: 'No such person.' };
  if (isOutOfReach(npc)) {
    return {
      ok: false,
      message:
        npc.status === 'arrested'
          ? 'They are in a cell. Nothing you decide reaches them there.'
          : 'They are not around to pay.',
    };
  }
  const ceiling = wageCeiling(state, npc);
  if (npc.wage >= ceiling) {
    return {
      ok: false,
      message: `${npc.name} is already on ${money(ceiling)} — nobody in this ` +
        `organization is paid more for the job they do.`,
    };
  }
  return { ok: true, message: `Raise pay 25%` };
}

/** Paying above the going rate is the other loyalty lever, and it compounds. */
export function setWage(state: GameState, npcId: string, wage: number): ActionResult {
  const npc = state.npcs[npcId];
  if (!npc) return { ok: false, message: 'No such person.' };

  const going = priced(state, ROLE_WAGE[npc.role]);
  const capped = clamp(Math.round(wage), Math.round(going * 0.5), going * WAGE_CEILING_MULTIPLE);
  const before = npc.wage;
  npc.wage = capped;

  /*
     Three outcomes, where there used to be two.

     The missing one was "nothing moved", and its absence was a real defect
     rather than a cosmetic one: at the ceiling the clamp returned his existing
     wage, the raise/cut test came out `cut`, and pressing "Raise pay" wrote him
     a note saying his pay had been cut and charged him eight points of
     grievance for it. The one lever in the game for buying loyalty back made
     the man angrier, silently, in exactly the situation where the player was
     trying hardest.
  */
  if (capped === before) {
    return {
      ok: true,
      message: `${npc.name} stays on ${money(capped)}. There is nothing above it for the job they do.`,
    };
  }

  const raised = capped > before;
  addNote(npc, state.day, raised ? 'Given a raise.' : 'Had their pay cut.', raised ? 'good' : 'bad');
  if (!raised) npc.stats.grievance = clamp(npc.stats.grievance + 8, 0, 100);

  return { ok: true, message: `${npc.name} now earns ${money(capped)} a week.` };
}
