# Frontline

A systemic crime-family management simulator. You start as a nobody with $2,500
and one person you half-trust, and build an organization out of decisions that
have consequences.

This is the complete eight-phase design plus a **deep-simulation pass** driven
by a full engine audit: the simulation foundation, the criminal economy, the
people and what they want from each other, the city they operate in, the three
other families who want it, the agencies building a case against you, the wars
and bargains between all four, the city's opinion of the lot of it, and what
happens to the organization when you are no longer the one running it. It is
playable for many in-game years, and for longer than one lifetime.

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Play it at http://localhost:5173 |
| `npm test` | 321 tests: determinism, invariants, a 365-day soak, AI behaviour, investigations, war and diplomacy, succession, the briefing, game modes, balance guards, faction beliefs and bonds, memory, failing fronts, the two trades, and a 24-world statistical harness with anomaly detection |
| `npm run build` | Production build |
| `PROBE=1 npx vitest run balance` | Print the full balance report when tuning |
| `PROBE=1 npx vitest run statistics` | Print the distribution across 24 simulated cities |

---

## The three systems that carry the game

**Operations** commit crew and money for a number of days. The success chance
you are shown is the chance you get, broken down into its terms so you can see
*why* it is what it is. Failure is not just "no money" — it rolls a consequence:
someone hurt, someone arrested, a heat spike, or evidence left behind.

**Crew** are not employees. Every person has hidden stats — loyalty, greed,
ambition, fear, discipline, grievances — and **you never see the numbers**.
`perceive()` returns a phrase blurred by how little you know them, and the blur
shrinks only by working alongside them. Weekly, everyone re-evaluates their
position against pay, promotions, danger and whatever they are still holding
against you. Skimming starts silently; you are not told.

Their portraits obey the same rule. A crew member's face is derived from his id
— never stored, and never drawn from the simulation's RNG, so it survives a
reload without costing the seeded stream a roll — and how much of it you can
see is his `familiarity`, resolved on the same `PERCEPTION_TIERS` that blur his
stats. A man you have not worked with is a silhouette with a rank on it. At 60
he has a face, which is the same line `memories.ts` uses to start telling you
what he is carrying. At 85 he is lit. It is one sprite and a palette per tier:
`ui/art/`.

**Heat** is sticky. It decays only after quiet days, decays slower the higher it
is, and feeds back into operation success — so attention causes failures which
cause attention. The main lever against it is working *beneath your standing*:
nobody building a case against a Capo cares about a corner shakedown.

**Territory** gives every operation a location, which is what turns the crime
loop into the engine of territorial control. Influence is per-faction and
independent — four organizations can work the same streets, and control belongs
to whoever has the most of it. You can only work a district you hold or one
next to it, so expansion has a front line. Rich districts pay more; policed
ones are louder; districts you hold generate less heat. You read a district
precisely only where you have a real presence — the same rule as reading a
person.

**Businesses** sit in districts you hold and close the dual economy:

```
dirty cash → capacity → cut → clean cash
                 ↓
              exposure → heat and evidence
```

Throughput is what makes dirty money usable, and throughput is exactly what
gets a front noticed. Rank requirements are denominated in **clean** cash, so
laundering is load-bearing for progression rather than optional. The coming
payroll is held back from the wash — you launder what you intend to keep, not
money you are about to spend.

**Rivals** play the same game you do. Once a week each family runs

```
goals  →  resources  →  risk  →  decision
```

scoring six options — take new ground, move on somebody weaker, buy a front, go
quiet, talk, or take one of your unhappy men — against the live board, and
acting on the best affordable one. Nothing is sequenced or scripted. A family
attacks because attacking scores well for it *in that situation*, and the same
family goes quiet when its own heat climbs.

What separates the Falcone from the Kestler is four personality weights in
`config/factions.ts`, not four branches in `faction.ts`. The Falcone are rich
and cautious and sit on what they have; the Kestler are hungry and reckless and
will come at you early. Change the weights and the family changes.

You read a family the way you read a person: by how much ground you share. A
rival you have never crossed shows a reputation and nothing else — no wealth,
no objective, no history. Rivals also take districts *back*, so holding ground
means defending it.

**Law enforcement** is where every `EvidenceTrace` written since Phase 2 finally
gets read. Nobody watches a hidden wanted level: four agencies read what you
actually left behind — a job that went wrong, a man taken in, somebody cut loose
who knew too much, a front pushed too hard — and open a case when there is
enough of it. A case is therefore always explicable, and was always avoidable.

Cases walk nine stages in order, from Suspicion to Trial, each with teeth:
surveillance costs you success on every job, a financial investigation chokes
laundering, warrants seize cash, arrests take your people. Agencies only reach
as far as their remit — **only the Bureau can put you away, and only once you
are big enough for them to bother**. City Police can ruin your year and never
end it.

Going quiet genuinely works. A case with no fresh evidence and a player who has
actually gone still loses momentum and eventually closes. That is not a delaying
tactic — it is the answer, and it costs you everything you would have earned.

Against all of it you can buy counsel, turn somebody inside an agency, get at
what they have collected, or lean on a witness. The last two fail often enough
to be real decisions: a botched approach becomes a charge of its own. What you
can *see* of a case depends entirely on what you have bought — with nobody
inside, you know a file exists and nothing else.

**Diplomacy and war** run on one relationship matrix covering all four
organizations, so the families can fall out and make up with the player nowhere
near it. Resentment accrues from ordinary hostility — taking a family's ground,
leaning on their people, taking one of their men — but it **stops one step short
of war**. Crossing that line is always somebody's decision, and a war can only
be left by agreement, never by waiting.

That rule exists because the elegant version did not survive contact: deriving
war purely from the bottom of the scale meant months of ordinary friction tipped
organizations into wars nobody chose, and since wars do not drift back, the
player spent 85% of a two-year run fighting.

War is fought weekly over the districts both sides stand in. The loser takes
casualties — your people are hurt or killed, a rival sheds strength — the winner
takes ground, and everybody involved pays in money, heat and evidence. Losses
build weariness, which is what eventually makes an enemy willing to talk. You
can sue for peace, offer or demand tribute, propose an alliance, or declare war
outright; none of it is guaranteed, and a demand made from weakness is refused.

**Succession** is what stops the whole thing being pointless. Being removed —
convicted at trial, or reached in a war you were always losing — is not the
same as losing. If somebody in the room can hold it, the game continues **as
them**: one rung lower, considerably poorer, and playing a character whose
hidden stats you have spent years guessing at from the outside. Losing is
having nobody.

A claim on the chair is deliberately not built on loyalty. Loyalty is how
somebody feels about the man who is gone; a claim is what the rest of the room
will accept — standing, capability, record, tenure, gated by whether he wanted
it at all. You get exactly one thumb on that scale, and you have to press it
years early: naming an heir is worth a great deal and settles nothing, because
the man you name gains ambition he did not have and every senior man you did
not name heard you say so.

The handover is the most expensive week the organization will ever have. Half
the standing, a third of the money, some of the ground, and everybody who was
there for the last man specifically. What it buys is this: **the open files
lose the man they were built around**. A succession is the only way out of a
case that is about to land — the evidence survives, so it is a reprieve rather
than an amnesty.

**City conditions** are the world having its own month. A crackdown, a dock
strike, a recession, a sitdown between the families, a quiet stretch where
every detective in the city is pointed somewhere else. Each one is a state the
whole city is in for a few weeks, arriving because of something true about the
board, and each is expressed purely as multipliers the existing systems already
read — so a new condition is one config entry, not a change to four systems.

The first version of that was wrong in two instructive ways. It fired often
enough that the city was in a named condition more than half the time, which
makes the modifiers the baseline rather than a change. And the crackdown put
its teeth in `heatGain` — but heat is clamped at 100, so a multiplier on it is
nearly free for a player already pinned at the ceiling and a real cost to one
holding at 30. Exactly backwards. Anything meant to punish being loud has to be
expressed somewhere without a ceiling.

Balance is asserted, not assumed. `balance.test.ts` plays two bots for two
in-game years across eight seeds and fails if careful play stops beating greedy
play. Careful play averages heat ~27 with a ~58% success rate, holds a district
against active opposition and reaches Crew Leader on its best seeds; greedy
play pins at ~85 with ~39%, and stalls at Enforcer with nothing to show. It
also asserts that legitimate income stays *below* criminal income — the moment
fronts out-earn the jobs, this has quietly become a business simulator.

`faction.test.ts` guards the AI itself: that decisions change when the board
changes, that personalities diverge as a share of each family's own activity,
that nobody spends money they do not have, and that three families left alone
for two years do not turn the map a single colour.

