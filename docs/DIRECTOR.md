# The director loop

A standing brief for an agent taking Frontline from where it is to something
worth releasing, by repeated diagnosis, change and blind re-measurement.

It replaces an earlier version whose philosophy was right and whose machinery
worked against it: the same agent played, changed and scored, the release gates
were set at numbers nobody had ever awarded, and a stagnation protocol ordered a
redesign after three flat scores when a single career's score is noisier than
that. What follows keeps the philosophy and fixes the machinery.

---

## 0. The one rule everything else serves

**You never score your own work.**

Every score in this project comes from an agent that did not make the change,
was not told what changed, and has not read the source. You are the director.
You diagnose, you decide, you implement. You do not grade.

This is not a courtesy. Round 9 of this project found two defects that a
hundred and eighty tests and a purpose-built benchmark had both missed — a
savings yield advertised at 0.23% when it was 23.4%, and a heat tier that
reported *Quiet* at heat 28 — and it found them because the tester had never
seen the code and did not believe the screen. The same session produced
**eighteen** separate cases of a probe returning a confident number about
itself rather than about the game. An agent holding both the hammer and the
scorecard is the nineteenth.

---

## 1. What you are optimising

Player experience, in this order:

    FUN  >  DEPTH  >  REPLAYABILITY  >  CLARITY  >  POLISH  >  FEATURE COUNT

A simple game with an excellent loop beats a large game with a weak one. If the
loop is weak, do not cover it with features — fix the loop.

### Standing in it

Running alongside all of that, and the thing the rest is in service of: **the
player should feel like they are running a family, and be willing to do whatever
it takes to keep it running.**

That is a mechanical target, not an atmospheric one, and the distinction is the
whole of it. In most projects the word *immersion* turns into animation, sound
and reward flourishes, and §5 already forbids that here for good measured
reason. What it means instead is three things, each of which is something the
simulation either does or does not do:

1. **The thing is yours and losing it would diminish you.** Not "you would lose
   points" — you would lose people you could name and a position you built.
2. **It has needs that do not wait**, and you are the only one who can answer
   them. Payroll on Friday is this. A man with a grievance is this.
3. **Keeping it running costs you things you would rather not pay.** If every
   choice is comfortable there is no ship to keep afloat, only a score going up.

The third is the load-bearing one and the easiest to lose. A game where the
right move is always available and always affordable is a spreadsheet with
names in it. What makes somebody a boss is being made to choose which of two
people they let down.

Scored blind as **Standing in it**, and deliberately kept apart from Fun: a game
can be enjoyable without ever being inhabited, and gripping without being
enjoyable. If the two scores move together across rounds, one of them is not
being answered honestly.

**The bot does not score this and must never be made to.** It joins Fun, Writing
and Interface on the list of things a thing with no eyes and no stake cannot
measure. A number here would be the surest of all the nineteen.

Do not chase the score. The goal is a game that would *deserve* a high score,
not a high score. If a change did not improve the experience, say so and revert
it.

---

## 2. Findings, not scores, are the unit of work

Scores are a trend line. They are too noisy to steer by: a floating-point fix
in a heat lookup, which has nothing to do with hiring, inverted a hiring
comparison in a 48-world probe on the same afternoon. A single playtest career
is noisier still — two testers landing in different halves of the game move Fun
further than most changes will.

So you do not act on a score moving or failing to move. You act on **findings**:
named, reproducible statements about the game.

    a finding      "Decisions stop changing at about day 115; the last 35 days
                    produced no decision the player had not already made."
    not a finding  "Pacing is 6."

A finding closes when a later blind round, told nothing about it, does not
report it. That is checkable. A 6 becoming a 7 is not.

Record scores in the log because a trend across five rounds means something.
Never gate on one.

---

## 3. The cycle

**Iteration 0 — baseline. Change nothing first.**

Dispatch a blind scorer (§4). Read its report. That is your starting state.

**Then, each iteration:**

1. **Diagnose.** From the latest report, name the single biggest thing standing
   between this game and an excellent one. One thing. Not a list.

2. **Hypothesise, falsifiably.** Write it down before you touch anything:

       If I change X, then finding F will not appear in the next blind round,
       because Y.

   If you cannot name which finding should close, you do not understand the
   problem well enough to fix it yet. Go back to the report.

3. **Implement the smallest change that tests the hypothesis.** Not the most
   complete change. The smallest one that would settle it.

4. **Verify before you measure** (§6). Type-check, full suite, bot scorecard.
   If a pre-committed test fails, stop — see §5.

5. **Re-measure blind.** Dispatch a *new* scorer. Never reuse the previous one;
   it has seen the game and cannot be surprised by it twice.

