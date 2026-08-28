import { useState } from 'react';

import { useGame, mutate } from '../../store';
import { Panel, Empty, KeyValue, Bar } from '../components';
import {
  acquisitionOptions,
  businessDef,
  healthPressure,
  launderCapacity,
  launderCut,
  launderOutlook,
  ownedBusinesses,
  revenueIfBought,
  shutterBusiness,
  totalLaunderCapacity,
  totalWeeklyRevenue,
  weeklyRevenue,
} from '../../sim/business';
import { DEFAULT_PRESSURE, PRESSURES } from '../../config/pressure';
import {
  canRetainLauderer,
  dropLaunderer,
  launderer,
  readLaunderers,
  retainLaunderer,
} from '../../sim/launderers';
import { LAUNDER_CUT_BASE } from '../../config/businesses';
import { territoryDef } from '../../sim/territory';
import { openDeal } from '../../sim/frontDeal';
import { formatMoney, formatShortDay, formatPercent } from '../../sim/util';
import { HEALTH, EXPOSURE_ALARMING_ABOVE, SHUTTER_REFUND_SHARE } from '../../config/businesses';
import { priced } from '../../sim/market';

/**
 * Why a front is dying, in the words of the thing that is killing it.
 *
 * A health number on its own tells the player nothing they can act on. The
 * four pressures have four different answers — win the neighbourhood back,
 * stop washing so much through it, take the district off whoever is competing,
 * or wait for the city to calm down — so the panel names the largest one.
 */
function worstProblem(p: {
  sentiment: number;
  exposure: number;
  rivals: number;
  city: number;
}): string {
  const worst = [
    ['The neighbourhood has turned against you', p.sentiment],
    ['Too much is going through the books', p.exposure],
    ['Somebody else is running the same thing here', p.rivals],
    ['Nobody in this city is spending', p.city],
  ].sort((a, b) => (a[1] as number) - (b[1] as number))[0];
  return worst[0] as string;
}

