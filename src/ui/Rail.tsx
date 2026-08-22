import { useGame } from '../store';
import type { GameState } from '../sim/types';
import { controlledTerritories } from '../sim/territory';
import { mostHostile } from '../sim/faction';
import { activeCases } from '../sim/investigation';
import { playerIsAtWar } from '../sim/diplomacy';
import { eligibleHeirs, heirOf } from '../sim/succession';
import { crewList } from '../sim/npc';
import { needsSteward } from '../sim/delegation';

export type PanelId =
  | 'dashboard'
  | 'operations'
  | 'territory'
  | 'businesses'
  | 'contraband'
  | 'rivals'
  | 'law'
  | 'intelligence'
  | 'diplomacy'
  | 'city'
  | 'crew'
  | 'succession'
  | 'finances'
  | 'player'
  | 'saves'
  | 'tips'
  | 'why';

interface Entry {
  id: PanelId;
  label: string;
  /**
   * Shown when there is nobody playing. Everything else on this list is a
   * view of an organization that does not exist in Simulation — an Operations
   * panel with no crew is a dead button, and rule three of this project says
   * there are none of those.
   */
  city?: true;
}

const BUILT: Entry[] = [
  { id: 'dashboard', label: 'Overview', city: true },
  { id: 'operations', label: 'Operations' },
  { id: 'territory', label: 'Territory', city: true },
  { id: 'businesses', label: 'Businesses' },
  { id: 'contraband', label: 'The Trade' },
  { id: 'rivals', label: 'Rivals', city: true },
  { id: 'law', label: 'Law Enforcement' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'diplomacy', label: 'Diplomacy', city: true },
  { id: 'city', label: 'The City', city: true },
  { id: 'crew', label: 'Organization' },
  { id: 'succession', label: 'Succession' },
  { id: 'finances', label: 'Finances' },
  { id: 'player', label: 'Yourself' },
];

/** The panels this mode has anything to put in. */
export function panelsFor(mode: GameState['mode']): PanelId[] {
  const entries = mode === 'simulation' ? BUILT.filter((e) => e.city) : BUILT;
  return [...entries.map((e) => e.id), 'saves', 'tips', 'why'];
}

