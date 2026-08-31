import { defineWorkspace } from 'vitest/config';

/**
 * Two suites, split by what they cost.
 *
 * `unit` is the gate: 96 files, and it runs in well under a minute because
 * every one of them sets up the state it needs and asserts on it.
 *
 * `probes` are the eight files that measure the game rather than test it — the
 * ladder, the floor, the spread, what a bot finds when it plays. They build
 * their evidence at module scope (`ladder.probe.test.ts` runs 36 careers of
 * 1,460 days before the first `it()` is reached), which is why the whole suite
 * used to report 35 seconds of tests behind 610 seconds of collection. Eight
 * files were 8m35 of an 8m48 run.
 *
 * They are still tests and they still assert, so they are not optional and
 * `npm run test:all` runs both. They are simply not what should stand between
 * a typo fix and knowing it compiles.
 */
export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'unit',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['src/sim/probes/**'],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'probes',
      include: ['src/sim/probes/**/*.test.ts'],
      // The probes share `__tests__/helpers.ts` with the unit suite — it is
      // test support for both, and moving it would rewrite 28 imports to say
      // nothing new.
    },
  },
]);
