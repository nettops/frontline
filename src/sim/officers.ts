/**
 * What the Underboss and the Consigliere make of the family under them.
 *
 * `promote()` in `crew.ts` already walks any `Npc` up through `ROLE_ORDER` —
 * reaching either seat needs nothing new. What neither seat has ever had is
 * an opinion of its own: a boss reading his crew sheet sees the same numbers
 * whether his Underboss trusts a given capo or has been quietly resentful of
 * him for a year. This file is that opinion.
 *
 * The read is never about the capo. `ties.ts` already gives every pair in
 * this game two people's worth of history, and an officer describing a man
 * to the boss is describing that history through his own temperament, not
 * reporting a fact — a distrustful, ambitious Underboss and a loyal one read
 * the identical tie differently, which is the whole point of asking either of
 * them rather than looking the capo up yourself. Nothing here touches the
 * capo's own hidden stats: the bias comes entirely from the officer's tie to
 * him and the officer's own numbers, so there is nothing to smuggle past
 * `perceive()`.
 *
 * Kept as one shared mechanism (`biasedTier`) behind two named entry points
 * rather than either a single parameterised function or two independent
 * ones — the brief asked either was fine. Two names because the callers this
 * scaffolds for will always know which seat they are asking (a UI panel for
 * "what does your Underboss think" is a different button from "what does
 * your Consigliere think"), and because the two roles read for different
 * reasons — rivalry for the Underboss, an axe of his own for the Consigliere
 * — which a single generic `officerRead(state, role, id)` would flatten into
 * one voice. One helper because the mechanics underneath are identical.
 *
 * No new stored state: everything read here already exists (`ties.ts`,
 * `Npc.stats`, `Npc.reportsTo`, `Npc.daysInCrew`, `Npc.familiarity`), the same
 * standard `capoVouches.ts`'s `voucherMistakeCount` sets for this codebase.
 */

import type { GameState, Id, Npc, NpcStatId } from './types';
import { crewList, perceive } from './npc';
import { say } from './util';
import { clamp } from './rng';
import { GOAL_CERTAIN_ABOVE } from '../config/goals';

/**
 * The one Underboss or Consigliere currently in the organization, if any.
 * Exported for `events.ts`'s `capo_political_tension`, which asks the
 * identical "is there one, and who" question before deciding whether the
 * Underboss fields a capo's complaint quietly.
 */
export function currentOfficer(state: GameState, role: 'underboss' | 'consigliere'): Npc | null {
  return crewList(state).find((n) => n.role === role) ?? null;
}

/**
 * How far the officer's own tie to the subject pulled toward praise or
 * grudge, folded together with how much his own temperament tips a read of
 * anybody in that direction — into one 0..4 band, the same scale `perceive`
 * already bands a stat estimate onto.
 *
 * No tie at all reads as the officer's temperament alone: a man he has never
 * had cause to notice is not a blank, he is read the way this particular
 * officer reads people he has no history with yet.
 */
function biasedTier(officer: Npc, subjectId: Id, biasStatId: NpcStatId): number {
  const tie = officer.ties.find((t) => t.id === subjectId);
  const lean = tie ? tie.trust - tie.resentment : 0; // -100..100
  // Higher ambition (Underboss) or grievance (Consigliere) pulls a read of
  // anybody darker — a man already looking for a reason not to trust the
  // room does not need one from the tie itself.
  const bias = officer.stats[biasStatId]; // 0..100, centred on 50
  const score = clamp(50 + lean / 2 - (bias - 50) * OFFICER_BIAS_PULL, 0, 100);
  return clamp(Math.floor(score / 20), 0, 4);
}

/** How much of a pull the officer's own number gets against the tie itself. */
const OFFICER_BIAS_PULL = 0.5;

