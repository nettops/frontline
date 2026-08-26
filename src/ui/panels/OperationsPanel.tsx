import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, Empty, Bar, StatRead } from '../components';
import {
  availableOperations,
  lockedOperations,
  canLaunch,
  cancelOperation,
  crewCompetence,
  crewNeeded,
  heatScale,
  launchOperation,
  successBreakdown,
  sentimentOutlook,
} from '../../sim/operations';
import {
  canOpenScore,
  kitOf,
  liveScores,
  openScore,
  readyEverything,
  scoreCost,
  scoreOn,
  setupsLeft,
} from '../../sim/scores';
import { SCORE, SETUP_BY_ID } from '../../config/scores';
import { PATTERN } from '../../config/standingOrders';
import { autopilotOn, setAutopilot } from '../../sim/autopilot';
import {
  cancelStanding,
  liveStanding,
  patternOn,
  setStanding,
  standingFor,
} from '../../sim/standingOrders';
import { availableCrew } from '../../sim/npc';
import { nightsWorked } from '../../sim/standing';
import {
  controlLevel,
  operableTerritories,
  playerInfluence,
  territoryDef,
} from '../../sim/territory';
import { totalFunds } from '../../sim/economy';
import { isLayingLow } from '../../sim/heat';
import { formatMoney, formatShortDay } from '../../sim/util';
import {
  APPROACHES,
  APPROACH_BY_ID,
  DEFAULT_APPROACH,
  OPERATION_BY_ID,
  RISK_LABEL,
  type ApproachId,
} from '../../config/operations';
import { CONTROL_LABEL, SENTIMENT_HOSTILE_BELOW } from '../../config/territories';
import { ROLE_LABEL } from '../../config/economy';
import type { OperationDef } from '../../sim/types';

