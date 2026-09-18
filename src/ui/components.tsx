/** Shared presentational pieces. No game logic lives here. */

import type { ReactNode } from 'react';
import type { GameState, Npc, NpcStatId } from '../sim/types';
import type { TransmissionMethod } from '../config/tradecraft';
import { perceive, wageExpectation } from '../sim/npc';

export function Panel({
  title,
  action,
  children,
  flush,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <span className="panel-title">{title}</span>
        {action}
      </header>
      <div className={flush ? 'panel-body flush' : 'panel-body'}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function KeyValue({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: ReactNode;
  tone?: 'brass' | 'hot' | 'good' | 'cold';
  /** What the number means, for rows where the name is not enough. */
  title?: string;
}) {
  return (
    <div className="kv" title={title}>
      <span className="kv-key">{label}</span>
      <span className={tone ? `kv-val ${tone}` : 'kv-val'}>{value}</span>
    </div>
  );
}

export function Bar({
  value,
  max = 100,
  tone,
}: {
  value: number;
  max?: number;
  tone?: 'ok' | 'hot' | 'cold';
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar">
      <div className={tone ? `bar-fill ${tone}` : 'bar-fill'} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * A reading on a scale that has named bands, drawn as those bands.
 *
 * The difference from `Bar` is what the unfilled part says. A bar's empty
 * remainder is blank, so it answers "how far along am I" and nothing else —
 * but the question a player actually asks about heat is "am I in the red",
 * and they ask it long before they ask what the number is. Segments carry
 * their band's colour whether or not they are lit, so the danger ahead is
 * visible from a reading that has not reached it yet.
 *
 * `severityAt` is asked about the middle of each segment rather than about
 * the current value, which is what makes the unlit half meaningful. Callers
 * pass the band function belonging to whatever they are drawing; heat passes
 * `heatSeverity`, which derives its edges from the tiers rather than from
 * thirds. See the note on that function.
 *
 * Hidden from assistive technology on purpose. Everywhere this is used the
 * figure and its band name are already printed beside it in text, so the
 * gauge is a second telling of something a screen reader has just read.
 */
export function Gauge({
  value,
  max = 100,
  segments = 20,
  severityAt,
}: {
  value: number;
  max?: number;
  segments?: number;
  severityAt: (at: number) => 'ok' | 'warn' | 'hot';
}) {
  const share = Math.max(0, Math.min(1, value / max));
  /*
     Rounded, not floored. A floor leaves the gauge completely dark for the
     whole of the first band — nought to ten on a twenty-segment scale is less
     than one segment — and a meter that reads empty while the number beside it
     reads eight is the meter being wrong.
  */
  const lit = value > 0 ? Math.max(1, Math.round(share * segments)) : 0;

  return (
    <div className="gauge" aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => {
        const middle = ((i + 0.5) / segments) * max;
        const classes = ['gauge-seg', severityAt(middle)];
        if (i < lit) classes.push('lit');
        return <i key={i} className={classes.join(' ')} />;
      })}
    </div>
  );
}

/**
 * How the player reads a person.
 *
 * Shows a phrase and five coarse pips — never the underlying number. Someone
 * you barely know reads as unknown, and that is the point: you have to decide
 * whether to trust them before you can be sure.
 */
/**
 * Whether they think they are paid enough, read through the fog.
 *
 * Lives here rather than on the crew sheet because the memo that asks you for
 * a raise needs the same answer, and round 14 spent 300 days deciding about
 * people from the top two rows of a table: "I was clicking the top two rows of
 * a crew table because they were the top two rows, not because I knew who they
 * were."
 *
 * The fog gates whether you get a reading at all — you do not know if a
 * stranger feels underpaid — but once greed is known, the reading itself
 * uses the real `wageExpectation(state, npc)`, the same figure
 * `loyaltyPressures` compares against. It used to re-derive an approximation
 * from the perceived greed band, anchored to the nominal role wage with no
 * price indexation and no trait effects — which meant a wage that kept pace
 * with inflation could still read "paid well" long after the man himself, by
 * the game's own math, had started thinking he was worth more.
 */
export function payRead(state: GameState, npc: Npc): { text: string; tone: string } {
  const greed = perceive(npc, 'greed');
  if (!greed.known) return { text: 'no idea what they expect', tone: 'faint' };
  const expected = wageExpectation(state, npc);
  if (npc.wage >= expected * 1.15) return { text: 'paid well', tone: 'good' };
  if (npc.wage >= expected * 0.95) return { text: 'paid fairly', tone: 'dim' };
  return { text: 'thinks they are worth more', tone: 'hot' };
}

export function StatRead({
  npc,
  stat,
  warnHigh,
}: {
  npc: Npc;
  stat: NpcStatId;
  /** Marks high values as a concern rather than an asset (greed, ambition). */
  warnHigh?: boolean;
}) {
  const read = perceive(npc, stat);
  if (!read.known) {
    return <span className="read-unknown">not yet</span>;
  }
  const warn = warnHigh && read.bandIndex >= 3;
  return (
    <span className="read">
      <span className="pips" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={i <= read.bandIndex ? `pip on${warn ? ' warn' : ''}` : 'pip'}
          />
        ))}
      </span>
      <span className="read-band">{read.band}</span>
    </span>
  );
}

