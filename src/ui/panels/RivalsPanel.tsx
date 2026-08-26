import { useState } from 'react';
import { useGame, mutate } from '../../store';
import { Panel, Empty, KeyValue, Bar } from '../components';
import {
  contestedWith,
  factionInfluence,
  readFaction,
  relationshipLabel,
  rivals,
} from '../../sim/faction';
import { relationship } from '../../sim/diplomacy';
import { readSuspicions } from '../../sim/beliefs';
import { bond } from '../../sim/diplomacy';
import { playerInfluence, territoryDef } from '../../sim/territory';
import { formatMoney, formatShortDay } from '../../sim/util';
import { Rng } from '../../sim/rng';
import { approachCapo, canApproach, readCapos } from '../../sim/capos';
import { prices } from '../../sim/market';
import { spend, totalFunds } from '../../sim/economy';
import {
  houseBlurb,
  houseColour,
  houseName,
  houseReputation,
} from '../../sim/houses';
import { BossPortrait } from '../BossPortrait';
import { styleFor } from '../art/bossLook';
import { PERCEPTION_TIERS } from '../../config/npcs';
import type { Faction } from '../../sim/types';

/**
 * A one-sided dimension — a grudge only runs from nothing to everything.
 */
function levelBand(value: number, words: [string, string, string, string]): string {
  if (value < 8) return words[0];
  if (value < 35) return words[1];
  if (value < 65) return words[2];
  return words[3];
}

/**
 * A two-sided one, where the middle is its own answer.
 *
 * The first version had four bands and no neutral, so a family you had simply
 * never dealt with read as "would never rely on you" — which is not what a
 * blank record means. Not knowing is a state, and it is the one most pairs are
 * in for most of a game.
 */
function signedBand(value: number, words: [string, string, string, string, string]): string {
  if (value < -40) return words[0];
  if (value < -8) return words[1];
  if (value <= 15) return words[2];
  if (value <= 55) return words[3];
  return words[4];
}

