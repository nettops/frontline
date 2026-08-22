/**
 * The inside of the other families.
 *
 * A leaf, on the same terms as leaders.ts: the faction AI and the war
 * resolution both call into this every week, so nothing here may import
 * faction.ts or diplomacy.ts. Where that means duplicating a one-line accessor
 * — `atWarWith`, `factionStrength` — it duplicates it, which is the standing
 * arrangement in this codebase and the reason the import graph is still a
 * graph.
 *
 * What it produces, in order of how often the player will meet it:
 *
 *   1. a rival family that has names in it
 *   2. a way into one that is not a war
 *   3. a reason a family that is losing keeps losing
 *   4. somebody specific to bury when a war goes badly
 */

import { Rng, clamp } from './rng';
import type { Capo, Faction, GameState } from './types';
import { addLog, nextId, formatMoney } from './util';
import { addNote, generateNpc } from './npc';
import {
  CAPO_AGE,
  CAPO_APPROACH,
  CAPO_COUNT,
  CAPO_DEFECTION,
  CAPO_DRIFT,
  CAPO_SHARE,
  CAPO_SUCCESSION,
  CAPO_TRANSFER,
  CAPO_WAR,
} from '../config/capos';
import { FIRST_NAMES, LAST_NAMES } from '../config/npcs';
import { ALL_FACTIONS, RIVAL_IDS, type FactionId } from '../config/factions';
import { DAYS_PER_YEAR } from '../config/economy';
import { houseShort } from './houses';

// ------------------------------------------------------------ generation ---

/**
 * The men under a new boss.
 *
 * Districts are assigned from where the family actually stands, strongest
 * first, so a capo always has a street that means something. When a family
 * holds fewer districts than it has capos the rest are unplaced — they exist,
 * they hold a share of the organization, and they have nothing of their own,
 * which is a perfectly good reason to be unhappy.
 */
export function newCapos(
  state: GameState,
  rng: Rng,
  factionId: FactionId,
  districtIds: string[],
): Capo[] {
  const count = rng.int(CAPO_COUNT[0], CAPO_COUNT[1]);
  const family = houseShort(state, factionId);
  const capos: Capo[] = [];

  for (let i = 0; i < count; i++) {
    capos.push({
      id: nextId(state, 'capo'),
      // A quarter of them share the family name. The rest married in, came up
      // through it, or were simply useful.
      name: `${rng.pick(FIRST_NAMES)} ${rng.chance(0.25) ? family : rng.pick(LAST_NAMES)}`,
      age: rng.int(CAPO_AGE[0], CAPO_AGE[1]),
      territoryId: districtIds[i] ?? null,
      share: rng.float(CAPO_SHARE[0], CAPO_SHARE[1]),
      loyalty: rng.int(52, 88),
      ambition: rng.int(15, 90),
      since: state.day,
      approachedDay: null,
    });
  }

  normalise(capos);
  return capos;
}

/**
 * Nobody's people add up to more than the family.
 *
 * Called after every change to a roster, not just at creation. The first
 * version only ran on generation, and a family that received defectors ended up
 * with shares summing to two and change — at which point `capoWorth` was
 * returning more strength than the organization had, and one man leaving took
 * a third of a family that did not have a third to give.
 */
function normalise(capos: Capo[]): void {
  const total = capos.reduce((sum, c) => sum + c.share, 0);
  if (total <= 0.85) return;
  for (const capo of capos) capo.share = (capo.share / total) * 0.85;
}

// ------------------------------------------------------------- accessors ---

export function caposOf(state: GameState, factionId: FactionId): Capo[] {
  return state.factions[factionId]?.capos ?? [];
}

/** What losing him would cost them, in strength. */
function capoWorth(faction: Faction, capo: Capo): number {
  return faction.strength * capo.share;
}

