import { useState } from 'react';
import {
  callEverybodyIn,
  canCallEverybodyIn,
  canTakeTheWeight,
  takeTheWeight,
} from '../../sim/verbs';
import { hasVerb } from '../../sim/build';
import { useGame, mutate } from '../../store';
import { Panel, Empty, StatRead, StatusTag, KeyValue, Bar, payRead } from '../components';
import {
  crewList,
  goalBlurb,
  perceive,
  perceivedGoal,
  secretKnown,
  visibleTraits,
} from '../../sim/npc';
import { CrewPortrait } from '../CrewPortrait';
import { followRisk, readTies, whoWouldFollow } from '../../sim/ties';
import { canSilence, silence } from '../../sim/silence';
import { callOffMark, liveMarks } from '../../sim/marks';
import { Rng } from '../../sim/rng';
import { canSitDownWith, openSitdown } from '../../sim/sitdown';
import { REASONS, SITDOWN } from '../../config/sitdown';
import { readMemories } from '../../sim/memory';
import { daysLeft, promisesTo } from '../../sim/promises';
import { PROMISE, PROMISES } from '../../config/promises';
import {
  canPromote,
  canRaise,
  canRecruit,
  dismiss,
  promote,
  recruit,
  recruitCost,
  setWage,
} from '../../sim/crew';
import { payrollForecast, recentWeeklyTake, wageBillWith } from '../../sim/economy';
import { nightsWorked } from '../../sim/standing';
import { canTeach, startTraining, stopTraining, trainingFor } from '../../sim/training';
import { TRAINING } from '../../config/training';
import { totalWeeklyRevenue } from '../../sim/business';
import { maxCrew } from '../../sim/player';
import { formatMoney, formatShortDay } from '../../sim/util';
import { ROLE_LABEL } from '../../config/economy';
import { PERCEPTION_TIERS, READABLE_STATS, TRAIT_BY_ID } from '../../config/npcs';
import type { Npc, NpcStatId } from '../../sim/types';

const WARN_HIGH: NpcStatId[] = ['greed', 'ambition'];

const STAT_LABEL: Record<NpcStatId, string> = {
  loyalty: 'Loyalty',
  greed: 'Greed',
  ambition: 'Ambition',
  fear: 'Nerve',
  courage: 'Courage',
  intelligence: 'Intelligence',
  discipline: 'Discipline',
  skill: 'Skill',
  leadership: 'Leadership',
  respectForBoss: 'Regard for you',
  grievance: 'Grudges',
};


