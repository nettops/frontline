# Round 29 — blind playtest report, 2026-09-17

Run against the merged Soprano build (`91befa4`: milestones 1–7, phase-5
screens, org-politics layer, capo pitches). Instance `mafia:run-round29`,
port 5329. One tester, blind, per `docs/PLAYTEST.md`. Report verbatim below;
the developer verification pass is recorded in `director-log.md`.

---

# Frontline — Blind Playtest Report
**Career, Normal, Italian. Nunzio Vaccaro. Day 1 to Day 301 (6 Mar – 31 Dec 1978). Run completed to the day-300 target; Capo was never reached — peak rank Crew Leader, held twice, lost twice.**

## Part 1 — Where you got to

| Checkpoint | Day | Rank | Crew | Cash (spendable) | Districts | Fronts |
|---|---|---|---|---|---|---|
| 1 | 30 | Enforcer | 4 | $2.6K clean + $1.7K dirty | 1 (Little Sicily) | 1 |
| 2 (mid) | 141 | Crew Leader | 6 on books, 3 in custody | $1.4K | 2 | 2 |
| Final | 301 | **Street Criminal** (again) | **1** | $2.9K clean ($23.8K put away, unreachable) | 2 | 2 |

One sentence: I built a two-district, three-front organization out of nothing, got my oldest friend arrested, went broke saving him, borrowed from a rival family to survive, and then watched ten people defect one by one over unpaid wages until, on New Year's Eve, I was a Street Criminal again with 125 respect, three indictments with my name on them, and chest pains.

The arc in one log line the game itself wrote: *"Rico Rinaldi talked. All of it."*

## Part 2 — Scores

*(Written after Part 4. My run never touched the Trade, wars, sit-downs, informant purchases, or any rank above Crew Leader — several scores are scoped accordingly.)*

