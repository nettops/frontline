# The playtest brief

The brief handed to a cold tester, kept here rather than retyped from memory
each time — three rounds were run from three slightly different versions of it,
which is a poor way to compare three sets of scores.

## What changed, and why

Each addition below came from a specific failure of a previous round. They are
recorded so nobody removes one without knowing what it was for.

**The harness notes** (round 5). Round 4's tester filed "rows shift under the
cursor" as the worst defect in the build. They were indexing elements globally
and clicking stale positions; the job table never moved. Half of that round's
MUST FIX list was their automation.

**"Take screenshots when judging how something looks"** (round 5). Round 4 read
the district map as a plain card grid and reported the map/table toggle as
broken. It was not — but they were substantively right that no adjacency was
visible, and they only found that by reading text.

**"Follow up on anything the game points you at"** (round 5). Round 4's central
finding was that four systems existed and nobody found them. The fixes were all
signposting, so the next round had to test whether signposts work.

**Part 3, the systems inventory** (round 5). Round 4's biggest finding had to be
inferred from what the report failed to mention. Asking for it directly turns
that into a statement.

**The progress timeline** (round 6). Rounds 4 and 5 landed in completely
different halves of the game — one reached Crew Leader and bought fronts, the
other never left Associate — and the scores moved with that, not with the build.
Without a trajectory there is no way to tell whether two reports are even
comparable, and the average across categories is meaningless.

**The reproduction gate on MUST FIX** (round 6). Two of round 5's four MUST FIX
items did not reproduce. Each cost real verification time, and chasing one of
them cost the developer two days of a saved game.

**The direct question about the money floor** (round 6). Both rounds circled it
without being asked. Round 5's tester spent 160 days unable to act and described
it as an economic spiral; measurement showed every locked week was a shortage of
bodies, not money. The tester's experience was real and their diagnosis was not,
which is exactly the sort of thing a direct question surfaces.

## What each round was run against

**Round 9 (2026-08-20, later still).** Run against a long measurement pass on
survival and the top of the rank ladder. What differs from round 8, and none of
it is said to the tester:

- *The ladder above Capo is reachable.* Boss had never been reached in any
  measured run and is now reached by 18 careers in 36; Crime Lord by 7. Careers
  ending early went from 25 in 36 to 11.
- *Ground can be taken.* Working a district pushes whoever holds it back. Before
  this the only way to take a district off a family was a war, and across 420
  measured district-observations it had happened three times.
- *Holding pays.* A district held earns standing every week without being
  worked, makes about a third less noise, and holds up to five fronts instead of
  two. A soldier can run one; it used to need an enforcer.
- *Money put away earns 0.45% a week* and is the only income that arrives while
  you are inside, laying low or dead.
- *A handover costs the man, not the family.* Clean money and influence keep
  90%, dirty 75%. Standing still halves — nobody inherits a reputation.
- *A large family can absorb more attention.* The apparatus used to stop growing
  at twenty people, which is exactly where the top half of the ladder starts.
- *Fear settles.* A man's nerve returns toward whatever it was before, instead
  of ratcheting to 90 and staying there for the rest of his life.
- *Thirteen interface repairs* from round 8's list, and two items on that list
  that turned out not to be faults.

**The three things to watch for, and none of them may be asked about.**

1. Does the tester ever work a district a rival holds, and do they notice the
   rival's number going down? Nothing announces it.
2. Do they find the yield on money put away, and does it change whether they
   bank?
3. Does the game feel oppressive? Mean heat across a career is 65 and the mean
   open case is 88 of 100. A bot copes by stopping work and waiting. A person
   may just feel strangled, and that is the number to hold their answer against.

**What was found by playing it, before handing it over.** Thirty days from a
cold start, and it produced one class of defect a bot cannot see: three of the
first modals of a career quoted four-figure prices to a player holding $2,500,
with the headline choice greyed out and "You cannot cover it" underneath. An
introduction is now priced to what the player could bear, and the two purchases
wait until their number is conceivable. Worth knowing because it is the kind of
thing this round should be watched for elsewhere.

**Round 8 (2026-08-20, later).** Run against the financial rework. What differs
from round 7, and none of it is said to the tester:

- *Rank stopped counting the wallet.* It counts the estate — cash, money put
  away, and what the businesses would fetch in the condition they are in. The
  rung figures moved with it: Crew Leader $12,500, Capo $60,000, up to
  $5,000,000 at the top.
