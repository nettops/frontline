# Round 11 playtest notes — Frontline (Career / Normal, "Cory Renna")

Instance http://localhost:56939, storage `mafia:run-round11:*`.

## Day 30 (Tue 4 Apr 1978)
- Rank: Enforcer (reached day 12)
- Crew: 6 of 6 (Toni Loscalzo, Nico Barone, Aldo Oduya, Nico Loscalzo, Mickey "Cufflinks" Moreno [hurt], Elena Bellandi)
- Cash: $1.3K clean / $8.3K dirty = ~$9.6K
- Districts: 1 held (Little Sicily, control, run by Nico Loscalzo). Named standing in Riverside (bought an introduction for $2,290).
- Fronts: 0. Cheapest is a Laundromat at $10,707 — the target.
- Respect 53, Fear 0, Heat 36 ("Investigating"). 0 open police cases.
- Ops: 23 done, 8 failed.

### What I have learned so far
- Loop: pick job -> pick approach (Quiet/Straight/Heavy) -> pick district -> pick crew -> Launch -> advance clock.
- Odds panel breaks the number down into base / crew / your ability / heat / district / approach. Best clarity in the game.
- Money is dirty by default; wages and job stakes come out of dirty first. Rank only counts clean + fronts + put-away.
- Heat is the dominant negative modifier on odds. At heat 36 my odds are ~10 points below where they were at heat 7.
- Crew you do not KNOW read as "not yet" and cost you odds. Skill estimates change as KNOWN% rises (Toni went "very good" -> "competent" at 47% known — the estimate got *worse*, which I liked).
- Failures cost the up-front stake and hurt people for ~16 days.

### Confusions so far
- Operations header "N AVAILABLE · $X ON HAND" — the N is free crew, not available jobs. Reads as jobs.
- Organization shows "ASSOCIATE · 55" — the number is age, but sits where a stat would.
- FEAR has never moved above 6 and I have no idea what it does. Killing an extortionist gave +8 respect and 0 fear.
- Taking an event recruit put me at "4 OF 3" crew — over my own cap, with no warning and no stated penalty.
- Nav "!" badges only explain themselves in a native `title` tooltip.
- "The district" penalty on odds got *worse* (-2% -> -8%) as my influence in Little Sicily grew to control. No explanation offered.

## Day 60 (Thu 4 May 1978)
- Rank: Crew Leader (reached day 37)
- Crew: 6 of 12 (Elena Bellandi arrested day 28, held 94 days)
- Cash: $1.3K clean / $375 dirty = ~$1.7K — nearly broke
- Districts: 2 (Little Sicily dominance, Riverside foothold)
- Fronts: 1 (Laundromat, Riverside, bought day 36 for $11,230)
- Respect 75, Fear 0, Heat 12 (down from 58)
- Ops 37 done / 17 failed

### The crisis, days 36-60
Heat ran to 58 ("Major Investigation"), City Police reached Surveillance and a
Task Force case opened. Odds fell to 57-68% and roughly a third of jobs were
failing, each failure feeding more heat and evidence. I hired a local attorney
and used "Lay low" for 14 days: cost $3,910 and 4 respect, heat 58 -> 12,
evidence "a little" -> "none". It worked but it emptied me. This was the first
point in the run where I had to do something I did not want to do.

### New findings
- The business gate. "Nobody in Little Sicily will sell to you right now" with no
  reason given anywhere. The real cause appears to be the district's Public
  Feeling, which my shakedowns had driven from 45 to 22 — but that number lives
  on the district panel and is never connected to the Businesses page. Working
  Riverside instead opened a slot there and the same Laundromat became buyable.
- Counsel pricing lies. Selecting "A local attorney" showed "$381 / WEEK IN
  LEGAL". Six weeks later the Law Enforcement page reads "Weekly legal bill
  $1,058" for the same tier. Nothing told me it had tripled.
- The odds line labelled "Current heat" does not track the Heat number in the top
  bar. Heat 0 -> +0%; heat 27 -> -8%; heat 11 (but two open cases) -> -13%.
- "Put away $1,629" appeared on the Yourself page though I never put anything away.
- Elena Bellandi was arrested and I only found out by opening Organization and
  seeing "HELD · 94D". The log had it, but nothing pushed it at me.