6. **Keep or revert.** Did the named finding close? Keep. Did it not? Revert,
   and say plainly that it did not work. Effort spent is not a reason to keep a
   change.

7. **Log it** (§9), and go again.

---

## 4. The blind scorer

Dispatched fresh every round. It gets:

- The tester-facing half of `docs/PLAYTEST.md` only — everything from `## The game`
  onward. Never the developer half, which names what changed and what to watch
  for.
- The URL of an isolated instance from `npm run playtest -- --id round<N>`, and
  — when the round is seeded — which mode and start to pick, said as a
  starting condition and never with a reason attached.
- An instruction not to read source, tests, docs or config.
- The three harness corrections earlier rounds paid for: find elements by
  visible text rather than stored position; screenshot before judging how
  anything looks; and while a memo is open, answer it from `read().modalChoices`
  and never from `read().actions`, which is every control on the page and
  begins with SOUND, HINTS and the navigation rail. The third was paid for
  during the harness work rather than by a round — two measurement runs written
  against `actions[0]` clicked SOUND several hundred times each and reported a
  career stuck on day 8 as though the game had done it.
- The reproduction gate: no MUST FIX item without steps, reproduced at least
  once by the tester.

### Size the round to the question it is answering

Not every round is a full one, and running a full one to settle a small question
is the most expensive habit this loop has. Two blind rounds cost about three
hours and 800,000 tokens between them, and roughly half of what they returned —
a typo, a hardcoded family name, an unconfirmed destructive button, a table that
shredded its own text — was recoverable from a static check or a five-minute
look at a narrow viewport.

So decide the shape before dispatching:

    full round        the experience changed broadly, or nothing has been
                      measured in a while. To Capo or day 300. The default.
    targeted round    one or two named findings, each with a question a tester
                      can answer early. Play until the question is answered and
                      stop, saying where you stopped and why.
    not a round       anything countable, anything greppable, anything visible
                      in the first five minutes of looking at the screen.
                      Write the check instead — see §6.

### Start where the question is

A full round climbs from nothing, and the climb is most of the cost. When the
question lives in the late systems, the climb is not the measurement — it is
forty minutes of getting to the place where the measurement starts, and it
routinely fails to arrive. Round 9 is the case: the tester reached day 150 and
Crew Leader, so six of its nine scores describe the first third of a game whose
top half had just been rebuilt.

`config/modes.ts` already has the answer and no round has used it. Sandbox
starts hand a tester a position instead of making them earn it:

    nobody        the career opening, with the losing condition switched off.
    established   a few good years behind you — a crew, a district, and enough
                  to buy a front.
    seated        "At the table". Three districts, $900k clean and $400k dirty,
                  900 standing, and three families who already have opinions.
                  Everything the late systems need, on day one.

Choosing the start is a starting condition, not a hint — it says where the
tester begins, never what to look at, so it does not break the rule below about
narrowed briefs. Tell them which to pick and nothing about why.

**What a seeded start is valid for, and what it silently invalidates.** A player
who did not earn a position does not know the systems that built it, and that is
a real difference, not a shortcut around one. So:

    valid       laundering, succession, diplomacy, investigations, contraband,
                the trades, war — anything whose question is "does this system
                work when you are in a position to use it"
    invalid     pacing, the first hour, the difficulty curve, the money floor,
                signposting, and every question of the form "would a player
                find this" — all of which are about the climb

A round that starts seated must say so in its report, and must mark the axes in
the second list **unscored** rather than guessing at them. The same discipline
as an unreached rung.

### Run the testers in parallel

§0 asks for a blind scorer. It has never asked for exactly one, and running one
at a time is what makes a round an anecdote.

The project has known this for a while and treated it as a caveat rather than a
fault. From `docs/PLAYTEST.md`: *one tester per build is not a signal* — round 4
scored 8.0 and round 5 scored 7.4 on a strictly better build, because one got
solvent and one did not, and the scores moved with that rather than with any
change.

Three scorers dispatched at once cost the wall clock of one. So the default for
anything worth measuring is three, and a single-tester round is what you run
when you have a reason.

The isolation this needs is already built. `scripts/playtest-run.mjs` asks the
operating system for a free port and namespaces every key the game writes under
`mafia:run-<id>:`, so three instances on one machine physically cannot see each
other's saves or each other's careers:

    npm run playtest -- --id r16a
    npm run playtest -- --id r16b
    npm run playtest -- --id r16c

Each scorer gets its own url, the same brief, and no knowledge that the others
exist. Read the three reports against each other before reading any of them as
a result: a finding all three hit is a fault, a finding one hit is a lead, and
three scores that disagree by more than a point are telling you the axis is
measuring the career rather than the build.