export default function BusinessesPanel() {
  const state = useGame();
  /** Which front, if any, has its sale armed. One at a time, by id. */
  const [armed, setArmed] = useState<string | null>(null);
  const owned = ownedBusinesses(state);
  const capacity = totalLaunderCapacity(state);
  const revenue = totalWeeklyRevenue(state);
  const cut = launderCut(state);
  const outlook = launderOutlook(state);
  const options = acquisitionOptions(state);
  const affordable = options.filter((o) => o.check.ok);
  /*
     What is actually available to put into a front, said out loud.

     `canAcquire` counts holdings toward a purchase — a front is the one thing
     put-away money buys, and it buys it without paying the hurry price. Nothing
     on this panel said so, so round 10's tester read "Clean $28" beside an
     enabled Buy button on a $21,741 restaurant, concluded the button was a bug,
     and reported it as one. They had $21,998 put away.

     That is the whole ladder this system is built on — a front pays into
     holdings, holdings buy the next front up — and it was invisible at the exact
     moment a player decides which rung to buy.
  */
  const buyingPower = state.org.cash + state.org.dirtyCash + (state.org.holdings ?? 0);
  /*
     How far off the cheapest one is, when none are reachable.

     A playtester held a district on day 48, opened this page, saw a wall of
     five-figure prices against a four-figure bankroll and wrote that it "reads
     as a tease rather than a goal". The difference between those two things is
     entirely whether the page tells you how far away it is — a number you can
     work towards is a goal, and the same number with no distance attached is
     a shop you have been shown round and cannot buy anything in.
  */
  const funds = state.org.cash + state.org.dirtyCash;
  const shortfalls = options
    .filter((o) => !o.check.ok && o.check.cost > funds)
    .map((o) => o.check.cost - funds);
  const nearest = shortfalls.length ? Math.min(...shortfalls) : null;
  /*
     Money is only the answer when money is the answer.

     `shortfalls` is deliberately the set you cannot afford, and that is what
     made the header lie. A front you *can* afford which is blocked on the
     district — no room left, or a neighbourhood that will not sell to you —
     falls out of that filter, so the page skipped it and quoted the distance
     to the next item up the list instead.

     A round-7 tester sat on $10,800 in front of a $10,300 laundromat, was
     refused, and was told they were $4,826 short. They spent about forty
     in-game days working toward a number that was never the obstacle.

     So: if the cheapest thing you cannot buy is one you could pay for, the
     header says why it is refused rather than how much more to earn.
  */
  const blockedButAffordable = options
    .filter((o) => !o.check.ok && o.check.cost <= funds)
    .sort((a, b) => a.check.cost - b.check.cost)[0];
  const backlog = state.org.dirtyCash;
  const weeksToClear = capacity > 0 ? Math.ceil(backlog / capacity) : null;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Businesses</h1>
        <span className="tiny">
          {owned.length} operating · {formatMoney(capacity)}/wk capacity
        </span>
      </div>
      <p className="page-sub">
        A front does two things: it earns clean money, and it absorbs dirty money.
        Pushing volume through one is what makes your cash usable — and what makes
        the business the most interesting thing about you.
      </p>

      <Books />

      <div className="grid-2">
        <Panel title="The pipeline">
          <KeyValue label="Dirty cash waiting" value={formatMoney(backlog)} tone="good" />
          <KeyValue label="Weekly capacity" value={formatMoney(capacity)} />
          <KeyValue label="Cut taken" value={formatPercent(cut)} tone="hot" />
          <KeyValue label="Clean income" value={`${formatMoney(revenue)} / week`} tone="brass" />
          {weeksToClear !== null && backlog > 0 && (
            <KeyValue
              label="Weeks to clear the backlog"
              value={weeksToClear}
              tone={weeksToClear > 8 ? 'hot' : undefined}
            />
          )}
          {capacity === 0 && (
            <p className="faint" style={{ marginTop: 10, marginBottom: 0 }}>
              Nothing to launder through. Take a foothold in a district and buy something
              unremarkable.
            </p>
          )}
          {/*
            What Friday will actually wash, and which of the two ceilings is
            the one biting. Capacity was the only number here, and capacity is
            almost never the constraint early — the payroll held back out of
            dirty cash is. A player watching four hundred a week trickle in
            against a three-thousand capacity had no way to see that the wage
            bill was eating the input, and reasonably concluded the rank was
            simply priced out of reach.
          */}
          {capacity > 0 && (
            <p
              className={
                outlook.limit === 'nothing'
                  ? 'hot tiny'
                  : outlook.limit === 'pushing' || outlook.limit === 'capacity'
                    ? 'brass tiny'
                    : 'faint tiny'
              }
              style={{ marginTop: 10, marginBottom: 0 }}
            >
              {outlook.limit === 'nothing'
                ? `Nothing will wash this week. ${formatMoney(outlook.heldBack)} of dirty cash is spoken for by wages, and there is no surplus behind it.`
                : outlook.limit === 'pushing'
                  ? `About ${formatMoney(outlook.clean)} clean this week — ${outlook.load.toFixed(1)}x what these premises comfortably take. All of it goes through and they age at that rate. Another front spreads it.`
                  : outlook.limit === 'capacity'
                    ? `About ${formatMoney(outlook.clean)} clean this week — you have more dirty money than these premises will take, and the rest waits. Another front, or lean on the ones you have.`
                    : `About ${formatMoney(outlook.clean)} clean this week, after ${formatMoney(outlook.heldBack)} is held back for wages. Capacity is not the limit; earnings are.`}
            </p>
          )}
          <p className="faint tiny" style={{ marginTop: 10, marginBottom: 0 }}>
            Your Business attribute buys the cut down. Wages come out of dirty cash
            before anything is washed, so a smaller payroll launders more.
          </p>
        </Panel>

        <Panel title="Last payday">
          {state.lastLaunderReport ? (
            <>
              <KeyValue
                label="Revenue taken in"
                value={formatMoney(state.lastLaunderReport.revenue)}
                tone="brass"
              />
              <KeyValue
                label="Moved through"
                value={formatMoney(state.lastLaunderReport.laundered)}
              />
              <KeyValue
                label="Lost in the washing"
                value={formatMoney(state.lastLaunderReport.cut)}
                tone="hot"
              />
              <KeyValue
                label="Arrived clean"
                value={formatMoney(
                  state.lastLaunderReport.revenue +
                    state.lastLaunderReport.laundered -
                    state.lastLaunderReport.cut,
                )}
                tone="good"
              />
            </>
          ) : (
            <p className="faint" style={{ margin: 0 }}>
              Nothing has moved yet.
            </p>
          )}
        </Panel>
      </div>

      {/*
         The two bars needed saying out loud.

         Exposure and Trade are drawn identically, run the same way and mean
         opposite things — a full exposure bar is a disaster and a full trade
         bar is a healthy shop. A playtester owned fronts for weeks and wrote
         that they never worked out which way either one was supposed to point,
         which is a fair reading of two unlabelled bars sitting side by side.
      */}
      <Panel title="What you own" flush>
        {owned.length === 0 ? (
          <Empty>No fronts. Every dollar you have is the wrong colour.</Empty>
        ) : (
          <div className="table-wrap">
            <p className="faint" style={{ fontSize: 11.5, margin: '0 18px 10px' }}>
              Exposure is what an investigator makes of the books — you want it low. Trade
              is whether the place is a going concern on its own — you want it high.
            </p>
            <table className="data">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>District</th>
                  <th className="num">Earns</th>
                  <th className="num">Capacity</th>
                  <th className="num">Last week</th>
                  <th>Exposure</th>
                  <th>Trade</th>
                  <th>Run as</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {owned.map((b) => {
                  const def = businessDef(b);
                  const alarming = b.exposure > EXPOSURE_ALARMING_ABOVE;
                  // Two different problems with two different answers, which
                  // is why they are two columns: exposure is what an
                  // investigator thinks of it, trade is whether it is actually
                  // a going concern.
                  const health = b.health ?? HEALTH.start;
                  const struggling = health < HEALTH.warnBelow;
                  const pressure = healthPressure(state, b);
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="name-cell">
                          <span className="name-main">{def.name}</span>
                          <span className="name-sub">
                            since {formatShortDay(b.purchasedDay)}
                          </span>
                        </div>
                      </td>
                      <td className="dim">{territoryDef(b.territoryId).name}</td>
                      <td className="num mono brass">{formatMoney(weeklyRevenue(state, b))}</td>
                      <td className="num mono">{formatMoney(launderCapacity(state, b))}</td>
                      <td className="num mono">
                        {b.lastLaundered ? formatMoney(b.lastLaundered) : '—'}
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <Bar value={b.exposure} tone={alarming ? 'hot' : undefined} />
                          </div>
                          <span className={alarming ? 'mono hot' : 'mono faint'}>
                            {Math.round(b.exposure)}
                          </span>
                        </div>
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <Bar value={health} tone={struggling ? 'hot' : 'ok'} />
                          </div>
                          <span className={struggling ? 'mono hot' : 'mono faint'}>
                            {Math.round(health)}
                          </span>
                        </div>
                        {struggling && (
                          <div className="tiny hot">{worstProblem(pressure)}</div>
                        )}
                      </td>
                      {/*
                         How hard you are leaning on it.

                         The question the whole front economy turns on and the
                         one the game never asked: do you want this to be a
                         business, or do you want it to move money. Rendered as
                         three buttons rather than a menu because it is a
                         standing decision about the place, not a command — and
                         the cost of each is on the button, since round 14's
                         loudest complaint was options that hide their price.
                      */}
                      <td style={{ minWidth: 132 }}>
                        <div className="row" style={{ gap: 3, whiteSpace: 'nowrap' }}>
                          {PRESSURES.map((p) => (
                            <button
                              key={p.id}
                              className={
                                (b.pressure ?? DEFAULT_PRESSURE) === p.id
                                  ? 'district selected'
                                  : 'district'
                              }
                              title={`${p.name} — ${p.blurb}`}
                              /*
                                 Compact, because `.district` is sized for the
                                 job screen's picker and three of them at that
                                 padding is 189px in a table that had 49px of
                                 slack. The wrap scrolls by design — round 13
                                 established that — but a column does not get
                                 to be the widest thing on the row for free.
                              */
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              onClick={() =>
                                mutate((s) => {
                                  const front = s.businesses[b.id];
                                  if (front) front.pressure = p.id;
                                })
                              }
                            >
                              {p.short}
                            </button>
                          ))}
                        </div>
                        {/*
                           No sub-line saying what it washes.

                           The Capacity column two cells to the left already
                           shows the actual figure, and the sentence was the
                           widest thing in this cell — measured at 189px of
                           column against a table that only had 49px of slack
                           before this control existed.
                        */}
                      </td>
                      <td style={{ minWidth: 150 }}>
                        {/*
                           Armed before it fires, and no longer called "Close".

                           This button destroys a five-figure asset for 35% of
                           what it cost, and it used to do it on one unconfirmed
                           click, labelled with the same word the district and
                           person panels use for "dismiss this panel". Round 13
                           lost two laundromats to it and was scrupulous enough
                           to say the click was its own automation — but the
                           naming collision is real, the price is worse than
                           that tester assumed, and nothing else in the game
                           spends this much without quoting the figure first.

                           Same arm-then-confirm shape as the lay-low control,
                           for the same stated reason: the last screen before
                           the money goes is the last place a number is useful.
                        */}
                        {armed === b.id ? (
                          <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                            <span className="tiny hot">
                              {formatMoney(
                                Math.round(
                                  priced(state, businessDef(b).cost) * SHUTTER_REFUND_SHARE,
                                ),
                              )}{' '}
                              back
                            </span>
                            <button className="btn small" onClick={() => setArmed(null)}>
                              No
                            </button>
                            <button
                              className="btn small danger"
                              onClick={() => {
                                mutate((s) => shutterBusiness(s, b.id), true);
                                setArmed(null);
                              }}
                            >
                              Sell it
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn small danger"
                            title="Selling up dumps its exposure and returns part of what you paid."
                            onClick={() => setArmed(b.id)}
                          >
                            Sell up
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Available to buy"
        action={
          <span className="tiny">
            {affordable.length > 0
              ? `${affordable.length} within reach — ${formatMoney(buyingPower)} to spend`
              : blockedButAffordable
                ? // Lead with the blocker, not the money. Round 11 read "YOU CAN
                  // COVER THE CHEAPEST" across the top of a page where every
                  // Buy button was disabled, holding $23,000 with every slot
                  // full. The money was true and it was not the point.
                  //
                  // The blocker itself now goes in the body rather than here.
                  // This slot is a flex child of `.panel-head` with no wrap and
                  // no `min-width`, and it has about 590px before it starts
                  // eating the panel title: measured in the live page, the
                  // sentence wanted 980 and broke "AVAILABLE TO BUY" across two
                  // lines. A reason worth reading does not fit in a header.
                  'nothing you can buy here yet'
                : nearest
                  ? `nothing yet — the cheapest is ${formatMoney(nearest)} away`
                  : 'nothing yet'}
          </span>
        }
        flush
      >
        {options.length === 0 ? (
          <Empty>
            You do not hold enough of any district to put your name on a business there.
          </Empty>
        ) : (
          <div className="table-wrap">
            {/*
               Why nothing here can be bought, in plain sight.

               This is the third repair to the same finding and the first one to
               put the sentence where somebody reads it. Rounds 7, 11 and 12 all
               lost time to a district that would not sell: round 7's repair was
               a tooltip on the Territory panel, round 11's promoted the blocker
               into the panel header, and neither is visible text on the screen
               the player is actually staring at. When every row is disabled the
               reason lives only in the `title` of a disabled button, and a
               tooltip is a thing you find by already suspecting it is there.

               Round 12 sat in front of this table and did not own a front for
               two hundred days. The information was in the build the whole time.
            */}
            {!options.some((o) => o.check.ok) && (
              <p className="hot" style={{ margin: '0 14px 10px' }}>
                {/* The one you are closest to being able to buy, for the same
                    reason the header picks it: explaining the refusal on a
                    business you could not pay for either answers a question
                    nobody asked. */}
                {(blockedButAffordable ?? options[0]).check.reason}
              </p>
            )}
            <table className="data">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>District</th>
                  <th className="num">Cost</th>
                  <th className="num">Earns</th>
                  <th className="num">Capacity</th>
                  <th className="num">Discretion</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {options.slice(0, 24).map(({ def, territory, check }) => (
                  <tr key={`${def.id}-${territory.id}`}>
                    <td>
                      <div className="name-cell">
                        <span className={check.ok ? 'name-main' : 'faint'}>{def.name}</span>
                        <span className="name-sub">{def.description.slice(0, 62)}…</span>
                      </div>
                    </td>
                    <td className="dim">{territoryDef(territory.id).name}</td>
                    <td className="num mono">{formatMoney(check.cost)}</td>
                    <td className="num mono">
                      {formatMoney(revenueIfBought(state, def, territory.id))}
                    </td>
                    <td className="num mono">{formatMoney(def.launderCapacity)}</td>
                    <td className="num mono">{def.legitimacy}</td>
                    <td>
                      {/*
                           You go and see them, rather than pressing Buy.

                           The button used to call `acquireBusiness` directly,
                           which is what made this a shop: a price, a button,
                           and nobody on the other side of it. The price it
                           quotes is now what the place is worth on the open
                           market, and what you actually pay is whatever the
                           two of you get to.
                        */}
                      <button
                        className="btn small"
                        disabled={!check.ok}
                        title={check.reason ?? 'Go and talk to whoever owns it'}
                        onClick={() => mutate((s) => openDeal(s, def.id, territory.id), true)}
                      >
                        Go and see
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/**
 * Who keeps the books, and what knowing you is worth to them.
 *
 * The cut used to be one number on the pipeline panel and nothing a player
 * could act on. Measured over 36 careers it took $156,255 out of a trading
 * family and bought nothing — the only charge in the game that does. So the
 * headline rate is what a *stranger* charges, this is the alternative, and the
 * panel has to state the whole trade rather than only the discount: a retainer
 * up front, a fee every week whether or not a dollar moves, a name that
 * appears on things, and somebody who can stop taking your calls.
 *
 * The standing column is the point. It is the only part of this that cannot be
 * bought, because heat holds it down — the rate improves for a family nobody
 * is looking at.
 */
function Books() {
  const state = useGame();
  const rows = readLaunderers(state);
  const held = launderer(state);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Panel title="Who handles it">
      <p className="dim" style={{ marginTop: 0 }}>
        Nobody takes {formatPercent(LAUNDER_CUT_BASE)} of everything for a reason — that is
        what a stranger charges. Somebody of your own takes less, and takes less again the
        longer they have known you, which is worth more than any of the other numbers on this
        page and cannot be bought in a hurry.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Arrangement</th>
            <th className="num">Takes now</th>
            <th className="num">At best</th>
            <th className="num">Retainer</th>
            <th className="num">A week</th>
            <th className="num">Standing</th>
            <th className="num">They walk</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ def, current, trust, rate, walk, retainer, fee }) => {
            const check = canRetainLauderer(state, def.id);
            return (
              <tr key={def.id}>
                <td>
                  <div className="name-cell">
                    <span className={current ? 'name-main brass' : 'name-main'}>{def.name}</span>
                    <span className="name-sub">{def.blurb}</span>
                  </div>
                </td>
                <td className="num mono">{formatPercent(rate)}</td>
                <td className="num mono good">{formatPercent(def.bestCut)}</td>
                <td className="num mono">{formatMoney(retainer)}</td>
                <td className="num mono">{formatMoney(fee)}</td>
                <td style={{ minWidth: 90 }}>
                  {current ? (
                    <>
                      <Bar value={trust} />
                      <span className="tiny faint">{Math.round(trust)}/100</span>
                    </>
                  ) : (
                    <span className="tiny faint">&mdash;</span>
                  )}
                </td>
                <td className="num mono">
                  {current
                    ? `${(walk * 100).toFixed(1)}%`
                    : `${(def.failureChancePerWeek * 100).toFixed(1)}%`}
                </td>
                <td>
                  <button
                    className={current ? 'btn small danger' : 'btn small'}
                    disabled={!current && !check.ok}
                    title={current ? 'End this arrangement.' : check.message}
                    onClick={() => {
                      const result = mutate(
                        (g) => (current ? dropLaunderer(g) : retainLaunderer(g, def.id)),
                        true,
                      );
                      if (result) setMessage(result.message);
                    }}
                  >
                    {current ? 'End it' : 'Take them on'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!held && (
        <p className="faint tiny" style={{ marginBottom: 0 }}>
          Nobody handles it. Every dollar you wash is costing you the stranger's rate.
        </p>
      )}
      {message && (
        <p className="dim" style={{ marginTop: 12, marginBottom: 0 }}>
          {message}
        </p>
      )}
    </Panel>
  );
}
