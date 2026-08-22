/**
 * Rival organizations that actually play the game.
 *
 * Once a week each family runs the same loop the player does:
 *
 *     goals  →  resources  →  risk  →  decision
 *
 * Every option is scored from the live board — who is weak, what is valuable,
 * what they can afford, how much attention they are already carrying — and the
 * best affordable option wins. Nothing is sequenced or scripted. A family that
 * behaves aggressively does so because aggression scores well for it in that
 * situation, and the same family will go quiet when its own heat climbs.
 *
 * What separates the Falcone from the Kestler is four numbers in
 * `config/factions.ts`, not four branches in here.
 */

import { Rng, clamp } from './rng';
import type {
  Faction,
  FactionAction,
  FactionActionKind,
  FactionAgenda,
  GameState,
  Territory,
} from './types';
import { addLog, formatMoneyShort, pushEvent } from './util';
import {
  adjustRelationship,
  atWar,
  bond,
  declareWar,
  defectToRival,
  factionStrength,
  makePeace,
  tickBonds,
  poachTarget,
  relationship,
} from './diplomacy';
import { BOND, POACH, WAR } from '../config/diplomacy';
import {
  hasPresence,
  playerInfluence,
  prosperity,
  territoryDef,
  territoryList,
} from './territory';
import { worldMod } from './world';
import { goalEffect } from './goals';
import { addNote, traitEffect } from './npc';
import { poachableFromMemory } from './memory';
import { recordChoice } from './trace';
import { attribute, damageShare, tickBeliefs } from './beliefs';
import { tickLeaders, leaderPersonality } from './leaders';
import {
  AGENDA,
  AGENDA_LABEL,
  AI,
  ALL_FACTIONS,
  FACTION_DECISION_INTERVAL_DAYS,
  FACTION_INTEL_PER_SHARED_DISTRICT,
  FACTION_INTEL_PRECISE_ABOVE,
  FACTION_INTEL_ROUGH_ABOVE,
  GROUND_LOST,
  RELATIONSHIP_PER_INFLUENCE_TAKEN,
  RELATIONSHIP_STATES,
  RIVAL_IDS,
  type FactionId,
} from '../config/factions';
import { DIFFICULTY_BY_ID } from '../config/difficulty';
import { houseDef, houseShort } from './houses';

export function rivals(state: GameState): Faction[] {
  return RIVAL_IDS.map((id) => state.factions[id]).filter(Boolean);
}

export function factionInfluence(t: Territory, id: FactionId): number {
  return t.influence[id] ?? 0;
}

/**
 * The temperament actually driving decisions this week.
 *
 * Every scorer used to read `housePersonality(state, id)` directly, which is
 * a constant — so the Kestler were reckless on day one and identically
 * reckless thirty years later. It now goes through the man in charge, whose
 * bias sits on top of the family's and is re-rolled when he dies.
 */
function temperament(state: GameState, faction: Faction) {
  return leaderPersonality(state, faction);
}

/** Districts where a faction has any real foothold. */
function districtsHeld(state: GameState, id: FactionId): Territory[] {
  return territoryList(state).filter((t) => factionInfluence(t, id) >= 25);
}

// ------------------------------------------------------------- candidates ---

interface Option {
  kind: FactionActionKind;
  score: number;
  territoryId: string | null;
  targetFactionId: FactionId | null;
}

/**
 * Taking new ground.
 *
 * Wants districts that are valuable and weakly held, and can only reach ones
 * adjacent to somewhere it already stands — the same rule the player plays by.
 */
function scoreExpand(state: GameState, faction: Faction, rng: Rng): Option {
  const personality = temperament(state, faction);
  const held = districtsHeld(state, faction.id);

  const reachable = new Set<string>();
  for (const t of held) {
    reachable.add(t.id);
    for (const neighbour of territoryDef(t.id).adjacent) reachable.add(neighbour);
  }

  let best: Option = {
    kind: 'expand',
    score: 0,
    territoryId: null,
    targetFactionId: null,
  };

  // Taking ground costs money like everything else. Without this a broke
  // family expands itself into debt.
  if (faction.wealth < AI.expand.costPerPoint * AI.expand.gain[0]) return best;

  // A family already holding a lot of ground wants another district less than
  // it wanted its first — organizations have a span of control.
  const spanOfControl = clamp(1 - held.length / AI.comfortableDistricts, 0.15, 1);

  for (const id of reachable) {
    const t = state.territories[id];
    if (!t) continue;
    const tDef = territoryDef(id);
    const mine = factionInfluence(t, faction.id);
    if (mine >= 85) continue; // nothing left to take here

    // What the district is worth: position, money, and how quiet it is.
    const value =
      (tDef.strategicValue / 100) * AI.expand.strategicWeight +
      // The live figure, so a district the player has stripped stops being
      // worth fighting over — which is the other half of the extraction
      // decision, and the half nobody sees coming.
      (prosperity(state, t.id) / 100) * AI.expand.wealthWeight +
      ((100 - tDef.policePresence) / 100) * AI.expand.quietWeight;

    // How much room there is. Somewhere already dominated by someone else is
    // a fight, not an expansion — that is what `pressure` is for.
    let opposition = 0;
    for (const other of [...RIVAL_IDS, 'player' as FactionId]) {
      if (other === faction.id) continue;
      opposition = Math.max(opposition, factionInfluence(t, other));
    }
    // Never quite zero: see AI.expand.contestedFloor. An empty district is
    // still far more attractive than a full one, but a full one is no longer
    // literally unthinkable, and that difference is what keeps the city moving.
    const room = Math.max(
      clamp((100 - opposition) / 100, 0, 1),
      AI.expand.contestedFloor * personality.ambition,
    );

    // Consolidating somewhere they already stand is cheaper than starting cold.
    const familiarity = mine > 0 ? 1 : 0.7;

    const score =
      personality.ambition * value * room * familiarity * spanOfControl * AI.weights.expand;
    if (score > best.score) {
      best = { kind: 'expand', score, territoryId: id, targetFactionId: null };
    }
  }

  best.score += rng.float(0, AI.scoreJitter);
  return best;
}

