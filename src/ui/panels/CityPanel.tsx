import { useGame, mutate } from '../../store';
import { useState } from 'react';
import { Panel, Empty, KeyValue, Bar } from '../components';
import { buyPatron, canBuyPatron, readCity } from '../../sim/perception';
import { formatMoney, formatShortDay } from '../../sim/util';
import { PATRON, CITY_INTEL } from '../../config/perception';
import { civicRead, spendFavour } from '../../sim/civic';

/**
 * The city as an audience.
 *
 * The headlines are the panel. Everything else on this screen is a hedged
 * phrase, because the three numbers underneath — outrage, notoriety, political
 * pressure — are exactly the kind of thing this game has never shown raw. What
 * you can always have is the newspaper, which is public; what you have to earn
 * with Influence is any sense of what the newspaper is doing to people.
 */
export default function CityPanel() {
  const state = useGame();
  const read = readCity(state);
  const influence = state.player.attributes.influence;
  const patron = canBuyPatron(state);

  return (
    <>
      <Favours />

      <div className="page-head">
        <h1 className="page-title">The City</h1>
        <span className="tiny">
          {read.stories.length > 0
            ? `Last printed ${formatShortDay(state.city.lastStoryDay)}`
            : 'Nothing about you has been printed'}
        </span>
      </div>

      <div className="grid-2">
        <Panel title="What people are saying">
          {read.mood ? (
            <>
              <KeyValue label="The mood" value={read.mood} />
              <KeyValue label="Your name" value={read.notoriety ?? '—'} />
            </>
          ) : (
            <p className="faint" style={{ margin: 0 }}>
              You read the same papers as everybody else and know exactly as much as
              everybody else. Somebody who talks to people — Influence{' '}
              {CITY_INTEL.moodNeedsInfluence} — could tell you what is behind them.
            </p>
          )}

          {read.pressure ? (
            <KeyValue label="City hall" value={read.pressure} />
          ) : (
            <p className="faint" style={{ marginBottom: 0 }}>
              What anybody in office intends to do about it is not something you are in
              a position to know. That takes Influence {CITY_INTEL.pressureNeedsInfluence}.
            </p>
          )}

          <p className="faint" style={{ marginTop: 12, marginBottom: 0 }}>
            The city reacting is slower than the city noticing. A fortnight of outrage
            does nothing, because nobody in a building has moved yet. Two months of it
            becomes a task force that is still there long after the city has stopped
            caring.
          </p>
        </Panel>

        <Panel title="Somebody in office">
          {read.patron ? (
            <>
              <KeyValue label="Arrangement" value="Holding" tone="good" />
              <p className="faint" style={{ marginBottom: 0 }}>
                There is a man in the building who takes your calls. Nothing about what
                the city thinks has changed — you cannot buy that. What the city is able
                to do about you is a different question, and they are the answer to it for
                another {Math.max(0, (state.city.patronUntilDay ?? 0) - state.day)} days.
              </p>
            </>
          ) : (
            <>
              <KeyValue label="Cost" value={formatMoney(PATRON.cost)} tone="brass" />
              <KeyValue label="Lasts" value={`${PATRON.days} days`} />
              <KeyValue
                label="Needs"
                value={`Influence ${PATRON.influenceRequired}`}
                tone={influence >= PATRON.influenceRequired ? 'good' : 'hot'}
              />
              <button
                className="btn primary"
                style={{ marginTop: 12 }}
                disabled={!patron.ok}
                title={patron.message}
                onClick={() => mutate((g) => buyPatron(g), true)}
              >
                Find somebody in office
              </button>
              {!patron.ok && (
                <p className="faint" style={{ marginTop: 8, marginBottom: 0 }}>
                  {patron.message}
                </p>
              )}
            </>
          )}
        </Panel>
      </div>

      <Panel title="The papers">
        {read.stories.length === 0 ? (
          <Empty>
            Nothing yet. A city that is not writing about you is a city you are working
            in correctly.
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Headline</th>
                <th className="num">Prominence</th>
              </tr>
            </thead>
            <tbody>
              {read.stories.map((story, i) => (
                <tr key={`${story.day}-${i}`}>
                  <td className="mono tiny">{formatShortDay(story.day)}</td>
                  <td>
                    <span className={story.named ? 'name-main hot' : 'name-main'}>
                      {story.headline}
                    </span>
                    {story.named && <div className="tiny faint">You were named.</div>}
                  </td>
                  <td className="num mono">{story.prominence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

/**
 * Who owes you, and what spending it would do.
 *
 * Above the headlines rather than below them, because F14 is the shape this
 * project keeps repeating: round 13 did not find the sit-down until day 300,
 * and round 12 found it on day 19, on the same build. A system nobody can see
 * is a system nobody has.
 *
 * Standing is a bar and a phrase rather than a number on its own. Everything
 * else in this game that describes how somebody feels about you goes through
 * a band, and a raw integer here would be the one place the player is handed
 * the truth about a person.
 */
function Favours() {
  const state = useGame();
  const [note, setNote] = useState<string | null>(null);
  const people = civicRead(state);
  const anyOwed = people.some((p) => p.owed > 0);

  return (
    <Panel title="People who are not in your family">
      <p className="dim" style={{ marginTop: 0 }}>
        {anyOwed
          ? 'Somebody owes you. It is worth knowing what for before you spend it.'
          : 'Nobody outside the family owes you anything yet. They are watching how you run it.'}
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Who</th>
              <th>Where you stand</th>
              <th className="num">Owed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="name-cell">{p.title}</div>
                  <div className="tiny faint">{p.blurb}</div>
                </td>
                <td style={{ minWidth: 140 }}>
                  <Bar value={p.standing} />
                  <div className="tiny faint">{p.grants}</div>
                </td>
                <td className="num mono">{p.owed}</td>
                <td style={{ minWidth: 190 }}>
                  <button
                    className="btn"
                    disabled={!!p.blocked}
                    onClick={() =>
                      mutate((s) => {
                        setNote(spendFavour(s, p.id).message);
                      })
                    }
                  >
                    Call it in
                  </button>
                  {/*
                     The reason renders as a refusal, in body text, not as a
                     tooltip. Iteration 5 closed F10 by taking exactly this
                     sentence out of a hover, and round 13 still clicked a
                     disabled button that looked like a description.
                  */}
                  {p.blocked && <div className="tiny memo-choice-blocked">{p.blocked}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && (
        <p className="hot" style={{ margin: '10px 14px 0' }}>
          {note}
        </p>
      )}
    </Panel>
  );
}