## Day 90/91 (Sun 4 Jun 1978)
- Rank: Crew Leader. Respect 143 (Capo needs 140 — met), crew 9/10, worth $51,380/$60,511, ops 54 done, districts 2/2 met.
- Cash: $3.7K clean / $0 dirty
- Districts: 2 (Little Sicily, Riverside). Fronts: 3 (Laundromat Riverside, Laundromat Little Sicily, Restaurant Little Sicily) — capacity $10,131/wk, clean income $1,676/wk.
- Heat 58 "Major Investigation". Two open cases: City Police at Search Warrants (substantial), Task Force at Financial Investigation (substantial, can reach Indictment).
- Ops: 54 done / ~35 failed.

Bought the Restaurant with everything I had and immediately could not make payroll
("PAYROLL IN 1 DAY: $2,717 DUE, $996 ON HAND. SHORT $1,721"). Fixed it by calling
off the two lowest-odds jobs, which refunded most of the stakes but added ~6 heat.

## Day 106 (Mon 19 Jun 1978)
- Laid low a second time, days 91-105. Cost ~$5,436, heat 58 -> 35. Came out of it
  with $608 to my name and no jobs running — worse off than when I went in.
- Took an unnamed party's $9,529 "no paperwork, creates a creditor" because I could
  not otherwise make payroll. First time in the run I did something I did not want to.
- Event "Riverside is closing to you" finally explained the public-feeling mechanic
  that had silently blocked me from buying a front in Little Sicily 40 days earlier.

### Further findings
- "Put away" money accrues on its own. I never used the "Put it away" control, yet the
  figure grows and counts toward rank. No log line ever mentions it.
- Sit-downs with your own people are a real 3-exchange dialogue ("the back room") with
  branching options that unlock from what you have already tried, and they move KNOWN%
  visibly (Mickey 48% -> 63%). Nothing in the interface tells you they exist. You have
  to click a crew row, then find the buttons under "SIT DOWN WITH THEM".
- Grammar bugs in generated text: "They has been the one you send", "what they have done
  as a Associate", "You now own laundromat in Little Sicily".
- Crew detail log double-logs every job: "Worked the Debt Collection. It went clean." and
  "Out on the Debt Collection. It went clean." on the same day, every time.

## Day 119 (Sun 2 Jul 1978) — CAPO
Reached Capo on day 119, the brief's stopping condition. Continuing past it.
- Rank: Capo (cap 22 crew). Respect 180, Fear 5, Heat 50.
- Crew 9. Cash $11K clean / $8.3K dirty.
- Districts 3 (Little Sicily, Riverside, Southport foothold). Fronts 3.

### Days 107-119
- Mickey "Cufflinks" Moreno arc paid off properly: sat down with him in the back
  room and reassured him, promoted him when he asked, backed him in a feud with
  Joey Mercuri — then caught him skimming $1,701, confronted him, and on day 112
  he walked: "Mickey Moreno is gone. No message, no meeting, and they knew a great
  deal." The Task Force had been talking to him since day 70. Best sequence in the run.
- Day 112 also: Task Force reached Search Warrants, "They came through the doors and
  took $3,784", and City Police took Aldo Oduya.
- Businesses page header read "YOU CAN COVER THE CHEAPEST" while every single Buy
  button on the page was disabled (district slots full / district will not sell).
- Kestler offered an understanding for $12,266. Declined politely — they are in a cold
  war with Vasari and neutral toward me, and I needed the money for rank.

## Day 150 (Wed 2 Aug 1978)
- Rank: Capo. Respect 220, Fear 5, Heat 38.
- Crew: 12, but 5 of them in custody (Toni Loscalzo 51d, Nico Barone 33d, Nico Loscalzo 33d, Paolo Delgato 47d, Rocco Falcone 44d) — the Task Force made arrests on day 133.
- Cash: $18K clean / $12K dirty. Districts 3. Fronts 3.
- INDICTED on day 147. Trial ~day 172. Upgraded to "The best money can buy" counsel ($5,863/wk).
- Named Maria Cutrone successor after promoting her to Soldier. The page said my previous
  successor "is not here any more" — he is in custody, not gone; the wording is wrong.

### Findings since day 130
- Laying low does NOT stop jobs already running, and one of them raised my heat to
  "Intensive Task Force" on day 132, four days into a lay-low I had paid $5,154 for.
  Nothing warned me that in-flight jobs keep generating attention while you are quiet.
- Joey Mercuri defected the same way Mickey did after I took the free "sit with them"
  option. Both free options read as real choices and both failed; the paid options were
  always priced just above what I could afford at that moment.
- The "Something tonight, or not at all" even-odds gamble has now fired five times
  (days 32, 49, 69, 130, 145). It is the most frequent event in the game and the least
  interesting decision in it.
- Trade tooltip leaks a raw float: "The retainer is $40,447 and you have $19,215.862."