/**
 * Moving against somebody.
 *
 * Families pick on people they are already stronger than, in districts they
 * share. A grudge against the player makes them likelier to choose the player
 * over an equally weak rival — which is how a feud escalates on its own.
 */
function scorePressure(state: GameState, faction: Faction, rng: Rng): Option {
  const personality = temperament(state, faction);
  let best: Option = {
    kind: 'pressure',
    score: 0,
    territoryId: null,
    targetFactionId: null,
  };

  if (faction.wealth < AI.pressure.cost) return best;

  for (const t of territoryList(state)) {
    const mine = factionInfluence(t, faction.id);
    /*
       Being driven out of a district used to remove the ability to answer for
       it. This gate is checked before anything else, so a family pushed below
       20 simply stopped considering the street — which is the state the player
       puts every district into on the way to holding it. A family with a live
       grievance here needs only to still be standing in the place.
    */
    const grieving = Object.entries(faction.groundLost ?? {}).some(
      ([key, points]) => points > 0 && key.endsWith(`:${t.id}`),
    );
    if (mine < (grieving ? AI.pressure.grievingPresence : 20)) continue;

    for (const other of [...RIVAL_IDS, 'player' as FactionId]) {
      if (other === faction.id) continue;
      const theirs = factionInfluence(t, other);
      if (theirs <= 0) continue;

      /*
         Somebody weaker here — or somebody who has been taking this street.

         The lead requirement on its own made the whole system a tutorial-phase
         one. A family will only lean on a party it is already ahead of, and
         the player's entire trajectory is to pass through that band once, in
         each district, early, and never re-enter it. Measured over twelve
         four-year careers: 526 pressure actions between the families, 65
         against the player — one every nine months — while the number of
         districts a rival *could* have leaned on grew from 0.84 to 4.20 a
         week. Opportunity was never the constraint. The gate was.

         Losing streets to a rising outfit is the oldest reason in the genre to
         go and see somebody about it, and it was the one case excluded. So a
         live grievance here stands in for the lead: `groundLost` is the tally
         this family has been keeping since `noteInfluenceTaken` started
         writing it, and a family that is bleeding in a district will move
         there whether or not the arithmetic favours it.

         This is not the old bug returning. That one made the player the most
         attractive target on the board *by being weakest* — advantage measured
         against 100, so the weakest party always scored highest. Nothing here
         touches that: `advantage`, `significance` and `insignificantFloor` all
         still apply. What changes is only whether the door is open, and it
         opens on something the player did rather than on something they are.
      */
      const bleeding = (faction.groundLost?.[`${other}:${t.id}`] ?? 0) > 0;
      if (!bleeding && mine - theirs < AI.pressure.requiredLead) continue;

      /*
         What being aggrieved is worth, on the same scale as being ahead.

         Opening the gate above without this changed nothing, measurably:
         pressure against the player moved 71 to 74 across twelve careers,
         because `advantage` is zero the moment the target is stronger. They
         were let through the door and then scored at nothing. A family that is
         losing a street is not weighing its lead; it is weighing what it is
         losing.
      */
      const lost = faction.groundLost?.[`${other}:${t.id}`] ?? 0;
      const grievance = clamp(lost / GROUND_LOST.full, 0, 1);

      /*
       * Advantage is relative, not absolute. Measuring it as a fraction of 100
       * meant a genuinely lopsided matchup between two established families —
       * 30 against 22, a comfortable edge — scored 0.08 and never cleared the
       * action threshold, so the only target worth moving on was ever the
       * player, who is weakest on the board by construction.
       */
      const advantage = Math.max(
        clamp((mine - theirs) / Math.max(mine, 1), 0, 1),
        grievance,
      );
      // A soured relationship makes anybody a more attractive target, but a
      // family will lean on somebody weaker without needing a reason.
      const hostility = clamp(-relationship(state, faction.id, other) / 100, 0, 1);
      const grudge =
        AI.pressure.grudgeBase + hostility * AI.pressure.grudgeFromHostility;
      const value = territoryDef(t.id).strategicValue / 100;
      // Somebody barely present is not worth the trip.
      const significance = clamp(
        theirs / AI.pressure.significantAt,
        AI.pressure.insignificantFloor,
        1,
      );

      const score =
        personality.aggression *
        advantage *
        grudge *
        significance *
        (0.7 + value * 0.3) *
        AI.weights.pressure;
      if (score > best.score) {
        best = { kind: 'pressure', score, territoryId: t.id, targetFactionId: other };
      }
    }
  }

  best.score += rng.float(0, AI.scoreJitter);
  return best;
}

/** Buying fronts. Only worth it where they hold enough ground to place one. */
function scoreInvest(state: GameState, faction: Faction, rng: Rng): Option {
  const personality = temperament(state, faction);
  if (faction.wealth < AI.invest.cost) {
    return { kind: 'invest', score: 0, territoryId: null, targetFactionId: null };
  }

  const held = districtsHeld(state, faction.id).length;
  const capacity = held * AI.invest.perDistrict;
  if (faction.businessCount >= capacity) {
    return { kind: 'invest', score: 0, territoryId: null, targetFactionId: null };
  }

  // Wealthier families find this more attractive; broke ones need the ground first.
  const funds = clamp(faction.wealth / (AI.invest.cost * 4), 0, 1);
  const score =
    personality.commerce * funds * clamp(held / 4, 0.2, 1) * AI.weights.invest;

  return {
    kind: 'invest',
    score: score + rng.float(0, AI.scoreJitter),
    territoryId: null,
    targetFactionId: null,
  };
}

