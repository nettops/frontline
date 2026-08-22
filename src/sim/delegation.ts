/**
 * Districts held by somebody other than you.
 *
 * The design and its three rules live in `config/delegation.ts`. This is the
 * machine: it appoints, it recalls, and once a week it lets every steward
 * decide for himself what to do with the place you gave him.
 *
 * The decision is scored the way the rival families' decisions are scored —
 * appetite from who he is, opportunity from where he is standing, then the
 * best option wins with a little noise on top. That is deliberate. The house
 * AI was built so that a family behaving aggressively does so because
 * aggression scored well for it that week, not because a script said so; a man
 * you handed a district to deserves the same, or he is a stat bonus wearing a
 * name.
 *
 * One thing this module must never do is tell the player why. His scores are
 * read off numbers the game has spent its whole design hiding, so the record
 * he leaves is *what he did* and nothing else. Two of the six things he can do
 * are written into that record identically on purpose.
 */

import { Rng, clamp } from './rng';
import type { GameState, Id, Npc, StewardEntry, Territory } from './types';
import {
  DELEGATION,
  STEWARD_ACTIONS,
  STEWARD_ACTION_BY_ID,
  type StewardActionDef,
} from '../config/delegation';
import { ROLE_ORDER } from '../config/economy';
import { addLog } from './util';
import { addNote, crewList, wageExpectation } from './npc';
import { authority } from './authority';
import { AUTHORITY } from '../config/authority';
import { remember } from './memory';
import { earnDirty } from './economy';
import { addInfluence, adjustSentiment, playerInfluence, territoryDef, territoryList } from './territory';
import { addHeat } from './heat';

export interface Check {
  ok: boolean;
  message: string;
}

// ------------------------------------------------------------ appointing ---

export function stewardOf(state: GameState, t: Territory): Npc | null {
  const id = t.stewardId;
  return id ? (state.npcs[id] ?? null) : null;
}

/** Districts this man already holds. One each — a man cannot be in two places. */
export function districtsHeldBy(state: GameState, npcId: Id): Territory[] {
  return territoryList(state).filter((t) => t.stewardId === npcId);
}

export function canPutInCharge(state: GameState, npcId: Id, territoryId: string): Check {
  const npc = state.npcs[npcId];
  const t = state.territories[territoryId];
  if (!npc || !t) return { ok: false, message: 'No.' };
  if (npc.status !== 'active' && npc.status !== 'busy') {
    return { ok: false, message: `${npc.name} is not available.` };
  }
  if (ROLE_ORDER.indexOf(npc.role) < DELEGATION.minRoleIndex) {
    return {
      ok: false,
      message: `${npc.name} is too junior to be given a district of their own.`,
    };
  }
  if (playerInfluence(t) <= 0) {
    return { ok: false, message: 'You have nothing here to hand anybody.' };
  }
  if (t.stewardId === npcId) return { ok: false, message: 'They already have it.' };
  if (t.stewardId) {
    return { ok: false, message: `${territoryDef(t.id).name} is already somebody's.` };
  }
  const held = districtsHeldBy(state, npcId);
  if (held.length > 0) {
    return { ok: false, message: `${npc.name} already has ${territoryDef(held[0].id).name}.` };
  }
  return { ok: true, message: `Give ${territoryDef(t.id).name} to ${npc.name}` };
}

export function putInCharge(state: GameState, npcId: Id, territoryId: string): Check {
  const guard = canPutInCharge(state, npcId, territoryId);
  if (!guard.ok) return guard;

  const npc = state.npcs[npcId];
  const t = state.territories[territoryId];
  t.stewardId = npcId;
  t.stewardSince = state.day;
  t.ledger = [];

  // Being trusted with something is worth more than being paid for it.
  npc.stats.loyalty = clamp(npc.stats.loyalty + DELEGATION.appointLoyalty, 0, 100);
  npc.stats.respectForBoss = clamp(
    npc.stats.respectForBoss + DELEGATION.appointRespect,
    0,
    100,
  );
  remember(npc, state.day, 'promoted');
  addNote(npc, state.day, `Was given ${territoryDef(t.id).name} to run.`, 'good');
  addLog(state, `${npc.name} has ${territoryDef(t.id).name} now. It is theirs to answer for.`, 'crew');
  return { ok: true, message: '' };
}

