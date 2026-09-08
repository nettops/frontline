# Guns as a system — design

**Date:** 2026-08-30
**Status:** Approved (direction, early-game amendment, and build approved in session)

## Summary

The arms trade is already a system — crates, workshops, suppliers, strength,
war spend, seizure. The gap is not more trade. It is that **no act of violence
in the game asks what was carried**. `silence`, a mark landing, and killing a
suspected informant all file the same `source: 'violence'` trace at a fixed
strength.

This adds the missing question and nothing else. A piece has two facts: how
loud it is, and where it came from. The second one is the system.

## Why not the catalogue

The obvious build is the prototype sheet's 31 pieces as items with cost, heat
and odds columns. That is 31 rows of near-identical balance numbers, one of
which dominates each situation, and the choice collapses after the first
career. It adds a shop, not a decision.

The sheet's own note says what actually translates, and it is not rarity:

> the finishes here are the reference's trick pointed at something the game
> already has an opinion about. Not rarity — provenance.

So the roster of 31 ships as **name, picture and log copy**. None of it ships
as a balance row.

## The two facts

**Class** — `pocket`, `coat`, `long`. Up the scale: better odds the act goes
the way you wanted, and more heat. The same trade the operations table already
runs, pointed at one night.

**Provenance** — where the piece came from. Four doors, and each is available
at a different point in a career, which is what makes the system widen instead
of arriving whole:

| provenance | finish | how you get it | what it leaves |
| --- | --- | --- | --- |
| `house` | blued | you already had it, day one | an ordinary violence trace |
| `cold` | blacked | cash, per piece, dear | materially less than any other |
| `crate` | blued | one crate out of your own trade, several pieces | more — the serial is *yours*, and it names the workshop or the supplier |
| `given` | nickel | a friendly family hands you one | an ordinary trace, and the family that gave it now holds something |

## The mechanic after the act

A used piece is **dumped** or **kept**, and that is the decision the whole
thing exists for.

**Kept** is free, and the next body joins the last one. A piece with prior
bodies files a second trace that carries all of them — one thread tying two
nights together. This is the core, and it is what makes a free choice cost
something later.

**Dumped** is not free and not certain. It reuses `DISPOSAL` from
`config/scores.ts` verbatim in shape: a roll against control in the district,
and on a miss the piece turns up with a `source: 'disposal'` trace — the same
"did not go in the river" beat the score gear already has. Either way the piece
is off the shelf, which early in a career is the entire cost.

## The early game, which is where this was nearly wrong

**A boss never sends his people out unarmed.** So a piece is never something
you acquire before you can act, and the shelf is never empty. The stance is
`work_it_yourself`'s: the answer to "what is he carrying" is never nothing.

Day one the family owns what it owns — a handful of worn pocket pieces of a
provenance nobody chose. The system at that stage is a **readout, not a shop**:

1. **Early.** No crates, no cash, nobody selling to you. The only live lever is
   class. Provenance is a fact you read. The pressure is that you cannot afford
   to dump — four pieces and no money — so you keep, and the cases join. That
   is the early-game texture and it is what makes the first `cold` purchase
   feel like relief.
2. **Middle.** The street door opens with real cash. Provenance becomes a
   choice for the first time, and it costs, which is right: the middle game is
   when heat starts to bite.
3. **Late.** The trade runs, crates break out, pieces are nearly free — and
   every one walks back to your own workshop. `ARMS_SALE`'s double edge pointed
   at yourself.

`given` opens with diplomacy and therefore lands mid-to-late on its own. No
gate is needed anywhere.

**The house pieces teach the system with no tutorial.** A gun that has been in
a family for years has been out before, so some starting pieces already carry
somebody else's body, and the first silence can come back heavier than
expected. That must be legible rather than a trap: the shelf says *"been in the
family a long time"* — a reading with no number, the way `perceive()` works
everywhere else.

## Jobs stay untracked

Your people are armed on every operation. It is not recorded, because nothing
comes back from an ordinary shakedown. A piece earns a name and a history only
when it leaves a body behind. That is the honest reason and also the reason
there is no bookkeeping across hundreds of jobs.

## Architecture

- `src/config/armoury.ts` — the design. Classes, provenances, the roster of 31
  (name, class, kind, `leaves` copy) ported from `prototypes/pixel-arms.html`,
  and every tuned number with its reasoning.
- `src/sim/armoury.ts` — the shelf. Lazy initialiser seeding the house pieces
  off `Rng.stableNoise(state.rng.seed)`, so `SAVE_VERSION` stays at 13 and a
  save written before this loads as a family that always had its guns.
  `armFor()` picks what goes out; `usePiece()` files the traces and settles
  dump-or-keep.
