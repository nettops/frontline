import { useState } from 'react';
import { useGame, mutate } from '../store';
import { useCounter } from './motion';
import { isMuted, play, setMuted } from './audio';
import { crewList } from '../sim/npc';
import { formatDay, formatMoneyShort } from '../sim/util';
import { isLayingLow } from '../sim/heat';
import { activeWars, factionStrength } from '../sim/diplomacy';
import { rivals } from '../sim/faction';
import { districtOwner, territoryList } from '../sim/territory';
import { SkinToggle } from './components';
import { setTipsOff, tipsOff } from './tips';
import { RANK_BY_ID } from '../config/economy';
import { CAREER_STEPS, MODE_BY_ID, SIMULATION_STEPS } from '../config/modes';
import { heatTier } from '../config/heat';
import { houseShort } from '../sim/houses';

/**
 * A figure that counts toward its new value and briefly takes the colour of
 * the direction it moved. Up is not always good — heat passes `invert` — so
 * the colour is decided per figure rather than by the sign.
 */
function Stat({
  label,
  value,
  format,
  tone,
  title,
  invert,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  tone?: string;
  title?: string;
  invert?: boolean;
}) {
  const { value: shown, dir } = useCounter(value);
  const move = dir && (invert ? (dir === 'up' ? 'down' : 'up') : dir);
  return (
    <div className="stat" title={title}>
      <div className="stat-label">{label}</div>
      <div className={['stat-value', tone, move && `moved-${move}`].filter(Boolean).join(' ')}>
        {format(shown)}
      </div>
    </div>
  );
}

/**
 * What the top of the screen says when there is no organization to report on.
 *
 * Simulation has a player-shaped hole in it, and five zeroes where the money
 * and the crew go is not a neutral display — it reads as an organization doing
 * catastrophically badly. So the same strip reports on the city instead, which
 * is the thing you are actually watching.
 */
function CityStats() {
  const state = useGame();
  const wars = activeWars(state);
  const families = rivals(state);
  const strongest = [...families].sort(
    (a, b) => factionStrength(state, b.id) - factionStrength(state, a.id),
  )[0];
  const held = territoryList(state).filter((t) => districtOwner(t)).length;

  return (
    <div className="statbar-stats">
      <Stat
        label="Families"
        value={families.length}
        format={(n) => String(Math.round(n))}
        title="Organizations still standing"
      />
      <Stat
        label="Wars"
        value={wars.length}
        format={(n) => String(Math.round(n))}
        tone={wars.length > 0 ? 'hot' : undefined}
        title={
          wars.length
            ? wars.map(([a, b]) => `${houseShort(state, a)} v ${houseShort(state, b)}`).join(', ')
            : 'Nobody is shooting at anybody'
        }
        invert
      />
      <Stat
        label="Districts settled"
        value={held}
        format={(n) => `${Math.round(n)}/${territoryList(state).length}`}
        title="Districts a family actually holds, rather than merely leads"
      />
      <Stat
        label="Outrage"
        value={state.city.outrage}
        format={(n) => String(Math.round(n))}
        tone={state.city.outrage > 45 ? 'hot' : undefined}
        title="What the city thinks about crime this season. Nobody is playing, so this is entirely the families' doing."
        invert
      />
      <div className="stat" title="Strongest right now — it moves">
        <div className="stat-label">On top</div>
        <div className="stat-value brass">
          {strongest ? houseShort(state, strongest.id) : '—'}
        </div>
      </div>
    </div>
  );
}

