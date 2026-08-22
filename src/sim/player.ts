/**
 * The player character: standing, attributes, and advancement.
 *
 * Ranks are gated on the state of the organization, not on experience points.
 * You become a Capo because you have the money, the people and the reputation
 * a Capo has — not because a bar filled up.
 */

import { clamp } from './rng';
import type { AttributeId, GameState, RankId } from './types';
import { addLog, pushEvent } from './util';
import { crewList } from './npc';
import { controlledTerritories } from './territory';
import { priced } from './market';
import { estate } from './estate';
import { ownedBusinesses } from './business';
import {
  ATTRIBUTE_LABEL,
  ATTRIBUTE_MAX,
  FEAR,
  PAYDAY_INTERVAL,
  STANDING_HELD,
  RANKS,
  RANK_BY_ID,
  attributeProgressNeeded,
  rankIndex,
} from '../config/economy';

export function rankDef(state: GameState) {
  return RANK_BY_ID[state.player.rank];
}

export function maxCrew(state: GameState): number {
  return rankDef(state).maxCrew;
}

export function gainRespect(state: GameState, amount: number): void {
  state.org.respect = Math.max(0, state.org.respect + amount);
}

/**
 * Being feared.
 *
 * The other half of what used to be one number called respect. Everything that
 * buys fear is an act of violence or the credible promise of one, and unlike
 * standing it bleeds away if you stop — a reputation for hurting people is a
 * claim, and claims expire.
 */
export function gainFear(state: GameState, amount: number): void {
  state.org.fear = clamp(state.org.fear + amount, 0, FEAR.max);
}

/** 0..1. Every consumer of fear scales its own effect off this. */
export function fearLevel(state: GameState): number {
  return clamp(state.org.fear / FEAR.max, 0, 1);
}

/**
 * Weekly. Fear fades, and while it lasts it costs you in three places at once:
 * the districts you hold, the loyalty of people who had a choice, and the
 * city's opinion of what you are.
 */
export function tickFear(state: GameState): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;
  const level = fearLevel(state);

  state.org.fear = Math.max(0, state.org.fear - FEAR.decayPerWeek);
  if (level <= 0) return;

  // A neighbourhood that is frightened of you is not a neighbourhood that
  // likes you, and businesses will not sell to people they are frightened of.
  for (const t of controlledTerritories(state)) {
    t.sentiment = clamp(t.sentiment + level * FEAR.sentimentPerWeekAtMax, 0, 100);
  }

  // Frightened people are not loyal people. They are just people who have not
  // left yet, which is a different and much worse thing to be running on.
  for (const npc of crewList(state)) {
    npc.stats.loyalty = clamp(npc.stats.loyalty + level * FEAR.loyaltyPerWeekAtMax, 0, 100);
    npc.stats.fear = clamp(npc.stats.fear + level * 0.6, 0, 100);
  }

  // What fear does to the city is a floor on its mood rather than a weekly
  // nudge — see CITY.fearFloorAtMax in config/perception.ts.
}

/**
 * Weekly. What the family holds is worth something to the people whose opinion
 * decides rank, whether or not anything happened this week.
 *
 * Deliberately separate from `tickFear` despite both being weekly and both
 * living here. Fear is a claim that expires; this is the opposite — it is the
 * slow interest on having kept something. Putting them in one function would
 * have made the next person changing either read both.
 */
export function tickStanding(state: GameState): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;

  const districts = controlledTerritories(state).length;
  const fronts = ownedBusinesses(state).length;
  if (districts === 0 && fronts === 0) return;

  gainRespect(
    state,
    districts * STANDING_HELD.perDistrictPerWeek + fronts * STANDING_HELD.perFrontPerWeek,
  );
}

/**
 * Attributes improve by doing. Progress needed per point scales with the
 * current value, so early growth is quick and mastery is a grind.
 */
