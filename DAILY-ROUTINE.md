# Mafia sim — daily idea-generation routine

Runs daily at 08:00. Produces a ranked backlog of candidate improvements for
the developer to review. **Does not implement, test, or self-score the game.**
Implementation happens only after developer approval, through `DIRECTOR.md`'s
normal hypothesis → change → blind re-measure → keep-or-revert cycle.

This exists to feed that process a diagnosed, ranked backlog — not to bypass
it. Read `HANDOFF.md` and the tail of
`docs/superpowers/findings/director-log.md` first, so ideas build on the
findings already open (F1, F2, F5, F6, F7, F9) instead of re-discovering them.

---

## 1. Understand the current game

- Inspect the project structure.
- Identify the game's current major systems.
- Read the relevant source files.
- Review existing mechanics, UI, simulation, progression, economy, AI,
  events, missions, crime systems, law enforcement, relationships,
  businesses, territory, reputation, and any other implemented system.
- Identify unfinished, placeholder, shallow, repetitive, or disconnected
  mechanics.
- Check `HANDOFF.md` and the director log so you don't propose something
  already tried, already reverted, or already a named finding.

Treat the codebase as the source of truth. Never assume a system exists
without verifying it.

## 2. Think like a player

Analyze the game from the perspective of a player at 10 minutes, 1 hour,
5 hours, and 20+ hours in.

- What becomes repetitive?
- Where does player agency disappear?
- What decisions feel meaningless?
- What systems don't interact with each other?
- Where are the biggest opportunities for emergent gameplay?
- What would make a player say "holy shit, that just happened"?
- What would make a player start another playthrough?
- What systems feel like menus rather than a living world?
- What could create memorable stories, or a decision with no obvious
  correct answer?

Prioritize mechanics that create stories, not additional buttons.

## 3. Generate ideas

Candidate areas — do not copy these blindly, adapt to the actual current
game:

**Operations** — rackets, protection, extortion, smuggling, laundering,
bribery, assassinations, kidnappings, robberies, heists, illegal gambling,
counterfeiting, weapons trafficking, drug distribution, corrupt businesses.

**Organization** — crew hierarchy, loyalty, fear, ambition, betrayal,
promotions, rivalries, succession, internal politics, incompetence,
corruption, informants, personal relationships.

**World** — rival families, police, FBI, DEA, politicians, judges, lawyers,
journalists, businesses, gangs, unions, neighborhoods, economic and
political change.

**Emergent events** — a trusted capo secretly cooperating with law
enforcement, a rival recruiting your soldier, a business refusing
protection, an officer turning corrupt and demanding more, a job creating
unexpected heat, jealousy over a promotion, an unauthorized decision by a
family member, a journalist investigating you, a political connection
paying off, a rival family collapsing into a power vacuum.

## 4. Score every idea

Score each candidate 1–10 on: Fun, Strategic depth, Replayability,
Emergent storytelling, Player agency, Immersion, System interaction,
Implementation value. This scores the *idea's design merit* — it is not a
claim about the shipped game, which stays blind-tested per `DIRECTOR.md`
§0.

Favor ideas that improve multiple systems at once. A feature that only
adds content should generally lose to one that creates a new gameplay
loop.

## 5. Select and stop

Rank the top 3–5 candidates by (impact × system integration) /
implementation complexity. **Stop here. Do not design, implement, test, or
touch code.**

If one idea is large, note how it could be broken into a first vertical
slice — but still don't build it.

---

## Daily report

### Weakest area identified
One sentence: the biggest gap found this session, and why.

### Candidate ideas (ranked)
For each: name, one-paragraph pitch, the 1–10 scores from §4, which
existing systems it touches, and — if picked — what a first vertical slice
would look like.

### Open findings this touches
Which of F1/F2/F5/F6/F7/F9 (or a new one) this backlog would address if
approved.

### Awaiting approval
State plainly that nothing was implemented and the list is waiting on the
developer to pick one (or none).