/**
 * How strong a claim he has on the chair.
 *
 * Deliberately made of three things the player can see if they are paying
 * attention — years served, size of his crew, and whether he has ever looked
 * like a man who wanted it. Nothing hidden goes into it.
 */
export function claim(state: GameState, capo: Capo): number {
  const years = (state.day - capo.since) / DAYS_PER_YEAR;
  return (
    years * CAPO_SUCCESSION.yearsWeight +
    capo.share * CAPO_SUCCESSION.shareWeight +
    capo.ambition * CAPO_SUCCESSION.ambitionWeight
  );
}

// ------------------------------------------------------------------ tick ---

/** Read inline rather than through diplomacy.ts, which imports this file. */
function atWarWith(state: GameState, a: FactionId, b: FactionId): boolean {
  return state.factions[a]?.bonds?.[b]?.warSince != null;
}

function strengthOf(state: GameState, id: FactionId): number {
  if (id === 'player') {
    // The player's muscle is their crew, priced the same way the war system
    // prices it. Duplicated here for the same leaf reason as everything else.
    return Object.values(state.npcs).filter((n) => n.status === 'active').length * 4;
  }
  return state.factions[id]?.strength ?? 0;
}

/**
 * Weekly. What each of them makes of the year they are having.
 *
 * The default is contentment — `settle` pulls back toward it every week — so
 * loyalty only falls when something is actually going wrong, and it falls at a
 * rate that takes years rather than months. A capo who walks out should be the
 * conclusion of a story the player could have watched.
 */
export function tickCapos(state: GameState, rng: Rng): void {
  if (state.day % 7 !== 0) return;

  for (const id of RIVAL_IDS) {
    const faction = state.factions[id];
    if (!faction?.capos) continue;

    for (const capo of faction.capos) {
      let drift = CAPO_DRIFT.settle;

      const enemies = ALL_FACTIONS.filter((o) => o !== id && atWarWith(state, id, o));
      for (const enemy of enemies) {
        drift +=
          strengthOf(state, enemy) > faction.strength
            ? CAPO_DRIFT.atWarLosing
            : CAPO_DRIFT.atWarWinning;
      }

      if (faction.wealth < CAPO_DRIFT.brokeBelow) drift += CAPO_DRIFT.brokePenalty;

      // A man with ambition and nothing to do develops opinions about the man
      // whose fault that is.
      if (!faction.agenda) drift += capo.ambition * CAPO_DRIFT.idleAmbitionWeight;

      // His street, taken off him while he was standing on it.
      if (capo.territoryId) {
        const t = state.territories[capo.territoryId];
        const held = t ? (t.influence[id] ?? 0) : 0;
        if (held < 15) {
          capo.territoryId = null;
          capo.loyalty = clamp(capo.loyalty + CAPO_DRIFT.districtLostPenalty, 0, 100);
        }
      }

      capo.loyalty = clamp(capo.loyalty + drift, 0, 100);
      considerLeaving(state, rng, faction, capo);
    }
  }
}

/**
 * Whether he goes, and to whom.
 *
 * He does not walk out into nothing — there has to be somewhere worth going,
 * which means a family that is not losing and is not the one he is leaving.
 * The player counts as a destination the moment they are strong enough, which
 * is the first time in this game that a rival's internal problems become the
 * player's opportunity without the player doing anything at all.
 */
