import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, Empty, KeyValue, Bar, Gauge } from '../components';
import type { PanelId } from '../Rail';
import { crewList, availableCrew } from '../../sim/npc';
import { attention } from '../../sim/attention';
import { approaches } from '../../sim/approaches';
import { openSitdown } from '../../sim/sitdown';
import { payrollForecast, weeklyWageBill } from '../../sim/economy';
import { isLayingLow, startLayLow } from '../../sim/heat';
import { arrestRisk, weeklyLegalCost } from '../../sim/investigation';
import { maxCrew } from '../../sim/player';
import { formatMoney, formatShortDay } from '../../sim/util';
import { activeCondition, conditionDaysLeft } from '../../sim/world';
import { activeWars, factionStrength } from '../../sim/diplomacy';
import { rivals } from '../../sim/faction';
import { districtOwner, territoryList } from '../../sim/territory';
import { OPERATION_BY_ID } from '../../config/operations';
import { PAYDAY_INTERVAL } from '../../config/economy';
import {
  heatSeverity,
  heatTier,
  LAY_LOW_DURATION_DAYS,
  LAY_LOW_RESPECT_COST,
} from '../../config/heat';
import { houseShort } from '../../sim/houses';

/**
 * The overview when there is no organization to overview.
 *
 * Heat, standing and work in progress are all readings of a player, and in
 * Simulation all three are zero — which would read as an organization in
 * freefall rather than an absence. This reports on the four things actually
 * moving: who is strong, who is rich, who holds what, and who is fighting.
 */
