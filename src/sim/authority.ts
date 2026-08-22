/**
 * Whether the family still does what it is told.
 *
 * The design note is in `config/authority.ts`. The mechanics that matter:
 *
 * **It is a reading, not a stat.** Nothing writes it and nothing can be spent
 * on it. Every term is a quantity some other system already keeps, which is
 * what makes it a verdict on how the family has been run rather than an
 * eleventh thing to manage.
 *
 * **It touches the random stream nowhere.** Same rule `perceive`, `legitimacy`
 * and `readWhispers` follow: a thing that only describes the world must not be
 * able to change what happens in it.
 */

import { clamp } from './rng';
import { crewList } from './npc';
import { weeklyWageBill } from './economy';
import { recalls } from './memory';
import { AUTHORITY, AUTHORITY_LABEL } from '../config/authority';
import { FEAR } from '../config/economy';
import type { GameState, Npc } from './types';

/** Everybody whose obedience is a live question. */
function under(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status !== 'dead' && n.status !== 'defected');
}

/**
 * 0..100. How much of an instruction survives contact with the man taking it.
 *
 * A boss alone reads 50 rather than 0 or 100: an organization of one is not
 * disobedient, it is an organization of one, and either extreme would make the
 * opening of the game lie about itself in a way the player could feel.
 */
export function authority(state: GameState): number {
  const crew = under(state);
  if (crew.length === 0) return 50;

  const respected =
    crew.reduce((sum, n) => sum + n.stats.respectForBoss, 0) / crew.length / 100;

  // Fear is read against the ceiling the rest of the game reads it against, so
  // "feared" here means the same thing it means on the stat bar.
  const feared = clamp(state.org.fear / FEAR.max, 0, 1);

  const grievance = crew.reduce((sum, n) => sum + n.stats.grievance, 0) / crew.length / 100;
  const bill = Math.max(1, weeklyWageBill(state));
  const arrears = clamp((state.org.wagesOwed ?? 0) / bill / AUTHORITY.arrearsAtWorst, 0, 1);
  const ungrieved = 1 - clamp(Math.max(grievance, arrears), 0, 1);

  /*
     Your word, as the people who were given it remember it.

     Read out of `memory` rather than out of `state.promises`, because the
     promise list holds what is still outstanding and this is a question about
     what happened to the ones that are not. A man who was told something and
     got it carries `word_kept`; a man who was told something and did not
     carries `word_broken`, and carries it for years.
  */
  let kept = 0;
  let broken = 0;
  for (const n of crew) {
    kept += recalls(n, state.day, 'word_kept');
    broken += recalls(n, state.day, 'word_broken');
  }
  // Nobody has been promised anything yet, so nothing has been let down yet.
  const wordKept = kept + broken === 0 ? 0.6 : kept / (kept + broken);

  const score =
    respected * AUTHORITY.respected +
    feared * AUTHORITY.feared +
    ungrieved * AUTHORITY.ungrieved +
    wordKept * AUTHORITY.wordKept;

  return Math.round(clamp(score * 100, 0, 100));
}

export interface AuthorityRead {
  value: number;
  label: string;
  /** The four terms, as the player would say them, worst first. */
  because: { term: string; value: number }[];
}

/**
 * The number and what is holding it down.
 *
 * Sorted worst first, because a reading that says only "43" is the kind of
 * statistic this project has spent four rounds learning not to ship. The
 * player should be able to read the row and know which of the four things to
 * go and do something about.
 */
export function authorityRead(state: GameState): AuthorityRead {
  const crew = under(state);
  const value = authority(state);

  const respected = crew.length
    ? crew.reduce((sum, n) => sum + n.stats.respectForBoss, 0) / crew.length
    : 50;
  const feared = clamp((state.org.fear / FEAR.max) * 100, 0, 100);
  const bill = Math.max(1, weeklyWageBill(state));
  const arrears = clamp(((state.org.wagesOwed ?? 0) / bill / AUTHORITY.arrearsAtWorst) * 100, 0, 100);
  const grievance = crew.length
    ? crew.reduce((sum, n) => sum + n.stats.grievance, 0) / crew.length
    : 0;

  let kept = 0;
  let broken = 0;
  for (const n of crew) {
    kept += recalls(n, state.day, 'word_kept');
    broken += recalls(n, state.day, 'word_broken');
  }

  const because = [
    { term: 'What they think of you', value: Math.round(respected) },
    { term: 'Whether they are afraid to test it', value: Math.round(feared) },
    {
      term: 'What they are carrying against you',
      value: Math.round(100 - Math.max(grievance, arrears)),
    },
    {
      term: 'Whether your word has held',
      value: Math.round(kept + broken === 0 ? 60 : (kept / (kept + broken)) * 100),
    },
  ].sort((a, b) => a.value - b.value);

  return {
    value,
    label: AUTHORITY_LABEL.find(([bar]) => value >= bar)?.[1] ?? 'You are asking, not telling',
    because,
  };
}