/**
 * Going quiet.
 *
 * Scores on their own heat and on being short of money. This is what stops a
 * family spiralling the way an unmanaged player does — they will stop and cool
 * off, and a cautious family stops sooner.
 */
function scoreConsolidate(state: GameState, faction: Faction, rng: Rng): Option {
  const personality = temperament(state, faction);

  const heatPressure = clamp(faction.heat / 100, 0, 1);
  const alarmed = faction.heat > AI.heatAlarmAbove ? 0.5 : 0;
  const broke = faction.wealth < AI.pressure.cost ? 0.45 : 0;

  const score =
    (personality.caution * heatPressure + alarmed + broke) * AI.weights.consolidate;
  return {
    kind: 'consolidate',
    score: score + rng.float(0, AI.scoreJitter),
    territoryId: null,
    targetFactionId: null,
  };
}

/**
 * Talking rather than fighting.
 *
 * Scores on wanting out of a war they are losing, and on wanting into one
 * against somebody who has become weak. A cautious family sues for peace early;
 * an aggressive one uses the same code path to pick a new fight.
 */
function scoreDiplomacy(state: GameState, faction: Faction, rng: Rng): Option {
  const personality = temperament(state, faction);
  let best: Option = {
    kind: 'diplomacy',
    score: 0,
    territoryId: null,
    targetFactionId: null,
  };

  for (const other of ALL_FACTIONS) {
    if (other === faction.id) continue;
    const grudge = bond(state, faction.id, other).grudge;
    const mine = factionStrength(state, faction.id);
    const theirs = factionStrength(state, other);

    if (atWar(state, faction.id, other)) {
      // Wanting out: driven by exhaustion and by losing.
      const weariness = clamp(faction.warWeariness / 60, 0, 1.4);
      const losing = clamp((theirs - mine) / 60, 0, 1);
      const score = (personality.caution * weariness + losing) * AI.weights.diplomacy;
      if (score > best.score) {
        best = { kind: 'diplomacy', score, territoryId: null, targetFactionId: other };
      }
    } else if (
      // The grievance, not the blended figure. A family that has been wronged
      // repeatedly will move on somebody it also has reasons to like.
      grudge >= BOND.warGrudge &&
      mine > theirs + requiredLead(grudge) &&
      // Worth going to war with at all. A small operation gets leaned on, not
      // mobilised against.
      theirs >= AI.weights.declareWarMinTargetStrength &&
      faction.warWeariness < 20
    ) {
      /*
       * Starting one.
       *
       * `opportunity` used to be the whole of it, which is why nobody ever
       * started a war: three families at strength 100 have no opportunity
       * against each other, ever, and the term was zero forever. Hatred is now
       * a route in of its own — at the bottom of the scale a family will go at
       * somebody it merely matches, because by then it has stopped being a
       * calculation.
       */
      const opportunity = clamp((mine - theirs) / 60, 0, 1);
      const dislike = clamp(grudge / 100, 0, 1);
      const score =
        personality.aggression *
        Math.max(opportunity, dislike * dislike) *
        dislike *
        AI.weights.declareWar;
      if (score > best.score) {
        best = { kind: 'diplomacy', score, territoryId: null, targetFactionId: other };
      }
    }
  }

  best.score += rng.float(0, AI.scoreJitter);
  return best;
}

/**
 * How much stronger a family needs to be before it will start a war.
 *
 * A flat twenty points was unreachable between evenly matched organizations,
 * and measurably produced zero rival wars in thirty years across six seeds.
 * The requirement now collapses toward nothing as the grievance deepens: past
 * a certain amount of history, a family stops doing the arithmetic.
 *
 * Reads the grudge rather than the blended standing, and that distinction is
 * not academic — it cost fourteen of twenty-four worlds their wars when the
 * bond refactor landed. Peace now *earns* trust every week, which lifts the
 * blended figure for two organizations who have been quietly seething at each
 * other, so the lead requirement never collapsed and nobody ever moved. The
 * grievance is the thing that makes people reckless about the odds.
 */
function requiredLead(grudge: number): number {
  const { declareWarLead, declareWarLeadFloor, declareWarDesperateAt } = AI.weights;
  const hatred = clamp(
    (grudge - BOND.warGrudge) / (-declareWarDesperateAt - BOND.warGrudge),
    0,
    1,
  );
  return declareWarLead + (declareWarLeadFloor - declareWarLead) * hatred;
}

/**
 * Taking somebody's man.
 *
 * This is what the loyalty system has been building toward: an unhappy person
 * in your organization is not only a risk of leaving, they are somebody else's
 * opportunity. Only worth doing against a player who has let people get unhappy.
 */
function scorePoach(state: GameState, faction: Faction, rng: Rng): Option {
  const personality = temperament(state, faction);
  const empty: Option = { kind: 'poach', score: 0, territoryId: null, targetFactionId: null };
  if (faction.wealth < POACH.cost) return empty;

  const target = poachTarget(state, rng, POACH.loyaltyBelow);
  if (!target) return empty;

  // The unhappier he is, the more attractive the approach.
  const unhappiness = clamp((POACH.loyaltyBelow - target.stats.loyalty) / 45, 0, 1);
  const appetite = (personality.ambition + personality.aggression) / 2;
  const score = appetite * unhappiness * AI.weights.poach;

  return {
    kind: 'poach',
    score: score + rng.float(0, AI.scoreJitter),
    territoryId: null,
    targetFactionId: 'player',
  };
}

