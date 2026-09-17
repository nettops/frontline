import { rankNow, nextRank, whatItNeeds, whatHoldsIt } from '../../sim/rank';
import { useGame, mutate } from '../../store';
import { buildRead, canSpendPoint, pointsLeft, spendPoint } from '../../sim/build';
import { nicknameRead } from '../../sim/nicknames';
import { BUILD, STAT_BY_ID, type StatId } from '../../config/build';

/**
 * A verb with a config entry and real sim logic, but nowhere on any screen
 * to press it. Empty as of 2026-09-10 — both entries this ever held are
 * closed:
 *
 * Word's `canCallATable` used to gate a sit-down that had never actually
 * been gated, houses being reachable from Diplomacy regardless. Closed when
 * `canSitDownWith` picked up its one real restriction: a house you are at
 * war with will not sit down with a boss whose word does not carry anything
 * yet. See `sim/sitdown.ts`.
 *
 * Ledger's `canBuyIn`/`buyIn` used to resolve only against `state.businesses`,
 * which holds the player's own fronts and nothing belonging to a rival, so
 * "take a piece of somebody else's business" could not address the business
 * it named. Closed by `RivalBusiness` (`sim/types.ts`) giving a rival's front
 * an actual identity, materialized as a family invests, with a "Buy in"
 * button on each rival's own page in `RivalsPanel.tsx`.
 *
 * Left wired rather than deleted: this is what stopped the allocation screen
 * promising either action while it did not exist, and the next verb that
 * ships a config entry before its screen is worth catching the same way.
 */
const VERB_NOT_YET_REACHABLE: Partial<Record<StatId, string>> = {};
import { Panel, Bar, KeyValue } from '../components';
import { estate } from '../../sim/estate';
import { legitimacy, perceivedLeadership } from '../../sim/legacy';
import { maxCrew } from '../../sim/player';
import { authorityRead } from '../../sim/authority';
import {
  canConsult,
  canGoHome,
  canPayAllowance,
  canVisitConfidant,
  confidant,
  consultCost,
  consultDoctor,
  familyHorizon,
  goHome,
  homeRead,
  payConfidantAllowance,
  isAging,
  playerStress,
  stressPressure,
  stressTier,
  visitConfidant,
} from '../../sim/personal';
import { CONFIDANT, HOME } from '../../config/personal';
import { NEPOTISM } from '../../config/succession';
import {
  currentDoctrine,
  doctrineLockedUntil,
  doctrineState,
  relics,
  setDoctrine,
} from '../../sim/doctrine';
import { DOCTRINE, DOCTRINES } from '../../config/doctrine';
import type { DoctrineId } from '../../config/doctrine';
import { activeCapos } from '../../sim/capoTension';
import { hasHealthInsurance } from '../../sim/corporate';
import { HEALTH_INSURANCE } from '../../config/corporate';
import {
  canRequestSuburbanFavour,
  civiliansAreBeingQuestioned,
  neighbour,
  requestSuburbanFavour,
} from '../../sim/suburbs';
import { SUBURBAN_FAVOUR_BY_ID, SUBURBAN_NEIGHBOURS, SUBURBS } from '../../config/suburbs';
import {
  buyPetProject,
  canBuyPetProject,
  canSanitizePetProject,
  canVisitPetProject,
  petProjectDef,
  petProjectState,
  reliefScale,
  sanitizePetProject,
  visitPetProject,
} from '../../sim/petProject';
import { CONTAGION, PET_PROJECTS } from '../../config/petProject';
import { priced } from '../../sim/market';
import { ATTENTION } from '../../config/attention';
import {
  possessionRows,
  sellPossession,
} from '../../sim/possessions';
import { controlledTerritories } from '../../sim/territory';
import { publicStandingRead } from '../../sim/civic';
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

/**
 * What kind of thing this is, said out loud.
 *
 * The one choice in the game that is about the whole organization rather than
 * about a week, so it gets its own panel and prints all four dials rather
 * than a sentence about them — a boss deciding between his father's outfit
 * and a holding company is comparing numbers that move every job, every
 * front and every case he will ever have, and "harder to prove" is not a
 * figure anybody can decide on.
 *
 * Undeclared is shown as the third state rather than hidden. Nothing about a
 * career that has never declared one is neutral-by-default — it is a boss who
 * has not answered, and the panel says so.
 */