export function trainAttribute(
  state: GameState,
  id: AttributeId,
  amount: number,
): void {
  const { attributes, attributeProgress } = state.player;
  if (attributes[id] >= ATTRIBUTE_MAX) return;

  attributeProgress[id] += amount;
  while (
    attributes[id] < ATTRIBUTE_MAX &&
    attributeProgress[id] >= attributeProgressNeeded(attributes[id])
  ) {
    attributeProgress[id] -= attributeProgressNeeded(attributes[id]);
    attributes[id] += 1;
    /*
       The number, not just the news.

       "Your Leadership has improved" told a playtester that something had
       happened and nothing about how much, so they could not tell a point from
       a rounding error and stopped reading the line. What it cost to get is on
       the log entry immediately above this one — the thing you just did — so
       the only piece genuinely missing was where it landed.
    */
    addLog(state, `Your ${ATTRIBUTE_LABEL[id]} has improved to ${attributes[id]}.`, 'success');
  }
}

export function nextRank(state: GameState): RankId | null {
  const idx = rankIndex(state.player.rank);
  return idx >= 0 && idx < RANKS.length - 1 ? RANKS[idx + 1].id : null;
}

export interface RankRequirement {
  /**
   * Render this as money rather than as a count.
   *
   * The panel used to decide by testing whether the label contained "Cash",
   * and the label has been `Clean money` for as long as anybody can remember —
   * so the one row that is money has been rendering as `45000 / 45000` since
   * it was written. A flag set where the row is built cannot drift from the
   * label the way a string test does.
   */
  money?: boolean;
  label: string;
  current: number;
  needed: number;
  met: boolean;  /**
   * The same measure as it stands today, where `current` is the best the
   * family has ever managed.
   *
   * Both, because the table gates on the high-water mark and the rest of the
   * game shows the live figure — so "Crew 13 / 16" sat beside "Crew 8 of 22"
   * and round 11 twice misjudged the distance to a promotion. The rule is
   * right; it was only ever stated once, in small text, and never at the point
   * of use.
   */
  now: number;
}

/** Drives the progression panel — the player can always see what is missing. */
/**
 * Keep the family's high-water marks up to date.
 *
 * Called once a day. Cheap, and it has to run every day rather than weekly
 * because the peak of anything is usually a moment rather than a Monday — a
 * balance that existed for three days between a payout and a purchase is a
 * balance the family reached.
 */
export function tickRecord(state: GameState): void {
  const now = state.org.record ?? {
    respect: 0,
    crew: 0,
    estate: 0,
    ops: 0,
    districts: 0,
    opsSeen: 0,
  };

  /*
     Operations accumulate; everything else is a peak.

     `player.opsCompleted` belongs to whoever is in the chair and is replaced
     by the successor's own count at a handover, so a plain maximum would stop
     rising the moment a boss with a long record was replaced by a soldier with
     a short one. Tracking the last value seen and adding only the increase
     makes the total belong to the family: it climbs while a boss works, and a
     handover simply starts counting the new man's contribution from zero.
  */
  const ops = state.player.opsCompleted;
  if (ops > now.opsSeen) now.ops += ops - now.opsSeen;
  now.opsSeen = ops;

  now.respect = Math.max(now.respect, Math.floor(state.org.respect));
  now.crew = Math.max(now.crew, crewList(state).length);
  now.estate = Math.max(now.estate, Math.floor(estate(state).total));
  now.districts = Math.max(now.districts, controlledTerritories(state).length);

  state.org.record = now;
}