function CityOverview() {
  const state = useGame();
  const families = rivals(state);
  const wars = activeWars(state);

  return (
    <Panel title="State of the city" flush>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Family</th>
              <th className="num">Strength</th>
              <th className="num">Money</th>
              <th className="num">Holds</th>
              <th>At war with</th>
            </tr>
          </thead>
          <tbody>
            {families.map((faction) => {
              const held = territoryList(state).filter(
                (t) => districtOwner(t) === faction.id,
              ).length;
              const enemies = wars
                .filter(([a, b]) => a === faction.id || b === faction.id)
                .map(([a, b]) => houseShort(state, a === faction.id ? b : a));
              return (
                <tr key={faction.id}>
                  <td className="name-main">{houseShort(state, faction.id)}</td>
                  <td className="num" style={{ minWidth: 110 }}>
                    <Bar value={factionStrength(state, faction.id)} />
                  </td>
                  <td className="num mono">{formatMoney(faction.wealth)}</td>
                  <td className="num mono">{held}</td>
                  <td className={enemies.length ? 'hot' : 'faint'}>
                    {enemies.length ? enemies.join(', ') : 'nobody'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/**
 * Two weeks of nothing, priced before you buy it.
 *
 * This used to be a single click behind a vague tooltip, and it is the most
 * expensive button on the screen: a fortnight of wages with no income, four
 * respect, and no operations. It is also easy to press when it will do nothing
 * at all — street heat is the only thing it cools, so pressing it at zero buys
 * two idle weeks for no reason. So it costs two clicks now, and the second one
 * states the bill in the numbers the player already thinks in.
 */
function LayLow() {
  const state = useGame();
  const [armed, setArmed] = useState(false);
  /*
     Everything two idle paydays actually take out of the drawer.

     This used to quote the wage bill alone, and a playtester came out of a
     fortnight poorer than the number they had agreed to. They were right about
     the shortfall and wrong about why — they assumed it had priced one week
     instead of two. It priced both weeks correctly and left out the other two
     things `tickEconomy` charges on a payday: the retainer, which is taken
     before the crew and is exactly what you are still paying for while nothing
     earns, and any arrears already carried, which come off the top of the next
     one. A preview that disagrees with the charge is worse than no preview.
  */
  const paydays = LAY_LOW_DURATION_DAYS / PAYDAY_INTERVAL;
  const perPayday = weeklyWageBill(state) + weeklyLegalCost(state);
  const cost = Math.round(perPayday * paydays + (state.org.wagesOwed ?? 0));
  const pointless = state.org.heatBy.street < 1;
  const tier = heatTier(state.org.heat);

  if (!armed) {
    return (
      <button
        className="btn small"
        onClick={() => setArmed(true)}
        /*
           "Falls fast" was true and unqualified, and unqualified was the bug.

           `decayMultiplier` runs from 1.0 when things are Quiet down to 0.32
           Under Siege — that is deliberate, and the config says so: you are not
           meant to be able to idle your way out of an eighty. What was not
           deliberate was promising the opposite to a player at ninety-eight.

           A round-7 tester measured 2.8 a day laying low from forty-two, and
           0.43 a day laying low from a hundred, and filed the mechanic as
           broken. The mechanic is fine. The sentence was wrong, so the tooltip
           now says what tier they are in and what that does to the rate.
        */
        title={`${LAY_LOW_DURATION_DAYS} days dark. Only quiet work moves; anything louder is refused, and the street reads it as weakness. ${
          tier.decayMultiplier >= 0.7
            ? 'Street heat falls fast from here.'
            : `At ${tier.name} street heat only bleeds off at ${Math.round(
                tier.decayMultiplier * 100,
              )}% of the usual rate — going quiet helps, but it will not clear this on its own.`
        }${pointless ? ' There is no street heat to lose right now.' : ''}`}
      >
        Lay low
      </button>
    );
  }

  return (
    <span className="row" style={{ gap: 8, alignItems: 'baseline' }}>
      {/*
        The rate is on the confirmation, not only in the hover.

        It was reachable by hovering the button you were about to press, which
        round 11 called out: a strategy-defining fact — that at Major
        Investigation heat bleeds at a fraction of the usual rate and going
        quiet will not clear it — sitting in a native `title`. That tester paid
        for two lay-lows at high heat, roughly $10,500 and 28 idle days, to move
        a number that was barely going to move.

        This is the last screen before the money goes, so it is the last place
        it can still be useful.
      */}
      <span className="tiny faint">
        {LAY_LOW_DURATION_DAYS} days idle · about {formatMoney(cost)} in wages and counsel ·{' '}
        {LAY_LOW_RESPECT_COST} respect
        {pointless ? ' · nothing to cool' : ''}
        {!pointless && tier.decayMultiplier < 0.7 && (
          <span className="hot">
            {' '}
            · at {tier.name} street heat only falls at{' '}
            {Math.round(tier.decayMultiplier * 100)}% of the usual rate, so this will not
            clear it
          </span>
        )}
      </span>
      <button className="btn small" onClick={() => setArmed(false)}>
        No
      </button>
      <button
        className="btn small primary"
        onClick={() => {
          mutate((s) => startLayLow(s), true);
          setArmed(false);
        }}
      >
        Go quiet
      </button>
    </span>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (id: PanelId) => void }) {
  const state = useGame();
  const { org } = state;
  const tier = heatTier(org.heat);
  const crew = crewList(state);
  const free = availableCrew(state);
  const ops = Object.values(state.activeOperations);
  const wanting = attention(state);
  const waiting = approaches(state);
  const laying = isLayingLow(state);
  const payroll = payrollForecast(state);
  const risk = arrestRisk(state);
  const condition = activeCondition(state);

  const stampTone = org.heat <= 25 ? 'stamp cool' : org.heat <= 60 ? 'stamp warm' : 'stamp';

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Overview</h1>
      </div>

      {condition && (
        <div className={`world-strip ${condition.tone}`}>
          <span className="world-name">{condition.name}</span>
          <span className="world-summary">{condition.summary}</span>
          <span className="tiny faint">
            {conditionDaysLeft(state)} {conditionDaysLeft(state) === 1 ? 'day' : 'days'} left
          </span>
        </div>
      )}

      {state.mode === 'simulation' && <CityOverview />}

      {state.mode !== 'simulation' && (
      <div className="grid-2">
        {/*
        What is waiting, and the one click that answers it.

        The recurring loop touches three screens and nothing said which of them
        had something on it. Every line names what would satisfy it, which is
        the Rail's own rule about its badges — a demand for attention with no
        statement of what it wants is what left a playtester carrying the
        succession "!" for a hundred days.

        The list is derived on read and is often empty. That is the point: one
        that is always full is wallpaper.
      */}
      {wanting.length > 0 && (
        <Panel title="Wanting you">
          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            {wanting.map((w) => (
              <button
                key={w.id}
                className="btn small"
                onClick={() => onNavigate(w.panel as PanelId)}
              >
                {w.text}
              </button>
            ))}
          </div>
        </Panel>
      )}
      {/*
        People, as against chores.

        Kept apart from "Wanting you" on purpose. That panel is the recurring
        loop asking to be run — jobs to send men on, groundwork to start — and
        this one is somebody standing in the doorway. Folding them together
        would put "3 standing about, and 2 jobs you could send them on" beside
        a man who is owed a promotion, at the same weight, and the second would
        read as another errand.

        Each row opens the room it is about. That is the whole feature: the
        sit-down has existed for a long time and could only ever be reached by
        the player deciding to go and find somebody.
      */}
      {waiting.length > 0 && (
        <Panel title={waiting.length === 1 ? 'Somebody is waiting' : 'People are waiting'}>
          <div className="stack">
            {waiting.map((w) => (
              <button
                key={w.npcId}
                className="btn small wide"
                onClick={() => {
                  mutate((s2) => { openSitdown(s2, 'crew', w.npcId, w.reasonId); });
                  onNavigate('crew');
                }}
              >
                <span className={w.urgency === 'now' ? 'warn' : undefined}>{w.name}</span>{' '}
                <span className="faint">{w.text}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
      <Panel
          title="Attention"
          action={!laying && <LayLow />}
        >
          <div className="row between wrap" style={{ marginBottom: 12 }}>
            <span className={stampTone}>{tier.name}</span>
            <span className="mono" style={{ fontSize: 22 }}>
              {Math.round(org.heat)}
              <span className="faint" style={{ fontSize: 12 }}>
                /100
              </span>
            </span>
          </div>
          {/*
            A banded gauge rather than a bar, because the bands are the thing
            the player is actually reading. The old bar was one colour that
            flipped at forty, which said "bad now" and nothing about what was
            coming; the segments carry their tier's colour unlit, so the red
            stretch is visible from Quiet. Edges come from HEAT_TIERS, so this
            cannot drift away from the name printed beside it.
          */}
          <Gauge value={org.heat} severityAt={heatSeverity} />
          <p className="dim" style={{ marginTop: 10, marginBottom: 0 }}>
            {tier.description}
          </p>
          {/*
            Heat is attention; a case is evidence. They move for different
            reasons and a loud operator who never fumbles can sit at ninety
            without anybody opening a file — true, defensible, and completely
            invisible from a number with /100 after it. One sentence, under
            the number it qualifies.
          */}
          <p
            className={
              risk.level === 'closing'
                ? 'hot'
                : risk.level === 'building'
                  ? 'hot tiny'
                  : 'faint tiny'
            }
            style={{ marginTop: 8, marginBottom: 0 }}
          >
            {risk.line}
          </p>
          {/*
            The ceiling, which is the number the heat meter is silently not
            telling you. Sitting at ninety means something completely different
            to a street criminal the city police cannot indict than it does to
            a capo the Bureau can put on trial, and the meter looks identical
            in both cases.
          */}
          {risk.ceiling && (
            <p className="faint tiny" style={{ marginTop: 4, marginBottom: 0 }}>
              {risk.ceiling}.
            </p>
          )}
          {/*
             What it costs if it lands, next to how likely it is.

             A playtester lost their whole crew to arrests and spent months
             unable to act, and said afterwards that nothing had told them an
             arrest takes somebody away for that long. The countdown only
             appears once it is too late to matter.
          */}
          <p className="faint tiny" style={{ marginTop: 2, marginBottom: 0 }}>
            {risk.cost}
          </p>
          {laying && (
            <p className="brass" style={{ marginBottom: 0 }}>
              Laying low until day {org.layLowUntilDay}. Quiet work still moves;
              anything louder is refused.
            </p>
          )}
          {!laying && org.quietDays > 0 && org.heat > 0 && (
            <p className="faint tiny" style={{ marginTop: 8, marginBottom: 0 }}>
              {org.quietDays} quiet {org.quietDays === 1 ? 'day' : 'days'}
            </p>
          )}
        </Panel>

        <Panel
          title="Standing"
          action={
            <button className="btn small" onClick={() => onNavigate('player')}>
              Details
            </button>
          }
        >
          {/*
             Rank is not named here any more, and the crew cap no longer comes
             from it either.

             This read `RANK_BY_ID[state.player.rank].maxCrew` for a while after
             the ladder came out, and `player.rank` is pinned at the first rung
             for every career that will ever be played — so the main screen of
             the game told a boss holding three districts and twelve people that
             they were "12 of 3". The cap is `maxCrew`: three, plus four a
             district, plus two a front.
          */}
          <KeyValue label="Respect" value={Math.floor(org.respect)} />
          <KeyValue
            label="Operations"
            value={`${state.player.opsCompleted} done · ${state.player.opsFailed} failed`}
          />
          <KeyValue
            label="Crew"
            value={`${crew.length} of ${maxCrew(state)} · ${free.length} free`}
          />
          <KeyValue
            label="Weekly wages"
            value={formatMoney(weeklyWageBill(state))}
            tone={payroll.shortfall > 0 ? 'hot' : 'brass'}
          />
          {/*
            The bill before it lands, not after.

            Missing payroll is the most expensive thing that happens to an
            organization here and it used to arrive as a log line written once
            the money had already failed to move — a consequence with no
            decision attached. Said in days rather than as a date because the
            only question the player is actually asking is "can I get through
            one more job first".
          */}
          {payroll.due > 0 && (
            <p
              /*
                 Three states, not two.

                 A playtester lost a man to a missed payday and said the warning
                 only arrives once the money is already short. It does not — the
                 forecast has always been on this screen — but "covered" was
                 doing the same work at ten times the bill as at one and a
                 tenth, so a boss one bad job from trouble read the same line as
                 a boss with a year in the bank.
              */
              className={
                payroll.shortfall > 0
                  ? 'hot tiny'
                  : payroll.onHand < payroll.due * 1.5
                    ? 'brass tiny'
                    : 'faint tiny'
              }
              style={{ marginTop: 10, marginBottom: 0 }}
            >
              {payroll.shortfall > 0
                ? `Payroll in ${payroll.daysAway} ${payroll.daysAway === 1 ? 'day' : 'days'}: ${formatMoney(payroll.due)} due, ${formatMoney(payroll.onHand)} on hand. Short ${formatMoney(payroll.shortfall)}.`
                : payroll.onHand < payroll.due * 1.5
                  ? `Payroll in ${payroll.daysAway} ${payroll.daysAway === 1 ? 'day' : 'days'}: ${formatMoney(payroll.due)} due, ${formatMoney(payroll.onHand)} on hand. Covered, barely.`
                  : `Payroll in ${payroll.daysAway} ${payroll.daysAway === 1 ? 'day' : 'days'}: ${formatMoney(payroll.due)}, covered.`}
            </p>
          )}
        </Panel>
      </div>
      )}

      {state.mode !== 'simulation' && (
      <Panel
        title="Work in progress"
        action={
          <button className="btn small" onClick={() => onNavigate('operations')}>
            Operations
          </button>
        }
        flush
      >
        {ops.length === 0 ? (
          <Empty>Nothing running. Nothing earning.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Crew</th>
                  <th className="num">Odds shown</th>
                  <th className="num">Days left</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((op) => {
                  const def = OPERATION_BY_ID[op.defId];
                  const total = op.endDay - op.startDay;
                  const done = state.day - op.startDay;
                  return (
                    <tr key={op.id}>
                      <td>{def.name}</td>
                      <td className="num mono">{op.crewIds.length}</td>
                      <td className="num mono">{Math.round(op.successChance * 100)}%</td>
                      <td className="num mono">{op.endDay - state.day}</td>
                      <td style={{ minWidth: 120 }}>
                        <Bar value={done} max={total} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      )}

      <Panel title="What has been happening" flush>
        {state.log.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <div className="log">
            {state.log.slice(0, 60).map((entry, i) => (
              <div key={i} className={`log-entry ${entry.kind}`}>
                <span className="log-day" title={formatShortDay(entry.day)}>
                  {entry.day}
                </span>
                <span className="log-text">{entry.text}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
