/**
 * What people call you, and what would change it.
 *
 * `player.rank` was dead state. Nothing in the codebase ever assigned it — not
 * one line — so every career in the game's history ended on the rung it began
 * on, and the only screen that printed the value was the save row.
 *
 * Round 16 found this three testers out of three, independently, and all three
 * filed it as the thing that broke their sense of progress. One of them had
 * three districts at dominance, seven fronts, seventeen people and $470,000,
 * and was still labelled a street criminal. Another put it best: *the entire
 * "ABOVE YOUR STANDING" table is framed as standing, and standing is the one
 * number the game refuses to print.*
 *
 * ## Why it is derived rather than fixed
 *
 * The obvious repair — find where rank is set and make it work — has nowhere
 * to go, because rank was removed on purpose. `types.ts` records the reason at
 * `OpsBoard`: *"rank is a clean-money threshold wearing a title, and F15 has 34
 * of 36 careers held by that line, so a board gated on rank alone stops moving
 * around day 90 and stays stopped."* The job table was re-gated on districts,
 * fronts, crew, favours and rival trust, and the rank field was left behind.
 *
 * So this reads the **same board the job table gates on**. Not a parallel set
 * of thresholds that could disagree with it — the same function, on the same
 * facts. What you are called and what you are allowed to do cannot come apart,
 * which is how `requires` went wrong the first time.
 *
 * That also makes this a reading rather than state, in the shape `estate.ts`
 * and `legacy.ts` already use: derived on demand, nothing to save, nothing to
 * migrate, and no second copy of a fact to drift.
 *
 * ## What `player.rank` is still for
 *
 * The stored field stays, untouched, because the succession line records what
 * a *predecessor* was called at the moment they were removed — a historical
 * fact that must not be recomputed against a later organization. Live callers
 * want `rankNow`; the record wants the field.
 */

import type { GameState } from './types';
import type { RankDef } from '../config/economy';
import { opsBoard } from './operations';
import { RANKS } from '../config/economy';

/** Every requirement met, on the board the job table already uses. */
function meets(def: RankDef, board: ReturnType<typeof opsBoard>): boolean {
  const n = def.needs;
  if (!n) return true;
  if (n.districtsControlled !== undefined && board.districtsControlled < n.districtsControlled)
    return false;
  if (n.fronts !== undefined && board.fronts < n.fronts) return false;
  if (n.crew !== undefined && board.crew < n.crew) return false;
  if (n.owedTotal !== undefined && board.owedTotal < n.owedTotal) return false;
  if (n.bestRivalTrust !== undefined && board.bestRivalTrust < n.bestRivalTrust) return false;
  return true;
}

/**
 * The highest rung the organization currently answers to.
 *
 * Walks up rather than finding the highest match, so a rung whose terms are
 * momentarily met while a lower one is not cannot be reached by accident. The
 * ladder is a ladder.
 *
 * **It can go down.** Lose two districts and you are what you are now, not
 * what you were in June. That is deliberate and it is the honest reading of a
 * derived rank — the alternative is a high-water mark, which is a trophy
 * rather than a description, and this game does not hand out trophies.
 */
export function rankNow(state: GameState): RankDef {
  const board = opsBoard(state);
  let held = RANKS[0];
  for (const def of RANKS) {
    if (!meets(def, board)) break;
    held = def;
  }
  return held;
}

/** The next rung, or null at the top. */
export function nextRank(state: GameState): RankDef | null {
  const at = RANKS.indexOf(rankNow(state));
  return RANKS[at + 1] ?? null;
}

/**
 * What is still missing, said the way a person would say it.
 *
 * The whole failure this file repairs was a demand for attention with nothing
 * saying what would satisfy it — the Rail's own rule, which `attention.ts`
 * quotes and which a rank nobody could move is the largest violation of in the
 * game. So every line names the thing and the gap, and an empty array means
 * the next rung is already earned.
 */