### The shapes, and what they cost

    3 x targeted, seeded     20-30 min   the default for a named question
    3 x full, from nothing   60-75 min   the arc, and the only way to score
                                         pacing and the first hour
    not a round              minutes     see §6

A targeted round gets the same brief with the stopping rule changed and nothing
else. It must never get a *narrowed* brief: the moment a tester is told which
part of the game to concentrate on, under-use stops being a measurement, which
is the same rule as not naming a feature mid-round.

**How far it plays, in a full round: to Capo, or day 300, whichever comes
first.**

This is the defect that made round 9 only two-thirds useful. That tester reached
day 150 and Crew Leader, so six of its nine scores describe the first third of a
game whose top half had just been rebuilt. A round that never sees the late game
cannot report on the late game, and must say so rather than leaving the
impression it has.

Where the scorer cannot reach a rung, it marks those axes **unscored** rather
than guessing — the same discipline the bot scorecard uses when it refuses to
put a number on Fun.

**And the same applies to systems, not only to rungs.** A round that reached day
300 having never held a sit-down, never bought a contact and never approached a
family has scored the job-and-crew loop, not the game, and its Depth and Pacing
numbers mean that and only that. So every round reports coverage — what it used,
and for everything it did not, which of four things it was: never knew, could not
work it out, understood it and judged it not worth the cost, or was blocked.

Those four are different findings with different repairs, and the third is the
one nobody inside the project can see. A system a player understood and correctly
ignored is not an oversight to be surfaced better; it is a system that is not
worth its price, and the fix is the price or the system, not a signpost.

Do not tell a tester mid-round to go and use something. Under-use is the
measurement, and prompting it overwrites the finding with the answer you wanted.
Ask at write-up time, naming no feature.

---

## 5. Things you may not do

**You may not weaken a pre-committed test to unblock a change.** Not by moving a
threshold, not by deleting an assertion, not by narrowing a case. A failing
pre-committed condition *is the finding*. If a change you believe in cannot pass
one, stop and bring it to the developer with both numbers.

The exception, and it is narrow: when the assertion has demonstrably lost
resolution — it has changed sign on an unrelated fix, or both sides are pressed
against zero — you may restate it where it still resolves, showing the readings
that justify the move. That is a repair, and it goes in the log with its
evidence. Reaching for it twice in a row means you are tuning the instrument.

**You may not conclude anything about the game from a bot until you have
verified the bot can perform the counterplay you are measuring.** This project
has eighteen recorded cases of a probe reporting a fact about itself. Before
believing any measurement: can the thing taking it actually do the thing? A
probe that reported families had nobody credible to inherit turned out to be
running a bot that had never promoted anybody.

Know what each instrument does not touch, and quote it accordingly. Measured:
**no career-length probe in this project has ever acquired a police contact or
approached a family**, and only one has ever held a sit-down. `scorecard.probe`,
the source of every Depth and Pacing figure quoted in this log, recruits,
launches one job a day and answers events with the cheapest enabled choice —
four systems out of roughly fifteen. That is a deliberate property of a
regression instrument, which has to hold its own behaviour still to detect a
change in the game's. It is not a defect. It becomes one the moment a number
from it is quoted as though it described the whole game.

**You may not run a playtest against the developer's saves.** Always
`npm run playtest`, which takes a free port from the operating system and
namespaces every storage key. This mechanism exists because a round nearly
destroyed a real career.

**You may not sand off the game's voice.** Before changing tone, copy, or
presentation, read what the project has already committed to. Round 9's
strongest compliment was "it never winks and it never explains itself twice",
and its Writing score was the highest of the nine. Adding animation, sound and
reward flourishes to a game whose restraint is its best quality is a downgrade
wearing the word polish.

---

## 6. Verification, every iteration, before the blind round

    npx tsc --noEmit
    npx vitest run

Both clean.

**And before reaching for a blind round at all, ask whether the question is one a
check could answer.** Two classes of defect in this project turned out to be
greppable properties rather than experiences, after each had cost multiple rounds
to find one instance at a time:

    refusals.test.ts   a refusal gated on a threshold must name the threshold.
                       F10 cost rounds 7, 11 and 12 and survived three repairs;
                       the check found six more instances of it in one run.
    foresight.test.ts  a forecast must agree with the event it forecasts, across
                       a spread of states rather than one example. The specific
                       fix for `Covered? Yes` was wrong twice — once in each
                       direction — and the property test caught the second.

Both were written after a blind round found one instance the expensive way. When
a report names a defect, ask what class it belongs to and whether that class can
be asserted. A check runs on every commit for nothing; a round costs ninety
minutes and finds whichever instance the tester happened to walk into. Then the bot scorecard (`scorecard.probe.test.ts`), which measures
the shape of a full four-year career rather than the experience of a short one.

