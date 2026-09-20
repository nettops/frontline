/**
 * What comes up, and what the boss does about it when it comes up light.
 *
 * The rest of the game is the boss deciding what to do. This is the one
 * system where somebody else decides and the boss only finds out afterwards:
 * every week each capo hands over an envelope, and the only thing the player
 * actually chooses is what happens when the envelope is short.
 *
 * Three ways to answer, and none of them is free — letting it go costs
 * standing, squeezing costs the man, and checking costs money and, if he was
 * honest, costs far more than the money. That is the whole design: the
 * cheapest answer is the one that is wrong about a third of the time, and the
 * game never tells you which third. `Npc.isSkimming` is the hidden truth and
 * it stays hidden; an audit is the only thing in the game that reads it.
 *
 * Everything here is derived or written to `state.tribute`, which is an
 * optional field with a lazy initialiser (`tributeState`) — no `SAVE_VERSION`
 * move, the same idiom `capoPitches` and `home` already use.
 */

import { Rng, clamp } from './rng';
import type { Business, GameState, Id, Npc, TributeRecord, TributeState } from './types';
import {
  SPECIAL_VENTURES,
  TRIBUTE,
  VENTURE_PERKS,
  type EarnerStatus,
  type LightEnvelopeDilemma,
} from '../config/tribute';
import { HEALTH } from '../config/businesses';
import { HOME_TERRITORY } from '../config/territories';
import { RANKS, rankIndex } from '../config/economy';
import { rankNow } from './rank';
import { note } from './ledger';
import { formatMoney } from './util';
import { activeCapos } from './capoTension';
import { districtsHeldBy } from './delegation';
import { earnDirty, spend } from './economy';
import { addNote } from './npc';
import { gainRespect } from './player';
import { confidantIsExposed } from './personal';
import { activeCases } from './investigation';
import { stageIndex } from '../config/lawEnforcement';
import { addLog, hasSpecialVenture, nextId, say } from './util';

/** Lazy, so a save written before the envelopes existed loads with an empty book. */
export function tributeState(state: GameState): TributeState {
  if (!state.tribute) state.tribute = { history: [], pendingDilemmas: [] };
  return state.tribute;
}

/**
 * Whose work counts toward a capo's envelope: his own, and anybody who
 * answers to him.
 *
 * `reportsTo` rather than `districtsHeldBy` because a crew is people, not
 * ground — a capo with no district still has men out earning for him.
 */
function crewOf(state: GameState, capoId: Id): Set<Id> {
  const ids = new Set<Id>([capoId]);
  for (const npc of Object.values(state.npcs)) {
    if (npc.reportsTo === capoId) ids.add(npc.id);
  }
  return ids;
}

/** Jobs his people came back from inside the window. */
function recentOps(state: GameState, capoId: Id): number {
  const crew = crewOf(state, capoId);
  const since = state.day - TRIBUTE.earnerHistoryDays;
  return state.operationHistory.filter(
    (r) => r.day >= since && r.crewIds.some((id) => crew.has(id)),
  ).length;
}

/**
 * What a week from this man is worth, before anything goes wrong with it.
 *
 * Derived every time rather than stored: it is three facts the state already
 * holds (who he is, what ground he keeps, what his people have been doing),
 * and a stored copy would drift the first time a district changed hands.
 */
export function capoTributeEstimate(state: GameState, capoId: Id): number {
  return Math.round(
    TRIBUTE.baseEnvelope +
      districtsHeldBy(state, capoId).length * TRIBUTE.perControlledDistrict +
      recentOps(state, capoId) * TRIBUTE.perRecentOpVolume,
  );
}

/** Ralphie or Paulie, read off the envelope rather than off the man. */
export function capoEarnerStatus(state: GameState, capoId: Id): EarnerStatus {
  const weekly = capoTributeEstimate(state, capoId);
  if (weekly >= TRIBUTE.topEarnerWeeklyThreshold) return 'top_earner';
  if (weekly < TRIBUTE.deadWeightWeeklyThreshold) return 'dead_weight';
  return 'steady_earner';
}

export interface EarnerRow {
  capoId: Id;
  name: string;
  status: EarnerStatus;
  weeklyEstimate: number;
  totalTributePaid: number;
}

