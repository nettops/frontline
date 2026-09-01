import { rankNow, nextRank, whatItNeeds } from '../../sim/rank';
import { useGame, mutate } from '../../store';
import { buildRead, canSpendPoint, pointsLeft, spendPoint } from '../../sim/build';
import { nicknameRead } from '../../sim/nicknames';
import { BUILD, STAT_BY_ID } from '../../config/build';
import { Panel, Bar, KeyValue } from '../components';
import { estate } from '../../sim/estate';
import { careerShape, legitimacy } from '../../sim/legacy';
import { maxCrew } from '../../sim/player';
import { authorityRead } from '../../sim/authority';
import { canGoHome, goHome, homeRead } from '../../sim/personal';
import {
  possessionRows,
  sellPossession,
} from '../../sim/possessions';
import { controlledTerritories } from '../../sim/territory';
import { formatMoney } from '../../sim/util';
import { DIFFICULTY_BY_ID } from '../../config/difficulty';
import { PlayerPortrait } from '../PlayerPortrait';
import { KIT_NOTE } from '../art/playerLook';
import {
  POSSESSION,
} from '../../config/possessions';

/** So the sentence in the panel cannot drift away from the number. */
const POSSESSION_SELL_SHARE = POSSESSION.sellBackShare;

/**
 * The four things a family is worth, side by side.
 *
 * Rank stopped counting the wallet and started counting the estate, and a
 * player who cannot see the parts cannot see why buying a laundromat moved
 * their standing — or that `ground` is a column at all, which is the thing
 * measurement says nobody works out on their own. A career that spread across
 * districts reached Capo eleven times in thirty-six; one that stayed home
 * reached it once. Nothing on any screen said so.
 *
 * Deliberately shows the parts rather than one total. The total is already in
 * the advancement list above; what this adds is where it came from, and what
 * is missing.
 */
function Worth() {
  const state = useGame();
  const e = estate(state);
  const held = controlledTerritories(state).length;

  return (
    <Panel title="What the family is worth">
      {/*
        Named "clean" rather than "cash", because it is not all of the cash.

        `estate` leaves dirty money out on purpose — it is exposure sitting in a
        room rather than standing — but the row said "Cash to hand" beside a
        stat bar showing a dirty balance the player could plainly see, and a
        tester reported the two numbers disagreeing. The line at the foot of
        this panel now says why.
      */}
      <KeyValue label="Clean money to hand" value={formatMoney(e.cash)} />
      <KeyValue label="Put away" value={formatMoney(e.holdings)} tone="brass" />
      <KeyValue label="Fronts" value={formatMoney(e.fronts)} tone="brass" />
      {/*
         Yours, as against the organization's.

         Caught in the browser rather than by a test, and it is the ordinary
         shape of every defect this project keeps finding: buying a $1,800
         watch moved clean cash from $2,500 to $700 and left "In all" at
         $2,500, with no line anywhere saying where the money had gone. The
         arithmetic was right and the screen was lying by omission — which is
         the same complaint round 11 made about rank showing one figure here
         and another there.
      */}
      <KeyValue label="Yours" value={formatMoney(e.possessions)} tone="brass" />
      <KeyValue label="In all" value={formatMoney(e.total)} />
      {/*
        Districts are shown as a count, not as money, because that is how rank
        counts them — and because valuing them in the estate handed the game to
        whoever ran the most operations. See the note in `sim/estate.ts`.
      */}
      <KeyValue label="Districts held" value={String(held)} tone={held ? 'brass' : undefined} />
      <p className="faint" style={{ marginTop: 12, marginBottom: 0 }}>
        Standing is what you own, not what is in the drawer. A front counts for
        what it would fetch, in the condition it is in. Districts are counted on
        their own line, above. Dirty money is not here at all — a suitcase
        nobody can explain is exposure, and the people whose opinion decides
        your rank do not count it.
        {held === 0
          ? ' You hold no district outright yet — influence has to reach Control, and every rank above Enforcer asks for districts by name.'
          : ''}
        {e.fronts === 0 && ' A business is the only thing that earns clean money on its own.'}
        {e.possessions > 0 &&
          ' Your own things count here at what they cost, the same as money put away — buying one moved this total not at all.'}
      </p>
    </Panel>
  );
}

