/**
 * How you play it.
 *
 * Three modes, and only one of them is the game. The other two exist because
 * a simulation this size has two audiences it otherwise serves badly: somebody
 * who wants to see the late systems without spending ten in-game years earning
 * their way to them, and somebody who wants to know whether the city actually
 * works when nobody is playing it.
 *
 * Neither is a cheat menu. Sandbox runs the identical simulation with the
 * losing conditions off and a starting position you choose; Simulation runs the
 * identical simulation with no player in it at all. Every number below is a
 * starting position, not a modifier — nothing here makes the game easier once
 * it has begun, and that is deliberate.
 */

import type { GameMode, RankId } from '../sim/types';

export interface ModeDef {
  id: GameMode;
  name: string;
  blurb: string;
}

export const MODES: ModeDef[] = [
  {
    id: 'career',
    name: 'Career',
    blurb: 'Start with nothing and see how far it goes. This is the game.',
  },
  {
    id: 'sandbox',
    name: 'Sandbox',
    blurb:
      'The same city, the same rules, but you pick where you start and nothing can finish you.',
  },
  {
    id: 'simulation',
    name: 'Simulation',
    blurb:
      'You are not in this one. The three families run the city between them and you watch it happen.',
  },
];

export const MODE_BY_ID: Record<GameMode, ModeDef> = Object.fromEntries(
  MODES.map((m) => [m.id, m]),
) as Record<GameMode, ModeDef>;

/**
 * Where a sandbox game begins.
 *
 * One choice rather than five sliders. A rank on its own is meaningless — a
 * Capo with no crew, no money and no ground is not a Capo, he is a job title —
 * so each of these sets the whole position at once, the way the career would
 * have arrived at it.
 */
export interface SandboxStart {
  id: string;
  name: string;
  blurb: string;
  rank: RankId;
  cash: number;
  dirtyCash: number;
  respect: number;
  /** Bodies, and the roles they come in. */
  crew: { role: 'associate' | 'soldier' | 'enforcer' | 'lieutenant' | 'capo'; count: number }[];
  /** Influence in the district you are from. */
  homeInfluence: number;
  /** Added to every attribute — somebody who got here learned things. */
  attributeBonus: number;
}

export const SANDBOX_STARTS: SandboxStart[] = [
  {
    id: 'nobody',
    name: 'Nobody',
    blurb: 'The career opening, with the ending switched off.',
    rank: 'street_criminal',
    cash: 2_500,
    dirtyCash: 0,
    respect: 0,
    crew: [{ role: 'associate', count: 1 }],
    homeInfluence: 18,
    attributeBonus: 0,
  },
  {
    id: 'established',
    name: 'Established',
    blurb:
      'A few good years behind you: a crew that works, a district that answers, and enough money to buy a front.',
    rank: 'crew_leader',
    cash: 60_000,
    dirtyCash: 40_000,
    respect: 220,
    crew: [
      { role: 'enforcer', count: 2 },
      { role: 'soldier', count: 3 },
      { role: 'associate', count: 1 },
    ],
    homeInfluence: 55,
    attributeBonus: 12,
  },
  {
    id: 'seated',
    name: 'At the table',
    blurb:
      'Everything the late systems need at once — the money to launder, the people to lose, and three families who already have opinions about you.',
    rank: 'underboss',
    cash: 900_000,
    dirtyCash: 400_000,
    respect: 900,
    crew: [
      { role: 'capo', count: 1 },
      { role: 'lieutenant', count: 2 },
      { role: 'enforcer', count: 4 },
      { role: 'soldier', count: 5 },
    ],
    homeInfluence: 75,
    attributeBonus: 32,
  },
];

export const SANDBOX_START_BY_ID: Record<string, SandboxStart> = Object.fromEntries(
  SANDBOX_STARTS.map((s) => [s.id, s]),
);

/**
 * Days a single press moves in Simulation mode.
 *
 * Watching a city one day at a time is not watching a city. The interesting
 * unit here is the season: long enough for a family to lose a war and rebuild,
 * short enough that you can still see what caused what.
 */
/**
 * Steps available when somebody is playing.
 *
 * A month is safe here for the same reason a week is: `advanceDays` stops the
 * moment anything needs an answer, so pressing it during a quiet stretch skips
 * a quiet stretch and pressing it during a crisis moves one day. It exists
 * because the late game has long stretches where the correct play is to let
 * fronts earn and heat fall, and clicking that out a week at a time is not a
 * decision, it is a chore.
 */
export const CAREER_STEPS: { label: string; days: number; primary?: true }[] = [
  { label: '+1 day', days: 1 },
  { label: '+1 week', days: 7, primary: true },
  { label: '+1 month', days: 30 },
];

export const SIMULATION_STEPS: { label: string; days: number }[] = [
  { label: '+1 week', days: 7 },
  { label: '+1 month', days: 30 },
  { label: '+1 year', days: 365 },
];
