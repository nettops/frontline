# Round 30 — blind playtest report, 2026-09-19

Run against local `main` at `fdc213a` (UI evolution, famine and repetition
mitigations, Walk-and-Talk tradecraft default — an unpushed commit from
another session, on top of `08eaf73`). Instance `mafia:run-round30`, port
5330. One tester, blind. The operator prompt named the Docket, jump bar, peek
and row accents, so findings on those four are primed rather than blind. The
tester reached Capo on day 96 and stopped at day 100, so there is no day-150
or day-300 reading. Report verbatim below; the developer verification pass is
in `director-log.md`.

---

# Frontline — Blind Playtest Report: Round 30
**Career, Normal, Italian. Carmine Cutrone. Day 1 to Day 100 (Tue 13 Jun 1978). Run completed to Capo. The game called me Capo on Day 96 (9 Jun 1978), so I stopped there and did not play on to Day 300.**

Enforcer came on Day 15 and Crew Leader on Day 27. Because the run ended at Capo, the "Day 150" checkpoint is replaced by Day 57.

### Part 1 — Where you got to
| Checkpoint | Day | Rank | Crew | Cash (spendable) | Districts | Fronts |
|---|---|---|---|---|---|---|
| 1 | 30 | Crew Leader | 7 (1 held) | $1.9K clean, $0 dirty | 1 (Little Sicily) | 2 |
| 2 (mid, replaces Day 150) | 57 | Crew Leader | 9 (2 held) | $8.5K clean, $0.4K dirty | 1 | 2 |
| Final (Capo since Day 96) | 100 | Capo | 11 (8 free, 2 held, 1 hurt) | $36K clean, $52K dirty (about $88K) | 2 (Little Sicily, The Docks) | 3 |

I earned $1–3K a day from small jobs, then hit a cash famine after the Crew Leader promotion. The product trade removed money as a problem, and the Docks plus a third front made me Capo. Record on the Overview at Day 100: 56 operations done, 25 failed.

### Part 2 — Scores
- **First hour: 7/10.** The opening week was clear and quick: jobs, hire, buy a front, promotion. Elena failed two shakedowns at a shown 83%. The Crew Leader promotion silently removed the job list I had been playing.
- **Clarity: 6/10.** The itemised odds and the refusal reasons are very good. Against that:
  - Several screens contradict each other (see Should Fix).
  - Pitches vanish without a trace.
  - Some disabled buttons explain themselves only in a hover tooltip.
- **Feedback: 8/10.** The result lines are specific. Payday shows the laundering loss. The peek digest says "3 jobs finished, 3 came off, up $1,346 on the day". Job failures explain why and who was hurt or taken.
- **Depth: 8/10.** People, clique, and ambition reads; sit-downs; negotiation; districts you can hand over; counsel; two trades; pressure from the other families. I found the people layer more interesting than the jobs.
- **Pacing: 5/10.**
  - Cash famine: from Day 27 to about Day 55, income fell from thousands a day to a few thousand a week.
  - Twice I was just short: $190 short of Lay Low, and $280 short of a $6,024 Warehouse Job.
  - After Day 55 the trade made money irrelevant. I held $88K with almost nothing to spend it on.
  - Memo repetition was mild but real. "Little Sicily has gone quiet on you" appeared word for word on Day 33 and Day 67. "Somebody else's hands do that kind of thing now" repeated in the log.
- **Difficulty: 4/10.** Failures and arrests hurt, but they never threatened the run. One trade route made me rich in two weeks.
- **Writing and tone: 9/10.** It never explains itself twice. Examples: "It was loud. It did not need to be loud." "Elena got there, turned straight round, and will not say why." The negotiation lines are excellent.
- **Interface and information design: 7/10.**
  - Docket: a strip that shows only the payroll countdown, and it toggles when clicked. It carries no risk information, so it is the weakest new piece.
  - Jump bar: the sticky chips ("ACTIVE / STREET WORK / STANDING") stay visible while scrolling and are useful.
  - Peek: it works, and the digest is the best content in the game. Visually it is muddy, because the memo ghost overlaps the digest text.
  - Row accents: the Organization table has portraits, status chips (AVAILABLE, HELD, HURT, DEFECTION RISK) and coloured pips. The Territory table has a red edge on the focused row. Both read well.
- **Standing in it: 7/10.** I felt like a Capo by Day 96, but the promotion arrived on a status line with no ceremony.
- **Fun: 7/10.** I was engaged until the trade opened. After that the weekly loop was "approve, advance".