export default function RivalsPanel() {
  const state = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const all = rivals(state);
  const selected = selectedId ? state.factions[selectedId] : null;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Rivals</h1>
        <span className="tiny">{all.length} organizations</span>
      </div>
      <p className="page-sub">
        Three other families are working the same city, and they are not waiting for
        you. What you know about any of them depends entirely on how much ground you
        share — you learn about people by standing near them.
      </p>

      <Panel title="The other families" flush>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Toward you</th>
                <th>Contested</th>
                <th className="num">Money</th>
                <th className="num">Muscle</th>
                <th>What they seem to be doing</th>
              </tr>
            </thead>
            <tbody>
              {all.map((faction) => {
                const read = readFaction(state, faction);
                const shared = contestedWith(state, faction.id).length;
                // Their view of you. With the player these are one number —
                // `bond` has nowhere to store the player's own side, so it
                // reads off the other party — but writing it this way round
                // matches where the data actually lives.
                const standing = relationship(state, faction.id, 'player');
                const hostile = standing < -15;
                return (
                  <tr
                    key={faction.id}
                    className={faction.id === selectedId ? 'clickable selected' : 'clickable'}
                    onClick={() =>
                      setSelectedId(faction.id === selectedId ? null : faction.id)
                    }
                  >
                    <td>
                      <div className="name-cell">
                        <span
                          className="name-main"
                          style={{ color: houseColour(state, faction.id) }}
                        >
                          {houseName(state, faction.id)}
                        </span>
                        <span className="name-sub">
                          {read.intel > 0 ? `${Math.round(read.intel)}% known` : 'a name only'}
                        </span>
                      </div>
                    </td>
                    <td className={hostile ? 'hot' : 'dim'}>
                      {relationshipLabel(standing)}
                    </td>
                    <td className="num mono">{shared || '—'}</td>
                    <td className="num mono">{read.wealth}</td>
                    <td className="num mono">{read.strength}</td>
                    <td className="dim">{read.objective}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected && <RivalDetail faction={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}

function RivalDetail({ faction, onClose }: { faction: Faction; onClose: () => void }) {
  const state = useGame();
  const read = readFaction(state, faction);
  const shared = contestedWith(state, faction.id);
  const suspicions = readSuspicions(state, faction.id, read.intel);
  const theirs = bond(state, faction.id, 'player');
  const standing = relationship(state, faction.id, 'player');

  return (
    <Panel
      title={houseName(state, faction.id)}
      action={
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      }
    >
      {/*
        Who is actually running it.

        The house had a name, a blurb and four hidden numbers, and the man in
        charge of it existed only in the log line announcing that the last one
        had died. He is the reason the family's temperament drifts over a long
        game — leaders.ts is the only mechanism by which the city changes
        character without the player doing it — so he belongs at the top of
        the page about them rather than nowhere.

        The portrait resolves with `read.intel`, like everything else here.
      */}
      <div className="boss-row">
        <BossPortrait faction={faction} intel={read.intel} scale={2} />
        <div>
          <p className="dim" style={{ marginTop: 0 }}>
            {read.intel >= 25 ? houseBlurb(state, faction.id) : houseReputation(state, faction.id)}
          </p>
          {faction.leader && (
            <div className="tiny">
              {read.intel >= PERCEPTION_TIERS[1].minFamiliarity ? (
                <>
                  <span className="name-main">{faction.leader.name}</span>
                  <span className="faint">
                    {' · '}{faction.leader.age}
                    {' · '}{styleFor(faction.personality).light.where}
                  </span>
                  {read.intel >= 25 && (
                    <div className="faint" style={{ marginTop: 4 }}>
                      {faction.leader.reputation}
                    </div>
                  )}
                </>
              ) : (
                <span className="faint">
                  Somebody runs them. You have not been close enough to hear who.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="row between" style={{ marginBottom: 4 }}>
            <span className="tiny">How much you know about them</span>
            <span className="tiny">{Math.round(read.intel)}%</span>
          </div>
          <Bar value={read.intel} tone="cold" />
          <p className="faint" style={{ marginTop: 6 }}>
            {read.intel >= 60
              ? 'You share enough ground to see what they are doing.'
              : read.intel >= 25
                ? 'You cross paths often enough to hear things.'
                : 'You would have to work the same streets to learn more.'}
          </p>

          <div style={{ marginTop: 12 }}>
            <KeyValue
              label="Toward you"
              value={relationshipLabel(standing)}
              tone={standing < -15 ? 'hot' : undefined}
            />
            {/*
              The three underneath the one. These are the questions that used
              to be a single number and are not the same question: what they
              hold against you, whether they take you seriously, and whether
              they would rely on anything you said. A family can be top of the
              first and bottom of the third, and how you deal with them differs
              completely depending on which.
            */}
            <KeyValue
              label="Holding against you"
              value={levelBand(theirs.grudge, [
                'Nothing',
                'Something',
                'A great deal',
                'Everything',
              ])}
              tone={theirs.grudge > 40 ? 'hot' : undefined}
            />
            <KeyValue
              label="Take you seriously"
              value={signedBand(theirs.respect, [
                'Not at all',
                'Barely',
                'They have not decided',
                'They do',
                'Completely',
              ])}
            />
            <KeyValue
              label="Would rely on you"
              value={signedBand(theirs.trust, [
                'Never',
                'Not really',
                'Nothing to go on',
                'Probably',
                'Without asking',
              ])}
              tone={theirs.trust < -20 ? 'hot' : undefined}
            />
            <KeyValue label="Money" value={read.wealth} />
            <KeyValue label="Muscle" value={read.strength} />
            <KeyValue label="Their own attention" value={read.heat} />
            <KeyValue label="Apparently" value={read.objective} />
          </div>
        </div>

        <div>
          <div className="tiny" style={{ marginBottom: 6 }}>
            Where you are both standing
          </div>
          {shared.length === 0 ? (
            <p className="faint" style={{ margin: 0 }}>
              Nowhere. You have not run into each other yet.
            </p>
          ) : (
            shared.map((t) => {
              const mine = playerInfluence(t);
              const theirs = factionInfluence(t, faction.id);
              return (
                <div className="kv" key={t.id}>
                  <span className="kv-key">{territoryDef(t.id).name}</span>
                  <span className={mine >= theirs ? 'kv-val good' : 'kv-val hot'}>
                    {Math.round(mine)} v {Math.round(theirs)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="tiny" style={{ margin: '18px 0 6px' }}>
        Who they think has been doing this to them
      </div>
      {suspicions.length === 0 ? (
        <Empty>
          {read.intel >= 25
            ? 'Nothing they are willing to say out loud.'
            : 'You are not close enough to them to hear what they think.'}
        </Empty>
      ) : (
        <div style={{ marginBottom: 8 }}>
          {suspicions.map((s, i) => (
            <p
              key={i}
              className={s.aboutYou ? 'hot' : 'dim'}
              style={{ margin: '0 0 4px' }}
            >
              They blame {s.who} for {s.what}. {s.certainty}.
            </p>
          ))}
          {/*
            Deliberately no indication of whether they are right. A family that
            has spent two years blaming somebody else for your work is
            something you work out from what they do about it — printing it
            here would hand over the one thing worth deducing.
          */}
          <p className="faint" style={{ margin: '6px 0 0' }}>
            What they believe is not the same as what happened. They are working
            from what they could see.
          </p>
        </div>
      )}

      <Roster faction={faction} intel={read.intel} />

      <div className="tiny" style={{ margin: '18px 0 6px' }}>
        What you have actually seen them do
      </div>
      {read.known.length === 0 ? (
        <Empty>Nothing you were close enough to witness.</Empty>
      ) : (
        <div className="log" style={{ maxHeight: 220 }}>
          {read.known.map((action, i) => (
            <div
              key={i}
              className={`log-entry ${action.targetFactionId === 'player' ? 'failure' : ''}`}
            >
              <span className="log-day" title={formatShortDay(action.day)}>
                {action.day}
              </span>
              <span className="log-text">{action.detail}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * The men under the boss.
 *
 * A rival used to be four numbers and a reputation line; this is the part that
 * makes it an organization. Names and districts are always visible — these are
 * men with restaurants and funerals — and what they think of their boss needs
 * somebody to have been paying attention, which in this game means standing on
 * the same ground as them.
 *
 * The approach is the only route into a rival that is not a war, and the odds
 * are shown honestly. Every other hidden quantity here is fogged; this one is
 * not, because the player is being asked to bet a fifth of a million and a
 * grudge on a single roll, and a bet whose odds you cannot see is a slot
 * machine rather than a decision.
 */
function Roster({ faction, intel }: { faction: Faction; intel: number }) {
  const state = useGame();
  const roster = readCapos(state, faction.id, intel);
  const [note, setNote] = useState<string | null>(null);

  const facts = {
    respect: state.org.respect,
    fear: state.org.fear,
    intel,
    funds: totalFunds(state),
    priceLevel: prices(state),
  };

  return (
    <>
      <div className="tiny" style={{ margin: '18px 0 6px' }}>
        Who runs what for them
      </div>
      {roster.length === 0 ? (
        <Empty>
          Nobody is left under them. A boss with no capos is a boss with nobody to send.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Runs</th>
                <th>Behind them</th>
                <th>Standing with the boss</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roster.map(({ capo, where, size, standing, wants }) => {
                const check = canApproach(state, faction.id, capo.id, facts);
                return (
                  <tr key={capo.id}>
                    <td>
                      <div className="name-cell">
                        <span className="name-main">{capo.name}</span>
                        <span className="name-sub">{capo.age}</span>
                      </div>
                    </td>
                    <td className="dim">
                      {where ? territoryDef(where).name : 'nothing of their own'}
                    </td>
                    <td className="dim">{size}</td>
                    <td className={standing === 'not happy' ? 'hot' : 'dim'}>
                      {standing ?? 'you would have to know them better'}
                      {wants && <span className="tiny faint"> · {wants}</span>}
                    </td>
                    <td>
                      <button
                        className="btn small"
                        disabled={!check.ok}
                        title={
                          check.ok
                            ? `${formatMoney(check.cost)}, and roughly ${Math.round(check.chance * 100)}% that they say yes. If they say no they tell their boss.`
                            : check.message
                        }
                        onClick={() =>
                          mutate((s) => {
                            const c = canApproach(s, faction.id, capo.id, {
                              respect: s.org.respect,
                              fear: s.org.fear,
                              intel,
                              funds: totalFunds(s),
                              priceLevel: prices(s),
                            });
                            if (!c.ok) return;
                            const outcome = approachCapo(
                              s,
                              new Rng(s.rng),
                              faction.id,
                              capo.id,
                              c.chance,
                              spend(s, c.cost),
                            );
                            setNote(outcome.message);
                          }, true)
                        }
                      >
                        {check.ok
                          ? `Make an offer — ${formatMoney(check.cost)}`
                          : 'Not possible'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {note && (
        <p className="hot" style={{ marginBottom: 0 }}>
          {note}
        </p>
      )}
    </>
  );
}