`investigation.test.ts` guards the causal claim: no case opens against a player
who has left nothing behind however loud they are, none opens against evidence
no agency cares about, cases never skip a stage or exceed their agency's reach,
and a player who genuinely goes still starves one out.

`diplomacy.test.ts` guards the war rules: relationships stay symmetric across
all four organizations, accumulated resentment never tips into war by itself,
a war cannot be nudged out of by unrelated goodwill, and the families act
against each other with the player uninvolved.

`succession.test.ts` guards the handover: a claim is read through perception
rather than the true stats, naming an heir costs you with everybody you did not
name, removal continues the game whenever anybody can hold it and ends it when
nobody can, a handover leaves a smaller organization rather than a dead one,
and a condition stays weather — the city is in one well under half the time,
and never none of it.

`modes.test.ts` guards the last two: a sandbox cannot be finished by anything
and still hides what people are like, a career still can be finished, a
playerless city runs two years through the same path the UI uses without ever
stopping to ask a question, and an ally who turns out is felt on both sides of
the fight.

`report.test.ts` guards the briefing: it stays silent when nothing happened,
reports a week where nothing measurable changed but something did, never says
the same thing twice, never lets good news set the tone of a bad week, and
describes the span it actually covered — "+1 week" stops the moment something
needs you, so a press labelled a week is routinely three days.

### The briefing

Pressing "+1 week" runs seven days of eleven systems. Until Phase 8 the only
account of that was a log you had to read backwards — a fine record and a poor
briefing. So a snapshot is taken before time moves, compared to the state
after, and the difference written as sentences: who you lost, what the jobs
did, what the agencies got, what the city is doing, money last because money is
already on the stat bar.

It lives in `ui/report.ts`, not `sim/`. It is a pure reading of state, it
decides nothing, and it is never saved — adding a line to it cannot change the
outcome of a game.

**Two things the first draft got wrong**, both found by playing it rather than
by testing it:

*A diff of fields is blind to the week that matters.* A rival tried to buy one
of my men and I could not make payroll, and the briefing called the week
uneventful — neither of those moves a tracked number, and the first is the only
warning you get before he goes. Consequential log lines are now carried through
as well.

*Borrowing the log means borrowing its overlap.* Doing that produced the same
fact twice from both sides — "Corner Shakedown in Little Sicily failed" beside
"Corner Shakedown went wrong", "Little Sicily: you now hold control" beside
"You hold Little Sicily now". Anything naming a person, job or district the
diff has already accounted for is now dropped.

One sound per stretch of time, and the worst thing in it wins: a week in which
you lost a man and made money is a bad week, and playing the till noise over
the funeral gets the tone exactly backwards.

The briefing is a wire strip, deliberately not another sheet of paper. The memo
owns that material, and a second light surface would cost the memo the thing
that makes it land. This one reports; the memo asks.

### The tutorial, which is not a tutorial

Fourteen panels, thirty-odd systems and no manual. A first-time player has no
way of knowing which panel matters on day one, that dirty money cannot buy a
rank, or that payroll comes out on the seventh day whether the week earned or
not — and the two standard answers are both bad. A wall of text nobody reads,
or a tour with a cutout hand pointing at buttons, which this game would have to
stop the world to show and which would cost the memo the one thing that makes
it land.

So: one line at a time, in a strip above whatever you are looking at, said at
the moment it becomes true. `ui/tips.ts` is a list of `{ when(state), text,
panel }` — same shape as the events in `sim/events.ts`, minus the dice. It sits
in `ui/` for the same reason the briefing does: it is a pure reading of state,
it decides nothing, and no tip can change the outcome of a game.

Two properties make it a tutorial rather than a nag:

*A tip is shown only while its `when` is still true.* "One man limits you to
the smallest jobs there are" disappears the moment you hire a second, without
being dismissed and without having been taught twice. The first four are a
chain — each one's condition goes false as the next one's goes true — so a new
career is walked from one man and no idea to a finished job and a second hire
without the player acknowledging anything.

*Only one is ever on screen.* Order in the list is the curriculum; urgent tips
(heat climbing, a file opened on you, a war) jump it, because an open case
should not wait behind a tip about wages.

Everything after the opening chain fires on a condition rather than a clock:
dirty money with nowhere to go, a loan repaying itself, ground you have never
taken, an organization with no named heir.

Two things a tip can carry besides its condition, and both exist for the same
reason. `ceiling` is the last day it is worth saying — a save that has never
seen a tip is indistinguishable from a game started this morning, and loading a
four-year-old organization should not have payroll explained to it. `only` is
which ways of playing it belongs to; the opening chain is career-only, because
a sandbox start hands you a rank and a district and its first line would be
describing one man and a few hundred dollars to somebody looking at a capo's
books.

Both are fields rather than another clause inside `when`, and that is the whole
point of them: a closure that returns false cannot say whether it means "not
yet" or "never". The Tips page needs to tell those apart.

**The Tips page** (`ui/panels/TipsPanel.tsx`, under Records) is the other half.
A drip has an obvious hole in it — something goes by once, you dismiss it while
thinking about something else, and it is gone for the save. So the tips are a
place as well as a moment: what is on screen now, everything you have been told
and when, and what has not been said yet.

Two decisions there worth keeping. A tip you have not been told shows its
heading and nothing else, because printing all eighteen would be the manual
this exists to avoid. But a tip that is never coming — past its ceiling, or
belonging to a different mode — prints in full and says which, since
withholding it is no longer protecting the pacing of anything.

*Being told and being retired are tracked separately*, and that was found by
playing rather than by testing. Retiring is you saying you have understood
something; being told is only that it went past. The opening chain is built to
advance without anybody dismissing anything, so tracking dismissals alone had
the page filing three of the four tutorial lines under "not said yet" seconds
after saying them.

`got it` retires one, `×` stops all of them, `say it again` puts one back when
it is still true, and the `tips` button in the stat bar switches the strip back
on. That switch is per-save rather than per-browser, unlike sound and the skin:
what it really turns off is a body of advice a particular save is partway
through.

### What the playtest changed

An autonomous playtester was turned loose on the running game for three runs —
a Normal career to day 170, a reckless Brutal run, a cautious Easy one — and
told to answer one question: would a real player keep playing. It scored the
game 7/10 and named the loop repetitive from about day 85.

Most of what it found was not unfairness. It was **unforeseeability**, twice:

*A thirty-three dollar shortfall ended a run.* Day 140, $1,055 owed against
$1,022 on hand. The miss cost loyalty across the whole organization, and over
the next four weeks three of five crew walked — run effectively over at day
170. Every part of that is working as designed and none of it was visible in
advance: the only account of payroll was a log line written after the money had
failed to move. `payrollForecast` in `sim/economy.ts` now says what Friday
costs, in days, on the overview and in Finances, and it mirrors `tickEconomy`
exactly rather than approximating it — counsel is paid first out of the same
pot, so "the bill" is not the wage bill.

The same root cause made hiring look like a decision with no downside. The
tester classified recruiting as a **weak** choice — "never found a reason not
to hire" — while separately reporting a run that died of payroll. Those are the
same decision: the fee is one-off, the wage is forever, and the screen showed
only the fee. The hire button now says what the week looks like afterwards.

*Heat at 100/100 with no case at all.* On Brutal it ran an organization at the
ceiling of the attention meter for eight days without an arrest, because heat
is attention and a case is built from evidence, which comes from work that goes
wrong — a loud operator who never fumbles genuinely is safe. That is the design
and it stays. What was wrong is that the player could not tell which of the two
they were looking at, making the biggest number on the screen, in their words,
"cosmetic dread". `arrestRisk` adds one sentence under it, and it does not lift
the fog: an unreadable case says so rather than leaking its stage.

Also fixed, all of it reported from play: loans now quote the total owed and
the weekly bite against your wage bill *before* signing (a $19,814 loan
silently became $23,579); Lay Low costs two clicks and states its fortnight,
its wage cost and its four respect first, including "nothing to cool" when
street heat is already zero; the odds breakdown — which the tester called the
best thing in the game — now has its headline number in the job table so four
jobs can be compared without opening four panels; a "same again" button repeats
the last job with the same crew when they are all still free, cutting the
four-clicks-a-week the tester counted for the entire game.

Two content answers. The three most-repeated events fired verbatim four to six
times in a 170-day run — the recruit offer sat on a 12-day cooldown against a
single paragraph, so it could appear fourteen times in one game — and now have
four variants each and a longer cooldown. And Crew Leader, the longest rank in
the game, had the same three contracts for seventy days: `Debt Collection` and
`Union Local` fill it out, plus `Protection Route` so arriving at Capo does not
mean being unable to afford anything a Capo does.

