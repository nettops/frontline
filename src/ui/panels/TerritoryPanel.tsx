import { useState } from 'react';
import { canPutOnCard, cardTake, putOnCard, takeOffCard } from '../../sim/verbs';
import { hasVerb } from '../../sim/build';
import { useGame, mutate } from '../../store';
import { Panel, Bar, KeyValue } from '../components';
import {
  averageTake,
  canPutInCharge,
  districtWorth,
  eligibleStewards,
  putInCharge,
  readLedger,
  stewardOf,
  takeItBack,
} from '../../sim/delegation';
import {
  businessSlots,
  controlLevel,
  isContested,
  foundingPeople,
  foundingWealth,
  leadingFaction,
  people,
  operableTerritories,
  playerInfluence,
  prosperity,
  readRivals,
  territoryDef,
  territoryList,
  usedSlots,
  hasPresence,
} from '../../sim/territory';
import { yieldRead } from '../../sim/holdings';
import { businessDef } from '../../sim/business';
import { formatMoney, formatShortDay } from '../../sim/util';
import {
  CONTROL_LABEL,
  SENTIMENT_HOSTILE_BELOW,
  TERRITORIES,
} from '../../config/territories';
import { ALL_FACTIONS } from '../../config/factions';
import type { Territory } from '../../sim/types';
import { houseColour, houseName, houseShort } from '../../sim/houses';

/**
 * How far a district has moved from what it was, or nothing at all.
 *
 * Silent below 4% deliberately — a district drifting a point either way is
 * noise, and a readout that is always lit stops being a readout.
 */
function Drift({ now, was }: { now: number; was: number }) {
  const change = (now - was) / Math.max(1, was);
  if (Math.abs(change) < 0.04) return null;
  return (
    <span className={change > 0 ? 'tiny good' : 'tiny hot'} style={{ marginLeft: 6 }}>
      {change > 0 ? '↑' : '↓'}
      {Math.abs(Math.round(change * 100))}%
    </span>
  );
}

type View = 'map' | 'table';

