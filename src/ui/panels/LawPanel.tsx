import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, Empty, KeyValue, Bar } from '../components';
import { Rng } from '../../sim/rng';
import {
  activeCases,
  allCases,
  destroyEvidence,
  hasContact,
  looseEvidence,
  pressureWitness,
  readCase,
  weeklyLegalCost,
  worstStage,
} from '../../sim/investigation';
import { formatMoney, formatShortDay } from '../../sim/util';
import { STAGES, STAGE_BY_ID, stageIndex, DESTROY_EVIDENCE, PRESSURE_WITNESS } from '../../config/lawEnforcement';
import {
  HEAT_CHANNELS,
  HEAT_CHANNEL_BLURB,
  HEAT_CHANNEL_EMPTY,
  HEAT_CHANNEL_LABEL,
} from '../../config/heat';
import { channelHeat } from '../../sim/heat';
import type { Investigation } from '../../sim/types';

export default function LawPanel() {
  const state = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const open = activeCases(state);
  const history = allCases(state).filter((c) => c.status === 'closed' || c.status === 'resolved');
  const selected = selectedId ? state.law.investigations[selectedId] : null;
  const worst = worstStage(state);
  const loose = looseEvidence(state);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Law Enforcement</h1>
        <span className="tiny">
          {open.length} open · {state.law.casesOpened} ever
        </span>
      </div>
      {/* Same door, same silence. See `DiplomacyPanel`. */}
      <p className="page-sub">
        <strong>Open a case to see what they have.</strong>{' '}
        Nobody is watching a meter. Every case here was built out of something you
        actually left behind — a job that went wrong, somebody taken in, a front
        pushed too hard. Stop leaving things and a case runs out of road.
      </p>

      <div className="grid-2">
        <Panel title="Where you stand">
          <KeyValue
            label="Open cases"
            value={open.length}
            tone={open.length > 0 ? 'hot' : 'good'}
          />
          <KeyValue
            label="Furthest anybody has got"
            value={worst ? STAGE_BY_ID[worst].name : 'Nothing'}
            tone={worst ? 'hot' : 'good'}
          />
          <KeyValue
            label="Evidence lying around"
            value={loose > 60 ? 'a great deal' : loose > 25 ? 'some' : loose > 0 ? 'a little' : 'none'}
            tone={loose > 25 ? 'hot' : undefined}
            />
          <KeyValue label="Weekly legal bill" value={formatMoney(weeklyLegalCost(state))} />

          {/*
            Where the pressure is actually coming from, which used to be
            unanswerable — heat was one number and the only lever was going
            quiet. Each channel names its own way out, because they genuinely
            are not the same problem.
          */}
          <div style={{ marginTop: 16 }}>
            {HEAT_CHANNELS.map((channel) => {
              const value = channelHeat(state, channel);
              return (
                <div key={channel} style={{ marginBottom: 10 }}>
                  <div className="row between">
                    <span className="tiny">{HEAT_CHANNEL_LABEL[channel]}</span>
                    <span className="tiny mono">{Math.round(value)}</span>
                  </div>
                  <Bar value={value} tone={value > 30 ? 'hot' : 'ok'} />
                  {/*
                    An empty channel says it is empty, rather than looking broken.

                    A round-7 tester watched "Inside the family" sit at zero for
                    a whole run and reported it as a dead gauge. It was not: the
                    channel is written by a handful of specific things and none
                    of them had happened. Three of these bars are usually not
                    moving at the same time, and a bar at zero with a
                    description of what would move it reads as a gauge; a bar at
                    zero on its own reads as a fault.
                  */}
                  <span className="tiny faint">
                    {value < 1 ? `Nothing here. ${HEAT_CHANNEL_EMPTY[channel]}` : HEAT_CHANNEL_BLURB[channel]}
                  </span>
                </div>
              );
            })}
            <p className="faint" style={{ marginTop: 6, marginBottom: 0 }}>
              Going quiet cools the street quickly, the books slowly, and does nothing
              whatsoever for somebody who is already talking. That one you have to
              deal with.
            </p>
          </div>
          {worst && (
            <p className="dim" style={{ marginTop: 10, marginBottom: 0 }}>
              {STAGE_BY_ID[worst].blurb}
            </p>
          )}
        </Panel>

        <Panel title="The ladder">
          <p className="faint" style={{ marginTop: 0 }}>
            Every case walks these in order. Which agency is working it decides how
            far it can go.
          </p>
          {STAGES.map((stage) => {
            const reached = worst && stageIndex(worst) >= stageIndex(stage.id);
            return (
              <div className="kv" key={stage.id}>
                <span className={reached ? 'kv-key hot' : 'kv-key faint'}>
                  {reached ? '▸' : '·'} {stage.name}
                </span>
                <span className="kv-val faint">{stage.minEvidence || '—'}</span>
              </div>
            );
          })}
        </Panel>
      </div>

      <Panel title="Open cases" flush>
        {open.length === 0 ? (
          <Empty>Nobody has a file on you. That is not the same as nobody looking.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Stage</th>
                  <th>Strength</th>
                  <th>Opened</th>
                  <th>Status</th>
                  <th>You know</th>
                </tr>
              </thead>
              <tbody>
                {open.map((investigation) => {
                  const read = readCase(state, investigation);
                  return (
                    <tr
                      key={investigation.id}
                      className={
                        investigation.id === selectedId ? 'clickable selected' : 'clickable'
                      }
                      onClick={() =>
                        setSelectedId(investigation.id === selectedId ? null : investigation.id)
                      }
                    >
                      <td>
                        <div className="name-cell">
                          <span className="name-main">{read.agency.shortName}</span>
                          <span className="name-sub">
                            up to {STAGE_BY_ID[read.agency.maxStage].name}
                          </span>
                        </div>
                      </td>
                      <td className={read.stageName ? 'hot' : 'faint'}>
                        {read.stageName ?? 'unknown'}
                      </td>
                      <td className={read.strength === 'unknown' ? 'faint' : 'hot'}>
                        {read.strength}
                      </td>
                      <td className="mono faint">{formatShortDay(investigation.openedDay)}</td>
                      <td className={investigation.status === 'cold' ? 'good' : 'dim'}>
                        {investigation.status === 'cold' ? 'losing momentum' : 'active'}
                      </td>
                      <td className="num mono faint">{Math.round(read.intel)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected && <CaseDetail investigation={selected} onClose={() => setSelectedId(null)} />}

      {history.length > 0 && (
        <Panel title="Closed" flush>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Opened</th>
                  <th>Ended</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((c) => (
                  <tr key={c.id}>
                    <td className="dim">{readCase(state, c).agency.shortName}</td>
                    <td className="mono faint">{formatShortDay(c.openedDay)}</td>
                    <td className="mono faint">
                      {c.verdictDay ? formatShortDay(c.verdictDay) : '—'}
                    </td>
                    <td className={c.verdict === 'convicted' ? 'hot' : 'good'}>
                      {c.verdict === 'convicted'
                        ? 'Convicted'
                        : c.verdict === 'acquitted'
                          ? 'Acquitted'
                          : 'Dropped'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

function CaseDetail({
  investigation,
  onClose,
}: {
  investigation: Investigation;
  onClose: () => void;
}) {
  const state = useGame();
  const read = readCase(state, investigation);
  const [message, setMessage] = useState<string | null>(null);

  const suspects = investigation.suspectIds
    .map((id) => state.npcs[id])
    .filter((n) => n && n.status !== 'dead' && n.status !== 'defected');

  const act = (fn: (rng: Rng) => { ok: boolean; message: string }) => {
    const result = mutate((s) => fn(new Rng(s.rng)), true);
    if (result) setMessage(result.message);
  };

  return (
    <Panel
      title={read.agency.name}
      action={
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      }
    >
      <p className="dim" style={{ marginTop: 0 }}>
        {read.agency.blurb}
      </p>

      <div className="grid-2">
        <div>
          <div className="row between" style={{ marginBottom: 4 }}>
            <span className="tiny">How much of this you can see</span>
            <span className="tiny">{Math.round(read.intel)}%</span>
          </div>
          <Bar value={read.intel} tone="cold" />
          <p className="faint" style={{ marginTop: 6 }}>
            {read.intel === 0
              ? 'You know they have a file and nothing else. A lawyer, or somebody inside, would change that.'
              : hasContact(state, investigation.agencyId)
                ? 'Your man inside tells you what the file says.'
                : 'Your counsel sees what gets filed.'}
          </p>

          <div style={{ marginTop: 12 }}>
            <KeyValue label="Stage" value={read.stageName ?? 'unknown'} tone="hot" />
            <KeyValue label="Case strength" value={read.strength} tone="hot" />
            <KeyValue label="Opened" value={formatShortDay(investigation.openedDay)} />
            <KeyValue
              label="They have named"
              value={read.suspects ?? `${investigation.suspectIds.length ? 'somebody' : 'nobody'} you know of`}
            />
          </div>
        </div>

        <div>
          <div className="tiny" style={{ marginBottom: 6 }}>
            What you can do about it
          </div>
          <div className="stack">
            <button
              className="btn small danger"
              title={`${formatMoney(DESTROY_EVIDENCE.cost)}. Works more often the sharper you are. When it fails it becomes a charge of its own.`}
              onClick={() => act((rng) => destroyEvidence(state, rng, investigation.id))}
            >
              Get at what they have — {formatMoney(DESTROY_EVIDENCE.cost)}
            </button>

            {suspects.length > 0 && (
              <>
                <div className="tiny" style={{ marginTop: 4 }}>
                  Lean on somebody they have named
                </div>
                {suspects.slice(0, 5).map((npc) => (
                  <button
                    key={npc.id}
                    className="btn small danger"
                    title={`${formatMoney(PRESSURE_WITNESS.cost)}. If they go to them instead, this gets much worse.`}
                    onClick={() =>
                      act((rng) => pressureWitness(state, rng, investigation.id, npc.id))
                    }
                  >
                    {npc.name}
                  </button>
                ))}
              </>
            )}
          </div>
          {message && (
            <p className="dim" style={{ marginTop: 10, marginBottom: 0 }}>
              {message}
            </p>
          )}
        </div>
      </div>

      {read.known.length > 0 && (
        <>
          <div className="tiny" style={{ margin: '18px 0 6px' }}>
            What you have seen of it
          </div>
          <div className="log" style={{ maxHeight: 200 }}>
            {read.known.map((entry, i) => (
              <div key={i} className="log-entry heat">
                <span className="log-day">{entry.day}</span>
                <span className="log-text">{entry.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