export default function Rail({
  active,
  onSelect,
}: {
  active: PanelId;
  onSelect: (id: PanelId) => void;
}) {
  const state = useGame();
  const pending = state.pendingEvents.length;
  const activeOps = Object.keys(state.activeOperations).length;
  const held = controlledTerritories(state).length;
  const hostile = !!mostHostile(state);
  const cases = activeCases(state).length;
  const war = playerIsAtWar(state);
  // Worth a badge: an organization with somebody to inherit it and nobody named
  // is one bad week away from coming apart, and the player has no other prompt.
  const noHeir = !heirOf(state) && eligibleHeirs(state).length > 0;
  // Stories that named you. The only thing on this rail the player has no
  // other route to noticing.
  const named = state.city.stories.filter((s) => s.named && state.day - s.day <= 30).length;
  // Stock on hand is the one thing in this game a warrant can physically take,
  // so it is worth the player being able to see it without opening the panel.
  const trading = Math.round(state.contraband.stock.product + state.contraband.stock.arms);
  /*
     Three badges for the half of the game nobody was finding.

     A blind playtester spent a hundred and sixty-eight days without opening a
     sit-down, handing over a district, or seeing a leak — not because any of it
     was locked, but because all three live one click inside a panel with no
     reason on the rail to open it. The tips strip says it once; this says it
     for as long as it is true, which is the difference between being told and
     being able to see.

     `carrying` deliberately counts men rather than flagging a state: "three
     people are carrying something" is a different sentence from "somebody is",
     and the number is the part that makes you go and look.
  */
  const carrying = crewList(state).filter(
    (n) => (n.status === 'active' || n.status === 'busy') && n.stats.grievance >= 55,
  ).length;
  // See `needsSteward`. This used to be computed here, and was wrong here: it
  // was paired with a `held === 0` condition below, so the one prompt in the
  // game to hand a district over reached only players who held none.
  const handOver = needsSteward(state);
  const leaks = (state.leaks ?? []).length;
  const watching = state.mode === 'simulation';
  const entries = watching ? BUILT.filter((e) => e.city) : BUILT;

  return (
    <nav className="rail">
      <div className="rail-group">{watching ? 'The City' : 'The Book'}</div>
      {entries.map((entry) => (
        <button
          key={entry.id}
          className={entry.id === active ? 'rail-item active' : 'rail-item'}
          onClick={() => onSelect(entry.id)}
        >
          <span>{entry.label}</span>
          {/*
             Every badge says what it wants.

             A badge is a demand for attention with no statement of what would
             satisfy it. A playtester carried the succession "!" for a hundred
             and seventy-nine days and filed it as something that never
             resolved — the panel behind it has a "Name them" button and one
             click clears it, so what they were actually missing was any way to
             find that out short of opening the panel and reading it. A count
             has the same problem in a quieter form: "3" on Crew is a number
             until something says three of what.
          */}
          {entry.id === 'operations' && activeOps > 0 && (
            <span className="rail-phase" title={`${activeOps} job${activeOps === 1 ? '' : 's'} running`}>
              {activeOps}
            </span>
          )}
          {entry.id === 'territory' && held > 0 && (
            <span className="rail-phase" title={`${held} district${held === 1 ? '' : 's'} under your control`}>
              {held}
            </span>
          )}
          {entry.id === 'rivals' && hostile && (
            <span className="rail-badge" title="Another family has turned on you">
              !
            </span>
          )}
          {entry.id === 'law' && cases > 0 && (
            <span className="rail-badge" title={`${cases} open case${cases === 1 ? '' : 's'} against you`}>
              {cases}
            </span>
          )}
          {entry.id === 'diplomacy' && war && (
            <span className="rail-badge" title="You are at war">
              war
            </span>
          )}
          {entry.id === 'city' && named > 0 && (
            <span
              className="rail-badge"
              title={`${named} recent stor${named === 1 ? 'y' : 'ies'} named you`}
            >
              {named}
            </span>
          )}
          {entry.id === 'contraband' && trading > 0 && (
            <span className="rail-phase" title="Stock on hand — a warrant can take this">
              {trading}
            </span>
          )}
          {entry.id === 'crew' && carrying > 0 && (
            <span
              className="rail-badge"
              title={`${carrying} of your people ${carrying === 1 ? 'is' : 'are'} carrying a grievance. Sit down with them.`}
            >
              {carrying}
            </span>
          )}
          {entry.id === 'territory' && handOver && (
            <span
              className="rail-badge"
              title="You hold ground nobody is running for you. Hand a district to somebody."
            >
              !
            </span>
          )}
          {entry.id === 'intelligence' && leaks > 0 && (
            <span
              className="rail-badge"
              title={`${leaks} thing${leaks === 1 ? ' has' : 's have'} reached the law that should not have`}
            >
              {leaks}
            </span>
          )}
          {entry.id === 'succession' && noHeir && (
            <span className="rail-badge" title="Nobody is named to take over. Name a successor.">
              !
            </span>
          )}
          {entry.id === 'dashboard' && pending > 0 && (
            <span
              className="rail-badge"
              title={`${pending} thing${pending === 1 ? '' : 's'} waiting on your answer`}
            >
              {pending}
            </span>
          )}
        </button>
      ))}

      <div className="rail-group">Records</div>
      <button
        className={active === 'saves' ? 'rail-item active' : 'rail-item'}
        onClick={() => onSelect('saves')}
      >
        <span>Saves</span>
      </button>
      <button
        className={active === 'tips' ? 'rail-item active' : 'rail-item'}
        onClick={() => onSelect('tips')}
        title="Everything the game has told you, kept"
      >
        <span>Advice</span>
      </button>
      <button
        className={active === 'why' ? 'rail-item active' : 'rail-item'}
        onClick={() => onSelect('why')}
        title="What the other families decided, and what they decided against"
      >
        <span>Why</span>
      </button>
    </nav>
  );
}
