/**
 * Somebody is waiting to see you.
 *
 * The game has had a second verb since the sit-down shipped, and until now
 * only the player could use it. `openSitdown` was called from two buttons —
 * one on the crew sheet, one on Diplomacy — and nothing in the simulation ever
 * opened a room. A boss could go to anybody's door. Nobody ever came to his.
 *
 * That is the whole of what this file changes. It does not add a conversation,
 * a screen or a mechanic; it answers the question "who wants a word" from
 * state the simulation already keeps, so the men who have a reason to ask are
 * standing there when the player looks up.
 *
 * ## Why this is a read and not an event
 *
 * `tickEvents` allows one authored memo at 0.16 a day and a generated one at
 * 0.11 only on the days the first missed, capped at three pending — a ceiling
 * of about a quarter of a memo per day, measured at 0.10 to 0.15 across three
 * seeds over 300 days. That channel is shared by every authored definition in
 * the game, so a new one does not add drama, it makes the existing drama
 * rarer.
 *
 * This project has already paid for that lesson and left the note at the scene:
 * `events.ts` carries a PARKED block for the partner offer, built with fourteen
 * green tests and withdrawn because "a new definition costs an authored one"
 * and it pushed a pre-committed Pacing axis under its bar.
 *
 * So an approach is not an event. It is a leaf read in the shape `attention.ts`
 * and `standing.ts` already use: nothing here is state, every line is derived
 * on read, and it costs no memo slot, no random draw and no field in the save.
 * Events stay the interrupt — rare, blocking, one at a time. This is the
 * ambient channel, always there, never forced.
 *
 * ## What it is allowed to know
 *
 * Everything below reads hidden stats — grievance, ambition, fear — which the
 * player is never shown and `perceive()` exists to blur. That is not a leak,
 * and the distinction is the point of the file: **the man is telling you.**
 * Somebody standing in your doorway because he is owed money is not the
 * simulation printing `grievance: 71`, it is the one honest route by which a
 * boss learns what his people are carrying.
 *
 * The rule that keeps it honest is that no line here may state a number or
 * name the stat. It says what he wants, in the words he would use. What he is
 * actually carrying stays behind `perceive()` where it was, and the sit-down
 * is still where you find out whether he is telling you the truth.
 *
 * ## And it can be empty
 *
 * `attention.ts` states the rule this follows: a list that is always full is
 * wallpaper. Three at the outside, a cooldown so the same man cannot stand
 * there every week, and a quiet month should show nobody at all.
 */

import type { GameState, Id, Npc } from './types';
import { crewList, isOutOfReach } from './npc';
import { promisesTo, daysLeft } from './promises';
import { PROMISE, PROMISES } from '../config/promises';
import { APPROACH } from '../config/approaches';
import { MEMORIES } from '../config/memories';

/**
 * How badly he wants the room, which is a statement about his clock.
 *
 * Deliberately not a statement about how much it matters — that is the
 * player's judgement and `attention.ts` refuses to make it for the same
 * reason. `now` means this resolves against you shortly whether or not you
 * turn up; `whenever` means nothing happens if you never do.
 */
export type Urgency = 'now' | 'soon' | 'whenever';

export interface Approach {
  npcId: Id;
  name: string;
  /** What he wants, in the words he would use. Never a stat and never a number. */
  text: string;
  /** Which reason the room opens on if the player takes it. */
  reasonId: string;
  urgency: Urgency;
}

const ORDER: Record<Urgency, number> = { now: 0, soon: 1, whenever: 2 };

/** The last time this man was in a room with the boss, via the sit-down's own flag. */
function daysSinceSeen(state: GameState, npcId: Id): number {
  const last = state.flags[`sat_${npcId}`];
  return last === undefined ? Number.POSITIVE_INFINITY : state.day - last;
}

/**
 * Whether he would even come.
 *
 * Somebody in a cell or a hospital bed is not standing in your doorway, and
 * somebody you sat with on Tuesday does not need Wednesday. The second gate
 * matters more than it looks: without it, a man over the grievance bar asks
 * every single day until the bar comes down, which is the shape of a nag
 * rather than of a person.
 */
function couldAsk(state: GameState, npc: Npc): boolean {
  if (npc.status === 'dead' || npc.status === 'defected') return false;
  if (isOutOfReach(npc)) return false;
  return daysSinceSeen(state, npc.id) >= APPROACH.quietDaysAfterMeeting;
}

/**
 * Something happened to him lately, in his own record of it.
 *
 * Any bad memory will do, because the branch that calls this has already
 * established *what* he is carrying — this only asks whether it is still
 * live. Reading his memories rather than a timer means a route added next
 * year keeps him at the door without knowing this file exists, which is the
 * same trick `promises.ts` uses for the promises kept by an absence.
 */
function freshlyAggrieved(state: GameState, npc: Npc): boolean {
  return npc.memories.some(
    (m) => MEMORIES[m.kind]?.tone === 'bad' && state.day - m.day <= APPROACH.memoryFreshDays,
  );
}

