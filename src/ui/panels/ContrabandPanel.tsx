import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, Empty, KeyValue, Bar } from '../components';
import {
  armsSaleValue,
  buildWorkshop,
  canBuildWorkshop,
  armsSupplier,
  canOpenArmsSupply,
  canOpenSupply,
  supplierTrust,
  walkChance,
  dropArmsSupply,
  openArmsSupply,
  canSellArms,
  closeRoute,
  dropSupply,
  openRoute,
  openSupply,
  portHolder,
  portMultiplier,
  readSuppliers,
  readTrade,
  sellArms,
} from '../../sim/contraband';
import { people, prosperity, territoryDef } from '../../sim/territory';
import { formatMoney } from '../../sim/util';
import { rivals } from '../../sim/faction';
import {
  ARMS_SALE,
  ARMS_SUPPLIERS,
  TRADES,
  TRADE_IDS,
  WORKSHOP,
  type TradeId,
} from '../../config/contraband';
import { priced } from '../../sim/market';
import { RANK_BY_ID } from '../../config/economy';
import { CONTROL_LABEL } from '../../config/territories';
import { houseName, houseShort } from '../../sim/houses';

/**
 * The two trades.
 *
 * Deliberately one screen rather than two: they share a chain, and the thing
 * worth seeing is that both are competing for the same crew and the same
 * districts as everything else you do. The number that matters most on this
 * page is not the money — it is which of the two ceilings is binding.
 */
