# Test results

This file used to log `tsc`/`vitest`/`build` output by hand after each
change. That's exactly what a commit message already states (every commit
in this project's history says what was verified and what the counts were
at the time), so a second, hand-maintained copy here just drifted stale
the moment a later commit changed the numbers — the two counts recorded
here (1,361 and 1,367) were both already wrong by the end of the session
that wrote them.

For the current test count, run `npx vitest run`. For what a specific past
change verified, read that commit's message in `git log`.
