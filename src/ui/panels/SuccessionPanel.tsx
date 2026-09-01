import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, Empty, KeyValue, Bar, StatRead } from '../components';
import {
  claimBand,
  eligibleHeirs,
  heirOf,
  inheritRank,
  nameHeir,
  perceivedClaim,
} from '../../sim/succession';
import { formatShortDay } from '../../sim/util';
import { chronicle, chronicleSummary } from '../../sim/chronicle';
import { ROLE_LABEL, RANK_BY_ID } from '../../config/economy';
import { CLAIM, HANDOVER } from '../../config/succession';

export default function SuccessionPanel() {
  const state = useGame();
  const [message, setMessage] = useState<string | null>(null);

  const candidates = eligibleHeirs(state);
  const history = chronicle(state);
  const past = chronicleSummary(state);
  const heir = heirOf(state);
  /*
     Whether the room is restless, which is a fact about the player rather than
     about any one man. Read off the flag the weekly question sets rather than
     recomputing it here, so the panel cannot disagree with the simulation.
  */
  const unrest = (state.flags['unrest_told'] ?? 0) > 0;
  const namedButGone =
    state.succession.heirId !== null && heir === null ? state.npcs[state.succession.heirId] : null;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Succession</h1>
        <span className="tiny">
          {state.succession.generation === 1
            ? 'first generation'
            : `generation ${state.succession.generation}`}
        </span>
      </div>
      {/*
         What moves the number.

         A playtester watched this column drift over months and concluded there
         was no lever — "loyalty, ambition and standing all seemed to drift with
         calendar time alone". Three of the four terms are things the player
         does: promote him, send him on work, keep him. Only the fourth is the
         calendar. The weights were always in config/succession.ts and the panel
         never mentioned any of it.
      */}
      <p className="page-sub">
        You will not always be the one running this. A conviction, a bad week in a war,
        or the people who work for you deciding it should be somebody else — and what
        happens next depends entirely on whether there is somebody the room will follow.
        Naming somebody is the only say you get, and you have to do it long before you need it.
      </p>
      <p className="page-sub">
        A claim is mostly things you control. Rank is the largest single term and promotion
        is yours to give; record is what they have actually done, which means work you sent
        them on; standing is who they are. Only the years are the calendar's. Nobody drifts
        into being followed.
      </p>

      {unrest && (
        <Panel title="Something is being discussed">
          {/*
             Says that it is happening. Never who.

             Naming him would turn a succession risk into a to-do item — sit him
             down, pay him, done — and the whole point of this route is that the
             player has to go back to the crew sheet and read eight men through
             the same fog they read everything else through.
          */}
          <p className="hot" style={{ marginTop: 0 }}>
            There has been at least one meeting you were not at. Nobody will say whose
            idea it was, and the people who would normally tell you are among the people
            who did not.
          </p>
          <p className="dim" style={{ marginBottom: 0 }}>
            It is somebody senior who wants this and has stopped thinking much of you,
            with enough of the room carrying something of their own to let them. All of
            that is on the crew sheet, in the usual amount of fog.
          </p>
        </Panel>
      )}

      <div className="grid-2">
        <Panel title="If you go tomorrow">
          {heir ? (
            <>
              <KeyValue label="Next in line" value={heir.name} tone="brass" />
              <KeyValue label="Standing" value={ROLE_LABEL[heir.role]} />
              <KeyValue
                label="Named"
                value={
                  state.succession.heirNamedDay
                    ? formatShortDay(state.succession.heirNamedDay)
                    : '—'
                }
              />
              <p className="faint" style={{ marginTop: 10, marginBottom: 0 }}>
                Being named is worth a great deal and settles nothing on its own. If
                somebody else in the room has a better claim when the day comes, the
                room will follow them instead.
              </p>
            </>
          ) : namedButGone ? (
            /*
               "Gone" and "unavailable" are not the same sentence.

               `heirOf` returns null for a man who is merely ineligible today,
               which includes one sitting in custody with a release date. Round
               11 read "You named Nico Loscalzo and they are not here any more"
               while the Organization page showed him HELD 33D. He was inside,
               not dead, and the panel told the player to replace him.
            */
            <p className="hot" style={{ margin: 0 }}>
              {namedButGone.status === 'arrested' || namedButGone.status === 'injured' ? (
                <>
                  You named {namedButGone.name} and they cannot take it while they are{' '}
                  {namedButGone.status === 'arrested' ? 'inside' : 'laid up'}
                  {namedButGone.unavailableUntilDay
                    ? `, which is another ${Math.max(
                        0,
                        namedButGone.unavailableUntilDay - state.day,
                      )} days`
                    : ''}
                  . If the day came now, nobody is next.
                </>
              ) : (
                <>
                  You named {namedButGone.name} and they are not here any more. Nobody is
                  next. Name somebody before you find out the hard way.
                </>
              )}
            </p>
          ) : candidates.length === 0 ? (
            <p className="hot" style={{ margin: 0 }}>
              Nobody in this organization is senior enough to take it over. If you were
              removed tomorrow the whole thing would come apart inside a month. Promote
              somebody.
            </p>
          ) : (
            <p className="dim" style={{ margin: 0 }}>
              Nobody has been named. If it happened tomorrow, whoever the room looked at
              would end up with it — which is not the same as it going to the right man.
            </p>
          )}
        </Panel>

        <Panel title="What a handover costs">
          <KeyValue
            label="Standing kept"
            value={`${Math.round(HANDOVER.respectKept * 100)}%`}
            tone="hot"
          />
          <KeyValue
            label="Clean money kept"
            value={`${Math.round(HANDOVER.cleanCashKept * 100)}%`}
          />
          <KeyValue label="Ground kept" value={`${Math.round(HANDOVER.influenceKept * 100)}%`} />
          <KeyValue
            label="They start as"
            value={RANK_BY_ID[inheritRank(state.player.rank)].name}
          />
          <p className="faint" style={{ marginTop: 10, marginBottom: 0 }}>
            The open files lose the man they were built around, so a succession is also
            the only way out of a case that is about to land. The evidence survives. It
            is a reprieve, not an amnesty.
          </p>
        </Panel>
      </div>

      <Panel
        title="Who could hold it"
        flush
        action={
          <span className="tiny faint">
            Weighted: {Math.round(CLAIM.role * 100)}% rank · {Math.round(CLAIM.standing * 100)}%
            standing · {Math.round(CLAIM.record * 100)}% record · {Math.round(CLAIM.tenure * 100)}%
            years
          </span>
        }
      >
        {candidates.length === 0 ? (
          <div style={{ padding: '14px 18px' }}>
            <Empty>
              Nobody has the standing. Nobody follows an {ROLE_LABEL.associate.toLowerCase()}
              — move somebody up first.
            </Empty>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Standing</th>
                  <th className="num">With you</th>
                  <th>Ambition</th>
                  <th>Loyalty</th>
                  <th>Would the room follow them</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {candidates.map((npc) => {
                  const claim = perceivedClaim(state, npc);
                  const isHeir = heir?.id === npc.id;
                  return (
                    <tr key={npc.id} className={isHeir ? 'selected' : undefined}>
                      <td>
                        <div className="name-cell">
                          <span className="name-main">{npc.name}</span>
                          {isHeir && <span className="name-sub">named successor</span>}
                        </div>
                      </td>
                      <td className="dim">{ROLE_LABEL[npc.role]}</td>
                      <td className="num mono">{Math.floor(npc.daysInCrew / 30)}mo</td>
                      <td>
                        <StatRead npc={npc} stat="ambition" warnHigh />
                      </td>
                      <td>
                        <StatRead npc={npc} stat="loyalty" />
                      </td>
                      <td style={{ minWidth: 190 }}>
                        <div className="tiny dim" style={{ marginBottom: 4 }}>
                          {claimBand(claim)}
                        </div>
                        <Bar value={claim * 100} />
                      </td>
                      <td className="num">
                        <button
                          className="btn small"
                          disabled={isHeir}
                          title={
                            isHeir
                              ? 'They are already next'
                              : 'Everyone senior enough to have hoped will hear about it'
                          }
                          onClick={() => {
                            const result = mutate((s) => nameHeir(s, npc.id), true);
                            if (result) setMessage(result.message);
                          }}
                        >
                          {isHeir ? 'Named' : 'Name them'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {heir && (
        <p className="dim" style={{ marginTop: 12 }}>
          <button
            className="btn small danger"
            onClick={() => {
              const result = mutate((s) => nameHeir(s, null), true);
              if (result) setMessage(result.message);
            }}
          >
            Take it back from {heir.name}
          </button>{' '}
          <span className="tiny faint">
            Changing your mind lands worse than never having said it.
          </span>
        </p>
      )}

      {message && (
        <p className="dim" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}

      <Panel title="The line" flush>
        {state.succession.line.length === 0 ? (
          <div style={{ padding: '14px 18px' }}>
            <Empty>
              You are the first, and so far the only. Everything here was built by you
              and currently ends with you.
            </Empty>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Name</th>
                  <th>Reached</th>
                  <th>Ran it</th>
                  <th>How it ended</th>
                </tr>
              </thead>
              <tbody>
                {state.succession.line.map((p, i) => (
                  <tr key={`${p.name}-${p.toDay}`}>
                    <td className="num mono">{i + 1}</td>
                    <td className="name-main">{p.name}</td>
                    <td className="dim">{RANK_BY_ID[p.rank].name}</td>
                    <td className="dim">
                      {formatShortDay(p.fromDay)} — {formatShortDay(p.toDay)}
                    </td>
                    <td className="dim">{p.fate}</td>
                  </tr>
                ))}
                <tr className="selected">
                  <td className="num mono">{state.succession.line.length + 1}</td>
                  <td className="name-main">{state.player.name}</td>
                  <td className="dim">{RANK_BY_ID[state.player.rank].name}</td>
                  <td className="dim">still running it</td>
                  <td className="dim">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/*
         Everybody who was ever in this family.

         Here rather than on the crew sheet because the crew sheet is who you
         have, and this is who you had. It sits under the succession line for
         the same reason: both are the family across time rather than the
         family tonight.

         The reason it needs to exist at all is that the log is capped at 400
         entries and a career writes far more — measured, a 300-day boss can
         see half his own career and a 600-day boss a fifth of it, so the
         founding of the family is the first thing the game throws away. See
         `sim/chronicle.ts`, which derives all of this from people the
         simulation already keeps forever.

         Oldest first, which is the opposite of the log and correct for a
         record rather than a feed.
      */}
      <Panel title="What happened to this family">
        {history.length === 0 ? (
          <Empty>Nothing has happened to anybody yet.</Empty>
        ) : (
          <>
            <p className="dim" style={{ marginTop: 0 }}>
              {past.everJoined} {past.everJoined === 1 ? 'person has' : 'people have'} been
              yours since {formatShortDay(past.since)}. {past.stillHere} still{' '}
              {past.stillHere === 1 ? 'is' : 'are'}
              {past.gone > 0 && `, and ${past.gone} ${past.gone === 1 ? 'is' : 'are'} not`}.
            </p>
            <div className="stack">
              {history.map((c, i) => (
                <p
                  key={`${c.npcId}-${c.day}-${i}`}
                  className={c.tone === 'bad' ? 'hot' : c.tone === 'good' ? 'good' : 'dim'}
                  style={{ margin: '0 0 2px' }}
                >
                  <span className="mono faint">{formatShortDay(c.day)}</span> {c.text}
                </p>
              ))}
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
