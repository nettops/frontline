import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { readLedger, ledgerWeeks, unexplained } from '../../sim/ledger';
import { LEDGER, LEDGER_LABEL } from '../../config/ledger';
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
import { SHUTTER_REFUND_SHARE } from '../../config/businesses';
import { atWar, relationship } from '../../sim/diplomacy';
import { rivals } from '../../sim/faction';
import type { FactionId } from '../../config/factions';
import type { GameState } from '../../sim/types';
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
import {
  canRetireToFlorida,
  floridaState,
  retireToFlorida,
  siphonToFlorida,
} from '../../sim/florida';
import { FLORIDA } from '../../config/florida';

/** What a single move puts aside. One figure, two buttons, so the two pools read alike. */
const SIPHON_STEP = 10_000;

/**
 * The account the organization cannot follow.
 *
 * Everything else on this page is money for spending on the family. This is
 * the opposite — it leaves the wallet, leaves what rank counts, and never
 * comes back — so it gets its own panel rather than a row beside Holdings,
 * which is the reversible version of the same idea and would be read as one.
 *
 * Both meters are printed because the trap only exists if the player can see
 * both halves of it: the nest egg is what the plan is worth, and suspicion is
 * what the plan costs, and the second one is paid to the exact people whose
 * grievance already decides whether there is a coup this week.
 */
function Florida() {
  const state = useGame();
  const fl = floridaState(state);
  const leaving = canRetireToFlorida(state);
  const over = fl.suspicion >= FLORIDA.coupRiskSuspicionThreshold;

  return (
    <Panel title="Down there">
      <KeyValue
        label="Put somewhere else"
        value={`${formatMoney(fl.nestEgg)} of ${formatMoney(FLORIDA.targetNestEgg)}`}
        tone="brass"
      />
      <div style={{ margin: '4px 14px 8px' }}>
        <Bar value={fl.nestEgg} max={FLORIDA.targetNestEgg} />
      </div>
      <KeyValue
        label="What the room has worked out"
        value={`${Math.round(fl.suspicion)} of 100`}
        tone={over ? 'hot' : undefined}
      />
      <div style={{ margin: '4px 14px 8px' }}>
        <Bar value={fl.suspicion} max={100} tone="hot" />
      </div>
      <p className={over ? 'hot tiny' : 'faint tiny'} style={{ margin: '0 14px 10px' }}>
        {fl.suspicion >= FLORIDA.mutinyThreshold
          ? 'They have stopped waiting for a reason. The next thing that happens at that table happens to you.'
          : over
            ? `Past ${FLORIDA.coupRiskSuspicionThreshold} they have worked out what the light weeks are about. A coup is twice as likely every week, and every week over the bar puts ${FLORIDA.grievancePerWeekOverThreshold} more grievance on every capo you have. At ${FLORIDA.mutinyThreshold} they stop waiting.`
            : `A coup gets twice as likely past ${FLORIDA.coupRiskSuspicionThreshold}, and past ${FLORIDA.mutinyThreshold} they do not wait for the roll. It comes down about ${FLORIDA.suspicionDecayWeekly} a quiet week.`}
      </p>
      <p className="faint tiny" style={{ margin: '0 0 8px' }}>
        Money that goes down there stops being the family's and stops being yours to spend. It
        does not count toward what you are worth and there is no way to bring it back.
      </p>
      <div className="btn-row">
        <button
          className="btn small"
          disabled={state.org.cash < SIPHON_STEP}
          title="Clean money. An account like that does not take the other kind without somebody asking."
          onClick={() => mutate((s) => siphonToFlorida(s, SIPHON_STEP, true), true)}
        >
          Move {formatMoney(SIPHON_STEP)} clean
        </button>
        <button
          className="btn small danger"
          disabled={totalFunds(state) < SIPHON_STEP}
          title="Out of the pile. It is the cheap way and it leaves the loudest hole."
          onClick={() => mutate((s) => siphonToFlorida(s, SIPHON_STEP, false), true)}
        >
          Move {formatMoney(SIPHON_STEP)} out of the pile
        </button>
        <button
          className="btn small primary"
          disabled={!leaving.ok}
          title="A Tuesday, and a flight, and nobody told."
          onClick={() => mutate((s) => retireToFlorida(s), true)}
        >
          Go
        </button>
      </div>
      <p className={leaving.ok ? 'brass tiny' : 'faint tiny'} style={{ margin: '8px 0 0' }}>
        {leaving.message}
      </p>
      {state.org.cash < SIPHON_STEP && totalFunds(state) >= SIPHON_STEP && (
        <p className="faint tiny" style={{ margin: '4px 0 0' }}>
          You hold {formatMoney(state.org.cash)} clean, which is not {formatMoney(SIPHON_STEP)}.
          The pile will cover it and the pile is the loud way.
        </p>
      )}
      {totalFunds(state) < SIPHON_STEP && (
        <p className="faint tiny" style={{ margin: '4px 0 0' }}>
          Moving {formatMoney(SIPHON_STEP)} takes {formatMoney(SIPHON_STEP)}, and you have{' '}
          {formatMoney(totalFunds(state))} in the place.
        </p>
      )}
    </Panel>
  );
}

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
      {/*
         Round 29 read this as money that was locked away full stop, and the
         Businesses panel as contradicting it — the sentence naming the one
         exception was the fourth in the paragraph, after three that said
         nothing can reach it. The exception goes first now. Same facts, and
         the order is what was lying.
      */}
      <p className="faint" style={{ marginTop: 12 }}>
        Property, a stake in something, a box at a bank. Put away for standing: no wage, no
        lawyer and no day's work can touch it, but it remains available as capital for a
        business front — a front is the same kind of money standing up, so it comes straight
        out of here and does not pay the hurry price. The people whose opinion decides your
        rank can see all of it. Selling in a hurry returns{' '}
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

