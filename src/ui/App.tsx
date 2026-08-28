import { useCallback, useEffect, useState } from 'react';
import { useOptionalGame, getState, mutate, setGame } from '../store';
import { advanceDay, advanceDays } from '../sim/clock';
import { careerShape, postMortem } from '../sim/legacy';
import { buildReport, snapshot, type DayReport } from './report';
import { play } from './audio';
import TitleScreen from './TitleScreen';
import StatBar from './StatBar';
import Rail, { panelsFor, type PanelId } from './Rail';
import Bulletin from './Bulletin';
import Coach from './Coach';
import MemoModal from './MemoModal';
import SitdownModal from './SitdownModal';
import Dashboard from './panels/Dashboard';
import OperationsPanel from './panels/OperationsPanel';
import TerritoryPanel from './panels/TerritoryPanel';
import BusinessesPanel from './panels/BusinessesPanel';
import ContrabandPanel from './panels/ContrabandPanel';
import RivalsPanel from './panels/RivalsPanel';
import LawPanel from './panels/LawPanel';
import IntelligencePanel from './panels/IntelligencePanel';
import DiplomacyPanel from './panels/DiplomacyPanel';
import CityPanel from './panels/CityPanel';
import CrewPanel from './panels/CrewPanel';
import SuccessionPanel from './panels/SuccessionPanel';
import FinancesPanel from './panels/FinancesPanel';
import PlayerPanel from './panels/PlayerPanel';
import SavesPanel from './panels/SavesPanel';
import TipsPanel from './panels/TipsPanel';
import DebugPanel from './panels/DebugPanel';
import { RANK_BY_ID } from '../config/economy';