// ---------------------------------------------------------------- execute ---

function record(
  state: GameState,
  faction: Faction,
  action: Omit<FactionAction, 'day' | 'observed'>,
  observed: boolean,
): void {
  const entry: FactionAction = { ...action, day: state.day, observed };
  faction.history.unshift(entry);
  if (faction.history.length > 40) faction.history.length = 40;

  // The player only hears about what happens where they have people.
  if (observed) {
    addLog(state, entry.detail, 'crew');
  }
}

function executeExpand(state: GameState, faction: Faction, rng: Rng, option: Option): void {
  const t = state.territories[option.territoryId!];
  if (!t) return;
  // They buy as much ground as they can pay for, never more.
  const affordable = faction.wealth / AI.expand.costPerPoint;
  const gain = Math.min(rng.float(AI.expand.gain[0], AI.expand.gain[1]), affordable);
  if (gain <= 0) return;

  t.influence[faction.id] = clamp(factionInfluence(t, faction.id) + gain, 0, 100);
  faction.wealth = Math.max(0, faction.wealth - Math.round(gain * AI.expand.costPerPoint));
  faction.heat = clamp(faction.heat + AI.expand.heat, 0, 100);

  const def = houseDef(state, faction.id);
  const where = territoryDef(t.id).name;
  record(
    state,
    faction,
    {
      kind: 'expand',
      territoryId: t.id,
      targetFactionId: null,
      detail: `${def.shortName} people are showing up in ${where}.`,
    },
    hasPresence(t),
  );
}

function executePressure(
  state: GameState,
  faction: Faction,
  rng: Rng,
  option: Option,
): void {
  const t = state.territories[option.territoryId!];
  const target = option.targetFactionId;
  if (!t || !target) return;

  const damage = rng.float(AI.pressure.damage[0], AI.pressure.damage[1]);
  const taken = Math.min(damage, factionInfluence(t, target));

  t.influence[target] = clamp(factionInfluence(t, target) - taken, 0, 100);
  t.influence[faction.id] = clamp(
    factionInfluence(t, faction.id) + AI.pressure.selfGain,
    0,
    100,
  );
  faction.wealth -= AI.pressure.cost;
  faction.heat = clamp(faction.heat + AI.pressure.heat, 0, 100);

  const def = houseDef(state, faction.id);
  const where = territoryDef(t.id).name;

  /*
   * The target works out who leaned on them.
   *
   * Being pushed in a district you hold is loud, so clarity is usually high —
   * but a family with a toe-hold somewhere, pushed by somebody careful, can
   * come away blaming the wrong neighbour. That is how two rivals end up at
   * war over a third one's work.
   */
  const hit = rng.float(AI.pressure.relationshipHit[0], AI.pressure.relationshipHit[1]);
  const blame = attribute(state, rng, target, faction.id, t.id, 'pressure');
  adjustRelationship(state, target, blame.believed, -hit * damageShare(blame.confidence));

  if (target === 'player') {
    record(
      state,
      faction,
      {
        kind: 'pressure',
        territoryId: t.id,
        targetFactionId: target,
        detail: `${def.shortName} moved on your people in ${where}. You are ${Math.round(
          taken,
        )} weaker there.`,
      },
      true,
    );
  } else {
    record(
      state,
      faction,
      {
        kind: 'pressure',
        territoryId: t.id,
        targetFactionId: target,
        detail: `${def.shortName} and ${houseShort(state, target)} are fighting over ${where}.`,
      },
      hasPresence(t),
    );
  }
}

function executeInvest(state: GameState, faction: Faction): void {
  faction.wealth -= AI.invest.cost;
  faction.businessCount += 1;

  const def = houseDef(state, faction.id);
  record(
    state,
    faction,
    {
      kind: 'invest',
      territoryId: null,
      targetFactionId: null,
      detail: `${def.shortName} have bought into something legitimate.`,
    },
    // Only visible if you are close enough to them to hear about it.
    factionIntel(state, faction.id) >= FACTION_INTEL_ROUGH_ABOVE,
  );
}

function executeConsolidate(state: GameState, faction: Faction): void {
  faction.heat = clamp(faction.heat - AI.consolidate.heatReduction, 0, 100);
  faction.wealth += AI.consolidate.wealthGain;

  for (const t of districtsHeld(state, faction.id)) {
    t.influence[faction.id] = clamp(
      factionInfluence(t, faction.id) + AI.consolidate.influenceGain,
      0,
      100,
    );
  }

  const def = houseDef(state, faction.id);
  record(
    state,
    faction,
    {
      kind: 'consolidate',
      territoryId: null,
      targetFactionId: null,
      detail: `${def.shortName} have gone quiet and are counting their money.`,
    },
    factionIntel(state, faction.id) >= FACTION_INTEL_ROUGH_ABOVE,
  );
}