export default function CrewPanel() {
  const state = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const crew = crewList(state);
  const recruits = Object.values(state.recruits);
  const selected = selectedId ? state.npcs[selectedId] : null;
  const cost = recruitCost(state);
  const payroll = payrollForecast(state);
  const marks = liveMarks(state);
  /*
     Men the law is currently holding, for the Stomach verb.

     Empty for every build without the points, so the panel it feeds never
     renders — the same rule the card and the meeting follow.
  */
  const inside = hasVerb(state, 'stomach')
    ? crew.filter((n) => n.status === 'arrested')
    : [];
  // What the place actually earns in a week: finished jobs plus the fronts.
  const income = recentWeeklyTake(state) + totalWeeklyRevenue(state);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Organization</h1>
        <span className="tiny">
          {crew.length} of {maxCrew(state)} · recruiting costs {formatMoney(cost)}
        </span>
      </div>
      {/*
         The second sentence is the repair.

         Rows have been `cursor: pointer` and nothing else, which is an
         affordance only a mouse can find. Round 16 had three testers reach
         days 32, 43 and 81 before clicking one, and all three called what is
         behind it the best screen in the game — traits, grudges, the job
         history, the sit-down. One wrote: "Nothing anywhere suggests the rows
         are clickable."

         Said here rather than as a tooltip, because a tooltip is the same
         mistake one layer down.
      */}
      <p className="page-sub">
        You cannot see what these people actually are. You see what you have had the
        chance to notice, and that sharpens only by working alongside them.{' '}
        <span className="hot">Open somebody</span> to read what they are carrying, sit
        down with them, or move them up.
      </p>

      {/*
           The one thing a boss with Grip can do that nobody else can.

           On the crew screen rather than on the build screen, because the
           build screen says what you *are* and this is a thing you *do* — and
           the room it produces is about these people. Shown only when it is
           open, because a control that is never available to most builds is
           clutter for most careers.
        */}
      {/*
           Going in for one of them, which is the Stomach verb.

           On the crew screen because the decision is about a person, and it
           only appears when they actually have somebody — a standing button
           offering to go to prison for nobody in particular would be the
           strangest control in the game.
        */}
      {inside.length > 0 && (
        <Panel title="They have somebody">
          {inside.map((npc) => {
            const can = canTakeTheWeight(state, npc.id);
            return (
              <div key={npc.id} className="row between" style={{ marginBottom: 6 }}>
                <span>{npc.name}</span>
                <button
                  className="btn small"
                  disabled={!can.ok}
                  title={can.message}
                  onClick={() => mutate((g) => takeTheWeight(g, npc.id), true)}
                >
                  Go in for them
                </button>
              </div>
            );
          })}
          <p className="faint tiny" style={{ marginBottom: 0 }}>
            You do the time instead. Everybody finds out who did it.
          </p>
        </Panel>
      )}

      {canCallEverybodyIn(state).ok && (
        <Panel title="Everybody in">
          <p className="dim" style={{ marginTop: 0 }}>
            The whole family in one room. Grievances come out, and you find out who did
            not come.
          </p>
          <button className="btn" onClick={() => mutate((g) => callEverybodyIn(g), true)}>
            Call everybody in
          </button>
        </Panel>
      )}

      <Panel title="Your people" flush>
        {crew.length === 0 ? (
          <Empty>Nobody. That is a problem.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Standing</th>
                  <th>Loyalty</th>
                  <th>Skill</th>
                  <th className="num">Nights</th>
                  <th>Ambition</th>
                  <th className="num">Wage</th>
                  <th>Pay</th>
                  <th className="num">Known</th>
                </tr>
              </thead>
              <tbody>
                {crew.map((npc) => {
                  const pay = payRead(npc);
                  return (
                    <tr
                      key={npc.id}
                      className={npc.id === selectedId ? 'clickable selected' : 'clickable'}
                      onClick={() => setSelectedId(npc.id === selectedId ? null : npc.id)}
                    >
                      <td>
                        {/*
                           The portrait is drawn at the resolution the player
                           has earned — see ui/art/paint.ts. A man you have not
                           worked with is a silhouette here, which is the same
                           rule perceive() and memories.ts already follow.
                        */}
                        <div className="name-cell with-portrait">
                          <CrewPortrait npc={npc} />
                          <div>
                            <span className="name-main">{npc.name}</span>
                            <span className="name-sub">
                              {ROLE_LABEL[npc.role]} · {npc.age}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusTag npc={npc} day={state.day} />
                      </td>
                      <td>
                        <StatRead npc={npc} stat="loyalty" />
                      </td>
                      <td>
                        <StatRead npc={npc} stat="skill" />
                      </td>
                      {/*
                         A count of what you did, never a stat about them. Every
                         other column here is a hedged read of a hidden number;
                         this one is a plain fact, and it is the only column on
                         the page you are wholly responsible for.
                      */}
                      <td className="num mono">{nightsWorked(state, npc.id)}</td>
                      <td>
                        <StatRead npc={npc} stat="ambition" warnHigh />
                      </td>
                      <td className="num mono">{formatMoney(npc.wage)}</td>
                      {/*
                          Nowrap, because this is the longest phrase in the row
                          and the narrowest column it lands in.

                          Round 13 reported the roster "overflowing horizontally"
                          at a narrow viewport. Measured, the page does not
                          overflow at all — `.table-wrap` scrolls, as designed.
                          What it saw was this cell squeezed to 60px around
                          "thinks they are worth more", breaking it to one word
                          per line and making every row in the roster 113px tall.

                          Letting the table keep its width and scroll is the
                          behaviour the wrapper already exists to provide; five
                          lines of shredded text in a 60px column is not.
                      */}
                      <td className={pay.tone} style={{ whiteSpace: 'nowrap' }}>
                        {pay.text}
                      </td>
                      <td className="num">
                        <span className="tiny">{Math.round(npc.familiarity)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {message && (
          <p className="dim" style={{ margin: '10px 14px 0' }}>
            {message}
          </p>
        )}
      </Panel>

      {selected && <CrewDetail npc={selected} onClose={() => setSelectedId(null)} />}

      {/*
         People who got away, and are still out there talking.

         Listed rather than left on the man's own sheet, because a defected NPC
         drops off the roster entirely and the whole risk of this feature is
         forgetting it is running. It is the same reasoning the standing-order
         panel carries: an automation you cannot see is not a decision you are
         still making.
      */}
      {marks.length > 0 && (
        <Panel title="Still looking">
          {marks.map((m) => {
            const who = state.npcs[m.npcId];
            return (
              <div key={m.id} className="kv">
                <span className="kv-key">
                  <span className="name-main">{who?.name ?? 'Somebody'}</span>{' '}
                  <span className="faint tiny">
                    gone {state.day - m.setDay} days · {m.tries}{' '}
                    {m.tries === 1 ? 'attempt' : 'attempts'} ·{' '}
                    {Math.round(m.chance * 100)}% the next one finds them
                  </span>
                </span>
                <button
                  className="btn small"
                  onClick={() => mutate((s) => callOffMark(s, m.id), true)}
                >
                  Leave it
                </button>
              </div>
            );
          })}
          <p className="faint tiny" style={{ margin: '8px 0 0' }}>
            Every week they are out there is another week of somebody asking them
            questions. Calling it off does not change that.
          </p>
        </Panel>
      )}

      <Panel
        title="Available to bring in"
        action={
          <span className="tiny">
            {formatMoney(cost)} each · payroll {formatMoney(payroll.due)} a week against{' '}
            <span className={payroll.due > income ? 'hot' : undefined}>
              {formatMoney(income)} coming in
            </span>
          </span>
        }
        flush
      >
        {recruits.length === 0 ? (
          <Empty>Nobody worth approaching right now.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>What you can tell</th>
                  <th className="num">Wage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recruits.map((npc) => {
                  const hireCheck = canRecruit(state, npc.id);
                  /*
                     The fee is not the cost.

                     This screen used to show a one-off price and a weekly
                     figure sitting in a column, and hiring read as a decision
                     with no downside — there is never a reason not to take a
                     free man. The reason is that the wage is permanent and the
                     fee is not, and a crew you cannot pay on Friday is worse
                     than a crew you do not have. So the button says what the
                     week looks like afterwards, in the moment the choice is
                     made rather than in the log four weeks later.

                     Measured against what the organization earns, not what is
                     in the drawer. One good score covers a lot of Fridays once
                     and none of them twice, and comparing a permanent rate to
                     a one-off balance is exactly how a player ends up with a
                     crew they cannot pay.
                  */
                  const after = wageBillWith(state, npc.wage);
                  const tight = after > income;
                  return (
                  <tr key={npc.id}>
                    <td>
                      <div className="name-cell with-portrait">
                        <CrewPortrait npc={npc} />
                        <div>
                          <span className="name-main">{npc.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{npc.age}</td>
                    <td className="dim">
                      {visibleTraits(npc).length > 0
                        ? visibleTraits(npc)
                            .map((t) => TRAIT_BY_ID[t]?.name)
                            .filter(Boolean)
                            .join(' · ')
                        : 'Nothing obvious'}
                    </td>
                    <td
                      className={tight ? 'num mono hot' : 'num mono'}
                      title={
                        tight
                          ? `Payroll would be ${formatMoney(after)} a week against ${formatMoney(income)} coming in. You would be short every Friday. Keep Friday's money out of the next job and you will not be.`
                          : `Payroll would be ${formatMoney(after)} a week against ${formatMoney(income)} coming in. Whatever the size of the crew, what keeps a payday covered is holding its money back before you stake the rest.`
                      }
                    >
                      {formatMoney(npc.wage)}/wk
                    </td>
                    <td>
                      {/*
                        The cap is the limit people expect; the fee is the one
                        that actually stops them. Guarding only the first meant
                        a broke boss got a live button that did nothing.
                      */}
                      <button
                        className="btn small"
                        disabled={!hireCheck.ok}
                        title={`${hireCheck.message} Payroll would be ${formatMoney(after)} a week, every week${
                          tight ? ' — more than you would have left.' : '.'
                        }`}
                        onClick={() => {
                          const result = mutate((s) => recruit(s, npc.id), true);
                          if (result) setMessage(result.message);
                        }}
                      >
                        Bring in
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
    </>
  );
}

function CrewDetail({ npc, onClose }: { npc: Npc; onClose: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const state = useGame();
  const promoteCheck = canPromote(state, npc);
  const tier = [...PERCEPTION_TIERS].reverse().find((t) => npc.familiarity >= t.minFamiliarity);
  const traits = visibleTraits(npc);
  const goal = perceivedGoal(npc);
  const blurb = goalBlurb(npc);
  // Read through both men: how somebody is with a person you have never met is
  // not something you would have noticed.
  const ties = readTies(state, npc);
  const behind = whoWouldFollow(state, npc);
  const wouldGo = followRisk(state, npc);
  // The most intimate thing this sheet shows: not what he is like, but what
  // has been done to him. Gated highest of anything here for that reason.
  const memories = readMemories(npc, state.day);
  /*
     Not perceived, and not gated on familiarity.

     Everything else on this half of the sheet is a guess at what he is like.
     This is a record of what *you* said, which you are entitled to read back
     exactly. A promise the player was never shown would be a trick rather than
     a decision — which is the whole reason the flag that used to record this
     was worth turning into a system.
  */
  const owed = promisesTo(state, npc.id);
  /*
     Whether there is anything left to save.

     A playtester raised a wage, ran a full sit-down, and watched the man quit
     anyway — then wrote that they had no way of knowing whether that was
     foreseeable or bad luck. It was foreseeable: below `defectLoyaltyBelow` a
     man is rolling to walk every week, and nothing you spend outruns the roll
     for long.

     Said through the perception system rather than as a number, like everything
     else on this sheet — and only once you know him well enough to have noticed,
     because the whole design is that you do not get told, you get to see.
  */
  const loyaltyRead = perceive(npc, 'loyalty');
  const beyondReach = loyaltyRead.known && loyaltyRead.bandIndex === 0;
  const sitCheck = canSitDownWith(state, npc.id);
  const raiseCheck = canRaise(state, npc.id);
  const silenceCheck = canSilence(state, npc.id);
  /*
     Two clicks, and the second one prints the odds.

     Not a modal, because this screen already opens one to show a man and a
     dialogue on top of a dialogue is where playtesters stop reading. The
     button becoming a question is enough to stop a misclick, and it is the
     only place in this panel that shows a number instead of a phrase.
  */
  const [confirmSilence, setConfirmSilence] = useState(false);

  return (
    <Panel
      title={npc.name}
      action={
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="grid-2">
        <div>
          <div className="portrait-block">
            <CrewPortrait npc={npc} scale={3} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between" style={{ marginBottom: 4 }}>
                <span className="tiny">How well you know them</span>
                <span className="tiny">{Math.round(npc.familiarity)}%</span>
              </div>
              <Bar value={npc.familiarity} tone="cold" />
              <p className="faint" style={{ marginTop: 6 }}>
                {tier?.label}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {READABLE_STATS.map((stat) => (
              <div className="kv" key={stat}>
                <span className="kv-key">{STAT_LABEL[stat]}</span>
                <span>
                  <StatRead npc={npc} stat={stat} warnHigh={WARN_HIGH.includes(stat)} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <KeyValue label="Role" value={ROLE_LABEL[npc.role]} tone="brass" />
          <KeyValue label="Age" value={String(npc.age)} />
          <KeyValue label="Wage" value={`${formatMoney(npc.wage)} / week`} />
          <KeyValue label="With you since" value={formatShortDay(npc.joinedDay)} />
          <KeyValue
            label="Record"
            value={`${npc.opsCompleted} clean · ${npc.opsFailed} wrong`}
          />
          {traits.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>
                What people say about them
              </div>
              {traits.map((id) => {
                const t = TRAIT_BY_ID[id];
                return t ? (
                  <p key={id} className="dim" style={{ margin: '0 0 4px' }}>
                    <span className="brass">{t.name}</span> — {t.description}
                  </p>
                ) : null;
              })}
            </div>
          )}
          {goal && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>
                What they are after
              </div>
              <p className={goal.certain ? 'brass' : 'dim'} style={{ margin: 0 }}>
                {goal.text}
              </p>
              {blurb && (
                <p className="faint" style={{ margin: '2px 0 0' }}>
                  {blurb}
                </p>
              )}
              {!goal.certain && (
                <p className="faint" style={{ margin: '2px 0 0' }}>
                  That is the impression. It is not the same thing.
                </p>
              )}
            </div>
          )}

          {ties.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>
                How they are with the others
              </div>
              {ties.map((tie) => (
                <p
                  key={tie.name}
                  className={tie.tone === 'bad' ? 'hot' : tie.tone === 'good' ? 'good' : 'dim'}
                  style={{ margin: '0 0 2px' }}
                >
                  {tie.text}
                </p>
              ))}
            </div>
          )}

          {/*
               And the other direction, which is the one that costs you people.

               `readTies` above is what this man thinks of everybody else. Ties
               are stored on whoever's opinion changed, so that list could never
               answer the question a boss is actually asking when he looks at
               somebody he is thinking of dismissing: who comes out of the door
               behind him. `followDeparture` reads exactly that and it was
               readable from every sheet except this one.

               The count is stated separately from the names because they are
               different claims: the names are men you know well enough to have
               noticed, and the number is everybody who would go, including
               people you have not got the measure of.
            */}
          {(behind.length > 0 || wouldGo > 1) && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>
                Who is behind them
              </div>
              {behind.map((tie) => (
                <p
                  key={tie.name}
                  className={tie.tone === 'bad' ? 'hot' : tie.tone === 'good' ? 'good' : 'dim'}
                  style={{ margin: '0 0 2px' }}
                >
                  {tie.text}
                </p>
              ))}
              {wouldGo > 1 && (
                <p className="hot tiny" style={{ margin: '2px 0 0' }}>
                  If they walked, as many as {wouldGo} could go with them.
                </p>
              )}
            </div>
          )}

          {memories.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>
                What they have not forgotten
              </div>
              {memories.map((m, i) => (
                <p
                  key={i}
                  className={m.tone === 'bad' ? 'hot' : 'good'}
                  style={{ margin: '0 0 2px' }}
                >
                  {m.raw ? 'They ' : 'Years ago they '}
                  {m.text}.
                  <span className="faint"> {formatShortDay(m.day)}</span>
                </p>
              ))}
            </div>
          )}

          {beyondReach && (
            <p className="hot" style={{ marginTop: 10, marginBottom: 0 }}>
              They are past the point where money reaches them. Anything you spend here
              buys time, not loyalty — and not much of it.
            </p>
          )}

          {owed.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>
                What you told them
              </div>
              {owed.map((promise) => {
                const left = daysLeft(state, promise);
                return (
                  <p
                    key={promise.kind}
                    className={left <= PROMISE.urgentWithin ? 'hot' : 'dim'}
                    style={{ margin: '0 0 2px' }}
                  >
                    {PROMISES[promise.kind].outstanding}.
                    <span className="faint">
                      {' '}
                      {left === 0
                        ? 'Today'
                        : `${left} ${left === 1 ? 'day' : 'days'} of patience left`}
                    </span>
                  </p>
                );
              })}
            </div>
          )}

          {npc.secret && secretKnown(npc) && (
            <p className="hot" style={{ marginTop: 10 }}>
              You know something about them: {npc.secret}
            </p>
          )}

          {/*
             The room.

             Everything else on this sheet is a readout — you look at what you
             can tell about him and then go and allocate him somewhere. This is
             the one control that lets the player *use* the perception system
             rather than only read it, so it sits above the roster actions
             rather than among them.
          */}
          <div className="sit-row" style={{ marginTop: 14 }}>
            <span className="tiny">Sit down with them</span>
            {/*
               A line saying that a room is a room.

               Round 13 read these four labels for 299 days as "four buttons
               that would produce a line of text, so I never pressed one", then
               found the sit-down on day 300 and called it probably the best
               system in the game. Round 12 found it on day 19 and said the same
               thing about its quality. Same build, same system, 281 days apart
               in discovery — the entry point was the only difference.

               So the door says what is behind it: a scene, not a result. The
               numbers come from `SITDOWN` rather than the sentence, because a
               promise about a mechanic has to move when the mechanic does.
            */}
            <p className="tiny faint" style={{ margin: '4px 0 0' }}>
              A conversation in a back room, not an answer — it runs as long as they will
              sit there, and how
              you handle them decides what you come away knowing. Once every{' '}
              {SITDOWN.cooldownDays} days with the same person.
            </p>
            <div className="btn-row" style={{ marginTop: 6 }}>
              {REASONS.filter((r) => r.kind === 'crew').map((reason) => (
                <button
                  key={reason.id}
                  className="btn small"
                  disabled={!sitCheck.ok}
                  title={sitCheck.ok ? reason.blurb : sitCheck.message}
                  onClick={() => {
                    const result = mutate(
                      (s) => openSitdown(s, 'crew', npc.id, reason.id),
                      false,
                    );
                    if (result && !result.ok) setMessage(result.message);
                  }}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </div>

          <Teaching npc={npc} />

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button
              className="btn small"
              disabled={!promoteCheck.ok}
              title={promoteCheck.message}
              onClick={() => mutate((s) => promote(s, npc.id), true)}
            >
              {promoteCheck.ok ? promoteCheck.message : 'Cannot promote'}
            </button>
            {/*
              At the ceiling this button used to do nothing, say nothing, and
              charge him eight points of grievance for a pay cut he had not
              had — the clamp returned his existing wage and the raise/cut test
              read "unchanged" as "cut". It is guarded now, and it says why.
            */}
            <button
              className="btn small"
              disabled={!raiseCheck.ok}
              title={raiseCheck.message}
              onClick={() => {
                const result = mutate(
                  (s) => setWage(s, npc.id, Math.round(npc.wage * 1.25)),
                  true,
                );
                if (result) setMessage(result.message);
              }}
            >
              Raise pay 25%
            </button>
            <button
              className="btn small danger"
              disabled={npc.status === 'busy'}
              title={
                npc.status === 'busy'
                  ? 'They are in the middle of a job'
                  : 'They walk away knowing how you work'
              }
              onClick={() => {
                mutate((s) => dismiss(s, npc.id), true);
                onClose();
              }}
            >
              Cut loose
            </button>
            {/*
               The other answer, and the reason there are two buttons here.

               Cutting somebody loose is cheap and certain and leaves a man on
               the street who can be asked questions. This is expensive and
               uncertain and leaves nobody. Neither is the right one — that is
               the decision, and `sim/silence.ts` exists to keep it a decision.

               The odds are printed rather than hidden behind a phrase, unlike
               everything else about a man on this screen. Perception fog is
               about what you can tell about somebody; this is a statement
               about what you are ordering, and a boss knows what he is asking
               for even when he does not know who he is asking it about.
            */}
            <button
              className="btn small danger"
              disabled={!silenceCheck.ok}
              title={
                silenceCheck.ok
                  ? 'No informant ever walks away from this. It can also go wrong.'
                  : silenceCheck.message
              }
              onClick={() => {
                if (!confirmSilence) {
                  setConfirmSilence(true);
                  return;
                }
                const result = mutate((s) => silence(s, new Rng(s.rng), npc.id), true);
                setConfirmSilence(false);
                if (result) setMessage(result.message);
              }}
            >
              {confirmSilence
                ? `Certain? ${Math.round((silenceCheck.chance ?? 0) * 100)}% it goes quietly`
                : 'Make sure they stay quiet'}
            </button>
          </div>
          {message && (
            <p className="dim" style={{ marginTop: 10 }}>
              {message}
            </p>
          )}
        </div>
      </div>

      {npc.notes.length > 0 && (
        <>
          <div className="tiny" style={{ margin: '18px 0 6px' }}>
            What you have seen
          </div>
          <div className="log" style={{ maxHeight: 200 }}>
            {npc.notes.map((note, i) => (
              <div
                key={i}
                className={`log-entry ${note.kind === 'good' ? 'success' : note.kind === 'bad' ? 'failure' : ''}`}
              >
                <span className="log-day">{note.day}</span>
                <span className="log-text">{note.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

/**
 * Putting one man with another.
 *
 * The teacher list shows what you *think* each man is worth, not what he is —
 * `perceive` is the only way anything in this game reads somebody else's
 * stats, and choosing a teacher under that fog is most of the decision. A man
 * you barely know may be the best in the room or may be the reason your junior
 * comes back sloppy.
 *
 * `canTeach` is asked per candidate rather than filtered on silently, so the
 * row that cannot teach says why instead of not being there.
 */
function Teaching({ npc }: { npc: Npc }) {
  const state = useGame();
  const running = trainingFor(state, npc.id);

  if (running) {
    const other =
      state.npcs[running.teacherId === npc.id ? running.studentId : running.teacherId];
    const left = Math.max(0, running.endDay - state.day);
    const isTeacher = running.teacherId === npc.id;
    return (
      <div style={{ marginTop: 14 }}>
        <div className="tiny" style={{ marginBottom: 6 }}>
          Learning
        </div>
        <p className="dim" style={{ margin: '0 0 6px' }}>
          {isTeacher
            ? `Showing ${other?.name ?? 'somebody'} how it is done.`
            : `Out with ${other?.name ?? 'somebody'}, learning the work.`}{' '}
          {left} {left === 1 ? 'day' : 'days'} left. Neither of them is available.
        </p>
        <Bar value={TRAINING.days - left} max={TRAINING.days} />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button
            className="btn small danger"
            title="Call it off. They both come back today and nobody learned anything."
            onClick={() => mutate((s) => stopTraining(s, running.id), true)}
          >
            Call it off
          </button>
        </div>
      </div>
    );
  }

  if (npc.status !== 'active') return null;

  const teachers = crewList(state)
    .filter((n) => n.status === 'active' && n.id !== npc.id && !trainingFor(state, n.id))
    .map((n) => ({ man: n, check: canTeach(state, n.id, npc.id) }))
    .filter((t) => t.check.ok)
    .sort((a, b) => b.man.stats.skill - a.man.stats.skill);

  return (
    <div style={{ marginTop: 14 }}>
      <div className="tiny" style={{ marginBottom: 6 }}>
        Put them with somebody
      </div>
      <p className="faint tiny" style={{ margin: '0 0 6px' }}>
        {TRAINING.days} days. Both of them are off the board for all of it, and what
        comes across is not only how good somebody is — it is how careful they are too.
      </p>
      {teachers.length === 0 ? (
        <Empty>Nobody free has anything to show them.</Empty>
      ) : (
        <div className="btn-row">
          {teachers.slice(0, 6).map(({ man }) => (
            <button
              key={man.id}
              className="btn small"
              title={`${man.name} — you read them as ${perceive(man, 'skill').band}, ${
                perceive(man, 'discipline').band
              }`}
              onClick={() => mutate((s) => startTraining(s, man.id, npc.id), true)}
            >
              {man.name} · {perceive(man, 'skill').band}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