export default function App() {
  const state = useOptionalGame();
  const [panel, setPanel] = useState<PanelId>('dashboard');
  const [report, setReport] = useState<DayReport | null>(null);
  /*
     What was asked for, when the world interrupted it.

     `advanceDays` stops on the first new memo and that is right — a memo is a
     question, and answering it a week late answers a different question. What
     was wrong is that the *intent* was thrown away: ask for a month, get
     stopped on day three, and you re-clicked from scratch. Twenty-seven days
     of quiet cost nine clicks.

     Held in the view rather than in the save, because it is a statement about
     what you were in the middle of doing, not about the organization.
  */
  const [remaining, setRemaining] = useState(0);

  /**
   * The only place time moves.
   *
   * It has to live above the stat bar because the same action is reachable
   * from the buttons and from the keyboard, and because the before/after
   * comparison that produces the briefing has to bracket the advance itself.
   */
  const step = useCallback((days: number) => {
    const s = getState();
    // Guard here rather than only on the buttons: clicks and keys both arrive
    // faster than React re-renders, so a fast repeat could otherwise advance
    // straight past a memo and leave it sitting in the queue dated weeks ago.
    if (!s || s.gameOver || s.pendingEvents.length > 0) return;
    // A conversation in progress stops the clock for the same reason a memo
    // does: it is a question, and answering it after a week has passed would
    // be answering a different question.
    if (s.sitdown) return;
    const before = snapshot(s);
    let moved = 1;
    mutate((g) => {
      if (days === 1) advanceDay(g);
      else moved = advanceDays(g, days);
    }, true);
    // What is left of what was asked for. `advanceDays` returns how far it
    // actually got, so this is the remainder and nothing has to be inferred.
    setRemaining(Math.max(0, days - moved));
    const next = buildReport(before, s);
    setReport(next);
    // A quiet day gets the small dry click; a day with news gets its own noise.
    play(next ? next.cue : days === 1 ? 'tick' : 'week');
  }, []);

  const goto = useCallback((id: PanelId) => {
    setPanel(id);
    setReport(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        setReport(null);
        return;
      }
      // A memo is a question. Nothing else can happen until it is answered,
      // and the keys that would advance time must not silently do nothing —
      // MemoModal owns the keyboard while it is open.
      if (getState()?.pendingEvents.length || getState()?.sitdown) return;
      if (e.key === ' ') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        step(7);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  if (!state) return <TitleScreen />;

  if (state.gameOver) {
    // The line matters at the end. Somebody who ran this for three generations
    // and then lost it did not have the same game as somebody who folded in
    // year one, and the screen should not tell them the same thing.
    const generations = state.succession.line.length;
    const shape = careerShape(state);
    return (
      <div className="title-screen">
        <div className="title-card">
          <div className="title-mark">It ends here</div>
          <div className="title-rule" />
          <p className="title-sub">Day {state.gameOver.day}</p>
          <p className="dim" style={{ marginBottom: 18 }}>
            {state.gameOver.reason}
          </p>

          {/*
             F11: "the death screen has no post-mortem. 495 bytes and one
             button. No rank, no net worth, no roster, no week it turned. The
             moment the player most needs to be shown what he missed shows him
             the least."

             The verdict first, because a rank is not an ending — "Crew Leader"
             is the same word whether you got there with seven fronts and no
             violence or at heat 99 with two men left, and the game used to
             tell both of those the same way.
          */}
          <div className="title-verdict">
            <div className="title-verdict-name">{shape.name}</div>
            <p className="dim" style={{ margin: '6px 0 4px' }}>
              {shape.verdict}
            </p>
            <p className="tiny faint" style={{ margin: 0 }}>
              {shape.because}
            </p>
          </div>

          <div className="title-postmortem">
            {postMortem(state).map((line) => (
              <div key={line.label} className="title-postmortem-row">
                <span className="tiny faint">{line.label}</span>
                <span className="tiny mono">{line.value}</span>
              </div>
            ))}
          </div>
          {generations > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p className="tiny faint" style={{ marginBottom: 6 }}>
                Who ran it, in order
              </p>
              {state.succession.line.map((p) => (
                <p key={`${p.name}-${p.toDay}`} className="tiny dim" style={{ margin: 0 }}>
                  {p.name} — {RANK_BY_ID[p.rank].name}, until day {p.toDay}
                </p>
              ))}
              <p className="tiny dim" style={{ margin: 0 }}>
                {state.player.name} — {RANK_BY_ID[state.player.rank].name}, last
              </p>
            </div>
          )}
          <button className="btn primary" onClick={() => setGame(null)}>
            Start again
          </button>
        </div>
      </div>
    );
  }

  // Panel selection outlives a game. Starting a Simulation while the rail was
  // on Operations would otherwise render a panel this mode does not have — and
  // one the rail is no longer offering a way back from.
  const shown = panelsFor(state.mode).includes(panel) ? panel : 'dashboard';

  return (
    <div className="app">
      <StatBar onStep={step} />
      <Rail active={shown} onSelect={goto} />
      <main className="main">
        {report && (
          <Bulletin report={report} onGo={goto} onDismiss={() => setReport(null)} />
        )}
        {/*
           Pick up where the week was interrupted.

           Only when the desk is actually clear: a memo behind another memo is
           not answered yet, and a conversation in progress stops the clock for
           the same reason. `step` guards both again, so this is about not
           offering something that would do nothing.
        */}
        {remaining > 0 && state.pendingEvents.length === 0 && !state.sitdown && (
          <div className="btn-row" style={{ margin: '0 0 12px' }}>
            <button
              className="btn small primary"
              onClick={() => step(remaining)}
              title="You asked for longer than you got. This runs the rest of it."
            >
              Carry on — {remaining} more {remaining === 1 ? 'day' : 'days'}
            </button>
            <button className="btn small" onClick={() => setRemaining(0)}>
              Leave it
            </button>
          </div>
        )}
        <Coach onGo={goto} panel={shown} />
        {/* Keyed on the panel so switching re-runs the entry animation — the
            content changing under a static frame reads as a failed click. */}
        <div className="panel-swap" key={shown}>
          {shown === 'dashboard' && <Dashboard onNavigate={goto} />}
          {shown === 'operations' && <OperationsPanel />}
          {shown === 'territory' && <TerritoryPanel />}
          {shown === 'businesses' && <BusinessesPanel />}
          {shown === 'contraband' && <ContrabandPanel />}
          {shown === 'rivals' && <RivalsPanel />}
          {shown === 'law' && <LawPanel />}
          {shown === 'intelligence' && <IntelligencePanel />}
          {shown === 'diplomacy' && <DiplomacyPanel />}
          {shown === 'city' && <CityPanel />}
          {shown === 'crew' && <CrewPanel />}
          {shown === 'succession' && <SuccessionPanel />}
          {shown === 'finances' && <FinancesPanel />}
          {shown === 'player' && <PlayerPanel />}
          {shown === 'saves' && <SavesPanel />}
          {shown === 'tips' && <TipsPanel />}
          {shown === 'why' && <DebugPanel />}
        </div>
      </main>
      <MemoModal />
      <SitdownModal onDone={step} />
    </div>
  );
}
