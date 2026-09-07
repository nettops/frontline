# Final report — 2026-09-06

## Executive summary

The pasted brief assumed a fresh, unaudited codebase and asked for a from-
scratch 2-hour audit-then-build cycle with self-graded phases. This repo is
neither fresh nor unaudited: `frontline` (checked out locally as `mafia`) runs
its own director-loop process — a blind-scorer methodology in `DIRECTOR.md`
whose central rule is "you never score your own work" — with 144 commits, a
findings ledger (`HANDOFF.md`, F1 through F23) tracking exactly the longevity,
economy and agency questions the brief asks about, and a design-spec archive
recording nine days of very recent, substantial, already-well-reasoned work
(contracts, an armoury/provenance system, two street scenes, autopilot
heat-awareness) that neither the ledger nor the log had caught up to yet.

Told to follow the brief but incorporate the existing process where it fits,
this session spent most of its time reading that existing process rather than
re-deriving it, on the judgment that re-deriving it would be redundant with
work already done and would risk contradicting a project that has repeatedly
and specifically punished agents for producing "a believable number about
itself" (HANDOFF §3 records 39 recorded instances). One concrete, verified,
low-risk fix came out of that reading and shipped. It is not a rewrite and it
does not claim to close any of the project's named findings outright; it is
the single highest-confidence thing this session found that nobody had done.

## Gameplay

**What changed for the player:** three of the newest and most consequential
systems in the game — sending people after a rival capo or boss, the
per-business "how hard do you lean on it" dial, and the favour network with
the police captain, the union boss, the judge and somebody in office — now
surface in the tip strip at the moment they become true, the same mechanism
that already teaches the sit-down, delegation and promises. Previously all
three were reachable only by a player who opened the right panel with no
prompt to do so; `grep` across `ui/tips.ts` for `contract`, `civic`, `favour`
and `pressure` returned nothing before this session.

## Longevity

This is squarely a Day 100–365 fix rather than a Day 1–30 one. Contracts and
the favour network are levers that only make sense once a career has rivals
worth removing and a family worth being seen well by — exactly the "Power"
and "Responsibility" phases the brief names. `HANDOFF.md`'s own F1 finding —
"decisions stop changing around day 90-119," confirmed across three separate
blind rounds — is a symptom a hidden late-game lever produces almost by
definition. This session's fix does not claim to close F1: F1 is also
downstream of F5 (rivals go passive after roughly day 76) and F15 (a hard
fork in the economy on whether a career ever gets a second business), neither
of which this session touched. What it does is remove one confirmed,
concrete obstacle between the player and content that already exists and is
already tuned.

## Economy

Not touched, deliberately. `ladder.probe`'s existing contract-system arms
were read (not re-run with new parameters) before writing anything about
them: going after rivals unprovoked leaves a career ahead in 9 of 36 cases,
median $-288,425 against never sending; doing the same thing only at war is
close to breakeven, 17 of 36 ahead, median $0. That is a system already
priced as a real gamble rather than free money, which is what the brief's
economy philosophy (§11) asks for — money should create options, and a
correctly-priced option that nobody could find is not an economy defect.

## Run variety

Not addressed directly this session. What is on record already (F5, F17,
the favour network's four figures, contracts' three targets) is a
substantial amount of systemic variety already built and already reasoned
about in `docs/superpowers/specs/`; the gap this session found and fixed was
discoverability of some of it, not its absence.

## Dynamic run evolution

Contracts are the sharpest existing example of this in the codebase: a
provenance system (`config/pieces.ts`) makes a killing more or less
attributable depending on the weapon's history, feeding directly into
`beliefs.ts`'s attribution model — a family that cannot tell who did it
blames somebody plausible instead, which the project's own design doc notes
can start a war between two other families over something the player did in
a district neither was watching. This already existed; this session's
contribution was making sure a player can actually find the button.

## Bugs / technical

None found or fixed. `tsc -b` was clean at baseline and remained clean.

## Tests

- Baseline: `tsc -b` clean; `vitest run` 1,361 passed / 11 skipped / 0 failed
  across 108 files (1 skipped).
- After the change: identical counts (the new coverage lives inside existing
  `tips.reach.test.ts` cases, not new ones). `npm run build` succeeds.
