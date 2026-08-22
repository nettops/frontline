import { useGame, mutate } from '../../store';
import { Panel, Empty } from '../components';
import { formatShortDay } from '../../sim/util';
import { MODE_BY_ID } from '../../config/modes';
import {
  TIPS,
  nextTip,
  restoreAllTips,
  restoreTip,
  retiredOn,
  shownOn,
  setTipsOff,
  tipsOff,
} from '../tips';

/**
 * Everything the game has told you, and everything it still might.
 *
 * The strip is a drip and a drip has an obvious hole in it: something goes by
 * once, you dismiss it while thinking about something else, and it is gone for
 * the rest of the save. So the tips are also a place rather than only a
 * moment.
 *
 * Two decisions worth keeping:
 *
 * A tip you have not been told shows its heading and nothing else. Printing
 * all eighteen would turn this into the manual the strip exists to avoid, and
 * would spoil the pacing of a first career for the sake of a page nobody needs
 * on day one. The heading is enough to say there is more coming.
 *
 * Anything you *have* been told shows in full, forever. Reading it here is the
 * re-read; "say it again" only appears on a tip you retired that is still
 * true, because putting something back on the strip that the strip would
 * immediately decline to show is a button that does nothing.
 */
export default function TipsPanel() {
  const state = useGame();
  const current = nextTip(state);
  const off = tipsOff(state);

  // Told, not retired. Most of the opening chain is never dismissed — it goes
  // past and stops being true — and a page that only knew about dismissals
  // would file the tutorial under "not said yet" the moment it finished.
  const told = TIPS.filter((t) => shownOn(state, t.id) !== null && t.id !== current?.id);
  const waiting = TIPS.filter((t) => shownOn(state, t.id) === null && t.id !== current?.id);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Advice</h1>
        <span className="tiny">
          {told.length} of {TIPS.length} said
          {off ? ' · switched off' : ''}
        </span>
      </div>
      <p className="page-sub">
        There is no manual. The game says one thing at a time, at the moment it becomes
        true, and it never says the same thing twice — this is where what it said is
        kept.
      </p>

      <Panel
        title="On screen now"
        action={
          <button
            className="btn small"
            onClick={() => mutate((s) => setTipsOff(s, !off), true)}
            title={
              off
                ? 'Start showing tips again.'
                : 'Stop showing tips. Nothing here is lost — they stay on this page.'
            }
          >
            {off ? 'Turn tips on' : 'Turn tips off'}
          </button>
        }
      >
        {current ? (
          <div className="tip-row">
            <span className="tip-label">{current.label}</span>
            <span className="tip-text">{current.text}</span>
          </div>
        ) : (
          <Empty>
            {off
              ? 'Tips are switched off.'
              : 'Nothing to say. Something will come up when it is worth saying.'}
          </Empty>
        )}
      </Panel>

      <Panel
        title="What you have been told"
        flush
        action={
          told.length > 0 && (
            <button
              className="btn small"
              onClick={() => mutate((s) => restoreAllTips(s), true)}
              title="Treat every tip as unsaid. The ones that are still true will come round again."
            >
              Bring them all back
            </button>
          )
        }
      >
        {told.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          told.map((tip) => {
            const retired = retiredOn(state, tip.id);
            return (
              <div key={tip.id} className="tip-row seen">
                <span className="tip-label">{tip.label}</span>
                <span className="tip-text">
                  {tip.text}
                  <span className="tiny faint" style={{ display: 'block', marginTop: 3 }}>
                    {retired !== null
                      ? `Retired ${formatShortDay(retired)}`
                      : `Said ${formatShortDay(shownOn(state, tip.id) as number)}`}
                  </span>
                </span>
                {/* Only a retired tip can be put back — one that simply stopped
                    being true is not being withheld from anybody. */}
                {retired !== null && tip.when(state) && (
                  <button
                    className="btn small"
                    onClick={() => mutate((s) => restoreTip(s, tip.id), true)}
                    title="Put it back on the strip. It is still true."
                  >
                    Say it again
                  </button>
                )}
              </div>
            );
          })
        )}
      </Panel>

      <Panel title="Not said yet" flush>
        {waiting.length === 0 ? (
          <Empty>That is all of them.</Empty>
        ) : (
          waiting.map((tip) => {
            // Two ways a tip is never coming: its moment has passed, or this
            // is not the kind of game it belongs to. Withholding either one is
            // no longer protecting the pacing of anything.
            const passed = tip.ceiling !== undefined && state.day > tip.ceiling;
            const wrongGame = !!tip.only && !tip.only.includes(state.mode);
            const note = wrongGame
              ? `Only in a ${tip.only!.map((m) => MODE_BY_ID[m].name.toLowerCase()).join(' or a ')}.`
              : passed
                ? `Only offered in the first ${tip.ceiling} days. That moment has gone.`
                : null;
            return (
              <div key={tip.id} className="tip-row">
                <span className="tip-label">{tip.label}</span>
                <span className={note ? 'tip-text' : 'tip-text faint'}>
                  {note ? (
                    <>
                      {tip.text}
                      <span className="tiny faint" style={{ display: 'block', marginTop: 3 }}>
                        {note}
                      </span>
                    </>
                  ) : (
                    'Waiting on something to be true.'
                  )}
                </span>
              </div>
            );
          })
        )}
      </Panel>
    </>
  );
}