export default function OperationsPanel() {
  const state = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [crewPicked, setCrewPicked] = useState<string[]>([]);
  const [territoryPicked, setTerritoryPicked] = useState<string | null>(null);
  /*
     How you work is a habit, not a per-job decision.

     Crew and district are properties of the job in front of you and are right
     to clear when you pick a different one. The approach is not — it is a
     statement about how this outfit does business, and a playtester who had
     settled on working quiet found it back on Straight every single time they
     opened a job, which taught them to stop looking at it. So it persists for
     as long as the panel is mounted, and the heat line under the buttons says
     what the standing choice costs on this particular job.
  */
  const [approach, setApproach] = useState<ApproachId>(DEFAULT_APPROACH);

  const open = availableOperations(state);
  const locked = lockedOperations(state);
  const active = Object.values(state.activeOperations);
  const free = availableCrew(state);
  const def = selected ? OPERATION_BY_ID[selected] : null;
  const districts = operableTerritories(state);
  // Default to where you are strongest — the extra decision should be there to
  // make, not something you have to make before you can do anything.
  const territoryId = territoryPicked ?? districts[0]?.territory.id ?? '';

  /*
     Scores in hand, and which of them the selected job is a setup for.

     A setup is an ordinary operation, so it flows through the assemble panel
     below with no special case: the same crew picker, the same district
     picker, the same odds breakdown. All this has to work out is which score
     the gear is going into, which the panel knows because it is the one that
     offered the button.
  */
  const scores = liveScores(state);
  const standing = liveStanding(state);
  const setupFor = selected
    ? (scores.find((sc) => setupsLeft(state, sc).some((x) => x.id === selected)) ?? null)
    : null;
  const scoreHere = def ? scoreOn(state, def.id) : undefined;
  // What the job actually needs tonight, which a prepared job has cut into.
  const needed = def ? crewNeeded(state, def) : 0;

  const choose = (id: string, at?: string) => {
    setSelected(id === selected ? null : id);
    setCrewPicked([]);
    // A setup runs where the score is being built. Anywhere else is not the
    // same job, and making the player re-pick it every time would be four
    // clicks to say something the score already said.
    setTerritoryPicked(at ?? null);
  };

  /*
     Two ways to fill a crew, and deliberately not one.

     Ticking men one at a time was the single largest cost of playing this
     game — roughly twelve hundred clicks across a three-hundred-day career,
     more than everything else on every screen combined.

     It is filled by *policy* rather than by a button called "auto", because
     who you send is the one decision `spread.probe` exists to measure and the
     training work made it matter more: concentrate the work and your best man
     sharpens while the floor rots. A single fill would have had a silent
     default, and that default would quietly have become the strategy. Two
     buttons make the trade the thing you are choosing, and neither is
     pre-selected.
  */
  const fill = (how: 'best' | 'rested') => {
    if (!def) return;
    const order =
      how === 'best'
        ? ranked
        : [...free].sort((a, b) => nightsWorked(state, a.id) - nightsWorked(state, b.id));
    setCrewPicked(order.slice(0, crewNeeded(state, def)).map((n) => n.id));
  };

  const toggleCrew = (id: string) => {
    setCrewPicked((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : def && prev.length >= needed
          ? prev
          : [...prev, id],
    );
  };

  // Passed the approach, because it is now part of whether a job can go at all:
  // quiet work moves while the organization is dark and nothing else does. A
  // check that left it out would grey out the one option that is available.
  const check = def ? canLaunch(state, def, crewPicked, territoryId, approach) : null;

  /*
     What each job would pay off at, before you open it.

     The odds breakdown inside the assemble panel is the best thing on this
     screen and it was one click deep, so comparing four jobs meant opening
     four of them and remembering the numbers. This is the same arithmetic run
     against the crew you would actually send — your strongest available
     people, in the district the picker defaults to — so the column answers
     "which of these is worth doing" without committing to any of them.

     Null when you could not staff it at all; a percentage for a job you cannot
     run is a number about nothing.
  */
  const ranked = [...free].sort(
    (a, b) => crewCompetence([b]) - crewCompetence([a]),
  );
  /*
     The approach is part of this, and it was being left out.

     This called `successBreakdown` without the approach, so the column read
     the same whichever way you chose to do the work — while the assemble panel
     directly below it recalculated on every click. A round-7 tester changed
     the approach, watched one number move and the other not, and wrote it down
     as the table being broken. It was the table being honest about a default
     nobody had told them was a default.
  */
  const bestOdds = (op: OperationDef): number | null => {
    const want = crewNeeded(state, op);
    if (ranked.length < want || !territoryId) return null;
    return successBreakdown(state, op, ranked.slice(0, want), territoryId, approach).total;
  };
  /*
     The same arithmetic `resolveOperation` does, so the preview cannot drift
     from the charge: the job's own heat, scaled down for work beneath your
     standing, then multiplied by how you have chosen to do it.
  */
  const approachHeat = def
    ? def.heatOnSuccess * heatScale(state, def) * APPROACH_BY_ID[approach].heat
    : 0;
  const approachHeatFailed = def
    ? def.heatOnFailure * heatScale(state, def) * APPROACH_BY_ID[approach].heat
    : 0;

  const crewObjects = crewPicked.map((id) => state.npcs[id]).filter(Boolean);
  // Only meaningful once the job is fully staffed — a half-picked crew would
  // read as a terrible crew and show a number the player would never get.
  const staffed = !!def && crewPicked.length === needed;
  const breakdown =
    def && staffed ? successBreakdown(state, def, crewObjects, territoryId, approach) : null;

  const launch = () => {
    if (!def) return;
    const forScore = setupFor?.id;
    mutate(
      (s) => launchOperation(s, def.id, crewPicked, territoryId, approach, forScore),
      true,
    );
    setSelected(null);
    setCrewPicked([]);
    setTerritoryPicked(null);
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Operations</h1>
        <span className="tiny">
          {free.length} available · {formatMoney(totalFunds(state))} on hand
        </span>
      </div>
      <p className="page-sub">
        Every job takes people off the street for its duration and adds to what the
        world knows about you. The odds you are shown are the odds you get.
      </p>

      {active.length > 0 && (
        <Panel title="Running now" flush>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Started</th>
                  <th className="num">Odds</th>
                  <th className="num">Days left</th>
                  <th>Progress</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {active.map((op) => {
                  const d = OPERATION_BY_ID[op.defId];
                  return (
                    <tr key={op.id}>
                      <td>
                        <div className="name-cell">
                          <span className="name-main">{d.name}</span>
                          <span className="name-sub">
                            {territoryDef(op.territoryId)?.name} · {op.crewIds.length} on it
                          </span>
                        </div>
                      </td>
                      <td className="mono faint">{formatShortDay(op.startDay)}</td>
                      <td className="num mono">{Math.round(op.successChance * 100)}%</td>
                      <td className="num mono">{op.endDay - state.day}</td>
                      <td style={{ minWidth: 110 }}>
                        <Bar value={state.day - op.startDay} max={op.endDay - op.startDay} />
                      </td>
                      <td>
                        <button
                          className="btn small danger"
                          onClick={() => mutate((s) => cancelOperation(s, op.id), true)}
                          title="Pull the plug. Most of the money comes back, and calling it off raises heat — walking away is noticed too."
                        >
                          Call off
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {isLayingLow(state) && (
        <Panel title="Laying low">
          <p className="brass" style={{ margin: 0 }}>
            Until day {state.org.layLowUntilDay}, only the quiet approach moves. Anything
            louder is refused, and the street reads it as weakness.
          </p>
        </Panel>
      )}

      {/*
         What you have handed over.

         Listed rather than buried on the job it belongs to, because the whole
         risk of this feature is forgetting it is on. An order that keeps
         sending men at a job whose odds have collapsed is the cost it is sold
         on — but only if you can see it happening.
      */}
      {/*
         The whole loop, handed over.

         Placed above the board rather than tucked in a settings menu for the
         same reason the standing-order list is: an automation you cannot see
         is not a decision you are still making. The line under it says what it
         measured as rather than what it promises — it is a way to stop
         clicking, not a way to win, and a player who turns it on expecting an
         edge should be told otherwise here rather than find out in four years.
      */}
      <Panel title="The work">
        <div className="kv">
          <span className="kv-key">
            <span className="name-main">
              {autopilotOn(state) ? 'Your people go where it is worst' : 'You pick every crew'}
            </span>{' '}
            <span className="faint tiny">
              {autopilotOn(state)
                ? 'best and most careful on the riskiest work, every day'
                : 'nothing goes out unless you send it'}
            </span>
          </span>
          <button
            className={autopilotOn(state) ? 'btn small danger' : 'btn small'}
            onClick={() => mutate((st) => setAutopilot(st, !autopilotOn(st)), true)}
          >
            {autopilotOn(state) ? 'Take it back' : 'Let it run'}
          </button>
        </div>
        <p className="faint tiny" style={{ margin: '8px 0 0' }}>
          It changes who goes, never what runs — the jobs are the ones you would have
          taken anyway. It does not read heat and it does not decide tonight is a bad
          night. Measured, it comes out level with playing by hand: this saves you the
          clicking, it does not win you anything.
        </p>
      </Panel>

      {standing.length > 0 && (
        <Panel title="Runs itself">
          {standing.map((o) => {
            const d = OPERATION_BY_ID[o.defId];
            return (
              <div key={o.id} className="kv">
                <span className="kv-key">
                  <span className="name-main">{d?.name ?? 'A job'}</span>{' '}
                  <span className="faint tiny">
                    in {territoryDef(o.territoryId)?.name} · {o.how === 'best' ? 'best people' : 'whoever is rested'} ·
                    fired {o.launched} {o.launched === 1 ? 'time' : 'times'} ·{' '}
                    {groove(patternOn(state, o.defId, o.territoryId))}
                  </span>
                </span>
                <button
                  className="btn small danger"
                  onClick={() => mutate((st) => cancelStanding(st, o.id), true)}
                >
                  Take it back
                </button>
              </div>
            );
          })}
          <p className="faint tiny" style={{ margin: '8px 0 0' }}>
            It does not read the room. It will keep sending them out when the odds have
            gone, because that is what you told it to do — and the same job on the same
            street gets easier to predict every night. Move it before it wears a groove.
          </p>
        </Panel>
      )}

      {/*
         The month in front of the job.

         Placed above the board rather than inside it because a score is not a
         job you are choosing between — it is a thing already running, with a
         clock on it, and the decision it asks for is what to do next rather
         than what to do at all.
      */}
      {scores.length > 0 && (
        <Panel title="Building up to">
          {scores.map((sc) => {
            const target = OPERATION_BY_ID[sc.defId];
            const left = setupsLeft(state, sc);
            const kit = kitOf(sc);
            const days = Math.max(0, sc.dueDay - state.day);
            return (
              <div key={sc.id} style={{ marginBottom: 18 }}>
                <div className="kv">
                  <span className="kv-key">
                    <span className="name-main">{target?.name ?? 'A job'}</span>{' '}
                    <span className="faint tiny">
                      in {territoryDef(sc.territoryId)?.name} ·{' '}
                      {state.npcs[sc.manId]?.name ?? 'somebody'} is watching it
                    </span>
                  </span>
                  <span className={days <= 7 ? 'kv-val hot' : 'kv-val mono'}>
                    {sc.status === 'running'
                      ? 'out tonight'
                      : `${days} ${days === 1 ? 'day' : 'days'} left`}
                  </span>
                </div>
                <div style={{ margin: '6px 0 8px' }}>
                  <Bar value={SCORE.windowDays - days} max={SCORE.windowDays} />
                </div>
                <p className="tiny" style={{ margin: '0 0 8px' }}>
                  {kit.length === 0 ? (
                    <span className="faint">Nothing in hand yet.</span>
                  ) : (
                    <span className="good">
                      In hand: {kit.map((g) => g.name.toLowerCase()).join(', ')}.
                    </span>
                  )}
                  {sc.alertness > 0 && (
                    <span className="hot">
                      {' '}
                      They are watching harder now — {Math.round(sc.alertness)} off the odds
                      by the time you move.
                    </span>
                  )}
                </p>
                {sc.status === 'open' && left.length > 0 && (
                  <div className="btn-row" style={{ marginBottom: 6 }}>
                    {/*
                       The whole month of groundwork in one move, filled by the
                       same two policies the crew picker offers. Named for what
                       it does rather than "auto", because it is still your
                       call who goes.
                    */}
                    <button
                      className="btn small primary"
                      title="Send everybody you can spare on all of it at once, best people first."
                      onClick={() => mutate((st) => readyEverything(st, sc, 'best'), true)}
                    >
                      Get it all ready — best
                    </button>
                    <button
                      className="btn small"
                      title="The same, sending whoever has been out least."
                      onClick={() => mutate((st) => readyEverything(st, sc, 'rested'), true)}
                    >
                      …or whoever is rested
                    </button>
                  </div>
                )}
                {sc.status === 'open' && left.length > 0 && (
                  <div className="btn-row">
                    {left.map((setup) => (
                      <button
                        key={setup.id}
                        className={setup.id === selected ? 'btn small primary' : 'btn small'}
                        title={setup.description}
                        onClick={() => choose(setup.id, sc.territoryId)}
                      >
                        {setup.name}
                      </button>
                    ))}
                  </div>
                )}
                {sc.status === 'open' && left.length === 0 && (
                  <p className="faint tiny" style={{ margin: 0 }}>
                    Everything that can be got is got, or is out. Run the job.
                  </p>
                )}
              </div>
            );
          })}
          <p className="faint tiny" style={{ margin: 0 }}>
            Whatever is in hand is used on the night and then got rid of. Getting rid of it
            badly is how the police come to have it.
          </p>
        </Panel>
      )}

      <Panel
        title="Work available"
        action={<SameAgain onLaunched={() => setSelected(null)} />}
        flush
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Job</th>
                <th>Risk</th>
                <th className="num">Crew</th>
                <th className="num">Up front</th>
                <th className="num">Pays</th>
                <th className="num">Days</th>
                <th className="num">Heat</th>
                {/*
                   Says whose odds these are.

                   A playtester read this column as "your odds with the crew you
                   picked", watched it not move when they changed the crew, and
                   filed it as stale data. It was never stale — it is the best
                   the job can do with your best available people, straight, in
                   the district selected below. The number was honest and the
                   header was not specific enough to prove it.
                */}
                <th className="num" title="Your best available crew, in the district and with the approach selected below. The assemble panel shows the odds for the crew you actually pick.">
                  Best odds
                </th>
              </tr>
            </thead>
            <tbody>
              {open.map((op) => (
                <OperationRow
                  key={op.id}
                  op={op}
                  needed={crewNeeded(state, op)}
                  scale={heatScale(state, op)}
                  odds={bestOdds(op)}
                  selected={op.id === selected}
                  onClick={() => choose(op.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {def && (
        <Panel title={`Assemble — ${def.name}`}>
          <p className="dim" style={{ marginTop: 0 }}>
            {def.description}
          </p>

          {/*
             Putting somebody on a place, which is the whole feature in one
             button.

             The bill is a body rather than money on purpose: the measured
             cause of a dead week in this game is a shortage of people and
             never a shortage of money, and a flat fee big enough to be felt is
             unpayable by half the careers this exists for. Tick one name to
             say who — the same picker the job itself uses, so the cost is a
             face rather than a number.
          */}
          {SETUP_BY_ID[def.id] === undefined &&
            !scoreHere &&
            canOpenScore(state, def.id).ok && (
              <div className="btn-row" style={{ margin: '0 0 14px' }}>
                <button
                  className="btn small"
                  disabled={crewPicked.length !== 1}
                  title={
                    crewPicked.length === 1
                      ? `${state.npcs[crewPicked[0]]?.name} watches the place for ${
                          SCORE.windowDays
                        } days. Anything you get ready in that time goes in with you.`
                      : 'Tick one name below to say who watches the place.'
                  }
                  onClick={() => {
                    const man = crewPicked[0];
                    mutate((st) => openScore(st, def.id, territoryId, man), true);
                    setSelected(null);
                    setCrewPicked([]);
                  }}
                >
                  {crewPicked.length === 1
                    ? `Put ${state.npcs[crewPicked[0]]?.name} on it — ${formatMoney(
                        scoreCost(state),
                      )}`
                    : `Build up to it — ${formatMoney(scoreCost(state))}`}
                </button>
                <span className="faint tiny" style={{ alignSelf: 'center' }}>
                  {SCORE.windowDays} days to get things ready. You can still run it bare.
                </span>
              </div>
            )}

          {setupFor && (
            <p className="faint tiny" style={{ margin: '0 0 14px' }}>
              Groundwork for the {OPERATION_BY_ID[setupFor.defId]?.name}. It pays nothing.
            </p>
          )}

          {/*
            The second decision on a job.

            Two playtesters said the same thing independently: the job list
            stops teaching you anything once you have seen a rank tier, because
            every new contract is the same choice with bigger numbers. This is
            the axis that was missing — not more jobs, but more than one way to
            do one. It is placed above the district and the crew because it
            changes what both of those are for: quiet wants your careful people
            and a district you can afford to be seen in, heavy does not care.
          */}
          <div className="tiny" style={{ marginBottom: 6 }}>
            How
          </div>
          <div className="district-picker">
            {APPROACHES.map((a) => (
              <button
                key={a.id}
                className={a.id === approach ? 'district selected' : 'district'}
                onClick={() => setApproach(a.id)}
              >
                <div className="district-name">{a.name}</div>
                <div className="district-meta">{a.blurb}</div>
                <div className="district-meta faint">
                  {a.payout !== 1 && `pays ${Math.round(a.payout * 100)}% · `}
                  {a.heat !== 1 && `heat ${Math.round(a.heat * 100)}%`}
                  {a.payout === 1 && a.heat === 1 && 'as written'}
                  {a.sentiment !== 0 && ' · the street minds'}
                </div>
              </button>
            ))}
          </div>

          {/*
             What the approach you just picked will actually cost in attention.

             The job table has a Heat column, but it is the job's base heat
             scaled for your rank — chosen before the approach exists, and
             therefore not the number you pay if you pick Heavy. A playtester
             said nothing told them the heat cost compounds "until you've
             already paid for it once", and they were reading a column that had
             been true when they read it and was not true by the time they
             launched.
          */}
          <p className="faint tiny" style={{ margin: '8px 0 0' }}>
            Done this way:{' '}
            <span className={approachHeat >= 4 ? 'hot' : undefined}>
              +{approachHeat.toFixed(1)} heat
            </span>{' '}
            if it goes well, +{approachHeatFailed.toFixed(1)} if it does not. You are on{' '}
            {Math.round(state.org.heat)}.
          </p>

          <div className="tiny" style={{ marginTop: 16, marginBottom: 6 }}>
            Where
          </div>
          <div className="district-picker">
            {districts.map(({ territory, def: tDef, unfamiliar }) => {
              const mine = Math.round(playerInfluence(territory));
              return (
                <button
                  key={territory.id}
                  className={
                    territory.id === territoryId ? 'district selected' : 'district'
                  }
                  onClick={() => setTerritoryPicked(territory.id)}
                >
                  <div className="district-name">{tDef.name}</div>
                  <div className="district-meta">
                    {unfamiliar ? (
                      <span className="hot">not known here</span>
                    ) : (
                      <span>{CONTROL_LABEL[controlLevel(territory)].toLowerCase()}</span>
                    )}
                  </div>
                  <div className="district-meta faint">
                    wealth {tDef.wealth} · police {tDef.policePresence}
                    {mine > 0 ? ` · you ${mine}` : ''}
                    {/*
                       The number that decides whether this district will ever
                       have a legitimate side. It was on the territory sheet
                       and nowhere near the screen that moves it, which is how
                       round 13 could read the repaired refusal, understand it,
                       and still name the front gate as its First hour blocker.
                    */}
                    {' · '}
                    <span
                      className={
                        territory.sentiment < SENTIMENT_HOSTILE_BELOW ? 'hot' : undefined
                      }
                    >
                      feeling {Math.round(territory.sentiment)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/*
             F12, and the other half of F10.

             The heat line above says what this costs in attention. Nothing said
             what it costs in the district, so the coupling between working a
             place and never being able to buy anything in it was learned by
             hitting it — a fortnight after the decisions that caused it.

             Body text rather than a tooltip, deliberately. Iteration 5 closed
             F10 by taking that same sentence out of a hover and putting it on
             the page, and the tooltip on the territory sheet's own Public
             feeling row is still the older mistake.
          */}
          {territoryId && (
            <p className="faint tiny" style={{ margin: '8px 0 0' }}>
              {sentimentOutlook(state, territoryId, approach)}
            </p>
          )}

          <div className="grid-2" style={{ marginTop: 16 }}>
            <div>
              <div className="tiny" style={{ marginBottom: 6 }}>
                Pick {needed} · {crewPicked.length} chosen
              </div>
              {free.length > 0 && needed > 0 && (
                <div className="btn-row" style={{ marginBottom: 8 }}>
                  <button
                    className="btn small"
                    title="Your most capable people. They get better at it, and nobody else does."
                    onClick={() => fill('best')}
                  >
                    Send your best
                  </button>
                  <button
                    className="btn small"
                    title="Whoever has been out least. Slower tonight, and it brings the whole crew on."
                    onClick={() => fill('rested')}
                  >
                    Send whoever is rested
                  </button>
                  {crewPicked.length > 0 && (
                    <button className="btn small" onClick={() => setCrewPicked([])}>
                      Clear
                    </button>
                  )}
                </div>
              )}
              {free.length === 0 ? (
                <Empty>Nobody is available.</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th />
                        <th>Name</th>
                        <th>Skill</th>
                        <th>Care</th>
                        {/*
                           How many nights each of them has had lately.

                           It is here rather than only on the crew sheet because
                           this is where the decision is made. A reason to
                           rotate has to be visible at the moment you are
                           picking, not on a page you visit afterwards.
                        */}
                        <th className="num">Nights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {free.map((npc) => (
                        <tr
                          key={npc.id}
                          className={
                            crewPicked.includes(npc.id) ? 'clickable selected' : 'clickable'
                          }
                          onClick={() => toggleCrew(npc.id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={crewPicked.includes(npc.id)}
                              readOnly
                              tabIndex={-1}
                            />
                          </td>
                          <td>
                            <div className="name-cell">
                              <span className="name-main">{npc.name}</span>
                              <span className="name-sub">{ROLE_LABEL[npc.role]}</span>
                            </div>
                          </td>
                          <td>
                            <StatRead npc={npc} stat="skill" />
                          </td>
                          <td>
                            <StatRead npc={npc} stat="discipline" />
                          </td>
                          <td className="num mono">{nightsWorked(state, npc.id)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="tiny" style={{ marginBottom: 6 }}>
                Chance of success
              </div>
              {breakdown ? (
                <>
                  <div className="mono" style={{ fontSize: 34, lineHeight: 1.1 }}>
                    {Math.round(breakdown.total * 100)}%
                  </div>
                  <div style={{ margin: '10px 0 14px' }}>
                    <Bar value={breakdown.total * 100} />
                  </div>
                  <Term label="Base for this job" value={breakdown.base} />
                  <Term label="Crew you picked" value={breakdown.crew} signed />
                  <Term label="Your ability" value={breakdown.attribute} signed />
                  <Term label="Current heat" value={breakdown.heat} signed />
                  {breakdown.watched !== 0 && (
                    <Term label="Being watched" value={breakdown.watched} signed />
                  )}
                  <Term label="The district" value={breakdown.territory} signed />
                  {breakdown.approach !== 0 && (
                    <Term label="How you are doing it" value={breakdown.approach} signed />
                  )}
                  {breakdown.prep !== 0 && (
                    <Term label="A month of planning" value={breakdown.prep} signed />
                  )}
                  {/*
                     The other direction, and the reason it is here rather than
                     in a log somewhere: a cost you only find out about
                     afterwards is an ambush. This is the row that makes
                     charging for repetition a decision the player gets to make.
                  */}
                  {breakdown.pattern !== 0 && (
                    <Term label="They know the routine" value={breakdown.pattern} signed />
                  )}
                  {breakdown.world !== 0 && (
                    <Term label="The city right now" value={breakdown.world} signed />
                  )}
                  {breakdown.difficulty !== 0 && (
                    <Term label="Difficulty" value={breakdown.difficulty} signed />
                  )}
                  <p className="faint tiny" style={{ marginTop: 10, marginBottom: 0 }}>
                    Success here also earns influence in{' '}
                    {territoryDef(territoryId)?.name ?? 'the district'}.
                  </p>
                </>
              ) : (
                <>
                  <div className="mono faint" style={{ fontSize: 34, lineHeight: 1.1 }}>
                    —
                  </div>
                  <p className="faint" style={{ marginTop: 10 }}>
                    Pick {needed - crewPicked.length} more to see the odds. Who you send
                    changes them.
                  </p>
                </>
              )}

              <div className="btn-row" style={{ marginTop: 16 }}>
                <button
                  className="btn primary"
                  disabled={!check?.ok}
                  onClick={launch}
                  title={check?.reason ?? undefined}
                >
                  Launch — {formatMoney(def.investment)}
                </button>
                <button className="btn" onClick={() => setSelected(null)}>
                  Cancel
                </button>
              </div>
              {/*
                 Handing this one over for good.

                 Two buttons rather than one for the same reason the crew fills
                 are two: the policy is the decision, and a single control
                 would have a silent default that quietly became the strategy.
              */}
              {!SETUP_BY_ID[def.id] && needed > 0 && (
                <div className="btn-row" style={{ marginTop: 10 }}>
                  {standingFor(state, def.id) ? (
                    <button
                      className="btn small danger"
                      onClick={() =>
                        mutate((st) => cancelStanding(st, standingFor(st, def.id)!.id), true)
                      }
                    >
                      Stop running this by itself
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn small"
                        title="It runs on its own from now on, sending your best. It will not stop when the odds turn."
                        onClick={() =>
                          mutate((st) => setStanding(st, def.id, territoryId, 'best', approach), true)
                        }
                      >
                        Keep doing this — best
                      </button>
                      <button
                        className="btn small"
                        title="The same, sending whoever has been out least."
                        onClick={() =>
                          mutate(
                            (st) => setStanding(st, def.id, territoryId, 'rested', approach),
                            true,
                          )
                        }
                      >
                        …or whoever is rested
                      </button>
                    </>
                  )}
                </div>
              )}
              {check && !check.ok && (
                <p className="hot tiny" style={{ marginTop: 8, marginBottom: 0 }}>
                  {check.reason}
                </p>
              )}
            </div>
          </div>
        </Panel>
      )}

      {locked.length > 0 && (
        <Panel title="Above your standing" flush>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Needs</th>
                  <th className="num">Crew</th>
                  <th className="num">Up front</th>
                  <th className="num">Pays</th>
                </tr>
              </thead>
              <tbody>
                {locked.map((op) => (
                  <tr key={op.id}>
                    <td className="faint">{op.name}</td>
                    {/*
                       The sentence, not a rank name.

                       This column said "Underboss", which told a player who is
                       already the boss of this outfit nothing they could act
                       on — and after the rank caption came off the screen, it
                       named a thing that appeared nowhere else in the game.
                       Every gate now carries the words for its own row.
                    */}
                    <td className="faint">{op.opens?.need ?? '—'}</td>
                    <td className="num mono faint">{op.crewRequired}</td>
                    {/* Same dash the live table uses. "$0" reads as a bug. */}
                    <td className="num mono faint">
                      {op.investment ? formatMoney(op.investment) : '—'}
                    </td>
                    <td className="num mono faint">
                      {formatMoney(op.payout[0])}–{formatMoney(op.payout[1])}
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

/**
 * The same people, on the same job, in the same district.
 *
 * Sending a crew out is four deliberate clicks — open the row, tick each name,
 * launch — and most weeks of a long game are the identical four clicks as the
 * week before. That is the cost of a good assembly screen, and it should only
 * be paid when the answer is actually in question.
 *
 * Reconstructed from the last thing that finished rather than from a stored
 * preference, so it cannot drift out of sync with a crew that has changed. It
 * appears only when the whole arrangement is still possible: everyone alive,
 * free and yours, the job still open to your rank, the money still there. When
 * any of that has moved the button is simply not there, because a shortcut
 * that silently substitutes a different crew is worse than no shortcut.
 */
function SameAgain({ onLaunched }: { onLaunched: () => void }) {
  const state = useGame();
  const last = state.operationHistory[0];
  if (!last) return null;

  const def = OPERATION_BY_ID[last.defId];
  const free = availableCrew(state);
  const crew = last.crewIds.filter((id) => free.some((n) => n.id === id));
  if (!def || crew.length !== last.crewIds.length || crew.length === 0) return null;

  // Including how it was done — repeating a job means repeating the whole
  // arrangement, and the approach is now part of the arrangement. It has to be
  // read before the check, because the approach decides whether the repeat can
  // go at all while the organization is dark.
  const approach = last.approach ?? DEFAULT_APPROACH;

  const check = canLaunch(state, def, crew, last.territoryId, approach);
  if (!check.ok) return null;

  const names = crew.map((id) => state.npcs[id]?.name).filter(Boolean);
  return (
    <button
      className="btn small"
      title={`${def.name} in ${territoryDef(last.territoryId)?.name}, ${APPROACH_BY_ID[
        approach
      ].name.toLowerCase()}, with ${names.join(' and ')}.`}
      onClick={() => {
        mutate((s) => launchOperation(s, def.id, crew, last.territoryId, approach), true);
        onLaunched();
      }}
    >
      Same again — {def.name}
    </button>
  );
}

function OperationRow({
  op,
  needed,
  scale,
  odds,
  selected,
  onClick,
}: {
  op: OperationDef;
  /** Bodies after whatever a score has taken off the requirement. */
  needed: number;
  scale: number;
  /** With your best free crew, where the picker would send them. Null if you cannot staff it. */
  odds: number | null;
  selected: boolean;
  onClick: () => void;
}) {
  const quiet = scale <= 0.4;
  return (
    <tr className={selected ? 'clickable selected' : 'clickable'} onClick={onClick}>
      <td className="name-main">{op.name}</td>
      <td className={op.risk === 'extreme' || op.risk === 'high' ? 'hot' : 'dim'}>
        {RISK_LABEL[op.risk]}
      </td>
      <td className="num mono">
        {needed < op.crewRequired ? (
          <span className="good" title="Fewer than usual, because of what you have ready">
            {needed}
          </span>
        ) : (
          needed
        )}
      </td>
      <td className="num mono">{op.investment ? formatMoney(op.investment) : '—'}</td>
      <td className="num mono brass">
        {formatMoney(op.payout[0])}–{formatMoney(op.payout[1])}
      </td>
      <td className="num mono">{op.durationDays}</td>
      <td className="num mono">
        <span
          className={quiet ? 'good' : undefined}
          title={
            quiet
              ? 'Beneath your standing — barely registers with anyone watching you'
              : 'Attention this draws at your current standing'
          }
        >
          +{(op.heatOnSuccess * scale).toFixed(1)}
        </span>
      </td>
      <td className="num mono">
        {odds === null ? (
          <span className="faint" title="You do not have the people free for this one">
            —
          </span>
        ) : (
          <span
            className={odds >= 0.75 ? 'good' : odds < 0.5 ? 'hot' : undefined}
            title="With your best free people, in the district that is selected by default. Open the job to change either."
          >
            {Math.round(odds * 100)}%
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * How well-read a pair has got, in words rather than in a number.
 *
 * A display string with no rule in it, so it stays here rather than in sim.
 * Worded from the street's side — what somebody watching would say — because
 * the player is not supposed to be reading a meter, they are supposed to be
 * deciding whether it is time to move.
 */
function groove(pattern: number): string {
  if (pattern < 10) return 'nobody has noticed';
  if (pattern < PATTERN.noticeAbove) return 'starting to look like a routine';
  if (pattern < 50) return 'they know the routine';
  if (pattern < 75) return 'they could set a watch by it';
  return 'they are waiting for them';
}

function Term({
  label,
  value,
  signed,
}: {
  label: string;
  value: number;
  signed?: boolean;
}) {
  const pts = Math.round(value * 100);
  const tone = !signed ? '' : pts > 0 ? 'good' : pts < 0 ? 'hot' : 'faint';
  return (
    <div className="kv">
      <span className="kv-key">{label}</span>
      <span className={`kv-val ${tone}`}>
        {signed && pts >= 0 ? '+' : ''}
        {pts}%
      </span>
    </div>
  );
}
