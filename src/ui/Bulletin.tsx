import { DAY_PARTS, type DayReport } from './report';
import type { PanelId } from './Rail';
import { formatShortDay } from '../sim/util';

/**
 * The briefing that meets you when time stops.
 *
 * Deliberately not another sheet of paper: the memo owns that material, and a
 * second light surface would cost the memo the thing that makes it land. This
 * is the opposite register — a wire strip, typed, dark, no ceremony. It
 * reports; the memo asks.
 *
 * Every line that you could act on is a button through to the panel where you
 * would act. A line with nowhere to go is not a button, so the ones that are
 * clickable mean something.
 */
export default function Bulletin({
  report,
  onGo,
  onDismiss,
}: {
  report: DayReport;
  onGo: (panel: PanelId) => void;
  onDismiss: () => void;
}) {
  const span =
    report.to - report.from <= 1
      ? formatShortDay(report.to)
      : `${formatShortDay(report.from + 1)} — ${formatShortDay(report.to)}`;

  return (
    <aside className="bulletin" aria-label="What happened">
      <header className="bulletin-head">
        <span className="bulletin-span">{span}</span>
        <button className="bulletin-close" onClick={onDismiss} title="Dismiss (Esc)">
          dismiss
        </button>
      </header>
      {/*
         Grouped by part of the day, and a heading only where there is
         something under it.

         Every line used to sit in one list, so a man dying overnight, a memo
         still waiting for an answer, and your family asking after you read as
         the same kind of thing. They are not: one has happened, one has not
         happened yet, and one is not the business at all. Printing a heading
         over an empty part would be worse than no headings, so an absent part
         prints nothing — most mornings have exactly one.
      */}
      {DAY_PARTS.map((part) => {
        const lines = report.lines.filter((l) => (l.part ?? 'overnight') === part.id);
        if (lines.length === 0) return null;
        return (
          <div key={part.id} className="bulletin-part">
            {report.lines.some((l) => (l.part ?? 'overnight') !== part.id) && (
              <h3 className="bulletin-part-head">{part.label}</h3>
            )}
            <ul className="bulletin-lines">
              {lines.map((line, i) => (
                <li
                  key={i}
                  className={`bulletin-line ${line.tone}`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  {line.panel ? (
                    <button className="bulletin-go" onClick={() => onGo(line.panel as PanelId)}>
                      {line.text}
                    </button>
                  ) : (
                    <span>{line.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}