function considerLeaving(state: GameState, rng: Rng, faction: Faction, capo: Capo): void {
  if (capo.loyalty >= CAPO_DEFECTION.loyaltyBelow) return;

  const below = CAPO_DEFECTION.loyaltyBelow - capo.loyalty;
  const chance =
    CAPO_DEFECTION.baseChance +
    below * CAPO_DEFECTION.perPointBelow +
    (capo.ambition / 100) * CAPO_DEFECTION.ambitionWeight;
  if (!rng.chance(chance)) return;

  /*
   * There has to be a seat for him.
   *
   * The roster cap is the brake on the whole system, and it was not there in
   * the first version. Without it a winning family absorbed every unhappy man
   * in the city — measured at fifteen capos, one organization holding all
   * twelve districts and $10.5m, in a game that had never let anybody past
   * seven districts. A table has a fixed number of chairs at it.
   */
  const options = ALL_FACTIONS.filter(
    (o) =>
      o !== faction.id &&
      !atWarWith(state, faction.id, o) &&
      strengthOf(state, o) >= CAPO_DEFECTION.receiverMinStrength &&
      (o === 'player' || caposOf(state, o).length < CAPO_COUNT[1]),
  );

  // Nowhere to go. He does not stay out of loyalty — he stays because leaving
  // is worse, and he is a considerably more dangerous man next year.
  if (options.length === 0) {
    capo.loyalty = clamp(capo.loyalty + 4, 0, 100);
    return;
  }

  /*
   * He goes where he will be somebody, not where the money is.
   *
   * The first version sent him to the strongest eligible family, which is the
   * obvious rule and turned out to be a runaway: a family that lost a war lost
   * its people to the family that beat it, which then won the next one more
   * easily. Measured over 24 worlds x 12 years it produced one organization
   * holding all twelve districts and $13m, in a game that had never previously
   * let anybody past seven.
   *
   * Fewest capos first is the brake, and it is also the better story — a man
   * with a crew behind him joins the house that has room for him at the table,
   * not the one that already has five people ahead of him in the queue.
   */
  const to = options.sort((a, b) => {
    const room = caposOf(state, a).length - caposOf(state, b).length;
    return room !== 0 ? room : strengthOf(state, a) - strengthOf(state, b);
  })[0];
  defect(state, rng, faction, capo, to, 'walked out');
}

// ---------------------------------------------------------- changing side ---

/**
 * He leaves, and takes what he is worth with him.
 *
 * Both halves matter. The strength is the part that shows up on the Rivals
 * panel next week; the influence is the part the player will still be feeling
 * in four years, because it is a district that changed hands without a shot.
 */
export function defect(
  state: GameState,
  rng: Rng,
  from: Faction,
  capo: Capo,
  to: FactionId,
  why: string,
): void {
  from.capos = from.capos.filter((c) => c.id !== capo.id);

  const worth = capoWorth(from, capo);
  from.strength = clamp(from.strength - worth, 0, 100);

  if (to === 'player') {
    /*
     * He turns up in the crew as an actual person.
     *
     * Without this the whole system is a number moving between two abstractions
     * and "he is with you now" means nothing you can look at. He arrives as a
     * capo, generated with the same hidden stats as anybody else, and with the
     * one note that matters written on him — because a man who sold out his
     * last boss is a specific kind of hire and the player should be able to see
     * that they knew it.
     */
    const npc = generateNpc(state, rng, 'capo');
    npc.name = capo.name;
    npc.age = capo.age;
    npc.stats.ambition = capo.ambition;
    npc.stats.loyalty = 55;
    npc.familiarity = 20;
    npc.joinedDay = state.day;
    addNote(
      npc,
      state.day,
      `Came over from the ${houseShort(state, from.id)}. They did it once.`,
      'neutral',
    );
    state.npcs[npc.id] = npc;
  } else {
    const receiver = state.factions[to];
    if (receiver) {
      receiver.strength = clamp(
        receiver.strength + worth * CAPO_TRANSFER.strengthKept,
        0,
        100,
      );
      capo.loyalty = 60;
      capo.since = state.day;
      receiver.capos = [...(receiver.capos ?? []), capo];
      normalise(receiver.capos);
    }
  }

  // The district goes with the man, whoever he went to.
  if (capo.territoryId) {
    const t = state.territories[capo.territoryId];
    if (t) {
      const moving = (t.influence[from.id] ?? 0) * CAPO_TRANSFER.influenceShare;
      t.influence[from.id] = clamp((t.influence[from.id] ?? 0) - moving, 0, 100);
      t.influence[to] = clamp((t.influence[to] ?? 0) + moving, 0, 100);
      if (to === 'player') {
        t.visited = true;
        t.lastActionDay = state.day;
      }
    }
  }

  // They hold it against whoever took him, and it costs the boss standing with
  // everybody who watched.
  const bond = from.bonds[to];
  if (bond) bond.grudge = clamp(bond.grudge + CAPO_DEFECTION.grudge, 0, 100);
  from.strength = clamp(from.strength - CAPO_DEFECTION.standingHit * 0.1, 0, 100);

  const fromName = houseShort(state, from.id);
  const toName = to === 'player' ? 'you' : houseShort(state, to);
  addLog(
    state,
    `${capo.name} is not with the ${fromName} any more. They are with ${toName}. (${why})`,
    'crew',
  );
}

