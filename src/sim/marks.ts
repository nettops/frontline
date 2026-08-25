/**
 * Somebody is still looking for him.
 *
 * `silence` used to be one roll. It landed, or the man walked out of the game
 * and was never troubled again — which is not how any of this works. The
 * reason the answer is frightening in this world is that it does not expire.
 * A man who is wanted stays wanted, and everybody involved knows it.
 *
 * A mark is that, and it plays itself: you decided once, and from here you
 * read the record. The same stance `standingOrders.ts` takes about a job you
 * told to keep running and `delegation.ts` takes about a district you handed
 * to somebody — the game does not keep asking you, and it does not get clever
 * on your behalf either.
 *
 * **The property everything rests on: he is talking the whole time.** Every
 * few days he is out there and breathing, he gives away a little more. That is
 * what makes a mark a race rather than a queue of rolls you eventually win,
 * and it is what stops the first attempt in `silence.ts` from being free.
 *
 * Two more things hold the shape. The odds fall on every miss, because a man
 * who has survived one attempt and heard about a second is not living the way
 * he used to. And he can get beyond reach entirely — at which point you did
 * not get him, the mark lapses, and everything he said is still on the books.
 *
 * See `config/silence.ts`.
 */

import type { GameState, Id, Mark, Npc } from './types';
import { Rng } from './rng';
import { addEvidence, addLog, nextId } from './util';
import { addHeat } from './heat';
import { addNote } from './npc';
import { MARK } from '../config/silence';

/**
 * Everything out, lazily.
 *
 * Optional state with a lazy initialiser, the idiom `scores`, `training` and
 * `standing` all use — so `SAVE_VERSION` does not move and a save written
 * before this existed loads with nobody being looked for.
 */
export function markList(state: GameState): Mark[] {
  if (!state.marks) state.marks = [];
  return state.marks;
}

export function liveMarks(state: GameState): Mark[] {
  return (state.marks ?? []).filter((m) => m.status === 'out');
}

export function markFor(state: GameState, npcId: Id): Mark | undefined {
  return liveMarks(state).find((m) => m.npcId === npcId);
}

/**
 * Deciding somebody who has already left still has to go.
 *
 * Refused against anybody still on the books, and that is not a technicality:
 * a man who works for you can be reached at work, which is what `silence` is
 * for. This is the harder, slower, worse-odds version that exists because he
 * is not there any more.
 */
export function putOutMark(state: GameState, npcId: Id, chance = MARK.base): Mark | null {
  const npc = state.npcs[npcId];
  if (!npc || npc.status !== 'defected') return null;
  if (markFor(state, npcId)) return null;

  const mark: Mark = {
    id: nextId(state, 'mk'),
    npcId,
    setDay: state.day,
    lastTryDay: state.day,
    lastTalkDay: state.day,
    tries: 0,
    chance,
    status: 'out',
  };
  markList(state).push(mark);
  addLog(state, `${npc.name} is still out there, and somebody is looking.`, 'crew');
  return mark;
}

export function callOffMark(state: GameState, id: Id): void {
  const mark = (state.marks ?? []).find((m) => m.id === id);
  if (!mark || mark.status !== 'out') return;
  mark.status = 'called_off';
  mark.settledDay = state.day;
  const npc = state.npcs[mark.npcId];
  addLog(
    state,
    `Nobody is looking for ${npc?.name ?? 'them'} any more. They are still out there.`,
    'crew',
  );
}

/** He tells somebody something. This is the clock the mark is racing. */
function talks(state: GameState, npc: Npc): void {
  addEvidence(state, {
    day: state.day,
    source: 'informant',
    strength: MARK.talksStrength,
    npcIds: [npc.id],
    detail: `${npc.name} has been talking to somebody again.`,
  });
}

function lands(state: GameState, mark: Mark, npc: Npc): void {
  mark.status = 'landed';
  mark.settledDay = state.day;
  npc.status = 'dead';
  npc.informingSince = undefined;
  addNote(state.day ? npc : npc, state.day, 'They were found.', 'bad');
  addHeat(state, MARK.heatOnLanding, 'street', 'a body turned up');
  addEvidence(state, {
    day: state.day,
    source: 'violence',
    strength: MARK.evidenceOnLanding,
    npcIds: [npc.id],
    detail: `${npc.name} was found dead a long way from home.`,
  });
  addLog(state, `They found ${npc.name}. It is finished.`, 'crew');
}

/**
 * Daily, beside the other things with a clock on them.
 *
 * Nothing here asks whether this is still a good idea — see the header, that
 * omission is the same one every standing decision in this game makes.
 */
export function tickMarks(state: GameState, rng: Rng): void {
  for (const mark of liveMarks(state)) {
    const npc = state.npcs[mark.npcId];
    if (!npc || npc.status === 'dead') {
      mark.status = 'called_off';
      mark.settledDay = state.day;
      continue;
    }

    // His mouth, first. A man found today still spent the week talking.
    if (state.day - mark.lastTalkDay >= MARK.talksEveryDays) {
      mark.lastTalkDay = state.day;
      talks(state, npc);
    }

    if (state.day - mark.lastTryDay < MARK.everyDays) continue;
    mark.lastTryDay = state.day;
    mark.tries += 1;
    addHeat(state, MARK.heatPerTry, 'street', 'people asking after somebody');

    if (rng.chance(mark.chance)) {
      lands(state, mark, npc);
      continue;
    }

    /*
       He is still ahead of it, and further ahead than he was.

       A share of what is left rather than a flat step, so the odds tail off
       instead of hitting zero on a fixed count — the interesting careers are
       the ones where he nearly got away.
    */
    mark.chance *= 1 - MARK.colderPerMiss;
    addNote(npc, state.day, 'They came close again.', 'bad');

    if (mark.chance < MARK.hopelessBelow) {
      mark.status = 'lapsed';
      mark.settledDay = state.day;
      addLog(
        state,
        `Nobody can find ${npc.name} any more. Wherever they are, they are still talking.`,
        'crew',
      );
    }
  }
}
