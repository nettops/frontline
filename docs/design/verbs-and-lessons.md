# The second verb, and the lessons at longer range

The sit-down, delegation, the informant, promises, succession and how long the game keeps offering something new. Extracted from `README.md`.

---

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
