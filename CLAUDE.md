# Working on Frontline

Rules are in `docs/DIRECTOR.md` (the loop, and §0: you never score your own
work) and `docs/PLAYTEST.md`. Current state is `docs/HANDOFF.md`.

    npm test           # the gate, ~50s
    npm run probe      # the eight measuring files, ~11min
    npx tsc -b         # types

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
