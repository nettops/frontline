/**
 * The wire, rendered: a strip pinned over whatever panel is open, so you can
 * watch the map, the board or the rivals sheet while the days run. The feed
 * is the ordinary log, streamed from the moment you started watching — the
 * wire invents nothing and misses nothing, because it is the same record the
 * game was already keeping.
 */
import { useGame } from '../store';
import { formatDay } from '../sim/util';
import type { LogEntry } from '../sim/types';
import { LIVE_SPEEDS, liveBlocked, newEntriesSince } from './live';

export default function LiveWire({
  paused,
  speedIdx,
  marker,
  onPause,
  onSpeed,
  onStop,
}: {
  paused: boolean;
  speedIdx: number;
  marker: LogEntry | null;
  onPause: () => void;
  onSpeed: (idx: number) => void;
  onStop: () => void;
}) {
  const state = useGame();
  const feed = newEntriesSince(state.log, marker).slice(0, 48);
  const waiting = liveBlocked(state);

  return (
    <div className="wire" role="log" aria-label="Live wire">
      <div className="wire-head">
        <span className={paused ? 'wire-live paused' : 'wire-live'}>
          <i aria-hidden="true" />
          {paused ? 'Held' : 'Live'}
        </span>
        <span className="wire-date mono">
          {formatDay(state.day)} · day {state.day}
        </span>
        {waiting && !paused && (
          <span className="tiny hot">waiting on your answer — the wire holds</span>
        )}
        <span className="wire-controls">
          {LIVE_SPEEDS.map((s, i) => (
            <button
              key={s.label}
              className={i === speedIdx ? 'wire-key on' : 'wire-key'}
              onClick={() => onSpeed(i)}
              title={`One day every ${s.ms / 1000}s`}
            >
              {s.label}
            </button>
          ))}
          <button className="wire-key" onClick={onPause} title="Space also does this">
            {paused ? 'resume' : 'hold'}
          </button>
          <button className="wire-key stop" onClick={onStop} title="Esc also does this">
            stop
          </button>
        </span>
      </div>
      {feed.length === 0 ? (
        <p className="wire-quiet">The city is quiet. The wire runs until you stop it.</p>
      ) : (
        <div className="log wire-feed">
          {feed.map((entry, i) => (
            <div key={`${entry.day}-${i}`} className={`log-entry ${entry.kind}`}>
              <span className="log-day">{entry.day}</span>
              <span className="log-text">{entry.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
