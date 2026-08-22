/**
 * Vite's `?raw` suffix, typed.
 *
 * One test reads a source file as text to prove no branch spends money without
 * saying so. That is a guard over the *shape* of the code rather than its
 * behaviour, so it has to see the source. `node:fs` would work and would mean
 * adding @types/node to the project for a single import — this is Vite's own
 * mechanism and costs three lines.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}

/**
 * ...and `import.meta.glob`, typed just as narrowly.
 *
 * The voice guard has to read every source file in the project, and a
 * hand-written list of imports is exactly the thing that let it miss the crew
 * sheet's own headings the first time. This is Vite's own build-time glob, so
 * a file added next year is checked the day it lands.
 *
 * Declared here rather than by pulling in `vite/client`, which would add a
 * large ambient surface — DOM asset modules, env typings, HMR — to a project
 * that has deliberately kept its type dependencies to this one file. Only the
 * eager, raw form is described, because it is the only form used.
 */
interface ImportMeta {
  glob(
    pattern: string,
    options: { query: '?raw'; import: 'default'; eager: true },
  ): Record<string, string>;
}
