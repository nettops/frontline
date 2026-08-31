# Systems in depth

How the briefing, the tutorial that is not one, the presentation layer, the three modes, and the people systems actually work. Extracted from `README.md`.

---

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
