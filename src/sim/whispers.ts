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
  day: number;
  text: string;
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
      day: w.day,
      text: w.text,
      confidence: Math.round(w.confidence * 100),
      certainty:
        WHISPER_CONFIDENCE_LABEL.find(([bar]) => w.confidence >= bar)?.[1] ?? 'They are guessing',
      corroborated: w.corroborated,
    }));
}