function executeDiplomacy(state: GameState, faction: Faction, option: Option): void {
  const target = option.targetFactionId;
  if (!target) return;
  const def = houseDef(state, faction.id);

  if (atWar(state, faction.id, target)) {
    // Suing for peace. The other side has to be willing too — somebody who is
    // winning comfortably has no reason to stop.
    const theirWeariness =
      target === 'player' ? 0 : (state.factions[target]?.warWeariness ?? 0);
    const winning = factionStrength(state, target) > factionStrength(state, faction.id) + 15;
    if (target !== 'player' && !winning && theirWeariness < WAR.wearinessSuesForPeace * 0.5) {
      return; // the offer is refused; they try again another week
    }

    if (target === 'player') {
      // The player gets to answer for themselves.
      pushEvent(state, {
        defId: 'peace_offer',
        title: `The ${def.shortName} want to stop`,
        body:
          `An intermediary both of you trust asks for an hour of your time.\n\n` +
          `They are not apologising and they are not surrendering. They are saying ` +
          `that this has cost both of you more than the thing you started it over, ` +
          `and that they will stop if you will.\n\n` +
          `Refusing means it continues, and they know that as well as you do.`,
        severity: 'opportunity',
        npcId: null,
        data: { factionId: faction.id },
        choices: [
          { id: 'accept', label: 'Take the peace', hint: 'It ends. Neither of you forgets it' },
          { id: 'refuse', label: 'Keep going', hint: 'You think you are winning' },
        ],
      });
      record(
        state,
        faction,
        {
          kind: 'diplomacy',
          territoryId: null,
          targetFactionId: target,
          detail: `${def.shortName} have asked for terms.`,
        },
        true,
      );
      return;
    }

    makePeace(state, faction.id, target);
    record(
      state,
      faction,
      {
        kind: 'diplomacy',
        territoryId: null,
        targetFactionId: target,
        detail: `${def.shortName} and ${houseShort(state, target)} have made peace.`,
        },
      factionIntel(state, faction.id) >= FACTION_INTEL_ROUGH_ABOVE,
    );
    return;
  }

  declareWar(state, faction.id, target);
  record(
    state,
    faction,
    {
      kind: 'diplomacy',
      territoryId: null,
      targetFactionId: target,
      detail:
        target === 'player'
          ? `${def.shortName} have declared war on you.`
          : `${def.shortName} have declared war on ${houseShort(state, target)}.`,
    },
    true,
  );
}

function executePoach(state: GameState, faction: Faction, rng: Rng): void {
  const target = poachTarget(state, rng, POACH.loyaltyBelow);
  if (!target) return;

  faction.wealth -= POACH.cost;
  const def = houseDef(state, faction.id);

  // Who he is and what he wants both decide whether the offer lands. An old
  // school man turns it down flat; somebody already looking for the door was
  // half gone before anybody asked.
  /*
   * Who he is, what he wants, and what has been done to him.
   *
   * The last of those is the one that makes an approach feel earned rather
   * than rolled: a man being offered a way out weighs it against specific
   * things, and until memories existed the only thing he could bring to that
   * decision was a loyalty number nobody had kept the reasons for.
   */
  const chance = clamp(
    (POACH.baseChance + (POACH.loyaltyBelow - target.stats.loyalty) * POACH.perLoyaltyPoint) *
      traitEffect(target, 'poachable') *
      goalEffect(target, 'poachable') *
      poachableFromMemory(target, state.day),
    0.05,
    0.95,
  );

  if (rng.chance(chance)) {
    // The player finds out only because somebody stopped turning up.
    defectToRival(state, target, faction.id);
    adjustRelationship(state, faction.id, 'player', POACH.relationshipHit);
    record(
      state,
      faction,
      {
        kind: 'poach',
        territoryId: null,
        targetFactionId: 'player',
        detail: `${def.shortName} took ${target.name} off you.`,
      },
      true,
    );
  } else {
    // He turned them down — and tells you, which is worth more than the money.
    target.stats.loyalty = clamp(target.stats.loyalty + POACH.refusedLoyalty, 0, 100);
    addNote(target, state.day, `Was approached by the ${def.shortName} and said no.`, 'good');
    addLog(
      state,
      `${target.name} says the ${def.shortName} made them an offer. They turned it down and told you.`,
      'crew',
    );
  }
}

// ------------------------------------------------------------------- tick ---

/** Weekly income and the bill that comes with being an organization. */
function collectIncome(state: GameState, faction: Faction): void {
  const held = districtsHeld(state, faction.id).length;
  const income =
    AI.incomeBase + held * AI.incomePerDistrict + faction.businessCount * AI.invest.incomePerBusiness;

  /*
   * The bill.
   *
   * Without it a family's balance sheet only ever went up — income every week,
   * spending that stopped the moment the board was settled, and `consolidate`
   * actually paying them to do nothing. Measured at $137M after thirty years,
   * a number no system in the game can read meaningfully, and which meant
   * money stopped constraining any decision after about year three.
   */
  const upkeep =
    AI.upkeepBase +
    // Superlinear: see upkeepDistrictScale. The tenth street costs more to
    // hold than the second, which is what gives an empire a ceiling.
    held * AI.upkeepPerDistrict * (1 + held * AI.upkeepDistrictScale) +
    faction.businessCount * AI.upkeepPerBusiness +
    faction.strength * AI.upkeepPerStrength;

  faction.wealth += income - upkeep;
  if (faction.wealth < 0) {
    /*
     * They cannot make the payroll, so people stop turning up.
     *
     * Letting wealth simply floor at zero was worse than no upkeep at all: it
     * paralysed them. Every action a family can take costs money, so a broke
     * family expands nothing, pressures nobody and buys nothing — the city
     * went as quiet as it had been before the upkeep existed, by a completely
     * different route. Losing muscle instead makes poverty a spiral with a
     * bottom, and it is what finally makes the three families differ in
     * strength — which is the precondition for any of them starting a war.
     */
    faction.strength = clamp(
      faction.strength + faction.wealth * AI.shortfallStrengthPer,
      0,
      100,
    );
    faction.wealth = 0;
  }
  faction.heat = clamp(faction.heat - AI.heatDecayPerWeek, 0, 100);

}