/** The board the boss actually reads. Best earner first. */
export function capoTributeLeaderboard(state: GameState): EarnerRow[] {
  const history = tributeState(state).history;
  return activeCapos(state)
    .map((capo) => ({
      capoId: capo.id,
      name: capo.name,
      status: capoEarnerStatus(state, capo.id),
      weeklyEstimate: capoTributeEstimate(state, capo.id),
      totalTributePaid: history
        .filter((r) => r.capoId === capo.id)
        .reduce((sum, r) => sum + r.paid, 0),
    }))
    .sort((a, b) => b.weeklyEstimate - a.weeklyEstimate);
}

/** Light envelopes waiting on an answer. */
export function pendingEnvelopes(state: GameState): LightEnvelopeDilemma[] {
  return tributeState(state).pendingDilemmas;
}

/*
   What he says when it is short.

   `say()`, never the causal stream — this only picks which true sentence to
   show for a shortage that has already been rolled. See `util.ts`'s own note
   on why a prose variant drawing from `rng` makes every probe in the project
   unreproducible.
*/
const EXCUSES = [
  'Two of the spots got hit this month. It comes back next week.',
  'One of my guys is in the hospital. I covered his end out of mine.',
  'The union stewards wanted more. What was I supposed to tell them?',
  'It was a bad month on the street. Everybody had a bad month.',
  'I had to put a lawyer on retainer for one of my nephews.',
];

const flagFor = (capoId: Id) => `light_envelope_day_${capoId}`;

/**
 * Payday, once a week.
 *
 * Runs on the same seven-day cadence as the rest of the weekly book and
 * returns immediately on every other day, so the caller in `clock.ts` does
 * not need to know the interval.
 */
export function tickWeeklyTribute(state: GameState, rng: Rng): void {
  if (state.day % 7 !== 0) return;
  const book = tributeState(state);

  for (const capo of activeCapos(state)) {
    const expected = capoTributeEstimate(state, capo.id);
    if (expected <= 0) continue;

    /*
       One open question per man at a time.

       An envelope already sitting unanswered is the decision the player
       still owes; a second one from the same capo would stack two versions
       of the same choice and let a shortage compound while nobody looked at
       it. He pays in full this week, and last week's envelope is still the
       thing on the desk.
    */
    const alreadyAsking = book.pendingDilemmas.some((d) => d.capoId === capo.id);
    const cooled =
      state.day - (state.flags[flagFor(capo.id)] ?? -9999) >= TRIBUTE.lightEnvelopeCooldownDays;
    // A man who is actually skimming is short every week, cooldown or not —
    // see `lightEnvelopeCooldownDays`. The honest capo's bad month is rare.
    const light =
      !alreadyAsking &&
      (capo.isSkimming || (cooled && rng.chance(TRIBUTE.lightEnvelopeBaseChance)));

    if (!light) {
      earnDirty(state, expected, 'jobs');
      book.history.push({
        capoId: capo.id,
        day: state.day,
        expected,
        paid: expected,
        shortage: 0,
        status: 'paid',
      });
      continue;
    }

    const shortage = Math.round(
      expected * rng.float(TRIBUTE.lightShortageFraction[0], TRIBUTE.lightShortageFraction[1]),
    );
    const offered = expected - shortage;
    earnDirty(state, offered, 'jobs');
    state.flags[flagFor(capo.id)] = state.day;

    book.pendingDilemmas.push({
      id: nextId(state, 'env'),
      capoId: capo.id,
      capoName: capo.name,
      expected,
      offered,
      shortage,
      excuse: say(`envelope:${capo.id}`, state.day, EXCUSES),
      day: state.day,
    });
    addLog(
      state,
      `${capo.name} delivered a light envelope ($${shortage.toLocaleString('en-US')} short).`,
      'money',
    );
  }
}

export type EnvelopeChoice = 'let_it_slide' | 'squeeze' | 'audit';

/**
 * The answer, and what it costs.
 *
 * Every branch writes a `TributeRecord` against the same `expected` the
 * envelope was measured on, with a `paid` that is what the family ended up
 * holding — so a squeezed week reads "short, then collected in full" rather
 * than pretending the envelope was never light.
 */
