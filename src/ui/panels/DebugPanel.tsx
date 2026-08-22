import { useState } from 'react';
import { useGame } from '../../store';
import { Panel, Empty } from '../components';
import { explain } from '../../sim/trace';
import { formatShortDay } from '../../sim/util';
import { RIVAL_IDS } from '../../config/factions';
import { houseShort } from '../../sim/houses';

/**
 * Why did that happen?
 *
 * Not a cheat menu and deliberately not a state inspector — the perception
 * system is the game, and a screen that printed everybody's true stats would
 * quietly switch it off. What this shows is *decisions*: what each family
 * chose, what it beat, and by how much. That is the one thing the simulation
 * used to throw away, and the one thing you cannot reconstruct from the log.
 *
 * It earned its place during the build. The agenda system had a bug where
 * families at dangerous heat kept buying nightclubs instead of going quiet,
 * and the fix that looked obvious — protecting the consolidate score — did
 * nothing. This panel showed why in one line: consolidation was not scoring
 * too low, `invest` was being multiplied past it by the agenda.
 */
export default function DebugPanel() {
  const state = useGame();
  const [actor, setActor] = useState<string>('all');

  const traces = (state.trace ?? []).filter((t) => actor === 'all' || t.actor === actor);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Why</h1>
        <span className="tiny">
          {state.trace?.length ?? 0} decisions on file · the simulation never reads this
        </span>
      </div>

      {/*
         A sentence before the numbers.

         A playtester called this page "a jarring tonal break — raw AI utility
         weights with zero framing", and was right: every other screen in this
         game says what it is in the game's own voice before it shows you
         anything, and this one opened with `CONSOLIDATE 0.37`. The transparency
         is the point of the page and does not need defending; it needed
         introducing.
      */}
      <p className="page-sub">
        Nothing the other families do is scripted. Each week every house scores
        what it could do against what it wants, and takes the best of them — this
        is that arithmetic, kept exactly as it happened, including the options
        that lost. When a family does something that makes no sense, the reason
        is in here, and it is the one thing the log cannot reconstruct.
      </p>

      <Panel title="Whose decisions">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={actor === 'all' ? 'btn small primary' : 'btn small'}
            onClick={() => setActor('all')}
          >
            Everybody
          </button>
          {RIVAL_IDS.map((id) => (
            <button
              key={id}
              className={actor === id ? 'btn small primary' : 'btn small'}
              onClick={() => setActor(id)}
            >
              {houseShort(state, id)}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Decisions, newest first">
        {traces.length === 0 ? (
          <Empty>
            Nothing recorded yet. The families decide once a week — advance time and
            come back.
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Who</th>
                <th>Chose</th>
                <th>Over what</th>
              </tr>
            </thead>
            <tbody>
              {traces.slice(0, 60).map((trace, i) => (
                <tr key={`${trace.day}-${trace.actor}-${i}`}>
                  <td className="mono tiny">{formatShortDay(trace.day)}</td>
                  <td>
                    <span className="name-main">
                      {state.factions[trace.actor]?.shortName ?? trace.actor}
                    </span>
                    <div className="tiny faint">{trace.kind}</div>
                  </td>
                  <td>
                    <span className="name-main brass">{trace.chose}</span>
                    <div className="tiny faint">{trace.because}</div>
                  </td>
                  <td className="mono tiny">
                    {trace.options
                      .slice(0, 4)
                      .map((o) => `${o.label} ${o.score.toFixed(2)}`)
                      .join('  ·  ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {traces.length > 0 && (
        <Panel title="The most recent one, in words">
          <p style={{ margin: 0 }}>{explain(traces[0])}</p>
        </Panel>
      )}
    </>
  );
}
