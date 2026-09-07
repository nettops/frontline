# Tasks — prioritized, 2026-09-06

Ranked by the brief's own formula, IMPACT × CONFIDENCE ÷ COST, against the
findings already on record in `HANDOFF.md` plus what this session's read of
the newest work turned up. See `AUDIT.md` for the reasoning behind each line.

## Done this session

1. **[P0 — Longevity/Clarity] Three new, consequential systems (contracts,
   the pressure dial, the favour network) had no tip-strip entry — the exact
   "systems nobody could find" failure this project has already fixed three
   times for other mechanics.** High confidence (grep-verified absence, and
   `README.md` already documents the identical failure and fix for the
   sit-down/delegation/promises), low cost (three tip entries, no sim or
   balance change), high impact (these are the newest late-game decisions the
   game has — a hidden lever is not a lever). Implemented, tested,
   reachability-verified against the standard bot, logged. See
   `director-log.md`.

## Owed, not attempted this session

Ranked, with why each sits below the line for a single-session budget:

2. **[P0 — Longevity] F1: decisions stop changing around day 90-119,
   three-round-confirmed.** The largest standing finding in the project. Not
   attempted directly because it does not have a single named cause left to
   fix — `HANDOFF.md` traces it through F5 (rivals go inert), F15 (the front
   gate), and F7 (systems no instrument or bot exercises) — and the brief's
   own §22 says not to spend a whole session stuck diagnosing one thing.
   Closing it further needs a blind round now that contracts, the favour
   network and this session's tips exist, which this session could not run
   (`DIRECTOR.md` requires an agent that has not read the source and has not
   seen the change, and driving 300 in-game days through a live browser is a
   round's worth of budget on its own).
3. **[P1 — Systemic] F5: rival families go inert after roughly day 76,
   confirmed across three blind rounds; mechanism still unverified.**
   `HANDOFF.md` names the exact instrument owed — a rival-heat probe — and it
   was not built this session because it requires new probe machinery
   (measuring what a family's own heat and money do to its decision scores
   over the exact window the finding names) rather than a small, verifiable
   change.
4. **[P1 — Systemic] An adversarial round** (`DIRECTOR.md` §10 condition 6),
   never attempted in this project's history. Explicitly the kind of thing
   this session's `AGENTS`-style brief calls for (§8 "the do-nothing test",
   the anti-feature-spam rule) but it is a full round, not a code change, and
   the sizing rule in `DIRECTOR.md` §4 says not to run one to answer a
   question a static check can answer instead — there was no static
   equivalent available for "find an exploit."
5. **[P2 — Clarity] `HANDOFF.md` and `docs/superpowers/findings/director-log.md`
   are about nine days and 60 commits stale.** Real, but documentation debt
   rather than a gameplay defect — flagged in `AUDIT.md` rather than fixed,
   because backfilling a week of design reasoning accurately from the outside
   risks getting the "why" wrong in a project that visibly cares about it.

## Done in the 2026-09-07 round (Opus deciding, Sonnet building)

Item 2's own prerequisite — "closing F1 further needs a blind round now that
contracts, the favour network and this session's tips exist" — is what
prompted this round to end with one. Five more fixes landed first, all
Opus-diagnosed and verified against actual code/tests before being acted on:

6. **[P1 — Clarity/Correctness] `WORLD.gripSkim`, `PARTNER.protectionTrust`,
   `CONTRACT.cooldownDays` — three config keys with real balance intent, read
   by nothing.** Same class as item 1 above, one layer down: not "nobody can
   find the button" but "the number behind the button was never wired."
   High confidence (each verified by grep and a test that failed before the
   fix), low cost, real impact — one is F15's own repair (the silent
   partner), one is a build-screen promise on an irreversible day-one choice.
7. **[P1 — Correctness] Seven refusals that named no figure, still being
   written into new code as of last week's commits.** `refusals.test.ts`'s
   detector had two blind spots (a `!fn(...)` guard with no comparison
   operator; a comparison between two camelCase calls with no visible
   constant). Widened test-first per the file's own stated repair process,
   then the seven sites it found were fixed. HANDOFF §3 costs this exact
   defect class four blind rounds historically.
8. **[P0 — Longevity/Clarity] Instinct, the most expensive verb in the build
   table (7 points), did nothing at all below or above its threshold.**
   `hearsAbout()` existed, fully correct, called by nothing; `plant`/
   `pullOut` had no UI anywhere. Wired the warning into `investigation.ts`'s
   stage gate and shipped the missing Planted column. This is the same
   "irreversible day-one choice lies to the player" class as item 6's build
   screen, at the far more consequential verb tier rather than the world
   tier.
9. **[P2 — Clarity] Word and Ledger's verbs are unreachable for structural
   reasons, not missing UI.** Found while fixing item 8. `canCallATable`
   gates a restriction that was never built (house sit-downs are already
   unconditional); `canBuyIn` has no rival-business entity to address. Both
   are real design questions for the developer, not scoped bugs — labelled
   honestly on the build screen rather than built badly under time pressure.
10. **[P2 — Correctness] Four more dead config keys**, caught by a guard
    modelled on `deadState.test.ts`'s existing `Org`-field check, extended to
    every config settings object. One wired (`POACH.evidenceStrength`, a
    hardcoded duplicate), three deleted (superseded or byte-identical
    duplicates of an already-wired sibling).

**Declined:** Opus's recommendation to retune `CONTRACT.cooldownDays` down
from 300. Checked first — `CAPO_APPROACH.cooldownDays` in `config/capos.ts`
is 400 and produces the identical long-countdown pattern, and `contract.ts`'s
own header says the two mechanics are deliberately mirrored "in every
column." Retuning one alone would break that parity. See the director-log
entry for the full reasoning.

**Items 6 and 7 from the previous list not attempted, again**: the
rival-heat probe for F5, and an adversarial round. Both remain full-round or
new-instrument work, and this round spent its remaining budget on the blind
round instead, per its own governing question — "nothing a probe measures
changes what a human notices tonight."

## The blind round

`round16`, dispatched to a fresh subagent with no source access, the same
brief `PLAYTEST.md` has used since round 8. Its result — scores, findings,
and whether F1 (decisions stop changing ~day 90-119) still appears — is in
`.ai/FINAL_REPORT.md`.

## Why nothing else made the list

The anti-feature-spam rule in the governing brief asks, before adding
anything: would it still matter at day 250, does it interact with existing
systems, can it be verified this session. Everything else this session's
reading turned up — F2's influence rate, F15's front-gate fork, F20's
pressure-dial usage split — is already diagnosed, already has a proposed or
shipped repair, or is already a plotted-and-printed measurement rather than
an open defect. Re-litigating settled findings would be busywork with this
project's own name for it: an instrument returning a believable number about
itself. The one thing this session found that nobody had checked yet was the
tips gap, and it is what got fixed.