- *A front's takings compound.* They are paid into holdings rather than the
  wallet, and holdings buy fronts directly at no discount.
- *A rung is lost only by a boss who left no plan.* Name a successor and the
  family keeps its position.
- *What a family has ever managed counts*, not only what it holds today.
- *Zero-crew jobs cannot be stacked*, actions are refused on a man in a cell,
  counsel keeps evidence out and costs a third of what it did, fronts survive
  light pressure, and the front-purchase blocker names the real reason.

**The three things to watch for, and none of them may be asked about.** All
three are strategies a scripted bot had to be *told*, and the whole question of
this round is whether the game teaches them unaided:

1. Does the tester spread across districts, or work one until the game stalls?
   A bot that stayed home reached Capo once in 36; one that expanded reached it
   ten times.
2. Do they ever put money away, and do they work out that it buys fronts
   without a haircut?
3. Do they name an heir before they need one?

Also worth noting without prompting: whether they find the `What the family is
worth` panel, and whether the estate makes buying a front feel like progress
rather than like spending.


A report is only readable against another one if you know what moved in
between. Kept here, in the half the tester never reads.

**Round 7 (2026-08-20).** The first round since a long measurement pass, and
the build differs from round 6 in ways that should be visible from the chair:

- *The heat model changed.* Attention distance now reads seniority sent,
  whether a district is stewarded and how many people are on the books, not
  rank alone; and an organization absorbs a little street heat continuously
  once it is large enough to have any apparatus. Round 6's tester never reached
  the rank that used to be the only release valve.
- *Six crew-leader jobs open on behaviour instead of rank.*
- *Who you send matters.* Carrying the work and being left out of it both leave
  a mark, visible as a Nights column and as notes on a man.
- *Counterplay that did not exist.* `reassure` now settles fear; counsel keeps
  evidence out of a case rather than only slowing the agency down, and costs
  roughly a third of what it did.
- *Fronts stop being disposable.* A business under light pressure holds its
  ground instead of losing its entire recovery.
- *Money can be put somewhere it cannot be spent*, and it still counts toward
  rank. New panel in Finances.

What to watch for in the report, without asking the tester about any of it:
whether the mid-game still stops giving them things around day 60, whether they
ever hold a real hoard, and whether they find the Nights column or the Put away
panel on their own.

**A note on the URL for this round.** The brief points at :5174, not :5173.
There is a real save in the :5173 autosave slot and a Career overwrites it.

*Superseded after round 7 — see "Starting a round" below. Asking for the right
port in prose failed twice in one afternoon: the developer's own measurement
tab wandered onto the tester's port mid-run, and the tester filed it. Round 8
onward uses `npm run playtest`, which makes the collision impossible instead of
discouraged.*

## Starting a round

```
npm run playtest
```

It prints a URL, a run id and a storage namespace. Give the tester the URL.

Three things it guarantees, none of which depend on anybody being careful:

- **A port nobody is using**, obtained from the operating system rather than
  guessed at.
- **Its own storage.** Every key the game writes lands under
  `mafia:run-<id>:`, so a harnessed run cannot see or overwrite a real save,
  and a tester who opens the wrong port finds an empty menu rather than
  somebody's career.
- **A stated identity**, so a report can say which instance produced it. The
  harness reports the namespace in every read.

## The harness

A dev-only `window.__frontline` with two calls. `__frontline.help()` prints the
vocabulary in the page.

- `read()` — the stat bar, the open panel, every table as records, every action
  and every *refused* action with the reason it gives, and the recent log. One
  call in place of read_page + get_page_text + a screenshot.
- `run([steps])` — a sequence of real clicks on real elements, stopping at the
  first step that cannot be done and reporting what the interface said about
  it, plus what moved in the stat bar and what appeared in the log.

Two properties it is built to keep, and both are load-bearing:

**It clicks the real thing.** Every step finds an element by its visible text
and dispatches a real `MouseEvent`. Nothing calls into the store. A disabled
button fails the step and reports its tooltip, which is where round 7's most
useful findings came from.

**It reads the page, not the state.** Most of this game is what it declines to
tell you — `perceive()` fogs every stat on every person. A reader that dumped
`GameState` would hand the tester the true numbers and delete the thing being
evaluated.