/*
 * The weekly drift on every bond used to live here, as one number sliding back
 * toward zero. It now lives in diplomacy.ts:tickBonds, because the three
 * dimensions move for different reasons and at different speeds: a grudge
 * fades, trust is built by peace holding, and respect settles toward what the
 * organization can currently actually do rather than what it once did.
 */

// ---------------------------------------------------------------- agenda ---

/** Does this option serve what they are currently trying to do? */
function servesAgenda(faction: Faction, option: Option): boolean {
  const agenda = faction.agenda;
  if (!agenda) return false;
  switch (agenda.kind) {
    case 'take_district':
      return (
        (option.kind === 'expand' || option.kind === 'pressure') &&
        option.territoryId === agenda.territoryId
      );
    case 'ruin':
      return (
        (option.kind === 'pressure' || option.kind === 'diplomacy' || option.kind === 'poach') &&
        option.targetFactionId === agenda.targetFactionId
      );
    case 'get_rich':
      return option.kind === 'invest' || option.kind === 'expand';
    case 'go_quiet':
      return option.kind === 'consolidate' || option.kind === 'diplomacy';
    case 'be_respectable':
      return option.kind === 'invest' || option.kind === 'consolidate';
  }
}

/**
 * What the family is trying to do this season.
 *
 * The six verbs in the weekly scorer are all opportunistic: they answer "what
 * is worth doing right now", and once the obvious moves are taken the honest
 * answer is nothing. Measured over twenty years, two of the three families
 * were idle in 65% and 90% of weeks — a city that had finished in year three
 * and then sat there.
 *
 * An agenda is what an organization has instead of an opportunity. It lasts
 * months, it bends the weekly scores toward itself, and it lowers the bar for
 * acting at all, which is the whole cure for the idling.
 */
function reviewAgenda(state: GameState, faction: Faction, rng: Rng): void {
  if (faction.agenda && state.day < faction.agenda.until) {
    // Taking the district was the entire point of taking the district.
    if (faction.agenda.kind === 'take_district' && faction.agenda.territoryId) {
      const t = state.territories[faction.agenda.territoryId];
      if (t && factionInfluence(t, faction.id) >= 60) faction.agenda = null;
    }
    if (faction.agenda) return;
  }

  const personality = temperament(state, faction);
  const held = districtsHeld(state, faction.id);
  const options: {
    kind: FactionAgenda['kind'];
    score: number;
    territoryId: string | null;
    target: FactionId | null;
  }[] = [];

  // Somewhere worth wanting: valuable, reachable, and not already theirs.
  const reachable = new Set<string>();
  for (const t of held) {
    for (const neighbour of territoryDef(t.id).adjacent) reachable.add(neighbour);
  }
  let bestDistrict: { id: string; value: number } | null = null;
  for (const id of reachable) {
    const t = state.territories[id];
    if (!t || factionInfluence(t, faction.id) >= 60) continue;
    const value = territoryDef(id).strategicValue / 100;
    if (!bestDistrict || value > bestDistrict.value) bestDistrict = { id, value };
  }
  if (bestDistrict) {
    options.push({
      kind: 'take_district',
      score: personality.ambition * bestDistrict.value * AGENDA.weights.take_district,
      territoryId: bestDistrict.id,
      target: null,
    });
  }

  // Somebody they have decided is the problem.
  for (const other of ALL_FACTIONS) {
    if (other === faction.id) continue;
    const standing = relationship(state, faction.id, other);
    if (standing > AGENDA.ruinBelow) continue;
    options.push({
      kind: 'ruin',
      score: personality.aggression * clamp(-standing / 100, 0, 1) * AGENDA.weights.ruin,
      territoryId: null,
      target: other,
    });
  }

  options.push({
    kind: 'get_rich',
    score: personality.commerce * AGENDA.weights.get_rich,
    territoryId: null,
    target: null,
  });
  if (faction.heat >= AGENDA.quietAbove) {
    options.push({
      kind: 'go_quiet',
      score: personality.caution * (faction.heat / 100) * 2 * AGENDA.weights.go_quiet,
      territoryId: null,
      target: null,
    });
  }
  options.push({
    kind: 'be_respectable',
    score: personality.commerce * personality.caution * AGENDA.weights.be_respectable,
    territoryId: null,
    target: null,
  });

  for (const option of options) option.score += rng.float(0, AI.scoreJitter);
  const chosen = options.reduce((a, b) => (b.score > a.score ? b : a));

  faction.agenda = {
    kind: chosen.kind,
    territoryId: chosen.territoryId,
    targetFactionId: chosen.target,
    since: state.day,
    until: state.day + rng.int(AGENDA.durationDays[0], AGENDA.durationDays[1]),
  };

  recordChoice(
    state,
    faction.id,
    'agenda',
    options.map((o) => ({ label: AGENDA_LABEL[o.kind], score: o.score })),
    AGENDA_LABEL[chosen.kind],
    `Set by ${faction.leader?.name ?? 'nobody in particular'}.`,
  );
}

/**
 * The decision loop. Runs weekly for each family.
 *
 * Difficulty scales how forcefully rivals act rather than how often — a Brutal
 * world has the same families making the same kinds of decisions with more
 * behind them.
 */
