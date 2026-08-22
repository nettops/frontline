/**
 * Seeded, resumable RNG.
 *
 * The generator is stateless given (seed, calls) — the value for call N is a
 * pure hash of seed and N. That means the whole RNG lives in two numbers we
 * can save to disk, and loading a save resumes the exact same random stream.
 * Determinism is load-bearing: Ironman mode, reproducible bug reports, and the
 * soak test all depend on it.
 */

export interface RngState {
  seed: number;
  calls: number;
}

/** murmur3 finalizer — cheap, well-distributed, int32-safe. */
function hash32(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

export class Rng {
  constructor(private state: RngState) {}

  /** Uniform in [0, 1). */
  next(): number {
    this.state.calls += 1;
    // imul keeps the mix in int32 range — plain multiplication would lose
    // precision past ~3M calls and silently degrade the stream.
    const mixed = Math.imul(this.state.calls, 0x9e3779b9) ^ this.state.seed;
    return hash32(mixed) / 4294967296;
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max], inclusive both ends. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Picks `count` distinct items. Returns fewer if the pool is smaller. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    while (out.length < count && pool.length > 0) {
      out.push(pool.splice(this.int(0, pool.length - 1), 1)[0]);
    }
    return out;
  }

  /**
   * Roughly bell-curved integer in [min, max] — averages three rolls.
   * Used for NPC stats so most people are average and extremes are rare.
   */
  bell(min: number, max: number): number {
    const a = this.float(min, max);
    const b = this.float(min, max);
    const c = this.float(min, max);
    return Math.round((a + b + c) / 3);
  }

  /**
   * Deterministic value derived from a string, without advancing the stream.
   * Perception noise uses this so a stat's fuzz is stable across re-renders.
   */
  static stableNoise(key: string, salt: number): number {
    let h = salt >>> 0;
    for (let i = 0; i < key.length; i++) {
      h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
    }
    return hash32(h) / 4294967296;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