- Test-first was followed per this project's standing instruction: the three
  tips were added, `tips.reach.test.ts` was run and watched fail
  (`accounts for every tip in the list` named exactly the three unclassified
  ids), and only then were they classified — provisionally into `ORDINARY`,
  which was then verified by running the test file alone before moving on,
  rather than assumed.
- No blind playtest round was run. `DIRECTOR.md` requires a fresh agent that
  has not read the source, driving a live instance to Capo or day 300 — a
  cost class of its own that this session's audit-plus-fix budget did not
  leave room for. Full details in `.ai/TEST_RESULTS.md`.

## Commits

One commit on `main`, not pushed:

    0c6cc57  Three systems, and the tip nobody wrote for any of them

`src/ui/tips.ts`, `src/ui/__tests__/tips.reach.test.ts`,
`docs/superpowers/findings/director-log.md`, and the four `.ai/*.md` files
this report and its siblings are part of.

## Files changed

- `src/ui/tips.ts` — three new `Tip` entries plus their imports.
- `src/ui/__tests__/tips.reach.test.ts` — the three new ids classified into
  `ORDINARY`, matching the reachability actually measured.
- `docs/superpowers/findings/director-log.md` — one new entry, in the
  project's existing format, recording what was found and what was done.
- `.ai/AUDIT.md`, `.ai/TASKS.md`, `.ai/PROGRESS.md`, `.ai/TEST_RESULTS.md`,
  `.ai/FINAL_REPORT.md` — this session's own record, kept separate from the
  project's existing docs rather than merged into them, since merging would
  have meant either overwriting work this session did not do the research
  for, or guessing at nine days of design reasoning from the outside.

## Known issues

- `HANDOFF.md` and `docs/superpowers/findings/director-log.md` (before this
  session's one entry) are roughly nine days and 60 commits stale relative
  to `main`. Real, and worth a session of its own to reconcile properly;
  not attempted here because doing it hastily risks misstating design
  reasoning in a project that has visibly suffered from exactly that.
- F1, F5 and F15 (see `HANDOFF.md`) remain open. This session's fix plausibly
  helps F1 and does not touch F5 or F15 at all.
- No blind round has ever seen contracts, the armoury, the pressure dial or
  the favour network — the newest and, on paper, most consequential systems
  in the game are entirely unmeasured by human play. This is the single
  highest-value thing owed next.

## Recommended next steps

1. **Run a blind round now.** Contracts, the favour network, the pressure
   dial and this session's tips have never been in front of a human tester
   together. `DIRECTOR.md` §4 says how to size it; a full round to Capo or
   day 300 is the default and is overdue by the project's own accounting.
2. **Build the rival-heat probe HANDOFF §7 already names**, to turn F5 from
   a confirmed behaviour into a diagnosed mechanism.
3. **Reconcile `HANDOFF.md` and the director log against `main`** once a
   session can be spent on it properly rather than as a side effect of
   something else.

## Quality assessment

Scored against the state of the game as this session found it, which is to
say: already high on most axes, because most of the hard work here predates
this session by weeks.

| axis | score | why |
|---|---|---|
| Gameplay | 8 | Deep, systemic, and the newest layer (contracts/provenance) is genuinely novel rather than a bigger number. |
| Longevity | 6 | F1 is real and three-round-confirmed; this session's fix is a plausible partial answer, not a closer. |
| Progression | 8 | The rank ladder was re-sized this cycle specifically for 300-day careers; late-game systems introduce new kinds of decision rather than bigger versions of old ones. |
| Economy | 7 | Front-gate fork (F15) is a known, unresolved bimodal split; everything else measured is honestly reported rather than assumed. |
| Player agency | 8 | Contracts, delegation, the sit-down and the favour network are all real decisions with real downside; this session made three of them findable. |
| Run variety | 7 | Systemic rather than scripted, per the project's own stated philosophy; F5's rival passivity caps how different a late career actually plays out. |
| Clarity | 7 | Strong where it has been tested (F10 closed, refusals name their thresholds); weaker where nothing has looked yet — the four systems this session partly addressed. |
| Technical quality | 9 | 1,361 tests, disciplined measurement culture, a self-correcting test-first process this session followed rather than invented. |
| Overall readiness | 7 | Releasable by most of `DIRECTOR.md` §10's own conditions except the ones it names as still open — an adversarial round, and two consecutive clean blind rounds.
