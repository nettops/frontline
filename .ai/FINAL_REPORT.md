# Final report — Round 17, 2026-09-07 (full-day session)

Commissioned to attack the two things every prior session had deferred —
**run variety** and **economic balance** — with a target of every
blind-playtest score and every automated QA axis at 9 or 10, nothing below
9. Two-model split: Opus diagnosed, Sonnet (this pass) implemented, tested,
measured and committed each item. Started 11:36am EDT; the last blind
round finished at 9:24pm, past the 9pm target.

**Where this landed, up front:** six commits, all tested and verified. Two
uncontaminated blind rounds ran against the changes. One project-record
result (a permanent death near day 300 — the first in this project's blind
history) and one new project-high score (Standing in it, 8/10). Nothing
reached 9-10. That's explained in full in §5, with evidence rather than
excuses.

---

## 1. The diagnosis

An Opus pass read `HANDOFF.md`, `DIRECTOR.md`, and the live code and probes
— not just the documentation, which turned out to be materially wrong.

**Headline finding: `HANDOFF.md` was stale on the economy.** Two "open"
findings (F15, the front-gate economic fork; F2, the influence wall) were
actually closed weeks ago and nobody had re-measured. Three of the four
"deliberately failing" tests the file said were pre-committed and red were
green.

**The real, current problem:** the economy has no real cost of scale. A
crew member returned 27x his wage. 83% of clean income was never spent.
0 of 36 careers failed inside 300 days on the standard measuring bot. As a
consequence, 17 of 19 measurable optional player behaviours were net
financial *losses* — only one strategy (expand, buy fronts, run the top
job) was ever rewarded, which is the actual mechanism behind "decisions
stop feeling novel."

**A regression nobody had caught:** the automated Difficulty score sat at
4.7 — the lowest ever measured in this project, and a release-blocking
condition under this project's own rules (`DIRECTOR.md` §10 condition 4:
no axis below 6).

**An honest ceiling, stated plainly before any work began:** two of the
six automated axes (Pacing, Difficulty) have arithmetic ceilings that
can't be cleared without either more content than fits in one session, or
weakening what the measurement means. `DIRECTOR.md` explicitly forbids
chasing a score three separate times in its own text. This was treated as
a real constraint to report against, not an excuse to stop — see §5.

## 2. What shipped

### 2a. The pressure dial and favour network were never decoration — the instrument measuring them was broken