/**
 * The ways out of an empty safe that this state actually has.
 *
 * Every line is conditional on the thing it names being reachable right now,
 * which is the fourth rule applied to advice rather than to a button: telling
 * a boss with no fronts to sell a front is a control that takes a click and
 * does nothing, one step removed.
 *
 * The last line has no condition because it has no requirement — a corner and
 * a pawnbroker are open to a man with nothing, which is the point of it.
 */
function exits(state: GameState): string[] {
  const lines: string[] = [];
  if (ownedBusinesses(state).length > 0) {
    lines.push(
      `Liquidate fronts: selling an underperforming business in Businesses returns ` +
        `${Math.round(SHUTTER_REFUND_SHARE * 100)}% of what you paid for it and clears its ` +
        `weekly upkeep.`,
    );
  }
  /*
     `friendlyFactionId` is null deliberately. The shark lends against
     violence rather than obligation, so the field is not read on this path,
     and computing the friendliest house here would duplicate `Credit`'s own
     sort for a lender that does not use it.
  */
  if (canBorrow(state, 'shark', {
    respect: state.org.respect,
    businesses: ownedBusinesses(state).length,
    friendlyFactionId: null,
  }).ok) {
    lines.push(`Emergency credit: the man on Delacroix will advance cash from $500 today.`);
  }
  lines.push(`Sell personal luxuries in Yourself, or work a street corner yourself.`);
  return lines;
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

      {/*
         The shortfall paragraph in Outgoings is correct and it is four panels
         down a long page, inside the one panel a player who is not already
         worried about payroll has no reason to open. Round 29 went insolvent
         mid-career, never found it, and lost crew to defection without ever
         reading a line that named the three ways out. This is the same fact
         at the top of the page, and it names them.

         Gated on the wallet being under a payday's wages *and* genuinely
         empty, so it is a state rather than a banner that lives here: a
         family carrying a healthy float through a heavy week does not need
         to be shouted at.
      */}
      {totalFunds(state) < weeklyWageBill(state) && totalFunds(state) < 1_000 && (
        <aside className="coach urgent">
          <span className="coach-label">Payroll</span>
          <span className="coach-text">
            There is not enough on hand to reach the next payday.{' '}
            {/*
               Named exits, not a category.

               The previous copy said "sell an underperforming front", and
               round 29 held four fronts, respect over a hundred, and reported
               not knowing a front could be sold at all — a banner that names
               a door without saying it opens is the fourth rule with better
               manners. Each line below is stated only when the state actually
               allows it, so nothing here can send a broke boss at a control
               that will refuse him.
            */}
            {exits(state).join(' ')} Do one of them before your own people start leaving
            unpaid.
          </span>
        </aside>
      )}

      <SilentPartner />

      <Ledger />

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
              label="Put away (capital for fronts only)"
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
      <Florida />

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
  const minAmount = def.id === 'shark' ? 500 : Math.round(ceiling * 0.1);
  const [amount, setAmount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  /*
     Opens on the least he can take.

     Half the ceiling was the default, so a boss holding $2,500 was one click
     from a $20,000 loan at the shark's rate. The slider is still there for
     anybody who wants more; what it should not do is choose for him.
  */
  const asking = amount || minAmount;
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
          {/*
            The shark alone starts at $500, in steps of $250.

            A tenth of the ceiling is a sensible floor for a bank, which lends
            against something. It was $4,000 here, which priced the one lender
            with no requirements at all out of reach of exactly the boss who
            needs him — round 29 spent two stretches under $500 and asked for
            "one cheap recovery lever (small loan, ...)" by name. `dueOn` in
            `sim/market.ts` scales the weekly collection to match, so a small
            advance is a small repayment rather than $350 a week.
          */}
          <input
            type="range"
            min={minAmount}
            max={ceiling}
            step={def.id === 'shark' ? 250 : 500}
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

/**
 * The book. Where it came from, where it went, and what nothing could explain.
 *
 * Built because answering "the trade earns a fortune and I am not getting
 * richer" took a probe and four attempts, and a player has neither. Two
 * columns — the last twelve weeks, and the whole career — because a family
 * that is bleeding this quarter and rich overall is a different problem from
 * one that has never made anything.
 *
 * The last row is the one to read first. Categories are attached at call sites
 * and money moves through more of them than any one pass labels, so whatever
 * was not recognised is reconciled against the real balance every week and
 * shown. A book that quietly omitted what it did not understand would be worse
 * than no book at all.
 */
function Ledger() {
  const state = useGame();
  const rows = readLedger(state, 12);
  const weeks = ledgerWeeks(state);
  const odd = unexplained(state, 12);
  const by = (key: string) => rows.find((r) => r.key === key)!;

  const sum = (keys: readonly string[], pick: 'recent' | 'lifetime') =>
    keys.reduce((total, k) => total + by(k)[pick], 0);
  const inRecent = sum(LEDGER.income, 'recent');
  const outRecent = sum(LEDGER.outgoings, 'recent');
  const inLife = sum(LEDGER.income, 'lifetime');
  const outLife = sum(LEDGER.outgoings, 'lifetime');

  if (weeks.length === 0) {
    return (
      <Panel title="The book">
        <Empty>
          Nothing is written down yet. The first week closes on the next payday.
        </Empty>
      </Panel>
    );
  }

  const money = (n: number) => (n < 0 ? `-${formatMoney(-n)}` : formatMoney(n));
  const tone = (n: number) => (n > 0 ? 'good' : n < 0 ? 'hot' : 'faint');

  return (
    <Panel
      title="The book"
      action={<span className="tiny">{weeks.length} weeks kept</span>}
    >
      <table className="table">
        <thead>
          <tr>
            <th>Where it moved</th>
            <th className="num">Last 12 weeks</th>
            <th className="num">The whole run</th>
          </tr>
        </thead>
        <tbody>
          {[...LEDGER.income, ...LEDGER.outgoings].map((key) => {
            const row = by(key);
            if (row.lifetime === 0 && row.recent === 0) return null;
            return (
              <tr key={key}>
                <td>
                  <div className="name-cell">
                    <span className="name-main">{LEDGER_LABEL[key].name}</span>
                    <span className="name-sub">{LEDGER_LABEL[key].blurb}</span>
                  </div>
                </td>
                <td className={`num mono ${tone(row.recent)}`}>{money(row.recent)}</td>
                <td className={`num mono ${tone(row.lifetime)}`}>{money(row.lifetime)}</td>
              </tr>
            );
          })}
          <tr>
            <td>
              <span className="name-main">Everything in</span>
            </td>
            <td className="num mono good">{money(inRecent)}</td>
            <td className="num mono good">{money(inLife)}</td>
          </tr>
          <tr>
            <td>
              <span className="name-main">Everything out</span>
            </td>
            <td className="num mono hot">{money(outRecent)}</td>
            <td className="num mono hot">{money(outLife)}</td>
          </tr>
          <tr>
            <td>
              <div className="name-cell">
                <span className="name-main brass">What you kept</span>
                <span className="name-sub">
                  In, less out. Not the same as what the family is worth — see Put away.
                </span>
              </div>
            </td>
            <td className={`num mono ${tone(inRecent + outRecent)}`}>
              {money(inRecent + outRecent)}
            </td>
            <td className={`num mono ${tone(inLife + outLife)}`}>{money(inLife + outLife)}</td>
          </tr>
          {(odd.recent !== 0 || odd.lifetime !== 0) && (
            <tr>
              <td>
                <div className="name-cell">
                  <span className="name-main faint">Nobody wrote it down</span>
                  <span className="name-sub">
                    Money that moved without a name on it. The book says so rather than
                    quietly balancing itself.
                  </span>
                </div>
              </td>
              <td className="num mono faint">{money(odd.recent)}</td>
              <td className="num mono faint">{money(odd.lifetime)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}
