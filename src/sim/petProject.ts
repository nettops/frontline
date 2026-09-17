/**
 * The place that is not work, and what the life does to it.
 *
 * The design argument is in `config/petProject.ts`. The mechanics that
 * matter:
 *
 * **It is bought with clean money and it never earns.** Deliberately not a
 * `Business` — no laundering, no exposure, no upkeep, no district. Every
 * other asset in the game is an input to the machine; this one is the only
 * place the machine does not reach, and making it a front with a stress perk
 * bolted on would have quietly turned it into one more thing to optimise.
 *
 * **`contagion` is the whole of it.** One number, rising every week the boss
 * does nothing, and it does exactly two things: it eats the relief the place
 * was bought for, and past `raidThreshold` it is what gets the place raided.
 *
 * **Both answers cost.** Leave it and the peace decays to nothing. Sweep it
 * and you have told your own captains they are not welcome where you go,
 * which is `sanitizeCapoGrievance` on every one of them and two points of
 * respect off the top.
 */

import { Rng, clamp } from './rng';
import type { GameState, PetProjectState } from './types';
import { CONTAGION, PET_PROJECT_BY_ID, type PetProjectDef } from '../config/petProject';
import { STRESS } from '../config/personal';
import { activeCapos } from './capoTension';
import { addNote } from './npc';
import { gainRespect } from './player';
import { playerStress } from './personal';
import { addHeat } from './heat';
import { note } from './ledger';
import { addEvidence, addLog } from './util';

/** Lazy, so a save written before this existed loads as somebody who never bought one. */
export function petProjectState(state: GameState): PetProjectState {
  if (!state.petProject) state.petProject = { current: null, contagion: 0 };
  return state.petProject;
}

/** The catalogue entry behind whatever the boss owns, or undefined. */
export function petProjectDef(state: GameState): PetProjectDef | undefined {
  const held = petProjectState(state).current;
  return held ? PET_PROJECT_BY_ID[held.defId] : undefined;
}

/**
 * What a visit or a quiet week is actually worth, after the crew.
 *
 * One expression, used by both the evening and the weekly tick, so the two
 * cannot disagree about what a contaminated place is worth. At `raidThreshold`
 * the place already returns a quarter of what it did — the decay is felt long
 * before the raid, which is the point.
 */
export function reliefScale(contagion: number): number {
  return clamp(1 - contagion / 100, 0, 1);
}

export interface PetProjectAction {
  ok: boolean;
  message: string;
}

/**
 * Whether there is a place to buy and money that can buy it.
 *
 * Clean money only, and the refusal says so — a man does not pay for a
 * racehorse out of a paper bag, and the whole character of the asset is that
 * it is the one thing the boss owns that could survive being looked at.
 */
export function canBuyPetProject(state: GameState, projectId: string): PetProjectAction {
  const def = PET_PROJECT_BY_ID[projectId];
  if (!def) return { ok: false, message: 'There is no such place.' };
  const held = petProjectState(state);
  if (held.current) {
    const owned = PET_PROJECT_BY_ID[held.current.defId];
    return {
      ok: false,
      message: `You already have ${owned?.name ?? 'somewhere'}. One is the whole idea.`,
    };
  }
  if (state.org.cash < def.cost) {
    return {
      ok: false,
      message:
        `${def.name} runs $${def.cost.toLocaleString('en-US')} and it has to come out of clean money. ` +
        `You have $${Math.round(state.org.cash).toLocaleString('en-US')} that could stand being asked about.`,
    };
  }
  return { ok: true, message: '' };
}

export function buyPetProject(state: GameState, projectId: string): PetProjectAction {
  const check = canBuyPetProject(state, projectId);
  if (!check.ok) return check;
  const def = PET_PROJECT_BY_ID[projectId];

  /*
     Straight off `org.cash` rather than through `spend`, which takes dirty
     money first — that is exactly the thing this purchase is not allowed to
     do. Booked to `premises` by hand so the weekly close still balances; see
     `config/ledger.ts` on why unlabelled money is the standing failure mode.
  */
  state.org.cash -= def.cost;
  note(state, 'premises', -def.cost);

  petProjectState(state).current = { defId: def.id, boughtDay: state.day };
  const message = `${def.name} is yours. Nobody in the family has any business being there.`;
  addLog(state, message, 'money');
  return { ok: true, message };
}

/** Whether tonight can be spent there. */
export function canVisitPetProject(state: GameState): PetProjectAction {
  const def = petProjectDef(state);
  if (!def) return { ok: false, message: 'There is nowhere to go that is not work.' };
  if (state.flags['went_home_day'] === state.day) {
    return { ok: false, message: 'Tonight is already spoken for. You cannot be in two places.' };
  }
  return { ok: true, message: '' };
}

/**
 * An evening there.
 *
 * Spends the same `went_home_day` an evening at home does — the body is the
 * resource and it is only ever spent once a night, the rule `goHome`,
 * `consultDoctor` and `visitConfidant` all follow.
 */
