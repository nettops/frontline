import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, KeyValue, Bar } from '../components';
import { Rng } from '../../sim/rng';
import {
  activeWars,
  atWar,
  canDo,
  diplomaticCost,
  doDiplomacy,
  factionStrength,
  playerStrength,
  relationship,
  relationshipLabelFor,
} from '../../sim/diplomacy';
import { rivals } from '../../sim/faction';
import { formatMoney } from '../../sim/util';
import { type FactionId } from '../../config/factions';
import { DIPLOMATIC_ACTIONS } from '../../config/diplomacy';
import { REASONS, SITDOWN } from '../../config/sitdown';
import { canSitDownWith, openSitdown } from '../../sim/sitdown';
import { houseColour, houseShort } from '../../sim/houses';

export default function DiplomacyPanel() {
  const state = useGame();
  const [selectedId, setSelectedId] = useState<FactionId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const all = rivals(state);
  const wars = activeWars(state);
  const mine = playerStrength(state);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Diplomacy</h1>
        <span className="tiny">
          {wars.length} {wars.length === 1 ? 'war' : 'wars'} in the city
        </span>
      </div>
      <p className="page-sub">
        Resentment builds on its own — taking a family's ground, leaning on their
        people, taking one of their men. It stops one step short of war. Crossing
        that last step is always somebody's decision, and getting back out of it
        takes an agreement rather than time.
      </p>

      <div className="grid-2">
        <Panel title="Your position">
          <KeyValue label="What you can put on the street" value={Math.round(mine)} tone="brass" />
          <KeyValue
            label="Wars you are in"
            value={all.filter((f) => atWar(state, 'player', f.id)).length}
            tone={all.some((f) => atWar(state, 'player', f.id)) ? 'hot' : 'good'}
          />
          <p className="faint" style={{ marginTop: 10, marginBottom: 0 }}>
            Strength is your available people and how good they are. Anybody hurt or
            inside does not count.
          </p>
        </Panel>

        <Panel title="Wars in the city">
          {wars.length === 0 ? (
            <p className="dim" style={{ margin: 0 }}>
              Nobody is fighting anybody. That rarely lasts.
            </p>
          ) : (
            wars.map(([a, b]) => (
              <div className="kv" key={`${a}-${b}`}>
                <span className="kv-key">
                  {houseShort(state, a)} v {houseShort(state, b)}
                </span>
                <span className={a === 'player' || b === 'player' ? 'kv-val hot' : 'kv-val'}>
                  {a === 'player' || b === 'player' ? 'yours' : 'theirs'}
                </span>
              </div>
            ))
          )}
        </Panel>
      </div>

      <Panel title="Where everybody stands" flush>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Toward you</th>
                <th className="num">Strength</th>
                {all.map((f) => (
                  <th key={f.id}>v {houseShort(state, f.id)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map((faction) => {
                const standing = relationship(state, faction.id, 'player');
                return (
                  <tr
                    key={faction.id}
                    className={faction.id === selectedId ? 'clickable selected' : 'clickable'}
                    onClick={() =>
                      setSelectedId(faction.id === selectedId ? null : (faction.id as FactionId))
                    }
                  >
                    <td className="name-main" style={{ color: houseColour(state, faction.id) }}>
                      {houseShort(state, faction.id)}
                    </td>
                    <td className={standing <= -70 ? 'hot' : standing < -15 ? 'dim' : 'good'}>
                      {relationshipLabelFor(standing)}
                    </td>
                    <td className="num mono">{Math.round(factionStrength(state, faction.id))}</td>
                    {all.map((other) => (
                      <td
                        key={other.id}
                        className={
                          other.id === faction.id
                            ? 'faint'
                            : atWar(state, faction.id, other.id)
                              ? 'hot'
                              : 'dim'
                        }
                      >
                        {other.id === faction.id
                          ? '—'
                          : relationshipLabelFor(relationship(state, faction.id, other.id))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {selectedId && (
        <TalkTo
          target={selectedId}
          onClose={() => setSelectedId(null)}
          onResult={setMessage}
        />
      )}

      {message && (
        <p className="dim" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
    </>
  );
}

function TalkTo({
  target,
  onClose,
  onResult,
}: {
  target: FactionId;
  onClose: () => void;
  onResult: (message: string) => void;
}) {
  const state = useGame();
  // Their view of you: it is what decides whether they take the meeting.
  const standing = relationship(state, target, 'player');
  const theirStrength = factionStrength(state, target);
  const mine = playerStrength(state);
  const war = atWar(state, 'player', target);
  const sitCheck = canSitDownWith(state, target);

  return (
    <Panel
      title={`Talking to the ${houseShort(state, target)}`}
      action={
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="grid-2">
        <div>
          <div className="row between" style={{ marginBottom: 4 }}>
            <span className="tiny">Where you stand with them</span>
            <span className={war ? 'tiny hot' : 'tiny'}>{relationshipLabelFor(standing)}</span>
          </div>
          {/* Mapped from -100..100 onto the bar. */}
          <Bar value={standing + 100} max={200} tone={standing < -40 ? 'hot' : undefined} />

          <div style={{ marginTop: 12 }}>
            <KeyValue label="Your strength" value={Math.round(mine)} tone="brass" />
            <KeyValue
              label="Theirs"
              value={Math.round(theirStrength)}
              tone={theirStrength > mine ? 'hot' : 'good'}
            />
            {war && (
              <p className="hot" style={{ marginTop: 10, marginBottom: 0 }}>
                You are at war. Every week costs you money and people until one of you
                stops it.
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="tiny" style={{ marginBottom: 6 }}>
            What you can say
          </div>
          <div className="stack">
            {DIPLOMATIC_ACTIONS.map((action) => {
              const check = canDo(state, action.id, target);
              const cost = diplomaticCost(state, action.id, target);
              return (
                <button
                  key={action.id}
                  className={
                    action.id === 'declare_war' ? 'btn small danger' : 'btn small'
                  }
                  disabled={!check.ok}
                  title={check.ok ? action.blurb : check.message}
                  onClick={() => {
                    const result = mutate(
                      (s) => doDiplomacy(s, new Rng(s.rng), action.id, target),
                      true,
                    );
                    if (result) onResult(result.message);
                  }}
                >
                  {action.name}
                  {cost > 0 ? ` — ${formatMoney(cost)}` : ''}
                </button>
              );
            })}
          </div>
          {/*
             Everything above is a lever you pull at a house from a distance.
             This is the one where you go and sit in a room with the man
             running it, and what you get out of it depends on whether you read
             him right rather than on what you spent.
          */}
          <div className="sit-row" style={{ marginTop: 14 }}>
            <span className="tiny">Ask for a meeting</span>
            {/*
               The line the crew sheet got and this door did not.

               F14 is about an entry point that reads as a button producing a
               line of text rather than as a door into a scene, and the repair
               went onto `CrewPanel` only — where the comment above says the
               same thing to whoever is reading the source and nothing at all
               to whoever is playing. There are two doors into this system.
            */}
            <p className="tiny faint" style={{ margin: '4px 0 0' }}>
              A conversation in a back room, not an answer — it runs as long as they will
              sit there, and how you read them decides what you come away with. Once every{' '}
              {SITDOWN.cooldownDays} days with the same house.
            </p>
            <div className="stack" style={{ marginTop: 6 }}>
              {REASONS.filter((r) => r.kind === 'rival').map((reason) => (
                <button
                  key={reason.id}
                  className="btn small"
                  disabled={!sitCheck.ok}
                  title={sitCheck.ok ? reason.blurb : sitCheck.message}
                  onClick={() => {
                    const result = mutate(
                      (s) => openSitdown(s, 'rival', target, reason.id),
                      false,
                    );
                    if (result && !result.ok) onResult(result.message);
                  }}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </div>

          <p className="faint tiny" style={{ marginTop: 10, marginBottom: 0 }}>
            Nothing here is guaranteed. Peace has to be wanted by both sides.
          </p>
        </div>
      </div>
    </Panel>
  );
}
