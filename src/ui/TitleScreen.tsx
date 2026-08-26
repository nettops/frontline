import { useState } from 'react';
import { setGame } from '../store';
import { newGame } from '../sim/state';
import { loadGame, allMeta, type SlotId } from '../sim/save';
import { DIFFICULTIES } from '../config/difficulty';
import { MODES, MODE_BY_ID, SANDBOX_STARTS } from '../config/modes';
import type { DifficultyId, GameMode } from '../sim/types';
import { SkinToggle } from './components';
import { PlayerCustomiser } from './PlayerCustomiser';
import { lookFromName, type PlayerLook } from './art/playerLook';

export default function TitleScreen() {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<GameMode>('career');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [sandboxStart, setSandboxStart] = useState(SANDBOX_STARTS[0].id);
  const [error, setError] = useState<string | null>(null);
  /*
     Null until touched, and that is the point: the face follows the name you
     are typing until you take it over. Somebody who types a name and presses
     start still gets a person rather than a default, and somebody who wants
     to choose has not had a choice taken from them.
  */
  const [look, setLook] = useState<PlayerLook | null>(null);
  const shownLook = look ?? lookFromName(name);
  const saves = allMeta();
  const hasSaves = Object.values(saves).some(Boolean);

  const start = () => {
    setGame(newGame({ name, difficulty, mode, sandboxStart, look: shownLook }));
  };

  const resume = (slot: SlotId) => {
    const result = loadGame(slot);
    if (result.ok) setGame(result.state);
    else setError(result.error);
  };

  const startLabel =
    mode === 'simulation'
      ? 'Run the city'
      : mode === 'sandbox'
        ? 'Begin'
        : 'Start with $2,500';

  return (
    <div className="title-screen">
      <div className="title-card">
        <div className="title-mark">Frontline</div>
        <div className="title-rule" />
        <p className="title-sub">Nothing is given. Everything is noticed.</p>

        <div className="field">
          <span className="field-label">How you play it</span>
          <div className="choice-list">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={m.id === mode ? 'choice selected' : 'choice'}
                onClick={() => setMode(m.id)}
              >
                <div className="choice-name">{m.name}</div>
                <div className="choice-blurb">{m.blurb}</div>
              </button>
            ))}
          </div>
        </div>

        {/* No name to give and no crew to lose — asking for either would be
            asking about somebody who is not in this game. */}
        {mode !== 'simulation' && (
          <div className="field">
            <label className="field-label" htmlFor="boss-name">
              Your name
            </label>
            <input
              id="boss-name"
              className="input"
              value={name}
              maxLength={28}
              placeholder="Nobody"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
            />
          </div>
        )}

        {/*
          Only where there is somebody to be. Simulation has no player at all,
          which is the same reason the name field above is hidden for it.
        */}
        {mode !== 'simulation' && (
          <div className="field">
            <span className="field-label">What you look like</span>
            <PlayerCustomiser look={shownLook} onChange={setLook} />
          </div>
        )}

        {mode === 'sandbox' && (
          <div className="field">
            <span className="field-label">Where you start</span>
            <div className="choice-list">
              {SANDBOX_STARTS.map((s) => (
                <button
                  key={s.id}
                  className={s.id === sandboxStart ? 'choice selected' : 'choice'}
                  onClick={() => setSandboxStart(s.id)}
                >
                  <div className="choice-name">{s.name}</div>
                  <div className="choice-blurb">{s.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <span className="field-label">Difficulty</span>
          <div className="choice-list">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                className={d.id === difficulty ? 'choice selected' : 'choice'}
                onClick={() => setDifficulty(d.id)}
              >
                <div className="choice-name">{d.name}</div>
                <div className="choice-blurb">{d.blurb}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 24 }}>
          <button className="btn primary" onClick={start}>
            {startLabel}
          </button>
        </div>

        {hasSaves && (
          <>
            <div className="field-label" style={{ marginTop: 32 }}>
              Continue
            </div>
            <div className="choice-list">
              {(Object.entries(saves) as [SlotId, (typeof saves)[SlotId]][])
                .filter(([, meta]) => meta)
                .map(([slot, meta]) => (
                  <button key={slot} className="choice" onClick={() => resume(slot)}>
                    <div className="choice-name">
                      {meta!.name} — {meta!.rank}
                      {meta!.mode && meta!.mode !== 'career' && (
                        <span className="choice-tag">{MODE_BY_ID[meta!.mode].name}</span>
                      )}
                    </div>
                    <div className="choice-blurb">
                      {slot === 'auto' ? 'Autosave' : `Slot ${slot}`} · {meta!.date} ·{' '}
                      ${meta!.cash.toLocaleString('en-US')} · {meta!.crew} crew · heat{' '}
                      {meta!.heat}
                    </div>
                  </button>
                ))}
            </div>
          </>
        )}

        {error && (
          <p className="hot" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}

        {/*
          The skin is chosen before the game starts as often as during one, and
          this is the only screen you are guaranteed to see. Bottom of the card
          rather than the top: it is a preference, not part of setting up a run.
        */}
        <div className="row" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
          <SkinToggle />
        </div>
      </div>
    </div>
  );
}
