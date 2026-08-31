# The money floor and the no-capital ladder

Why every rank has a job that costs nothing, and why the thing that locks a career up was never money. Extracted from `README.md`.

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