export default function StatBar({ onStep }: { onStep: (days: number) => void }) {
  const state = useGame();
  const { org, player } = state;
  const [muted, setMutedState] = useState(isMuted);
  const tier = heatTier(org.heat);
  const crew = crewList(state).length;
  /*
     Both things that stop the clock, not just the one with a modal.

     `step()` in App.tsx guards on a memo *and* on an open sit-down, and only
     the memo had a matching disabled button. So during a conversation the
     button stayed lit, kept its ordinary "Advance one day (space)" tooltip,
     and silently did nothing — which a round-7 tester filed after trying both
     the click and the spacebar. The guard is right; the control was lying
     about it.
  */
  const waiting = state.pendingEvents.length > 0;
  const talking = !!state.sitdown;
  const blocked = waiting || talking;
  const watching = state.mode === 'simulation';
  const quiet = tipsOff(state);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    // Turning it back on should demonstrate what you turned back on.
    if (!next) play('tick');
  };

  return (
    <header className="statbar">
      <div className="statbar-identity">
        <div className="statbar-name">{watching ? 'The city' : player.name}</div>
        <div className="statbar-rank">
          {watching ? MODE_BY_ID[state.mode].name : RANK_BY_ID[player.rank].name}
          {state.mode === 'sandbox' && ' · sandbox'}
        </div>
      </div>

      {watching ? (
        <CityStats />
      ) : (
      <div className="statbar-stats">
        <Stat
          label="Clean"
          value={org.cash}
          format={formatMoneyShort}
          tone="brass"
          title="Laundered money. Safe to spend and safe to be seen with."
        />
        <Stat
          label="Dirty"
          value={org.dirtyCash}
          format={formatMoneyShort}
          tone="dirty"
          title="Criminal proceeds. Spent first on criminal work and wages."
        />
        <Stat
          label="Respect"
          value={org.respect}
          format={(n) => String(Math.floor(n))}
          title="Standing. What people do for you because they want to — rank, recruits, alliances, and who the room follows when you are gone. Earned by work that lands, and every week by the districts and fronts you hold."
        />
        <Stat
          label="Fear"
          value={org.fear}
          format={(n) => String(Math.round(n))}
          tone={org.fear > 45 ? 'hot' : undefined}
          title="What people do for you because of the alternative. Keeps witnesses quiet and people from walking out — and costs you with the neighbourhood, the city, and anybody who had a choice."
        />
        <Stat
          label="Heat"
          value={org.heat}
          format={(n) => String(Math.round(n))}
          tone={org.heat > 40 ? 'hot' : undefined}
          title={`${tier.name} — ${tier.description}`}
          invert
        />
        <Stat label="Crew" value={crew} format={(n) => String(Math.round(n))} />
      </div>
      )}

      <div className="statbar-clock">
        <div>
          <div className="clock-date">{formatDay(state.day)}</div>
          <div className="clock-day">
            Day {state.day}
            {isLayingLow(state) ? ' · laying low' : ''}
          </div>
        </div>
        <button
          className={muted ? 'statbar-mute off' : 'statbar-mute'}
          onClick={toggleSound}
          aria-pressed={!muted}
          title={muted ? 'Sound is off' : 'Sound is on'}
        >
          sound
        </button>
        {/*
          Sits beside sound because it is the same kind of setting: a thing you
          set once, on a whim, that the simulation never hears about. There is
          no settings screen in this game and adding one for two booleans would
          be a worse interface than two buttons.
        */}
        <SkinToggle />
        {/*
          Unlike sound and the skin this one is per-save, because what it
          really switches is a body of advice the save is halfway through —
          turning tips on in a fresh career and off in a five-year-old one is
          the behaviour you want, not a preference to be argued with.
        */}
        {/*
          "hints", against the rail's "Advice", because they were both "Tips".

          One of them stops the game offering guidance and the other opens the
          page where every piece of it is kept — two entirely different jobs
          under one word, in two places on screen at once. A round-7 tester
          listed it as two controls named the same thing. The button also now
          reads its own state rather than relying on a tooltip nobody hovers.
        */}
        <button
          className={quiet ? 'statbar-mute off' : 'statbar-mute'}
          onClick={() => mutate((s) => setTipsOff(s, !quiet), true)}
          aria-pressed={!quiet}
          title={quiet ? 'Hints are off. Turn them back on.' : 'Hints are on. Silence them.'}
        >
          {quiet ? 'hints off' : 'hints'}
        </button>
        {watching ? (
          // Watching a city one day at a time is not watching a city. Nothing
          // is waiting on an answer here, so nothing needs the smaller steps.
          SIMULATION_STEPS.map((step, i) => (
            <button
              key={step.label}
              className={i === SIMULATION_STEPS.length - 1 ? 'btn small primary' : 'btn small'}
              onClick={() => onStep(step.days)}
              title={`Run the city for ${step.label.replace('+1 ', 'another ')}`}
            >
              {step.label}
            </button>
          ))
        ) : (
          CAREER_STEPS.map((step) => (
            <button
              key={step.label}
              className={step.primary ? 'btn small primary' : 'btn small'}
              onClick={() => onStep(step.days)}
              disabled={blocked}
              title={
                waiting
                  ? 'Something is waiting for your answer'
                  : talking
                    ? 'You are in a room with somebody. The day waits.'
                  : step.days === 1
                    ? 'Advance one day (space)'
                    : `Advance up to ${step.label.replace('+1 ', 'a ')} — stops when something happens${
                        step.days === 7 ? ' (W)' : ''
                      }`
              }
            >
              {step.label}
            </button>
          ))
        )}
      </div>
    </header>
  );
}
