/** Shared presentational pieces. No game logic lives here. */

import { useState, type ReactNode } from 'react';
import type { Npc, NpcStatId } from '../sim/types';
import { perceive } from '../sim/npc';
import { currentSkin, setSkin } from './skin';
import { ROLE_WAGE } from '../config/economy';

/**
 * The skin toggle, wherever the game happens to be.
 *
 * It used to live only in the stat bar, which renders only during a game —
 * so anyone who left the terminal skin on and then quit to the title screen
 * had no way back to the ledger short of clearing localStorage. A setting
 * that persists across sessions has to be reachable from every screen that
 * can be the first one you see, and this game has three.
 */
export function SkinToggle() {
  const [skin, setSkinState] = useState(currentSkin);

  const toggle = () => {
    // Read from the module rather than from `skin`, which is a render behind.
    // Two clicks inside one frame — a double-click, a held key — both computed
    // the next value from the same stale state and cancelled each other out.
    const next = currentSkin() === 'crt' ? 'ledger' : 'crt';
    setSkin(next);
    setSkinState(next);
  };

  return (
    <button
      className={skin === 'crt' ? 'statbar-mute' : 'statbar-mute off'}
      onClick={toggle}
      aria-pressed={skin === 'crt'}
      title={
        skin === 'crt' ? 'Terminal. Click for the ledger.' : 'The ledger. Click for a terminal.'
      }
    >
      crt
    </button>
  );
}

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
 * Reads their *perceived* greed, never the real number. When you do not know a
 * man, you do not know whether he thinks he is underpaid.
 */
export function payRead(npc: Npc): { text: string; tone: string } {
  const greed = perceive(npc, 'greed');
  if (!greed.known) return { text: 'no idea what they expect', tone: 'faint' };
  const base = ROLE_WAGE[npc.role];
  const expected = base * (0.75 + ((greed.bandIndex * 20 + 10) / 100) * 0.5);
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
      return <span className="tag">Available</span>;
  }
}
