# What the playtests changed

Round by round, what testers found and what it changed in the build. Extracted from `README.md`.

---

## What the third playtest changed

Beyond the ladder above, four repairs and one correction.

- **A failed purchase refunded the wrong money.** Buying a discounted front
  that had already gone did refund you — as dirty cash, whatever you paid in.
  The tester read the clean-cash column, saw it drop, and reported theft. It
  was not theft; it was a silent conversion, and it cost the balance that gates
  promotion. `spendSplit`/`refund` now put money back where it came from.
- **Answering a memo said nothing.** The modal answered silently on the theory
  that the consequence would surface in the next report. True for a
  consequence that takes a week, false for one that resolves under the click.
  A receipt now prints whatever the resolution wrote to the log, above the
  backdrop, clearing itself so there is nothing extra to dismiss.
- **Tips were being consumed unread.** `Coach` marked a tip shown when it
  rendered, and the memo backdrop is fixed over the whole viewport at
  `z-index: 50`. After a bad week, a queue of events could retire several tips
  the player never saw. Suppressed while anything is pending.
- **The hiring warning compared a rate to a balance.** The screen already
  showed what a new wage did to the weekly bill, then judged it against cash on
  hand — so one good score made a permanent commitment look comfortable. It now
  measures against `recentWeeklyTake` plus front revenue. Loading a long-running
  save immediately reported a payroll of $4,975 a week against $736 coming in,
  which is precisely the hole the old screen could not describe.
- **The repeating event was real; the diagnosis was not.** `arrest_pressure`
  fired verbatim every ten days for as long as anyone stayed in custody. The
  tester called it a *fake choice*; it was not — ignoring it cost 18 loyalty,
  25 grievance and filed informant evidence. It was an *invisible* choice. It
  now counts: the page escalates through three stages, says what the last
  refusal cost, and on the third the man signs and the event ends. Counsel ends
  it outright, looking after his family walks it back a step.

## Every event has more than one page

> Superseded in part by *Variants were never the fix*, below: two events have since
> needed real staging, and no amount of new prose substituted for it.

Two playtesters, separately, reported the same thing: a memo arriving word for
word after they had already read it. One of them classified a genuinely
consequential choice as fake purely because the page was identical to last
time. The writing is this game's strongest asset and repetition was spending it.

All 22 events now carry at least two more titles and two more bodies, or an
escalating sequence where that reads better. `variation.test.ts` holds three
rules, and all three were written *after* finding real defects:

1. **No event ships with a single page.** Found because an audit built on a
   regex that assumed a fixed field order had been quietly reporting 21 events
   for a catalogue of 22 — `recruit_offer` carries a comment where `weight`
   would be, and every count taken with that pattern was wrong by one.
2. **Every page says the same facts.** A variant that drops the price teaches
   the player less because the dice went the other way. This caught three of my
   own: two that dropped a district's influence figures and one that stopped
   naming the house doing the asking.
3. **Both rules must be able to fail.** The first version of rule 2 skipped any
   event it could not parse, so deliberately corrupting a variant to test it
   produced a green run. It now splits on structure rather than indentation and
   fails loudly on anything it cannot read. Both rules were re-verified by
   sabotage: drop a price, collapse an event to one page, confirm each is
   caught, restore.

`render.probe.test.ts` then builds every page for real across 40 worlds — a
template literal referencing something out of scope only fails on the draw that
reaches it, which TypeScript cannot see. 21 of 22 events raise, 18 are seen with
more than one headline, and no page has ever leaked an `undefined`, a `NaN` or
an unresolved `${…}`.

## The fourth playtest, and the systems nobody could find

A blind tester played 168 days on a fresh career and never once opened a
sit-down, handed a district to anybody, made a promise, saw a leak, or met the
room deciding it should be somebody else. None of it was locked. All of it lived
one click inside a panel with no reason on the rail to open it.

Their verdict on Depth and Pacing — 7 and 7, plateauing around day 60–70 — was
written about a game with its best mechanics switched off.

That is the finding worth keeping. The scores were 8.0 average with Writing at
10, and none of it matters next to the fact that the half of the game built to
answer "the decisions stop being interesting" was the half nobody reached.

### What was actually done about it

