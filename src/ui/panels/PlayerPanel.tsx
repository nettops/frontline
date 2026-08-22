import { useGame } from '../../store';
import { Panel, Bar, KeyValue } from '../components';
import { nextRank, rankRequirements } from '../../sim/player';
import { estate } from '../../sim/estate';
import { careerShape, legitimacy } from '../../sim/legacy';
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
      </p>
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
          <KeyValue label="Shaping into" value={careerShape(state).name} tone="brass" />
          <KeyValue label="Operations completed" value={player.opsCompleted} tone="good" />
          <KeyValue label="Operations failed" value={player.opsFailed} tone="hot" />
          <KeyValue label="People you can command" value={rank.maxCrew} />
          <KeyValue label="Highest rank you can appoint" value={ROLE_LABEL[rank.maxRole]} />
        </Panel>
      </div>

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