export function whatItNeeds(state: GameState): string[] {
  const next = nextRank(state);
  if (!next?.needs) return [];
  const board = opsBoard(state);
  const n = next.needs;
  const out: string[] = [];

  const short = (have: number, want: number, one: string, many: string) =>
    `${want - have} more ${want - have === 1 ? one : many}`;

  if (n.districtsControlled !== undefined && board.districtsControlled < n.districtsControlled) {
    out.push(
      `${short(board.districtsControlled, n.districtsControlled, 'district', 'districts')} ` +
        `held properly, not just worked`,
    );
  }
  if (n.fronts !== undefined && board.fronts < n.fronts) {
    out.push(short(board.fronts, n.fronts, 'front', 'fronts'));
  }
  if (n.crew !== undefined && board.crew < n.crew) {
    /*
       "Right now" earns its place only on this one line.

       Round 26's blind report read "needs 2 more bodies on the books" as a
       cumulative counter and watched it sit unchanged for 90 days while
       crew fluctuated 4-6 from arrests and departures, never noticing the
       number was live the whole time — a rank that has already gone *down*
       once for the same reason (§ this file's own header) is the one
       quantity here that visibly moves both ways, unlike districts and
       fronts, which a career mostly only adds to.
    */
    out.push(`${short(board.crew, n.crew, 'body on the books', 'bodies on the books')} right now`);
  }
  if (n.owedTotal !== undefined && board.owedTotal < n.owedTotal) {
    out.push(
      `${short(board.owedTotal, n.owedTotal, 'favour', 'favours')} owed to you outside the family`,
    );
  }
  if (n.bestRivalTrust !== undefined && board.bestRivalTrust < n.bestRivalTrust) {
    out.push('a rival family that genuinely trusts you');
  }
  return out;
}

/**
 * What is keeping you where you are, once there is nothing left to climb to.
 *
 * At the top rung `nextRank` is null, so `whatItNeeds` returns an empty array
 * and both panels that read it render nothing at all. Round 19's tester
 * reached Crime Lord on day 147 of a 300-day career, and from that moment the
 * only line in the game stating a goal simply disappeared. He described the
 * back half as *"the same five-job rotation at bigger numbers with no new
 * structural question"*, and the screen had stopped asking him anything
 * literally rather than only in spirit.
 *
 * It is worse than silence. Rank is derived and falls — the same tester lost
 * Crime Lord to two arrests and was not told — so the terms are live, and a
 * player at the top has no way to see what they are holding or how close they
 * are to dropping it. The vanished line becomes a standing one: the same
 * facts, read the other way round.
 *
 * Only at the top. Below it, `whatItNeeds` is the better sentence, because a
 * gap you can close is more use than a margin you are sitting on.
 */
export function whatHoldsIt(state: GameState): string[] {
  if (nextRank(state) !== null) return [];
  const held = rankNow(state);
  if (!held.needs) return [];
  const board = opsBoard(state);
  const n = held.needs;
  const out: string[] = [];

  // The margin, not the total. "5 districts" is a fact about the world; "one
  // district clear" is a fact about how close the fall is, which is the thing
  // that turned out to be invisible.
  const margin = (have: number, want: number, one: string, many: string) => {
    const spare = have - want;
    return spare === 0
      ? `${want} ${want === 1 ? one : many}, with nothing spare`
      : `${want} ${want === 1 ? one : many}, ${spare} clear`;
  };

  if (n.districtsControlled !== undefined) {
    out.push(margin(board.districtsControlled, n.districtsControlled, 'district', 'districts'));
  }
  if (n.fronts !== undefined) out.push(margin(board.fronts, n.fronts, 'front', 'fronts'));
  if (n.crew !== undefined) {
    out.push(margin(board.crew, n.crew, 'body on the books', 'bodies on the books'));
  }
  if (n.owedTotal !== undefined) {
    out.push(margin(board.owedTotal, n.owedTotal, 'favour owed', 'favours owed'));
  }
  if (n.bestRivalTrust !== undefined) out.push('a rival family that still trusts you');
  return out;
}