// ----------------------------------------------------------- what you see --

export interface CapoRead {
  capo: Capo;
  /** Where he stands, or null if he has nothing of his own. */
  where: string | null;
  /** How big his crew is, as a phrase. Never the number. */
  size: string;
  /** What he thinks of his boss, or null while you cannot tell. */
  standing: string | null;
  /** Whether he looks like a man who wants more, or null. */
  wants: string | null;
}

/**
 * The roster, through the fog.
 *
 * Names and districts are public — these are men with restaurants and funerals
 * and a table they sit at. Everything else needs somebody to have been paying
 * attention, which in this game means sharing ground with them. The one number
 * never shown is his loyalty, because a player who can read that is not
 * gambling on the approach, they are looking up the answer.
 */
export function readCapos(state: GameState, factionId: FactionId, intel: number): CapoRead[] {
  return caposOf(state, factionId).map((capo) => ({
    capo,
    where: capo.territoryId,
    size:
      capo.share > 0.22 ? 'a large crew' : capo.share > 0.15 ? 'a good crew' : 'a few people',
    standing:
      intel < CAPO_APPROACH.minIntel
        ? null
        : capo.loyalty < 25
          ? 'looks like a man about to do something'
          : capo.loyalty < 45
            ? 'not happy'
            : capo.loyalty < 70
              ? 'no complaints anybody has heard'
              : 'solid',
    wants:
      intel < CAPO_APPROACH.minIntel
        ? null
        : capo.ambition > 65
          ? 'wants the chair'
          : capo.ambition > 35
            ? 'would take it if offered'
            : 'content where they are',
  }));
}

// -------------------------------------------------------- buying one -------

export interface ApproachCheck {
  ok: boolean;
  message: string;
  cost: number;
  /** What the player is told the odds are, which is what they are. */
  chance: number;
}

/**
 * Whether he will take the meeting, what it costs, and what it is worth.
 *
 * The odds are shown honestly. Every other hidden quantity in this game is
 * fogged, and this one is not, for a specific reason: the player is being asked
 * to bet a fifth of a million dollars and a grudge on one roll, and a bet whose
 * odds you cannot see is not a decision, it is a slot machine.
 *
 * The facts come in from the caller for the usual leaf reason.
 */
