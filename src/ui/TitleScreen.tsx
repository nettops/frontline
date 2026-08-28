import { useState } from 'react';
import { setGame } from '../store';
import { newGame } from '../sim/state';
import { loadGame, allMeta, type SlotId } from '../sim/save';
import { DIFFICULTIES } from '../config/difficulty';
import { MODES, MODE_BY_ID, SANDBOX_STARTS } from '../config/modes';
import {
  DEFAULT_NATIONALITY,
  NATIONALITIES,
  nationalityDef,
  type NationalityId,
} from '../config/nationalities';
import type { DifficultyId, GameMode } from '../sim/types';
import { PlayerCustomiser } from './PlayerCustomiser';
import { lookFromName, type PlayerLook } from './art/playerLook';

export default function TitleScreen() {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<GameMode>('career');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [sandboxStart, setSandboxStart] = useState(SANDBOX_STARTS[0].id);
  const [nationality, setNationality] = useState<NationalityId>(DEFAULT_NATIONALITY);
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
    setGame(newGame({ name, difficulty, mode, sandboxStart, nationality, look: shownLook }));
  };

  const resume = (slot: SlotId) => {
    const result = loadGame(slot);
    if (result.ok) setGame(result.state);
    else setError(result.error);
  };

  /* A name from the chosen pool, to show the picker doing something. */
  const example = nationalityDef(nationality);
  const exampleName = `e.g. ${example.first[0].name} ${example.last[0]}`;

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

        {/*
           Sits above the name field because it decides what goes in it, and
           because "where are your people from" is the question a 1935 city
           asks first. Hidden in Simulation for the same reason the name is:
           there is nobody in that mode for it to be about.
        */}
        {mode !== 'simulation' && (
          <div className="field">
            <span className="field-label">Where your people are from</span>
            <div className="choice-list">
              {NATIONALITIES.map((n) => (
                <button
                  key={n.id}
                  className={n.id === nationality ? 'choice selected' : 'choice'}
                  onClick={() => setNationality(n.id)}
                >
                  <div className="choice-name">{n.name}</div>
                  <div className="choice-blurb">{n.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        )}

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
              /*
                 An example from the chosen community rather than the word
                 "Nobody", so the picker visibly does something before you
                 commit to it. Marked "e.g." because it is not a promise: the
                 real fallback name is drawn from the seed, which does not
                 exist until you press the button, so the name you actually
                 get will be a different one out of the same pool.
              */
              placeholder={exampleName}
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
                      {/* Was "Nobody — Street Criminal". The day is what tells
                          two careers apart anyway, and it does not contradict
                          being the boss of them. */}
                      {meta!.name} — day {meta!.day}
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
      </div>
    </div>
  );
}
