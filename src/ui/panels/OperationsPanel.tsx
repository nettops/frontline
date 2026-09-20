import { useEffect, useRef, useState } from 'react';
import { canCase, caseJob } from '../../sim/verbs';
import { hasVerb } from '../../sim/build';
import { STAT_BY_ID } from '../../config/build';
import { useGame, mutate } from '../../store';
import { Panel, Empty, Bar, StatRead } from '../components';
import {
  availableOperations,
  manualBoard,
  lockedOperations,
  canLaunch,
  cancelOperation,
  crewCompetence,
  crewNeeded,
  heatScale,
  launchOperation,
  approachOf,
  successBreakdown,
  sentimentOutlook,
} from '../../sim/operations';
import {
  canDelegatePitchAutonomous,
  delegatePitchAutonomous,
  launchPitched,
  livePitches,
  pitchCapoPool,
  reassignPitch,
  rejectPitch,
  specialtyLine,
} from '../../sim/capoPitches';
import { pendingEnvelopes, resolveLightEnvelope } from '../../sim/tribute';
import { TRIBUTE } from '../../config/tribute';
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
import {
  AUTOPILOT_RISK,
  AUTOPILOT_RISK_BLURB,
  AUTOPILOT_RISK_LABEL,
  type AutopilotRisk,
} from '../../config/autopilot';
import { PATTERN } from '../../config/standingOrders';
import { autopilotOn, autopilotRisk, setAutopilot, setAutopilotRisk } from '../../sim/autopilot';
import {
  cancelStanding,
  liveStanding,
  patternOn,
  setStanding,
  standingFor,
} from '../../sim/standingOrders';
import { availableCrew } from '../../sim/npc';
import { squadFor } from '../../sim/crew';
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
import { ATTRIBUTE_LABEL, RANK_BY_ID, ROLE_LABEL, rankIndex } from '../../config/economy';
import { rankNow } from '../../sim/rank';
import type { CapoPitch, OperationDef } from '../../sim/types';

const RISKS = Object.keys(AUTOPILOT_RISK) as AutopilotRisk[];