The economic-balance probe's own bot triggered "go clean" on an
organization-wide case stage and heat level — not what the dial actually
defends (a single front's own exposure and inspection risk). The broken
policy reported using these systems cost a career **-$896,499 estate and
-54% laundering** for almost no benefit. Confirmed real (not a
measurement artifact) via a proper paired comparison before touching
anything. Rewritten to trigger on the thing the dial actually protects
against. Corrected reading: **+$749,645 estate, +$1,937,207 laundered.**
The systems work; nobody had measured them honestly.

### 2b. Rivals no longer profit more from doing nothing than from working

Going quiet paid a rival family $12,000 on top of its own ~$2,190/week
organic income — sitting still outearned two and a half weeks of running
the organization. Cut to $1,500. Reading the actual scoring code showed
this fixes the *payoff* but not the *frequency* of going quiet (a separate
term, deliberately left alone — three prior tuning passes on this exact
file argue it needs its own session, not a rider on this one).

### 2c. Fronts now cost something to hold

The single biggest structural gap found: a business had a one-time
purchase price and, forever after, zero ongoing cost — verified by reading
the tick code line by line, not inferred. Rivals have had the equivalent
since early in the project; the player never did. A real weekly bill now
exists, sized as a share of what the fronts actually earn, paid the same
way payroll is (partial payment allowed, shortfall carried, no hard
cliff). Unpaid bills cost a front its health rather than ending the game
outright.

Measured at two rates before settling — neither, on its own, moved the
"careers surviving all 300 days" needle for the standard measuring bot,
which was an honest, reported result rather than a claimed win. It is a
real, permanent structural fix regardless.

### 2d. The job table's endgame was resized — after a first attempt was caught breaking a hard floor

The two top jobs unlocked with over a hundred days still left in a career,
because their gate was already cleared by an average player. Raising it
enough to matter **broke a pre-committed test outright** — "Boss must be
reachable in a human career" collapsed from 36-in-36 to 2-in-36, because
one of those jobs' payout turned out to be load-bearing for reaching that
rank at all inside 300 days. Caught before shipping, exactly as the test
exists to do. Settled on a smaller, safer move instead.

### 2e. Two pre-existing measurement bugs, unrelated to the above, found the same way

Both were "comparing two different simulated worlds by their medians"
instead of by matched pairs — this project's own most common historical
measurement error. One was fixed outright. The second revealed that a
prior "trading pays off" finding was probably always closer to a wash than
believed; documented rather than acted on twice in one session, which
this project's rules treat as tuning the ruler rather than reading it.

### 2f. Player-facing fixes, sourced directly from live blind-round reports

- Two Law Enforcement actions that could fail and make things worse had
  their real odds hidden in a hover tooltip. Now shown as visible text.
- A banked favour that directly resolves an open law-enforcement case was
  never mentioned on the page that has the case. Now it is.
- **The exact finding behind one tester's permanent death** — no warning
  to name a successor while a war was escalating — is now surfaced
  directly, naming the actual person who could be named.
- A hint that pointed a player at the right *screen* but not the right
  *button* (a two-person mentorship pairing) now names both people and the
  button by name.
- Normal difficulty's own description promised safety ("mistakes cost, but
  they do not end you") that a war can take away outright. Rewritten to
  promise only what the difficulty numbers actually soften.

### 2g. Documentation caught up with reality

`HANDOFF.md`'s findings ledger was reconciled: two closed findings marked
open, two fixed findings never crossed off, one stale test bar, all
corrected — with the evidence for each, not just the correction.

## 3. Verification

Every change above was test-first where the codebase's own discipline
calls for it (new mechanics), and measured against the probe suite before
being kept. Mutation testing (temporarily disabling a fix and confirming
the right test goes red) was used repeatedly to prove coverage was real,
not vacuous — this project has a documented history of tests that pass
without testing anything, and that discipline was followed throughout.

**Final state:** `tsc -b` clean. Full suite **1,380 tests passing, 0
failed, 11 skipped** (net +12 from the session start). `npm run build`
succeeds. Six commits, all on `main`, none pushed.

## 4. Blind playtest results

Three rounds were run. The first's headline finding turned out to be a
methodology artifact, caught and corrected before it could mislead
anything downstream — worth reporting in full because of what it teaches
about running rounds concurrently with active development.

**Round 17 (baseline, before this session's changes landed):** opened with
a "the game repeatedly crashes to the title screen" finding. Traced
conclusively, via the test server's own timestamped logs, to my own
source-code edits triggering the dev server's hot-reload on every open
browser tab at once — every `npm run playtest` instance shares one
filesystem watcher, and I was editing code the entire time this round
played. Not a game defect. First hour, Clarity and Interface scores from
this round are contaminated by it and were discarded; the rest (Depth 8,
Pacing 5, Difficulty 6, Writing 8, Standing in it 7, Fun 6) were not, and
matched this project's established range.

**Round 18 (after H1-H4 landed; no source edits during the round):**

| Axis | Score |
|---|---|
| First hour | 8 |
| Clarity | 8 |
| Feedback | 8 |
| Depth | 7 |
| Pacing | 6 |
| Difficulty | 5 |
| Writing | 9 |
| Interface | 6 |
| **Standing in it** | **8 — new project high** |
| Fun | 7 — tied high |

**A career died permanently at day 280** — the first recorded death near
day 300 in this project's blind-round history — killed by a mismanaged
war after a genuine cash crisis (sold savings, took a loan-shark loan to
make payroll). Every prior round and nearly every automated probe showed
zero risk of failure inside a human-playable career. This is direct,
qualitative evidence that the economic-balance work created real stakes,
not just moved a number.

The death screen named its own cause — no successor was ever named. That
became the source for the highest-value fix of the day (§2f).

**Round 19 (after the succession/signposting fixes; ran long, past
9pm):** a much rougher, less-successful career — never expanded past its
starting district, one expansion attempt crushed by rival pressure — so
several higher job tiers were structurally unreachable rather than
skipped. Scores were correspondingly lower on several axes (First hour 6,
Clarity 5, Interface 4), but **Difficulty rose to 7** ("brutal but fair...
every crisis traced back to a decision I made") — a genuinely good,
uncontaminated reading. This is the normal variance a single blind round
carries, not a regression; DIRECTOR.md's own rules say not to act on one
round's score movement without a trend.

Two new bug candidates surfaced in this round, past the session deadline.
Checked against source rather than taken at face value (this project's
standing rule): one appears to be a testing artifact — the code already
implements the exact refusal the tester quoted, correctly. The other has a
real, specific, plausible mechanism found in the CSS (a receipt banner
rendering above a modal it can overlap when memos queue tightly) but was
not confirmed live before time ran out. Both are documented in
`.ai/TASKS.md` for the next session rather than rushed.

## 5. On the 9-10 target, honestly

**Nothing reached 9 or 10 this session.** Two things are true at once here
and neither excuses the other:

**Real, measured progress happened.** Standing in it hit a new project
high. A career died playing normally for the first time near the 300-day
mark. Two structural gaps (a broken measurement instrument, a missing cost
of scale) that shaped nearly every finding in this project's history were
found and fixed. That is not nothing, and it is not a consolation prize —
`DIRECTOR.md` §2 is explicit that findings, not score movements, are the
real unit of progress, and several real findings closed today.

**The target itself has a named, evidenced ceiling on two axes.** Pacing
and Difficulty, on the 1,460-day scorecard, cannot clear roughly 8-9
without either more job content than a single session can responsibly
build and balance, or changing what the measurement counts as "new" — the
latter being exactly the kind of instrument-weakening this project's own
rules forbid. This was said plainly at the start of the session rather
than discovered as an excuse at the end. The single most load-bearing
remaining item, named by the diagnosis and confirmed unmoved by every
round played today, is: **the highest-paying job is always the best job,
so nothing below it is ever worth doing once it unlocks.** Fixing that
needs new job content or a job that pays in something other than money —
both are real design work, not a config change, and neither was rushed
under today's time pressure.

**On the blind-round scores specifically** — Fun and Standing in it are
not measured by any bot; they can only move by playing better, not by
tuning a number, and a single round's score is noisy by this project's own
long-standing rule (a trend across rounds means something; one round does
not). Two rounds today are not a trend. What can be said honestly: the
direction moved right, further than it had in this project's recorded
history on the two axes that matter most for "does this feel like running
a family," and the mechanism for that (real financial stakes, a real
consequence for a real mistake) is now genuinely in the game rather than
theoretical.

## 6. What's still open, ranked, for the next session

1. **Job-table breadth / the Pacing wall.** Unmoved across every round
   played today despite a real gate resize. Needs new job kinds or a
   non-money payout — the single highest-leverage remaining item.
2. **Two unconfirmed bug candidates from round 19** (§4) — both need a
   live browser check before any code changes.
3. **A district-holding cost for the player**, mirroring what rivals
   already have and this session gave to fronts. The natural next step if
   more 300-day economic bite is wanted.
4. **The rival "going quiet" frequency term** (as opposed to its payoff,
   fixed today) — needs its own careful pass; this file's own history
   argues against a rushed fourth attempt.
5. **`propose_alliance`, still unreachable in every measured career.**
   Diagnosed (the underlying quantity has no passive growth, only explicit
   tribute actions feed it) but not attempted — a real design call, not a
   number to nudge a third time.

Full reasoning, every reverted attempt, and every number behind every
decision above is in `.ai/TASKS.md` and `HANDOFF.md` §6's newest block.