**Every step in the vocabulary has been run against the live game**, including
the ones that turned out to be broken when they were: the log reader matched
nothing at all, `{set}` could not find a slider named by its panel, `{row}`
picked the running job instead of the available one, and every number it
reported was read mid-animation. Those are fixed. The list is here because a
harness nobody has exercised is a harness that reports whatever it happens to
find, and this one had four such faults in its first hour.

**Numbers take 420ms to arrive.** `useCounter` eases every figure in the stat
bar to its new value, so a read taken immediately after a click catches it in
flight — the harness once reported a clean balance of $2,400 for an account
holding $700. `run()` now waits for stillness before both of its readings. If
you read the bar yourself with raw DOM queries, wait too.

**What not to batch: the first visit to a screen.** A blind playtest is worth
running because somebody notices a panel is confusing, and a panel nobody
looked at cannot be confusing. Batch the tenth job assignment, never the first.

## What a playtest is for, and what it is not

Round 7 cost forty-four minutes and 213 tool calls. Two of its three MUST FIX
items came from deliberately repeating one action rather than from playing, so
the most expensive part of the exercise taught the least.

A playtest measures *experience*: whether the game teaches itself, when the
decisions stop changing, whether the writing lands. It is a poor and slow way
to measure anything countable. The trajectory a tester spends thirty minutes
recording — rank and crew and cash at five checkpoints — is produced by
`ladder.probe` over thirty-six four-year careers in about six seconds.

So: balance changes get a probe. Interface changes get a targeted look in the
browser. A full blind round runs when the *experience* has changed, which is a
handful of times, not once per change.

## How to run it

**One tester, and every single-source claim verified against the code before it
is acted on.** That is the standing arrangement, and it is a deliberate choice
over running two.

The reason two was considered: one report per build reads as a signal and is not
one. Round 4 scored 8.0 and round 5 scored 7.4 on a strictly better build,
because one tester got solvent and the other did not, and the scores moved with
that rather than with any change. A second run on the same build separates
variance from change, because anything differing between two reports is variance
by construction.

The reason one won: replication **confirms, it does not refute**. The stat bar
being clipped off-screen appeared in exactly one report and was the most serious
defect anyone has found — a rule of "act on what two testers agree about" throws
it away. So the burden of telling signal from noise has to sit on the
verification pass either way, and once it does, the second run is buying much
less than it costs. Round 5 was handled exactly this way: four MUST FIX items,
two confirmed in the live DOM and two shown to be the tester's own automation.

Round 6 came out the same way and is worth recording as the pattern rather than
a coincidence. Its single MUST FIX had two halves and neither survived: crew
selection is keyed on `npc.id` with `key={npc.id}` and a row `onClick` closing
over the id, and the job list is `availableOperations` in config order with no
`.sort()` anywhere, so neither can move under a cursor. Both were re-checked in
the live DOM — clicking the fourth crew row by name selected that name, and
clicking a job row by its text opened that job's panel. What did hold up were
four of the six SHOULD FIX items, which is the ratio the gate is there to
produce: the softer list is where a cold tester is most useful, because it is
the list they are describing rather than diagnosing. The one item that was
substantively right but wrong about its own cause was the lay-low preview —
they said it priced one week instead of two; it priced two weeks correctly and
omitted the retainer and any arrears.

What that requires of the person reading the report, and it is not optional:

- Every claim that would change the code gets checked against the code first.
- "Could not reproduce" is a finding, and goes in the write-up next to the ones
  that did.
- A single report's scores are qualitative. The average across categories means
  nothing at n=1 and should not be quoted as though it moved.

Back up any real save before starting — a career autosaves over the normal slot.
Do not test anything against a real save afterwards without backing it up again;
that mistake cost two days of a saved game once already.

---

# BRIEF

You are an experienced game critic doing a blind playtest. You have never seen
this game, its code, or its documentation. Do not read the README, the design
docs, or the source unless a specific instruction below tells you to — you are
evaluating what a player experiences, and reading the source would tell you what
the designer intended rather than what the game communicates.

## The game

"Frontline" — a crime-family management simulator, running in a browser. A dev
server is already live at http://localhost:5173. It is a React app; state
persists in localStorage.

## How to play it

Use the Browser pane tools. Create your own tab and navigate to
http://localhost:5173.

Practical notes about this specific app, so you spend your time playing rather
than fighting the harness:

