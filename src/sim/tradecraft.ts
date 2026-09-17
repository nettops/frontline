/**
 * Saying it out loud.
 *
 * The design argument is in `config/tradecraft.ts`. What this file has to keep
 * true is three things:
 *
 * 1. **The walk is genuinely free of risk and genuinely not free.** It draws
 *    nothing from the causal stream, adds nothing to any file, and cannot
 *    misfire. It spends `went_home_day`, which is the one resource the boss
 *    cannot buy more of — the same flag `goHome`, `visitConfidant`,
 *    `consultDoctor` and `visitPetProject` all charge against. That is the
 *    entire price and there is no other.
 *
 * 2. **A refusal says what would lift it.** An evening that is already spoken
 *    for is the only way a transmission can be declined, and it is declined
 *    before anything has happened — no money, no draw, no line on a file.
 *
 * 3. **Evidence lands on a real file and is itemised.** Where a wire hears the
 *    call, the 2.5 goes onto the strongest open case, onto its `lastGrowth`
 *    breakdown, and onto its history through `recordCaseEvent` — the same
 *    three writes `suburbs.ts`'s panicked neighbour makes, for the same
 *    reason. A case that grew with nothing on the breakdown to show for it is
 *    the one thing this project's third rule forbids.
 */

import { Rng } from './rng';
import type { GameState, Investigation, Npc } from './types';
import { TRADECRAFT, type TransmissionMethod } from '../config/tradecraft';
import { stageIndex } from '../config/lawEnforcement';
import { activeCases, recordCaseEvent } from './investigation';
import { addHeat } from './heat';
import { addNote } from './npc';
import { addLog } from './util';

export interface Transmission {
  ok: boolean;
  /** A wire was on the line and the order is now on a tape. */
  wiretapHeard: boolean;
  /** He took the metaphor the wrong way and did more than he was asked. */
  misfire: boolean;
  /** Street heat the misfire cost, or zero. */
  extraHeat: number;
  message: string;
}

const refused = (message: string): Transmission => ({
  ok: false,
  wiretapHeard: false,
  misfire: false,
  extraHeat: 0,
  message,
});

/**
 * The file a phone call lands on, if there is one.
 *
 * Strongest first, exactly as `tickSuburban` picks the file a panicked
 * neighbour's statement goes to: a van outside belongs to the agency that has
 * the most already, and that is the one with somebody on the line. A case has
 * to be at `surveillance` at least — a file still at `rumor` has nobody
 * sitting in a car with headphones on.
 *
 * `wireIsLive` in `tribute.ts` asks a strictly narrower version of this same
 * question (a confidant talking *and* a case with a van outside). It is not
 * called here because everything it would catch this already catches: a live
 * wire cannot exist without a case past `surveillance`, and the federal van
 * is on the line whether or not anybody at home is being indiscreet.
 */
function listeningCase(state: GameState): Investigation | null {
  const heard = activeCases(state).filter(
    (c) => stageIndex(c.stage) >= stageIndex('surveillance'),
  );
  if (heard.length === 0) return null;
  return heard.reduce((a, b) => (b.strength > a.strength ? b : a));
}

/**
 * How likely this particular man is to hear something other than what was
 * said.
 *
 * Multiplicative rather than additive so a hot-headed man with no discipline
 * is meaningfully worse than either fault alone — that man is the reason the
 * walk exists, and the numbers should say so.
 */
export function misfireChance(enforcer: Npc): number {
  let chance = TRADECRAFT.misfireBaseChance;
  if (enforcer.stats.discipline < TRADECRAFT.misfireDisciplineBelow) {
    chance *= TRADECRAFT.misfireDisciplineMultiplier;
  }
  if (enforcer.traits.some((t) => TRADECRAFT.misfireTraits.includes(t))) {
    chance *= TRADECRAFT.misfireTraitMultiplier;
  }
  return chance;
}

/**
 * Giving the order.
 *
 * `opOrContractName` is what the order was about, and it is only ever used in
 * prose — the tape, the note on his sheet, the line the player reads. Nothing
 * mechanical reads it, which is why it is a string rather than an id.
 */
export function transmitOrder(
  state: GameState,
  method: TransmissionMethod,
  enforcer: Npc,
  opOrContractName: string,
): Transmission {
  if (method === 'walk_and_talk') {
    if (TRADECRAFT.walkAndTalkEveningCost && state.flags['went_home_day'] === state.day) {
      return refused(
        'Tonight is already spoken for. You cannot be in two places — walk him round a block tomorrow, or say it on the phone.',
      );
    }
    if (TRADECRAFT.walkAndTalkEveningCost) state.flags['went_home_day'] = state.day;
    addLog(
      state,
      `You walked ${enforcer.name} round the block twice and told him about ${opOrContractName}. Nothing of it exists anywhere.`,
      'crew',
    );
    return { ok: true, wiretapHeard: false, misfire: false, extraHeat: 0, message: 'He has it.' };
  }

  /*
     The phone. Two independent bad things, and they are independent on
     purpose: a wire hearing a perfectly-given order and a man mishearing an
     order nobody recorded are different failures with different bills, and
     a night can produce both.
  */
  const file = listeningCase(state);
  let wiretapHeard = false;
  if (file) {
    wiretapHeard = true;
    const added = TRADECRAFT.wiretapInterceptionEvidence;
    file.strength += added;
    /*
       Itemised into `absorbed` rather than left off the breakdown. Absent
       until the case's own weekly tick has run once, so it is created rather
       than assumed — same handling as `tickSuburban`'s statement.
    */
    file.lastGrowth = file.lastGrowth
      ? { ...file.lastGrowth, absorbed: file.lastGrowth.absorbed + added }
      : { absorbed: added, work: 0, visibility: 0 };
    file.lastProgressDay = state.day;
    /*
       `obvious: false`. A tape is the one thing in this game that the subject
       genuinely does not know about — the player finds out when it is read
       back to a jury, or when they have paid somebody inside the agency, and
       `recordCaseEvent` already applies exactly that rule.
    */
    recordCaseEvent(
      state,
      file,
      `A call about ${opOrContractName} went onto a reel. Whatever the words were, the voices are clear.`,
      false,
    );
  }

  const rng = new Rng(state.rng);
  const misfire = rng.chance(misfireChance(enforcer));
  let extraHeat = 0;
  if (misfire) {
    extraHeat = TRADECRAFT.misfireHeat;
    addHeat(state, extraHeat, 'street', 'somebody did rather more than he was asked to');
    addNote(
      enforcer,
      state.day,
      `Was told about ${opOrContractName} over a phone and heard something larger.`,
      'bad',
    );
    addLog(
      state,
      `${enforcer.name} took what you said about ${opOrContractName} the wrong way, and the whole street knows what he did about it.`,
      'failure',
    );
  }

  return {
    ok: true,
    wiretapHeard,
    misfire,
    extraHeat,
    message: misfire ? 'He heard something else.' : 'He has it.',
  };
}