export function StatusTag({ npc, day }: { npc: Npc; day: number }) {
  const left = npc.unavailableUntilDay ? npc.unavailableUntilDay - day : 0;
  switch (npc.status) {
    case 'busy':
      return <span className="tag busy">On a job</span>;
    case 'injured':
      return <span className="tag injured">Hurt · {left}d</span>;
    case 'arrested':
      return <span className="tag arrested">Held · {left}d</span>;
    case 'defected':
      return <span className="tag">Gone</span>;
    case 'dead':
      return <span className="tag injured">Dead</span>;
    case 'boss':
      return <span className="tag">Runs it now</span>;
    default:
      if (npc.stats.grievance >= 55) {
        return <span className="tag injured" title="Carrying a grievance. Sit down with them.">Grudge</span>;
      }
      return <span className="tag">Available</span>;
  }
}

/**
 * How the order gets said, which is the part of a killing that goes on tape.
 *
 * Shared by `RivalsPanel` and `LawPanel` rather than written twice, because
 * they are the same decision about people of different sizes — the same
 * reason `ContractButton` is one component for a capo and for the man above
 * him. Two files would drift, and the copy here is the only place the player
 * is told what either method costs.
 *
 * It says both prices unconditionally and it does not pretend to a number it
 * cannot know: the misfire chance is a fact about whoever is standing in
 * front of you (`misfireChance` in `sim/tradecraft.ts` reads his discipline
 * and his traits), so the panel names the risk and refuses to invent a
 * percentage for it. See rule 2 — a figure on screen has to be the figure the
 * sim uses, and this one varies per man.
 */
export function TradecraftToggle({
  method,
  onChange,
}: {
  method: TransmissionMethod;
  onChange: (next: TransmissionMethod) => void;
}) {
  const walking = method === 'walk_and_talk';
  return (
    <div style={{ marginBottom: 6 }}>
      <div className="tiny faint" style={{ marginBottom: 3 }}>
        How it gets said
      </div>
      <div className="carry-row">
        <button
          className={walking ? 'btn small ghost' : 'btn small'}
          onClick={() => onChange('phone_euphemism')}
        >
          Phone call
        </button>
        <button
          className={walking ? 'btn small' : 'btn small ghost'}
          onClick={() => onChange('walk_and_talk')}
        >
          Walk in the woods
        </button>
      </div>
      <p className="tiny faint" style={{ margin: '3px 0 0' }}>
        {walking
          ? 'An hour round the block and your evening is gone. Nothing said on a sidewalk ' +
            'reaches a reel, and nobody mishears a man looking at his face.'
          : 'Costs nothing and takes no time. If anybody has a wire up it goes onto a reel in ' +
            'your own voice, and a man who has to be told in metaphor can take the metaphor ' +
            'the wrong way.'}
      </p>
    </div>
  );
}
