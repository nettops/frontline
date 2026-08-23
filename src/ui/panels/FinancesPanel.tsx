import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, Empty, KeyValue, Bar } from '../components';
import {
  payrollForecast,
  putAway,
  spend,
  takeBack,
  totalFunds,
  weeklyWageBill,
} from '../../sim/economy';
import { HOLDINGS } from '../../config/economy';
import { estate } from '../../sim/estate';
import { crewList } from '../../sim/npc';
import { ownedBusinesses } from '../../sim/business';
import { atWar, relationship } from '../../sim/diplomacy';
import { rivals } from '../../sim/faction';
import type { FactionId } from '../../config/factions';
import {
  borrow,
  canBorrow,
  lenderCeiling,
  lenderRate,
  loans,
  phase,
  prices,
  quoteLoan,
  repay,
  totalOwed,
  weeklyRepayment,
  type BorrowerFacts,
} from '../../sim/market';
import { formatMoney, formatShortDay } from '../../sim/util';
import { OPERATION_BY_ID } from '../../config/operations';
import { LENDERS, LENDER_BY_ID } from '../../config/market';
import { PARTNER } from '../../config/partner';
import {
  buyOutPartner,
  buyOutPrice,
  partnerHouse,
  partnerOffer,
  partnerOutstanding,
  takePartner,
} from '../../sim/partner';
import { houseName } from '../../sim/houses';

/**
 * Money you have decided not to be able to spend.
 *
 * Clean cash is what rank is gated on and it is also the pool every cost falls
 * back on once dirty runs out — so the balance a boss needs for the table was
 * being spent on the next job before it could ever become a balance. Measured
 * over 36 four-year careers: $195,807 of clean money earned, $45,000 needed in
 * one place for Capo, and a peak of $30,450.
 *
 * The answer is not to protect it. Money nobody can spend is not a decision.
 * The answer is a place to put it on purpose, where it still counts for
 * standing and pays for nothing — so holding your Capo money is the same
 * choice as not retaining the lawyer, and taking it back costs what selling in
 * a hurry costs.
 */