**A second pass, blind**, scored it 6/10 and got bored at day 45 — worse on
both counts, and not comparable: that run never left Enforcer, so it never saw
the Crew Leader content above. What it did confirm is that the payroll spiral
did not recur (it hit sub-$200 cash twice and recovered both times), and it
found the two things below, which are now fixed.

*The first clean-money gate was a coincidence, not an achievement.* Crew Leader
wanted $15,000 clean against a laundering pipeline that, measured, delivers a
few hundred a week early on — because wages come out of dirty cash before
anything is washed, so almost nothing reaches the front. A scripted probe over
three seeds reached Crew Leader on day 102, day 152, and never. The threshold
is now $9,000 and the same three seeds arrive on days 78, 99 and 92. The
laundering panel also states which of the two ceilings is actually biting —
capacity, or the wage bill eating the input — because that rule was invisible
and it turns payroll into a laundering decision.

*The heat meter was hiding the only number that matters.* Each agency has a
hard ceiling: the city police cannot indict anybody, and only the Bureau, which
does not look at anyone below Capo, can reach a trial. So a street criminal at
100/100 heat is genuinely safe, permanently — both testers read it as maximum
peril. `arrestRisk` now carries the ceiling alongside the current state:
*"City Police can take it as far as arrests."* A federal case is something you
become eligible for by succeeding, which is a better sentence than a meter.

### How you do it, not just what you do

The one finding both playtesters reached independently, and the only one that
was about design rather than legibility: the Operations panel stops teaching
you anything once you have seen a rank tier. New jobs arrive with bigger
numbers on an identical decision, so by the twentieth launch the only question
left is which row pays most. One of them proposed the fix in as many words — a
loud/quiet choice trading payout against attention, separate from the existing
risk tiers.

So a job now has a second axis. **Quiet** pays three quarters, draws half the
attention and is slightly likelier to come off. **Straight** is the job as
described. **Heavy** pays a third more, draws nearly twice the heat, buys fear,
and costs you standing in the neighbourhood you did it in.

It earns its place by reaching systems the job list never touched. Heat feeds
the odds of every future job and the evidence a case is built from; district
sentiment feeds business health, territory control and what the trade can move
through; fear is a separate currency with its own bills. So the same contract
can be the right job done the wrong way — a heavy score in the district your
fronts trade in is an invoice that arrives three months later. It shows up as
one more line in the odds breakdown, which is the part of this screen both
testers singled out as the best thing in the game.

Three options, not five: the choice has to be readable in the second it takes
to launch a job, and a fourth would be a slider pretending to be a decision.
`approach` is optional on both the active operation and the result, so saves
written before it existed load and resolve as Straight.

Two smaller things from the same report. Recurring priced offers — the
short-notice job, a family wanting an understanding — were sized off standing
alone, so a tester was shown the same opportunity at $8,154, then $19,078, then
$19,842 while holding four figures the whole time: three pop-ups, three
guaranteed declines, no decision in any of them. The ask is now bounded by what
is actually on hand. The share is the tuning, and the balance probe set it: at
four fifths, the greedy player started dying a year early because it could
stake almost the whole treasury on a coin flip every fortnight. Under half
leaves it expensive without being able to end a run on its own.

**A finding that turned out not to be one**, recorded because the investigation
was more useful than the fix would have been. The same tester reported that
rival standing never moved however hard they antagonised a family, and the
cause looked obvious: the panels read `relationship(player, them)` while the
consequences write `relationship(them, player)`. Between two families those are
genuinely separate records. With the player they are not — `bond` has no
faction entry to hang the player's own side on, so it falls through to the
other party and both directions resolve to the same object. The panels were
reading exactly the number the events were writing. A test asserting the
opposite is what caught it, and `diplomacy.test.ts` now pins the symmetry so
that anyone who later gives the player a real bond record has to come past it
and decide what the screens should show. The reported symptom remains
unexplained; it is not this.

One thing worth recording as **not** a defect. The tester reported hunting
every tab to find what was blocking the clock. The blocker is always a memo,
and a memo is a full-screen modal — but it renders outside `<main>`, and the
tester was reading the game through `document.querySelector('.main').innerText`.
A human cannot miss it. Not every finding from an agent playing through a text
dump is a finding about the game.

### Sound and motion

There is no audio file in this repository. Every cue is synthesised from an
oscillator or a burst of filtered noise at the moment it plays, because the
cues this game needs are not music — they are a drawer, a rubber stamp, a page
turning, a phone in somebody else's office. Short, dry and midrange: exactly
what two nodes and an envelope are good at. A cue defined by numbers can also
be tuned the way every other number in this project is tuned.

The one thing animated for its own sake is numbers. A week changes eight
figures at once, and a figure that changes instantly is a figure you did not
see change. **This is also where the one real bug of the phase was.** Browsers
suspend animation frames entirely for a page they are not compositing, so with
the window backgrounded the count never ran and the stat bar went on showing
the figures from before the turn — not un-animated, actually wrong, reporting
$2.4K clean when the player had nothing. A timer now guarantees the figure
lands on the truth whether or not a single frame ever arrives. The animation is
decoration; the number being right is not.

Everything animated also carries its meaning in colour, position or text, so
`prefers-reduced-motion` collapses every duration and loses no information.

Space advances a day, `W` a week, `Esc` dismisses the briefing, and number keys
answer a memo — after a bad fortnight, clicking through five of them is the
slowest part of playing this.

### The other skin

The game ships wearing two looks. The default is the one it was designed in:
warm tobacco-dark, brass for money and used sparingly, paper reserved for the
one document the game actually hands you. The other, behind the `crt` button in
the stat bar, is an IBM DOS terminal — CGA grey on black, behind a phosphor
tube with scanlines, a shadow mask, bloom, a vignette and a sync roll that
takes nine seconds to cross the screen.

It is about two hundred and forty lines, and it is that small for one reason:
`theme.css` uses `var(--…)` 238 times against ten hardcoded colours, so almost
the whole game recolours from the `:root` block. The mapping onto the CGA
sixteen turned out to be one-to-one with nothing left over — the game already
needed a ground, three text weights, a money colour, a danger colour, a good
colour and a cold institutional colour, and CGA has exactly those and no more.

Three things were not a token edit:

**The memo becomes a dialog.** Paper is nonsense on a phosphor tube, so the one
light surface in the game turns into the other thing a 1980s screen did when it
wanted your attention: a Turbo Vision box. Blue ground, white text, double cyan
border, hard drop shadow. It is a better object than the paper was, because a
DOS modal genuinely was a different *kind* of thing rather than a lighter one.

**A terminal font is wider than a UI sans, and by more than it looks.**
Measured in the running app, *Warehouse District* is 1.27x wider in Cascadia
Mono than in Segoe UI at the same size. Everywhere the layout reflows that
costs nothing, which is most of the game. The city map is SVG with a fixed
viewBox, so its district names do not wrap, they leave the box — those are set
smaller under the skin, along with the table type and every letter-spaced label,
because a monospace face already carries that tracking in the advance width.

**Selection is inverse video, and that needed the one `!important` in the
project.** The family name in the rivals table carries its house colour as an
inline style, since which house sits in a slot is drawn per seed and therefore
data rather than CSS. Inline beats every selector, so the selected row rendered
`#6d6f8c` on `#aaaaaa` — a contrast ratio around 1.7, and invisible.

What was deliberately *not* done is the interesting part. A real text-mode
conversion means an eighty-column character grid, and a character grid is an
information architecture rather than a skin: twelve districts, five capos a
family, three heat channels and a fifty-line log currently live in tables that
reflow, and in eighty columns they do not reflow, they truncate. The layout
stays flex and grid. Nobody can tell, because the tube is doing the work.

The one honest gap is the font. Real VGA text is a 9x16 bitmap and no vector
monospace has those glyphs, so `crt.css` declares a `@font-face` pointing at a
file that is not in the repository. If it is absent the browser falls through
to Cascadia Mono and the skin still works; drop
`Px437_IBM_VGA_8x16.woff2` (the Ultimate Oldschool PC Font Pack, CC BY-SA 4.0)
into `public/fonts/` and it gets noticeably more correct with no code change.

Nothing was ported from cool-retro-term, which is where the idea came from. It
is a Qt6/QML application and its effects are GLSL shaders under GPL2/3; this
project is not GPL, so lifting them would relicense the game. The layers here
are written from the same physics.

### Three ways to play

**Career** is the game. **Sandbox** is the same simulation with the losing
conditions off and a starting position you choose — the point being to reach
the late systems without spending ten in-game years earning your way to them.
It is not a cheat menu: nothing is made easier once it has begun, and it still
hides what people are really like, because a sandbox that hands over the true
stats has quietly switched off the one mechanic the game is built on.