/**
 * The things that are yours rather than the organization's.
 *
 * The design note is in `config/possessions.ts`. Two decisions about *this
 * screen* are worth writing down.
 *
 * **Both columns of the trade are on every row.** What it is worth and what it
 * would come back as, side by side, because the loss on resale is the entire
 * price of owning something and a screen that showed only the price would be
 * hiding the mechanic. Round 14's whole complaint about priced memos was a
 * figure that appeared in one place and vanished in another.
 *
 * **"Who sees it" is a column rather than a footnote.** It is the only thing
 * separating two items of the same price, and a player who cannot see it is
 * choosing between a necklace and an apartment on the strength of the prose.
 */
function Possessions() {
  const state = useGame();
  const owned = possessionRows(state);

  const seen = (visibility: number) =>
    visibility >= 0.75 ? 'Everybody' : visibility >= 0.4 ? 'People notice' : 'Nobody much';

  return (
    <Panel title="What is yours">
      <p className="dim" style={{ marginTop: 0 }}>
        The fronts belong to the organization. These belong to you. They count
        toward what the family is worth exactly as money put away does, so
        buying one moves your rank not at all — what it costs is that the money
        has stopped being money, and it comes back at{' '}
        {Math.round(POSSESSION_SELL_SHARE * 100)} cents on the dollar. What
        people can see raises how legitimate you look and puts your name in the
        paper, which are not the same thing.
      </p>

      {owned.length > 0 && (
        <table className="table" style={{ marginBottom: 14 }}>
          <thead>
            <tr>
              <th>Yours</th>
              <th className="num">Worth</th>
              <th className="num">Sells for</th>
              <th>Who sees it</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {owned.map((row) => (
              <tr key={row.possession.id}>
                <td>
                  <div>{row.def.name}</div>
                  <div className="faint tiny">Bought on day {row.possession.boughtDay}</div>
                </td>
                <td className="num mono">{formatMoney(row.value)}</td>
                <td className="num mono">{formatMoney(row.back)}</td>
                <td className="dim">{seen(row.def.visibility)}</td>
                <td>
                  <button
                    className="btn small"
                    title={`Sell it for ${formatMoney(row.back)}. You paid ${formatMoney(row.possession.paid)}`}
                    onClick={() => mutate((g) => sellPossession(g, row.def.id), true)}
                  >
                    Sell
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/*
           The shop is gone, and this is where it stood.

           Measured on 36 ordinary careers at day 300: **0 of 36 bought
           anything.** Not a discoverability problem — front income compounds
           and a possession does not, so every dollar spent here was a dollar
           not spent on premises that pay for four years, and ignoring the
           catalogue was correct play. A shop whose right answer is "do not" is
           not a decision, and a greyed-out one would have been worse: the
           player would keep asking what unlocks it.

           Things arrive from the work now — see `takeSomething`. What is left
           on this screen is what the boss has, which is the half that five
           other systems were always reading.
        */}
      {owned.length === 0 && (
        <p className="faint tiny" style={{ margin: '4px 0 0' }}>
          Nothing yet. Things turn up when a score comes home.
        </p>
      )}
    </Panel>
  );
}

export default function PlayerPanel() {
  const state = useGame();
  const { player, org } = state;
  const difficulty = DIFFICULTY_BY_ID[state.difficulty];
  const authorityNow = authorityRead(state);
  const houseNow = homeRead(state);
  const goingHome = canGoHome(state);
  const named = nicknameRead(state);
  const rows = buildRead(state);
  const left = pointsLeft(state);

  return (
    <>
      {/*
        The portrait beside the name, dressed by the rank rather than by
        anything you chose — see ui/art/playerLook.ts. So the page about how
        far you have climbed shows it rather than only counting it, and the
        line under it is the one thing on this screen that says what the
        promotion actually put you in.
      */}
      <div className="player-head">
        <PlayerPortrait player={player} scale={3} />
        <div>
          <div className="page-head" style={{ marginBottom: 2 }}>
            <h1 className="page-title">
              {player.name}
              {/*
                   What the street calls you, beside the name you were given.

                   On the title rather than in a panel of its own, because that
                   is what a byname is — it is not a stat with a screen, it is
                   the thing people say instead of your surname.
                */}
              {named && <span className="faint"> · {named.name}</span>}
            </h1>
            <span className="tiny">{difficulty.name}</span>
          </div>
          <p className="tiny faint" style={{ marginTop: 6 }}>{KIT_NOTE[player.rank]}</p>
        </div>
      </div>

      <div className="grid-2">
        <Worth />

        <Panel title="Standing">
          <KeyValue label="Respect" value={Math.floor(org.respect)} />
          {/*
             Influence used to sit here, reading `org.influence` — a field
             initialised to STARTING_INFLUENCE and never assigned again
             anywhere in the game. It was a constant zero with top billing,
             a few rows above the *attribute* of the same name, which is what
             every gate in the game actually reads and which appears below
             with the progress bar that says how to move it.

             Two numbers, one label, one screen, and the prominent one could
             not be changed. Four rounds reported not understanding Influence;
             round 13 called it "one attribute I had no idea how to train".
             Removed rather than repointed: the real one is already on this
             page and carries more.
          */}
          {/*
             How the outside reads you, and what the career is shaping into.

             On the living screen as well as the death screen, because a
             verdict you only see once you have lost is a verdict you cannot
             steer by. Round 14 played 180 days "grinding a position I could
             not win" with nothing on any screen naming what the position was.
          */}
          <KeyValue label="How legitimate it looks" value={`${legitimacy(state)} of 100`} />
          {/*
             Authority, and the one thing holding it down.

             A number on its own would be the eleventh statistic on this screen
             and `config/authority.ts` says plainly that is the way this
             feature fails. The reading names its own worst term, so the row is
             a thing to go and do something about rather than a thing to look
             at — the same standard `rankRequirements` is held to above.
          */}
          <KeyValue
            label="Whether you are obeyed"
            value={`${authorityNow.value} of 100 — ${authorityNow.label}`}
            tone={authorityNow.value < 45 ? 'hot' : undefined}
          />
          <KeyValue
            label="Weakest of the four"
            value={`${authorityNow.because[0].term} (${authorityNow.because[0].value})`}
          />
          {/*
             And the half of the man that is not the organization.

             Read-only on purpose. There is no button here and there is not
             going to be one: `config/personal.ts` argues that a pull toward
             home has to arrive as something asking, on a week that had other
             plans, rather than sit on a panel as a bar to be topped up. This
             row is so the player can see what the memo was about.
          */}
          <KeyValue label="At home" value={`${houseNow.where} — ${houseNow.label}`} />
          <KeyValue
            label="Who is there"
            value={houseNow.people.join('; ')}
          />
          <KeyValue
            label="Last evening at home"
            value={houseNow.since === 0 ? 'Today' : `${houseNow.since} days ago`}
            tone={houseNow.neglect >= 50 ? 'hot' : undefined}
          />
          {/*
             And what it is costing, which the counter never said.

             Round 15 got a button here because a rising counter with no way to
             act on it is a demand with no answer. Round 17 found the other half
             of the same fault: the counter had a way to act on it and still
             never said why you would. One scorer played 137 days from home and
             wrote that the family "never cost me anything" and was therefore
             "set dressing" — while neglect was quietly multiplying the odds
             their own people would remove them, up to 1.9.

             Only when there is something to say. `neglectRisk` is flat at 1
             until `HOME.depositionFrom`, so a boss who goes home occasionally
             reads nothing here at all.
          */}
          {houseNow.costing && (
            <p className="hot tiny" style={{ margin: '2px 14px 0' }}>
              {houseNow.costing}
            </p>
          )}
          {/*
             And a way to actually go.

             There was no button here at first, on the reasoning that a pull
             toward home should arrive rather than sit on a panel as a bar to
             top up. Round 15 waited **233 days** for the memo to arrive while
             the briefing counted upward at them the whole time — "for 230 days
             the game showed me a rising counter I had no way to act on" — and
             that reasoning turned out to describe a tax rather than a life.
             The memo stays; this is for a boss who does not need inviting.
          */}
          <button
            className="btn"
            style={{ marginTop: 10 }}
            disabled={!goingHome.ok}
            title={goingHome.reason ?? 'An evening at home'}
            onClick={() => mutate((g) => goHome(g), true)}
          >
            Go home for the evening
          </button>
          {!goingHome.ok && (
            <p className="faint tiny" style={{ marginTop: 6, marginBottom: 0 }}>
              {goingHome.reason}
            </p>
          )}
          {/*
             Rank above shape, because a tester read the shape as the rank.

             "Shaping into: A Name On A Short List" is a reading of how the
             career is being played and it changes back and forth; round 16
             had a tester take it for their rank and conclude the game had
             stopped tracking them. Printing the actual rung directly above it
             is what tells the two apart.
          */}
          <KeyValue label="They call you" value={rankNow(state).name} tone="brass" />
          {nextRank(state) && whatItNeeds(state).length > 0 && (
            <KeyValue
              label={`To be ${nextRank(state)!.name}`}
              value={whatItNeeds(state).join(', ')}
            />
          )}
          <KeyValue label="Shaping into" value={careerShape(state).name} tone="brass" />
          <KeyValue label="Operations completed" value={player.opsCompleted} tone="good" />
          <KeyValue label="Operations failed" value={player.opsFailed} tone="hot" />
          {/*
             The cap the outfit actually has, and no ceiling on appointments.

             Both rows read the rank table. `maxCrew` there is 3 for every
             career now that `player.rank` never moves, and `maxRole` was the
             ceiling `canPromote` used to enforce before it stopped: you are the
             boss from the first morning, so there is nobody above you to
             withhold permission to name a capo. One row is corrected and the
             other is gone.
          */}
          <KeyValue label="People you can command" value={maxCrew(state)} />
        </Panel>
      </div>

      <Possessions />

      <Panel title="What you are made of">
        {/*
             The build, and the screen that used to be here.

             Eight attributes that improved by use. Measured on how often each
             was read anywhere outside this panel: leadership 7, influence 6,
             negotiation 5, streetSmarts 5, business 1, intimidation 1,
             intelligence 0, strategy 0 — **two of the eight were read by
             nothing at all**, and this screen showed all eight with a progress
             bar under each as though they were equally alive.

             What replaced it is finite. Points are the decision; a boss is
             definitely weak somewhere and he chose where. See
             `config/build.ts`.
          */}
        {/*
             Why they call you it, and what it is worth.

             Above the seven because it is a *comment* on them — a name is the
             street's reading of a build, and a point it hands you is already
             counted in the numbers below.
          */}
        {named && (
          <p className="tiny" style={{ margin: '0 0 10px' }}>
            <span className="brass">{named.name}</span>{' '}
            <span className="faint">{named.blurb}</span>{' '}
            <span className="dim">{named.grant}</span>
          </p>
        )}

        <div className="row between" style={{ marginTop: 0, marginBottom: 8 }}>
          <p className="dim" style={{ margin: 0 }}>
            Points are placed, not earned. What you leave at the bottom is a thing you
            will never be able to do.
          </p>
          <span className="mono brass" style={{ whiteSpace: 'nowrap' }}>
            {left} to place
          </span>
        </div>

        <div className="grid-2">
          {rows.map((row) => {
            const def = STAT_BY_ID[row.id];
            const can = canSpendPoint(state, row.id);
            return (
              <div key={row.id} style={{ marginBottom: 10 }}>
                <div className="row between">
                  <span>{def.label}</span>
                  <span className="mono brass">
                    {row.level}
                    <span className="faint" style={{ fontSize: 11 }}>
                      /{BUILD.max}
                    </span>
                  </span>
                </div>
                <div style={{ margin: '4px 0 5px' }}>
                  <Bar value={row.level} max={BUILD.max} />
                </div>
                <p className="faint" style={{ fontSize: 11.5, margin: '0 0 4px' }}>
                  {def.blurb}
                </p>

                {/*
                     What the points have bought, and what the next one would.

                     The verb is a threshold, so the screen has to say how far
                     off it is — a bar with a hidden line in it is the kind of
                     thing round 12 spent ninety days not understanding.
                  */}
                <p
                  className={row.verb ? 'tiny' : 'faint tiny'}
                  style={{ margin: '0 0 4px' }}
                >
                  {row.verb
                    ? `${def.verb} — ${def.verbBlurb}`
                    : `${def.verb} at ${row.level + row.toVerb}. ${
                        row.toVerb === 1 ? 'One more point.' : `${row.toVerb} more points.`
                      }`}
                </p>
                <p className={row.noticed ? 'tiny dim' : 'faint tiny'} style={{ margin: 0 }}>
                  {row.noticed ? def.world : 'Nobody has noticed yet.'}
                </p>

                <button
                  className="btn small"
                  style={{ marginTop: 6 }}
                  disabled={!can.ok}
                  title={can.reason ?? `Put a point into ${def.label}`}
                  onClick={() => mutate((g) => spendPoint(g, row.id), false)}
                >
                  Put a point in
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