export function tickFactions(state: GameState, rng: Rng): void {
  tickLeaders(state, rng);
  if (state.day % FACTION_DECISION_INTERVAL_DAYS !== 0) return;
  // Old business stops being brought up, and certainty fades even where the
  // grudge does not.
  tickBeliefs(state);
  // Grudges fade, peace earns trust, and respect settles toward what each
  // organization can currently put on the street.
  tickBonds(state, (id) => districtsHeld(state, id).length);
  const diff = DIFFICULTY_BY_ID[state.difficulty];

  for (const faction of rivals(state)) {
    collectIncome(state, faction);

    // What was taken off them stops being this week's business. A grievance
    // should be about what is happening to you, not what once did.
    if (faction.groundLost) {
      for (const key of Object.keys(faction.groundLost)) {
        const left = faction.groundLost[key] - GROUND_LOST.decayPerWeek;
        if (left <= 0) delete faction.groundLost[key];
        else faction.groundLost[key] = left;
      }
    }

    reviewAgenda(state, faction, rng);

    // Working against somebody is not a mood, it is a set of weekly acts, and
    // it makes the thing it is built on worse. The relationship floor in
    // adjustRelationship still applies: this can take two organizations to the
    // brink, and crossing it remains somebody's decision.
    if (faction.agenda?.kind === 'ruin' && faction.agenda.targetFactionId) {
      adjustRelationship(state, faction.id, faction.agenda.targetFactionId, AGENDA.ruinPerWeek);
    }

    // --- goals: price every option against the board as it stands now ---
    const options = [
      scoreExpand(state, faction, rng),
      scorePressure(state, faction, rng),
      scoreInvest(state, faction, rng),
      scoreConsolidate(state, faction, rng),
      scoreDiplomacy(state, faction, rng),
      scorePoach(state, faction, rng),
    ];

    // --- risk: their own attention makes everything loud look worse ---
    const cityMood = worldMod(state, 'rivalAggression');
    for (const option of options) {
      if (option.kind === 'expand' || option.kind === 'pressure') {
        option.score *= clamp(1 - faction.heat / 140, 0.25, 1);
        // Aggression is the one thing difficulty turns up.
        if (option.kind === 'pressure') option.score *= diff.eventPressure;
        // ...and the one thing the city can talk everybody out of. A sitdown
        // does not stop a family investing or talking, only pushing.
        option.score *= cityMood;
      }
    }

    /*
     * --- agenda: bend everything toward what they are actually trying to do ---
     *
     * Suspended entirely when the family's own attention has become dangerous.
     * Going quiet above `heatAlarmAbove` is meant to happen regardless of
     * personality, and an agenda must not be able to override it.
     *
     * The first attempt exempted `consolidate` from the suppression half and
     * left the boost half alone, which did not work and took the new decision
     * tracer to see why: the Vasari were not scoring consolidation too low,
     * they were scoring `invest` too high — a `get_rich` agenda multiplying it
     * to 1.43 against consolidation's 0.86, so they bought fronts every week
     * at heat 80. Protecting one option is no use when the plan can promote
     * another past it. Panic suspends the plan.
     */
    const alarmed = faction.heat > AI.heatAlarmAbove;
    if (!alarmed) {
      for (const option of options) {
        option.score *= servesAgenda(faction, option) ? AGENDA.boost : AGENDA.suppress;
      }
    }

    // --- decision ---
    const choice = options.reduce((a, b) => (b.score > a.score ? b : a));
    const threshold = faction.agenda ? AGENDA.actionThreshold : AI.actionThreshold;

    recordChoice(
      state,
      faction.id,
      'week',
      options.map((o) => ({ label: o.kind, score: o.score })),
      choice.score < threshold ? 'nothing' : choice.kind,
      /*
         Read through the player's eyes, not the simulation's.

         This printed `faction.wealth` and friends raw, so the Why panel showed
         a rival's exact money on the same day the Rivals panel called it
         "unknown" — round 13 put the two screens side by side and quoted both.
         Two contradictory fog-of-war rules is worse than either one.

         The panel's own header says it is "deliberately not a state inspector —
         the perception system is the game, and a screen that printed everybody's
         true stats would quietly switch it off". It was doing exactly that. The
         decision scores are the point of the trace and stay in full; only the
         state behind them is now gated, and it is gated by reusing the function
         the Rivals panel uses so the two cannot drift apart again.
      */
      (() => {
        const read = readFaction(state, faction);
        return `Agenda ${
          faction.agenda ? AGENDA_LABEL[faction.agenda.kind] : 'none'
        }; wealth ${read.wealth}, strength ${read.strength}, heat ${read.heat}.`;
      })(),
    );

    if (choice.score < threshold) {
      faction.currentObjective = null;
      continue;
    }

    faction.currentObjective = {
      kind: choice.kind,
      territoryId: choice.territoryId,
      targetFactionId: choice.targetFactionId,
      since: state.day,
    };

    switch (choice.kind) {
      case 'expand':
        if (choice.territoryId) executeExpand(state, faction, rng, choice);
        break;
      case 'pressure':
        if (choice.territoryId) executePressure(state, faction, rng, choice);
        break;
      case 'invest':
        executeInvest(state, faction);
        break;
      case 'consolidate':
        executeConsolidate(state, faction);
        break;
      case 'diplomacy':
        executeDiplomacy(state, faction, choice);
        break;
      case 'poach':
        executePoach(state, faction, rng);
        break;
    }
  }
}

/**
 * Called when the player gains ground.
 *
 * Families notice being pushed out of districts they were standing in — but
 * noticing is not the same as knowing who did it, and for a long time this
 * function conflated the two. It resented the player, instantly and
 * correctly, on every single successful operation. A family could be pushed
 * out of a district it barely stood in, by a crew that left nothing behind,
 * and still name the culprit without hesitating.
 *
 * Now the loss is attributed. If they cannot tell, somebody plausible takes
 * the blame instead — and since relationships already drive the `ruin` agenda,
 * pressure targeting and war declarations, a family that blames the wrong
 * party redirects months of hostility at them without a line of new AI.
 *
 * `care` is 0..1: how quietly it was done. The caller knows, because the
 * caller knows who did the work.
 */
