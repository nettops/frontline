import { useEffect, useRef } from 'react';
import { useGame, mutate } from '../store';
import { play } from './audio';
import { Rng } from '../sim/rng';
import {
  chooseRegister,
  clearSitdown,
  endSitdown,
  houseRead,
  patienceRead,
  sitdownOptions,
} from '../sim/sitdown';
import { perceive } from '../sim/npc';
import { houseName } from '../sim/houses';
import { formatShortDay } from '../sim/util';
import { QUESTION_BY_ID, REASON_BY_ID, REGISTER_BY_ID } from '../config/sitdown';
import { ROLE_LABEL } from '../config/economy';
import { READABLE_STATS } from '../config/npcs';
import type { FactionId } from '../config/factions';
import type { NpcStatId } from '../sim/types';

/**
 * The back room.
 *
 * Deliberately not paper. The memo is the only light surface in this game and
 * it means one specific thing — a document has been handed to you. A
 * conversation is not that, and dressing it as one would cost the memo the
 * thing that makes it land. So this is the opposite end of the same idea: the
 * darkest surface in the game, one lamp, one person, and everything else gone.
 *
 * What the player is choosing against is the same hedged perception language
 * as the crew sheet — "seems loyal", "thinks he is worth more". There they are
 * a readout. Here they are the only thing you have.
 */

/** The stats worth showing as chips, in the order they read best. */
const CHIPS: NpcStatId[] = ['loyalty', 'greed', 'fear', 'ambition'];

