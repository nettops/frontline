import { useGame } from '../../store';
import { Panel, Empty } from '../components';
import { career } from '../../sim/career';
import { formatShortDay } from '../../sim/util';

/**
 * The story of the run, kept rather than reconstructed.
 *
 * 2026-09-10 polish pass, Section 11/12/21: `state.log` is a rolling 400
 * entries, so a career that runs long enough has already lost most of
 * itself — half of a 300-day run, more than three quarters of a 600-day
 * one (`sim/career.ts`'s own header has the numbers). This reads the
 * separate, curated list that file keeps instead: not everything that
 * happened, only what a player would call a chapter.
 *
 * Same convention `SuccessionPanel`'s "What happened to this family"
 * already uses for the crew roster — oldest first, which is the opposite
 * of the log and correct for a record rather than a feed — so the two
 * screens read the same way if a player has seen one before the other.
 */
export default function CareerPanel() {
  const state = useGame();
  const chapters = career(state);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Career</h1>
        <span className="tiny">{chapters.length} chapters</span>
      </div>
      <p className="page-sub">
        Not everything that happened — that is the log, and it only reaches back so
        far. This is what you would actually call a chapter: a rank held, a war
        fought, a man lost, a district taken or given up.
      </p>

      <Panel title="The story so far">
        {chapters.length === 0 ? (
          <Empty>Nothing yet worth calling a chapter.</Empty>
        ) : (
          <div className="stack">
            {chapters.map((c, i) => (
              <p
                key={`${c.day}-${i}`}
                className={c.tone === 'bad' ? 'hot' : c.tone === 'good' ? 'good' : 'dim'}
                style={{ margin: '0 0 2px' }}
              >
                <span className="mono faint">{formatShortDay(c.day)}</span> {c.text}
              </p>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