export interface OfficerRead {
  /** The phrase. Never the numbers behind it. */
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

function toneOf(tier: number): OfficerRead['tone'] {
  return tier <= 1 ? 'bad' : tier >= 3 ? 'good' : 'neutral';
}

const UNDERBOSS_OPINION_LINES: ((boss: string, subject: string) => string[])[] = [
  (boss, subject) => [
    `${boss} doesn't trust ${subject} as far as he can throw him.`,
    `${boss} thinks ${subject} is angling for more than his cut.`,
  ],
  (boss, subject) => [
    `${boss} keeps half an eye on ${subject}.`,
    `${boss} isn't sure ${subject} is really with him.`,
  ],
  (boss, subject) => [
    `${boss} doesn't say much about ${subject} either way.`,
    `${boss} has no strong read on ${subject}.`,
  ],
  (boss, subject) => [
    `${boss} rates ${subject} — says he pulls his weight.`,
    `${boss} speaks well of ${subject}, for what that is worth.`,
  ],
  (boss, subject) => [
    `${boss} would put ${subject} up for anything.`,
    `${boss} calls ${subject} the only one of the crew he would trust with his own neck.`,
  ],
];

/**
 * What the Underboss thinks of a specific man — most often a capo he either
 * competes with for the boss's attention or leans on to keep the crew quiet.
 * Biased by his own ambition: a man already reaching for more sees a rival
 * where a secure one sees an asset, off the identical tie. `null` when there
 * is no Underboss to ask, or no such man to ask about.
 */
export function underbossOpinion(state: GameState, aboutNpcId: Id): OfficerRead | null {
  const boss = currentOfficer(state, 'underboss');
  if (!boss) return null;
  const subject = state.npcs[aboutNpcId];
  if (!subject || subject.id === boss.id) return null;

  const tier = biasedTier(boss, aboutNpcId, 'ambition');
  return {
    tone: toneOf(tier),
    text: say(
      `underbossOpinion:${boss.id}:${aboutNpcId}`,
      0,
      UNDERBOSS_OPINION_LINES[tier](boss.name, subject.name),
    ),
  };
}

const CONSIGLIERE_OPINION_LINES: ((advisor: string, subject: string) => string[])[] = [
  (advisor, subject) => [
    `${advisor} doesn't think ${subject} has been straight with you.`,
    `${advisor} would think twice before handing ${subject} anything nobody could watch.`,
  ],
  (advisor, subject) => [
    `${advisor} isn't convinced by ${subject} yet.`,
    `${advisor} calls ${subject} an open question.`,
  ],
  (advisor, subject) => [
    `${advisor} has nothing particular to say about ${subject}.`,
    `${advisor} reads ${subject} as ordinary — neither a risk nor an asset.`,
  ],
  (advisor, subject) => [
    `${advisor} thinks ${subject} is reliable.`,
    `${advisor} would back ${subject}'s judgment on most things.`,
  ],
  (advisor, subject) => [
    `${advisor} trusts ${subject} completely.`,
    `${advisor} calls ${subject} the steadiest man in the family.`,
  ],
];

/**
 * What the Consigliere thinks of a specific man. Same mechanism as
 * `underbossOpinion`, biased by the Consigliere's own grievance rather than
 * ambition — his exaggeration, where it happens, comes from an axe of his
 * own rather than a rivalry for territory. `null` with no Consigliere, or no
 * such man.
 */
export function consiglierRead(state: GameState, aboutNpcId: Id): OfficerRead | null {
  const advisor = currentOfficer(state, 'consigliere');
  if (!advisor) return null;
  const subject = state.npcs[aboutNpcId];
  if (!subject || subject.id === advisor.id) return null;

  const tier = biasedTier(advisor, aboutNpcId, 'grievance');
  return {
    tone: toneOf(tier),
    text: say(
      `consiglierRead:${advisor.id}:${aboutNpcId}`,
      0,
      CONSIGLIERE_OPINION_LINES[tier](advisor.name, subject.name),
    ),
  };
}

// -------------------------------------------------------------- standing ---

/** How many men, made or not, actually answer to this one. */
function reportCount(state: GameState, officerId: Id): number {
  return crewList(state).filter((n) => n.reportsTo === officerId).length;
}

/**
 * How many times this Underboss has actually fielded a capo's political
 * tension quietly rather than merely holding the title — see `events.ts`'s
 * `underbossFields`, the one place that writes `handled_it_quietly`. Derived
 * from the memory array rather than stored, the same discipline
 * `capoVouches.ts`'s `voucherMistakeCount` uses for an identical count.
 */
function handledQuietlyCount(officer: Npc): number {
  return officer.memories.filter((m) => m.kind === 'handled_it_quietly').length;
}

/**
 * Long enough in the seat that "runs a real room" is a pattern rather than a
 * lucky quarter. No existing constant means this, so it is its own number —
 * a Phase-0 placeholder a later pass can size against a probe once this read
 * has a caller that puts it on screen.
 */
const SEATED_TENURE_DAYS = 180;

/** Enough men answering to him that it reads as a room, not a title. */
const REAL_ROOM_REPORTS = 3;

/**
 * Enough real problems actually handled that it reads as a track record
 * rather than one lucky night — same Phase-1-style placeholder status as
 * `REAL_ROOM_REPORTS` and `SEATED_TENURE_DAYS` above: no probe has sized it,
 * because no caller put this on screen before this pass.
 */
const HANDLED_QUIETLY_ENOUGH = 3;

export interface OfficerStanding {
  /** 0..5. Never shown — the text is the read; this is what tests check. */
  tier: number;
  text: string;
}

/*
   Design brief §10: an Underboss who has actually accumulated real
   organizational influence — problems handled, a room he runs, tenure in the
   seat — eventually becomes something the Boss has to think about, not just
   a good outcome. Tier 5 is that "not just a good outcome" case: it only
   fires once several of those signals stack (see `underbossStanding` below),
   never off headcount or tenure alone. `capoStanding.ts`'s own top tier
   ("making enough money that people don't need to come to you anymore") is
   the model for the voice; this is that same warning one rung up.
*/
const UNDERBOSS_STANDING_LINES: ((name: string, reports: number) => string[])[] = [
  (name) => [`${name} holds the title and not much more — nobody routes through him, and it shows.`],
  (name, reports) =>
    reports > 0
      ? [`${name} is respected without really being obeyed. ${reports} answer to him on paper.`]
      : [`${name} is respected without really being obeyed. Nobody answers to him yet.`],
  (name, reports) => [`${name} runs a real room — ${reports} of the crew answer to him, and mostly listen.`],
  (name, reports) => [`${name} is the second boss in everything but name. ${reports} take their orders from him first.`],
  (name) => [`${name} is who this family actually runs through. Nobody moves without him hearing about it.`],
  (name, reports) => [
    `${name} has become extremely powerful. The organization runs through him now, not you.`,
    reports > 0
      ? `Nobody comes to you first anymore. ${reports} of the crew go to ${name}, and you hear about it after.`
      : `Nobody comes to you first anymore. They go to ${name}, and you hear about it after.`,
    `${name} isn't waiting on you for anything at this point. He has his own room, and it listens to him.`,
  ],
];

/**
 * The Underboss's own standing, read the way `perceivedLeadership` reads the
 * player's: four real signals — his own perceived leadership, how many of
 * the crew actually route through him via `reportsTo`, how long he has held
 * the seat, and how many times he has actually handled something real
 * (`handledQuietlyCount`) — into one verdict, gated behind the same
 * certainty line `perceivedLeadership` gates on. `null` with no Underboss,
 * or before the player knows him well enough to have a read at all.
 */
export function underbossStanding(state: GameState): OfficerStanding | null {
  const boss = currentOfficer(state, 'underboss');
  if (!boss) return null;
  if (boss.familiarity < GOAL_CERTAIN_ABOVE) return null;

  const leadership = perceive(boss, 'leadership');
  const reports = reportCount(state, boss.id);
  const tier = clamp(
    leadership.bandIndex +
      (reports >= REAL_ROOM_REPORTS ? 1 : 0) +
      (boss.daysInCrew >= SEATED_TENURE_DAYS ? 1 : 0) +
      (handledQuietlyCount(boss) >= HANDLED_QUIETLY_ENOUGH ? 1 : 0),
    0,
    UNDERBOSS_STANDING_LINES.length - 1,
  );

  return {
    tier,
    text: say(`underbossStanding:${boss.id}`, 0, UNDERBOSS_STANDING_LINES[tier](boss.name, reports)),
  };
}