### Part 3 — Eight Questions
1. **What did the game teach you?** Heat is the price of work. Failure means arrests. The product trade out-earns jobs by about ten times. Districts are the real gate. You only know people by working next to them.
2. **When did your decisions stop changing?** About Day 55, when the trade opened. After that I clicked through the weekly pitches. The exceptions were the memos and the people.
3. **Could you not afford to act, or had nobody to act with?**
   - Yes to both.
   - Day 22: Lay Low was $190 short.
   - Day 47: the Warehouse Job was $280 short, and I took a $500 Delacroix loan.
   - Day 86: "0 free" crew, and the trade line read "people are the ceiling".
4. **What were you still uncertain about at the end?**
   - Why the Docks flipped to "yours" on Day 95. The panel never told me what "held properly" means in numbers.
   - Whether the failure streaks match the shown odds.
   - What the arms trade costs later.
   - What "put away" money is for.
   - Why the Mercantile Trust is locked.
   - How defection risk works (Czeslaw carried the chip).
5. **Name somebody who worked for you.** Bernie Siegel, my Soldier, who ran Little Sicily. Also Irena Lewandowski, who wants my chair, and Elena Nardi.
6. **Did you do something you did not want to do, to keep it running?**
   - I put Little Sicily on the card ($350/wk). The street went quiet twice and I paid $6,000 to calm it.
   - I ran the product trade through my own home district.
   - I paid Moreau a $16,011 "courtesy".
   - I let Shun Cheung flip because the only working answer cost $30,000 and I had $23.7K.
7. **What would you have lost, at the point you stopped?** $88K, the freight-line route ($23.6K a week), Little Sicily and the Docks, three fronts, and Bernie's weekly turn-ins.
8. **Name something from at least twenty days earlier that was still changing how you played.**
   - The Financial Investigation. "Being watched −10%" sat on every job's odds from about Day 70 to the end.
   - Shun's defection on Day 81 put 9 of my people in that case.
   - Irena's ambition and the Sandro feuds (Sandro against Irena on Day 37, against Golda on Day 59) also carried forward.

### Part 4 — The Systems
**Used**
| System | Approx. day first used | How found | Did it change play? |
|---|---|---|---|
| Jobs, and the Quiet/Straight/Heavy approach | 1 | Operations | Yes. Quiet gave +5% odds and halved the heat. |
| Attribute points | 5 | Banner and Yourself | Small. The Muscle 6 unlock ("put a district on the card") was the only one I used. |
| Recruiting | 5 | Organization | Yes |
| Negotiating a front | 10 | Businesses | Yes. Prices moved by $300–$2,000. |
| Laundering and fronts | 10 | Businesses | Yes |
| Memos and family evenings | 5 | They arrived | Small |
| Sit-down conversation | 33 | Person page | Small, but the best writing |
| Weekly pitches | 27 | Operations, after promotion | Yes. Cost me the Warehouse Job twice. |
| Loan (Delacroix) | 47 | Finances | Yes. I took the $500 minimum. |
| Promotion of Bernie to Soldier | 53 | Person page | Yes. It unlocked handing him Little Sicily. |
| Lay Low | 57 | Overview | Yes. The trade kept earning while I was dark. |
| Product trade | 55 | Overview hint, then The Trade | Decisive |
| Handing a district to Bernie | 57 | Overview "wanting you" line | Yes. About $700–1,200 a week. |
| Counsel (serious firm, $993/wk) | 67 | Intelligence | Yes. Arrest holds shortened from "4 to 17 wks" to "3 to 11 wks". |
| Autopilot (Let It Run) | 76 | Operations | It launched a Warehouse Job at 44%. It also took every free crew and starved the trade. |
| Payoff to Moreau | 85 | Memo | Small. |
| Rivals panel (phone versus walk-in-the-woods) | 100 | Rivals | I read it only. "Walk in the woods" is the default (solid button) and "phone call" the ghost button. I sent nobody. |

