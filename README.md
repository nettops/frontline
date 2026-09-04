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
| `npm test` | The gate — 1,211 tests in about thirty seconds: determinism, invariants, a 365-day soak, AI behaviour, investigations, war and diplomacy, succession, the briefing, game modes, balance guards, faction beliefs and bonds, memory, failing fronts, the two trades, and a 24-world statistical harness with anomaly detection |
| `npm run probe` | The eight measuring files in `sim/probes/` — the ladder, the floor, the spread, and what a bot finds when it plays. Nine minutes, because they simulate thousands of careers to get their numbers |
| `npm run test:all` | Both |
| `npm run build` | Production build |
| `PROBE=1 npx vitest run balance` | Print the full balance report when tuning |
| `PROBE=1 npx vitest run statistics` | Print the distribution across 24 simulated cities |

---

## Documentation

The design record is not published. It is the project's private memory —
seventeen thousand lines of specs, measured findings, playtest rounds and the
rules an iteration runs under — and none of it is the engine or how to start.

What is here instead: this file for the shape of the game and how to run it,
`CLAUDE.md` for the invariants any change has to keep, and the source itself,
where every non-obvious number carries the reading that set it in a comment
beside it. Some of those comments cite a design note by filename; the note is
not in the repository, and the reasoning quoted in the comment is.

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
    probes/     The eight files that measure the game rather than test it.
                They build their evidence at module scope — thousands of
                simulated careers — so they are their own suite: `npm run probe`.
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

---

## Licence

MIT. Use it, change it, ship it, sell it — keep the copyright line and the
licence text with the source.

See [`LICENSE`](LICENSE).
