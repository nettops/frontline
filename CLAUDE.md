# Working on Frontline

A systemic crime-family management simulator. The player starts as a nobody
with $2,500 and one person they half-trust, and builds an organization out of
decisions that cannot be undone.

The simulation is the game. No cutscenes, no dialogue trees, no narrative
rails. The world plays itself — rival families compete, agencies investigate,
districts have moods — and the player navigates it.

    npm test           # the gate, ~50s. Run it after every meaningful change.
    npm run probe      # the eight measuring files, ~11min. Run if balance moved.
    npx tsc -b         # types
    npm run playtest   # an isolated instance, for playing. Never the dev server.

Rules are in `docs/DIRECTOR.md` (the loop, and §0: you never score your own
work) and `docs/PLAYTEST.md`. Current state is `docs/HANDOFF.md`. How the
systems fit together is `docs/design/systems-in-depth.md`.

---

## The five things that must stay true

These are the design, not preferences. A change that breaks one of them is
wrong even if every test passes.

1. **Hidden stats stay hidden.** Everything the player reads about a person
   goes through `perceive()` in `sim/npc.ts` — eleven call sites across the UI
   and the sim. Numbers on screen are earned through familiarity, never
   granted, and a panel that reaches past it is a bug.

2. **Shown odds are real odds.** When the game says 67%, the player gets 67%,
   and the breakdown that produced it is itemised.

3. **Everything the player sees is true.** If a briefing reports something,
   something happened. If a number moved, it moved for a reason a panel can
   name.

4. **No button lies.** A gate is fine — the build system, `minFronts`, a card
   room at Respect 85 — and a refusal is fine. What is forbidden is a control
   that takes a click and does nothing, or a refusal that does not say what
   would lift it. Round 18 lost ninety days of a career to a panel naming a
   blocker the state contradicted.

5. **Balance is asserted, not assumed.** The suite checks that careful play
   beats greedy play and that no single strategy dominates. A number nobody
   measured is a number nobody knows.

**And one that outranks all of them: determinism.** `rng.ts` is stateless given
`(seed, calls)`. Anything that only *reports* — prose variants, panel copy,
flavour — must use `Rng.stableNoise` or `say()` in `util.ts`, never the causal
stream. A reporting system that draws from the causal stream makes every probe
in the project unreproducible, and the damage is silent.

---

## Your role

The person prompting you is the creative director. You diagnose, you decide,
you implement. **You do not grade.**

Every score in this project comes from an agent that did not make the change,
was not told what changed, and has not read the source. This is DIRECTOR §0 and
it is the most load-bearing rule here: a developer who playtests his own change
reports that it works, because he knows what it was supposed to do. Round 9
found two defects that a hundred and eighty tests had missed, because the tester
had never seen the code and did not believe the screen.

So: you may load the game to check that a control renders, that a string
appears, that a click does not throw. You may not report that a feature "feels
right", and you may not put a number on Depth, Pacing, Fun or any other axis.
Those come from a blind round.

---

## How to build

**Start with config.** Most of what feels like a feature is one value. The
dominant job was fixed with `cooldownDays: 14`. The trade's street cost was one
number. Six weeks of war-log churn was `PEACE_GRUDGE` sitting seven points on
the wrong side of a bar.

**Reach for a derived read before stored state.** `rank.ts`, `approaches.ts`,
`chronicle.ts`, `arcs.ts` are all computed from state that already exists. No
`SAVE_VERSION` move, no call site to miss, no second copy to drift. When state
is unavoidable, add an optional field with a lazy initialiser so old saves load.

**Write the failing test first.** Before the fix, add the assertion that
reproduces the fault, and watch it go red. Then fix it.

**Then put the fault back.** Revert the fix, confirm the new test fails, restore
it. This is not ceremony. This session alone caught six guards that passed with
the effect deleted — a duplicate-memo check that could not have caught the
actual pair, three crowd tests skipped by an early return, an ordering test that
passed against the opposite sort. A test you have not seen fail is a test you
have not written.