The tips strip — which the tester praised unprompted as "the whole tutorial" —
had never been taught the new verbs. Seven tips added, each firing on state
rather than on a day: a sit-down when you have somebody and have never asked for
a room; a grievance when somebody is carrying one; an outstanding promise; a
district worth handing over; a steward's ledger once it has four weeks in it; a
leak arriving; and the meeting you were not at.

Three rail badges alongside them, because a tip says it once and a badge says it
for as long as it is true: **Organization** counts men carrying something,
**Territory** flags a district you could hand over, **Intelligence** counts
leaks.

### The grokking probe survived contact with a person

The probe put the last new *kind* of move at week 16. The tester put their own
plateau at day 60–70 — week 9 or 10.

That is the right direction. The probe was built as a **ceiling**: a human
plateaus at or before it, never after, because once no new kind of move is
coming no amount of skill will find one. A human came in seven weeks earlier and
described the mechanism independently — rank-ups "briefly re-opened the decision
space" before being "absorbed back into the same rotation".

## Two of the tester's findings were about the harness, not the game

Reported here because the distinction cost real time to establish, and because
an automated tester's misdiagnosis is the most expensive kind of bug report to
act on.

**The job-row misclick.** Reported as the worst thing in the build: rows
shifting under the cursor, dozens of times a session. Checked in the live DOM —
`Same again` sits in the panel *header* and the assemble panel renders *below*
the table, so after selecting a row the row at index 2 is still the same job.
What does change is the count across *all* tables (22 → 36 rows, 26 → 40
buttons) because a new table appears. An automation indexing globally hits the
wrong element every time; a person clicking a visible row never does.

**The map toggle "doing nothing".** Map mode is one SVG with twelve `.map-cell`
elements and no tables; table mode is one table and no SVG. A text-reader sees
the same district names either way.

But the *substance* of that second one was right, and worth more than the claim:
the map was a uniform grid with **no adjacency visible**. The lines were being
drawn 1px dashed, centre to centre, underneath opaque cells — about fourteen
visible pixels each. The game's own rule is that you can only work a district you
hold or one next to it. The single most decision-relevant fact on the screen was
invisible. Links are now trimmed to the gap and drawn to be seen, and every
district you can actually work carries a dashed outline with a legend line.

## Saying why, instead of shrugging

The below-market business offer took your money and reported that "the sale fell
through", with no reason and no refund explanation. The tester read it as a
hidden dice roll and marked it the game's worst moment.

It was never random. `acquireBusiness` fails for **knowable** reasons — no front
slot left in the district, control slipped, the street will not sell to you —
and the game knew which one and would not say. `canAcquire` is now checked when
the offer is built, so the choice arrives disabled with the reason on it, which
is the pattern the affordability guard two lines above already used.

## Nobody in this game is a man unless the player decides they are

The tester found one line: a woman described as "he". It was 441 lines, across
34 files, plus every section heading on the crew sheet.

They/them throughout. Not a compromise — nothing in the state has ever recorded
a gender, so it is the only thing the game actually knows. Gendering the
generator was the alternative and is worse: a new field on every person, and 441
static strings becoming interpolations, most of them in config files where no
person is in scope.

Two mistakes were made doing it, both recorded because they are the interesting
part:

- The first transformer **dropped words**. It re-emitted the head and the
  corrected verb and silently discarded the rest of what its pattern had
  consumed, turning *"He was not young"* into *"They were young"* — a sentence
  meaning the opposite. Caught by reading the diff, not by any test. All 34
  files were reverted from a backup and the transformer rebuilt to re-emit
  everything it touches.
- Every patch script that session had been writing **CRLF into an LF
  codebase**, quietly converting 105 of 127 files. Fixed with a normaliser that
  asserts only carriage returns changed before it writes.

The guard against regression walks the **whole codebase** via `import.meta.glob`
rather than a hand-kept list of files — the first version listed eight files by
hand and missed the crew sheet headings, which is to say it missed the most
visible instance of the bug it existed to prevent. It checks string literals and
JSX text, strips comments in a separate first pass (a single-pass scanner breaks
on the apostrophe in `don't` and reports design prose as player-facing), refuses
to pass if it parsed nothing, and is verified by planting a violation in a file
it was never told about.

## Variants were never the fix

`respect_challenge` shipped with three titles and three bodies, added the
previous round in response to a tester calling it repetitive. A different tester
saw it three times and called it filler anyway.