- **First hour: 9/10.** The first-steps hints appear one at a time, exactly when true; the job ladder shows everything above your standing with plain-language unlock terms ("a district you can work without asking"); odds are itemized before you commit. Blocking a 10: the transition where street jobs vanish at Crew Leader and *all* work becomes weekly proposals is never announced — I stared at an empty WORK AVAILABLE table wondering where my income went.
- **Clarity: 8/10.** Almost every decision states its price and its consequence in advance, including the ugly ones ("Somebody now owns a piece of you"). Blocking a 10: the delegation buttons that silently do nothing (MUST FIX #1); Finances calling put-away money "not spendable" while Businesses happily spends it on fronts; the extortion memo's "Refuse" caption describing what sounds like paying.
- **Feedback: 9/10.** The best failure feedback I have seen in the genre. Every step of my collapse was named, in order, in the log: short payroll → named individual "has stopped speaking to you first" → defection with tenure ("208 days, and not one of them explained"). Blocking a 10: "Hear them out" resolved twice with no visible outcome anywhere; delegation silent no-ops.
- **Depth: 8/10** — scored for the job/crew/heat/money loop and people simulation only; I never reached the Trade, wars, or informant play. What I did reach interlocks for real: money has a *color*, heat taxes odds, repetition rots odds ("wears a groove" is a real mechanic that killed me twice), wages compete with lawyer retainers, delegation trades income for legal exposure, and ambition is a resource that spoils.
- **Pacing: 7/10.** Days 1–150 constantly introduced something new. Blocking higher: two long famines (days ~60–78 and ~141–187) where I could not afford a single option on any memo and the correct play was clicking through weeks; the last 60 days repeated the same five memo types with only the names changed.
- **Difficulty: 7/10.** Failure felt *earned* — I can name the exact decisions that killed me (the $6,000 for Rico's family, grinding a grooved job 19 failures deep, the Sokolov loan's 12% skim). Blocking higher: on **Normal** ("ordinary mistakes cost you, not the whole thing") the mid-game poverty trap felt like the whole thing — once wages slipped, custody, defection, and demotion compounded faster than any lever I could reach, and the memos kept offering only $6,000–$30,000 options to a man holding $451. The one working recovery lever (selling a front) is real but nothing points at it.
- **Writing and tone: 10/10.** The best thing in the game and it never once winks. "Yet is doing a lot of work in that sentence." "You did not go. Nobody said anything about it, which was worse." "Annoyance organises." Refusals, gates, even the debug-adjacent Why panel stay in voice.
- **Interface and information design: 8/10.** Dense, honest, keyboard-fast; the itemized odds card and the full ledger ("The wash: the share taken to change money's colour. It buys nothing.") are exemplary. Blocking a 10: unexplained nav badge numbers (Yourself "14", later "18" — I never learned what they counted); the recurring decimal-cents bug in laundering lines; key sections (proposals, runs-itself) live below the fold and are easy to miss for days.
- **Standing in it: 9/10.** I was two dollars short of sending a doctor to my sick daughter, because I had spent the money keeping an informant's family fed, and I sat there genuinely angry. I promoted a woman I knew wanted my chair because I was more afraid of her leaving. See Part 3, Q5–7. Blocking a 10: in the long famines the memos became a checklist and the spell thinned.
- **Fun: 7/10.** Different number than Standing-in-it, deliberately: days 1–150 were gripping; days 200–301 were an affecting but grinding administrative decline. It was a story I am glad I lived through and was not always enjoying.

## Part 3 — Eight questions

**1. What did the game teach me?** That attention is the real currency. At the start I optimized payouts; by day 100 I was reading every decision as "what does this leave behind" — heat on the street, nights in a case file, a name on a list, a grudge in a person. The mental model I ended with: money is fast and replaceable, *people and files are slow and permanent*. Also, concretely: never run the same job on the same street twice running; quiet work moves while dark; and an unpaid week does more damage than a failed job.

**2. When did my decisions stop changing?** Around day 190–210. After the second demotion the loop collapsed into: grind Work It Yourself / Corner Shakedown, click through the same five memo shapes (someone is inside, someone is being worked on, someone wants a cut, the file is moving, a door into a district), and refuse everything costing over $2K. Nothing new came up because everything new costs money or bodies and I reliably had neither.

**3. Was there a point I could not afford to act?** Two. Days 60–78: $451 in hand, forced to leave Rico to interrogation and forced to tell my sick daughter "not this time" while being *two dollars* short of the $453 option — that one felt earned and it stung exactly right. Days 141–187: five weeks at $186 with all four remaining crew simultaneously in custody — that stretch tipped from "consequence" into "the game going away," because the only inputs left were advancing time and declining memos.

**4. Still uncertain at the end?** Whether anyone in my crew was ever actually informing (the game promises it will never tell you — that uncertainty was *interesting*). What the nav badge numbers meant (annoying). Why delegation worked exactly once in the whole run (a bug, I believe, not a mystery). Whether the district-runner income ever actually arrived anywhere I could see (genuinely could not tell from the ledger — annoying). What "Angelo Falcone keeps asking who does the hiring" wanted from me — he never appeared anywhere I could act on (twice in the log).

**5. Name somebody who worked for me, without looking.** Rico Rinaldi. Day-one man, "very good" hands and "careless" habits — I knew that from the crew picker after one job. Loyalty "solid," then "steady enough" after I left him in a room, then he traded everything he knew for the door. I also carry Sofia Mercuri (wanted my chair, told me so through a stat line, left over $4,756 in unpaid wages eleven days after I named her my heir), and Elena Cordova, who was "frightened and it is not abstract — they are counting doors." I knew these people better than I know characters in games with voice acting, and everything came through stat descriptors and memo prose.

**6. Did I do something I did not want to do?** Three times, escalating. Took Sokolov's $30,219 knowing the terms were usury, because two cases were building and I had $889 — I resented every 12% skim afterward and the game never let me forget whose money it was. Left Hyman Schwartz to interrogation as pure arithmetic (three nights with me, knew nothing, $6,000 I needed) — that one I paid in reputation and it was owed. And "Not this time" to Nadia, which I did not choose at all — the game chose it for me by pricing both other options above my $451, and that was the moment I most believed I was the person on the screen.

**7. What would I have lost if it had all gone at the end?** Almost nothing, and that is the honest answer: $2,900, two fronts already rotting from unpaid upkeep, one associate who was "looking for the door," and a respect number. Everything worth losing — Rico, Sofia, Elena, the crew, the rank, Little Sicily's goodwill — was already gone, and the Career page had itemized each loss with a date. The game had already taken everything, slowly, in full view, which is a far better ending than a game-over screen.

**8. Something from twenty-plus days before I stopped that was still changing how I played.** Rico's testimony (day ~67) never stopped mattering: it fed two cases whose "Being watched −10%" line sat inside every odds card for the next 230 days, which pushed me to Quiet approaches, which cut income 25%, which is half the reason payroll slipped, which is why ten people defected. The single $6,000 decision on day 39 is legible in the final screen's crew count of 1. That is the deepest thing this game does: consequences do not expire, they compound, and the interface lets you trace the whole chain backwards.

## Part 4 — The systems

**Used** (approximate first-use day; how found; did it change play):

| System | Day | Found via | Changed play? |
|---|---|---|---|
| Operations: assemble, Quiet/Straight/Heavy, crew pick, itemized odds | 1 | First-steps hint | Constantly — the odds breakdown taught every other system |
| Recruiting (Organization) | 2 | Nav + rank ticker | Yes |
| "Keep doing this" job repeats | 3 | Button on assemble | Yes — and later killed me via the groove |
| Memos/events | 7 | Forced | The main channel of play |
| Front purchase + negotiation minigame | 9 | Businesses panel | Yes — the negotiation reads seller tells; got $1,161 off |
| Laundering pipeline | 10 | Businesses copy | Yes — taught me money has a color |
| Yourself: family, condition, rank terms | 3 | Nav badge | Yes — family memos got budget priority after Nadia |
| Territory, district detail, adjacency | 14 | Nav | Yes — presence penalties steered every job |
| Lay low | 20 | Overview button | Yes — core heat lever, used 3 times |
| Law Enforcement case ladder | 17 | Nav | Yes — read it weekly |
| Crew proposals + delegation (45%) | 18 | Appeared in Operations | Yes — became the *only* work at Crew Leader |
| Groove/repetition decay | ~13 | Odds dropped 84→64 | Yes — rotated districts; ignored it late and paid with heat 95 |
| Sokolov loan (Finances) | 78 | Finances panel offer | Yes — saved and poisoned the run |
| Attorney retainer (Intelligence) | 79 | Nav | Briefly — withdrew when I missed payment |
| Informant-accusation screen ("Decide it was them") | 79 | Intelligence | Read it, correctly never used it |
| Promotions, district runners | 102–116 | Memo + Territory slot | Yes — and built Sofia into a rival |
| Person detail: grievance ledger, cliques | 116 | Clicking a row | Yes — learned Sofia+Elena were a bloc |
| The City civic favors ("call it in") | 163 | Nav, after log hinted a captain owed me | Yes — cooled the City Police case; excellent |
| Succession (named heir) | 163 | Nav | Yes — and she left anyway, which was the better story |
| Selling a front | 175 | SELL UP button | Yes — the one recovery lever that worked |
| Career / Advice / Why panels | 301 | Nav | Read-only; the Why panel's rival-AI arithmetic is a remarkable trust artifact |

**Not used:**

- **The Trade (product/arms)** — *wanted to, was blocked.* Opened day 75; needs 2 fronts (met day 78) plus a $40,295 supplier retainer I never once approached. The game's own copy says it out-earns everything; my whole run may have been the failure mode of never reaching it.
- **Backroom Card Game** ($16–32K job) — *wanted to, was blocked*, painfully, twice: proposed on days 60 and ~102, and both times the $3,400 stake or the 4 free crew was beyond me. The single most frustrating near-miss of the run.
- **Sit-downs** (settle grievances, probe loyalty, mentor pairing) — *understood, judged not worth it*: 12 days with two people off the board when I had 4–6 workers total. I would have spent that capacity on jobs — and given the defection cascade, this was probably my biggest strategic error, which is a compliment to the design.
- **Turn/Plant somebody, "Get at what they have," lean on witnesses** — *understood, couldn't afford*: $20K–$150K price tags against a peak liquid worth of ~$31K (borrowed). Correctly priced for a bigger organization than I ever built.
- **The Armoury** (weapon assignment, disposal after bodies) — *saw it, understood it, never needed it*: I had one violent night in 301 days and no wars.
- **Wars / Diplomacy actions** — *never triggered*: 0 wars all run; rivals stayed "a name only" because I never shared ground. The whole rivals layer stayed dark to me — a run-shape finding, not a flaw I can score.
- **Business "lean" dials** (Clean/Usual/Lean) — *saw it, never worked out when to use it*; the banner explained the tradeoff but I never had enough dirty volume to need it.
- **Personal assets ("What is yours")** — *understood, judged not worth it* at 60 cents on the dollar; every dollar was needed liquid.
- **Mistress upkeep / Dr. Vance** — *saw, never spent*; the affair still detonated on its own, which taught me neglected systems keep simulating.
- **Saves panel** — *never opened.* Honest confession: I played 301 days ironman without noticing I hadn't.
- **Sandbox / Simulation modes, map TABLE view, ▶ WATCH** — never touched.

## Part 5 — The list

### 🔴 MUST FIX

1. **Proposal delegation buttons silently do nothing.** Repro A (day ~131): with Elena Cordova assigned as district runner, click "LET ELENA CORDOVA RUN IT (45% TO YOU)" on her Warehouse proposal — button is enabled, click lands, nothing happens: no launch, no log line, no refusal, proposal stays. Clicked twice, both dead. Same minute, same panel, "LET SHUN CHIU RUN IT" (free associate) worked instantly — so not my automation, not a stale reference (elements re-queried before every click). Repro B (day ~131): "LET SOFIA MERCURI RUN IT" (also a district runner) — same silent no-op. Repro C (day 187): Shun now *free*, "1 AVAILABLE," $2,344 on hand, and *both* his delegation buttons (truck, fence) silently no-op — so the working case is the exception, and whatever precondition fails is never surfaced. This is a control that takes a click and does nothing, with real money attached; whatever the rule is (runner status? stake? proposal staleness?), the button must either refuse with the reason or not render.
2. **The mid-game insolvency spiral offers no reachable exits on Normal.** Reproduced across two separate stretches (days ~60–78 and ~141–187, from different causes: a $6K memo spend, then mass custody): once liquid cash drops under ~$500 while wages exceed income, every memo option is unaffordable, all work needing stakes or crew is unreachable, and the only lever that generates cash (selling a front) is never hinted at anywhere. Each week compounds: unpaid → defection → fewer workers → less income. I ruled out ignorance of systems — during both stretches I had fronts operating, districts held, proposals arriving, and 100+ respect; there was simply no affordable action. Either Normal's floor needs one cheap recovery lever (small loan, front sale hint, one stake-free job at every rank), or the game intends this and should own it in the difficulty copy.

### 🟡 SHOULD FIX

1. **Decimal cents in laundering log lines** — "moved $6,227.713 through" (day ~91, three decimal places), "$4,184.56" (day ~116), "$2,094.88" (day ~141). Recurring; every other money figure in the game is a clean integer.
2. **Finances vs Businesses contradict each other on put-away money.** Finances: "Put away, not spendable… no job, no wage and no lawyer can touch it." Businesses: "3 WITHIN REACH — $12,020 TO SPEND" (exactly cash + put-away), and the purchase went through from $186 liquid. If fronts are deliberately buyable from put-away, one sentence in either panel would fix it; as shipped, one of the two screens is lying.
3. **The rank-up job transition is unannounced.** At Crew Leader the four street jobs vanish and WORK AVAILABLE renders as an empty table with headers; income silently becomes proposal-only. One line — the game's own "Somebody else's hands do that kind of thing now" moved into that empty table — would fix it.
4. **"Hear them out" resolves invisibly.** Twice ("Sofia 'Sandpaper' Ferraro wants a word" day 35; "Carmine Vitale wants a word" day 228) I chose it and found no outcome in the log, the person's page, or anywhere else I could locate. Could be my miss both times; even so, the outcome is too findable-not.
5. **Extortion memo, "Refuse" caption** reads as a consequence of paying: "Refuse — The neighbourhood watches you pay somebody off." Saw it identically on day 113 and day 268.
6. **Unexplained nav badges** — "Yourself 14," later "18"; Operations/Territory occasionally showed counts. 301 days and I never learned what they counted; they never seemed to clear on visiting.
7. **Jobs that qualify out of "Above your standing" can vanish entirely** (Protection Racket day ~14, Rent Out the Crew day 34) with no entry anywhere until a proposal happens to bring them — for days I assumed a bug. The proposal system is good; its takeover of a job just needs one visible line.
8. **Log names people who never materialize** — "Angelo Falcone turned up at the club asking who does the hiring" (twice, days ~20–28) but he never appeared in the recruit pool; several "X claims a connection to somebody you know. On the list either way" lines pointed at no list I could find.
9. *(Tooling, for the harness owner rather than the game)* — `__frontline.run()`'s promise never settles even though its steps execute; every scripted traverse falls back to manual DOM driving. Read() worked flawlessly throughout.

### 🟢 WORKED

1. **Failure is fully legible, and that is the game's masterpiece.** My run collapsed, and I can cite the log line for every gear that broke, in order, with names and dates. The Career panel then compressed it into seventeen chapters, including "Was not there for Nadia's being there." Losing felt authored *by me*, not to me.
2. **The itemized odds card.** "Base 80 · Crew −3 · Heat −8 · Being watched −10 · The district −4 · How you are doing it +5." Every modifier taught a system; the "They know the routine" line surfacing the groove decay is exactly how you make a hidden system fair.
3. **The memo economy prices feelings.** $20,000 to stop Rico talking, $6,000 for his family, $453 for a doctor for Nadia against $451 in my pocket. The game repeatedly made the emotional decision and the financial decision the same decision, which is the whole genre promise, kept.
4. **People are legible slowly and only through work** — "not yet" stats, the 100%-known page with grievance ledgers ("They were not paid, and remember the week"), cliques ("Would follow Sofia Mercuri anywhere"), and defections that cite tenure. Sofia's arc — ambitious, promoted twice, named heir, gone over back wages — was the best character writing in the run and none of it was scripted dialogue.
5. **Consequences echo on the game's own schedule, not mine**: the extortionist I refused came back a month later exactly as promised; the mistress I ignored surfaced as "The address across the river"; the indictment sits cold "until somebody who can take it further reads the file one day." The world visibly keeps its books.
6. **The writing**, everywhere, including refusals and warnings: "It does not read the room… move it before it wears a groove." "A man you are wrong about is a man you have lost, in front of everybody, for nothing — and you will not be told which one you did." Restraint held for 301 days.
7. **The Why panel** — publishing the rival AI's actual weighted decision arithmetic ("CONSOLIDATE 0.16 · DIPLOMACY 0.02…") is a radical trust move that makes the simulation claim credible even though my run never collided with the rivals directly.