export function takeItBack(state: GameState, territoryId: string): Check {
  const t = state.territories[territoryId];
  if (!t?.stewardId) return { ok: false, message: 'Nobody has it.' };
  const npc = state.npcs[t.stewardId];
  // A man who is already gone cannot be humiliated by losing the district, and
  // telling the player he "heard about it the same day everybody else did"
  // about somebody who walked out a fortnight ago reads as a bug.
  const stillHere = !!npc && npc.status !== 'dead' && npc.status !== 'defected';

  t.stewardId = null;
  t.stewardSince = null;

  if (!stillHere) {
    if (npc) {
      addLog(
        state,
        `${territoryDef(t.id).name} has nobody running it. ${npc.name} is not coming back for it.`,
        'neutral',
      );
    }
    return { ok: true, message: '' };
  }

  if (npc) {
    // Taking a thing back from a man who has held it in front of other people
    // is not the same as never having given it to him.
    npc.stats.loyalty = clamp(npc.stats.loyalty + DELEGATION.recallLoyalty, 0, 100);
    npc.stats.grievance = clamp(npc.stats.grievance + DELEGATION.recallGrievance, 0, 100);
    remember(npc, state.day, 'passed_over');
    addNote(npc, state.day, `Had ${territoryDef(t.id).name} taken off them.`, 'bad');
    addLog(
      state,
      `${territoryDef(t.id).name} is yours again. ${npc.name} heard about it the same day everybody else did.`,
      'crew',
    );
  }
  return { ok: true, message: '' };
}

// --------------------------------------------------------------- deciding ---

/**
 * What this man wants to do here this week.
 *
 * Appetite is his own numbers weighted by the option, then bent by where he
 * actually stands: a greedy man paid above what he thinks he is worth loses
 * most of his reason to take anything, and a man carrying a grudge gets it
 * back. That second term is what stops the whole mechanic being answerable
 * from one look at the crew sheet.
 */
function appetite(state: GameState, npc: Npc, t: Territory, action: StewardActionDef): number {
  let score = action.base;
  for (const [stat, weight] of Object.entries(action.wants)) {
    score += (npc.stats[stat as keyof typeof npc.stats] / 100) * (weight as number);
  }

  if (action.needsOpportunity) {
    const expected = wageExpectation(state, npc);
    const paidWell = expected > 0 ? npc.wage / expected : 1;
    // Well paid pulls him off it; a grudge puts him back on.
    score -= clamp(paidWell - 1, 0, 1) * DELEGATION.paidWellBonus;
    score += (npc.stats.grievance / 100) * DELEGATION.grievanceUnbrake;
    /*
       And whether he thinks anybody is counting.

       The two terms above are both about *him* — what he is paid and what he
       is carrying. Neither asks the question a man alone in a district
       actually asks, which is what happens if this comes back to the boss.
       That question is `authority`, and until it existed there was nothing in
       the game it could be read off.

       This is the whole mechanical weight of that reading. A family run well
       is a family whose stewards do not try it; a boss whose word does not
       hold, whose men are aggrieved and whose payroll is a month behind finds
       out what his districts are worth to him.
    */
    score -= (authority(state) / 100) * AUTHORITY.skimBrake;
  }

  // A district that already hates you is a poor place to squeeze harder.
  if (action.sentiment < 0) score -= (1 - t.sentiment / 100) * 0.6;
  return score;
}