export default function TerritoryPanel() {
  const state = useGame();
  const [view, setView] = useState<View>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const territories = territoryList(state);
  const selected = selectedId ? state.territories[selectedId] : null;

  const held = territories.filter((t) => {
    const level = controlLevel(t);
    return level === 'control' || level === 'dominance';
  }).length;

  /*
     What the card can reach: ground held outright, and whether the build
     opened the verb at all. `hasVerb` rather than a level comparison, so the
     threshold lives in one place.
  */
  const onCard = {
    open: hasVerb(state, 'muscle'),
    districts: territories.filter((t) => {
      const level = controlLevel(t);
      return level === 'control' || level === 'dominance';
    }),
  };
  const working = territories.filter(hasPresence).length;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Territory</h1>
        <span className="tiny">
          {held} held · {working} worked · {TERRITORIES.length} districts
        </span>
      </div>
      <p className="page-sub">
        Influence is not ownership. Four organizations can all be working the same
        streets, and control belongs to whoever has the most of them. You can only
        work a district you already hold or one next to it.
      </p>
      {/*
        Three things a district does that nothing on this screen used to say.

        Working a street takes it off whoever was holding it; a district held
        earns standing every week whether or not you touch it; and the quieter
        a place is yours, the less noise your work there makes. All three were
        added to the simulation and none of them had a sentence anywhere in the
        interface, which makes a district read as a number that goes up.
      */}
      <p className="page-sub">
        Every job you run here pushes whoever holds the street back a little. A
        district you hold keeps earning you standing every week without being
        worked — and the more of it is yours, the less attention your work in it
        draws.
      </p>

      {/*
           The card, which is the Muscle verb.

           Above the map because it is a thing you decide about districts you
           already hold, not a thing you do while looking at one. Only rendered
           when the build opens it — see `config/build.ts`.
        */}
      {onCard.open && (
        <Panel title="On the card">
          <p className="dim" style={{ marginTop: 0 }}>
            Ground that pays every week whether anybody worked or not. What it is worth
            depends entirely on what people think you would do about it not being paid.
          </p>
          <table className="data">
            <tbody>
              {onCard.districts.map((t) => {
                const on = (state.org.card ?? []).includes(t.id);
                const can = canPutOnCard(state, t.id);
                return (
                  <tr key={t.id}>
                    <td>{territoryDef(t.id).name}</td>
                    <td className="dim">{on ? 'paying' : 'not on the card'}</td>
                    <td>
                      <button
                        className="btn small"
                        disabled={!on && !can.ok}
                        title={on ? 'Take it off' : (can.message ?? 'Put it on the card')}
                        onClick={() =>
                          mutate(
                            (g) => (on ? takeOffCard(g, t.id) : putOnCard(g, t.id)),
                            false,
                          )
                        }
                      >
                        {on ? 'Take it off' : 'Put it on'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="faint tiny" style={{ marginBottom: 0 }}>
            {formatMoney(cardTake(state))} a week at what you are worth now.
          </p>
        </Panel>
      )}

      <Panel
        title="The city"
        action={
          <div className="btn-row">
            <button
              className={view === 'map' ? 'btn small primary' : 'btn small'}
              onClick={() => setView('map')}
            >
              Map
            </button>
            <button
              className={view === 'table' ? 'btn small primary' : 'btn small'}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
        }
        flush={view === 'table'}
      >
        {view === 'map' ? (
          <CityMap selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <TerritoryTable selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </Panel>

      {selected && <DistrictDetail territory={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}

/**
 * The board as a schematic district plan — a case-file sketch rather than a
 * geographic map. Adjacency is drawn, because the front line between you and a
 * rival is the thing the rules are actually about.
 */
function CityMap({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const state = useGame();
  const CELL = 132;
  const GAP = 14;
  const W = 3 * CELL + 2 * GAP;
  const H = 4 * CELL + 3 * GAP;

  const pos = (col: number, row: number) => ({
    x: col * (CELL + GAP),
    y: row * (CELL + GAP),
  });

  /*
     Deduplicated adjacency lines.

     These were always here and nobody has ever seen them. Drawn centre to
     centre underneath opaque cells, the only part left showing was 14px of 1px
     dashed hairline in the gap — a blind playtester looked at this screen for
     six in-game months and reported that no map exists, just a card grid. They
     were describing what is actually on the screen.

     Now trimmed to the gap they live in and drawn thick enough to read as a
     join, because adjacency is not decoration here: the rule is that you can
     only work a district you hold or one next to it, which makes this the most
     decision-relevant thing on the page.
  */
  const links: { a: string; b: string }[] = [];
  for (const def of TERRITORIES) {
    for (const other of def.adjacent) {
      if (def.id < other) links.push({ a: def.id, b: other });
    }
  }

  /** Where the player could actually run something. The other half of the rule. */
  const reachable = new Set(operableTerritories(state).map((o) => o.territory.id));

  return (
    <div className="map-wrap">
      <svg viewBox={`-8 -8 ${W + 16} ${H + 16}`} className="city-map" role="img" aria-label="District map">
        {links.map(({ a, b }) => {
          const da = TERRITORIES.find((t) => t.id === a)!;
          const db = TERRITORIES.find((t) => t.id === b)!;
          const pa = pos(da.col, da.row);
          const pb = pos(db.col, db.row);
          const ax = pa.x + CELL / 2;
          const ay = pa.y + CELL / 2;
          const bx = pb.x + CELL / 2;
          const by = pb.y + CELL / 2;
          // Trimmed to the visible gap plus a little either side, so the join
          // reads as a join rather than as two pixels of dust.
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const len = Math.hypot(bx - ax, by - ay) || 1;
          const half = (GAP + 16) / 2;
          const ux = ((bx - ax) / len) * half;
          const uy = ((by - ay) / len) * half;
          return (
            <line
              key={`${a}-${b}`}
              x1={mx - ux}
              y1={my - uy}
              x2={mx + ux}
              y2={my + uy}
              className="map-link"
            />
          );
        })}

        {TERRITORIES.map((def) => {
          const t = state.territories[def.id];
          if (!t) return null;
          const { x, y } = pos(def.col, def.row);
          const mine = playerInfluence(t);
          const leader = leadingFaction(t);
          const colour = leader ? houseColour(state, leader) : '#332a22';
          const level = controlLevel(t);
          const contested = isContested(t);

          return (
            <g
              key={def.id}
              transform={`translate(${x} ${y})`}
              className={`map-cell${selectedId === def.id ? ' selected' : ''}`}
              onClick={() => onSelect(def.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(def.id)}
            >
              <title>
                {def.name} — {CONTROL_LABEL[level]}
                {contested ? ' (contested)' : ''}
              </title>
              <rect width={CELL} height={CELL} className="map-cell-bg" />
              {/* Held share drawn as a fill rising from the bottom. */}
              <rect
                y={CELL - (CELL * mine) / 100}
                width={CELL}
                height={(CELL * mine) / 100}
                fill={houseColour(state, 'player')}
                opacity={0.22}
              />
              <rect
                width={CELL}
                height={CELL}
                className="map-cell-border"
                stroke={colour}
                strokeWidth={level === 'control' || level === 'dominance' ? 2.5 : 1}
              />
              <text x={10} y={22} className="map-name">
                {def.name}
              </text>
              <text x={10} y={40} className="map-meta">
                {CONTROL_LABEL[level]}
              </text>
              <text x={10} y={CELL - 32} className="map-meta">
                {mine > 0 ? `you ${Math.round(mine)}` : 'no presence'}
              </text>
              <text x={10} y={CELL - 16} className="map-meta" fill={colour}>
                {leader && leader !== 'player'
                  ? houseShort(state, leader)
                  : contested
                    ? 'contested'
                    : ''}
              </text>
              {contested && <circle cx={CELL - 14} cy={14} r={4} className="map-contested" />}
              {/*
                 "You can work here."

                 The adjacency rule expressed as the thing the player actually
                 wants to know. A district you hold or one next to it is where
                 the next job can go; everything else is a place you have no way
                 into yet, and until now the only way to find that out was to
                 open the assemble panel and be refused.
              */}
              {reachable.has(def.id) && mine < 1 && (
                <rect
                  x={2}
                  y={2}
                  width={CELL - 4}
                  height={CELL - 4}
                  className="map-reachable"
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="map-key">
        {ALL_FACTIONS.map((id) => (
          <span className="map-key-item" key={id}>
            <span
              className="map-key-swatch"
              style={{ background: houseColour(state, id) }}
            />
            {houseShort(state, id)}
          </span>
        ))}
        <span className="map-key-item faint">Fill height is your influence</span>
        <span className="map-key-item faint">
          <span className="map-key-reach" /> You can work here — held, or next to something held
        </span>
      </div>
    </div>
  );
}

function TerritoryTable({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const state = useGame();
  const [sort, setSort] = useState<'name' | 'influence' | 'wealth' | 'police'>('influence');

  const rows = territoryList(state).slice().sort((a, b) => {
    const da = territoryDef(a.id);
    const db = territoryDef(b.id);
    switch (sort) {
      case 'influence':
        return playerInfluence(b) - playerInfluence(a);
      case 'wealth':
        return db.wealth - da.wealth;
      case 'police':
        return da.policePresence - db.policePresence;
      default:
        return da.name.localeCompare(db.name);
    }
  });

  const header = (label: string, key: typeof sort, num = false) => (
    <th className={num ? 'num sortable' : 'sortable'} onClick={() => setSort(key)}>
      {label}
      {sort === key ? ' ▾' : ''}
    </th>
  );

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {header('District', 'name')}
            <th>Standing</th>
            {header('You', 'influence', true)}
            <th>Others here</th>
            {header('Wealth', 'wealth', true)}
            {header('Police', 'police', true)}
            <th className="num">Fronts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const def = territoryDef(t.id);
            const level = controlLevel(t);
            const rivals = readRivals(state, t);
            return (
              <tr
                key={t.id}
                className={t.id === selectedId ? 'clickable selected' : 'clickable'}
                onClick={() => onSelect(t.id)}
              >
                <td className="name-main">{def.name}</td>
                <td className={level === 'none' ? 'faint' : 'brass'}>
                  {CONTROL_LABEL[level]}
                  {isContested(t) && <span className="hot"> · contested</span>}
                </td>
                <td className="num mono">{Math.round(playerInfluence(t)) || '—'}</td>
                <td className="dim">
                  {rivals.length === 0
                    ? '—'
                    : rivals.map((r) => (
                        <span key={r.faction} style={{ color: r.colour, marginRight: 8 }}>
                          {r.name} {r.band}
                        </span>
                      ))}
                </td>
                <td className="num mono">
                  {Math.round(prosperity(state, t.id))}
                  <Drift now={prosperity(state, t.id)} was={foundingWealth(t)} />
                </td>
                <td className="num mono">{def.policePresence}</td>
                <td className="num mono">
                  {usedSlots(state, t)}/{businessSlots(t)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DistrictDetail({
  territory,
  onClose,
}: {
  territory: Territory;
  onClose: () => void;
}) {
  const state = useGame();
  const def = territoryDef(territory.id);
  const level = controlLevel(territory);
  const rivals = readRivals(state, territory);
  const businesses = territory.businessIds
    .map((id) => state.businesses[id])
    .filter((b) => b && b.status === 'operating');

  return (
    <Panel
      title={def.name}
      action={
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      }
    >
      <p className="dim" style={{ marginTop: 0 }}>
        {def.blurb}
      </p>

      <div className="grid-2">
        <div>
          <div className="row between" style={{ marginBottom: 4 }}>
            <span className="tiny">Your influence</span>
            <span className="mono brass">{Math.round(playerInfluence(territory))}</span>
          </div>
          <Bar value={playerInfluence(territory)} />
          <p className="faint" style={{ marginTop: 6 }}>
            {CONTROL_LABEL[level]}
            {isContested(territory) && ' — and somebody is pushing back'}
          </p>

          <div style={{ marginTop: 12 }}>
            <div className="tiny" style={{ marginBottom: 6 }}>
              Who else is working here
            </div>
            {rivals.length === 0 ? (
              <p className="faint" style={{ margin: 0 }}>
                Nobody you can detect.
              </p>
            ) : (
              rivals.map((r) => (
                <div className="kv" key={r.faction}>
                  <span className="kv-key" style={{ color: r.colour }}>
                    {houseName(state, r.faction)}
                  </span>
                  <span className="kv-val">{r.band}</span>
                </div>
              ))
            )}
            {playerInfluence(territory) < 25 && rivals.length > 0 && (
              <p className="faint tiny" style={{ marginTop: 6, marginBottom: 0 }}>
                Work the district more and you will read it more precisely.
              </p>
            )}
          </div>
        </div>

        <div>
          {/*
            Both figures are live, and both are shown against where the district
            stood on day one. That comparison is the entire readout: a number on
            its own says nothing about whether this place is being cultivated or
            eaten.
          */}
          <KeyValue
            label="Prosperity"
            value={
              <>
                {Math.round(prosperity(state, territory.id))}
                <Drift now={prosperity(state, territory.id)} was={foundingWealth(territory)} />
              </>
            }
          />
          <KeyValue label="Police presence" value={def.policePresence} tone="hot" />
          <KeyValue
            label="Population"
            value={
              <>
                {Math.round(people(state, territory.id)).toLocaleString('en-US')}
                <Drift now={people(state, territory.id)} was={foundingPeople(territory)} />
              </>
            }
          />
          <KeyValue label="Strategic value" value={def.strategicValue} />
          {/*
            The number that quietly decides whether you have a legitimate side.

            Below `SENTIMENT_HOSTILE_BELOW` nobody in the district will sell you
            a front, at any price. A round-7 tester watched this fall 45 → 5,
            was refused every business in Little Sicily for ninety days, and
            never learned that this was the reason — the row was a bare integer
            with no label and no log line ever mentioned it moving.
          */}
          <KeyValue
            label="Public feeling"
            value={Math.round(territory.sentiment)}
            tone={territory.sentiment < SENTIMENT_HOSTILE_BELOW ? 'hot' : undefined}
            title={
              territory.sentiment < SENTIMENT_HOSTILE_BELOW
                ? `Below ${SENTIMENT_HOSTILE_BELOW}, nobody here will sell you a business at any price. ` +
                  `Violence and hard trade push it down; leaving the district alone lets it recover.`
                : `How the neighbourhood feels about you. Below ${SENTIMENT_HOSTILE_BELOW} nobody here ` +
                  `will sell you a business. Violence and hard trade push it down.`
            }
          />
          <KeyValue
            label="Business slots"
            value={`${usedSlots(state, territory)} of ${businessSlots(territory)}`}
          />
          <KeyValue label="Next to" value={def.adjacent.map((a) => territoryDef(a).name).join(', ')} />
        </div>
      </div>

      <Steward territory={territory} />

      {businesses.length > 0 && (
        <>
          <div className="tiny" style={{ margin: '16px 0 6px' }}>
            Your fronts here
          </div>
          {businesses.map((b) => (
            <div className="kv" key={b.id}>
              <span className="kv-key">{businessDef(b).name}</span>
              <span className={b.exposure > 50 ? 'kv-val hot' : 'kv-val'}>
                exposure {Math.round(b.exposure)}
              </span>
            </div>
          ))}
        </>
      )}
    </Panel>
  );
}


/**
 * Who holds this district, and the record you read him from.
 *
 * There is no score here and no reason given, and that is the whole design.
 * What a man does with authority is the only honest evidence of what he is,
 * and two of the six things he can do write the identical line — so the page
 * has to be read as a column of claims against a column of figures rather than
 * as a confession.
 */
function Steward({ territory }: { territory: Territory }) {
  const state = useGame();
  const [message, setMessage] = useState<string | null>(null);
  const held = stewardOf(state, territory);
  const ledger = readLedger(territory);
  const average = averageTake(territory);
  const candidates = eligibleStewards(state);

  /*
     What this place is actually for, and what stands between you and it.

     The complaint this whole rework came from was that the territory screen
     "just tells you what and who" — twelve districts that were mechanically
     one object, some slots and a discount on heat, differing only in how much
     a job pays. Every blurb in `config/territories.ts` had been saying what
     its place was for since the day it was written and nothing read them.

     So this says the thing, and then says which of the two conditions you are
     failing. A refusal that does not name the number doing the refusing is the
     F10 failure this project has already paid for once.
  */
  const gives = yieldRead(territory.id);
  const level = controlLevel(territory);
  const controlled = level === 'control' || level === 'dominance';

  return (
    <>
      {gives && (
        <>
          <div className="tiny" style={{ margin: '16px 0 6px' }}>
            What it is for
          </div>
          <div className="kv">
            <span className="kv-key">
              <span className="name-main">{gives.label}</span>{' '}
              <span className="faint tiny">{gives.blurb}</span>
            </span>
            <span className={controlled && held ? 'kv-val ok' : 'kv-val faint'}>
              {controlled && held
                ? 'yours'
                : !controlled
                  ? `needs control — you have ${CONTROL_LABEL[level]}`
                  : 'needs somebody running it'}
            </span>
          </div>
        </>
      )}

      <div className="tiny" style={{ margin: '16px 0 6px' }}>
        Who runs it
      </div>

      {held ? (
        <>
          <div className="kv">
            <span className="kv-key">{held.name}</span>
            <span className="kv-val">
              {territory.stewardSince != null
                ? `since ${formatShortDay(territory.stewardSince)}`
                : ''}
            </span>
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button
              className="btn small danger"
              title="They will hear about it the same day everybody else does."
              onClick={() => {
                const result = mutate((s) => takeItBack(s, territory.id), true);
                if (result && !result.ok) setMessage(result.message);
              }}
            >
              Take it back
            </button>
          </div>

          {ledger.length > 0 ? (
            <>
              <div className="row between" style={{ margin: '14px 0 4px' }}>
                <span className="tiny">What they have been doing</span>
                <span className="tiny">
                  {average !== null ? `${formatMoney(average)} a week, on average` : ''}
                </span>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    {ledger.map((line, i) => (
                      <tr key={i}>
                        <td className="mono faint">{formatShortDay(line.day)}</td>
                        <td className="name-main">{line.label}</td>
                        <td className="dim">{line.note}</td>
                        <td className="num mono">{formatMoney(line.earned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="faint" style={{ marginTop: 10, marginBottom: 0 }}>
              They have not had a week here yet.
            </p>
          )}
        </>
      ) : (
        <>
          {/*
             What it is worth, said before the decision rather than after it.

             A blind playtester never handed a district over across a hundred
             and seventy-nine days. Nothing on this screen said what one was
             worth, so putting a man on it read as taking a body off the job
             board for nothing — which is backwards. A steward is the only
             income in this game that does not occupy somebody you could have
             sent out, and it is the only reason an organization earns more
             than it costs to keep as it grows.
          */}
          <p className="dim" style={{ marginTop: 0 }}>
            You run this one yourself, which means it only moves when you are looking at it.
            A hand on it would be worth about {formatMoney(districtWorth(territory))} a week,
            give or take, and would keep your name here while you are elsewhere.
          </p>
          {candidates.length === 0 ? (
            <p className="faint" style={{ marginBottom: 0 }}>
              Nobody senior enough to hand it to.
            </p>
          ) : (
            <div className="btn-row">
              {candidates.slice(0, 6).map((npc) => {
                const check = canPutInCharge(state, npc.id, territory.id);
                return (
                  <button
                    key={npc.id}
                    className="btn small"
                    disabled={!check.ok}
                    title={check.message}
                    onClick={() => {
                      const result = mutate(
                        (s) => putInCharge(s, npc.id, territory.id),
                        true,
                      );
                      if (result && !result.ok) setMessage(result.message);
                    }}
                  >
                    {npc.name}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {message && (
        <p className="dim" style={{ marginTop: 8, marginBottom: 0 }}>
          {message}
        </p>
      )}
    </>
  );
}
