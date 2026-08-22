import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, KeyValue } from '../components';
import {
  activeCases,
  buyContact,
  footprint,
  canBuyContact,
  contactCost,
  hasContact,
  retainLawyer,
  legalCostAt,
  weeklyLegalCost,
} from '../../sim/investigation';
import { accuse, canAccuse, readLeaks, timesPresent } from '../../sim/informants';
import { formatMoney, formatShortDay } from '../../sim/util';
import { AGENCIES, LAWYERS, CONTACT } from '../../config/lawEnforcement';

export default function IntelligencePanel() {
  const state = useGame();
  const [message, setMessage] = useState<string | null>(null);
  const [accusing, setAccusing] = useState<string | null>(null);
  const open = activeCases(state);
  const leaks = readLeaks(state);
  const present = timesPresent(state);
  const size = footprint(state);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Intelligence</h1>
        <span className="tiny">{formatMoney(weeklyLegalCost(state))} / week in legal</span>
      </div>
      <p className="page-sub">
        Everything you can put between yourself and a case. Counsel slows them down
        and lets you see what gets filed. Somebody inside tells you what the file
        actually says — and is a person who knows you are paying them.
      </p>

      <Panel title="Representation">
        <div className="choice-list">
          {LAWYERS.map((lawyer) => (
            <button
              key={lawyer.level}
              className={state.law.lawyer === lawyer.level ? 'choice selected' : 'choice'}
              onClick={() => {
                mutate((s) => retainLawyer(s, lawyer.level), true);
                setMessage(null);
              }}
            >
              <div className="row between">
                <span className="choice-name">{lawyer.name}</span>
                {/*
                  The price, not the multiplier. "×2.6 retainer" told a player
                  nothing they could budget against, and the only figure on the
                  page was the total for whichever tier was already retained —
                  so round 11 chose one at $381 a week and was billed $1,058 for
                  it later. The bill scales with the cases open; the quote now
                  scales with them too.
                */}
                <span className="mono brass">
                  {lawyer.costMultiplier === 0
                    ? 'free'
                    : `${formatMoney(legalCostAt(state, lawyer.level))} / week now`}
                </span>
              </div>
              <div className="choice-blurb">{lawyer.blurb}</div>
              {lawyer.level !== 'none' && (
                <div className="choice-blurb">
                  Cases build {Math.round((1 - lawyer.evidenceMultiplier) * 100)}% slower ·{' '}
                  {Math.round(lawyer.trialBonus * 100)}% better at trial
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="faint tiny" style={{ marginTop: 10, marginBottom: 0 }}>
          Billed weekly with wages, and paid first. Miss it and your counsel withdraws.
        </p>
      </Panel>

      <Panel title="People on the inside" flush>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Agency</th>
                <th>Needs</th>
                <th className="num">Cost</th>
                <th className="num">Weekly</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {AGENCIES.map((agency) => {
                const has = hasContact(state, agency.id);
                const burned = state.law.contacts[agency.id]?.burned;
                const check = canBuyContact(state, agency.id);
                const cost = contactCost(state, agency.id);
                const investigating = open.some((c) => c.agencyId === agency.id);
                return (
                  <tr key={agency.id}>
                    <td>
                      <div className="name-cell">
                        <span className={investigating ? 'name-main hot' : 'name-main'}>
                          {agency.shortName}
                        </span>
                        <span className="name-sub">
                          {investigating ? 'working a case on you' : 'quiet'}
                        </span>
                      </div>
                    </td>
                    <td className="dim">
                      {agency.contactInfluenceRequired > 0
                        ? `Influence ${agency.contactInfluenceRequired}`
                        : '—'}
                    </td>
                    <td className="num mono">{formatMoney(cost)}</td>
                    <td className="num mono">
                      {formatMoney(Math.round(agency.contactCost * CONTACT.upkeepShare))}
                    </td>
                    <td className={has ? 'good' : burned ? 'hot' : 'faint'}>
                      {has
                        ? `since ${formatShortDay(state.law.contacts[agency.id].since)}`
                        : burned
                          ? 'burned'
                          : 'nobody'}
                    </td>
                    <td>
                      <button
                        className="btn small"
                        disabled={!check.ok}
                        title={check.message}
                        onClick={() => {
                          const result = mutate((s) => buyContact(s, agency.id), true);
                          if (result) setMessage(result.message);
                        }}
                      >
                        Turn somebody
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {message && (
        <p className="dim" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}

      {leaks.length > 0 && (
        <Panel title="What they turned out to know" flush>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>The night</th>
                  <th>Who was on it</th>
                </tr>
              </thead>
              <tbody>
                {leaks.map((leak, i) => (
                  <tr key={i}>
                    <td className="faint mono">{formatShortDay(leak.day)}</td>
                    <td>
                      <div className="name-cell">
                        <span className="name-main">{leak.opName}</span>
                        <span className="name-sub">{leak.district}</span>
                      </div>
                    </td>
                    <td className="dim">{leak.who.map((w) => w.name).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint tiny" style={{ margin: '10px 12px 0' }}>
            Nights a case turned out to have in detail. Some of it is somebody talking.
            Some of it is four men in a car for eleven weeks. Nothing here says which.
          </p>
        </Panel>
      )}

      {present.length > 0 && (
        <Panel title="Who was there" flush>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">On these nights</th>
                  <th className="num">Nights worked</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {present.map((row) => {
                  const check = canAccuse(state, row.id);
                  return (
                    <tr key={row.id}>
                      <td className="name-main">{row.name}</td>
                      <td className="num mono hot">{row.leaks}</td>
                      <td className="num mono dim">{row.jobs}</td>
                      <td>
                        {accusing === row.id ? (
                          <button
                            className="btn small danger"
                            onClick={() => {
                              const result = mutate((s) => accuse(s, row.id), true);
                              if (result) setMessage(result.message);
                              setAccusing(null);
                            }}
                          >
                            Then it was them
                          </button>
                        ) : (
                          <button
                            className="btn small"
                            disabled={!check.ok}
                            title={check.message}
                            onClick={() => setAccusing(row.id)}
                          >
                            Decide it was them
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/*
             Two counts and no third number.

             The comparison between the columns is the whole read and the game
             does not make it — no share, no percentage, no ordering by anything
             but the raw leak count, and no opinion about what any of it means.
             The trap is deliberate: the man who works the most nights is on the
             most of these whether or not he has said a word.
          */}
          <p className="faint tiny" style={{ margin: '10px 12px 0' }}>
            There is no way to be sure, and no smaller version of the decision. A man
            you are wrong about is a man you have lost, in front of everybody, for
            nothing — and you will not be told which one you did.
          </p>
        </Panel>
      )}

      <Panel title="Who takes an interest in you">
        <p className="dim" style={{ marginTop: 0 }}>
          Agencies investigate organizations proportionate to themselves, and what they
          can see of yours is bodies, ground, fronts, and how thick the folder already
          is. Not your standing — nobody at a federal desk has heard of your standing.
        </p>
        {AGENCIES.map((agency) => (
          <div className="kv" key={agency.id}>
            <span className="kv-key">{agency.name}</span>
            <span className="kv-val faint">
              {agency.noticesAbove > 0 ? `size ${agency.noticesAbove}+ · ` : ''}heat{' '}
              {agency.heatFloor}+
            </span>
          </div>
        ))}
        <KeyValue
          label="How big you look"
          value={Math.round(size).toString()}
          tone="brass"
        />
        <p className="faint tiny" style={{ marginTop: 10, marginBottom: 0 }}>
          A contact costs {Math.round(CONTACT.upkeepShare * 100)}% of the turning fee
          every week, and roughly a one-in-eighty chance each week of being found out.
        </p>
      </Panel>
    </>
  );
}