export function resolveLightEnvelope(
  state: GameState,
  capoId: string,
  choice: EnvelopeChoice,
): { ok: boolean; message: string } {
  const book = tributeState(state);
  const at = book.pendingDilemmas.findIndex((d) => d.capoId === capoId);
  if (at < 0) return { ok: false, message: 'Nobody is short this week.' };
  const dilemma = book.pendingDilemmas[at];
  const capo = state.npcs[capoId];
  if (!capo) return { ok: false, message: 'No such person.' };

  // The audit is the one answer that can be refused, and it is refused for
  // money. Checked before the dilemma leaves the list, so a boss who cannot
  // pay for it still has the decision in front of him.
  if (choice === 'audit' && !spend(state, TRIBUTE.auditCost, 'world')) {
    return { ok: false, message: 'You cannot cover what it costs to have him looked at.' };
  }
  book.pendingDilemmas.splice(at, 1);

  const record: TributeRecord = {
    capoId,
    day: state.day,
    expected: dilemma.expected,
    paid: dilemma.offered,
    shortage: dilemma.shortage,
    status: 'slid',
  };
  let message: string;

  if (choice === 'let_it_slide') {
    gainRespect(state, -TRIBUTE.letSlideRespectHit);
    capo.stats.loyalty = clamp(capo.stats.loyalty + TRIBUTE.letSlideLoyaltyBonus, 0, 100);
    addNote(capo, state.day, 'Came up short and the boss let it go.', 'good');
    message = `You told ${capo.name} it was fine. He will remember that, and so will everybody who heard.`;
  } else if (choice === 'squeeze') {
    earnDirty(state, dilemma.shortage, 'jobs');
    record.paid = dilemma.expected;
    record.status = 'squeezed';
    capo.stats.grievance = clamp(capo.stats.grievance + TRIBUTE.squeezeGrievance, 0, 100);
    capo.stats.loyalty = clamp(capo.stats.loyalty + TRIBUTE.squeezeLoyaltyHit, 0, 100);
    addNote(capo, state.day, 'Made to find the rest of the envelope.', 'bad');
    message = `${capo.name} found the rest of it. He did not enjoy finding it.`;
  } else if (capo.isSkimming) {
    // Caught. The recovery is double the shortage, because what he was short
    // this week is not what he has been taking.
    const recovered = dilemma.shortage * 2;
    earnDirty(state, recovered, 'jobs');
    record.paid = dilemma.offered + recovered;
    record.status = 'audited_guilty';
    capo.isSkimming = false;
    capo.stats.grievance = clamp(capo.stats.grievance + 15, 0, 100);
    addNote(capo, state.day, 'His books were looked at. They did not balance.', 'bad');
    message = `He was taking it. $${recovered.toLocaleString('en-US')} came back, and he knows you know.`;
  } else {
    // He was telling the truth, and being counted anyway is the insult.
    record.status = 'audited_clean';
    capo.stats.loyalty = clamp(capo.stats.loyalty - 15, 0, 100);
    capo.stats.grievance = clamp(capo.stats.grievance + 20, 0, 100);
    addNote(capo, state.day, 'His books were looked at. They balanced.', 'bad');
    message = `${capo.name}'s books were clean. He is not going to forget being counted.`;
  }

  book.history.push(record);
  addLog(state, message, 'crew');
  return { ok: true, message };
}

// ------------------------------------------------------------ insulation ---

/**
 * Whether anybody is actually listening.
 *
 * The same two facts `investigation.ts` reads before a wire hears anything —
 * a confidant talking where she should not, and a case far enough along to
 * have a van outside. Read here rather than re-derived so the two cannot
 * drift: insulation failing and the wire hearing are meant to be one event.
 */
export function wireIsLive(state: GameState): boolean {
  if (!confidantIsExposed(state)) return false;
  return activeCases(state).some((c) => stageIndex(c.stage) >= stageIndex('surveillance'));
}

/**
 * What a job the boss never touched leaves behind, and where it stops.
 *
 * This is the whole reason a boss delegates. A crew that went out on its own
 * account leaves a trail that ends at the capo — the traces the night
 * produced are struck from the family's file and land as a line on his sheet
 * instead, which is what a prosecutor means by having nobody above the man
 * they arrested.
 *
 * Unless somebody is already listening. A live wire hears the boss being told
 * about it, and at that point the distance he paid for does not exist.
 *
 * `before` is the set of trace ids that existed before the night resolved, so
 * this strikes exactly what the night added and nothing that was already in
 * the file.
 */