export function canApproach(
  state: GameState,
  factionId: FactionId,
  capoId: string,
  facts: { respect: number; fear: number; intel: number; funds: number; priceLevel: number },
): ApproachCheck {
  const faction = state.factions[factionId];
  const capo = faction?.capos?.find((c) => c.id === capoId);
  const none = { ok: false, cost: 0, chance: 0 };
  if (!capo) return { ...none, message: 'No such man.' };

  const cost = Math.round(
    (CAPO_APPROACH.cost + capo.loyalty * CAPO_APPROACH.costPerLoyaltyPoint) * facts.priceLevel,
  );
  const chance = clamp(
    CAPO_APPROACH.baseChance +
      Math.max(0, 100 - capo.loyalty) * CAPO_APPROACH.perPointDisloyal +
      (facts.fear / 100) * CAPO_APPROACH.fearWeight +
      Math.min(1, facts.respect / 600) * CAPO_APPROACH.standingWeight +
      (capo.ambition / 100) * CAPO_APPROACH.ambitionWeight,
    0.02,
    0.92,
  );

  /*
     Each of these says where the bar is and where you are.

     They used to say neither, which is the defect `refusals.test.ts` exists to
     catch: a player told "somebody at your level" has been given a mood, not a
     requirement, and cannot tell whether they are twenty respect short or two
     hundred. The same silence cost rounds 7, 11 and 12 between ninety and two
     hundred days each on the business gate, so the rule here is the one
     `canAcquire` follows now — name the figure, name the bar.
  */
  if (facts.intel < CAPO_APPROACH.minIntel) {
    return {
      ...none,
      message:
        `You know ${Math.round(facts.intel)} of what you would need to know about their family; ` +
        `${CAPO_APPROACH.minIntel} is enough to know who to ask for.`,
    };
  }
  if (facts.respect < CAPO_APPROACH.minRespect) {
    return {
      ...none,
      message:
        `A made man does not take a meeting with somebody at your level. ` +
        `You stand at ${Math.round(facts.respect)}; they would want ${CAPO_APPROACH.minRespect}.`,
    };
  }
  if (capo.approachedDay !== null && state.day - capo.approachedDay < CAPO_APPROACH.cooldownDays) {
    return {
      ...none,
      message:
        `They have already heard your offer once, and have not forgotten it. ` +
        `Ask again in ${CAPO_APPROACH.cooldownDays - (state.day - capo.approachedDay)} days.`,
    };
  }
  if (facts.funds < cost) {
    return {
      ok: false,
      cost,
      chance,
      message: `Taking them would cost ${formatMoney(cost)} and you hold ${formatMoney(facts.funds)}.`,
    };
  }
  return { ok: true, cost, chance, message: 'They will hear you out.' };
}

export interface ApproachOutcome {
  taken: boolean;
  /** Set on refusal — what he told his boss, in the player's own words. */
  message: string;
}

/**
 * Make the offer.
 *
 * `paid` is passed in already resolved rather than spending here, so this file
 * stays clear of economy.ts. The caller has taken the money before it asks.
 */
export function approachCapo(
  state: GameState,
  rng: Rng,
  factionId: FactionId,
  capoId: string,
  chance: number,
  paid: boolean,
): ApproachOutcome {
  const faction = state.factions[factionId];
  const capo = faction?.capos?.find((c) => c.id === capoId);
  if (!capo || !paid) return { taken: false, message: 'Nothing happened.' };

  capo.approachedDay = state.day;
  const bond = faction.bonds['player'];

  if (rng.chance(chance)) {
    defect(state, rng, faction, capo, 'player', 'you made them a better offer');
    if (bond) bond.grudge = clamp(bond.grudge + CAPO_APPROACH.onSuccessGrudge, 0, 100);
    state.org.fear = clamp(state.org.fear + CAPO_APPROACH.onSuccessFear, 0, 100);
    return {
      taken: true,
      message: `${capo.name} is yours. So is most of what they were standing on.`,
    };
  }

  /*
   * He says no, and then he tells his boss, because that is what loyalty is.
   *
   * The failure has to cost something specific or the correct play is simply to
   * ask everybody. It costs money, standing, a grudge, and — the part that
   * lands months later — an evidence trace, because a meeting like that is
   * exactly the kind of thing somebody photographs.
   */
  if (bond) bond.grudge = clamp(bond.grudge + CAPO_APPROACH.onFailureGrudge, 0, 100);
  state.org.respect = Math.max(0, state.org.respect + CAPO_APPROACH.onFailureRespect);
  capo.loyalty = clamp(capo.loyalty + 8, 0, 100);
  return {
    taken: false,
    message: `${capo.name} heard you out, said no, and was on the telephone before you reached the street.`,
  };
}