**Simulation** has no player in it at all. The three families run the city
between them and you watch, a year at a time, through the same Territory,
Rivals and Diplomacy panels a career uses. The mode is read in four places —
the two that can end a game, and the two steps of the tick pipeline that only
exist because somebody is playing. Everything else is unaware of it.

That mode paid for itself immediately by finding two things a career hides:

*A memo nobody can answer stops time forever.* City conditions still queued one
in a mode with no desk to put it on, and since every step checks the queue
before it moves, eight presses of "+1 year" all landed on day 99. The test that
was supposed to catch this used `runDays`, which answers whatever is waiting —
so it passed against the broken build. It uses `advanceDays` now, the same path
the UI takes, and fails without the fix.

*Left completely alone, the city used to die.* The room-to-expand term fell to
zero against a district somebody already held, which reads as sensible and was
fatal: the three families partitioned the map perfectly, twelve districts at
100/0/0, and stopped. Nothing shared meant nothing to pressure, so no
relationship ever moved off exactly zero. A floor scaled by ambition means a
family with nothing left to take at home eventually looks at a neighbour's, and
the city now settles into cold-war hostility instead of silence.

**What Simulation does not do is start wars, and that is the AI being right
rather than broken.** Resentment deliberately stops one point short of war, so
the only route in is a family deciding it is twenty points stronger than
somebody — and three evenly matched families at full strength never are. The
thing that destabilises this city is a player entering it. A first attempt to
force wars by charging strength for aggression is not in the tree: measured
across thirty simulated years it changed nothing, because peacetime recovery
outpaced it tenfold, and a config knob that does nothing is worse than no knob.

### Allies who turn up

The alliance offer has always promised they "will come in on your side against
a common enemy", and for a long time the only thing behind that sentence was a
relationship adjustment. Now an ally in the war lends most of its strength to
every clash and takes a share of the beating; an ally merely friendly with you
sends quieter help and takes none — but the other side sees it and remembers,
which is how a two-way war becomes a four-way one without anybody deciding to
widen it.

The player is never conscripted. Rival allies turn out for each other because
they are AI actors deciding for themselves; the player's people go out when the
player says so. So the player is asked instead, by an ally in trouble, at the
worst possible moment — which is what an alliance actually is. Both answers
cost: men are gone for weeks and some come back hurt, and refusing is
remembered by the only organization on the board that was on your side.

### What people want, and what they think of each other

Everybody in the organization holds a **goal** — to earn, to move up, to get
through this, to run the place, to get out — chosen weekly from a
condition-gated catalogue and held for at least six weeks so nobody reads as
having no character. A goal bends their loyalty drift, changes how attractive a
rival's offer is, and changes what the room will accept from them when the
chair is empty. You are not told what it is. Below the familiarity threshold
you get nothing; in the middle you get the obvious reading, built from the
stats you can already see and therefore frequently wrong; only close up do you
get what the man is actually doing.

**Traits do something now.** Sixteen of them, each with hooks into systems that
were already running: a sloppy crew makes a job louder, a hot-headed one turns
a failure violent, an old school man cannot be bought, a gambler can. They
compose multiplicatively, so two loud traits on one person is worse than the
worse of them.

**People have opinions about each other.** A sparse edge list — trust,
resentment, debt — written only by things that actually happened: working a job
together, being passed over for a promotion, taking a charge somebody else's
plan caused, losing a succession. Grudges outlast friendships, ties to the dead
stop costing anything, and the crew sheet will only show you a tie between two
men you both know well. The consequence that matters: when somebody walks out,
the people who were loyal to *him* rather than to you have a decision to make,
and your only warning was a screen that had been quietly saying so for months.

### The city has an opinion

Media, public opinion and politics are one feedback loop rather than three
features, and building them separately would have produced three meters and no
mechanic. Violence, arrests, raids, trials and wars generate **coverage**;
coverage moves the city's **outrage**, and its sense of who you are if you were
named; outrage drags **political pressure** along behind it with a deliberate
lag; pressure makes agencies faster, lowers the heat at which they will open a
file at all, and makes legitimate business worse.

The lag is the design. A fortnight of fury does nothing, because nobody in an
office has moved yet. Two months of it is a task force that is still there long
after the city has stopped caring.

The headlines are public — anybody can buy a newspaper. Reading the mood behind
them takes somebody who talks to people, and knowing what city hall intends
takes real pull, which is the first time in this game that Influence buys
information rather than access. You can pay somebody in office, and what that
buys is precise: it does not reduce outrage, because you cannot buy what a city
thinks. It holds the response off it for a season, and it is itself a story
waiting to run.

### Fear is not respect

They used to be one number, which meant the optimal play was always violence
and the word "respect" was doing no work. They are now earned by different
things and spent on different things. **Standing** gates rank, recruiting,
alliances and who the room follows when you are gone. **Fear** keeps witnesses
quiet and keeps people from walking out — and costs you with the neighbourhood,
with recruits, and with the city, because a feared organization raises the
floor the city's mood settles at. Fear also fades if you stop reminding people,
which standing does not.

### Time happens to people

Everybody ages on the day the calendar turns. Past the decline age, skill and
nerve go and judgement arrives — an old soldier is a worse man to send through
a door and a better one to ask about it. People retire, and people die in their
beds, and neither is the same event as a man walking out angry.

The families have **bosses**: a name, an age, and a temperament that sits on
top of the family's own. When one dies the next has a different one, his
predecessor's agenda dies with him, and the Kestler in 2008 are not the Kestler
of 1978. That is the only mechanism by which the other three organizations
change character over a long game without the player doing it to them.

### What people remember

The organization had a grievance stat, and a grievance stat is a summary of
something that never existed: a man could be carrying sixty points of
resentment with nothing in the state saying what any of it was about. He could
not be reminded of it, asked about it, or weigh it against anything — so when a
rival arrived with an offer, all he brought to the decision was a number nobody
had kept the reasons for.

A memory is one thing that happened, on a date, sometimes involving somebody in
particular: he took a charge on a job you sent him on, he watched somebody else
get what he was owed, you sent counsel when it counted, he had the chance to
talk and did not. Weight fades toward a floor rather than to nothing, which is
the difference between forgetting and forgiving — eight years on he is not angry
about it and has not forgotten it either, and the fraction that remains still
tips a close decision.

Recall is read where it changes something: how buyable he is when a family
comes calling, how likely he is to talk to an investigator, and what the room
remembers of him when it is choosing who is next. The dangerous one is the
second. An investigator sitting across a table from somebody you left inside
for three months is having a completely different conversation from one sitting
across from a man whose family you paid for, and until this existed the
simulation could not tell those two men apart.

Memories deliberately add **no** weekly loyalty drift. The events that created
them charged for themselves when they happened, and stacking a second slow
drain on top is the exact mistake that made paying people properly stop working
once already. There is a test that fails if anybody reintroduces it.

At high familiarity the crew sheet will tell you what somebody has not
forgotten, with the date. Below that it tells you nothing, because a man does
not list his grievances for somebody he has known a fortnight.

### The two trades

Everything else the organization does is an *operation*: pay up front, commit
people for a fortnight, roll once, collect. That is the right shape for a
hijacking and the wrong shape for a trade, because a trade is a standing thing
you have to keep running.

    source or manufacture  →  stock  →  distribution  →  dirty cash
                                 ↓            ↓
                            seizable    sentiment, heat, evidence

**The product trade** is bought — an arrangement with somebody outside the city
that you have to maintain and can lose without warning. Three sources, and the
usual choice: cheap, reliable, or quiet, and you get two at most. The cheapest
comes in over the water, which means whoever holds the docks is pricing it. That
is the first thing in this game where a diplomatic position has a number
attached to it: go to war with the family that owns the waterfront and your
margin more than doubles overnight.

**The arms trade** is made. A workshop is capital with a lease and an address —
it produces every week whether or not you have anywhere to send the output, and
a warrant can name it. Lower volume, far higher value, and one customer nobody
else has: **the other families**. They pay well above street value because they
are buying capability rather than goods, and every crate makes them measurably
harder to fight. Nothing warns you. The strength figure on the Rivals panel
simply goes up, and in eighteen months it is pointed at you.

Both are limited by two ceilings at once — the streets you hold and the people
you have free — and whichever is shorter is the decision. The crew is
deliberately the same crew operations want, so running a trade is choosing not
to run jobs. Stock is the only asset in the game that physically exists
somewhere, which is why it is the only one a raid can take off you.

The product trade's real cost is not heat. It is that a district you run it
through turns against you, and sentiment gates businesses, operation success and
eventually whether anybody will sell to you at all.

As with laundering, both are abstract economies and nothing else — units,
routes, capacity, spoilage, exposure. Nothing in `config/contraband.ts`
describes how anything is made, moved or concealed, and nothing should be added
that does.