**Not used**
- *Never knew it was there.* The Why panel (a log of the AI families' decisions) until Day 100. The poker table in The City until Day 86.
- *Saw it, couldn't work out what it did.* Succession naming. The Armoury. "Down there" (the flee fund). "Declared: Father's path / Holding company". The Mercantile Trust loan (no visible reason for the lock). Putting money away for standing.
- *Understood it, judged it not worth the money, time or risk.*
  - Arms trade: a $26K retainer for about $13K profit a week, and it arms my rivals.
  - A real lawyer for Shun ($20–30K).
  - A hit on a Moreau boss ($45K).
  - Prestige properties (Pie-O-My Stables and the like).
- *Wanted to, was blocked.*
  - First Warehouse Job: $280 short.
  - Lay Low: $190 short.
  - Third front: Little Sicily was full at 2/2 until I got a foothold in the Docks.
  - Hand-over of the Docks: no soldier, then no influence there.

### Part 5 — The List
**MUST FIX**
- **Pitches vanish silently.**
  - Repro A: Operations, "Brought to you", press APPROVE on pitch A. Do not launch. Press APPROVE on pitch B, or leave and come back. Pitch A is gone with no message. I lost a $30–70K Warehouse Job this way.
  - Repro B: on Day 86 there were three pitches and I could staff one. Pressing CANCEL on the next assemble screen left the list empty ("0 available").
  - Repro C: pressing CASE A JOB on the Warehouse pitch removed it from the list. Nothing appeared in In Motion, Active or the Overview. The only trace was a disabled tooltip on a different screen ("Somebody is already watching Warehouse Job in The Docks, 7 days to go").
- **The product trade dominates.**
  - A $5,000 retainer, then 2 loads at $1,911 each, returned $11,767 the next day.
  - A single route then paid about $23.6K a week, against $3–7K pitched jobs at 50–60% odds with arrests.
  - By Day 100 I held $88K with nothing worth buying.
  - The trade also keeps earning while Lay Low is on.
- **Cash famine between Crew Leader (Day 27) and the trade (Day 55).** There is no warning that the daily job table disappears. Combined with unaffordable answers ("Lay Low $190 short", "Warehouse $280 short"), a new player sits idle with a full crew.

**SHOULD FIX**
- **Failure runs look worse than the shown odds.**
  - Two shakedowns failed at a shown 83%.
  - Roughly 10 of about 15 pitched jobs failed at 50–75% shown.
  - I cannot prove this from one run. A per-roll log in Why would settle it.
- **Contradictory panels.**
  - The Overview says "NOBODY HAS A FILE OPEN ON YOU" while heat reads "Major investigation — resources are being spent".
  - The Yourself banner says points "lift your odds on every job you run". The panel says they are "not the odds on tonight's job".
- **Skill labels change for the same person between screens with no explanation.** Elena is "very good" on one job and "learning" on another. Sandro is "competent" then "learning".
- **The refusal reason for handing a district to Bernie is only a hover tooltip** ("You have nothing here to hand anybody"). The button is just dim on screen.
- **The Loan slider defaults to $20,000 for a player holding $2.5K.**
- **Raw float on the Overview:** "up to 3.9172573331756046u a week".
- **The Businesses list prints ten identical "Little Sicily only has room for 2 fronts" lines.** Show one line and hide the rest.
- **Peek overlay:** the memo ghost overlaps the digest text and is hard to read.
- **Autopilot** launched a $6,000 Warehouse Job at 44% without asking, and starved the trade of free people ("0u a week, people are the ceiling").
- **The Docket shows only payroll.** It gives no heat or case warning.
- **The Shun memo offers three answers**, and the only one that works is unaffordable at Capo level ($30K). The affordable one says outright that it will not hold.

**WORKED**
- The itemised odds panel (base, crew, street smarts, heat, being watched, district, approach) always added up. Refusals say what would lift them ("Needs 2 available crew (you have 1)"; "You have not got $4,000").
- The negotiation room: the price moves, each line has a reason, and "$368 over the odds" is shown.
- The People layer: "You barely know them 10%", a sit-down moving a read from 10% to 13%, "Would follow Irena anywhere", and feuds with a side to take.
- Failure and result prose, plus the one-line "wanting you" advice, which was true every time. "Put Bernie in charge" paid $700–1,200 a week.
- Lay Low states its price up front, and the trade continues while you are dark.
- The map, the district card ("a hand on it would be worth about $1,067 a week"), and the Capo requirements line on the Overview ("1 more district held properly, 1 more front").
- The Walk-in-the-woods versus Phone-call copy, and the peek digest.

(The tester's own closing "Next" list — decide on the pitch-loss behaviour,
decide on capping the trade, ask a blind round to check odds over a long run —
is dropped here; those are the developer's calls, not the tester's.)