The two instruments do different jobs and neither substitutes for the other:

    blind scorer     experience, deeply, over the reachable window
    bot scorecard    shape, statistically, over the whole arc

If the scorecard's ladder readings collapse — a rank that was reachable becoming
unreachable — you have broken something the blind tester will never live long
enough to notice. This happened twice in one afternoon: a heat change took Boss
from seventeen careers in thirty-six to zero, and nothing a human would play
would have shown it.

---

## 7. Where to look when you are stuck

Not a checklist to work through. A list to think against when the diagnosis in
§3.1 is not obvious.

- Does the player make a decision that matters, repeatedly?
- Does the loop go **action → decision → risk → consequence → reward → new
  decision**, or does it stop somewhere?
- Is there an obviously optimal strategy? If so, is that the game working or
  the game solved?
- Does failure create a new situation, or just cost you?
- Do the systems touch each other, or run in parallel?
- Is there friction that produces no tension?
- Does the player know what happened, and why?
- After a full playthrough, what would make somebody start another one?

And the two questions worth more than the rest:

- **Why would the player take one more turn?** Then another? Then another?
- **Would this still be interesting after ten hours?** If not, name exactly what
  goes flat, and fix that rather than adding content next to it.

---

## 8. An adversarial round, once the loop is healthy

Separate from the blind rounds and dispatched the same way: an agent told to
break the game rather than play it. Exploits, infinite loops, dominant
strategies, skipped progression, degenerate spam, save manipulation.

Document everything it finds. Fix what damages the intended experience; leave
what is merely clever and harmless, and say which is which.

---

## 9. The log

Append to `docs/findings/director-log.md`. One entry per iteration,
and keep it short enough that somebody reads it:

    ## Iteration N — <date>

    Findings open at the start:   <the named ones, from the last blind round>
    Diagnosis:                    <the one thing>
    Hypothesis:                   If X, then finding F closes, because Y.
    Change:                       <files, one line each>
    Verification:                 tsc / suite / scorecard deltas
    Blind round N:                <scores, and which findings appeared>
    Result:                       KEPT — F closed  /  REVERTED — F persisted
    New findings:                 <anything the round raised that is new>

The log's purpose is to make it obvious when the game has stopped improving.
Read it before starting each iteration.

---

## 10. When to stop

Release-ready when **all** of these hold, and none of them is a score:

1. Two consecutive blind rounds raise **no MUST FIX** items.
2. Every finding from the three rounds before those has closed.
3. The full suite is green and no pre-committed test has been weakened to get
   there.
4. The bot scorecard has no measured axis below 6, and the rank ladder still
   shows a spread rather than everybody reaching the same rung or nobody
   reaching the top.
5. At least one blind round reached the late game and scored it.
6. An adversarial round has run and its damaging findings are fixed.

The scores go in the report. They are a description of the state, not the gate.

**Meeting these six conditions makes the game releasable. It does not make it
finished.** A blind tester giving Fun 8 with nothing that must be fixed means
the game is in good shape and there is still a point between here and
excellent. So long as you can name a specific, realistic path to a better
experience — not a vague one, a named finding with a hypothesis attached — take
it. Do not bank a good score and stop.

What stops you is not a number and not a mood: it is diminishing returns,
demonstrated. Two consecutive iterations that each close a finding but move
nothing a blind tester notices, or two that revert. At that point say so, with
the evidence, and hand it back.

**Stop early, and come back to the developer, if:**

- Two consecutive iterations both revert. You are guessing.
- A change you believe in requires weakening a pre-committed test.
- The diagnosis points at a redesign large enough that the game becomes a
  different game.
- You reach **eight iterations**. Report where things stand and let the
  developer decide whether to continue.

---

## 11. Reporting back

At every checkpoint, and at the end:

**Where it stands.** Latest blind scores against the previous round's, the bot
scorecard axes, and the ladder spread.

**What closed.** Findings that no longer appear, with the change that closed
them.

**What did not.** Findings still open after an attempt, and what you now think
is actually causing them.

**What you reverted, and why.** In full. A reverted change is a result.

**What is blocking release**, against §10's six conditions — only the ones that
are actually failing.

Never report a change as an improvement because it was hard. Never report a
game as ready because a lot of work was done. If it is already good, say so and
stop rather than inventing work; if it needs a redesign, say that instead of
grinding.

---

## 12. The target

A new player understands it, gets invested, makes decisions that matter, lives
with the consequences, gets stronger, meets a new problem, adapts, wants to know
what happens next, finishes — and wants to go again.

Everything above is scaffolding for that. If a rule here ever gets in the way of
it, say so in the log and bring it up rather than following the rule off a
cliff.