/**
 * The reasons a man has to come and find you.
 *
 * Ordered deliberately: the first match wins, so a man with an overdue promise
 * asks about the promise rather than about the grudge underneath it. That is
 * both truer and more useful — the promise is the thing the player can act on
 * today, and it is the thing he would actually lead with.
 */
function reasonToCome(state: GameState, npc: Npc): Omit<Approach, 'npcId' | 'name'> | null {
  /*
     Something you said, coming due.

     Read from `promisesTo` rather than from his stats, because this is the
     one thing on the list the player definitely knows he said — and a man
     turning up about it is the system's way of making sure a forgotten
     promise is a fair loss rather than a trick, which is the rule
     `config/promises.ts` sets for itself.
  */
  const owed = promisesTo(state, npc.id)
    .slice()
    .sort((a, b) => daysLeft(state, a) - daysLeft(state, b))[0];
  if (owed && daysLeft(state, owed) <= PROMISE.urgentWithin) {
    return {
      text: `${PROMISES[owed.kind].outstanding.toLowerCase()}, and has come to find out whether it is still true.`,
      reasonId: 'settle',
      urgency: daysLeft(state, owed) <= APPROACH.promiseNowWithin ? 'now' : 'soon',
    };
  }

  /*
     Carrying something, and something recent to carry it about.

     The stat alone was wrong, and measurement is what said so: gated on
     grievance by itself, one man stood in the doorway for 124 consecutive
     days of a 300-day career and the whole feature averaged two distinct
     people. That is the wallpaper failure `config/approaches.ts` warns about
     arriving through a side door — the cooldown only starts when somebody is
     *heard*, so a player who never sits down is nagged forever by the same
     face.

     A high number is a level and this game speaks in events. So he comes to
     you in the weeks after something happened to him, not because a meter is
     up: `freshlyAggrieved` is the same window the other branches use, and a
     man whose grudge nobody adds to stops standing there — which is its own
     quiet statement, and the one `promises.ts` already makes when it says
     somebody "has stopped asking".
  */
  if (npc.stats.grievance >= APPROACH.grievanceAsksAbove && freshlyAggrieved(state, npc)) {
    return {
      text: 'has asked for a minute, and it is not about the work.',
      reasonId: 'settle',
      urgency: npc.stats.grievance >= APPROACH.grievanceUrgentAbove ? 'now' : 'soon',
    };
  }

  /*
     Watched somebody else go up.

     Gated on the memory rather than on ambition alone, so this is a man with
     a specific thing to point at rather than any ambitious man on the payroll.
     `passed_over` is written by `ties.ts` at the moment of a promotion, which
     means the person he is aggrieved about exists and is nameable.
  */
  if (
    npc.stats.ambition >= APPROACH.ambitionAsksAbove &&
    npc.memories.some(
      (m) => m.kind === 'passed_over' && state.day - m.day <= APPROACH.memoryFreshDays,
    )
  ) {
    return {
      text: 'wants to know what it would take, and has clearly been working out how to ask.',
      reasonId: 'understand',
      urgency: 'soon',
    };
  }

  // Frightened, and recently given a reason to be. Same rule as the grudge.
  if (npc.stats.fear >= APPROACH.fearAsksAbove && freshlyAggrieved(state, npc)) {
    return {
      text: 'has been waiting outside longer than somebody with nothing to say would.',
      reasonId: 'settle',
      urgency: 'soon',
    };
  }

  /*
     A week he was not paid, which is his memory rather than the org's figure.

     `wagesOwed` lives on `state.org` and is the whole payroll, so it cannot
     say who minded. `went_unpaid` is written on the man, which is the
     difference between the Finances screen saying you are short and the
     person it happened to standing in your doorway — and the second is the
     one that gets acted on.
  */
  if (
    npc.memories.some(
      (m) => m.kind === 'went_unpaid' && state.day - m.day <= APPROACH.memoryFreshDays,
    )
  ) {
    return {
      text: 'went a week without being paid and has stopped pretending not to mind.',
      reasonId: 'settle',
      urgency: 'whenever',
    };
  }

  return null;
}

/**
 * Who is waiting, most pressing first.
 *
 * Capped, because a queue at the door is a different thing from a crowd: three
 * men waiting is a bad week, and eight is a screen nobody reads. When more
 * than three have a reason, the three with the shortest clocks are the honest
 * answer — the rest will still be there next week, which is itself the
 * consequence of not having come.
 */
export function approaches(state: GameState): Approach[] {
  if (state.gameOver) return [];
  if (state.sitdown && !state.sitdown.done) return [];

  const out: Approach[] = [];
  for (const npc of crewList(state)) {
    if (!couldAsk(state, npc)) continue;
    const why = reasonToCome(state, npc);
    if (!why) continue;
    out.push({ npcId: npc.id, name: npc.name, ...why });
  }

  return out
    .sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency] || a.name.localeCompare(b.name))
    .slice(0, APPROACH.most);
}