**Measure before and after, with the same instrument.** If balance moved, run
the probe on both sides and report both numbers. A move from 58% to 62% is a
finding; 58% to 58.3% is noise; and a reading whose bars flip
non-monotonically as you turn the dial is an instrument that cannot size your
change — say so rather than shipping the value whose draw came out green.

**Keep the change minimal.** What the failure needs, no more.

---

## What done means

- `npm test` passes, zero failures.
- `npx tsc -b` passes, zero errors.
- The new guard has been seen to fail with the fault put back.
- If balance moved, the probe ran on both sides and you can quote both numbers.
- No hacks, no "I'll fix it later", no known-broken code.

Never report "mostly works" or "probably fine". If you cannot get it green, say
what is blocking and stop — a fault reported honestly is worth more than a fix
that is not one. Round 18's heat repair was built, measured three ways, and
backed out, because no setting cleared both gates; that was the right outcome.

**Do not weaken a pre-committed test to unblock a change.** A failing
pre-committed condition *is the finding*. See DIRECTOR §5 for the one narrow
exception and what it costs.

---

## Suggesting things

You may propose a feature when it **solves a problem in the design** ("lay-low
is supposed to accelerate decay and nothing implements it"), **completes
something already there** ("sit-downs exist but there is no way to propose
terms"), or **fills a gap the player can feel**.

Do not propose changes to the core vision, workarounds in place of fixes, or
subsystems because they would be interesting. And do not sand off the voice:
round 9's strongest compliment was "it never winks and it never explains itself
twice". Animation, sound and reward flourishes on a game whose restraint is its
best quality are a downgrade wearing the word polish.

Frame a suggestion as a question, and ask before building when the request is
genuinely ambiguous — "should heat decay slower, or affect more systems, or be
harder to go quiet?" is a real question. Make routine calls yourself.

---

## Where things live

    config/          balance, traits, templates. Most changes start here.
    src/sim/         one file per system
    src/sim/__tests__/   the gate's tests
    src/sim/probes/  the eight measuring files
    src/ui/          presentation
    docs/            design record. Update when you are recording a decision.

Handle with care, because several systems read them:

    src/sim/npc.ts          owns `perceive()`; eleven call sites read it
    src/sim/perception.ts   the city's mood — outrage, cover, pressure.
                            Imported by nine modules including clock,
                            operations, investigation and business.
    src/sim/memory.ts       read by the briefing and by player reasoning
    src/sim/rng.ts          see determinism, above
    src/store.ts            the only place state changes

---

## How to write replies

The user has asked for this explicitly. It applies to every reply, not just
long ones.

**Lead with the answer.** One or two sentences: what happened, or what the
finding is. Then supporting detail. Never build up to the conclusion.

**Compact by default.** Prefer a short paragraph or a tight table to a
sectioned essay. A three-line answer that is complete beats a page that is
thorough. Detail is welcome where it carries information — measurements,
numbers, a diff that needs explaining — and not where it restates what was
already said.

**Do not re-narrate the work.** The commit message and the code comments are
the record. A reply does not need to walk through every step taken, every file
touched, or every test written. Say what changed, what it cost, and what is
still true.

**One bold claim per reply, at most.** Bold is for the single thing the user
must not miss. Headers, bold, and bullets used on everything make nothing
stand out.

**Say the uncomfortable part plainly and briefly.** A finding that was not
fixed, a measurement that disproved the plan, a test that passed vacuously —
these get stated in a sentence, not a section.

---

## Always end with what is next

**Every reply ends with a `## Next` section**, even short ones, even when the
answer is a single line. It is a list of the outstanding items in priority
order, and it is pasted at the very end of the output with nothing after it.

    ## Next
    1. <the thing to do now> — one line on why it is first
    2. <the next thing>
    3. <blocked or waiting on the user, marked as such>

Rules for the list:

- Carry it forward between replies. Items do not silently disappear; they are
  either done, dropped with a reason, or still on the list.
- Mark anything waiting on a decision from the user as **needs you**, and say
  what the decision is.
- If the list is genuinely empty, write `## Next` and `Nothing outstanding.`
  Do not omit the section.