function Doctrine() {
  const state = useGame();
  const held = doctrineState(state);
  const now = currentDoctrine(state);
  const locked = doctrineLockedUntil(state);
  const relicCount = relics(state).length;

  const declare = (id: DoctrineId) => mutate((g) => setDoctrine(g, id), false);
  const dial = (v: number) => `${v.toFixed(2)}×`;

  return (
    <Panel title="What this is">
      <KeyValue
        label="Declared"
        value={now ? now.name : 'Nothing, yet'}
        tone={now ? 'brass' : undefined}
      />
      <p className="faint tiny" style={{ margin: '2px 14px 8px' }}>
        {now
          ? now.blurb
          : 'You have not said what this is. Nothing is pushing either way, which is its own kind of answer to the men who are waiting for one.'}
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>What it moves</th>
              <th className="num">{DOCTRINES.traditional.name}</th>
              <th className="num">{DOCTRINES.corporate.name}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Attention a job draws</td>
              <td className="num mono hot">{dial(DOCTRINES.traditional.federalHeat)}</td>
              <td className="num mono good">{dial(DOCTRINES.corporate.federalHeat)}</td>
            </tr>
            <tr>
              <td>What a front takes over the counter</td>
              <td className="num mono hot">{dial(DOCTRINES.traditional.cleanYield)}</td>
              <td className="num mono brass">{dial(DOCTRINES.corporate.cleanYield)}</td>
            </tr>
            <tr>
              <td>How fast the street forgets to be frightened</td>
              <td className="num mono good">{dial(DOCTRINES.traditional.fearDecay)}</td>
              <td className="num mono hot">{dial(DOCTRINES.corporate.fearDecay)}</td>
            </tr>
            <tr>
              <td>What you are worth on a job scored on fear</td>
              <td className="num mono brass">+{DOCTRINES.traditional.intimidationBonus}</td>
              <td className="num mono dim">+{DOCTRINES.corporate.intimidationBonus}</td>
            </tr>
            <tr>
              <td>What the old men take from hearing it</td>
              <td className="num mono good">
                +{DOCTRINES.traditional.relicLoyalty} loyalty
              </td>
              <td className="num mono hot">
                +{DOCTRINES.corporate.relicGrievance} grievance
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="faint tiny" style={{ margin: '10px 0 8px' }}>
        It lands once, at the table, on {relicCount}{' '}
        {relicCount === 1 ? 'man who remembers' : 'men who remember'} the old way. After that it
        stands for {DOCTRINE.switchCooldownDays} days, because an answer you can take back the
        same afternoon is not an answer.
      </p>
      <div className="btn-row">
        <button
          className="btn small"
          disabled={locked !== null || held?.current === 'traditional'}
          title={DOCTRINES.traditional.blurb}
          onClick={() => declare('traditional')}
        >
          Say it is {DOCTRINES.traditional.name}
        </button>
        <button
          className="btn small"
          disabled={locked !== null || held?.current === 'corporate'}
          title={DOCTRINES.corporate.blurb}
          onClick={() => declare('corporate')}
        >
          Say it is {DOCTRINES.corporate.name}
        </button>
      </div>
      {locked !== null && (
        <p className="faint tiny" style={{ margin: '6px 0 0' }}>
          You said what this was {state.day - (held?.sinceDay ?? 0)} days ago and people arranged
          their lives around it. Ask again in {locked - state.day}{' '}
          {locked - state.day === 1 ? 'day' : 'days'}.
        </p>
      )}
    </Panel>
  );
}

/**
 * The people either side of the driveway, and the bill that comes for them.
 *
 * Every favour on this panel is legal, cheap, and moves the same public
 * standing a federal case already reads — so the immediate effect is
 * genuinely good and the panel does not pretend otherwise. What it has to
 * show beside that is the number that makes it a decision: how far into the
 * life each civilian has been pulled, and whether anybody is out knocking on
 * ordinary doors this week.
 */
