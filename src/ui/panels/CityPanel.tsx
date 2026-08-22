import { useGame, mutate } from '../../store';
import { Panel, Empty, KeyValue } from '../components';
import { buyPatron, canBuyPatron, readCity } from '../../sim/perception';
import { formatMoney, formatShortDay } from '../../sim/util';
import { PATRON, CITY_INTEL } from '../../config/perception';

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