export default function ContrabandPanel() {
  const state = useGame();
  const [tab, setTab] = useState<TradeId>('product');
  const read = readTrade(state, tab);
  const def = TRADES[tab];
  const c = state.contraband;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">The Trade</h1>
        <span className="tiny">
          {c.lastRun
            ? `${formatMoney(c.lastRun.product.earned + c.lastRun.arms.earned)} last week`
            : 'Nothing running'}
        </span>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        {TRADE_IDS.map((id) => (
          <button
            key={id}
            className={id === tab ? 'btn small primary' : 'btn small'}
            onClick={() => setTab(id)}
          >
            {TRADES[id].name}
          </button>
        ))}
      </div>

      {!read.unlocked ? (
        <Panel title={def.name}>
          <Empty>
            {def.blurb} Nobody would deal with you at your standing — this needs a{' '}
            {RANK_BY_ID[def.minRank].name}.
          </Empty>
        </Panel>
      ) : (
        <>
          <div className="grid-2">
            <Panel title="What is moving">
              <KeyValue
                label={`On hand`}
                value={`${read.stock} ${read.stock === 1 ? def.unit[0] : def.unit[1]}`}
                tone={read.stock > 0 ? 'brass' : undefined}
              />
              <KeyValue label="Costs you" value={`${formatMoney(read.cost)} each`} />
              <KeyValue label="Fetches" value={`${formatMoney(read.value)} each`} tone="good" />
              <KeyValue label="Moved last week" value={String(read.lastMoved)} />
              <KeyValue
                label="Earned last week"
                value={formatMoney(read.lastEarned)}
                tone="brass"
              />
              {c.lastRun && c.lastRun[tab].seized > 0 && (
                <KeyValue
                  label="Taken in a raid"
                  value={String(c.lastRun[tab].seized)}
                  tone="hot"
                />
              )}
            </Panel>

            <Panel title="What is stopping you">
              {/*
                The decision this whole panel exists to put in front of the
                player. Ground without people is a network nobody is running;
                people without ground is a crew standing about. Whichever bar
                is shorter is the thing to fix, and it is deliberately the same
                crew that operations want.
              */}
              <div className="row between" style={{ marginBottom: 4 }}>
                <span className="tiny">The streets you hold</span>
                <span className="tiny mono">{Math.round(read.capacity.routes)}</span>
              </div>
              <Bar
                value={Math.min(100, read.capacity.routes)}
                tone={read.capacity.routes <= read.capacity.crew ? 'hot' : 'ok'}
              />
              <div className="row between" style={{ margin: '10px 0 4px' }}>
                {/*
                  It is what the free people can carry, not how many there are.

                  This read "The people you have free" beside `capacity.crew`,
                  which is `available * UNITS_PER_CREW` — so a crew of nine
                  reported 54 people free. A round-7 tester wrote the number
                  down as a bug. The bar next to it is a comparison against the
                  route ceiling in the same units, so the units are the thing to
                  name.
                */}
                <span className="tiny">What your free people could carry</span>
                <span className="tiny mono">{read.capacity.crew}</span>
              </div>
              <Bar
                value={Math.min(100, read.capacity.crew)}
                tone={read.capacity.crew < read.capacity.routes ? 'hot' : 'ok'}
              />
              {/*
                The third bar, and the one that was missing.

                Ground and people were the only two here, so a family with
                plenty of both and no cash was told to take more of the city.
                Round 11's trade went from $73,745 a week to nothing on exactly
                that state and the panel never mentioned money — see
                sim/contraband.ts:TradeRead.affordable.
              */}
              <div className="row between" style={{ margin: '10px 0 4px' }}>
                <span className="tiny">What you could pay for</span>
                <span className="tiny mono">
                  {read.affordable} at {formatMoney(read.cost)} each
                </span>
              </div>
              <Bar
                value={Math.min(100, read.affordable)}
                tone={read.affordable < Math.min(read.capacity.routes, read.capacity.crew) ? 'hot' : 'ok'}
              />
              <p className="faint" style={{ marginTop: 10, marginBottom: 0 }}>
                {read.capacity.total <= 0
                  ? read.eligible.length === 0
                    ? // Naming the threshold, not gesturing at it. The table below
                      // lists only districts that qualify, so a player who does not
                      // hold one deeply enough sees an empty table and no reason —
                      // which reads as a broken screen rather than a requirement.
                      `Nothing can move. This needs a district at ${CONTROL_LABEL[
                        def.minControl
                      ].toLowerCase()} or better, and you do not hold one that far yet.`
                    : 'Nothing can move. Open a route in one of the districts below.'
                  : read.affordable < Math.min(read.capacity.routes, read.capacity.crew)
                    ? read.affordable === 0
                      ? `Nothing is moving because nothing was bought. A load costs ${formatMoney(read.cost)} and there is no money to buy one.`
                      : `Money is the short end. You can stock ${read.affordable} at ${formatMoney(read.cost)} each; the streets and the people could carry more.`
                    : read.capacity.crew < read.capacity.routes
                      ? 'You have more ground than people. Anybody on a job is not on this.'
                      : 'You have more people than ground. Take more of the city.'}
              </p>
            </Panel>
          </div>

          {tab === 'product' ? (
            <Supply />
          ) : (
            <>
              {/*
                 Both doors into the arms trade, in the order a career meets
                 them. A workshop is $120,000 and measured peak funds run p90
                 $94,345, so for most careers the source above is the only one
                 of these two that will ever be a real choice.
              */}
              <ArmsSupply />
              <Workshops />
            </>
          )}

          <Panel title="Where it runs">
            <p className="faint" style={{ marginTop: 0 }}>
              {def.blurb}
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>District</th>
                  <th className="num">Would carry</th>
                  <th>Feeling</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {/* An empty table with headers reads as a screen that failed to
                    load. It is a requirement, so it should say so. */}
                {read.eligible.length === 0 && (
                  <tr>
                    <td colSpan={4} className="faint">
                      No district is yours deeply enough. This needs{' '}
                      {CONTROL_LABEL[def.minControl].toLowerCase()} — keep working the
                      same streets until you hold them outright.
                    </td>
                  </tr>
                )}
                {read.eligible.map((t) => {
                  const open = read.routes.some((r) => r.id === t.id);
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="name-cell">
                          <span className="name-main">{territoryDef(t.id).name}</span>
                          <span className="name-sub">
                            {Math.round(people(state, t.id)).toLocaleString('en-US')} people
                          </span>
                        </div>
                      </td>
                      <td className="num mono">{Math.round(districtShare(state, tab, t.id))}</td>
                      <td>
                        <div style={{ minWidth: 90 }}>
                          <Bar value={t.sentiment} tone={t.sentiment < 30 ? 'hot' : undefined} />
                        </div>
                      </td>
                      <td>
                        <button
                          className={open ? 'btn small danger' : 'btn small'}
                          onClick={() =>
                            mutate(
                              (s) =>
                                open ? closeRoute(s, tab, t.id) : openRoute(s, tab, t.id),
                              true,
                            )
                          }
                          title={
                            open
                              ? 'Stop running it here. The neighbourhood recovers.'
                              : `Every unit that moves here costs the district ${Math.abs(
                                  def.sentimentPerUnit,
                                ).toFixed(2)} of how it feels about you.`
                          }
                        >
                          {open ? 'Stop' : 'Run it here'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {read.eligible.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <Empty>
                        You do not hold enough of anywhere. This needs {def.minControl} of a
                        district before anybody will carry it.
                      </Empty>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>

          {tab === 'arms' && <ArmsBuyers />}
        </>
      )}
    </>
  );
}

/** What one district would take, for the table. */
function districtShare(
  state: ReturnType<typeof useGame>,
  trade: TradeId,
  territoryId: string,
): number {
  const t = state.territories[territoryId];
  if (!t) return 0;
  // Recomputed here rather than threaded through: it is one multiplication and
  // the panel wants it per row.
  const def = TRADES[trade];
  const wealth = (prosperity(state, territoryId) / 100) * def.wealthWeight;
  const folk = (people(state, territoryId) / 62_000) * def.populationWeight;
  return def.districtCapacity * (wealth + folk);
}

/** Where product comes from, and what the waterfront is doing to the price. */
/** Somewhere to buy finished crates, beside the shops that make them. */
function ArmsSupply() {
  const state = useGame();
  const current = armsSupplier(state);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Panel title="Buying them in">
      <p className="dim" style={{ marginTop: 0 }}>
        Dearer per crate than making them, and there is no building for anybody to raid.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Arrangement</th>
            <th className="num">Per crate</th>
            <th className="num">Ceiling</th>
            <th className="num">Retainer</th>
            <th className="num">Standing</th>
            <th className="num">They walk</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ARMS_SUPPLIERS.map((def) => {
            const mine = current?.id === def.id;
            const check = canOpenArmsSupply(state, def.id);
            return (
              <tr key={def.id}>
                <td>
                  <div className="name-cell">
                    <span className={mine ? 'name-main brass' : 'name-main'}>{def.name}</span>
                    <span className="name-sub">{def.blurb}</span>
                  </div>
                </td>
                <td className="num mono">
                  {formatMoney(Math.round(priced(state, TRADES.arms.unitCost) * def.priceMultiplier))}
                </td>
                <td className="num mono">{def.ceiling}/wk</td>
                <td className="num mono">{formatMoney(def.retainer)}</td>
                <td style={{ minWidth: 90 }}>
                  {mine ? (
                    <>
                      <Bar value={supplierTrust(state, def.id)} />
                      <span className="tiny faint">{Math.round(supplierTrust(state, def.id))}/100</span>
                    </>
                  ) : (
                    <span className="tiny faint">&mdash;</span>
                  )}
                </td>
                <td className="num mono">
                  {mine
                    ? `${(walkChance(state, def) * 100).toFixed(1)}%`
                    : `${(def.failureChancePerWeek * 100).toFixed(1)}%`}
                </td>
                <td>
                  <button
                    className={mine ? 'btn small danger' : 'btn small'}
                    disabled={!mine && !check.ok}
                    title={mine ? 'End this arrangement.' : check.message}
                    onClick={() => {
                      const result = mutate(
                        (s) => (mine ? dropArmsSupply(s) : openArmsSupply(s, def.id)),
                        true,
                      );
                      if (result) setMessage(result.message);
                    }}
                  >
                    {mine ? 'End it' : 'Open it'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {message && (
        <p className="dim" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
    </Panel>
  );
}

function Supply() {
  const state = useGame();
  const suppliers = readSuppliers(state);
  const holder = portHolder(state);
  const multiplier = portMultiplier(state);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Panel title="Where it comes from">
      {multiplier !== 1 && (
        <p className={multiplier > 1 ? 'hot' : 'good'} style={{ marginTop: 0 }}>
          {holder === 'player'
            ? 'You hold the docks, so what comes in over the water comes in cheaper.'
            : `The ${houseShort(state, holder!)} hold the docks. Everything that arrives by water arrives at their price.`}
        </p>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Arrangement</th>
            <th className="num">Per unit</th>
            <th className="num">Ceiling</th>
            <th className="num">Retainer</th>
            {/*
               The relationship, where the player can see it.

               `failureChancePerWeek` used to be a constant nobody could move —
               dockside lasted a mean of 18.4 weeks and was gone inside a year
               in 21 of 24 careers, for reasons the player never caused and
               could never prevent. Trust is the lever, so it has to be on the
               same row as the arrangement it protects, with the odds it is
               buying stated as a number rather than implied.
            */}
            <th className="num">Standing</th>
            <th className="num">They walk</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {suppliers.map(({ def, current, price }) => {
            const check = canOpenSupply(state, def.id);
            return (
            <tr key={def.id}>
              <td>
                <div className="name-cell">
                  <span className={current ? 'name-main brass' : 'name-main'}>{def.name}</span>
                  <span className="name-sub">{def.blurb}</span>
                </div>
              </td>
              <td className="num mono">{formatMoney(price)}</td>
              <td className="num mono">{def.ceiling}/wk</td>
              <td className="num mono">{formatMoney(def.retainer)}</td>
              <td style={{ minWidth: 90 }}>
                {current ? (
                  <>
                    <Bar value={supplierTrust(state, def.id)} />
                    <span className="tiny faint">{Math.round(supplierTrust(state, def.id))}/100</span>
                  </>
                ) : (
                  <span className="tiny faint">&mdash;</span>
                )}
              </td>
              <td className="num mono">
                {current
                  ? `${(walkChance(state, def) * 100).toFixed(1)}%`
                  : `${(def.failureChancePerWeek * 100).toFixed(1)}%`}
              </td>
              <td>
                {/*
                  Both halves of this were silent. Opening can fail on rank or
                  on the retainer, and the click was throwing the reason away —
                  so a player who could not afford $40,000 got a button that
                  looked live, took the click and did nothing at all.
                */}
                <button
                  className={current ? 'btn small danger' : 'btn small'}
                  disabled={!current && !check.ok}
                  title={current ? 'End this arrangement.' : check.message}
                  onClick={() => {
                    const result = mutate(
                      (s) => (current ? dropSupply(s) : openSupply(s, def.id)),
                      true,
                    );
                    if (result) setMessage(result.message);
                  }}
                >
                  {current ? 'End it' : 'Open it'}
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {message && (
        <p className="dim" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
    </Panel>
  );
}

/** Arms are made rather than bought, which is a building somebody can raid. */
function Workshops() {
  const state = useGame();
  const shops = state.contraband.workshops;
  const eligible = readTrade(state, 'arms').eligible;

  return (
    <Panel title="Where it is made">
      <p className="faint" style={{ marginTop: 0 }}>
        A shop produces {WORKSHOP.outputPerWeek} a week whether or not you have anywhere to
        send them, costs {formatMoney(WORKSHOP.upkeep)} a week either way, and has a lease
        with an address on it. That last part is the whole difference between this and
        buying from somebody.
      </p>
      {shops.length === 0 ? (
        <Empty>No shops. Nothing is being made.</Empty>
      ) : (
        shops.map((shop, i) => (
          <KeyValue
            key={i}
            label={territoryDef(shop.territoryId).name}
            value={`${WORKSHOP.outputPerWeek}/wk`}
            tone="brass"
          />
        ))
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        {eligible.map((t) => {
          const check = canBuildWorkshop(state, t.id);
          return (
            <button
              key={t.id}
              className="btn small"
              disabled={!check.ok}
              title={check.message}
              onClick={() => mutate((s) => buildWorkshop(s, t.id), true)}
            >
              Open in {territoryDef(t.id).name} — {formatMoney(WORKSHOP.cost)}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/**
 * Selling to the people who will use it.
 *
 * The most double-edged thing in the game. The panel says so plainly, because
 * the consequence is invisible otherwise — the money arrives today and the
 * strength figure on the Rivals panel goes up quietly.
 */
function ArmsBuyers() {
  const state = useGame();
  const stock = Math.floor(state.contraband.stock.arms);
  const [crates, setCrates] = useState(ARMS_SALE.minCrates);

  return (
    <Panel title="Who else wants them">
      <p className="hot" style={{ marginTop: 0 }}>
        They pay well above street value because they are not buying goods, they are buying
        capability. Every crate makes them harder to fight, and nothing in this game will
        remind you of that in eighteen months.
      </p>
      <div className="row" style={{ gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <span className="tiny">Crates</span>
        <input
          type="range"
          min={ARMS_SALE.minCrates}
          max={Math.max(ARMS_SALE.minCrates, stock)}
          value={Math.min(crates, Math.max(ARMS_SALE.minCrates, stock))}
          onChange={(e) => setCrates(Number(e.target.value))}
        />
        <span className="mono">{Math.min(crates, stock)}</span>
        <span className="mono brass">{formatMoney(armsSaleValue(state, Math.min(crates, stock)))}</span>
      </div>
      {rivals(state).map((faction) => {
        const check = canSellArms(state, faction.id, Math.min(crates, stock));
        return (
          <div className="kv" key={faction.id}>
            <span className="kv-key">{houseName(state, faction.id)}</span>
            <button
              className="btn small"
              disabled={!check.ok}
              title={check.message}
              onClick={() =>
                mutate((s) => sellArms(s, faction.id, Math.min(crates, stock)), true)
              }
            >
              {check.ok ? 'Sell to them' : check.message}
            </button>
          </div>
        );
      })}
    </Panel>
  );
}
