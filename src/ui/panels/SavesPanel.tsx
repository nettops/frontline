import { useState } from 'react';
import { useGame, getState, setGame } from '../../store';
import { Panel } from '../components';
import { SLOTS, AUTOSAVE_SLOT, allMeta, deleteSave, loadGame, saveGame } from '../../sim/save';
import type { SlotId } from '../../sim/save';
import { DIFFICULTY_BY_ID } from '../../config/difficulty';

export default function SavesPanel() {
  const state = useGame();
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [, forceRefresh] = useState(0);
  const saves = allMeta();
  const ironman = DIFFICULTY_BY_ID[state.difficulty].ironman;

  const refresh = () => forceRefresh((n) => n + 1);

  const doSave = (slot: SlotId) => {
    const current = getState();
    if (!current) return;
    const result = saveGame(current, slot);
    setMessage(
      result.ok
        ? { text: `Saved to slot ${slot}.` }
        : { text: result.error ?? 'Could not save.', bad: true },
    );
    refresh();
  };

  const doLoad = (slot: SlotId) => {
    const result = loadGame(slot);
    if (result.ok) {
      setGame(result.state);
      setMessage({ text: 'Loaded.' });
    } else {
      setMessage({ text: result.error, bad: true });
    }
  };

  const doDelete = (slot: SlotId) => {
    deleteSave(slot);
    setMessage({ text: `Slot ${slot} cleared.` });
    refresh();
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Saves</h1>
      </div>
      <p className="page-sub">
        The world is generated from a seed and the random stream is saved with it, so
        loading a save resumes exactly the game you left — not a re-rolled version of it.
      </p>

      {ironman && (
        <Panel title="Ironman">
          <p className="hot" style={{ margin: 0 }}>
            You are playing {DIFFICULTY_BY_ID[state.difficulty].name}. Only the autosave
            is written, and it is overwritten every time the day advances. What happens,
            happened.
          </p>
        </Panel>
      )}

      <Panel title="Slots" flush>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Who</th>
                <th>When</th>
                <th className="num">Money</th>
                <th className="num">Crew</th>
                <th className="num">Heat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {([...SLOTS, AUTOSAVE_SLOT] as SlotId[]).map((slot) => {
                const meta = saves[slot];
                const auto = slot === AUTOSAVE_SLOT;
                return (
                  <tr key={slot}>
                    <td className="mono">{auto ? 'Auto' : slot}</td>
                    <td>
                      {meta ? (
                        <div className="name-cell">
                          <span className="name-main">{meta.name}</span>
                          <span className="name-sub">
                            {meta.rank} · {meta.difficulty}
                          </span>
                        </div>
                      ) : (
                        <span className="faint">Empty</span>
                      )}
                    </td>
                    <td className="mono faint">{meta ? meta.date : '—'}</td>
                    <td className="num mono">
                      {meta ? `$${meta.cash.toLocaleString('en-US')}` : '—'}
                    </td>
                    <td className="num mono">{meta ? meta.crew : '—'}</td>
                    <td className="num mono">{meta ? meta.heat : '—'}</td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn small"
                          disabled={auto || ironman}
                          title={
                            auto
                              ? 'Written automatically as the day advances'
                              : ironman
                                ? 'Ironman writes only the autosave'
                                : undefined
                          }
                          onClick={() => doSave(slot)}
                        >
                          Save
                        </button>
                        <button
                          className="btn small"
                          disabled={!meta}
                          onClick={() => doLoad(slot)}
                        >
                          Load
                        </button>
                        <button
                          className="btn small danger"
                          disabled={!meta}
                          onClick={() => doDelete(slot)}
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {message && (
        <p className={message.bad ? 'hot' : 'good'} style={{ marginTop: 12 }}>
          {message.text}
        </p>
      )}

      <Panel title="Abandon this game">
        <div className="row between wrap">
          <p className="dim" style={{ margin: 0, maxWidth: '52ch' }}>
            Returns to the title screen. Anything not written to a slot is lost.
          </p>
          <button className="btn danger" onClick={() => setGame(null)}>
            Back to title
          </button>
        </div>
      </Panel>
    </>
  );
}