### Fronts that go under

A business used to close only when the player closed it, which made ten
businesses ten permanent annuities — buy once, earn forever. That is not a
legitimate business, it is a subscription, and it removed the one risk that
makes the legitimate economy a decision rather than a purchase.

Every front now has a **trade** figure, separate from its exposure, because
those are two different problems with two different answers. Exposure is what
an investigator thinks of it. Trade is whether it is a going concern, and it
falls when the neighbourhood has turned against you, when you are pushing too
much through the books, when a rival is running the same thing on the same
street, and when the whole city has stopped spending. A struggling front earns
like a struggling front, which is the warning; the panel names the largest of
the four pressures, because each has a different answer.

### What one family holds toward another

Not a score. Three things that routinely disagree, each written by a different
set of events:

- **Grudge** — what they hold against you. Written by harm they attribute to
  you, and it fades.
- **Respect** — whether you are taken seriously. Tracks what you can currently
  actually do, so an organization that was frightening five years ago and is
  four men now does not keep the reputation.
- **Trust** — whether a deal with you would hold. Earned slowly by peace
  holding, and destroyed in one afternoon.

A family can loathe you and still take you seriously enough to negotiate
properly. It can bear you no ill will and take your ground because you are
weak. It can have nothing against you at all and still not sign anything,
because the last person who shook your hand regretted it. None of that was
expressible in one number.

Each dimension is read by the thing that actually cares. War is declared over a
**grudge**, not a low average. A demand for tribute lands if they are afraid of
you *or* if they already take you seriously enough not to need showing. Peace
is accepted on **trust** as much as exhaustion — a player who has broken one
before is offering the same words and a worse guarantee. And an alliance needs
somebody reliable rather than somebody warm, so paying for one buys the
arrangement and not necessarily anybody who turns up.

**War is a date now, not the bottom of the scale.** That was the single
largest simplification: the old model spent a long comment apologising for
accumulated resentment tipping organizations into wars nobody had decided to
start, and clamped its way around the problem. Hostility is now free to go as
deep as it likes, and getting into a war still requires somebody to decide.

The payoff the old model could not represent at all is **treachery**. Turning
on somebody you were at peace with is a different act from finally moving on a
family you have hated for years, and everybody else in the city can tell the
difference — a betrayal costs you trust with every organization that was
watching, which is why nobody will sign anything with you two years later.

### They can be wrong about you

Every piece of fog in this game pointed at the player. `perceive` blurs a
person, `factionIntel` blurs a family, `caseIntel` blurs an investigation — and
behind all of it the AI read true state and was never wrong about anything. A
family that lost ground knew, instantly and correctly, whose people had taken
it.

Now they work it out. How well depends on how much of the district they were
standing in and how carefully the job was done — the discipline of the crew you
sent, and whatever their traits do to how much they leave behind. When they
cannot tell, they blame somebody **plausible**: somebody in the district or
next to it, somebody they already dislike, somebody strong enough to have done
it. Nobody can be blamed for something they could not have done.

None of the consequences are written anywhere. Relationships already drive the
`ruin` agenda, pressure targeting and war declarations, so a family that blames
the wrong party redirects months of hostility at them without a line of new AI.
Two families can go to war over something you did in a district neither of them
was watching closely — and the way you find out is by watching what they do,
because the Rivals panel will tell you what they believe and never whether they
are right.

A second incident naming the same party hardens the first, which is what turns
a guess into a conviction: nobody changes their mind about who is doing this to
them, they accumulate reasons.

### Why did that happen?

The `Why` panel records every decision the families make **with the scores that
lost**, not just the one that won. It is a ring buffer, it is capped, and the
simulation never reads it — writing to it must not be able to change an outcome.

It earned its place during the build. Families at dangerous heat were buying
nightclubs instead of going quiet, and the obvious fix — protecting the
consolidation score — did nothing. The panel showed why in one line:
consolidation was not scoring too low, `invest` was being multiplied past it by
the family's standing agenda. Protecting one option is no use when the plan can
promote another past it.

### What the audit found

The deep-simulation pass came out of a measured audit rather than a feature
list. Every one of these was invisible to a passing test suite:

- **Accepting a rival's peace offer did nothing.** The memo had two real choices
  and no resolver case, so a family trying to end a war could not be allowed to.
  Measured at six years of weekly offers with the relationship never moving.
- **Zero wars between the families in thirty years, across every seed.** Three
  evenly matched organizations could never reach the twenty-point strength lead
  that declaring one required, because unconditional peacetime recovery pinned
  all of them at 100 forever.
- **Two of the three families idle in 65% and 90% of weeks.** Once the obvious
  moves were taken, every option scored below the action threshold. They now
  hold a standing agenda, which is what an organization has instead of an
  opportunity.
- **$137,000,000 of rival wealth after thirty years**, with going quiet paying
  better than working. Families now have a payroll, and shed muscle when they
  cannot meet it.
- **Every seed produced the same city** — identical business counts, identical
  final map. The people were procedural; the city they operated in was not.
- Nobody aged, traits did nothing after generation, and the loan shark's debt
  was written to a flag nothing read.
- **The AI was never wrong about anything.** It read true state directly, so
  no rival could suspect the wrong party, be deceived, or act on a stale
  belief.
- **People remembered how much, never what.** A grievance score with no events
  behind it, so nothing could ever be recalled, weighed, or asked about.
- **A front could not fail.** Bought once, earned forever.
- **Every organization's view of every other was one number**, which is exactly
  the generic score the brief warns against — and it made betrayal, respect
  without warmth, and warmth without reliability all unrepresentable.

The 24-world statistical harness exists because none of that was a broken
invariant. All of it was the simulation being *boring* in a way no single-world
assertion was looking for.


### Performance

Measured rather than assumed, and the answer was to do nothing. Two in-game
years simulate in **20ms** (0.028ms/day), an autosave is **0.08ms** on a 28KB
payload, and every collection that could grow without bound — the log,
operation history, faction history, case history, spent evidence — was already
capped. There was no optimisation worth making, so none was made.

**A note on long-running tests.** Use `runDays` / `runDaysSolvent` from
`__tests__/helpers.ts` for anything meant to cover a long span. `advanceDays`
stops the moment an event needs the player — correct for the UI, quietly
disastrous in a test, where it silently turns "run two years" into "run until
the first thing happens", sometimes two days. Several invariant tests were doing
exactly that before the helper existed. A dead player also freezes the clock, so
use `runDaysSolvent` when testing what happens *around* the player.

---

## Architecture

One plain `GameState` object. Systems are functions that mutate it. React reads
it through a version-counter store. No Redux, no ECS, no event bus.

```
src/
  config/     All balance numbers. Tune the game here, never in logic.
    tuning/         The numbers, as plain JSON — editable without a toolchain.
                    difficulty, heat and economy so far; the `.ts` files beside
                    them keep the shapes and the reasons. See tuning/README.md.
    economy.ts      wages, rank thresholds, attribute curves
    operations.ts   the job list, success formula weights, failure tables
    npcs.ts         traits, stat ranges, perception bands, drift rules
    heat.ts         tiers, decay, lay-low
    territories.ts  the twelve districts, adjacency, control thresholds
    businesses.ts   the ten front types, laundering and exposure rates
    factions.ts     the rival families, their personalities, and the AI weights
    lawEnforcement.ts  agencies, the nine stages, evidence decay, counterplay costs
    diplomacy.ts    war thresholds, clash maths, diplomatic acts, poaching
    succession.ts   claim weights, what naming costs, what a handover keeps
    world.ts        the city conditions, their causes and their modifiers
    goals.ts        what a person can be after, and what wanting it does
    ties.ts         what one incident between two people is worth
    perception.ts   coverage, outrage, political pressure, the patron
    beliefs.ts      how clearly a family sees, and who they blame when they cannot
    memories.ts     what can be remembered, what it is worth, and how it fades
    contraband.ts   the two trades, the suppliers, the workshops, the arms sale
    diplomacy.ts    BOND — the three dimensions, what feeds each, and betrayal
    factionLeaders.ts  the men running the families, and how they differ
    modes.ts        the three ways to play, and where a sandbox game begins
    difficulty.ts   Easy / Normal / Hard / Brutal multipliers
  sim/        The simulation. No React, no DOM.
    rng.ts          seeded, resumable RNG
    types.ts        every entity type
    state.ts        newGame()
    clock.ts        advanceDay() — the tick pipeline, in order
    operations.ts   launch / resolve / consequences
    npc.ts          generation, perceive(), loyalty drift
    crew.ts         recruit, promote, dismiss, wages
    territory.ts    influence, control, expansion rules, district intel
    business.ts     acquisition, revenue, laundering, exposure
    faction.ts      the rival decision loop, relationships, what you can see
    investigation.ts  cases, stages, trial, lawyers, contacts, case intel
    diplomacy.ts    the bond matrix, war resolution, what you can say
    succession.ts   heirs, claims, removal, the handover
    world.ts        city conditions — worldMod() is read by four systems
    economy.ts      clean vs dirty money, payday
    heat.ts         accrual, decay, lay low
    events.ts       condition-gated event catalogue + resolution
    goals.ts        what each person is after, re-read weekly
    ties.ts         the sparse who-thinks-what-of-whom graph
    perception.ts   the city as an audience — cover() is called by five systems
    beliefs.ts      attribution: who they think did it, which may not be who did
    leaders.ts      rival bosses, their temperament, and their replacement
    aging.ts        the yearly pass: decline, retirement, natural death
    memory.ts       episodic recall — remember(), and the three reads of it
    contraband.ts   supply, stock, routes, distribution, seizure
    trace.ts        decision recording. Diagnostic only, never read back.
    player.ts       attributes, standing, fear, rank advancement
    save.ts         localStorage slots, version check
  store.ts    ~50 lines. The only place state changes.
  ui/         Panels. Presentation only.
    report.ts       the briefing — a pure reading of state, never saved
    audio.ts        every cue, synthesised. No audio files in the repository.
    motion.ts       the counting figures, and the guarantee they land correctly
    panels/CityPanel.tsx   the papers, the mood, and somebody in office
    panels/DebugPanel.tsx  why the families did what they did
```