export default function OperationsPanel() {
  const state = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [crewPicked, setCrewPicked] = useState<string[]>([]);
  const [territoryPicked, setTerritoryPicked] = useState<string | null>(null);
  /*
     Which pitch the assemble screen was opened for, if it was opened from one.

     Round 30's MUST FIX 1: Approve used to spend the pitch on the click, so
     backing out any way but Launch lost it. Approving now only remembers it
     here, and `launchPitched` spends it when the job goes out. Transient UI
     state, deliberately not in the save.
  */
  const [assemblingPitchId, setAssemblingPitchId] = useState<string | null>(null);
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
  /*
     Round 25's blind report, reproduced twice: opening the panel while
     laying low started on the loud default, which quiet work is the only
     legal answer to — so Launch sat disabled until the player noticed and
     clicked Quiet by hand. The persistence above is still right; this only
     changes what the first click of a fresh mount lands on.
  */
  const [approach, setApproach] = useState<ApproachId>(() =>
    isLayingLow(state) ? 'quiet' : DEFAULT_APPROACH,
  );
  /*
     The same defect `CrewPanel` and `RivalsPanel` were both fixed for
     (round 24): the assemble panel opens below the job table rather than
     in a modal, and on a board long enough to fill the viewport — this one
     runs to nine open jobs, an eight-district picker, a full crew table,
     and a fourteen-row locked table, before the assemble panel itself —
     that open lands off-screen with no cue it happened. The click worked;
     nothing said so. Same fix, same reason.
  */
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected]);
  /*
     Where "you live off what they bring you" points to.

     A ref rather than an anchor or a `querySelector('.panel')`: the pitches
     panel is one of a dozen on this page and it only exists on the days a
     capo has brought something. A link that scrolls to whichever panel
     happens to be first would be a control that takes a click and lands
     somewhere arbitrary — rule 4, in its quietest form.
  */
  const pitchesRef = useRef<HTMLDivElement>(null);

  /*
     Tier 0 only. Tier 1 and above used to be a permanent row per open job def
     — every one of them, every time, no matter how large the organization had
     grown. That is what `pitches` below replaces: a short live list a capo
     actually brought, rather than a menu the boss keeps browsing himself.
  */
  const open = manualBoard(state).filter((op) => op.tier === 0);
  const pitches = livePitches(state);
  const envelopes = pendingEnvelopes(state);
  const locked = lockedOperations(state);
  const unlockedTierOps = availableOperations(state).filter((op) => op.tier > 0);
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
    // A job picked by hand is not the pitch that was open a moment ago.
    setAssemblingPitchId(null);
    // A setup runs where the score is being built. Anywhere else is not the
    // same job, and making the player re-pick it every time would be four
    // clicks to say something the score already said.
    setTerritoryPicked(at ?? null);
  };

  /*
     Approving a pitch opens the same assemble screen a hand-picked job always
     used, and nothing else. The pitch stays on the board until the job goes
     out (`launchPitched`), so Cancel, another tab, or approving a second pitch
     leaves the offer where it was rather than throwing it away. It opens the
     job outright rather than through `choose`, which toggles: approving a job
     that happened to be open already used to close it.
  */
  const approve = (pitchId: string, defId: string, territoryId: string) => {
    setSelected(defId);
    setCrewPicked([]);
    setTerritoryPicked(territoryId);
    setAssemblingPitchId(pitchId);
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

  /*
     A third way to fill a crew, additive to the two above: where a capo
     already has people under him, dispatch him and let his own reports go
     rather than hand-checking each one. Only offered when that group can
     cover the job by itself — see `squadFor` — so a roster with no hierarchy
     yet, or one too small for this job, sees exactly the two buttons above and
     nothing has changed for it.
  */
  const squad = def ? squadFor(free, needed) : null;

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
      (s) =>
        launchPitched(s, assemblingPitchId, def.id, crewPicked, territoryId, approach, forScore),
      true,
    );
    setSelected(null);
    setCrewPicked([]);
    setTerritoryPicked(null);
    setAssemblingPitchId(null);
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Operations</h1>
        <span className="tiny">
          {free.length} available · {formatMoney(totalFunds(state))} on hand
        </span>
      </div>
      {/* Same door, same silence. See `DiplomacyPanel`. */}
      <p className="page-sub">
        <strong>Open a job to put a crew on it.</strong>{' '}
        Every job takes people off the street for its duration and adds to what the
        world knows about you. The odds you are shown are the odds you get.
      </p>

      {/*
         The page is four pages long and the player wanted the third one.

         Round 29 measured fifteen hundred pixels of running jobs, automation
         and work above the player's standing between the top of this screen
         and the street job they had come to start. Nothing on it was wrong —
         it was simply all there at once, in the order the systems were built.

         A jump bar rather than collapsing the sections: what is on this page
         is what the boss is being asked about, and folding half of it away is
         how a standing order runs for three weeks unnoticed. The counts are
         live, and a pill is only drawn when its section exists — a control
         that scrolls to nothing is rule 4's quietest violation.
      */}
      <JumpBar
        stops={[
          { id: 'ops-active', label: 'Active', count: active.length },
          { id: 'ops-pitches', label: 'Pitches', count: pitches.length },
          { id: 'ops-street', label: 'Street Work', count: open.length },
          { id: 'ops-standing', label: 'Standing', count: def ? 0 : locked.length },
        ]}
      />

      {/*
         The one decision somebody else has already made for you.

         Top of the page, above the running jobs, because it is the only thing
         on this screen that is already waiting rather than available — a
         capo handed the envelope over on payday and it was light, and until
         the boss answers, the table is watching him not answer.

         The excuse is printed rather than summarised. It is the only
         information the player has, it is a lie about a third of the time,
         and the whole of the decision is that the screen cannot tell which.
      */}
      {envelopes.length > 0 && (
        <Panel title="The envelopes came up light">
          {envelopes.map((d) => {
            const auditable = totalFunds(state) >= TRIBUTE.auditCost;
            return (
              <div key={d.id} className="kv" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                <span className="kv-key">
                  <span className="name-main">{d.capoName}</span>{' '}
                  <span className="faint tiny">
                    {formatMoney(d.expected)} expected · {formatMoney(d.offered)} handed over ·{' '}
                    <span className="hot">{formatMoney(d.shortage)} short</span>
                  </span>
                  <br />
                  <span className="dim tiny">“{d.excuse}”</span>
                </span>
                <div className="btn-row">
                  <button
                    className="btn small"
                    title="It costs you standing at the table and it buys you the man."
                    onClick={() => mutate((s) => resolveLightEnvelope(s, d.capoId, 'let_it_slide'), true)}
                  >
                    Let it go
                  </button>
                  <button
                    className="btn small danger"
                    title="He finds the rest of it. He does not enjoy finding it."
                    onClick={() => mutate((s) => resolveLightEnvelope(s, d.capoId, 'squeeze'), true)}
                  >
                    Have him find the rest
                  </button>
                  <button
                    className="btn small"
                    disabled={!auditable}
                    title="Somebody goes through his books. If he was honest, he will know he was counted."
                    onClick={() => mutate((s) => resolveLightEnvelope(s, d.capoId, 'audit'), true)}
                  >
                    Have him looked at ({formatMoney(TRIBUTE.auditCost)})
                  </button>
                  {!auditable && (
                    <span className="tiny faint">
                      Having a man looked at runs {formatMoney(TRIBUTE.auditCost)}, and you do not
                      have it.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <p className="faint tiny" style={{ margin: '8px 0 0' }}>
            Money comes up. A capo who is short has either had a bad month or has been taking
            it, and nothing on this page knows which. Letting it go costs you at the table,
            squeezing costs you the man, and counting him costs you both if he was straight.
          </p>
        </Panel>
      )}

      {active.length > 0 && (
        <Panel title="Running now" flush id="ops-active">
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
         measured as rather than what it promises. Since 2026-08-29 that
         measurement includes the heat sense — the owner's call is that the
         autopilot is a way to play, not a handicapped convenience, so it runs
         the two levers the probe proved level with a careful hand.
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
        {/*
           How hard it is allowed to push. Round 16's own crisis — the loop
           spent into a payday it did not know was coming — is the reason a
           third setting exists at all. `normal` is what shipped before this
           and stays selected by default, so an existing save changes nothing
           until the player asks it to.
        */}
        <div className="btn-row" style={{ marginTop: 8 }}>
          {RISKS.map((r) => (
            <button
              key={r}
              className={autopilotRisk(state) === r ? 'btn small primary' : 'btn small'}
              title={AUTOPILOT_RISK_BLURB[r]}
              onClick={() => mutate((st) => setAutopilotRisk(st, r), true)}
            >
              {AUTOPILOT_RISK_LABEL[r]}
            </button>
          ))}
        </div>
        <p className="faint tiny" style={{ margin: '8px 0 0' }}>
          It changes who goes, never what runs — the jobs are the ones you would have
          taken anyway. {AUTOPILOT_RISK_BLURB[autopilotRisk(state)]}
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
                  {/*
                     The approach it is running, which used to be the one thing
                     about a standing order the player could not find out.

                     It is recorded at set-time from the picker below and then
                     kept for the life of the order — so changing the picker
                     afterwards moves the next hand-run job and leaves this one
                     where it was. A round-16 tester set an order while working
                     quiet, later switched to Heavy for a score, and spent the
                     rest of the career believing every automated night was
                     going out loud. Nothing on screen could have told them
                     otherwise. `approachOf` rather than `o.approach`, because
                     orders written before the field existed have none.
                  */}
                  <span className="faint tiny">
                    in {territoryDef(o.territoryId)?.name} · {APPROACH_BY_ID[approachOf(o)].name.toLowerCase()} ·{' '}
                    {o.how === 'best' ? 'best people' : 'whoever is rested'} ·
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

      {pitches.length > 0 && (
        <div ref={pitchesRef}>
        <Panel title="Brought to you" id="ops-pitches">
          {pitches.map((p) => (
            <PitchCard
              key={p.id}
              pitch={p}
              selected={p.defId === selected && p.territoryId === territoryId}
              onApprove={() => approve(p.id, p.defId, p.territoryId)}
              onDelegate={() => mutate((s) => delegatePitchAutonomous(s, p.id), true)}
              onReject={() => mutate((s) => rejectPitch(s, p.id), true)}
              onReassign={(capoId) => mutate((s) => reassignPitch(s, p.id, capoId), true)}
            />
          ))}
          <p className="faint tiny" style={{ margin: '8px 0 0' }}>
            What a capo brings you this week. Turn one down and it costs nothing; hand it to
            somebody else and the man it was taken from remembers it. Let the man who brought
            it run it himself and {Math.round(TRIBUTE.bossAutonomousCut * 100)}% of the take
            comes up to you — the rest is his, and so is everything a federal file could put
            at the scene.
          </p>
        </Panel>
        </div>
      )}

      {/*
         What being broke actually excuses, said where the decision is made.

         `launchOperation` has always waived the hands-on respect penalty below
         `handsOnPovertyExemptionFunds` — a boss with nothing in the wallet is
         not humiliating himself by working, he is eating. The waiver was real
         and invisible: round 29 was insolvent at Capo, read the board as
         closed to him, and never found out that the one thing that would have
         paid was sitting there uncharged.
      */}
      {rankIndex(rankNow(state).id) >= rankIndex('capo') &&
        totalFunds(state) < TRIBUTE.handsOnPovertyExemptionFunds && (
          <aside className="coach urgent">
            <span className="coach-label">Broke</span>
            <span className="coach-text">
              Under {formatMoney(TRIBUTE.handsOnPovertyExemptionFunds)} on hand, you can work a
              corner yourself without the loss of standing it usually costs a family with{' '}
              {RANK_BY_ID.capo.name.toLowerCase()}.
              Nobody thinks less of a man for working until the payroll is covered.
            </span>
          </aside>
        )}

      <Panel
        title="Work available"
        action={<SameAgain onLaunched={() => setSelected(null)} />}
        flush
        id="ops-street"
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
                <th className="num" title="If it works / if it does not">
                  Heat
                </th>
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
        {/*
           A promotion, not a broken screen.

           `outgrewStreetWork` takes tier 0 off the board once there is
           somebody else to send, and what the player was left looking at was
           eight column headers over nothing. Round 29 read that as the game
           having stopped working and spent the first hour hunting for the
           table's missing rows. Headers over an empty tbody say nothing; this
           says which screen the work moved to.
        */}
        {open.length === 0 && (
          <div style={{ padding: '16px 18px', textAlign: 'center' }}>
            <p className="dim" style={{ margin: 0 }}>
              Somebody else's hands do that kind of thing now — at your standing you live off
              what your people bring you.
            </p>
            {pitches.length > 0 && (
              <button
                className="btn small"
                style={{ marginTop: 10 }}
                onClick={() =>
                  pitchesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {pitches.length} waiting on an answer
              </button>
            )}
          </div>
        )}
      </Panel>

      {def && (
        <div ref={detailRef}>
        <Panel title={`Assemble — ${def.name}`}>
          <p className="dim" style={{ marginTop: 0 }}>
            {def.description}
          </p>

          {/*
               Casing it, which is the Method verb.

               Offered on the assemble screen because that is where a boss is
               already deciding about this job in this district, and the verb is
               about this pair and no other.

               Label and blurb are read from `config/build.ts` rather than
               written here, and that is the fix rather than a tidy-up. The
               Yourself panel sells this point as "Case a job"; this button
               used to be called "Spend the week on it", and a round-16 tester
               bought the point, searched five screens for the word "case",
               and found the button on day 94 — 69 days of owning an ability
               they could not locate. One ability, one name, in one place.
            */}
          {hasVerb(state, 'method') && (
            <p className="tiny" style={{ margin: '0 0 8px' }}>
              <button
                className="btn small"
                disabled={!canCase(state, territoryId).ok}
                title={canCase(state, territoryId).message}
                onClick={() => mutate((g) => caseJob(g, def.id, territoryId), false)}
              >
                {STAT_BY_ID.method.verb}
              </button>{' '}
              <span className="faint">{STAT_BY_ID.method.verbBlurb}</span>
              {/* Where a casing already under way is named, on the screen and
                  not only in the disabled button's tooltip. */}
              {state.org.cased && !canCase(state, territoryId).ok && (
                <>
                  <br />
                  <span className="brass">{canCase(state, territoryId).message}</span>
                </>
              )}
            </p>
          )}

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
                  {squad && (
                    <button
                      className="btn small"
                      title={`${squad.capo.name} and his own people. Nobody else to pick.`}
                      onClick={() => setCrewPicked(squad.members.map((n) => n.id))}
                    >
                      Dispatch {squad.capo.name}'s crew
                    </button>
                  )}
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
                      {/*
                         A row that looked exactly as clickable once the
                         crew was full as it did with a seat open — same
                         cursor, same class, no title — and clicking it did
                         nothing. `toggleCrew` was always a correct no-op
                         here; nothing on the row ever said so.
                      */}
                      {free.map((npc) => {
                        const picked = crewPicked.includes(npc.id);
                        const full = !picked && needed > 0 && crewPicked.length >= needed;
                        return (
                        <tr
                          key={npc.id}
                          className={picked ? 'clickable selected' : full ? 'dim' : 'clickable'}
                          title={full ? `${needed} is the most this job takes. Drop somebody first.` : undefined}
                          onClick={full ? undefined : () => toggleCrew(npc.id)}
                        >
                          <td>
                            <input type="checkbox" checked={picked} readOnly tabIndex={-1} />
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
                        );
                      })}
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
                  {/*
                       Which ability, and it is not one you place points into.

                       This row read "Your ability" and three round-17 scorers
                       took it for the build screen's output. One measured it
                       properly — same job, same crew, same day, nine points
                       placed, no movement — and filed it as points doing
                       nothing. They were right about the row and wrong about
                       the cause: `successBreakdown` reads
                       `player.attributes[def.attribute]`, and the build writes
                       `player.build`. Different fields.

                       That is not two rival systems. The attributes panel used
                       to be on Yourself and was replaced by the build, for the
                       reason recorded there — two of its eight were read by
                       nothing. What nobody noticed is that this row still
                       points at the half that lost its screen, so the player
                       met a number they could neither find nor move.

                       Naming the attribute is the whole repair. "Your
                       negotiation" is a thing a boss can believe grows by
                       negotiating; "your ability" is a thing he reasonably
                       assumes he just bought.
                    */}
                  <Term
                    label={`Your ${ATTRIBUTE_LABEL[def.attribute].toLowerCase()}`}
                    value={breakdown.attribute}
                    signed
                  />
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
                  {/*
                       The week somebody spent watching the place.

                       Rendered like prep, because it is the same kind of fact:
                       something the player did on purpose that is worth points
                       tonight. A bonus the player cannot see is a bonus that
                       may as well not exist.
                    */}
                  {breakdown.cased !== 0 && (
                    <Term label="You had it watched" value={breakdown.cased} signed />
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
                <button
                  className="btn"
                  onClick={() => {
                    setSelected(null);
                    setAssemblingPitchId(null);
                  }}
                >
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
        </div>
      )}

      {/*
         Hidden while a job is being assembled — it decides nothing about
         the job in front of you, and it is the single longest table on
         this screen. Fourteen rows of work you cannot do yet, sitting
         between the assemble panel and nothing, was the biggest single
         contributor to how far this page runs once a job is open.
      */}
      {locked.length > 0 && !def && (
        <Panel title="Above your standing" flush id="ops-standing">
          <div style={{ padding: '10px 14px 4px' }}>
            <p className="faint tiny" style={{ margin: 0 }}>
              Work your organization cannot take on yet. When requirements are met, operations qualify into your crew's weekly proposal rotation — capos and earners will pitch them to you directly in <strong>Brought to you</strong> above.
            </p>
            {unlockedTierOps.length > 0 && (
              <p className="dim tiny" style={{ margin: '6px 0 0' }}>
                <strong>Qualified for proposals:</strong> {unlockedTierOps.map((op) => op.name).join(', ')}.
              </p>
            )}
          </div>
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

/**
 * One thing a capo has brought you, and the three answers you can give him.
 *
 * Reads its own state rather than taking every field as a prop, the same
 * shape `SameAgain` uses — a card knows what it needs to say about itself.
 */
/**
 * Where on this page the thing you came for is.
 *
 * Anchors rather than the ref the pitches panel already uses, because four of
 * them through four refs is four more things to thread; `Panel` takes an `id`
 * now and the browser does the rest. One stop is not a jump bar — below two
 * live sections the page is short enough to read.
 */
function JumpBar({ stops }: { stops: { id: string; label: string; count: number }[] }) {
  const live = stops.filter((s) => s.count > 0);
  if (live.length < 2) return null;
  return (
    <nav className="ops-jump" aria-label="Jump to a section of this page">
      {live.map((s) => (
        <button
          key={s.id}
          className="ops-jump-pill"
          onClick={() =>
            document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          {s.label} <span className="ops-jump-count">{s.count}</span>
        </button>
      ))}
    </nav>
  );
}

function PitchCard({
  pitch,
  selected,
  onApprove,
  onDelegate,
  onReject,
  onReassign,
}: {
  pitch: CapoPitch;
  selected: boolean;
  onApprove: () => void;
  onDelegate: () => void;
  onReject: () => void;
  onReassign: (capoId: string) => void;
}) {
  const state = useGame();
  const def = OPERATION_BY_ID[pitch.defId];
  const capo = state.npcs[pitch.capoId];
  if (!def || !capo) return null;

  // Whoever else could take it instead — the same pool a pitch is drawn from,
  // capped so this row stays a row and not a second crew sheet.
  const alternatives = pitchCapoPool(state)
    .filter((n) => n.id !== pitch.capoId)
    .slice(0, 2);
  const specialty = specialtyLine(capo);
  /*
     Round 29's MUST FIX #1: this button clicked, `delegatePitchAutonomous`
     returned null, and nothing on the screen changed or said why. The reason
     existed the whole time — it is `canLaunch`'s, or the headcount — it was
     just computed inside the mutation. Same repair `refusalShown.test.ts`
     has made four times now: the sentence goes on the row that was refused,
     not in a `title` a player has to hover to find.
  */
  const canDel = canDelegatePitchAutonomous(state, pitch.id);
  /*
     A casing is a paid week on one job in one district, and until round 30 its
     only trace was a tooltip on a disabled button on another screen. It goes
     on the offer it was for, so a pitch being prepared does not read as one
     that has gone missing.
  */
  const cased = state.org.cased;
  const casing =
    cased && cased.defId === pitch.defId && cased.territoryId === pitch.territoryId ? cased : null;
  const casingDays = casing ? casing.readyDay - state.day : 0;

  return (
    <div className="kv" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
      <span className="kv-key">
        <span className="name-main">{def.name}</span>{' '}
        <span className="faint tiny">
          {capo.name} · in {territoryDef(pitch.territoryId)?.name} ·{' '}
          {formatMoney(def.payout[0])}–{formatMoney(def.payout[1])}
        </span>
        {specialty && (
          <>
            <br />
            <span className="faint tiny">{specialty}</span>
          </>
        )}
        {casing && (
          <>
            <br />
            <span className="brass tiny">
              {casingDays > 0
                ? `Casing in progress (${casingDays}d left)`
                : 'Cased. It shows in the odds.'}
            </span>
          </>
        )}
      </span>
      {/* `.kv` is a two-column flex row, so the refusal goes inside this
          column under the buttons rather than as a third child of the row. */}
      <div>
      <div className="btn-row">
        <button
          className={selected ? 'btn small primary' : 'btn small'}
          title={def.description}
          onClick={onApprove}
        >
          Approve
        </button>
        {/*
           The other half of the same pitch, and the one the whole tribute
           layer is for.

           Approve opens the assemble screen and the boss picks the crew — his
           hands on the job, his name on whatever the job leaves behind.
           Delegating hands the whole thing to the capo, who takes his own
           people and keeps the majority of it. What the boss buys with the
           difference is not being in the room.
        */}
        <button
          className="btn small"
          disabled={!canDel.ok}
          title={
            canDel.ok
              ? `${capo.name} runs it with his own crew and keeps his end. You never touch it, and what it leaves behind does not point at you.`
              : (canDel.reason ?? undefined)
          }
          onClick={onDelegate}
        >
          Let {capo.name} run it ({Math.round(TRIBUTE.bossAutonomousCut * 100)}% to you)
        </button>
        <button className="btn small" onClick={onReject}>
          Reject
        </button>
        {alternatives.map((alt) => (
          <button
            key={alt.id}
            className="btn small danger"
            title={`${capo.name} watches ${alt.name} get this instead. Not free for him.`}
            onClick={() => onReassign(alt.id)}
          >
            Give it to {alt.name}
          </button>
        ))}
      </div>
      {!canDel.ok && (
        <div className="tiny faint" style={{ marginTop: 2, textAlign: 'right' }}>
          {canDel.reason}
        </div>
      )}
      </div>
    </div>
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
        {/*
             Both figures, because the second is the one that surprises people.

             This column showed only what a success costs, and it is the screen
             a player scans to compare jobs against each other. Round 20's
             tester read it across the board, was hit three times by Call In
             Tribute's failure heat, and reported it as an outlier carrying
             "+26 to +34 versus +2 to +12 for every other job" — which is not
             true and was never the fault. Every job on the board fails at
             roughly twice what it succeeds at, and tribute at 20/36 sits
             between `financial_scheme` at 18/34 and `port_operation` at 22/40.
             What he had actually compared was a tier-4 job against tier-0 and
             tier-1 jobs, because the column gave him one number and the tier
             is not in it.

             The launch panel has said both all along — "+X heat if it goes
             well, +Y if it does not" — but that is after you have chosen the
             job. This is where the choosing happens.
        */}
        <span
          className={quiet ? 'good' : undefined}
          title={
            quiet
              ? 'Beneath your standing — barely registers with anyone watching you'
              : 'What it draws if it works, and if it does not, at your current standing'
          }
        >
          +{(op.heatOnSuccess * scale).toFixed(1)}
          <span className="faint"> / {(op.heatOnFailure * scale).toFixed(1)}</span>
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