export function visitPetProject(state: GameState): PetProjectAction {
  const check = canVisitPetProject(state);
  if (!check.ok) return check;
  const held = petProjectState(state);
  const def = petProjectDef(state)!;

  const cleared = CONTAGION.visitStressRelief * reliefScale(held.contagion);
  state.player.stress = clamp(playerStress(state) - cleared, 0, STRESS.max);
  state.flags['went_home_day'] = state.day;

  /*
     And it says what it found, which is the whole of the warning the player
     gets before a raid. Named rather than hinted: rule four of this project
     says a gate names what would lift it, and the same courtesy is owed to a
     consequence the player is being walked toward.
  */
  const dirty = held.contagion >= CONTAGION.raidThreshold;
  const message = dirty
    ? `You went to ${def.name}. Two of Paulie's people were already there with a van backed up to the door. It was not an evening off.`
    : held.contagion > 0
      ? `You went to ${def.name}. Somebody from the crew was there, and made a point of being seen being respectful.`
      : `You went to ${def.name}. For two hours nobody wanted anything from you.`;
  addLog(state, message, 'crew');
  return { ok: true, message };
}

export function canSanitizePetProject(state: GameState): PetProjectAction {
  const held = petProjectState(state);
  if (!held.current) return { ok: false, message: 'There is nothing to clear out.' };
  if (held.contagion <= 0) {
    return { ok: false, message: 'There is nobody there who should not be there.' };
  }
  const since = state.day - (held.sanitizedDay ?? -9999);
  if (since < CONTAGION.sanitizeCooldownDays) {
    return {
      ok: false,
      message:
        `You cleared it out ${since === 0 ? 'today' : `${since} days ago`}. ` +
        `Saying it again inside ${CONTAGION.sanitizeCooldownDays} days is nagging, not an order.`,
    };
  }
  return { ok: true, message: '' };
}

/**
 * Telling your own captains they are not welcome.
 *
 * The cost is not money — it is that every man who has been drinking there
 * for six months now knows the boss has somewhere they are not good enough
 * for. `sanitizeInfluenceCost` comes off respect, which is the nearest thing
 * this game has to "how many people will take your call".
 */
export function sanitizePetProject(state: GameState): PetProjectAction {
  const check = canSanitizePetProject(state);
  if (!check.ok) return check;
  const held = petProjectState(state);
  const def = petProjectDef(state)!;

  held.contagion = 0;
  held.sanitizedDay = state.day;
  gainRespect(state, -CONTAGION.sanitizeInfluenceCost);
  for (const capo of activeCapos(state)) {
    capo.stats.grievance = clamp(
      capo.stats.grievance + CONTAGION.sanitizeCapoGrievance,
      0,
      100,
    );
    addNote(capo, state.day, "Told he is not welcome at the boss's place any more.", 'bad');
  }

  const message = `${def.name} is empty of them by Friday. Every capo you have heard about it by Saturday.`;
  addLog(state, message, 'crew');
  return { ok: true, message };
}

/**
 * Once a week: what the place gave back, and who else turned up.
 *
 * Draws from the causal stream for the raid, which is correct — it is an
 * outcome. Returns immediately on every other day, so `clock.ts` does not
 * have to know the interval.
 */
export function tickPetProject(state: GameState, rng: Rng): void {
  if (state.day % 7 !== 0) return;
  const held = petProjectState(state);
  const def = petProjectDef(state);
  if (!def) return;

  // The relief first, against this week's contagion — the boss gets the
  // benefit of the week he actually had, not of the week that is starting.
  const cleared = def.weeklyStressRelief * reliefScale(held.contagion);
  state.player.stress = clamp(playerStress(state) - cleared, 0, STRESS.max);

  const drift =
    CONTAGION.baseWeeklyDrift + activeCapos(state).length * CONTAGION.driftPerCapo;
  held.contagion = clamp(held.contagion + drift, 0, 100);

  if (held.contagion <= CONTAGION.raidThreshold) return;
  if (!rng.chance(CONTAGION.raidChance)) return;

  /*
     The bill. Heat on the street channel rather than money: this is a door
     coming off its hinges at four in the afternoon in front of the
     neighbours, not an accountant reading a return. The contagion is not
     reset — the raid does not clear the crew out, it only proves they were
     there, and clearing them out is still the boss's job to do and pay for.
  */
  addHeat(state, CONTAGION.raidHeat, 'street', `${def.name} was raided.`);
  addEvidence(state, {
    day: state.day,
    source: 'operation',
    strength: CONTAGION.raidEvidence,
    npcIds: activeCapos(state).map((c) => c.id),
    detail: `Property seized in a raid on ${def.name}.`,
  });
  addLog(
    state,
    `Police took the doors off ${def.name} and carried out four pallets of somebody else's stock. The one place that was not this.`,
    'heat',
  );
}