**Determinism is load-bearing.** The RNG seed and its call count live in saved
state, so loading a save resumes the identical random stream. That is what
makes Ironman honest and bugs reproducible, and it cannot be retrofitted.

**Adding things:**

- A new job → one entry in `config/operations.ts`.
- A new event → one entry in `EVENT_DEFS` with an `applies()` and a `resolve` case.
- A new trait → one entry in `config/npcs.ts`.
- A new district → one entry in `config/territories.ts` plus its adjacency.
- A new front → one entry in `config/businesses.ts`.
- A new supplier → one entry in `SUPPLIERS`. A new trade → one entry in
  `TRADES`; the chain, the panel and the seizure already handle it.
- A new family → one entry in `HOUSES` in `config/houses.ts`, and its id added
  to a temperament group so the draw cannot hand you three of the same city.
- A new corner of the map to start in → one entry in `SEATS`.
- A new rival action → one scorer, one executor, one `AI.weights` entry.
- A new agency → one entry in `config/lawEnforcement.ts` with its focus and reach.
- A new diplomatic act → one entry in `config/diplomacy.ts` and one `switch` case.
- A new city condition → one entry in `config/world.ts`. No simulation change.
- A new goal → one entry in `config/goals.ts` with an `applies()` and its effects.
- A new kind of incident between two people → one entry in `TIE_EVENTS`.
- A new thing the papers report → one entry in `COVERAGE` and one `cover()` call.
- A new thing a family can be wrong about → one `attribute()` call at the site
  of the harm, and the caller applies its consequence to `believed`.
- A new thing worth remembering → one entry in `MEMORIES` and one `remember()`
  call at the site of the event.
- A new thing that changes how two organizations stand → `adjustBond` with the
  dimension it actually moves. `adjustRelationship` remains for the ordinary
  directional nudges that do not mean anything more specific.
- A new lender → one entry in `LENDERS`, and a `collateral` branch in `invoke()`
  saying what he does when there is nothing to collect.
- A new system → one function and one line in the `advanceDay` pipeline.
- A new skin → one `[data-skin]` block of token overrides in `styles/crt.css`
  and one value in `ui/skin.ts`. No component knows skins exist.

**Import discipline.** `goals.ts`, `ties.ts`, `aging.ts`, `trace.ts`,
`beliefs.ts`, `perception.ts`, `market.ts`, `houses.ts` and `capos.ts` are
leaves: they read state directly and import only config, so the systems that
consume them cannot create a cycle. `market.ts` has to be one — `priced()` is
read by operations, businesses, contraband, the crew and the rank check — and
where a leaf needs to reach *up*, it takes a hooks object from `clock.ts`
instead: `AgingHooks` for a death, `LoanHooks` for a collection. Where that means
duplicating a one-line accessor, it duplicates the accessor — the same trade
`diplomacy.ts` already made.

---

## Design rules worth keeping

1. **Hidden stats stay hidden.** Anything the player reads about a person goes
   through `perceive()`. If a number reaches the screen, the trust mechanic is
   dead — you could optimize instead of deciding.
2. **The odds shown are the odds given.** Success chance is snapshotted at
   launch and stored on the operation.
3. **No dead buttons.** Every row in the nav does something. Systems that did
   not exist yet were listed as locked and labelled with the phase that
   delivered them; there are none left.
4. **Every choice changes state.** No event branch only prints text.
5. **Balance lives in `config/`.** If a tuning change requires editing `sim/`,
   the constant is in the wrong file.
6. **A threshold nothing reaches is a feature that does not exist.** Measure
   before believing a number. Two years of real play produced a maximum trust
   of 42 against a follow-the-leaver threshold of 45, so the most consequential
   thing the tie system does could not happen at all.
7. **Measure a knob before believing it.** `upkeepPerStrength` was set three
   times against the same 24 worlds: at 55 the wars were there but money had
   stopped constraining anybody, at 120 the families were too poor to lean on a
   new player at all. The comment records all three numbers, not just the one
   that shipped.
8. **Presentation decides nothing.** The briefing is a pure reading of state and
   is never saved, so a line added to it cannot change the outcome of a game.
   Sound and motion carry nothing that is not also in colour or text — if no
   animation frame ever arrives, every figure on screen must still be right.

9. **A free option is a rate, not a price.** Compare jobs by money per crew
   per day, never by the number on the ticket. The tutorial job hid as the
   optimal play for the whole game because nothing ever compared it that way —
   it was the best rate in the game and the two jobs meant to replace it were
   both worse. See "The no-capital ladder" below.
10. **A consequence the player cannot see is not a consequence.** Leaving a man
   under questioning always cost real loyalty and filed real informant
   evidence. Because nothing said so, two playtesters independently classified
   it as a choice that did not matter. If a branch changes state, something on
   screen has to say it changed.
11. **Refund in the money you were paid in.** `spend` takes dirty cash first, so
   a purchase can come entirely out of the clean pool. Handing that back with
   `earnDirty` launders it the wrong way and costs the player the balance rank
   progression is gated on. Use `spendSplit`/`refund`.

---

## The no-capital ladder

The single highest-leverage thing found by three rounds of playtesting, and it
was one line of config: **`corner_shakedown` was the only operation in the game
with no up-front cost, at every rank including Boss.**

A player who ran out of money therefore had exactly one move, and it was the
move they opened the game with. Being broke did not make the game harder, it
made it *smaller* — the dominant strategy, the repetition, the missed-payroll
spiral and "progression stops changing what I do" were all the same defect
wearing four hats.

Every rank now has one job that costs nothing to start. The rule they obey:

| | rank | $/crew-day | heat per $1,000 |
|---|---|---|---|
| Corner Shakedown | Street Criminal | 425 | 3.53 |
| Freelance Muscle | Enforcer | 475 | 3.51 |
| Rent Out the Crew | Crew Leader | 650 | 1.35 |
| Sit-Down Fees | Capo | 847 | 0.72 |
| Call In Tribute | Underboss | 3,344 | 0.19 |
| Enforce the Peace | Boss | 5,417 | 0.08 |

Each is the worst money and the highest heat-per-dollar at its own rank, so
capital always buys efficiency and the free job is the way *back* to the table
rather than a way to live at it. Each also beats the tier below, so the opening
shakedown retires itself instead of remaining correct forever.

Writing that rule as a test immediately failed on three jobs that predated it:
`boost_cars` and `burglary_run` were booked at two days when both descriptions
say the work happens in one night, and `protection_racket` was three men for
four days — the worst rate in the game, below the one-man tutorial job it is
supposed to succeed. The first upgrade the player could buy was a pay cut. All
three are fixed, and `broke.probe.test.ts` holds the rule.

### What measuring it properly found

That first figure — the no-capital jobs earning a broke organization $7,568
over 90 days against $2,742 — was **wrong**, and worth recording as wrong.

It was five worlds. Widened to twenty-four it came out the other way, and the
cause was a real design error: the ladder had been tuned on the number printed
on the ticket, ignoring the odds. Freelance Muscle looked like a step up from
the street shakedown at 475 a crew-day against 425; applying 76% against 86%
made it 361 against 366, which is a step *down* before its heat is counted.