function Holdings() {
  const state = useGame();
  const held = state.org.holdings ?? 0;
  const [amount, setAmount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const most = Math.floor(state.org.cash);
  // Half of what is in the wallet, the same default the loan form uses.
  // Starting at the minimum meant dragging from $1,000 on a balance of
  // $900,000, which is a slider nobody can use.
  const asking = Math.min(amount || Math.max(HOLDINGS.minimum, Math.floor(most / 2)), most);
  const backIf = Math.floor(held * HOLDINGS.withdrawReturn);

  return (
    <Panel title="Put away">
      <KeyValue label="Held" value={formatMoney(held)} tone="brass" />
      {/*
        The whole estate, not just the money, because that is what rank reads.

        `cleanWorth` was the wallet plus what was put away, which stopped being
        the figure that matters the day standing started counting fronts and
        ground. Showing the smaller number here would quietly tell the player
        their businesses do not count.
      */}
      <KeyValue label="The family is worth" value={formatMoney(estate(state).total)} />
      {held > 0 && (
        <KeyValue
          label="Earning, each week"
          value={formatMoney(Math.round(held * HOLDINGS.yieldPerWeek))}
          tone="brass"
        />
      )}
      <p className="faint" style={{ marginTop: 12 }}>
        Property, a stake in something, a box at a bank. The people whose opinion
        decides your rank can see it. No job, no wage and no lawyer can touch it.
        The one thing it will pay for is a front, because a front is the same
        kind of money standing up — that comes straight out of here and does not
        pay the hurry price. Selling in a hurry returns{' '}
        {Math.round(HOLDINGS.withdrawReturn * 100)}% of it.
      </p>
      {/*
        The yield had no way of being noticed, which made it a secret.

        It is the only money in the game that arrives whether or not you are
        alive, free, or working that week, and a player who never reads a config
        file had nothing telling them so. The line above shows this week's
        figure; this one says why it is there.
      */}
      <p className="faint" style={{ marginTop: 8 }}>
        It also earns while it sits there — about{' '}
        {/*
          `* 5200` is already the percentage — 0.0045 a week is 23.4 a year —
          and this then divided it by a hundred again, so the panel advertised
          0.23%. Round 9's tester read it, noticed it disagreed with the "each
          week" figure directly above it by two orders of magnitude, and said
          they had made an allocation decision on it.
        */}
        {Math.round(HOLDINGS.yieldPerWeek * 52000) / 10}% a year. It is the worst
        return in the city and the only one that keeps arriving while you are
        inside, laying low, or dead.
      </p>
      {most < HOLDINGS.minimum ? (
        <Empty>
          Nothing under {formatMoney(HOLDINGS.minimum)} is worth the paperwork.
        </Empty>
      ) : (
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <input
            type="range"
            min={HOLDINGS.minimum}
            max={most}
            value={asking}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <span className="mono brass">{formatMoney(asking)}</span>
          <button
            className="btn small"
            title="Moves it out of reach. It still counts toward the next rank."
            onClick={() => {
              const result = mutate((s) => putAway(s, asking), true);
              if (result) setMessage(result.message);
            }}
          >
            Put it away
          </button>
        </div>
      )}
      {held > 0 && (
        <div className="row" style={{ gap: 12, alignItems: 'center', marginTop: 10 }}>
          <span className="tiny faint">
            Selling all of it returns {formatMoney(backIf)}.
          </span>
          <button
            className="btn small"
            title={`${formatMoney(held)} of holdings, ${formatMoney(backIf)} back.`}
            onClick={() => {
              const result = mutate((s) => takeBack(s, held), true);
              if (result) setMessage(result.message);
            }}
          >
            Sell it back
          </button>
        </div>
      )}
      {message && (
        <p className="tiny faint" style={{ margin: '8px 0 0' }}>
          {message}
        </p>
      )}
    </Panel>
  );
}

export default function FinancesPanel() {
  const state = useGame();
  const { org } = state;
  const wages = weeklyWageBill(state);
  const history = state.operationHistory;
  const owed = totalOwed(state);
  const payroll = payrollForecast(state);
  // Round 13 made payroll on day 278 by selling the put-away pile back, and
  // said the shortfall warning never mentions it. These are for that line.
  const held = org.holdings ?? 0;
  const backIfSold = Math.floor(held * HOLDINGS.withdrawReturn);

  const earned = history.reduce((sum, r) => sum + r.payout, 0);
  const wins = history.filter((r) => r.success).length;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Finances</h1>
        <span className="tiny">{formatMoney(totalFunds(state))} on hand</span>
      </div>

      <SilentPartner />

      <div className="grid-2">
        <Panel title="Money">
          <KeyValue label="Clean" value={formatMoney(org.cash)} tone="brass" />
          <KeyValue label="Dirty" value={formatMoney(org.dirtyCash)} tone="good" />
          <KeyValue label="Total" value={formatMoney(totalFunds(state))} />
          {/*
            Below the total, not above it, and labelled so it cannot be added in.

            Clean, Dirty and Total read as a column that sums, and holdings do
            not belong in that sum — they are the one pool `totalFunds` cannot
            reach. Sitting between Dirty and Total it made the arithmetic look
            wrong by exactly the amount put away.
          */}
          {(org.holdings ?? 0) > 0 && (
            <KeyValue
              label="Put away, not spendable"
              value={formatMoney(org.holdings ?? 0)}
              tone="brass"
            />
          )}
          {owed > 0 && <KeyValue label="Owed" value={formatMoney(owed)} tone="hot" />}
          <p className="faint" style={{ marginTop: 12, marginBottom: 0 }}>
            Criminal work pays dirty, and dirty money is spent first — on jobs and on
            wages. There is nowhere legitimate to put it until you own businesses, so
            a large dirty pile is exposure sitting in a room, not savings.
            {prices(state) > 1.08 &&
              ` It is also worth ${Math.round((1 - 1 / prices(state)) * 100)}% less than the day it was earned. A pile does not keep.`}
          </p>
        </Panel>

        <Holdings />

        <Panel title="Outgoings">
          <KeyValue label="Weekly wages" value={formatMoney(wages)} tone="hot" />
          <KeyValue label="People on the books" value={crewList(state).length} />
          <KeyValue
            label="Next payday"
            value={`${payroll.daysAway} ${payroll.daysAway === 1 ? 'day' : 'days'}`}
          />
          {/* Counsel comes out of the same pot and is paid first, so "the bill"
              is not the wage bill. Read from the forecast rather than compared
              by hand here, so this panel and the overview cannot disagree. */}
          <KeyValue
            label="Due that day"
            value={formatMoney(payroll.due)}
            tone={payroll.shortfall > 0 ? 'hot' : undefined}
          />
          <KeyValue
            label="Covered?"
            value={payroll.shortfall > 0 ? `No — short ${formatMoney(payroll.shortfall)}` : 'Yes'}
            tone={payroll.shortfall > 0 ? 'hot' : 'good'}
          />
          {/* Back wages are a debt to your own people and come off the top of
              the next payday, so they belong on the books rather than only in
              the log line that created them. */}
          {(state.org.wagesOwed ?? 0) > 0 && (
            <KeyValue
              label="Owed to your people"
              value={formatMoney(state.org.wagesOwed ?? 0)}
              tone="hot"
            />
          )}
          {owed > 0 && (
            <KeyValue label="Repayments" value={formatMoney(weeklyRepayment(state))} tone="hot" />
          )}
          {payroll.shortfall > 0 && (
            <p className="hot" style={{ marginTop: 10, marginBottom: 0 }}>
              You cannot make payroll. Missing it costs loyalty across the whole
              organization and leaves grudges that take weeks to fade — and a second
              miss is how a crew comes apart. Finish a job, call one off, or borrow.
              {held > 0 &&
                ` Or sell what is put away — ${formatMoney(backIfSold)} of the ${formatMoney(held)} comes straight back.`}
            </p>
          )}
        </Panel>
      </div>

      <TheCycle />
      <Credit />

      <Panel
        title="Operation results"
        action={
          <span className="tiny">
            {wins}/{history.length} clean · {formatMoney(earned)} taken
          </span>
        }
        flush
      >
        {history.length === 0 ? (
          <Empty>No work has been completed yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Job</th>
                  <th>Outcome</th>
                  <th className="num">Paid</th>
                  <th className="num">Heat</th>
                  <th>What happened</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 60).map((result) => (
                  <tr key={result.id}>
                    <td className="mono faint">{formatShortDay(result.day)}</td>
                    <td>{OPERATION_BY_ID[result.defId]?.name ?? result.name}</td>
                    <td className={result.success ? 'good' : 'hot'}>
                      {result.success ? 'Clean' : 'Failed'}
                    </td>
                    <td className="num mono">
                      {result.payout ? formatMoney(result.payout) : '—'}
                    </td>
                    <td className="num mono">+{result.heat.toFixed(1)}</td>
                    <td className="dim">{result.consequence ?? '—'}</td>
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
 * The long economy, on four lines.
 *
 * Deliberately not a chart. The cycle moves over years and a player is on this
 * page for thirty seconds — what they need is which way it points and what that
 * does to the two things they can act on: borrowing, and holding.
 */
function TheCycle() {
  const state = useGame();
  const def = phase(state);
  const level = prices(state);

  return (
    <Panel title="The market" action={<span className="tiny">{def.name}</span>}>
      <p className="faint" style={{ marginTop: 0 }}>
        {def.summary}
      </p>
      <KeyValue
        label="Prices against year one"
        value={`${level.toFixed(2)}x`}
        tone={def.inflationPerYear > 0.02 ? 'hot' : 'good'}
      />
      <KeyValue
        label="What business is doing"
        value={`${def.activity >= 1 ? '+' : ''}${Math.round((def.activity - 1) * 100)}%`}
        tone={def.activity >= 1 ? 'good' : 'hot'}
      />
      <KeyValue label="Money costs" value={`${Math.round(def.baseRate * 100)}% a year`} />
      <p className="faint" style={{ marginBottom: 0 }}>
        Wages, payouts, front revenue and what the table expects of a Boss all move with
        prices, so none of that is a change you can feel. Cash in a room does not move
        with anything.
      </p>
    </Panel>
  );
}

/**
 * The other kind of money, and why it is a panel rather than a memo.
 *
 * This was an event first, and the event is what killed it: `dailyMemo` fills
 * one slot a day, the authored memos are what carry the pacing "firsts", and
 * a new definition costs one of them. `scorecard.probe` put Pacing at 2.5
 * against a bar of 3 with the mean longest quiet stretch out from 413 days to
 * 535. Four attempts to tune around it read 2.5, 2.6, 2.7, 2.8 — the shape of
 * noise, not of an effect.
 *
 * As a standing option beside the lenders it costs the memo table nothing. It
 * is also the discovery model this game already uses for credit, which round
 * 15 found on day 139 without any help from an interruption.
 *
 * Why it is not simply a fourth lender: a loan has to be **serviced**.
 * `REPAYMENT_SHARE` comes off every payday whether the week earned anything or
 * not, so borrowing while genuinely stalled buys three weeks and a collections
 * problem. Measured at day 300 across 24 careers that actually play, the
 * median holds $1,610 — that is who this is for, and a share of nothing is
 * nothing.
 */
function SilentPartner() {
  const state = useGame();
  const [note, setNote] = useState<string | null>(null);
  const held = state.org.partner;
  const offer = partnerOffer(state);

  if (!held && !offer) return null;

  if (held) {
    const price = buyOutPrice(state);
    const house = partnerHouse(state) ?? 'They';
    const affordable = totalFunds(state) >= price;
    return (
      <Panel title="The silent partner">
        <KeyValue label="Who" value={house} />
        <KeyValue label="Their share" value={`${Math.round(held.share * 100)}% of what comes in`} />
        <KeyValue label="Taken so far" value={formatMoney(Math.round(held.taken))} />
        <KeyValue label="Before it closes itself" value={formatMoney(Math.round(partnerOutstanding(state)))} />
        <p className="dim" style={{ marginBottom: 8 }}>
          Nothing is taken from a job under {formatMoney(PARTNER.takesNothingBelow)}. Buying them
          out ends it today for {formatMoney(price)}; waiting ends it at{' '}
          {formatMoney(Math.round(held.stake * PARTNER.endsAtMultiple))} taken.
        </p>
        <button
          className="btn"
          disabled={!affordable}
          onClick={() => mutate((s) => setNote(buyOutPartner(s) ? 'Bought out.' : 'Not enough.'))}
        >
          Buy them out — {formatMoney(price)}
        </button>
        {!affordable && (
          <div className="tiny memo-choice-blocked">
            You have {formatMoney(totalFunds(state))} and it costs {formatMoney(price)}.
          </div>
        )}
        {note && <p className="tiny">{note}</p>}
      </Panel>
    );
  }

  return (
    <Panel title="An offer">
      <p style={{ marginTop: 0 }}>
        {offer!.house} will put {formatMoney(offer!.stake)} into the organization today. They
        take {Math.round(offer!.share * 100)} cents in every dollar from then on — no schedule,
        no collection, nobody sent round. They simply own a piece.
      </p>
      <p className="dim">
        Nothing comes off a job under {formatMoney(PARTNER.takesNothingBelow)}. They stop at{' '}
        {formatMoney(Math.round(offer!.stake * PARTNER.endsAtMultiple))} taken, and you can buy
        them out earlier for {formatMoney(Math.round(offer!.stake * PARTNER.buyoutMultiple))}.
      </p>
      <button className="btn primary" onClick={() => mutate((s) => takePartner(s, offer!))}>
        Take the {formatMoney(offer!.stake)}
      </button>
    </Panel>
  );
}

/** Who will lend to you, and what they do about it when you cannot pay. */
function Credit() {
  const state = useGame();
  const open = loans(state);
  // Whoever thinks best of you is the one whose money it is. If nobody does,
  // that lender simply is not there — which is the point of the third option:
  // it is the cheapest downside in the game and the hardest to qualify for.
  const friendly = rivals(state)
    .filter((f) => !atWar(state, 'player', f.id) && relationship(state, f.id, 'player') > 25)
    .sort((a, b) => relationship(state, b.id, 'player') - relationship(state, a.id, 'player'))[0];
  const facts = {
    respect: state.org.respect,
    businesses: ownedBusinesses(state).length,
    friendlyFactionId: friendly?.id ?? null,
  };

  return (
    <Panel title="Credit" action={<span className="tiny">{open.length} open</span>}>
      {open.map((loan) => {
        const def = LENDER_BY_ID[loan.lenderId];
        const paid = 1 - loan.owed / Math.max(1, loan.principal * (1 + loan.rate));
        return (
          <div key={loan.id} style={{ marginBottom: 16 }}>
            <div className="row between">
              <span className={loan.missed > 0 ? 'hot' : ''}>{def.name}</span>
              <span className="mono">{formatMoney(loan.owed)}</span>
            </div>
            <Bar value={Math.max(0, paid * 100)} tone={loan.missed > 0 ? 'hot' : 'ok'} />
            <div className="row between" style={{ marginTop: 4 }}>
              <span className="tiny faint">
                {loan.missed > 0
                  ? `${loan.missed} payment${loan.missed === 1 ? '' : 's'} missed. They have noticed.`
                  : `Took ${formatMoney(loan.principal)} at ${Math.round(loan.rate * 100)}%`}
              </span>
              <button
                className="btn small"
                disabled={totalFunds(state) < loan.owed}
                title="Clear the whole thing now, out of whatever you have."
                onClick={() =>
                  mutate((s) => repay(s, loan.id, loan.owed, spend(s, loan.owed)), true)
                }
              >
                Settle it — {formatMoney(loan.owed)}
              </button>
            </div>
          </div>
        );
      })}

      {LENDERS.map((def) => (
        <Lender key={def.id} id={def.id} facts={facts} />
      ))}
    </Panel>
  );
}

function Lender({ id, facts }: { id: string; facts: BorrowerFacts }) {
  const state = useGame();
  const def = LENDER_BY_ID[id];
  const check = canBorrow(state, id, facts);
  const ceiling = lenderCeiling(state, def);
  const [amount, setAmount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const asking = amount || Math.round(ceiling / 2);
  const quote = quoteLoan(state, id, Math.min(asking, ceiling));
  const wages = weeklyWageBill(state);

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="row between">
        <span className={check.ok ? 'name-main brass' : 'name-main'}>
          {def.collateral === 'obligation' && facts.friendlyFactionId
            ? houseName(state, facts.friendlyFactionId as FactionId)
            : def.name}
        </span>
        <span className="tiny mono">{Math.round(lenderRate(state, def) * 100)}% a year</span>
      </div>
      <p className="name-sub" style={{ margin: '2px 0 6px' }}>
        {def.blurb}
      </p>
      {/* The terms are the choice being made here. The rate almost never is. */}
      <p className="tiny faint" style={{ margin: '0 0 8px' }}>
        {def.terms}
      </p>
      {!check.ok ? (
        <Empty>{check.message}</Empty>
      ) : (
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <input
            type="range"
            min={Math.round(ceiling * 0.1)}
            max={ceiling}
            value={Math.min(asking, ceiling)}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <span className="mono brass">{formatMoney(Math.min(asking, ceiling))}</span>
          <button
            className="btn small"
            title={
              quote
                ? `${formatMoney(quote.owed)} owed in total, ${formatMoney(quote.weekly)} out of every payday for up to ${quote.termWeeks} weeks.`
                : undefined
            }
            onClick={() => {
              const result = mutate(
                (s) => borrow(s, id, Math.min(asking, ceiling), facts.friendlyFactionId),
                true,
              );
              if (result) setMessage(result.message);
            }}
          >
            Take it
          </button>
        </div>
      )}
      {/*
        What you would actually be signing.

        The rate above is the one number nobody borrows on: the questions are
        what the whole thing costs and whether the week can carry it. Both used
        to be answerable only after the money had landed — and the repayment
        comes out of the same payday as the wages, which is the sentence that
        matters.
      */}
      {check.ok && quote && (
        <p className="tiny faint" style={{ margin: '8px 0 0' }}>
          {formatMoney(quote.owed)} owed in all · {formatMoney(quote.weekly)} a week for up to{' '}
          {quote.termWeeks} weeks
          {wages > 0 && (
            <>
              , on top of {formatMoney(wages)} of wages
              <span className={quote.weekly + wages > totalFunds(state) ? ' hot' : ''}>
                {quote.weekly + wages > totalFunds(state) ? ' — more than you hold today' : ''}
              </span>
            </>
          )}
        </p>
      )}
      {message && (
        <p className="dim" style={{ marginTop: 8 }}>
          {message}
        </p>
      )}
    </div>
  );
}
