import { useGame, mutate } from '../../store';
import { Panel, Bar, KeyValue } from '../components';
import { nextRank, rankRequirements } from '../../sim/player';
import { estate } from '../../sim/estate';
import { careerShape, legitimacy } from '../../sim/legacy';
import { authorityRead } from '../../sim/authority';
import { canGoHome, goHome, homeRead } from '../../sim/personal';
import {
  buyPossession,
  canBuyPossession,
  possessionRows,
  possessionValue,
  sellPossession,
} from '../../sim/possessions';
import { Rng } from '../../sim/rng';
import { controlledTerritories } from '../../sim/territory';
import { formatMoney } from '../../sim/util';
import {
  ATTRIBUTE_BLURB,
  ATTRIBUTE_IDS,
  ATTRIBUTE_LABEL,
  ATTRIBUTE_MAX,
  RANK_BY_ID,
  ROLE_LABEL,
  attributeProgressNeeded,
} from '../../config/economy';
import { DIFFICULTY_BY_ID } from '../../config/difficulty';
import {
  POSSESSION,
  POSSESSIONS,
  POSSESSION_KIND_LABEL,
  type PossessionKind,
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
  const ownedIds = new Set(owned.map((row) => row.def.id));
  const kinds: PossessionKind[] = ['home', 'car', 'jewellery'];

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

      {kinds.map((kind) => {
        const offer = POSSESSIONS.filter((d) => d.kind === kind && !ownedIds.has(d.id));
        if (offer.length === 0) return null;
        return (
          <div key={kind} style={{ marginBottom: 10 }}>
            <div className="tiny" style={{ margin: '4px 0 6px' }}>
              {POSSESSION_KIND_LABEL[kind]}
            </div>
            <table className="table">
              <tbody>
                {offer.map((def) => {
                  const check = canBuyPossession(state, def.id);
                  return (
                    <tr key={def.id}>
                      <td>
                        <div>{def.name}</div>
                        <div className="faint tiny">{def.blurb}</div>
                      </td>
                      <td className="num mono">{formatMoney(possessionValue(state, def))}</td>
                      <td className="dim">{seen(def.visibility)}</td>
                      <td>
                        <button
                          className="btn small"
                          disabled={!check.ok}
                          /*
                             The refusal goes in the tooltip *and* under the
                             row when it bites. `refusals.test.ts` exists
                             because a priced option put its figure in the
                             hint and its refusal in the disabled reason, and
                             the panel rendered one instead of the other — so
                             the price vanished exactly when the player could
                             not pay it.
                          */
                          title={check.reason ?? 'Buy it'}
                          onClick={() =>
                            mutate((g) => buyPossession(g, new Rng(g.rng), def.id), true)
                          }
                        >
                          Buy
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {offer.some((def) => !canBuyPossession(state, def.id).ok) && (
              <p className="faint tiny" style={{ margin: '4px 0 0' }}>
                {canBuyPossession(
                  state,
                  offer.find((def) => !canBuyPossession(state, def.id).ok)!.id,
                ).reason}
              </p>
            )}
          </div>
        );
      })}
    </Panel>
  );
}

export default function PlayerPanel() {
  const state = useGame();
  const { player, org } = state;
  const rank = RANK_BY_ID[player.rank];
  const next = nextRank(state);
  const reqs = rankRequirements(state);
  const difficulty = DIFFICULTY_BY_ID[state.difficulty];
  const authorityNow = authorityRead(state);
  const houseNow = homeRead(state);
  const goingHome = canGoHome(state);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{player.name}</h1>
        <span className="tiny">
          {rank.name} · {difficulty.name}
        </span>
      </div>
      <p className="page-sub">{rank.blurb}</p>

      <div className="grid-2">
        <Panel title="Advancement">
          {next ? (
            <>
              <p className="dim" style={{ marginTop: 0 }}>
                Rank is not earned by time served. It is recognition of what you
                already control — meet every line and it will be offered to you.
                What you have ever managed counts, not only what you hold today.
              </p>
              <div className="tiny" style={{ margin: '4px 0 10px' }}>
                Toward {RANK_BY_ID[next].name}
              </div>
              {reqs.map((req) => (
                <div className="kv" key={req.label}>
                  <span className="kv-key">
                    {req.met ? <span className="good">✓</span> : <span className="faint">·</span>}{' '}
                    {req.label}
                  </span>
                  {/*
                    Both figures when they differ, because they are different
                    things and the table used to name only one.

                    This column measures the best the family has ever managed —
                    a rung once earned stays earned. The Overview shows what you
                    hold today. Round 11 read "Crew 13 / 16" here beside "Crew 8
                    of 22" there, and "$92,017" beside "In all $80,917", and
                    twice misjudged the distance to a promotion. The rule was
                    stated once in small text and never at the point of use.
                  */}
                  <span className={req.met ? 'kv-val good' : 'kv-val'}>
                    {req.money
                      ? `${formatMoney(req.current)} / ${formatMoney(req.needed)}`
                      : `${req.current} / ${req.needed}`}
                    {req.now < req.current && (
                      <span className="faint">
                        {' '}
                        (now {req.money ? formatMoney(req.now) : req.now})
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {player.pendingRank && (
                <p className="brass" style={{ marginBottom: 0 }}>
                  You have been offered {RANK_BY_ID[player.pendingRank].name}. Answer it
                  on the overview.
                </p>
              )}
            </>
          ) : (
            <p className="brass" style={{ margin: 0 }}>
              There is nothing above this.
            </p>
          )}
        </Panel>

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
          <KeyValue label="Shaping into" value={careerShape(state).name} tone="brass" />
          <KeyValue label="Operations completed" value={player.opsCompleted} tone="good" />
          <KeyValue label="Operations failed" value={player.opsFailed} tone="hot" />
          <KeyValue label="People you can command" value={rank.maxCrew} />
          <KeyValue label="Highest rank you can appoint" value={ROLE_LABEL[rank.maxRole]} />
        </Panel>
      </div>

      <Possessions />

      <Panel title="What you are good at">
        <p className="dim" style={{ marginTop: 0 }}>
          Attributes improve by use. Running a job trains what that job demands, and
          handling people trains how you handle people.
        </p>
        <div className="grid-3">
          {ATTRIBUTE_IDS.map((id) => {
            const value = player.attributes[id];
            const progress = player.attributeProgress[id];
            const needed = attributeProgressNeeded(value);
            return (
              <div key={id}>
                <div className="row between">
                  <span>{ATTRIBUTE_LABEL[id]}</span>
                  <span className="mono brass">
                    {value}
                    <span className="faint" style={{ fontSize: 11 }}>
                      /{ATTRIBUTE_MAX}
                    </span>
                  </span>
                </div>
                <div style={{ margin: '4px 0 5px' }}>
                  <Bar value={value} max={ATTRIBUTE_MAX} />
                </div>
                {/*
                   Two stacked bars with nothing to tell them apart is one bar
                   too many. A playtester read the pair as decoration and never
                   worked out that the lower one is the only thing on the page
                   that moves week to week — so it says what it is measuring
                   and how far along it is.
                */}
                <div style={{ marginBottom: 4 }}>
                  <Bar value={progress} max={needed} tone="cold" />
                  <div className="faint tiny" style={{ marginTop: 2 }}>
                    {value >= ATTRIBUTE_MAX
                      ? 'as good as it gets'
                      : `${Math.round(progress)} of ${Math.round(needed)} towards ${value + 1}`}
                  </div>
                </div>
                <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
                  {ATTRIBUTE_BLURB[id]}
                </p>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
