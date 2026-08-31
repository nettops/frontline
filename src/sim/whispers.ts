/**
 * What reaches you, and how sure whoever brought it is.
 *
 * The design note is in `config/whispers.ts`. The mechanics that matter:
 *
 * **Every whisper is generated from real state**, so the supply is the
 * simulation rather than a list somebody wrote. Round 14 met one new memo
 * between day 180 and day 300.
 *
 * **A whisper can be wrong**, and the truth of it is stored and never shown.
 * `beliefs.ts` already does this for the other families — they blame whoever
 * they find plausible and are sometimes mistaken — and this is the same
 * mechanic pointed the other way. A feed of true statements with a percentage
 * beside each is a stats panel; a feed you have to decide about is not.
 *
 * **Corroboration is the only honest way to tell.** A second whisper about the
 * same subject hardens the first, which makes waiting a strategy and makes
 * acting early a risk. Nothing else in here will ever tell the player they
 * were right.
 *
 * **And none of it touches the main random stream.** The first version took an
 * `Rng` and rolled against it every week, which reshuffled every later call in
 * the simulation and broke two unrelated tests the moment it was wired in —
 * both about operations, neither about whispers. That is not a test problem.
 * A system that only *reports* on the world must not be able to change what
 * happens in it, which is the rule `trace.ts` states for itself in two places.
 *
 * So the draw is `Rng.stableNoise`, keyed on the day and the world's seed:
 * deterministic, reproducible, and invisible to everything downstream. The
 * same rule `perceive` follows for exactly the same reason.
 */

import { Rng, clamp } from './rng';
import { crewList } from './npc';
import { territoryList, territoryDef, playerInfluence } from './territory';
import { houseShort } from './houses';
import { weightedPick } from './util';
import { WHISPERS, WHISPER_KINDS, WHISPER_CONFIDENCE_LABEL } from '../config/whispers';
import { RIVAL_IDS } from '../config/factions';
import type { GameState, Whisper } from './types';
import { canSpendFavour, figure } from './civic';
import { addLog } from './util';
import { LOOK_INTO } from '../config/whispers';

/** Lazily created, so a save written before this existed still loads. */
function feed(state: GameState): Whisper[] {
  if (!state.whispers) state.whispers = [];
  return state.whispers;
}

/**
 * A subject the whisper is about, and whether the claim is actually true.
 *
 * Each branch picks a real subject and then decides truth separately, so a
 * false whisper names somebody who exists rather than somebody invented. That
 * is what makes it hurt: the wrong man is a real man.
 */
function compose(
  state: GameState,
  roll: (n: number) => number,
  kind: string,
): { text: string; subject: string; truth: boolean } | null {
  const alive = crewList(state).filter((n) => n.status !== 'dead' && n.status !== 'defected');
  const def = WHISPER_KINDS.find((k) => k.kind === kind);
  if (!def) return null;
  const wrong = roll(1) < def.wrongChance;

  /** Pick without touching the causal stream. */
  const one = <T>(items: readonly T[], salt: number): T =>
    items[Math.min(items.length - 1, Math.floor(roll(salt) * items.length))];

  switch (kind) {
    case 'somebody_talking': {
      if (alive.length === 0) return null;
      const talkers = alive.filter((n) => n.informingSince !== undefined);
      // A true whisper names somebody who is actually talking. A false one
      // names anybody else, which is the entire cruelty of the mechanic.
      const pool = wrong || talkers.length === 0 ? alive.filter((n) => n.informingSince === undefined) : talkers;
      if (pool.length === 0) return null;
      const who = one(pool, 2);
      return {
        text: `Somebody says ${who.name} has been seen where they had no reason to be.`,
        subject: who.id,
        truth: who.informingSince !== undefined,
      };
    }

    case 'losing_somebody': {
      if (alive.length === 0) return null;
      const unhappy = alive.filter((n) => n.stats.loyalty < 35 || n.stats.grievance > 55);
      const pool = wrong || unhappy.length === 0 ? alive : unhappy;
      const who = one(pool, 3);
      return {
        text: `${who.name} has been asked how things are, and did not say fine.`,
        subject: who.id,
        truth: who.stats.loyalty < 35 || who.stats.grievance > 55,
      };
    }

    case 'they_are_building': {
      const open = Object.values(state.law.investigations).filter((i) => i.status === 'open');
      if (open.length === 0 && !wrong) return null;
      const real = open.length > 0;
      return {
        text: real && !wrong
          ? `Somebody downtown has been pulling paper on you. It is not a routine file.`
          : `Word is a file is being opened on you. Nobody can say which desk.`,
        subject: 'law',
        truth: real,
      };
    }

    case 'they_want_the_ground': {
      const mine = territoryList(state).filter((t) => playerInfluence(t) >= 20);
      if (mine.length === 0) return null;
      const t = one(mine, 4);
      const rival = one(RIVAL_IDS, 5);
      const contested = (t.influence[rival] ?? 0) > 15;
      return {
        text: `They are saying the ${houseShort(state, rival)} have been counting doors in ${territoryDef(t.id).name}.`,
        subject: `${t.id}:${rival}`,
        truth: contested && !wrong,
      };
    }

    case 'skimming': {
      const earners = alive.filter((n) => n.role !== 'associate');
      if (earners.length === 0) return null;
      const greedy = earners.filter((n) => n.stats.greed > 60);
      const pool = wrong || greedy.length === 0 ? earners : greedy;
      const who = one(pool, 6);
      return {
        text: `The take from ${who.name} does not match what the street says it should be.`,
        subject: who.id,
        truth: who.stats.greed > 60,
      };
    }
  }
  return null;
}