function CulDeSac() {
  const state = useGame();
  const questioned = civiliansAreBeingQuestioned(state);

  return (
    <Panel title="The cul-de-sac">
      <p className="dim" style={{ marginTop: 0 }}>
        None of these people took an oath. All of them have children and a mortgage, and every
        favour you do them puts one more of them on a list.
      </p>
      {questioned ? (
        <p className="hot tiny" style={{ margin: '0 0 10px' }}>
          Agents are on the street asking ordinary people ordinary questions. Anybody on this
          block who owes you something can be asked about it, and one of them will fold.
        </p>
      ) : (
        <p className="faint tiny" style={{ margin: '0 0 10px' }}>
          Nobody is knocking on these doors. That lasts until heat passes {SUBURBS.panicHeatFloor}{' '}
          or a case gets a van outside.
        </p>
      )}
      {SUBURBAN_NEIGHBOURS.map((def) => {
        const held = neighbour(state, def.id);
        if (!held) return null;
        return (
          <div key={def.id} style={{ marginBottom: 14 }}>
            <KeyValue
              label={def.name}
              value={
                held.panicked
                  ? 'Has already talked to them'
                  : held.exposure === 0
                    ? 'Owes you nothing'
                    : `In ${Math.round(held.exposure)} deep`
              }
              tone={held.panicked ? 'hot' : held.exposure >= 40 ? 'hot' : undefined}
            />
            <p className="faint tiny" style={{ margin: '2px 14px 4px' }}>
              {def.what}
            </p>
            {held.exposure > 0 && !held.panicked && (
              <div style={{ margin: '0 14px 6px' }}>
                <Bar value={held.exposure} max={SUBURBS.maxExposure} tone="hot" />
                <p className="faint tiny" style={{ margin: '3px 0 0' }}>
                  About{' '}
                  {(held.exposure * SUBURBS.panicChancePerExposure * 100).toFixed(2)}% a week that
                  he folds, while they are asking. He folds once, and then he is spent.
                </p>
              </div>
            )}
            <div className="btn-row">
              {def.favours.map((favourId) => {
                const fav = SUBURBAN_FAVOUR_BY_ID[favourId];
                const can = canRequestSuburbanFavour(state, def.id, favourId);
                return (
                  <div key={favourId}>
                    <button
                      className="btn small"
                      disabled={!can.ok}
                      title={fav.blurb}
                      onClick={() => mutate((g) => requestSuburbanFavour(g, def.id, favourId), true)}
                    >
                      {fav.name} ({formatMoney(priced(state, fav.cost))})
                    </button>
                    {!can.ok && <div className="tiny faint">{can.reason}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

/**
 * The one thing the boss owns that is not supposed to earn.
 *
 * Bought with clean money, pays nothing back, and the only number on it is
 * how much of the life has found its way in. Both answers to that number are
 * bad, so both buttons are on the panel at once and each says what it costs —
 * leaving it rots the peace the place was bought for, and sweeping it tells
 * every capo he is not good enough for where the boss goes.
 */
function Sanctuary() {
  const state = useGame();
  const held = petProjectState(state);
  const def = petProjectDef(state);
  const visiting = canVisitPetProject(state);
  const sweeping = canSanitizePetProject(state);

  if (!def) {
    return (
      <Panel title="Somewhere that is not this">
        <p className="dim" style={{ marginTop: 0 }}>
          A place with your name on it that never launders a dollar, never pays a wage and never
          appears in anybody's file. It is the only thing you can buy that does nothing.
        </p>
        {PET_PROJECTS.map((p) => {
          const can = canBuyPetProject(state, p.id);
          return (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <KeyValue label={p.name} value={formatMoney(p.cost)} tone="brass" />
              <p className="faint tiny" style={{ margin: '2px 14px 4px' }}>
                {p.blurb} Worth about {p.weeklyStressRelief} off the weight, every quiet week.
              </p>
              <button
                className="btn small"
                disabled={!can.ok}
                title="Clean money only. A place like this is not bought out of a bag."
                onClick={() => mutate((g) => buyPetProject(g, p.id), true)}
              >
                Buy {p.name}
              </button>
              {!can.ok && (
                <div className="tiny faint" style={{ marginTop: 4 }}>
                  {can.message}
                </div>
              )}
            </div>
          );
        })}
      </Panel>
    );
  }

  const scale = reliefScale(held.contagion);
  const raided = held.contagion >= CONTAGION.raidThreshold;

  return (
    <Panel title={def.name}>
      <p className="faint tiny" style={{ marginTop: 0 }}>
        {def.blurb}
      </p>
      <KeyValue
        label="They have found it"
        value={`${Math.round(held.contagion)} of 100`}
        tone={raided ? 'hot' : held.contagion > 40 ? 'hot' : undefined}
      />
      <div style={{ margin: '4px 14px 6px' }}>
        <Bar value={held.contagion} max={100} tone="hot" />
      </div>
      <p className={raided ? 'hot tiny' : 'faint tiny'} style={{ margin: '0 14px 8px' }}>
        {raided
          ? `Past ${CONTAGION.raidThreshold} the place is worth raiding, and about ${Math.round(CONTAGION.raidChance * 100)}% of weeks it is. There are pallets in the back that are not yours.`
          : `Your own people drift in at about ${(CONTAGION.baseWeeklyDrift + activeCapos(state).length * CONTAGION.driftPerCapo).toFixed(1)} a week. Past ${CONTAGION.raidThreshold} the police have a reason to take the doors off.`}
      </p>
      <KeyValue
        label="What a quiet week there is still worth"
        value={`${(def.weeklyStressRelief * scale).toFixed(1)} of ${def.weeklyStressRelief}`}
        tone={scale < 0.5 ? 'hot' : 'good'}
      />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          className="btn small"
          disabled={!visiting.ok}
          title="An evening there. It spends the night, the same as going home does."
          onClick={() => mutate((g) => visitPetProject(g), true)}
        >
          Spend the evening there (−{Math.round(CONTAGION.visitStressRelief * scale)})
        </button>
        <button
          className="btn small danger"
          disabled={!sweeping.ok}
          title="Tell your own captains they are not welcome. Every one of them hears about it by Saturday."
          onClick={() => mutate((g) => sanitizePetProject(g), true)}
        >
          Clear them out (−{CONTAGION.sanitizeInfluenceCost} respect)
        </button>
      </div>
      {[
        ...new Set(
          [visiting, sweeping]
            .filter((r) => !r.ok)
            .map((r) => r.message)
            .filter(Boolean),
        ),
      ].map((why) => (
        <p key={why} className="faint tiny" style={{ margin: '6px 0 0' }}>
          {why}
        </p>
      ))}
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
  const horizon = familyHorizon(state);
  const named = nicknameRead(state);
  const rows = buildRead(state);
  const left = pointsLeft(state);
  const shape = perceivedLeadership(state);
  const stressNow = playerStress(state);
  const stressNowTier = stressTier(stressNow);
  const pressure = stressPressure(state);
  const consulting = canConsult(state);
  // Not `STRESS.consultCost` directly: a covered boss sees a cardiologist and
  // is billed for one. See `consultCost` in sim/personal.ts.
  const consultCash = priced(state, consultCost(state));
  const her = confidant(state);
  const visiting = canVisitConfidant(state);
  const allowance = canPayAllowance(state);
  const visitCash = priced(state, CONFIDANT.visitCost);
  const allowanceCash = priced(state, CONFIDANT.allowanceCost);
  const standing = publicStandingRead(state);
  const covered = hasHealthInsurance(state);
  const pressureParts = [
    pressure.wars > 0 && `Wars: +${pressure.wars.toFixed(1)}`,
    pressure.heat > 0 && `Heat: +${pressure.heat.toFixed(1)}`,
    pressure.domestic > 0 && `Home: +${pressure.domestic.toFixed(1)}`,
    pressure.payroll > 0 && `Payroll: +${pressure.payroll.toFixed(1)}`,
    pressure.aging > 0 && `Age: +${pressure.aging.toFixed(1)}`,
  ].filter((x): x is string => Boolean(x));

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
            tone={houseNow.tier.tone}
          />
          {/*
             What doing nothing costs, ahead of the counter actually crossing
             the line — the same figure `costing` below states once it has.
             Silent once it has, since `costing` is already saying it live.
          */}
          {houseNow.neglect < HOME.depositionFrom && (
            <KeyValue
              label="At this rate"
              value={`${houseNow.daysUntilDepositionRisk} ${
                houseNow.daysUntilDepositionRisk === 1 ? 'day' : 'days'
              } until your own people start counting it against you, if nothing changes`}
            />
          )}
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
             A heads-up, not a schedule.

             Names a day, never an occasion or a face — `familyHorizon`'s own
             comment says why forecasting which one would be a guess dressed
             as a fact. `daysUntil` is a floor the cooldown has cleared, not a
             promise anything fires then, so the copy says "could" throughout.
          */}
          {horizon.everFired && horizon.daysUntil <= ATTENTION.familyHorizonWithin && (
            <p className="faint tiny" style={{ margin: '2px 14px 0' }}>
              A family occasion could come up{' '}
              {horizon.daysUntil === 0 ? 'any day now' : `as soon as day ${horizon.eligibleFromDay}`} —
              not a promise, just the earliest it can happen again.
            </p>
          )}
          {/*
             The one date in this household that is actually knowable in
             advance, unlike the occasion above — age is a pure function of
             `state.day`, not a later draw, so this can say a real number
             rather than "could come up". See `daysUntilAdult`, `sim/personal.ts`.
          */}
          {houseNow.comingOfAge
            .filter((c) => c.daysUntil <= HOME.comingOfAgeWithinDays)
            .map((c) => (
              <p key={c.relationId} className="faint tiny" style={{ margin: '2px 14px 0' }}>
                {c.name} turns eighteen{' '}
                {c.daysUntil === 0 ? 'any day now' : `in about ${c.daysUntil} days`} — whatever you
                decide about that is coming up.
              </p>
            ))}
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
             The half of the man that is not the household either.

             Beside Household on purpose, same panel — `STRESS` in
             `config/personal.ts` argues the double life bears down through
             facts this screen already shows elsewhere (wars, heat, wages,
             neglect); this is where the boss sees what it adds up to. The
             breakdown is itemised for the same reason the odds on a job are:
             a number nobody can trace to a cause is not a cost the player
             can decide to do anything about.
          */}
          <KeyValue
            label="Condition"
            value={`${stressNowTier.label} (${Math.round(stressNow)})`}
            tone={stressNowTier.tone}
          />
          <p className="faint tiny" style={{ margin: '2px 14px 4px' }}>{stressNowTier.blurb}</p>
          <p className="faint tiny" style={{ margin: '0 14px 6px' }}>
            Net: {pressure.netWeekly >= 0 ? '+' : ''}
            {pressure.netWeekly.toFixed(1)}/wk
            {pressureParts.length > 0 ? ` (${pressureParts.join(', ')})` : ' — quiet'}
          </p>
          {/*
             Why a quiet week stopped being worth anything.

             Directly under the breakdown rather than as its own card: the
             line the boss is trying to read is the net, and the reason it
             will not come down any more is a fact about that number. Rule 3
             — a number that moved has to have a panel that can name why —
             and the recovery that has gone missing is exactly the kind of
             absence a player reads as a bug. See `NEPOTISM.agingStartDay`.
          */}
          {isAging(state) && (
            <p className="hot tiny" style={{ margin: '0 14px 8px' }}>
              Career Weariness (Aging) — past day {NEPOTISM.agingStartDay} the body stops
              mending on its own. A quiet week no longer clears anything, and{' '}
              {NEPOTISM.agingWearinessStress.toFixed(1)} a week accrues whatever else you do.
              The doctor is the only way down now.
            </p>
          )}
          {/*
             Who is paying for the hour, directly above the button that bills
             for it.

             `consultCash` already reads the covered price, so an insured boss
             was quietly being charged a different number with nothing on the
             screen saying why — a figure that moved for a reason no panel
             could name, which is rule 3. It also answers the `aging` line
             directly above: the weariness a covered boss reads is zero, and
             that is not the meter being broken.
          */}
          {covered && (
            <p className="tiny" style={{ margin: '0 14px 6px' }}>
              <span className="brass">Carried on somebody else's plan.</span>{' '}
              <span className="faint">
                A union local or your own payroll covers the card. It takes{' '}
                {HEALTH_INSURANCE.wearinessRelief.toFixed(1)} a week off the weariness and buys a
                cardiologist rather than an unmarked office.
              </span>
            </p>
          )}
          <button
            className="btn small"
            style={{ marginTop: 2, marginBottom: 10 }}
            disabled={!consulting.ok}
            title={consulting.reason ?? 'An hour nobody in the crew knows about'}
            onClick={() => mutate((g) => consultDoctor(g), true)}
          >
            See Dr. Vance ({formatMoney(consultCash)})
          </button>
          {!consulting.ok && (
            <p className="faint tiny" style={{ marginTop: -6, marginBottom: 10 }}>
              {consulting.reason}
            </p>
          )}
          {/*
             And the other relief, which is the one that carries a risk.

             Directly under the doctor on purpose: both of them take the
             weight off the same meter, and the whole decision this layer
             exists to pose is which one a boss reaches for. The doctor costs
             money and an hour. This one costs money, and the address is
             somewhere a federal wire can reach.

             Discretion is shown as a bare number beside its own two bars,
             the same way Household shows neglect beside what it is costing —
             "shown odds are real odds" applies to a meter that quietly feeds
             a case as much as it does to a job's percentage. Both lines say
             the bar, not a feeling about the bar.
          */}
          <KeyValue
            label={her.active ? `${her.name}, ${her.role}` : 'Across the river'}
            value={her.active ? `Discretion ${Math.round(her.discretion)}` : 'Over'}
            tone={
              her.active && her.discretion < CONFIDANT.wiretapDiscretionThreshold
                ? 'hot'
                : undefined
            }
          />
          {her.active && (
            <>
              <p className="faint tiny" style={{ margin: '2px 14px 4px' }}>
                {her.discretion < CONFIDANT.discoveryDiscretionThreshold
                  ? 'Too many people know where you go. This is one conversation away from your own kitchen.'
                  : her.discretion < CONFIDANT.wiretapDiscretionThreshold
                    ? `Below ${CONFIDANT.wiretapDiscretionThreshold} a federal case already watching you starts hearing things it did not have to work for.`
                    : 'Nobody who matters knows the address. It stays that way by being paid for.'}
              </p>
              <div style={{ display: 'flex', gap: 6, margin: '0 0 4px' }}>
                <button
                  className="btn small"
                  disabled={!visiting.ok}
                  title={visiting.reason ?? 'An evening nobody is owed'}
                  onClick={() => mutate((g) => visitConfidant(g), true)}
                >
                  An evening there ({formatMoney(visitCash)})
                </button>
                <button
                  className="btn small"
                  disabled={!allowance.ok}
                  title={allowance.reason ?? 'Rent, and somebody who does not ask'}
                  onClick={() => mutate((g) => payConfidantAllowance(g), true)}
                >
                  Send an envelope ({formatMoney(allowanceCash)})
                </button>
              </div>
              {/*
                 Both refusals, not just the first — and deduplicated, since
                 an empty wallet refuses both buttons in nearly the same
                 words. "No button lies" is specifically about a disabled
                 control whose reason is not on the screen, and a tooltip is
                 not on the screen.
              */}
              {[
                ...new Set(
                  [visiting, allowance]
                    .filter((r) => !r.ok)
                    .map((r) => r.reason)
                    .filter((r): r is string => Boolean(r)),
                ),
              ].map((reason) => (
                <p key={reason} className="faint tiny" style={{ margin: '0 14px 10px' }}>
                  {reason}
                </p>
              ))}
            </>
          )}
          {!her.active && (
            <p className="faint tiny" style={{ margin: '2px 14px 10px' }}>
              You ended it. There is nowhere to go on a night the house does not want you.
            </p>
          )}
          {/*
             The boss's other reputation — public standing, not street Fear or
             Respect. Directly below Household and Condition on purpose: this
             is the same evenings this panel's Household section is already
             about, read from the other side. Purely a derived read — see
             `sim/civic.ts`'s `publicStandingRead` — so there is nothing to
             spend here, only to build by how the family is actually run.
          */}
          <KeyValue
            label="Public standing"
            value={`${standing.tier.label} (${standing.score} of 100)`}
            tone={standing.tier.tone}
          />
          <p className="faint tiny" style={{ margin: '2px 14px 4px' }}>{standing.tier.blurb}</p>
          <KeyValue
            label={
              standing.tier.caseGrowthMultiplier < 1
                ? 'Witness shield'
                : standing.tier.caseGrowthMultiplier > 1
                  ? 'Vulnerable'
                  : 'Federal exposure'
            }
            value={
              standing.tier.caseGrowthMultiplier < 1
                ? `Federal case development slowed by ${Math.round((1 - standing.tier.caseGrowthMultiplier) * 100)}%`
                : standing.tier.caseGrowthMultiplier > 1
                  ? `Local tips accelerating cases by +${Math.round((standing.tier.caseGrowthMultiplier - 1) * 100)}%`
                  : 'Neither helping nor hurting a federal case'
            }
            tone={standing.tier.caseGrowthMultiplier < 1 ? 'brass' : standing.tier.caseGrowthMultiplier > 1 ? 'hot' : undefined}
          />
          <KeyValue label="Street sentiment (worked ground)" value={`${Math.round(standing.sentiment)} of 100`} />
          <KeyValue label="Business cleanliness" value={`${Math.round(standing.legitimacy)} of 100`} />
          <KeyValue label="Civic alliances" value={`${Math.round(standing.alliance)} of 100`} />
          {/*
             Rank above shape, because a tester read the shape as the rank.

             "Shaping into: A Name On A Short List" is a reading of how the
             career is being played and it changes back and forth; round 16
             had a tester take it for their rank and conclude the game had
             stopped tracking them. Printing the actual rung directly above it
             is what tells the two apart.
          */}
          <KeyValue label="They call you" value={rankNow(state).name} tone="brass" />
          {/* And at the top, what is keeping you there. See `whatHoldsIt`. */}
          {!nextRank(state) && whatHoldsIt(state).length > 0 && (
            <KeyValue
              label="What holds it"
              value={whatHoldsIt(state).join(' · ')}
            />
          )}
          {nextRank(state) && whatItNeeds(state).length > 0 && (
            <KeyValue
              label={`To be ${nextRank(state)!.name}`}
              value={whatItNeeds(state).join(', ')}
            />
          )}
          {shape && <KeyValue label="Shaping into" value={shape.name} tone="brass" />}
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

      <Doctrine />

      <div className="grid-2">
        <CulDeSac />
        <Sanctuary />
      </div>

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
          {/*
               And what they are not, which is the half that misled three
               scorers.

               All three read this screen as a stat allocation and expected the
               odds on a job to move. One measured it: nine points placed, "Your
               ability" unchanged on the same job the same day, filed as points
               doing nothing. The odds row reads `player.attributes`, which
               grows by doing the work and is a different field entirely — it is
               the panel that used to live here and was replaced by this one.

               Points buy verbs and how the world behaves toward you. Saying so
               costs one sentence and is the difference between an irreversible
               choice that feels arbitrary and one that feels deliberate.
            */}
          <p className="dim" style={{ margin: 0 }}>
            Points are placed, not earned. What you leave at the bottom is a thing you
            will never be able to do. They buy what you are <em>able</em> to do and how the
            city treats you — not the odds on tonight's job, which come from doing the work.
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
                  className={row.verb && !VERB_NOT_YET_REACHABLE[row.id] ? 'tiny' : 'faint tiny'}
                  style={{ margin: '0 0 4px' }}
                >
                  {VERB_NOT_YET_REACHABLE[row.id]
                    ? `${def.verb} — ${VERB_NOT_YET_REACHABLE[row.id]}`
                    : row.verb
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