export function insulateCommand(state: GameState, capo: Npc, before: Set<Id>): void {
  if (wireIsLive(state)) {
    addNote(capo, state.day, 'A job of his went wrong, and somebody was listening.', 'bad');
    return;
  }
  let struck = 0;
  for (const id of Object.keys(state.evidence)) {
    if (before.has(id)) continue;
    delete state.evidence[id];
    struck += 1;
  }
  if (struck === 0) return;
  addNote(
    capo,
    state.day,
    'A job of his went wrong. Whatever it left behind stops with him.',
    'bad',
  );
}

// ------------------------------------------------------- signature covers ---

/**
 * The two places this world is actually known for, and the only way in.
 *
 * `SPECIAL_VENTURES` is kept out of `BUSINESSES` so the catalogue invariants
 * hold, so neither of them can be reached through `canAcquire` — the buy table
 * walks the catalogue and these are not in it. This is the route instead, and
 * it is deliberately not a discount version of the ordinary one: no district
 * to choose, no slot auction, no negotiation, and it is paid for in clean
 * money because the entire point of both places is that they are legitimate on
 * paper. A boss who has only ever earned dirty cannot buy his way onto a
 * payroll, which is the correct answer.
 */
export { hasSpecialVenture };

/** The venture by id, or undefined. Exported shape kept narrow on purpose. */
function ventureDef(ventureId: string) {
  return SPECIAL_VENTURES.find((v) => v.id === ventureId);
}

/**
 * Whether it can be bought, and if not, what would lift the refusal.
 *
 * Rule 4: every branch names the thing standing in the way and the figure
 * that clears it. "Not available" is the refusal this project keeps finding
 * and deleting.
 */
export function canAcquireSpecialVenture(
  state: GameState,
  ventureId: string,
): { ok: boolean; reason?: string } {
  const venture = ventureDef(ventureId);
  if (!venture) return { ok: false, reason: 'No such place.' };
  if (hasSpecialVenture(state, ventureId)) {
    return { ok: false, reason: `${venture.name} is already yours.` };
  }

  const held = rankNow(state);
  const wanted = RANKS[rankIndex(VENTURE_PERKS.minRank)];
  if (rankIndex(held.id) < rankIndex(VENTURE_PERKS.minRank)) {
    return {
      ok: false,
      reason:
        `Nobody puts an outfit on a legitimate payroll as a consultant until it has weight. ` +
        `Yours is "${held.name}"; the conversation starts at "${wanted.name}".`,
    };
  }

  if (state.org.cash < venture.cost) {
    return {
      ok: false,
      reason:
        `${formatMoney(venture.cost)} in clean money, and you have ${formatMoney(state.org.cash)}. ` +
        `Dirty cash cannot buy a name on a door — wash ${formatMoney(venture.cost - state.org.cash)} more first.`,
    };
  }
  return { ok: true };
}

/**
 * Buy it. The front that comes out is an ordinary operating business in every
 * respect the rest of the sim can see — it ticks, ages, earns and can be
 * shuttered through the same code — which is what `businessDef` exists to
 * make true. What is not ordinary is the perk, and each of those is
 * implemented at the one funnel it belongs to rather than here.
 */
export function acquireSpecialVenture(
  state: GameState,
  ventureId: string,
): { ok: boolean; message: string } {
  const can = canAcquireSpecialVenture(state, ventureId);
  if (!can.ok) return { ok: false, message: can.reason ?? 'No.' };
  const venture = ventureDef(ventureId)!;

  state.org.cash -= venture.cost;
  note(state, 'premises', -venture.cost);

  /*
     Home, because both of them are about a neighbourhood rather than a market.
     The pork store's perk reads `HOME_TERRITORY` directly and the transfer
     station's does not care where it stands, so there is nothing for a
     district picker to decide — and a control that asks a question with only
     one answer is a click that does nothing.
  */
  const business: Business = {
    id: nextId(state, 'biz'),
    defId: venture.id,
    territoryId: HOME_TERRITORY,
    purchasedDay: state.day,
    exposure: 0,
    health: HEALTH.start,
    revenueTotal: 0,
    launderedTotal: 0,
    lastLaundered: 0,
    status: 'operating',
  };
  state.businesses[business.id] = business;
  state.territories[HOME_TERRITORY].businessIds.push(business.id);

  const message = `${venture.name} is yours. ${formatMoney(venture.cost)} of clean money, and your name is on the door.`;
  addLog(state, message, 'money');
  return { ok: true, message };
}