export function noteInfluenceTaken(
  state: GameState,
  rng: Rng,
  territoryId: string,
  amount: number,
  care = 0,
): void {
  const t = state.territories[territoryId];
  if (!t || amount <= 0) return;

  for (const faction of rivals(state)) {
    // Only the families actually present in the district care. Same threshold
    // as presence everywhere else — a family standing on a block notices.
    const theirs = factionInfluence(t, faction.id);
    if (theirs < 10) continue;

    const blame = attribute(state, rng, faction.id, 'player', territoryId, 'ground', care);
    const stake = clamp(theirs / 100, 0, 1);
    adjustRelationship(
      state,
      faction.id,
      blame.believed,
      amount * RELATIONSHIP_PER_INFLUENCE_TAKEN * stake * damageShare(blame.confidence),
    );

    /*
       And the same loss again, written down.

       See config/factions.ts:GROUND_LOST. The drip above moves how they feel;
       this is what they remember, and `scorePressure` reads it in place of a
       lead the family no longer has. Keyed by who they *think* did it, so a
       family that blames the wrong neighbour goes to the wrong door — same as
       everything else downstream of `attribute`.
    */
    faction.groundLost ??= {};
    const key = `${blame.believed}:${territoryId}`;
    faction.groundLost[key] =
      (faction.groundLost[key] ?? 0) + amount * damageShare(blame.confidence);

    if (blame.mistaken) {
      recordChoice(
        state,
        faction.id,
        'blame',
        [{ label: houseShort(state, blame.believed), score: blame.confidence }],
        houseShort(state, blame.believed),
        `Lost ground in ${territoryDef(territoryId).name} and decided who was behind it.`,
      );
    }
  }
}

// ----------------------------------------------------------------- intel ---

/**
 * How well the player can read a family: how many districts they actually
 * share. You learn about people by standing near them.
 */
export function factionIntel(state: GameState, id: FactionId): number {
  let shared = 0;
  for (const t of territoryList(state)) {
    if (playerInfluence(t) >= 10 && factionInfluence(t, id) >= 10) shared += 1;
  }
  return Math.min(100, shared * FACTION_INTEL_PER_SHARED_DISTRICT);
}

export function relationshipLabel(value: number): string {
  return RELATIONSHIP_STATES.find((r) => value >= r.min)?.label ?? 'Neutral';
}

export interface FactionRead {
  faction: Faction;
  intel: number;
  /** Null when the player cannot tell. */
  wealth: string;
  strength: string;
  heat: string;
  /** What they appear to be doing, if the player can tell at all. */
  objective: string;
  /** Actions the player actually witnessed. */
  known: FactionAction[];
}

/** Everything the Rivals panel is allowed to show, and nothing more. */
export function readFaction(state: GameState, faction: Faction): FactionRead {
  const intel = factionIntel(state, faction.id);
  const precise = intel >= FACTION_INTEL_PRECISE_ABOVE;
  const rough = intel >= FACTION_INTEL_ROUGH_ABOVE;

  /*
     `format` exists because one of these three is money and two are scores.

     A precise read returned `String(Math.round(value))` for all of them, so a
     rival the player knew well had their wealth reported as `1547392` in a
     column beside "considerable" and "thin". A round-7 tester wrote it down as
     unformatted money in Rivals and it has been sitting in the report since.
     Strength and heat are 0-100 and should stay bare; money should not.
  */
  const band = (
    value: number,
    scale: number,
    format: (n: number) => string = (n) => String(Math.round(n)),
  ): string => {
    if (precise) return format(value);
    if (!rough) return 'unknown';
    const ratio = value / scale;
    return ratio > 0.7 ? 'considerable' : ratio > 0.35 ? 'moderate' : 'thin';
  };

  /*
   * Two different unknowns, which were being reported identically: not knowing
   * anything about them, and knowing them well on a week where they did
   * nothing worth doing. The second is information.
   */
  let objective = rough
    ? 'Sitting still this week.'
    : 'You have no idea what they are doing.';

  if (faction.currentObjective && rough) {
    const where = faction.currentObjective.territoryId
      ? territoryDef(faction.currentObjective.territoryId).name
      : null;
    switch (faction.currentObjective.kind) {
      case 'expand':
        objective = precise && where ? `Moving into ${where}.` : 'Taking new ground.';
        break;
      case 'pressure':
        objective =
          precise && where
            ? `Pushing somebody out of ${where}.`
            : 'Leaning on somebody.';
        break;
      case 'invest':
        objective = 'Putting money into legitimate business.';
        break;
      case 'consolidate':
        objective = 'Keeping their heads down.';
        break;
    }
  }

  return {
    faction,
    intel,
    wealth: band(faction.wealth, 1_500_000, formatMoneyShort),
    strength: band(faction.strength, 100),
    heat: band(faction.heat, 100),
    objective,
    known: faction.history.filter((h) => h.observed).slice(0, 12),
  };
}

/** Districts where the player and this family are both standing. */
export function contestedWith(state: GameState, id: FactionId): Territory[] {
  return territoryList(state).filter(
    (t) => playerInfluence(t) >= 10 && factionInfluence(t, id) >= 10,
  );
}

/** Used by the dashboard: is anybody actively angry at the player? */
export function mostHostile(state: GameState): Faction | null {
  // Read as their opinion of the player, which is the question being asked.
  // For the player the two directions are the same record — see `bond` — so
  // this is a statement of intent rather than a change of behaviour.
  const sorted = rivals(state)
    .slice()
    .sort((a, b) => relationship(state, a.id, 'player') - relationship(state, b.id, 'player'));
  return sorted.length && relationship(state, sorted[0].id, 'player') < -15 ? sorted[0] : null;
}
