#!/usr/bin/env node
/**
 * Start an isolated instance for a playtest, and print where it is.
 *
 * Round 7 nearly ate a real save and did disturb its own run, both for the
 * same reason: the arrangement was a paragraph in a brief asking people to be
 * careful. A paragraph is not a mechanism. This is the mechanism.
 *
 * Three things it guarantees:
 *
 *   - **A free port.** Found by asking the operating system for one rather
 *     than by assuming 5173 is taken and 5174 is not. Two servers on adjacent
 *     ports is exactly how the collision happened.
 *   - **Its own storage.** `VITE_RUN_ID` namespaces every key the game writes,
 *     so a harnessed run physically cannot open somebody's career, and a
 *     tester who wanders onto the wrong port finds an empty menu.
 *   - **A stated identity.** It prints the run id and the namespace so the
 *     report can say which instance produced it.
 *
 * Usage:  node scripts/playtest-run.mjs [--port 5300] [--id round8]
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

/** Ask the OS for a port nobody is using, rather than guessing at one. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const id = arg('id') ?? randomBytes(3).toString('hex');
const port = Number(arg('port') ?? (await freePort()));

const line = '─'.repeat(60);
console.log(line);
console.log(`  Playtest instance`);
console.log(`  url        http://localhost:${port}`);
console.log(`  run id     ${id}`);
console.log(`  storage    mafia:run-${id}:*`);
console.log(``);
console.log(`  This instance cannot see saves from an ordinary dev server,`);
console.log(`  and an ordinary dev server cannot see its saves.`);
console.log(`  In the page console: __frontline.help()`);
console.log(line);

/*
   Run Vite's own entry with this Node, rather than going through npx.

   `spawn('npx.cmd', ...)` fails with EINVAL on Node 18.20+ unless a shell is
   requested, because spawning a batch file without one was closed off as a
   command-injection route. Asking for a shell would fix the error and hand
   every argument to cmd.exe to re-parse, which is the thing that was closed
   off. Running the entry with `process.execPath` needs no shell, no quoting
   and no platform branch.

   Reached by path rather than by `import.meta.resolve`, because Vite's
   `exports` map does not publish its own bin and resolution fails with
   ERR_PACKAGE_PATH_NOT_EXPORTED. This is our node_modules, not a public API.
*/
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
if (!existsSync(vite)) {
  // Said plainly, because the alternative is an EINVAL or a module-resolution
  // stack trace, and neither tells you to run `npm install`.
  console.error(`Cannot find Vite at ${vite}. Run npm install first.`);
  process.exit(1);
}
const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_RUN_ID: id },
});

const stop = () => child.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