## Day 200/201 (Fri 22 Sep 1978)
- Rank: Capo. Respect 239. Fear 0. Heat 13.
- Crew: 13 of 22 (Toni out of custody day 195, then hurt on day 197)
- Cash: $6.1K clean / $4.9K dirty. Put away $29,480. Fronts worth $45,378.
- Districts: 3 held, 4 worked. Fronts: 3 operating, $10,316/wk capacity.
- Ops: 83 done / 57 failed — a 41% failure rate.
- Toward Underboss: respect 252/320, crew 13/16, worth $92,017/$305,709.

### Findings
- The Yourself page shows two different figures for the same phrase, side by side:
  ADVANCEMENT says "What the family is worth $92,017 / $305,709" while the panel next
  to it says "In all $80,917". Nothing labels the difference. (Screenshotted.)
- "Put away" is now $29,480, my second largest asset, and I have never once used the
  "Put it away" button. No log line has ever mentioned it.
- The indictment memo on day 147 said the trial was "in 25 days". Day 201 and there has
  been no trial and no countdown anywhere in the interface. The Overview says the Task
  Force "can take it as far as Indictment", which contradicts the memo's jury trial.
- City Police case Dropped after I laid low; that felt earned and was clearly reported.
- Influence attribute is still 0/20 after 200 days. It gates the Intelligence contacts,
  the City Hall meeting, and the better inside men — an entire branch I could never open
  because nothing I did trained the attribute.

## Day 250 (Fri 10 Nov 1978) — near-death
- Rank: Capo. Respect 335. Heat 0. Crew 11 (down from 13).
- Cash: $719. Payroll due in 2 days: $6,319. Missed payroll on day 245.
- Districts 3 held / 4 worked. Fronts 5. Ops 94 done / 64 failed.

What happened: opened the product trade on day 220 for a $40,834 retainer and it
earned $73,745 in its first week — more than every job I had run in 220 days put
together, with no crew risk and no heat. On day 230 I spent the entire pile on two
more fronts. With no cash left I could not BUY trade loads, so the trade silently
went from $73,745/wk to $6,215/wk to $0. The Trade page has a panel headed "WHAT IS
STOPPING YOU" that lists streets and free people and does not mention money — the
one thing that was actually stopping me. I missed payroll on day 245, and Emilio
Kovac and Nico Barone both walked with "no message, no meeting, and they knew a
great deal".

Rescued it by selling the entire "Put away" holding for $17,986 (a 15% hurry price on
money I never deliberately put there). Two weeks later the trade moved 8 loads for
$50,399 — confirming that cash on hand was the hidden gate.

## Day 300/303 (Sat 30 Dec 1978 / Tue 2 Jan 1979) — END OF RUN
- Rank: Capo (since day 119). Respect 433. Fear 0. Heat 0.
- Crew: 8 of 22 (peak was 13). Weekly wages $1,667.
- Cash: $53K clean / $21K dirty. Put away $57,452. Fronts worth $221,579. Family worth $332,182.
- Districts: 3 held (Little Sicily, Riverside, Southport — all Dominance), 4 worked (The Docks foothold).
- Fronts: 5, $53,263/wk laundering capacity.
- Ops: 108 done / 67 failed (38% failure rate over the whole run).
- Toward Underboss: 4/5 met, blocked only on crew (13/16, counted as historic peak).

### End-state findings
- The Task Force INDICTMENT was silently Dropped. The day-147 memo promised a jury trial
  in 25 days. There was never a trial, never a verdict, never a countdown, and no memo when
  it ended. I found out by opening Law Enforcement and reading a CLOSED table.
- After 300 days two of the three rival families are still "A NAME ONLY", all three are
  Neutral toward me, and there has never been a war anywhere in the city. Rivals and
  Diplomacy were live navigation entries that never became anything.
- Advice page reads "5 OF 25 SAID" at day 303. All five fired in the first 42 days. Twenty
  written tips never triggered in a complete playthrough, and the same THE LAW tip has been
  pinned "ON SCREEN NOW" since day 42.
- The Papers on The City page had been quietly accumulating headlines all run
  ("Warrants executed at four addresses — YOU WERE NAMED", prominence 55). Nothing ever
  pointed me at it after the first tour.
- Business attribute is 1/20 after buying and running five fronts for 265 days. Influence
  is 2/20, which kept every Intelligence contact and the City Hall meeting locked all run.
- More same-label-different-number: Yourself shows STANDING "Influence 0" and, lower on the
  same page, "Influence 2/20". Advancement shows "Crew 13/16" while Overview shows "8 of 22".
