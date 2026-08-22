import { useEffect } from 'react';
import { useGame, mutate } from '../store';
import { dismissTip, markShown, nextTip, setTipsOff } from './tips';
import type { PanelId } from './Rail';

/**
 * One line of advice, at the top of whatever you are looking at.
 *
 * Deliberately not a modal and deliberately not a tour. This game already has
 * a surface that stops the world and asks you something, and spending it on
 * "this is the crew panel" would cost the memo the thing that makes it land.
 * A strip you can ignore is the right weight for something that is only ever
 * telling you a fact about a system you have just walked into.
 *
 * It sits under the briefing rather than over it: what happened outranks what
 * you might do about it.
 */
export default function Coach({ onGo, panel }: { onGo: (id: PanelId) => void; panel: PanelId }) {
  const state = useGame();

  /*
     A memo covers the whole viewport, so a tip that comes up behind one is not
     a tip the player was shown — and marking it seen retires it unread. Events
     queue, so this can swallow several in a row after a bad week. Wait for the
     desk to clear.
  */
  const blocked = state.pendingEvents.length > 0;
  const tip = blocked ? null : nextTip(state);

  /*
     Record that it went past.

     Most of the opening chain is never dismissed — each line stops being true
     as the next becomes true, which is the point of it — so without this the
     Tips page has no idea the tutorial ever ran. Keyed on the id so a tip that
     sits there for a fortnight is written once, on the day it first appeared.
  */
  const id = tip?.id;
  useEffect(() => {
    if (id) mutate((s) => markShown(s, id), true);
  }, [id]);

  // The Tips page prints the same line at the top of itself. Two copies of one
  // sentence on one screen reads as a bug.
  if (!tip || panel === 'tips') return null;

  return (
    <aside className={tip.urgent ? 'coach urgent' : 'coach'} aria-label="Tip">
      <span className="coach-label">{tip.label}</span>
      <span className="coach-text">{tip.text}</span>
      <span className="coach-actions">
        {/* No point offering to take them somewhere they already are. */}
        {tip.panel && tip.panel !== panel && (
          <button className="coach-go" onClick={() => onGo(tip.panel as PanelId)}>
            show me
          </button>
        )}
        <button
          className="coach-go"
          onClick={() => mutate((s) => dismissTip(s, tip.id), true)}
          title="Understood. Do not say this one again — it is kept on the Advice page."
        >
          got it
        </button>
        <button
          className="coach-off"
          onClick={() => mutate((s) => setTipsOff(s, true), true)}
          title="Stop all hints. The hints button in the top bar brings them back, and the Advice page keeps every one of them."
        >
          ×
        </button>
      </span>
    </aside>
  );
}