The second cause took longer to see. **A one-day job compounds.** The street
shakedown's real advantage was never its rate, it was that a man is back the
next morning, so the takings turn into the capital that unlocks genuinely
better paid work far faster than a three-day job does. A free job that ties
people up is worse for recovery even at a higher rate.

Corrected for both — every free job re-tuned on expected value, Freelance
Muscle shortened to two days, and `burglary_run` fixed after the same metric
exposed it as another dominated option — a broke organization takes **6,615
against 6,587**. It is a wash.

So the honest claim is narrower than the one this section originally made. The
no-capital jobs do not pay a broke player more. What they do is give a broke
player something to *decide*, and pay respect and district standing while they
decide it — and the probe now guards against a future change quietly turning
them into a trap.

---

## Not built yet

Nothing from the design, and nothing from the audit. Four things were
considered and deliberately left out, which is a different thing from missing:

- **Splitting heat into five channels.** The four agencies already differ by
  focus, floor, size of target and reach — that is where the differentiation
  lives. Five meters would give the player five numbers to watch and the same
  decision to make.
- **Full rosters for the rival families.** Twenty simulated soldiers each would
  multiply the state by an order of magnitude to produce behaviour the player
  observes through a fog that would hide it anyway. A named boss per family is
  the ninety-per-cent version at five per cent of the cost.
- **Population, employment and transport dynamics.** Those fields are district
  character. Making them move would change no decision anybody makes.
- **Prison, parole and appeals as a subsystem.** Conviction already routes into
  succession, which is the interesting outcome. A parole calendar is
  bookkeeping.

There is one losing condition, and only a career has it: having nobody. Running
out of both people and money ends it, and so does being removed — convicted,
killed in a war, or handed the news that the organization has decided somebody
else runs it — with nobody senior enough to take over. Removal on its own does
not, which is the whole of Phase 7.

## The sit-down — the second verb

The top-ranked blocker from three rounds of playtesting was not a bug and not a
number. It was that **every decision in the game is the same three-field form**:
what job, which district, which people. Ranks added new numbers, never a new
kind of decision, so the systems underneath — law enforcement, diplomacy,
succession, the trades — were all reached through the identical five-second
click sequence.

The sit-down is the answer, and it is deliberately not allocation. It is
inference under uncertainty.

You call a man in, or ask a house for a meeting. Three exchanges. Each one you
pick a **register** — press him, offer him something, listen, tell him the
truth — against the same hedged perception words the crew sheet has always
shown: *seems loyal*, *thinks he is worth more*, *hard to read on nerve*. Until
now those were a readout you looked at and closed. Here they are the only thing
you have. The register lands or does not land against the numbers underneath,
which you never see.

Three rules hold it together, and each exists to kill a specific failure:

1. **Registers unlock from what he says.** Pressing a man three times gets three
   refusals. Listening once can surface what he is actually carrying, and only
   then does "name what he is carrying" appear on the table. Without this it is
   a menu of four buttons rather than a mechanic.
2. **A miss still teaches you who he is.** Familiarity rises whatever happens,
   so a badly-read sit-down is expensive rather than wasted. Without it the
   correct play is to only sit down with people you already read well — exactly
   the people a sit-down has nothing left to tell you.
3. **Nothing is a number on screen.** Reactions are prose, a miss is dim text on
   a grey rule, a read that landed is bright on olive. You infer that it went
   badly because he looked at the table.

A house uses the identical machine. The difference is where the hidden numbers
come from: a crew member has real stats, and a family is read off its leader's
temperament plus where it already stands with you — derived, never stored, so a
boss dying genuinely changes who you are talking to. Its chips are coarse
rather than noisy, because a house's temperament is the most public thing about
it. Knowing they are "hungry" still does not tell you whether hungry is hungry
enough.

The surface is deliberately **not paper**. The memo owns the only light surface
in this game and it means one thing: a document has been handed to you. A
conversation is not that, so the room goes the other way — the darkest surface
in the game, one warm edge standing in for the lamp, everything else gone.

It costs a day and has a three-week cooldown per person, and it is the one
lever that costs no money — so it works precisely when a player is broke and
out of moves, which is the state the no-capital ladder above exists to make
survivable.

## Delegation — the lesson at longer range

Chosen as the game's core lesson, after reading Koster: **you cannot see people
clearly, and must act anyway.** Everything built from here has to be a new way
of acting under that, or it is dressing.

The sit-down is that lesson at conversational range — read one man, three
beats, answer immediately. Delegation is the same lesson over a season. You
hand somebody a district *before* you know what he is, and find out from what
he does with it.

A steward is not a modifier applied to a district. He is an actor who decides
for himself each week, scored from the numbers the game has spent its whole
design hiding, in the same shape as the rival houses' AI — appetite from who he
is, opportunity from where he stands, best option wins with noise on top.

Three rules hold it up, and each guards a specific failure:

1. **What he does depends on his situation, not only his stats.** A greedy man
   paid above his own expectation and well regarded does not steal. Without
   that term, one look at the crew sheet answers the question forever.
2. **Delegating has to pay.** A district nobody works decays; a steward keeps
   your name alive in it. If holding everything yourself were optimal, nobody
   would ever take the bet the lesson lives in.
3. **Taking it back costs.** A man given a thing and stripped of it in public
   remembers. Otherwise delegation is a free trial rather than a decision.

### The number the whole thing turns on

Two of the six things a steward can do write **the identical line in the
record**. A man taking a cut logs "Worked it", because that is exactly what it
looks like from where you are standing. The only trace is money — a district
earning a little less than it should, for reasons nobody can point at.

So the cut he keeps decides whether this is a read or a reveal. Measured
against an honest steward on an identical district, which is the most
favourable case a player will ever get since a real game has no matched
control:

| his cut | caught | median week |
|---|---|---|
| 30% | 19 of 20 worlds | 2 |
| **24%** | **17 of 20 worlds** | **5** |
| 18% | 14 of 20 worlds | 8 |

24% ships. Five weeks of record before the takings separate, and **three
thieves in twenty are still getting away with it at the end of a season** —
which is what makes the suspicion real rather than a reveal on a timer.

Two measurement mistakes were made getting there and are recorded in the test.
The first metric was "the first week the average dipped below the line", which
measured noise: a week's takings swing 45% on their own, so the ratio of two
single weeks crosses any threshold by chance about half the time. It reported a
median of one week, reading as "instantly obvious" when the truth was "not yet
distinguishable from luck". And the test ran on **one seed**, which is the same
sampling error that produced a confident 2.8x elsewhere in this suite; on that
seed the thief happened to be obvious immediately.

### Found by playing it

Appointing a man on the day-347 save, then advancing three months, produced a
chain nobody scripted: he was given Little Sicily, payroll was missed twice, he
became the most aggrieved man on the books, he walked — *"No message, no
meeting, and he knew a great deal"* — and the district reverted on its own.

It also exposed a real defect. The automatic hand-back logged that he "heard
about it the same day everybody else did" about a man who had left a fortnight
earlier, applying a loyalty and grievance penalty to somebody the game had
already lost. Fixed, with a test.

## The informant — the lesson with the answer withheld

The third arrangement of the same lesson. The sit-down is one man across a
table, answered three beats later. Delegation is one man holding a district,
answered over a season. This one is never answered at all: you work out who is
talking from what the other side turns out to know, and you have to act before
you are sure, because waiting is also a decision.

**The substrate was already in the save file.** A leak is about a specific
night, and the game has always recorded exactly who was on every job. So the
page is a column of nights and a list of names each time, and the same name
recurring is the only evidence there will ever be. It has a consequence worth
finding: a man you never use never gives you away.

Three rules:

1. **He only gives away what he was there for.** No general leaks, no "he told
   them about the organization" — nights, with rosters.
2. **Not every leak is a person.** Agencies do their own work, and a case that
   knows about a night nobody talked about is the noise the whole thing depends
   on. Without it, three leaks intersect to one man and it is arithmetic.
3. **Being wrong has to be worse than being slow.** An accusation is not a
   question and there is no half of one.

### What the record is worth

Measured over 30 worlds, forty weeks each, using the plainest reading of the
page — whichever name appears on the most of the nights:

| | |
|---|---|
| the record named the man who was talking | **15 of 28 worlds (54%)** |
| picking a crew member out of the air | 8% |
| the same man named when he was *not* talking | 1 of 28 |

**Roughly seven times a guess, and still a coin flip.** That is the whole design
in one figure: the page is evidence rather than an answer, and acting on it is a
real risk rather than a formality.

Two cleverer statistics were tried and both scored *worse* — leaks against
nights worked (6 of 29) and leaks against what his share of the work predicts
(9 of 29) — because both are dominated by men with three jobs and two bad
nights. Counting is what a person does when they look at a list, so counting is
what the panel supports and what got measured.