/**
 * A week of somebody bringing you something, sometimes.
 *
 * Corroboration is applied before the new item is stored, so a second whisper
 * about the same subject hardens the existing one instead of stacking a
 * duplicate onto the feed.
 */
export function tickWhispers(state: GameState): void {
  if (state.day % WHISPERS.intervalDays !== 0) return;

  /*
     Keyed on the day and the world's seed, so the feed is reproducible for a
     given world and identical whether the day is replayed or not — and costs
     the causal stream nothing.
  */
  const roll = (salt: number) => Rng.stableNoise(`whisper:${state.rng.seed}:${state.day}`, salt);

  if (roll(0) >= WHISPERS.chancePerInterval) return;

  // `weightedPick` returns the item itself, so the defs go in directly.
  const picked = weightedPick(WHISPER_KINDS, roll(7));
  if (!picked) return;
  const kind = picked.kind;

  const made = compose(state, roll, kind);
  if (!made) return;

  const list = feed(state);
  const already = list.find((w) => w.subject === made.subject && w.kind === kind);
  if (already) {
    already.confidence = clamp(already.confidence + WHISPERS.corroboration, 0, 1);
    already.day = state.day;
    already.corroborated = true;
    return;
  }

  const [lo, hi] = made.truth ? WHISPERS.confidenceWhenTrue : WHISPERS.confidenceWhenWrong;
  list.unshift({
    id: `${state.day}:${kind}:${made.subject}`,
    day: state.day,
    kind,
    text: made.text,
    subject: made.subject,
    confidence: lo + roll(8) * (hi - lo),
    truth: made.truth,
    corroborated: false,
  });
  if (list.length > WHISPERS.kept) list.length = WHISPERS.kept;
}

export interface WhisperRead {
  /** Handle for a follow-up. Derived for a feed written before this existed. */
  id: string;
  day: number;
  text: string;
  /**
   * Who or what it is about, as an id.
   *
   * Not a leak: the name is in `text` already, and this is only here so a
   * consumer can find the person rather than parse the sentence. `truth` is
   * the field that must never appear on this interface, and the test for that
   * checks the *shape* of the read rather than a list of allowed fields,
   * precisely so adding this one cannot quietly turn into adding that one.
   */
  subject: string;
  /** 0..100, said as a number because how sure somebody is can be stated. */
  confidence: number;
  /** The phrase for that number, for anybody who does not read percentages. */
  certainty: string;
  corroborated: boolean;
}

/**
 * The feed, as the player sees it.
 *
 * `truth` is not on this interface and must never be. The whole mechanic is
 * that the player decides without knowing, and a read that leaked it would
 * turn the system into a to-do list.
 */
export function readWhispers(state: GameState): WhisperRead[] {
  return feed(state)
    .filter((w) => state.day - w.day <= WHISPERS.staleAfterDays)
    .map((w) => ({
      id: whisperId(w),
      day: w.day,
      text: w.text,
      subject: w.subject,
      confidence: Math.round(w.confidence * 100),
      certainty:
        WHISPER_CONFIDENCE_LABEL.find(([bar]) => w.confidence >= bar)?.[1] ?? 'They are guessing',
      corroborated: w.corroborated,
      checkedBy: w.checkedBy ?? [],
    }));
}