function plural(n: number, one: string): string {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

function timeIn(days: number): string {
  return days >= 365 ? `${plural(Math.floor(days / 365), 'year')} in` : `${plural(days, 'day')} in`;
}

function toneFor(stat: NpcStatId, bandIndex: number): string {
  if (bandIndex < 0) return 'unknown';
  if (stat === 'loyalty') return bandIndex >= 3 ? 'good' : bandIndex <= 1 ? 'bad' : 'plain';
  if (stat === 'greed' || stat === 'ambition') return bandIndex >= 3 ? 'want' : 'plain';
  if (stat === 'fear') return bandIndex >= 3 ? 'bad' : 'plain';
  return 'plain';
}

/**
 * `onDone` is the same day-step the buttons and the spacebar use, handed down
 * rather than reimplemented, so a day spent in a room produces the identical
 * briefing as any other day — and so the room cannot become a way of getting
 * free time with the crew.
 */
export default function SitdownModal({ onDone }: { onDone: (days: number) => void }) {
  const state = useGame();
  const sit = state.sitdown ?? null;
  const choices = useRef<HTMLDivElement>(null);
  const npc = sit?.npcId ? state.npcs[sit.npcId] : null;

  const say = (registerId: string) => {
    let landed = false;
    mutate((s) => {
      chooseRegister(s, new Rng(s.rng), registerId);
      landed = s.sitdown?.beats.at(-1)?.landed ?? false;
    }, true);
    // The one place the game tells you outright whether a read was right. The
    // prose is doing the work; this is only underneath it.
    play(landed ? 'good' : 'tick');
  };

  const walkOut = () => {
    const finished = state.sitdown?.done ?? false;
    mutate((s) => {
      if (s.sitdown && !s.sitdown.done) endSitdown(s);
      else clearSitdown(s);
    }, true);
    // Walking out of an unfinished room shows you the outcome first; closing
    // the door afterwards is what actually spends the day.
    if (finished) onDone(1);
  };

  useEffect(() => {
    if (!sit) return;
    choices.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [sit?.beats.length, sit?.done]);

  // Numbers answer, escape leaves. Same contract as the memo, because by the
  // time a player reaches this they have answered a hundred memos.
  useEffect(() => {
    if (!sit) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        walkOut();
        return;
      }
      if (sit.done) return;
      const option = sitdownOptions(state)[Number(e.key) - 1];
      if (!option || option.disabledReason) return;
      e.preventDefault();
      say(option.def.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sit, state]);

  if (!sit) return null;

  const reason = REASON_BY_ID[sit.reasonId];
  const options = sitdownOptions(state);
  const name = npc
    ? npc.name
    : sit.factionId
      ? houseName(state, sit.factionId as FactionId)
      : 'Somebody';

  const subtitle = npc
    ? `${ROLE_LABEL[npc.role]} · ${timeIn(npc.daysInCrew)} · you know them ${Math.round(npc.familiarity)}%`
    : (state.factions[sit.factionId ?? '']?.leader?.name ?? 'The other house');

  return (
    <div className="room-backdrop" role="dialog" aria-modal="true" aria-label={`Sit-down with ${name}`}>
      <article className="room">
        <header className="room-head">
          <span>the back room · {formatShortDay(state.day)}</span>
          <span>
            {/*
                 What used to be "exchange 2 of 3" — a budget counting down on
                 the game's schedule. It is his patience now, read the way
                 every other hidden thing in this game is read: a phrase, never
                 a number. This is the only thing the decision to stand up is
                 made against.
              */}
            {sit.done
              ? sit.walkedOut
                ? 'they left'
                : 'the room is empty'
              : patienceRead(sit)}
          </span>
        </header>

        <div className="room-who">
          <h2 className="room-name">{name}</h2>
          <p className="room-sub">{subtitle}</p>

          {/*
             The only thing the player has to choose against. A man is read
             through `perceive`, so the words are noisy and sharpen as you work
             with him; a house is read off its leader, where the uncertainty is
             coarseness rather than noise. Same vocabulary either way — the
             point is that neither of them is ever a number.
          */}
          <div className="room-chips">
            {npc
              ? CHIPS.filter((s) => READABLE_STATS.includes(s)).map((stat) => {
                  const read = perceive(npc, stat);
                  return (
                    <span key={stat} className={`room-chip ${toneFor(stat, read.bandIndex)}`}>
                      {read.known ? read.band : 'you cannot tell'}
                    </span>
                  );
                })
              : sit.factionId
                ? houseRead(state, sit.factionId as FactionId).map((read, i) => (
                    <span key={i} className={`room-chip ${read.tone}`}>
                      {read.text}
                    </span>
                  ))
                : null}
          </div>

          {reason && <p className="room-why">{reason.blurb}</p>}
        </div>

        <div className="room-talk">
          {sit.beats.length === 0 && !sit.done && (
            <p className="room-quiet">They wait for you to start.</p>
          )}
          {/*
             An exchange, not a result card.

             This printed the register's *label* above the response prose, so
             what a boss read down the page was a list of menu choices and
             their outcomes. Your half of it was never on the screen at all.

             Now each beat is two turns: what you said, then what came back.
             `says` renders as speech and `does` as action, because some moves
             are not words — `listen` is the whole point of the mechanic and
             has no line to give.

             The landed/missed distinction stays on the reply rather than on
             the pair, since that is what it describes: how the room took it.
          */}
          {sit.beats.map((beat, i) => {
            const reg = REGISTER_BY_ID[beat.registerId];
            return (
              <div key={i} className="room-exchange">
                {reg?.says ? (
                  <p className="room-said">{reg.says}</p>
                ) : (
                  <p className="room-did">{reg?.does ?? reg?.label ?? ''}</p>
                )}
                <p className={beat.landed ? 'room-reply landed' : 'room-reply'}>{beat.text}</p>
                {/*
                   And what he wants from you, if the beat ended with him
                   wanting something. Shown on the beat that asked rather than
                   floating above the buttons, so the transcript reads in the
                   order the room happened — and so it is still legible after
                   you have answered it.
                */}
                {reg?.asks && beat.landed && (
                  <p className="room-asked">{QUESTION_BY_ID[reg.asks]?.text}</p>
                )}
              </div>
            );
          })}
          {sit.done && sit.outcome && <p className="room-outcome">{sit.outcome}</p>}
          {npc && (sit.done || sit.beats.length > 0) && (
            <p className="room-learned">
              you know them {sit.familiarityBefore}% → {Math.round(npc.familiarity)}%
            </p>
          )}
        </div>

        {!sit.done && (
          <div className="room-choices" ref={choices}>
            {options.map((option, i) => (
              <button
                key={option.def.id}
                className="room-choice"
                disabled={!!option.disabledReason}
                title={option.disabledReason ?? undefined}
                onClick={() => say(option.def.id)}
              >
                <span className="room-choice-key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="room-choice-label">{option.def.label}</span>
                <span className="room-choice-hint">
                  {option.disabledReason ?? option.def.hint}
                </span>
              </button>
            ))}
          </div>
        )}

        {/*
           You standing up, which is the decision the rework exists for.

           This read "walk away" with the note "leaving now costs nothing but
           the day" — the language of abandoning something, from when the
           conversation ended on a three-exchange count and going early meant
           forfeiting unspent beats.

           It is the opposite now. Ending it is the move: everything won is
           kept, and what you give up is only whatever the next question might
           have been. The one way this goes badly is him standing up first, so
           the words here have to read as a choice rather than an exit.
        */}
        <footer className="room-foot">
          <button className="room-leave" onClick={walkOut}>
            {sit.done ? 'close the door' : 'that is all'}
          </button>
          <span>
            {sit.done ? 'esc' : 'you keep what you have — esc'}
          </span>
        </footer>
      </article>
    </div>
  );
}