- React commits after JS returns, so read the page again after each click.
- SVG map cells (`.map-cell`) do not respond to `.click()` — dispatch a real
  event: `el.dispatchEvent(new MouseEvent('click', {bubbles: true}))`.
- **Do not cache element indices across clicks.** Opening a panel adds whole new
  tables and buttons to the page, so an index you computed a moment ago will
  point somewhere else. Re-query for the element you want immediately before
  clicking it, by its text or its row content, not by a position you remembered.
- `get_page_text` and `read_page` are usually faster and more reliable than
  screenshots for reading tables and panels. But take screenshots when you want
  to judge how something *looks* — some parts of this game are drawn rather than
  written, and a text dump will not show you them.
- If a panel seems empty, check whether it is gated behind something you have not
  done yet.

## What to do

1. Start a new **Career** on **Normal** difficulty. Take the default name or pick
   one.
2. **Play to keep the thing alive, not to tour it.** You are running an
   organization that can fail, and the difference between a player and a
   sightseer is the only thing several of these systems respond to. Try to
   still be standing at the end, with people who work for you and money to pay
   them. If something is going wrong, do something about it — and if you decide
   the answer is to do nothing, that is a real decision and worth reporting as
   one.

   This is not an instruction to play well. Playing badly and saying so is
   useful. It is an instruction to be *trying*, because a report from somebody
   clicking through screens describes a different game from the one a player
   meets.

3. **How far to play: to Capo, or day 300, whichever comes first.** Keep going
   past it if it is still teaching you things. Advance day by day early on; use
   +1 week or +1 month once you understand the loop.

   If you stop earlier than that for any reason — you were wiped out, you ran
   out of road, the harness broke — say so plainly and say on which day. A
   short run honestly labelled is useful. A short run that reads as a full one
   is worse than no run, because six of the nine scores would then describe the
   first third of the game while looking like they describe all of it.
4. Actually engage with every system you can find. Run jobs, hire and promote
   people, take districts, buy fronts, answer the events that come up, look at
   the other families, look at what law enforcement is doing, look at your own
   people closely. If you find a screen you do not understand, say so in the
   report — that is data.
5. **Follow up on anything the game points you at.** If it puts a hint on screen,
   a badge in the navigation, or a line in the log suggesting somewhere to look,
   go and look. Part of what is being measured is whether the game successfully
   tells you what it has.
6. **Record your position three times: at day 30, at the middle of your run, and
   where you stop.** Rank, crew size, cash on hand, districts held, fronts owned.
   Thirty seconds each.

   Three, not eight. Enough to read your scores against — a report that scores
   Depth 8 from a dead organization on day 119 means something different from
   the same 8 at Underboss — and no more than that, because a trajectory is the
   one thing here a bot measures better than a person. `ladder.probe` produces
   thirty-six four-year careers of it in about six seconds. Your time is worth
   more on the things it cannot do.
7. Keep notes as you go: what you were trying to do, what you expected, what
   happened, and where you were confused, bored, or surprised.

## Hard rules

- **DO NOT PRETEND TO PLAY. DO NOT INVENT RESULTS.** Every claim in your report
  must come from something you actually did and observed in the browser. If you
  could not reach a system, say you could not reach it. A short honest report
  beats a long invented one, and a fabricated observation is the single worst
  outcome of this exercise.
- **Do NOT modify the source code**, and do not edit localStorage to give
  yourself money, skip time, or otherwise create an advantage. Play the game as
  shipped. (Reading files is fine if you need to debug a harness problem — but
  not to learn the design.)
- If the game breaks, crashes, or does something that is obviously a bug, record
  it precisely (what you did, what happened, any console errors) and carry on
  playing.
- **Nothing goes in MUST FIX until you have reproduced it twice**, from a state
  you can describe. For each one, give the exact steps, and say what you ruled
  out — in particular, whether it could be your own automation rather than the
  game. An element that moved because the page grew is not a defect a person
  clicking with their eyes would ever hit. If you cannot reproduce it, it can
  still go in the report; put it under SHOULD FIX and say it happened once.

## The report

Write it at the end, in markdown, directly in your final message.

### Part 1 — where you got to

The three checkpoints from instruction 6, as a table: day, rank, crew, cash,
districts, fronts. Then one sentence on how the run went overall.

### Part 2 — scores

