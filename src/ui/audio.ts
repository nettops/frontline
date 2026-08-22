/**
 * Sound.
 *
 * There is not a single audio file in this repository. Every cue below is
 * synthesised from an oscillator or a burst of filtered noise at the moment it
 * plays. That is partly to keep the build honest — no megabytes of samples for
 * a game that is mostly tables — but mostly because of what these cues are.
 *
 * They are not music and they are not game chimes. They are the noises of a
 * back room in 1978: a drawer, a rubber stamp, a page turning, a phone ringing
 * in somebody else's office. Noises like that are short, dry and mostly
 * midrange, which is exactly what two nodes and an envelope are good at.
 *
 * The other reason: a cue defined by numbers can be tuned the same way every
 * other number in this project is tuned. If a cue is annoying, it is annoying
 * at a frequency and a duration you can edit.
 */

export type Cue =
  /** A day passes. Deliberately almost nothing — you will hear it a lot. */
  | 'tick'
  /** A week passes. A page turning. */
  | 'week'
  /** A memo lands on the desk. */
  | 'memo'
  /** Money came in. */
  | 'money'
  /** Something went your way. */
  | 'good'
  /** Something did not. */
  | 'bad'
  /** Something you cannot ignore: a case moving, a war, a body. */
  | 'alarm';

/**
 * Overall level. Low on purpose: these fire on every click of the day button,
 * and a cue you notice every time is a cue you turn off.
 */
import { KEYS, read, write } from '../storage';

const MASTER = 0.18;

const STORAGE_KEY = KEYS.muted;

let muted = readMuted();
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function readMuted(): boolean {
  return read(STORAGE_KEY) === '1';
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  // Failure here is a private window, and a setting that does not persist is
  // the correct outcome rather than an error worth surfacing.
  write(STORAGE_KEY, next ? '1' : '0');
}

/**
 * The context is created on first play, never at import.
 *
 * Browsers refuse to start audio until the user has interacted with the page,
 * and every cue in this game is downstream of a click, so by the time this is
 * first called the gesture has already happened.
 */
function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== c.sampleRate) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

interface ToneOpts {
  freq: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  /** Slide to this frequency across the note. Falling reads as weight. */
  glideTo?: number;
  delay?: number;
}

/** One oscillator with a percussive envelope. */
function tone(c: AudioContext, o: ToneOpts): void {
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t + o.dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(o.gain * MASTER, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

interface HissOpts {
  freq: number;
  dur: number;
  gain: number;
  /** Filter width. Low Q is airy (paper); high Q is a dry click (a switch). */
  q?: number;
  glideTo?: number;
  delay?: number;
}

/** Filtered noise. Paper, drawers, the click of a dial returning. */
function hiss(c: AudioContext, o: HissOpts): void {
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(o.freq, t);
  filter.Q.value = o.q ?? 1;
  if (o.glideTo) filter.frequency.exponentialRampToValueAtTime(o.glideTo, t + o.dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(o.gain * MASTER, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + o.dur + 0.02);
}

const CUES: Record<Cue, (c: AudioContext) => void> = {
  // A switch closing. Short enough that a player advancing thirty days in a row
  // hears a rhythm rather than thirty interruptions.
  tick: (c) => hiss(c, { freq: 2400, dur: 0.04, gain: 0.45, q: 2.5 }),

  // A page turning: broadband noise swept downward, plus the soft knock of the
  // page settling.
  week: (c) => {
    hiss(c, { freq: 1800, dur: 0.17, gain: 0.4, q: 0.6, glideTo: 420 });
    tone(c, { freq: 96, dur: 0.09, gain: 0.35, delay: 0.11 });
  },

  // Paper landing on a desk, then the desk.
  memo: (c) => {
    hiss(c, { freq: 3200, dur: 0.2, gain: 0.55, q: 0.5, glideTo: 650 });
    tone(c, { freq: 72, dur: 0.13, gain: 0.5, delay: 0.05 });
  },

  // A till. Two notes, low, close together — counted rather than celebrated.
  money: (c) => {
    tone(c, { freq: 392, dur: 0.1, gain: 0.35, type: 'triangle' });
    tone(c, { freq: 588, dur: 0.16, gain: 0.3, type: 'triangle', delay: 0.07 });
  },

  // A stamp coming down on a page that says yes.
  good: (c) => {
    tone(c, { freq: 196, dur: 0.14, gain: 0.5, type: 'triangle' });
    tone(c, { freq: 294, dur: 0.2, gain: 0.4, type: 'triangle', delay: 0.06 });
  },

  // The same stamp, on a page that does not.
  bad: (c) => {
    hiss(c, { freq: 1200, dur: 0.06, gain: 0.4, q: 1.2 });
    tone(c, { freq: 150, dur: 0.28, gain: 0.6, glideTo: 68 });
  },

  // Not a klaxon. A phone in the next office, which is worse.
  alarm: (c) => {
    tone(c, { freq: 240, dur: 0.13, gain: 0.4, type: 'square' });
    tone(c, { freq: 240, dur: 0.13, gain: 0.4, type: 'square', delay: 0.19 });
    tone(c, { freq: 110, dur: 0.34, gain: 0.3, delay: 0.02 });
  },
};

export function play(cue: Cue): void {
  const c = audio();
  if (!c) return;
  try {
    CUES[cue](c);
  } catch {
    /* an audio failure is never worth interrupting a turn for */
  }
}
