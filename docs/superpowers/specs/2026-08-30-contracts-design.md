# Contracts — jobs that leave a body

**Date:** 2026-08-30
**Status:** Approved (three targets and all three forks decided in session)

## The gap

Nobody dies on a job. A blown operation injures or arrests
(`operations.ts:1100`); it never kills. There are five ways to die in the whole
game — you order a killing, a man who ran is found, you decide somebody is the
rat, a war clash, old age — and the ops table reaches none of them.

Meanwhile the rival cast is fully built and cannot be touched. `caposOf` gives
every family named capos with a district, a share of its strength, loyalty and
ambition. `approachCapo` lets you **buy** one. `replaceLeader` changes a
family's entire character when its boss goes, and today only old age fires it.

## Not new rows in the operations table

An operation is abstract and untargeted, and killing nobody-in-particular fails
the same bar the street scene had to pass: the drawn facts must be the
fictional facts. A contract points at somebody the player has been watching on
the Rivals panel for years.

## The shape: the other verb on the same man

`approachCapo` and a contract are opposites in every column, which is why this
needs almost no new machinery.

| | approach | contract |
| --- | --- | --- |
| costs | money | money, a piece, and crew who may not come back |
| takes | his district and his share | his share, and the family's appetite for the fight |
| leaves | a man who works for you | a body, and a family working out who did it |
| fails by | he says no and tells his boss | he lives, and now he knows |

## The hook that makes the guns pay

`attribute()` in `beliefs.ts` already takes a `care` argument — how quietly the
thing was done — and decides whether the victim blames you or somebody
plausible. Its own header says two families can go to war over something the
player did in a district neither was watching.

**Provenance is `care`.** A cold piece is a careful job.

| piece | care | what the family concludes |
| --- | --- | --- |
| `cold` | high | a real chance they wear it somewhere else |
| `house` / `given` | middling | usually you |
| `crate` | low | you, and the serial says so |

That is the payoff for $3,400 the probe said was missing, and `attribute` is
already wired to grudges, the `ruin` agenda and war declarations. No new
consequence code.

## Three targets

1. **A rival capo.** Removes a named man, his share of the family's strength,
   and his hold on his district. Reuses the removal `warCasualty` already does.
2. **A rival boss.** Fires `replaceLeader`: the family becomes someone else,
   loses strength in the handover, and everybody re-prices them. Harder, dearer
   and far more provocative.
3. **A witness on a live case.** `pressureWitness` already leans on one. This is
   what happens when leaning is not enough — and unlike `silence`, it is aimed
   at the case: it cuts case strength and takes the man off the suspect list.

## The three forks, as decided

**Peace or war only?** Peace. War is the consequence you are gambling on, not
the entry fee.

**Can your own crew die?** Yes, and this is the first job in the game that can
kill your own people. Without it a contract is a button. Higher on a failure
than on a success, because the men who got it wrong are the ones still standing
there.

**Is a boss hit gated?** No. Ungated and brutal, matching `silence.ts`: the game
prices the mistake, it does not prevent it. What stops you is the bill.

## Architecture

- `src/config/contract.ts` — every tuned number with its reasoning.
- `src/sim/contract.ts` — `canContract`, `openContract`, `tickContracts`.
  A contract is state with an `endDay`, ticked from `clock.ts` beside
  `tickMarks`, because deciding and doing are days apart and the waiting is
  most of what makes it frightening.
- `state.contracts?` — optional with a lazy initialiser, the `marks` /
  `possessions` idiom, so `SAVE_VERSION` stays at 13.
- UI on the Rivals panel beside the approach action, and on the Law panel
  beside `pressureWitness`.

## Rules that bind it

1. **It goes through `armFor` / `spent` like every other act with a body.** The
   class moves the odds and the heat; the provenance moves the trace *and* the
   attribution. A contract that ignored the armoury would make the armoury a
   decoration on three acts and a lie on a fourth.
2. **The player is never told what the family concluded.** `attribute` returns
   `mistaken` and `beliefs.ts` never renders it. You find out by watching what
   they do.
3. **Committed crew are committed.** They are unavailable for the duration, the
   same as an operation, so a contract competes with the work.
4. **Nothing is refunded.** The money buys the attempt.

## Testing

Tests first.

- a contract removes the man, his share, and his hold on the district
- a boss contract replaces the leader, and the family's character changes
- a witness contract cuts case strength and clears the suspect
- crew are committed for the duration and can die — both outcomes occur
- a cold piece is more often misattributed than a crate piece, over enough
  seeds — the whole reason provenance exists
- the piece is spent through `spent()`, so dump-or-keep and the join apply
- refused when there is nobody to send, and the money is not taken on a refusal
- the wiring test: a real career, a real tick, a real body

## Out of scope (recorded)

- Contracts against your own people. `silence` is that, it is measured, and a
  second door onto the same act would be two sets of numbers for one decision.
- Contracts as war materiel — `ARMED` and `spendWarStock` already cover crates
  in a war.