They were right, and the lesson is the one Koster's dressing-versus-system
distinction predicts: the event did not escalate and did not remember what had
been answered, so the third appearance carried exactly as much weight as the
first. More pages would have been the same mistake at greater length.

It now stages like `arrest_pressure`. Ignore it and the next arrives further
along; by the third, your own men are the ones in the room saying nothing, and
the standing it costs has more than doubled. Answering it — loudly or quietly —
settles the matter and resets the counter. A quiet word that *fails* holds the
line rather than escalating, which is what makes negotiation worth having
without punishing a player for acting.

## Small things the tester was right about

- The **"Best odds"** column was never stale. It is best-available-crew,
  straight, in the selected district, and now says so in a tooltip.
- The **succession claim** looked like it drifted on its own. Three of its four
  terms are things the player does — rank is 40% and promotion is theirs to
  give, standing 28%, record 18% — and only the years belong to the calendar.
  The panel prints the weights now and says so outright.

## What the fifth playtest was right about

**Arrests.** Thirty to a hundred and twenty days, and nothing said so before you
gambled — the countdown only appears on the crew sheet once somebody is already
gone. The heat panel is where a player looks before deciding whether to push, so
the price is stated there now, in weeks.

**The free option in an informant scare.** "Get word to them yourself" failed
three times out of three, and the tester concluded it was cosmetic. It is not —
it is strictly better than doing nothing even when it fails — but it lands on
`respectForBoss + leadership × 3 > 60`, and an early boss has leadership around
four, so it cannot work at that rank. The hint reads the same number the outcome
does now: *"They do not think enough of you for it to hold."*

**A man past saving.** They raised a wage, ran a full sit-down, and watched him
quit anyway, with no way of knowing whether that was foreseeable. It was. The
crew sheet says so, through the perception system like everything else there, and
only once you know him well enough to have noticed.

**Payroll.** The forecast was already on the landing screen — but "covered" read
the same at ten times the bill as at one and a tenth. Three states now, not two.

**The Why page.** Raw utility weights with no framing, on a page where every
other screen in the game introduces itself first. The transparency was never the
problem; it needed a sentence in front of it.

**The stat bar.** The one genuinely critical defect: at 987px the bar carried
1278px of content and `+1 day` sat at x=1105, entirely off-screen, inside a
horizontal scroller with no affordance. The single control the whole game depends
on was invisible on a normal laptop. The bar does not scroll now; the readout
inside it does, with identity and clock pinned.

### The three that were left, and are not now

Verifying the round against the report turned up three items I had marked as
handled and had not been.

**A retainer now gets people out.** The arrest disclosure told the player what a
sentence costs; it did not give them anything to do about one. A lawyer bought a
slower case and a better trial and nothing whatever for the man in the cell,
which is both wrong about lawyers and the reason a run of arrests read as the
game going away. `sentenceMultiplier` hangs on the retainer that already exists —
an existing decision gaining a second consequence rather than the player gaining
another screen — and the heat panel quotes what *you* would serve, with counsel
named as the lever when you have none. Floored so the best money can buy still
cannot make an arrest free.

**The heat a job will actually cost.** The job table has a Heat column and the
tester was right that it lied by omission: it is the base figure scaled for rank,
chosen before the approach exists, so it is not the number you pay if you pick
Heavy. The assemble panel now prints the real one for the approach selected, and
it moves when you change your mind — Quiet +0.5, Heavy +0.8 on the same job.

**A front you cannot afford is a target, not a tease.** The panel said how many
were within reach and, when that was none, nothing at all. It now says how far
off the cheapest one is. The difference between a goal and a shop you have been
shown round is entirely whether the distance is on the page.

Two of the report's four MUST FIX items still do not reproduce, and are recorded
above as harness artifacts rather than quietly actioned.

## The playtest brief lives in the repo now

`PLAYTEST.md`, with the reason for every clause that was ever added to it.

Three rounds were run from three slightly different briefs typed from memory,
which is a poor way to compare three sets of scores. It also records the thing
that took longest to admit: **one tester per build is not a signal.** Round 4
scored 8.0 and round 5 scored 7.4 on a strictly better build, because one got
solvent and one did not, and the scores moved with that rather than with any
change. The brief now asks for a progress timeline at five checkpoints so two
reports can be read against each other at all, gates MUST FIX behind reproducing
it twice, and asks directly about the money floor.