export function rankRequirements(state: GameState): RankRequirement[] {
  const next = nextRank(state);
  if (!next) return [];
  const req = RANK_BY_ID[next].requires;
  const crew = crewList(state).length;

  /*
     Measured against the best the family has ever done, not today's figure.

     A rung once earned stays earned, through a handover and through a bad
     year. The organization is the thing climbing; the boss is whoever is
     holding it at the time.
  */
  const best = state.org.record;
  const ever = (nowValue: number, recorded: number | undefined) =>
    Math.max(nowValue, recorded ?? 0);

  const rows: RankRequirement[] = [
    {
      label: 'Respect',
      current: ever(Math.floor(state.org.respect), best?.respect),
      now: Math.floor(state.org.respect),
      needed: req.respect,
      met: false,
    },
    { label: 'Crew', current: ever(crew, best?.crew), now: crew, needed: req.crew, met: false },
    {
      // The estate, not the wallet. A family builds a restaurant on one street
      // and an auto shop on another, and none of that used to count — so
      // buying a front moved a boss *backwards* on the only money requirement
      // rank read, in a game about building something.
      //
      // Dirty money in a room is still not standing, and `estate` leaves it
      // out.
      //
      // Indexed, so a decade of inflation cannot promote you by standing
      // still. It is also the one requirement that can move away from a player
      // who stops earning, which is the point: the table's opinion of what a
      // Boss is worth was never a fixed number of dollars.
      label: 'What the family is worth',
      money: true,
      // Wallet plus holdings. What is put away is still yours and still
      // visible to the people whose opinion this table represents; it simply
      // is not available to be spent on the next job, which is the trade.
      current: ever(Math.floor(estate(state).total), best?.estate),
      now: Math.floor(estate(state).total),
      needed: priced(state, req.cleanCash),
      met: false,
    },
    {
      label: 'Operations completed',
      current: ever(state.player.opsCompleted, best?.ops),
      now: state.player.opsCompleted,
      needed: req.opsCompleted,
      met: false,
    },
    {
      label: 'Districts held',
      current: ever(controlledTerritories(state).length, best?.districts),
      now: controlledTerritories(state).length,
      needed: req.territories,
      met: false,
    },
  ];
  // A requirement of zero is not shown — it is not something to work toward.
  /*
     A requirement of zero is not shown — it is not something to work toward.

     The money row is the exception, because a boss with no money requirement
     still wants to see what the family is worth. Matched on the flag rather
     than on the label: this read `r.label === 'Clean money'` and survived the
     row being renamed, which would have silently hidden the one line the whole
     financial rework is about.
  */
  return rows.filter((r) => r.needed > 0 || r.money).map((r) => ({
    ...r,
    met: r.current >= r.needed,
  }));
}

/**
 * Offers the next rank once every requirement is met. It is offered rather
 * than granted — stepping up is a decision with consequences (more crew to
 * pay, more attention) and the player should make it deliberately.
 */
export function tickPlayer(state: GameState): void {
  if (state.player.pendingRank) return;
  const next = nextRank(state);
  if (!next) return;

  const reqs = rankRequirements(state);
  if (!reqs.every((r) => r.met)) return;

  const def = RANK_BY_ID[next];
  state.player.pendingRank = next;
  pushEvent(state, {
    defId: 'rank_offer',
    title: `You are being recognised as ${def.name}`,
    body:
      `Word has gone around. What you have built is being acknowledged, and the ` +
      `title comes with it.\n\n${def.blurb}\n\n` +
      `Taking it raises what you can command — up to ${def.maxCrew} people — and ` +
      `opens work that pays accordingly. It also means more names attached to yours.`,
    severity: 'opportunity',
    npcId: null,
    data: { rank: next },
    choices: [
      { id: 'accept', label: `Accept — ${def.name}`, hint: 'Take the title and everything with it' },
      { id: 'decline', label: 'Stay where you are', hint: 'Keep a lower profile a while longer' },
    ],
  });
}

export function acceptPromotion(state: GameState, rank: RankId): void {
  state.player.rank = rank;
  state.player.pendingRank = null;
  const def = RANK_BY_ID[rank];
  addLog(state, `You are ${def.name} now.`, 'success');
  // Standing rises with the title, and the organization feels it.
  gainRespect(state, 10);
  for (const npc of crewList(state)) {
    npc.stats.respectForBoss = clamp(npc.stats.respectForBoss + 6, 0, 100);
  }
}

export function declinePromotion(state: GameState): void {
  state.player.pendingRank = null;
  addLog(state, 'You let it pass. Quieter is not always worse.', 'neutral');
  // Refusing keeps you out of the light.
  state.org.heat = Math.max(0, state.org.heat - 3);
}