/**
 * The handle for a whisper, including the ones written before handles existed.
 *
 * Derived rather than assigned on load, so nothing has to migrate a save and
 * an old feed is addressable the moment the panel offers a button. The shape
 * matches what `tickWhispers` assigns, so an old whisper and a new one about
 * the same thing on the same day would collide — which they cannot, because
 * `tickWhispers` corroborates an existing subject rather than adding a second.
 */
export function whisperId(w: Whisper): string {
  return w.id ?? `${w.day}:${w.kind}:${w.subject}`;
}

export interface LookCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Whether this contact would go and find out about this rumour.
 *
 * Three gates and each names its own refusal, which is the rule
 * `refusals.test.ts` enforces and F10 was four rounds of the game breaking.
 */
export function canLookInto(state: GameState, id: string, contactId: string): LookCheck {
  const w = feed(state).find((x) => whisperId(x) === id);
  if (!w) return { ok: false, reason: 'Nothing by that description.' };
  if (state.day - w.day > LOOK_INTO.worthCheckingWithin) {
    return {
      ok: false,
      reason:
        `That is ${state.day - w.day} days old and nothing over ` +
        `${LOOK_INTO.worthCheckingWithin} is worth a favour. Whatever it was about ` +
        `has happened or has not.`,
    };
  }
  if ((w.checkedBy ?? []).includes(contactId)) {
    return { ok: false, reason: 'They have already told you what they think.' };
  }
  const favour = canSpendFavour(state, contactId);
  if (!favour.ok) return { ok: false, reason: favour.reason };
  return { ok: true };
}

export interface LookResult {
  ok: boolean;
  message: string;
  /** What came back, or null if nothing did. Never says whether it is so. */
  agreed: boolean | null;
}

/**
 * Send somebody to find out, and get an opinion rather than an answer.
 *
 * The contact is right `LOOK_INTO.contactIsRight` of the time, which is the
 * point: this is a second source, and this game's information is fallible on
 * the way in — `wrongChance` is the whole reason the feed is interesting — so
 * making it infallible on the way back would delete the mechanic in order to
 * add a button to it.
 *
 * `truth` is read here and never returned, exactly as `readWhispers` refuses
 * to carry it. What the player gets is the confidence moving and a sentence.
 *
 * **The draw is `stableNoise`, not the causal stream**, for the reason stated
 * at the top of this file — and for a second one that turns out to matter
 * more. Keyed on the whisper, the contact and the day, the answer is fixed
 * for that combination: a player cannot re-roll by asking the same person
 * twice in an afternoon, and asking somebody *else* is a genuinely different
 * question rather than another go at the same one.
 */
export function lookInto(state: GameState, id: string, contactId: string): LookResult {
  const guard = canLookInto(state, id, contactId);
  if (!guard.ok) return { ok: false, message: guard.reason ?? 'No.', agreed: null };

  const w = feed(state).find((x) => whisperId(x) === id)!;

  /*
     The favour is spent, and their signature move is not performed.

     `spendFavour` runs the thing that figure is *for* — a case cooled, a
     licence found, a word put in. Calling it here would answer a question and
     cool a case in the same breath, which is not what the player asked for and
     is a second effect they did not choose. So this takes the currency through
     the same gates and then does its own thing with it, which is what asking
     somebody a question actually is.
  */
  figure(state, contactId).owed -= 1;

  const roll = Rng.stableNoise(`look:${state.rng.seed}:${id}:${contactId}`, state.day);
  const rightThisTime = roll < LOOK_INTO.contactIsRight;
  // What they come back saying. Agreement with the rumour, not with the world.
  const agreed = rightThisTime ? w.truth : !w.truth;

  w.checkedBy = [...(w.checkedBy ?? []), contactId];
  w.confidence = clamp(
    w.confidence + (agreed ? LOOK_INTO.agreesConfidence : LOOK_INTO.disagreesConfidence),
    0,
    1,
  );
  if (agreed) w.corroborated = true;

  const message = agreed
    ? 'They went and asked. What came back matches what you had heard.'
    : 'They went and asked, and came back with nothing that supports it.';
  addLog(state, message, 'crew');
  return { ok: true, message, agreed };
}