### One at a time, and it is a design decision

"Who is talking" stops being a question the moment the answer can be four of
them: you kill the man the record points at, the leaks carry on, and that reads
as having been wrong even when it was right — destroying the only feedback the
mechanic ever gives. Measured with the cap off, half the crew was talking inside
a year and the read was worth 5 worlds in 16, against 13 in 15 with it.

### The two things it refuses to say

The accusation **prints the same sentence either way**, and there is a test
whose only job is to compare those two strings. Everything else branches — the
respect, the fear, what the room does about it, whether anything else ever comes
back — but not the line on the day.

And killing the wrong man does not buy silence, which would at least be
information. The real informant goes careful for two months while the agency's
own work carries on filling the page, so what the player gets is a thinner
version of the same record. Which is also exactly what a solved problem looks
like.

## Your word, and what it is worth

The sit-down could always answer a man's grievance with a promise — "you have
the next one", "you are covered" — and the promise cost nothing, because a flag
was written and never read. That made the strongest register in the game's best
conversation the cheapest thing in it: you could say it to everybody, every
fortnight, forever.

A promise now has a subject, a deadline, and a way of being kept that is
something you would have done anyway if you meant it. You keep "the next one" by
putting him on the next job. You keep "you are covered" by getting him through
the month.

Two rules stop it being a punishment mechanic. It is **always visible before it
lapses** — the crew sheet says what is outstanding and how many days of patience
are left, because a promise the player was never shown is a trick. And breaking
one **writes a memory rather than a stat**, which means it reaches the informant
gate, the poaching gate and the succession claim through exactly the same
channel a missed payday does, without a line of special-case code. A man you
lied to becomes reachable by an investigator, and nothing had to be wired up for
that to be true.

## Succession a young boss can reach

Every route out of the chair was something done to the player from outside: a
case an agency built, a war they were losing, or a body that got old. All three
are real and **none of them is reachable by a player who is careful**, which
meant the entire generational half of the game sat behind a door most careers
never walk through. A boss who starts at thirty needs twenty-five years of
calendar before the aging clock can touch him.

So there is now a door he opens himself, and it is caused by exactly one thing:
how he has treated the people who work for him. Three gates, deliberately the
same shape as the assassination roll — somebody senior wants it and has stopped
thinking much of you; enough of the room is carrying something of its own to let
him; and it is still unlikely in any given week.

Every input has been sitting on the crew sheet for months in the usual fog, so
this is the longest-range use the perception system has ever had. The warning
says that a meeting happened and **refuses to say whose idea it was** — naming
him would turn a succession risk into a to-do item.

It also gives naming an heir its missing cost. You have told a man he gets it
eventually and made waiting the only thing between him and it; the config
doubles his weekly chance of deciding that eventually is now.

## Agencies notice organizations, not titles

The agency table gated on rank, which was the wrong instrument for a subtle
reason. A rank here is a *conjunction* — respect and crew and clean money and
jobs and districts — so it moves at the speed of whichever term is slowest. An
outfit of thirty men holding half the city with nothing laundered is still an
Enforcer, and the Task Force could not see it. Meanwhile a small, tidy, well
laundered crew could be a Capo and pull a federal ceiling over four men.

The gate is now a footprint — bodies, ground, fronts, and how thick the folder
already is. Four things an agency can actually see without opening a file, and
deliberately not respect, not clean money, and not a title nobody at a federal
desk has heard of.

## How long the game keeps offering something new

Koster's claim made into a number: **the week the last new *kind* of move
becomes available**, after which the game is presenting the same menu forever.

Kinds, not instances — a fifth variation on a decision already grokked adds
nothing, so "which job" counts once however long the operations table is.

> The last new kind of move arrives in **week 16** of careers running 120 weeks.
> Roughly **87% of a career is played on a menu that has stopped growing.**

That is a supply-side ceiling rather than a model of a person: a human keeps
getting better at these moves long after the last one appears. What it bounds is
the other half — once no new kind is coming, no amount of skill will find one.
The honest consequence is that the only way to raise the number is to add a
genuinely different kind of decision, not another instance of one that exists.
The three built this round each moved it.

### The instrument that measured nothing

The first version measured the *mix* of moves per eight-week window and looked
for the week the mix stopped changing. It never settled, in any world, which
read as a wonderful result. It was noise: two eight-week windows drawn from an
identical distribution differ by 0.2–0.35 in total variation simply from having
eight samples across ten categories, which is larger than anything the game was
doing. The metric had no signal in it and would have reported the same triumph
for a game with one button.

The replacement has no such freedom — a kind of move either has appeared or it
has not — and it is checked against a bot restricted to one move, which reports
week 1.

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

## The floor was never made of money

A playtester spent 168 days without leaving the bottom of this game — never past
Associate, never above six thousand dollars, never able to afford the cheapest
front. They put the moment their decisions stopped changing at **day five**, and
described what they had lived through as an economic death spiral: heat causes
an arrest, the arrest costs income, no income means no lawyer, no lawyer means
more arrests.

Every instrument in this suite had been measuring the other player. The balance
test holds a scripted line, the informant probe pins the treasury at half a
million, and the grokking probe holds its bot solvent *by design* so the thing
under test is the only thing moving. All of that is correct for what those files
ask, and it meant nothing here had ever watched a career fail.

So `floor.probe.test.ts` plays 24 careers with no safety net and measures one
thing:

> a **stuck week** is a week in which, after wages, the organization cannot
> afford to launch a single operation available to it

Which is the tester's experience stated as a number — not "did it go bankrupt"
but "was there anything to do".

### What it found

| | before |
|---|---|
| stuck weeks, of 26 | median **5**, worst **14** |
| longest unbroken run | median 3 weeks, worst **8** |
| careers that went bankrupt | 0 of 24 |

And then the diagnosis, which is the entire point of having built it:

> **stuck because: no bodies 127, no money 0.**

Not one locked week in 24 careers was a shortage of money. The no-capital ladder
built two rounds ago does exactly its job. What locks a career up is having
nobody left to send — the whole crew in a cell or a hospital at once, which on a
three-man outfit is one bad night, and an arrest holds somebody thirty to a
hundred and twenty days.

The tester's experience was real and their diagnosis was wrong, and so was mine:
I had this filed as "the economy's bottom end" and was about to go and change
prices.

### The fix, and what it deliberately is not

`work_it_yourself`: needs nobody, costs nothing, available at every rank, pays
badly. You go out yourself, because there is no one else.

| | before | after |
|---|---|---|
| stuck weeks | median 5, worst 14 | **0, worst 0** |
| longest unbroken run | worst 8 weeks | **0** |
| median peak funds | $12,827 | $11,683 |
| median rank at day 180 | 1 | 1 |
| careers holding a front | 14 of 24 | 15 of 24 |

The last three rows are the ones that matter. The rescue removed the lockout and
moved nothing else — no organization with a spare hand would ever choose solo
work, so it changes nothing for a career that is going well. It exists so that
the answer to "what can I do this week" is never *nothing*. A game that can take
away your ability to act has stopped being a game for as long as that lasts.

The probe now asserts zero rather than "few", because with a job that needs
nobody a stuck week can only mean something has broken.

### Two guards bit, and both were right

`crewCompetence` returned 0 for an empty crew — harmless while every job needed a
body, and the day one did not it scored solo work as though it had the worst
possible crew. Nobody is now neutral, not terrible.

The free-job guard divided by `crewRequired` and hit a division by zero, scoring
the new job as infinitely profitable. The rule it encodes is right; the
arithmetic had to count the player as the body they are.

And the recruit-warning test lost its resolution: with a floor under income,
missed paydays became rare enough that both hiring policies pressed against zero
and tied at 9. It is measured on *worlds that got into trouble* now — 7 against 3
— which was always the better statement of a rule about positions rather than
about the depth of one.

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

## Save compatibility

`SAVE_VERSION` is 12. Older saves are rejected with a clear message rather than
migrated — pre-release, that beats maintaining a migration path forever. Eight
added goals and ties to every person, leaders and agendas to every family, the
city's opinion, the fear currency, and the decision trace. Nine gave the
families beliefs about who is doing this to them, ten replaced the single
relationship score with a bond of grudge, respect and trust, eleven added
episodic memory and front health, and twelve added the two trades.

Everything built since has gone in as an **optional field**, which is the reason
`SAVE_VERSION` has not moved: `sitdown?`, `wagesOwed?`, `stewardId?`, `ledger?`,
and now `promises?`, `leaks?`, `informingSince?` and `carefulUntilDay?`. Absent
reads as the truth for a save written before the system existed — nobody was in
the room, nothing is owed, nobody has said anything to anybody, and nobody is
talking. A day-347 career from before any of this loads and keeps playing.