- `src/ui/art/armsSprites.ts` — generated, row-for-row from the sheet.
- `src/ui/panels/ArmouryPanel.tsx` — the shelf, the two doors, the policy.

## The policy, not the prompt

The choice is a standing decision on the panel — what my people carry, and
whether they dump it — the stance `standingOrders.ts` and `delegation.ts`
already take. There is no new prompt at any act. A player who never opens the
Armoury, and the autopilot, both keep playing exactly as before on the default
(`pocket`, keep), which is also the correct early-game play.

## Rules that bind it

1. **Never a gate.** No act of violence can be blocked for want of a piece. The
   shelf refills from the house before it can empty.
2. **No real-world detail.** `contraband.ts` opens with that rule and the sheet
   repeats it. These are objects with a provenance. Nothing here says how
   anything is made, modified or concealed, and nothing may be added that does.
3. **Determinism.** House seeding uses `stableNoise`, never the seeded stream.
   Every roll that *is* random (the dump) goes through the passed `Rng`.
4. **Legible.** A piece's history shows as a reading, never a hidden number
   that punishes.

## Testing

Tests first, per the standing rule.

- an act of violence always finds a piece, on a fresh career, with an empty
  shelf, and on a save that predates the armoury — the never-a-gate test, and
  the most important one here
- class raises the odds and the heat together, never one alone
- `cold` leaves materially less than `house`; `crate` leaves more, and names
  the trade
- a kept piece used twice files a joining trace; used once it does not
- dumping takes it off the shelf whether or not the disposal held, and a missed
  disposal files `source: 'disposal'`
- the shelf never consumes the seeded stream when it is read
- the default policy never draws either — the claim is about the **stream**,
  not the outcome. Evidence and heat do change once this ships, because that is
  what shipping it means; what must not move is the sequence of draws, for the
  reason `addLog`'s header records at length

## Addendum, same day: two corrections the first screen found

Both are fiction, not balance, and both were invisible until the panel was on
screen with a real day-one shelf on it.

1. **The house blurb was wrong on three of the first four things a player
   sees.** It was the sheet's own line for `blued` — factory finish, a serial,
   a paper trail somebody else started — printed under a Razor, a Sap and a
   Tire iron. None of those has a serial. The copy is kind-neutral now:
   somebody else had it first.
2. **The two doors hand over firearms only** (`BOUGHT_BY_CLASS`). A man selling
   cold pieces out of a car is not selling you a claw hammer, and a crate out of
   an arms workshop does not break into razors. The family cupboard keeps the
   whole rack, because a cupboard is exactly where a sap ends up.

The panel also dropped the per-row provenance blurb. On a day-one shelf it was
the same sentence four times over, and the repetition pushed the one column
worth reading — the piece's own history — off the side of the panel.

## Addendum: the probe, and what it found

`ladder.probe`'s `what the family carries` arm, three populations of 36 careers
against the same bot carrying the shipped default.

**It found a hole before it could measure anything.** `armFor`'s refill handed
out clean guns for nothing, which made dumping strictly better — get rid of
everything, scrape up a fresh one, never tie two nights together, pay nothing.
What the family scrapes up has been out before now. Nothing is gated; the free
option is simply no longer the clean one.

**It found the first arm was not measuring anything.** `carries: 'long'`
reported +1 point of landing against a configured +10, and heat-weeks identical
to four figures, because a day-one shelf holds no long guns and the bot never
bought one. A boss who tells his people to carry rifles buys rifles. Same
defect as the bot that never delegated.

**The loud gun is quieter over a career**, which contradicts the argument
`config/pieces.ts` shipped with. 67% landed against 59%, and *fewer* heat-weeks
(2,283 against 2,420) — because a botched attempt leaves a man talking for
months and every week of that is billed. The per-night arithmetic was right and
the conclusion drawn from it was wrong. 19 of 36 careers ahead, p25 −$278,139,
so it stays a decision.

**Dumping pays only for a boss who kills constantly.** 23 of 36 ahead at
+$379,264 killing freely; 15 of 36 at −$119,909 killing sparingly. With three
killings in four years there is barely a chain to break, and the cold pieces
are paid for anyway. Doing both is 18 of 36 at +$2,063 — the two levers cancel.

Nothing was tuned off these readings, deliberately. Moving 23 of 36 to
something tidier is raising a threshold until an arm comes out the way it was
wanted.

## Out of scope (recorded)

- **Charges.** `EvidenceSource` is a five-way union every agency's `focus`
  reads. "Hands the case to somebody with their own investigators" is a
  law-system change, not an armoury one. The `charge` sprites stay drawn and
  unused.
- Pieces on ordinary operations — see "Jobs stay untracked".
- Pieces as war materiel; `ARMED` and `spendWarStock` already cover crates in a
  war and this does not touch them.
