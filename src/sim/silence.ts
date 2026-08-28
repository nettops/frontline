/**
 * Deciding somebody does not walk out of here.
 *
 * The organization screen has had exactly one answer to a man who keeps
 * costing you money, and it is `dismiss` in `crew.ts`. That answer is not
 * free — he goes onto the street knowing how the operation works, and the
 * game files an informant trace for it, scaled by how much he knew. But it
 * was the *only* answer, and the one killing this game offered runs through
 * `accuse`, which refuses until something has already come back to you.
 *
 * So a man could botch six jobs in a row and the only thing a boss in a game
 * about this world could do was shake his hand and hand the Bureau a witness.
 *
 * **This is ungated on purpose.** Any man, any day. What stops you is the
 * bill, not a rule — the same stance `config/delegation.ts` takes about
 * handing a district to somebody: the game does not prevent the mistake, it
 * prices it and lets you read the record afterwards.
 *
 * The design lives in `config/silence.ts`. The one property this file has to
 * keep is that **neither answer dominates**: dismissal is cheap, certain, and
 * leaves a man who can talk; this is expensive, uncertain, and leaves nobody.
 * A player who can always name the better one is not making a decision, and
 * `__tests__/silence.test.ts` asserts it in both directions.
 */

import type { GameState, Id, Npc } from './types';
import { Rng, clamp } from './rng';
import { addEvidence, addLog } from './util';
import { addHeat } from './heat';
import { addNote, crewList, traitEffect } from './npc';
import { remember } from './memory';
import { gainFear } from './player';
import { SILENCE } from '../config/silence';
import { putOutMark } from './marks';
import { DISMISSAL } from '../config/npcs';
import { CREW_SKILL_VS_DISCIPLINE } from '../config/operations';

export interface SilenceCheck {
  ok: boolean;
  message: string;
  /** What it would come off at, so the panel can say so before you click. */
  chance?: number;
}

/**
 * How likely it is to go the way you wanted.
 *
 * Read off the same two stats and the same weighting `crewCompetence` uses,
 * because being hard to get to is not a separate quality from being good — a
 * man who notices things notices this one. The consequence is the trade worth
 * having: your best earner is also the most expensive person to remove, and
 * the man who keeps botching jobs is the easiest.
 *
 * Deliberately reads the *true* numbers rather than `perceive`. This is not a
 * judgement the player is making about him; it is what is actually the case,
 * and the panel showing the figure is the game being honest about a decision
 * it is not going to let you take back.
 */
function chanceOf(npc: Npc): number {
  const competence =
    npc.stats.skill * CREW_SKILL_VS_DISCIPLINE +
    npc.stats.discipline * (1 - CREW_SKILL_VS_DISCIPLINE);
  return clamp(
    SILENCE.base - (competence / 100) * SILENCE.perCompetence,
    SILENCE.minChance,
    SILENCE.maxChance,
  );
}

export function canSilence(state: GameState, npcId: Id): SilenceCheck {
  const npc = state.npcs[npcId];
  if (!npc) return { ok: false, message: 'No such person.' };
  if (npc.status === 'dead' || npc.status === 'defected') {
    return { ok: false, message: `${npc.name} is already gone.` };
  }
  if (npc.status === 'arrested') {
    return { ok: false, message: `${npc.name} is inside. Nobody reaches them there.` };
  }
  if (npc.status === 'busy') {
    return { ok: false, message: 'They are in the middle of a job.' };
  }
  if (npc.status === 'boss') {
    return { ok: false, message: 'That is you.' };
  }
  return {
    ok: true,
    message: `Make sure ${npc.name} does not talk`,
    chance: chanceOf(npc),
  };
}

/**
 * What the rest of them take from having watched it.
 *
 * Two separate things, and keeping them apart is the point. **Everybody** is
 * frightened — that is what fear is, and it suppresses defection and informing
 * through paths that already exist. Only the men who actually knew him lose
 * any loyalty over it, scaled by how close they were, because a crew who never
 * met him have witnessed a killing and not a loss.
 */
function theRoomFindsOut(state: GameState, gone: Npc, worked: boolean): void {
  gainFear(state, worked ? SILENCE.fear : SILENCE.fearOnFailure);

  for (const npc of crewList(state)) {
    if (npc.id === gone.id) continue;
    if (npc.status === 'dead' || npc.status === 'defected') continue;
    if (npc.familiarity < SILENCE.knewHimAbove) continue;

    const tie = npc.ties.find((t) => t.id === gone.id);
    if (!tie || tie.trust < SILENCE.closeAbove) continue;

    npc.stats.loyalty = clamp(
      npc.stats.loyalty - tie.trust * SILENCE.loyaltyPerTrust,
      0,
      100,
    );
    remember(npc, state.day, 'lost_a_friend', gone.id);
    addNote(npc, state.day, `${gone.name} went missing.`, 'bad');
  }
}

/**
 * Doing it.
 *
 * There is no lesser version and no way to call it back, which is the same
 * shape `accuse` has and for the same reason. What separates the two outcomes
 * is not how much it costs — both are loud — but *what is left standing*.
 */
export function silence(state: GameState, rng: Rng, npcId: Id): SilenceCheck {
  const guard = canSilence(state, npcId);
  if (!guard.ok) return guard;

  const npc = state.npcs[npcId];
  const worked = rng.chance(chanceOf(npc));
  npc.unavailableUntilDay = null;

  if (worked) {
    npc.status = 'dead';
    // Whatever he was doing for the other side, he has stopped.
    npc.informingSince = undefined;
    addNote(npc, state.day, 'You decided they were finished.', 'bad');
    addHeat(state, SILENCE.heat, 'street', 'a man of yours found dead');
    /*
       The purchase. A violence trace and nothing from inside — this is the
       only exit in the game that does not leave somebody who can be asked
       questions, and it is the entire reason to pay for it.
    */
    addEvidence(state, {
      day: state.day,
      source: 'violence',
      strength: SILENCE.evidenceStrength,
      npcIds: [npc.id],
      detail: `${npc.name} was found. They worked for you and everybody knew it.`,
    });
    addLog(state, `${npc.name} will not be talking to anybody.`, 'crew');
  } else {
    /*
       Worse than never having tried, and that is the point of the roll.

       He is not merely a man who knows how you operate now. He is a man who
       can say you tried to have him killed, and every reason to say it.
    */
    npc.status = 'defected';
    addNote(npc, state.day, 'They know what you tried to do.', 'bad');
    addHeat(state, SILENCE.heatOnFailure, 'street', 'somebody survived something');
    addEvidence(state, {
      day: state.day,
      source: 'informant',
      strength: Math.round(
        (DISMISSAL.evidenceStrength + SILENCE.evidenceOnFailure + npc.familiarity / 10) *
          traitEffect(npc, 'exposure'),
      ),
      npcIds: [npc.id],
      detail: `${npc.name} got away, and has a great deal to say about why they ran.`,
    });
    addLog(
      state,
      `It did not go the way it was supposed to. ${npc.name} is gone, and talking.`,
      'crew',
    );
    /*
       And nobody calls it off there.

       A family that tries once and shrugs is not one anybody would be afraid
       of, and a single roll made the whole decision a coin flip you could not
       follow up. The mark keeps working on its own — see `marks.ts`, and note
       that it is a race rather than a retry: he is talking the entire time it
       stands.
    */
    putOutMark(state, npc.id);
  }

  theRoomFindsOut(state, npc, worked);
  return {
    ok: true,
    message: worked ? `${npc.name} is not a problem now.` : `${npc.name} got away.`,
  };
}