**Do Part 4 first.** The scores have to be honest about what they cover, and you
cannot know that until you have written down what you actually touched.

Rate each of these 1–10, and for each one **name specifically what is blocking a
10**. Be concrete: "the X screen never told me Y" is useful; "needs more polish"
is not.

Then, next to any score that rests on part of the game you never used, say so in
the same line — for example *"Depth 6 — though I never used the trade or the
diplomacy screens, so this is a score for the job-and-crew loop only."* If a
whole axis rests on something you never reached, mark it **unscored** rather than
guessing. An unscored axis is a useful result. A confident number covering a
third of the game is not, and it is worse than no number because it looks like an
answer.

Not using something is never a mark against you and never something to write
around. It is one of the most useful things you can report.

- First hour: does it teach you what it is?
- Clarity: can you tell what your decisions will do?
- Feedback: can you tell what your decisions did?
- Depth: are the decisions actually interesting?
- Pacing: does it keep giving you something new?
- Difficulty: is it fair, and does failure feel earned?
- Writing and tone
- Interface and information design
- **Standing in it**: did you feel like you were running a family, or operating a
  spreadsheet that had families in it? Score what you felt, not what you were
  told. See Part 3 questions 5 to 7 — answer those first; this score is a summary
  of them.
- Fun

Those last two are different questions and should not track each other. A game
can be enjoyable without you ever inhabiting it, and it can be gripping without
being enjoyable at all. If your two numbers are the same, check that you meant
them to be.

### Part 3 — four questions

Answer these in prose, honestly, from your own experience of playing:

1. **What did the game teach you?** Not what it told you — what you learned to do
   that you could not do at the start, and what mental model you ended up with.
2. **When did your decisions stop changing?** Name the in-game day, as near as
   you can, after which you were making the same kinds of choice over and over.
   Say what you were doing at that point and why nothing new came up.
3. **Was there ever a point where you could not afford to act, or had nobody to
   act with?** When, how long did it last, what did you do about it, and what did
   it feel like — a setback you had earned, or the game going away for a while?
4. **What were you still uncertain about at the end?** Things the game
   deliberately would not tell you, and whether that uncertainty was interesting
   or just annoying.
5. **Name somebody who worked for you, without going back to look.** Then say
   what you knew about them and how you knew it. If you cannot name anybody, say
   that instead — it is the more useful answer and there is nothing wrong with
   giving it.
6. **Was there a point where you did something you did not want to do, to keep
   the thing running?** What was it, what did it cost, and did you resent paying
   it or feel it was owed? If it never happened, say so and say what you think
   you were never made to choose between.
7. **At the point you stopped, what would you have lost if it had all gone?**
   Answer in terms of what was actually in front of you, not what the rules say
   you had. "Some money and a rank" is a real answer and a damning one.

### Part 4 — the systems

**Used.** Every distinct system you actually used, and for each: **roughly what
day you first used it**, how you found it, and whether it changed how you played.

The day matters as much as the list. Two testers on an identical build have
reported the same system as the best-designed thing in the game, one having found
it on day 19 and the other on day 300 — and the gap between those two numbers is
a finding that neither report could have produced on its own. An approximate day
is fine. "Somewhere in the second month" is fine.

**Not used.** Everything else you are aware of, including anything you only
suspect is there — a panel you never opened, a button you never pressed, a word
in the interface you never chased down. For each, say which of these it was:

- **Never knew it was there.**
- **Saw it, couldn't work out what it did** or how to start using it.
- **Understood it, judged it not worth** the money, the time or the risk. Say
  what you would have spent it on instead.
- **Wanted to, was blocked.** Say what blocked you.

The four are different problems with different repairs, which is why the split
matters more than the list. The third one especially: a system you understood and
correctly ignored is a design finding, not an oversight, and it is the hardest
one for anybody to discover from the inside.

Be unflattering. "I never opened that panel in three hundred days" is a complete
and valuable answer.

### Part 5 — the list

- 🔴 **MUST FIX** — things that actively damaged the experience. Reproduced
  twice, with steps, and with what you ruled out.
- 🟡 **SHOULD FIX** — things that held it back, including anything you saw once
  and could not reproduce.
- 🟢 **WORKED** — be specific about what landed and why, not just praise.

Rank each list most important first. Assume the developer will act on every item,
so precision matters more than diplomacy.