// -------------------------------------------------------------- the wars ---

/**
 * A war reaching somebody with a name.
 *
 * Called by the war resolution when a family loses a clash. Losing a capo costs
 * more than the strength points a clash normally takes, and it costs the
 * family's appetite for continuing — a war stops being an abstraction the week
 * somebody has to be buried.
 */
export function warCasualty(state: GameState, rng: Rng, factionId: FactionId): boolean {
  const faction = state.factions[factionId];
  if (!faction?.capos?.length) return false;
  // A family already on the floor does not get its last named men taken as
  // well. Losing a capo is meant to make a war expensive, not to finish
  // somebody who has already lost it.
  if (faction.strength < CAPO_WAR.protectedBelow) return false;
  if (!rng.chance(CAPO_WAR.deathChance)) return false;

  const capo = rng.pick(faction.capos);
  faction.capos = faction.capos.filter((c) => c.id !== capo.id);
  faction.strength = clamp(faction.strength - capoWorth(faction, capo), 0, 100);
  faction.warWeariness = Math.min(100, faction.warWeariness + CAPO_WAR.wearinessOnDeath);

  addLog(
    state,
    `${capo.name} of the ${houseShort(state, factionId)} was killed. They were somebody, and now there is a hole where they were.`,
    'failure',
  );
  return true;
}

// -------------------------------------------------------- taking the chair --

/**
 * Who gets it when the boss goes.
 *
 * Called from the leader handover. The winner leaves the roster — he is the
 * boss now, and his share dissolves back into the family — and the runner-up,
 * if he was close, spends the next several years being a problem.
 */
export function promoteFromWithin(state: GameState, faction: Faction): Capo | null {
  if (!faction.capos?.length) return null;

  const ranked = [...faction.capos].sort((a, b) => claim(state, b) - claim(state, a));
  const winner = ranked[0];
  faction.capos = faction.capos.filter((c) => c.id !== winner.id);

  const runnerUp = ranked[1];
  if (runnerUp && claim(state, winner) - claim(state, runnerUp) < CAPO_SUCCESSION.closeMargin) {
    runnerUp.loyalty = clamp(runnerUp.loyalty + CAPO_SUCCESSION.passedOverLoyalty, 0, 100);
    addLog(
      state,
      `${runnerUp.name} expected to be asked. Nobody asked them.`,
      'crew',
    );
  }

  return winner;
}

/**
 * Yearly. They get older, and the family makes new ones to replace the gaps.
 *
 * A family that is never topped up bleeds out over thirty years through
 * defection and war alone, which reads as decline rather than as an
 * organization — real ones promote from the ranks and this one does too.
 */
export function ageCapos(state: GameState, rng: Rng): void {
  if (state.day % DAYS_PER_YEAR !== 0) return;

  for (const id of RIVAL_IDS) {
    const faction = state.factions[id];
    if (!faction?.capos) continue;

    for (const capo of faction.capos) capo.age += 1;
    faction.capos = faction.capos.filter((c) => c.age < 78 || rng.chance(0.75));

    if (faction.capos.length < CAPO_COUNT[0] && faction.strength > 20) {
      const taken = new Set(faction.capos.map((c) => c.territoryId));
      const free = Object.values(state.territories)
        .filter((t) => (t.influence[id] ?? 0) >= 25 && !taken.has(t.id))
        .sort((a, b) => (b.influence[id] ?? 0) - (a.influence[id] ?? 0))[0];
      const [made] = newCapos(state, rng, id, free ? [free.id] : []);
      made.share = Math.min(made.share, 0.15);
      faction.capos.push(made);
      normalise(faction.capos);
      addLog(
        state,
        `${houseShort(state, id)}: ${made.name} has been given a crew of their own.`,
        'neutral',
      );
    }
  }
}
