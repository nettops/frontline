/**
 * The board, rendered: one row per running thing, the deadline as the poster
 * figure, and a wedge for anything with an end. Rows are buttons because
 * every one of them has exactly one place the player would go next, and a
 * row you can read but not follow is a badge with extra steps.
 */
import { useGame } from '../store';
import { Panel, Empty, Bar } from './components';
import type { PanelId } from './Rail';
import { boardItems, type BoardItem } from './board';

const KIND_LABEL: Record<BoardItem['kind'], string> = {
  war: 'War',
  job: 'Job',
  teaching: 'Teaching',
  product: 'Product',
  arms: 'Arms',
};

export default function InMotion({ onNavigate }: { onNavigate: (id: PanelId) => void }) {
  const state = useGame();
  const rows = boardItems(state);

  return (
    <Panel
      title="In motion"
      action={
        rows.length > 0 && (
          <span className="tiny faint">
            {rows.length} running
          </span>
        )
      }
      flush
    >
      {rows.length === 0 ? (
        <Empty>
          Nothing in motion. Jobs, teaching, the trades and wars sit here while they run.
        </Empty>
      ) : (
        <div className="board">
          {rows.map((row) => (
            <button
              key={row.key}
              className={`board-row ${row.kind}`}
              onClick={() => onNavigate(row.panel)}
            >
              <span className="board-kind">{KIND_LABEL[row.kind]}</span>
              <span className="board-what">
                <span className="board-title">{row.title}</span>
                <span className="board-sub">{row.sub}</span>
              </span>
              <span className="board-fig">{row.figure}</span>
              <span className="board-meter">
                {row.progress !== null && (
                  <Bar
                    value={row.progress}
                    max={1}
                    tone={row.kind === 'war' ? 'hot' : undefined}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