function decide(state: GameState, npc: Npc, t: Territory, rng: Rng): StewardActionDef {
  let best = STEWARD_ACTIONS[0];
  let bestScore = -Infinity;
  for (const action of STEWARD_ACTIONS) {
    const score = appetite(state, npc, t, action) + rng.float(0, DELEGATION.jitter);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

/**
 * What a week in this district is worth before anybody decides anything.
 *
 * Deliberately noisy. Without the swing every week returned exactly the same
 * figure, and a probe watching two identical districts could name the thief
 * from a single entry — which would make the whole mechanic a lookup answerable
 * on day seven rather than a read that takes a season.
 *
 * A district does not earn the same money twice running, and it is that honest
 * variance the dishonest steward hides inside. The player cannot judge one
 * week; they have to average, which is the behaviour this pattern exists to
 * teach.
 */
function weeklyWorth(t: Territory, rng: Rng): number {
  const base = districtWorth(t);
  return Math.round(base * rng.float(1 - DELEGATION.worthSwing, 1 + DELEGATION.worthSwing));
}

/**
 * The same figure with the swing taken off — what an average week is worth.
 *
 * Exported because the player is entitled to it *before* they hand somebody a
 * district rather than a month afterwards. Nothing on the appointing screen
 * said what a district was worth, so putting a man on one read as taking a
 * body off the job board for nothing, which is exactly backwards: a steward is
 * the only income in this game that does not occupy somebody you could have
 * sent out.
 *
 * It is the centre of the distribution and not a best case. What a man
 * actually brings in swings either side of it, and that honest variance is
 * where a dishonest steward hides — so the number on the screen is the thing
 * you average his record against, not a promise about any particular week.
 */
export function districtWorth(t: Territory): number {
  const standing = playerInfluence(t) / 100;
  return Math.round(DELEGATION.worthPerWeek * standing * (t.prosperity / 100 + 0.5));
}

export function tickDelegation(state: GameState, rng: Rng): void {
  if (state.day % DELEGATION.intervalDays !== 0) return;

  for (const t of territoryList(state)) {
    const npc = stewardOf(state, t);
    if (!npc) continue;
    if (npc.status === 'dead' || npc.status === 'defected' || npc.status === 'arrested') {
      // A district cannot be held by somebody who is not there.
      takeItBack(state, t.id);
      continue;
    }

    const action = decide(state, npc, t, rng);
    const worth = weeklyWorth(t, rng);
    const gross = Math.round(worth * action.earn);
    const kept = Math.round(gross * action.takes);
    const reached = gross - kept;

    if (action.influence !== 0) addInfluence(state, t.id, action.influence);
    if (action.sentiment !== 0) adjustSentiment(state, t.id, action.sentiment);
    if (action.heat !== 0) addHeat(state, action.heat, 'street', `work in ${territoryDef(t.id).name}`);
    if (reached > 0) earnDirty(state, reached);

    if (kept > 0) {
      npc.isSkimming = true;
      npc.skimTotal += kept;
    }

    // A man holding a district keeps your name in it, which is most of why
    // handing it over is worth doing at all.
    if (DELEGATION.keepsDistrictWarm) t.lastActionDay = state.day;

    // Watching somebody use authority teaches you about him. More slowly than
    // sitting in a room with him, which is the point of having both.
    npc.familiarity = clamp(npc.familiarity + DELEGATION.familiarityPerWeek, 0, 100);

    const entry: StewardEntry = {
      day: state.day,
      action: action.id,
      earned: reached,
    };
    t.ledger = [entry, ...(t.ledger ?? [])].slice(0, DELEGATION.ledgerLength);
  }
}

// ---------------------------------------------------------------- reading ---

export interface LedgerLine {
  day: number;
  label: string;
  note: string;
  earned: number;
}

/**
 * What he has been doing, as the player is allowed to see it.
 *
 * Deliberately built from the action's *label*, never its id — two of the six
 * things he can do read identically here, and the money column is the only
 * place the difference shows.
 */
export function readLedger(t: Territory): LedgerLine[] {
  return (t.ledger ?? []).map((entry) => {
    const def = STEWARD_ACTION_BY_ID[entry.action];
    return {
      day: entry.day,
      label: def?.label ?? 'Worked it',
      note: def?.note ?? '',
      earned: entry.earned,
    };
  });
}

/** Everyone senior enough to be handed a district, and not already holding one. */
export function eligibleStewards(state: GameState): Npc[] {
  return crewList(state).filter(
    (n) =>
      (n.status === 'active' || n.status === 'busy') &&
      ROLE_ORDER.indexOf(n.role) >= DELEGATION.minRoleIndex &&
      districtsHeldBy(state, n.id).length === 0,
  );
}

/**
 * Whether there is ground standing idle that somebody could be running.
 *
 * Lives here rather than in the rail because it was wrong in the rail. The
 * badge asked `held === 0 && handOver`, which showed the suggestion to
 * delegate a district only to players holding no districts — the only players
 * with nothing to delegate. A blind playtester held ground for a hundred and
 * seventy-nine days and never once saw it.
 *
 * That mattered more than a missing hint usually does. A steward is the only
 * income in this game that does not occupy a body you could otherwise send out
 * on a job, which makes handing a district over the only way an organization
 * earns more than it costs to keep as it grows. The prompt for it was visible
 * exclusively to people who could not act on it.
 */
export function needsSteward(state: GameState): boolean {
  if (eligibleStewards(state).length === 0) return false;
  return territoryList(state).some(
    (t) => playerInfluence(t) > DELEGATION.promptAboveInfluence && !t.stewardId,
  );
}

/** Average weekly take across his record. The number that gives a skimmer away. */
export function averageTake(t: Territory): number | null {
  const entries = t.ledger ?? [];
  if (entries.length === 0) return null;
  return Math.round(entries.reduce((sum, e) => sum + e.earned, 0) / entries.length);
}
