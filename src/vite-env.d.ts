/**
 * The two things Vite puts on `import.meta` that this project actually uses.
 *
 * Declared by hand rather than by referencing `vite/client`, because that
 * pulls in ambient modules for every asset type Vite can import and this
 * codebase deliberately keeps its type surface small — `raw.d.ts` next door
 * exists for the same reason.
 */
interface ImportMetaEnv {
  /** True in `vite dev`, false in a production build. Gates the harness. */
  readonly DEV: boolean;
  /**
   * Set by `scripts/playtest-run.mjs`. Its presence namespaces every key this
   * game writes to localStorage, so a harnessed run cannot reach a real save.
   */
  readonly VITE_RUN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
