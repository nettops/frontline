# Fun, Depth and Pacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the day 60–150 stretch of a career a surplus it can grow from, content that opens on what you have done, and a recurring decision that marks the people who carry it.

**Architecture:** Four changes to existing systems plus one new leaf module. `sim/standing.ts` derives how much work each person has done from `state.operationHistory`, which already persists — so no new saved state and no `SAVE_VERSION` bump. Unlock conditions follow the `config/goals.ts` pattern: config declares a predicate over a flattened board summary and never imports the simulation. Everything else is edits to files that already exist.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest 2. No jsdom, no `@types/node`.

## Global Constraints

- **This project is not a git repository.** `git commit` will fail. Every task ends with `npx vitest run` and `npx tsc --noEmit` instead of a commit. If you want commits, run `git init` first and add commit steps back — that is a decision for the repo owner, not for this plan.
- **No jsdom.** UI changes cannot be unit tested. UI tasks end with a browser verification step against the dev server on `http://localhost:5173`, not a test.
- **Balance numbers live in `src/config/`, never in `src/sim/`.** §21/22.
- **`src/config/*.ts` must not import from `src/sim/` except for types.** Predicates read flattened summary interfaces — the `config/goals.ts` pattern.
- **`src/config/contraband.ts` header rule is absolute:** *"Nothing here describes how anything is made, moved or concealed in the real world, and nothing here should be added that does."* Unlock conditions are counts of jobs run, ground held and fronts owned. Nothing else.
- **New save fields are optional (`foo?: T`)** so `SAVE_VERSION` does not move. This plan should need none.
- **All new player-facing strings** — notes, memory text, UI copy — must pass `src/sim/__tests__/voice.test.ts`. Use they/them for anyone whose pronouns are not established.
- **Never write CRLF.** This is an LF codebase. Use the Edit and Write tools, not shell heredocs or `sed` in-place.
- **Probe pass conditions in Tasks 3, 12 and 13 were committed before the data existed.** Do not adjust a threshold to make a probe pass. If a probe fails, that is the finding.

---

### Task 1: The prompt to hand over a district reaches people who can

**Files:**
- Modify: `src/sim/delegation.ts` (add `needsSteward`)
- Modify: `src/ui/Rail.tsx:105-107` (`handOver`) and `:136-138` (the badge)
- Test: `src/sim/__tests__/delegation.test.ts`

**Interfaces:**
- Consumes: `eligibleStewards(state): Npc[]`, `territoryList(state): Territory[]`, `playerInfluence(t): number` — all existing.
- Produces: `needsSteward(state: GameState): boolean`

The bug: the badge condition is `held === 0 && handOver`. It shows the "hand a district over" prompt **only to players holding zero districts** — the only players with nothing to hand over. Taking your first district suppresses it permanently.

- [ ] **Step 1: Write the failing test**

Append to `src/sim/__tests__/delegation.test.ts`:

```ts
describe('needsSteward', () => {
  it('is true when you hold ground nobody is running and have somebody to run it', () => {
    const state = newGame({ name: 'Steward', difficulty: 'normal', seed: 4 });
    const t = territoryList(state)[0];
    setInfluence(state, t.id, 60);

    const hand = crewList(state)[0];
    hand.role = 'enforcer';
    hand.status = 'active';

    expect(needsSteward(state)).toBe(true);
  });

  it('stays true once you already hold a district — the case the rail used to suppress', () => {
    /*
       The whole bug in one assertion. The badge asked `held === 0`, so the
       moment a player took their first district the suggestion to delegate it
       disappeared, and delegation is the only income in the game that does not
       occupy a body. A playtester ran 179 days holding ground the entire time
       and never saw the prompt once.
    */
    const state = newGame({ name: 'Steward', difficulty: 'normal', seed: 5 });
    const [a, b] = territoryList(state);
    setInfluence(state, a.id, 80);
    setInfluence(state, b.id, 60);

    const first = crewList(state)[0];
    first.role = 'enforcer';
    const second = crewList(state)[1];
    second.role = 'enforcer';

    putInCharge(state, first.id, a.id);
    expect(needsSteward(state)).toBe(true);
  });

  it('is false when every district you hold is already run', () => {
    const state = newGame({ name: 'Steward', difficulty: 'normal', seed: 6 });
    const t = territoryList(state)[0];
    setInfluence(state, t.id, 60);

    const hand = crewList(state)[0];
    hand.role = 'enforcer';
    putInCharge(state, hand.id, t.id);

    expect(needsSteward(state)).toBe(false);
  });

  it('is false with nobody senior enough to hand it to', () => {
    const state = newGame({ name: 'Steward', difficulty: 'normal', seed: 7 });
    setInfluence(state, territoryList(state)[0].id, 60);
    for (const npc of crewList(state)) npc.role = 'associate';

    expect(needsSteward(state)).toBe(false);
  });
});
```

Add whatever of `newGame`, `territoryList`, `setInfluence`, `crewList`, `putInCharge`, `needsSteward` is not already imported at the top of that file. If `setInfluence` does not exist, use `addInfluence(state, t.id, 60)` from `src/sim/territory.ts` instead — check the module's exports before writing the import.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/sim/__tests__/delegation.test.ts
```

Expected: FAIL — `needsSteward is not exported by '../delegation'`.

- [ ] **Step 3: Add `needsSteward`**

In `src/sim/delegation.ts`, next to `eligibleStewards`:

```ts
/**
 * Whether there is ground standing idle that somebody could be running.
 *
 * Lives here rather than in the rail because it was wrong in the rail. The
 * badge asked `held === 0 && handOver`, which showed the suggestion to
 * delegate a district only to players holding no districts — the only players
 * with nothing to delegate. A playtester held ground for a hundred and
 * seventy-nine days and never saw it, and delegation is the one source of
 * income in this game that does not occupy a body you could otherwise send
 * out on a job, which makes it the only way an organization ever earns more
 * than it costs to keep.
 */
export function needsSteward(state: GameState): boolean {
  if (eligibleStewards(state).length === 0) return false;
  return territoryList(state).some(
    (t) => playerInfluence(t) > DELEGATION.promptAboveInfluence && !t.stewardId,
  );
}
```

Add to `DELEGATION` in `src/config/delegation.ts`, beside `minRoleIndex`:

```ts
  /**
   * How much of a district has to be yours before handing it over is worth
   * suggesting. Below this there is not enough there for a man to run.
   */
  promptAboveInfluence: 20,
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/sim/__tests__/delegation.test.ts
```

Expected: PASS, four tests.

- [ ] **Step 5: Point the rail at it**

In `src/ui/Rail.tsx`, delete the local `handOver` computation:

```tsx
  const handOver =
    eligibleStewards(state).length > 0 &&
    territoryList(state).some((t) => playerInfluence(t) > 20 && !t.stewardId);
```

and replace it with:

```tsx
  // See `needsSteward` — this used to be computed here and was wrong here.
  const handOver = needsSteward(state);
```

Then fix the badge itself. Replace:

```tsx
          {entry.id === 'territory' && held === 0 && handOver && (
            <span className="rail-badge" title="You hold ground nobody is running for you. Hand a district to somebody.">
              !
            </span>
          )}
```

with:

```tsx
          {entry.id === 'territory' && handOver && (
            <span
              className="rail-badge"
              title="You hold ground nobody is running for you. Hand a district to somebody."
            >
              !
            </span>
          )}
```

Update the imports at the top of `Rail.tsx`: add `needsSteward` from `../sim/delegation`, and remove `eligibleStewards`, `territoryList` and `playerInfluence` **only if nothing else in the file still uses them** — check first, `territoryList` is likely still used by the `held` count.

- [ ] **Step 6: Typecheck and run the whole suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no type errors; all tests pass.

- [ ] **Step 7: Verify in the browser**

Start the dev server if it is not running, load a career that holds at least one district with no steward, and confirm the Territory rail entry shows both the held-count badge and the `!`. Read it with:

```js
[...document.querySelectorAll('.rail-item')]
  .filter(b => b.innerText.trim().startsWith('Territory'))
  .map(b => [...b.querySelectorAll('.rail-badge, .rail-phase')].map(s => [s.textContent, s.title]))
```

Expected: an entry for the held count and an entry `["!", "You hold ground nobody is running for you. Hand a district to somebody."]`.

**Back up any real save before loading it, and restore it afterwards.** A career autosaves over the normal slot. This has cost two days of a saved game once already.

---

### Task 2: Say what a district is worth before you hand it over

**Files:**
- Modify: `src/sim/delegation.ts` (add `districtWorth`)
- Modify: `src/ui/panels/TerritoryPanel.tsx:585-617` (the un-stewarded branch of `Steward`)
- Test: `src/sim/__tests__/delegation.test.ts`

**Interfaces:**
- Consumes: `needsSteward` from Task 1 (not required, but the same module).
- Produces: `districtWorth(state: GameState, t: Territory): number` — expected gross per week, before whatever the man decides to do with it.

Today the appoint screen is a row of names. What a district earns is knowable — `weeklyWorth` computes it — but it is private to the module and rolled with an rng, so the player finds out by appointing somebody and waiting a month. The hire screen already states a wage against income; this is the same courtesy.

- [ ] **Step 1: Write the failing test**

```ts
describe('districtWorth', () => {
  it('is worth more where you are stronger', () => {
    const state = newGame({ name: 'Worth', difficulty: 'normal', seed: 11 });
    const t = territoryList(state)[0];

    addInfluence(state, t.id, 25);
    const weak = districtWorth(state, t);
    addInfluence(state, t.id, 60);
    const strong = districtWorth(state, t);

    expect(strong).toBeGreaterThan(weak);
  });

  it('is the middle of what a week actually pays, not a best case', () => {
    /*
       The quoted figure has to be the centre of the distribution the steward
       actually draws from, or the readout is an advertisement. `weeklyWorth`
       swings either side of this by DELEGATION.worthSwing.
    */
    const state = newGame({ name: 'Worth', difficulty: 'normal', seed: 12 });
    const t = territoryList(state)[0];
    addInfluence(state, t.id, 70);

    const quoted = districtWorth(state, t);
    expect(quoted).toBeGreaterThan(0);
    expect(quoted).toBeLessThan(DELEGATION.worthPerWeek * 2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/sim/__tests__/delegation.test.ts
```

Expected: FAIL — `districtWorth is not exported`.

- [ ] **Step 3: Extract the unrolled figure**

`weeklyWorth` in `src/sim/delegation.ts` currently computes the base and immediately applies the rng swing. Split it:

```ts
/**
 * What a district is worth in an average week, before the swing.
 *
 * Exported because the player is entitled to it before they hand somebody a
 * district rather than a month afterwards — the hiring screen already states
 * a wage against income, and appointing a steward is the larger commitment of
 * the two. It is the centre of the distribution, not a best case: what a man
 * actually brings in swings either side of this by `worthSwing`, which is the
 * honest variance a dishonest steward hides inside.
 */
export function districtWorth(state: GameState, t: Territory): number {
  const standing = playerInfluence(t) / 100;
  return Math.round(DELEGATION.worthPerWeek * standing * (t.prosperity / 100 + 0.5));
}

function weeklyWorth(state: GameState, t: Territory, rng: Rng): number {
  const base = districtWorth(state, t);
  return Math.round(base * rng.float(1 - DELEGATION.worthSwing, 1 + DELEGATION.worthSwing));
}
```

`districtWorth` keeps the `(state, t)` signature even though it does not read `state` today — the UI calls it that way, the tests call it that way, and prosperity and standing are exactly the sort of thing that later grows a world modifier. Mark the parameter used with a leading underscore if the linter objects, rather than changing the signature.

`weeklyWorth`'s existing call site passes `(t, rng)`. Update it to `(state, t, rng)` and update the call inside `tickDelegation` to match.

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/sim/__tests__/delegation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Put the number on the screen**

In `src/ui/panels/TerritoryPanel.tsx`, in the `Steward` function's un-stewarded branch, replace:

```tsx
          <p className="dim" style={{ marginTop: 0 }}>
            You run this one yourself, which means it only moves when you are looking at it.
          </p>
```

with:

```tsx
          {/*
             What it is worth, said before the decision rather than after it.

             A playtester never handed a district over across a hundred and
             seventy-nine days. Nothing on this screen said what one was worth,
             so putting a man on it read as taking a body off the job board for
             nothing — which is exactly backwards, since a steward is the only
             income in the game that does not occupy somebody.
          */}
          <p className="dim" style={{ marginTop: 0 }}>
            You run this one yourself, which means it only moves when you are looking at it.
            A hand on it would be worth about {formatMoney(districtWorth(state, territory))} a
            week, give or take, and would keep your name here while you are elsewhere.
          </p>
```

Add `districtWorth` to the existing `../../sim/delegation` import. `formatMoney` is already imported in this file.

- [ ] **Step 6: Typecheck and run the suite**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 7: Verify in the browser**

Open Territory, select a district you hold with no steward, and confirm the line reads with a figure in it. Back up and restore any real save.

---

### Task 3: Measure the surplus before touching a single payout

**Files:**
- Modify: `src/sim/__tests__/floor.probe.test.ts`

**Interfaces:**
- Consumes: the existing `play(seed, days)` runner in that file and its result object.
- Produces: two new fields on the result — `surplusByCrew: Map<number, number[]>` and `crewLeaderDay: number | null` — plus one new `it()` block.

This task exists so that Task 4 cannot be decided by feel. Raising payouts is the most direct lever on surplus and is also the change most likely to raise a playtest score while the game plays identically. The rule for what to do about it is committed in Task 4 and must not be edited after seeing this output.

- [ ] **Step 1: Record the surplus each week inside the existing runner**

In `play()`, beside the other accumulators (`stuckWeeks`, `peakFunds`, …), add:

```ts
  /*
     What the organization actually clears in a week, against how big it is.

     The point of bucketing by crew size is to separate two things that look
     the same from inside a career: an outfit that is poor, and an outfit that
     cannot get richer by growing. If surplus is flat across every crew size
     then the game has no economies of scale, and raising payouts lifts the
     whole line without changing its slope — the plateau moves and does not go
     away.
  */
  const surplusByCrew = new Map<number, number[]>();
  let crewLeaderDay: number | null = null;
  let fundsLastWeek = totalFunds(state);
```

Inside the existing `if (state.day % 7 === 0) {` block, before the stuck-week diagnosis:

```ts
      const now = totalFunds(state);
      const size = crewList(state).filter((n) => n.status !== 'dead').length;
      const bucket = surplusByCrew.get(size) ?? [];
      bucket.push(now - fundsLastWeek);
      surplusByCrew.set(size, bucket);
      fundsLastWeek = now;
```

And immediately after `advanceDay(state)`:

```ts
    if (crewLeaderDay === null && rankIndex(state.player.rank) >= rankIndex('crew_leader')) {
      crewLeaderDay = state.day;
    }
```

Add `surplusByCrew` and `crewLeaderDay` to **both** return objects — the `gameOver` early return and the final one. Missing the early return is how this probe would silently drop its shortest careers.

- [ ] **Step 2: Add the reporting test**

```ts
  it('reports whether the organization can grow its way to a surplus', () => {
    const sizes = new Map<number, number[]>();
    for (const run of RUNS) {
      for (const [size, weeks] of run.surplusByCrew) {
        sizes.set(size, [...(sizes.get(size) ?? []), ...weeks]);
      }
    }

    const rows = [...sizes.entries()]
      .filter(([, weeks]) => weeks.length >= 8)
      .sort((a, b) => a[0] - b[0])
      .map(([size, weeks]) => ({ size, weeks: weeks.length, median: median(weeks) }));

    const reached = RUNS.map((r) => r.crewLeaderDay).filter((d): d is number => d !== null);

    // eslint-disable-next-line no-console
    console.log(
      'surplus: ' +
        rows.map((r) => `${r.size} crew ${r.median >= 0 ? '+' : ''}${r.median}/wk (n=${r.weeks})`).join(', ') +
        ` — Crew Leader reached in ${reached.length}/${RUNS.length} worlds` +
        (reached.length ? `, median day ${median(reached)}` : ''),
    );

    /*
       The guard, not the finding.

       This asserts only that the instrument saw enough weeks at enough
       different crew sizes to say anything at all. What the numbers mean is
       decided by the rule written in the plan before they existed, and that
       rule is not allowed to move now that they do.
    */
    expect(rows.length, 'the probe never saw the crew change size').toBeGreaterThanOrEqual(3);
  });
```

- [ ] **Step 3: Run it**

```bash
npx vitest run src/sim/__tests__/floor.probe.test.ts
```

Expected: PASS, with a `surplus:` line printed. Read it.

- [ ] **Step 4: Write the numbers down**

Append the printed line verbatim to `docs/plans/2026-08-19-fun-depth-pacing.md` under a new heading `## Probe results`, with today's date. Task 4 reads it from there. Do not summarise it — paste it.

- [ ] **Step 5: Full suite**

```bash
npx tsc --noEmit && npx vitest run
```

---

### Task 4: Act on the surplus reading — one of three branches

**Files:**
- Modify (branch B only): `src/config/operations.ts` payouts, or `src/config/economy.ts` `ROLE_WAGE`
- Test: `src/sim/__tests__/floor.probe.test.ts` (re-run, do not re-thresholds)

**Interfaces:**
- Consumes: the `surplus:` line recorded in Task 3, Step 4.
- Produces: either no change, or adjusted early-tier numbers.

Read the recorded line and take exactly one branch. The rule was written before the data existed; do not negotiate with it.

**Branch A — median surplus is flat or negative at every crew size.**
Structural. Change nothing here. Delegation (Tasks 1 and 2) is the fix, and the `spread` probe in Task 13 plus a re-run of Task 3 after Tasks 1–2 land will show whether it took. Record in `## Probe results`: *"Branch A: surplus does not grow with size. Payouts untouched."*

**Branch B — median surplus is negative for crew sizes seen in weeks 1–8, positive later.**
The early game is underpaid. Raise the payouts of the four `minRank: 'street_criminal'` jobs, or cut `ROLE_WAGE.associate`, by the measured median shortfall — the actual figure from the probe line, not a round number. Change one of the two, not both, so the next run attributes the movement. Then:

```bash
npx vitest run src/sim/__tests__/floor.probe.test.ts src/sim/__tests__/balance.test.ts
```

Expected: the `surplus:` line's early-size medians move to at least zero, and `balance.test.ts` still passes. If `balance.test.ts` fails, the adjustment broke a relationship the table depends on — read its failure message, it names the invariant.

**Branch C — median surplus is positive at every size and Crew Leader is still reached in under half the worlds.**
Income is not the constraint and the diagnosis in the spec is wrong. Stop. Do not proceed to Task 5. Write what the probe showed into `## Probe results` and re-open the design — the spec's section 1 is refuted and sections 2–4 were scoped on the assumption that it was not.

Branches A and B can both apply: A across sizes, B within the first eight weeks. Then do B and record both.

- [ ] **Step 1: Read `## Probe results` and state which branch applies, in writing, before editing anything**
- [ ] **Step 2: Take that branch's action**
- [ ] **Step 3: Re-run the probe and paste the new line under `## Probe results`**
- [ ] **Step 4: `npx tsc --noEmit && npx vitest run`**

---

### Task 5: The board a config predicate can read

**Files:**
- Modify: `src/sim/types.ts` (add `OpsBoard`, extend `OperationDef`)
- Modify: `src/sim/operations.ts:86-95` (`availableOperations`, `lockedOperations`)
- Test: `src/sim/__tests__/operations.test.ts`

**Interfaces:**
- Produces:
  - `interface OpsBoard` — the flattened board, in `src/sim/types.ts`
  - `opsBoard(state: GameState): OpsBoard` — exported from `src/sim/operations.ts`
  - `OperationDef.opens?: { need: string; met: (b: OpsBoard) => boolean }`
  - `availableOperations(state)` and `lockedOperations(state)` keep their existing signatures and return types.

- [ ] **Step 1: Write the failing test**

Append to `src/sim/__tests__/operations.test.ts`:

```ts
describe('a second route to a job', () => {
  it('opens on rank as it always did', () => {
    const state = newGame({ name: 'Routes', difficulty: 'normal', seed: 21 });
    const open = availableOperations(state).map((o) => o.id);
    expect(open).toContain('corner_shakedown');
    expect(open).not.toContain('warehouse_job');
  });

  it('opens on what you have done, without the rank', () => {
    const state = newGame({ name: 'Routes', difficulty: 'normal', seed: 22 });
    const def = OPERATION_BY_ID.warehouse_job;
    const original = def.opens;
    def.opens = { need: 'two of anything', met: (b) => b.opsBy.corner_shakedown >= 2 };
    try {
      expect(availableOperations(state).map((o) => o.id)).not.toContain('warehouse_job');

      state.operationHistory.unshift(
        { defId: 'corner_shakedown', crewIds: [], day: 1 } as never,
        { defId: 'corner_shakedown', crewIds: [], day: 2 } as never,
      );

      expect(availableOperations(state).map((o) => o.id)).toContain('warehouse_job');
      expect(lockedOperations(state).map((o) => o.id)).not.toContain('warehouse_job');
    } finally {
      def.opens = original;
    }
  });

  it('counts jobs you have actually run, per job', () => {
    const state = newGame({ name: 'Routes', difficulty: 'normal', seed: 23 });
    state.operationHistory.unshift(
      { defId: 'boost_cars', crewIds: [], day: 3 } as never,
      { defId: 'boost_cars', crewIds: [], day: 4 } as never,
      { defId: 'corner_shakedown', crewIds: [], day: 5 } as never,
    );
    const board = opsBoard(state);
    expect(board.opsBy.boost_cars).toBe(2);
    expect(board.opsBy.corner_shakedown).toBe(1);
    expect(board.opsBy.warehouse_job ?? 0).toBe(0);
  });
});
```

Import `availableOperations`, `lockedOperations`, `opsBoard` from `../operations` and `OPERATION_BY_ID` from `../../config/operations` if they are not already imported in that file.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/sim/__tests__/operations.test.ts
```

Expected: FAIL — `opsBoard is not exported`.

- [ ] **Step 3: Add the type**

In `src/sim/types.ts`, above `OperationDef`:

```ts
/**
 * The board, flattened, so a job's unlock condition can be config.
 *
 * Same trick `config/goals.ts` and the world conditions use: config declares a
 * predicate over a small summary rather than over `GameState`, which keeps
 * `src/config` from importing `src/sim` and keeps the condition readable next
 * to the job it gates.
 */
export interface OpsBoard {
  /** `rankIndex` of the player's current rank. */
  rank: number;
  districtsHeld: number;
  fronts: number;
  crew: number;
  /** Times each job has been run, keyed by `OperationDef.id`. */
  opsBy: Record<string, number>;
  friendlyHouses: number;
}
```

Extend `OperationDef`, after `minRank`:

```ts
  /**
   * A second way in, for players who have done the work without holding the
   * rank.
   *
   * Rank is a cash threshold as much as anything, and a playtester spent the
   * back half of a hundred-and-seventy-nine-day run four-fifths of the way to
   * Crew Leader with every job behind it. `need` is what the locked row says;
   * `met` is what actually opens it. Absent, the job opens on rank alone,
   * exactly as before.
   */
  opens?: {
    need: string;
    met: (board: OpsBoard) => boolean;
  };
```

- [ ] **Step 4: Build the board and use it**

In `src/sim/operations.ts`, replace `availableOperations` and `lockedOperations`:

```ts
export function opsBoard(state: GameState): OpsBoard {
  const opsBy: Record<string, number> = {};
  for (const r of state.operationHistory) {
    opsBy[r.defId] = (opsBy[r.defId] ?? 0) + 1;
  }
  return {
    rank: rankIndex(state.player.rank),
    districtsHeld: controlledTerritories(state).length,
    fronts: ownedBusinesses(state).length,
    crew: crewList(state).filter((n) => n.status !== 'dead').length,
    opsBy,
    friendlyHouses: friendlyHouseCount(state),
  };
}

function isOpen(def: OperationDef, board: OpsBoard): boolean {
  return rankIndex(def.minRank) <= board.rank || (def.opens?.met(board) ?? false);
}

export function availableOperations(state: GameState): OperationDef[] {
  const board = opsBoard(state);
  return OPERATIONS.filter((op) => isOpen(op, board));
}

/** Jobs that exist but are still above the player — shown greyed out, as goals. */
export function lockedOperations(state: GameState): OperationDef[] {
  const board = opsBoard(state);
  return OPERATIONS.filter((op) => !isOpen(op, board));
}
```

`friendlyHouseCount` does not exist yet. Before writing it, grep `src/sim/diplomacy.ts` for the existing accessor that reports a house's disposition toward the player — there is one, `houses.ts` and `diplomacy.ts` both hold relationship state. Use it. If the cheapest correct expression is inline, inline it; do not add a module. If no such accessor exists, set `friendlyHouses: 0` and delete the field from `OpsBoard` — an unlock condition that reads a field nobody can compute is worse than one field fewer.

`controlledTerritories` and `ownedBusinesses` may create an import cycle — `operations.ts` is imported widely. If `npx tsc --noEmit` reports one, compute the two counts inline from `state.territories` and `state.businesses` rather than importing, and say so in a comment.

- [ ] **Step 5: Run the test**

```bash
npx vitest run src/sim/__tests__/operations.test.ts
```

Expected: PASS, three new tests.

- [ ] **Step 6: Full suite and typecheck**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: everything passes. No job has an `opens` yet, so behaviour is unchanged — that is the point of this task.

---

### Task 6: Seven unlock conditions

**Files:**
- Modify: `src/config/operations.ts` (six `crew_leader` entries)
- Modify: `src/config/contraband.ts` (the product trade)
- Modify: `src/sim/contraband.ts:92` (`canTrade` or equivalent rank check)
- Test: `src/sim/__tests__/operations.test.ts`, `src/sim/__tests__/contraband.test.ts`

**Interfaces:**
- Consumes: `OpsBoard`, `OperationDef.opens`, `opsBoard(state)` from Task 5.
- Produces: no new exports. `TradeDef` gains the same optional `opens` shape.

Conditions must be **specific**: each opens the job adjacent to how you were already playing, and opens none of the other six. Generic conditions ("hold two districts") open all seven at once and make rank cosmetic.

- [ ] **Step 1: Write the failing test**

```ts
describe('the seven behavioural routes', () => {
  const BEHAVIOURAL = OPERATIONS.filter((o) => o.opens);

  it('covers every crew_leader job', () => {
    const gated = OPERATIONS.filter((o) => o.minRank === 'crew_leader');
    expect(gated.length).toBe(6);
    expect(BEHAVIOURAL.map((o) => o.id).sort()).toEqual(gated.map((o) => o.id).sort());
  });

  it('says what it wants in words as well as in code', () => {
    for (const op of BEHAVIOURAL) {
      expect(op.opens!.need.length, `${op.id} has no readable condition`).toBeGreaterThan(10);
    }
  });

  it('does not open the whole tier at once', () => {
    /*
       The failure mode this test exists for: a condition generic enough to be
       satisfied by ordinary play opens all six the same week, which is the
       cash wall replaced by a slightly later cash wall. Each condition has to
       be specific enough that a board satisfying one leaves at least half the
       others shut.
    */
    for (const op of BEHAVIOURAL) {
      const board = boardSatisfying(op);
      const alsoOpen = BEHAVIOURAL.filter((o) => o.id !== op.id && o.opens!.met(board));
      expect(
        alsoOpen.length,
        `${op.id}'s condition also opens ${alsoOpen.map((o) => o.id).join(', ')}`,
      ).toBeLessThan(3);
    }
  });
});
```

`boardSatisfying(op)` is a helper you write in the test file: it returns the minimal `OpsBoard` that satisfies `op.opens.met`. Write it as a literal per job — a `Record<string, OpsBoard>` keyed by job id, hand-built to match each condition. Deriving it automatically would be a solver, and a solver in a test is a second implementation that can disagree with the first.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/sim/__tests__/operations.test.ts
```

Expected: FAIL — `expect(BEHAVIOURAL.map(...))` is empty.

- [ ] **Step 3: Write the six conditions**

The six `minRank: 'crew_leader'` entries are `backroom_game`, `counterfeit_run`, `warehouse_job`, `debt_collection`, `union_local` and `rent_the_crew`. The lower-tier ids they refer to are `work_it_yourself`, `corner_shakedown`, `boost_cars`, `burglary_run`, `protection_racket`, `fence_goods`, `truck_hijack` and `freelance_muscle`.

Add each `opens` block to its entry in `src/config/operations.ts`, directly under `minRank`:

```ts
  // backroom_game — a game needs a room, and people who know to come to it.
  opens: {
    need: 'a district of your own and four rackets run in it',
    met: (b) => b.districtsHeld >= 1 && (b.opsBy.protection_racket ?? 0) >= 4,
  },

  // counterfeit_run — fakes are worth nothing until you have somewhere they
  // can be sold as real, and somebody who has been moving goods knows where.
  opens: {
    need: 'five fencing jobs and a front to run them through',
    met: (b) => (b.opsBy.fence_goods ?? 0) >= 5 && b.fronts >= 1,
  },

  // warehouse_job — you learn where the loads go by taking the trucks first,
  // and a load you cannot store is a load you have to sell in a hurry.
  opens: {
    need: 'three truck jobs and somewhere to put the load',
    met: (b) => (b.opsBy.truck_hijack ?? 0) >= 3 && b.fronts >= 1,
  },

  // debt_collection — people come to you to collect once enough of them have
  // watched you do it for somebody else.
  opens: {
    need: 'six jobs hired out as muscle, and four people to send',
    met: (b) => (b.opsBy.freelance_muscle ?? 0) >= 6 && b.crew >= 4,
  },

  // union_local — a local is standing in a place, not a job you can walk into.
  opens: {
    need: 'two districts and three rackets run across them',
    met: (b) => b.districtsHeld >= 2 && (b.opsBy.protection_racket ?? 0) >= 3,
  },

  // rent_the_crew — nobody rents men they have not seen work.
  opens: {
    need: 'six on the payroll and four jobs hired out as muscle',
    met: (b) => b.crew >= 6 && (b.opsBy.freelance_muscle ?? 0) >= 4,
  },
```

These six were checked against each other by hand: the minimal board satisfying any one of them satisfies **none** of the other five. That is what the third test in Step 1 re-checks mechanically, and what stops this becoming the cash wall replaced by a slightly later cash wall.

The `boardSatisfying` map in the test is therefore:

```ts
const ZERO: OpsBoard = { rank: 0, districtsHeld: 0, fronts: 0, crew: 0, opsBy: {}, friendlyHouses: 0 };
const MINIMAL: Record<string, OpsBoard> = {
  backroom_game:   { ...ZERO, districtsHeld: 1, opsBy: { protection_racket: 4 } },
  counterfeit_run: { ...ZERO, fronts: 1, opsBy: { fence_goods: 5 } },
  warehouse_job:   { ...ZERO, fronts: 1, opsBy: { truck_hijack: 3 } },
  debt_collection: { ...ZERO, crew: 4, opsBy: { freelance_muscle: 6 } },
  union_local:     { ...ZERO, districtsHeld: 2, opsBy: { protection_racket: 3 } },
  rent_the_crew:   { ...ZERO, crew: 6, opsBy: { freelance_muscle: 4 } },
};
function boardSatisfying(op: OperationDef): OpsBoard {
  const board = MINIMAL[op.id];
  if (!board) throw new Error(`no minimal board written for ${op.id}`);
  return board;
}
```

The `throw` matters: it is what makes the test fail loudly rather than silently skip when somebody adds a seventh behavioural route and forgets to describe it here.

- [ ] **Step 4: Give the product trade the same treatment**

`src/config/contraband.ts` `TRADES.product` carries `minRank: 'crew_leader'`. Add the identical optional field to `TradeDef`:

```ts
  /** A second way in — see `OperationDef.opens`. Same shape, same reasoning. */
  opens?: {
    need: string;
    met: (board: OpsBoard) => boolean;
  };
```

and a condition on `product`. **The header rule binds absolutely here:** the condition may read only counts of jobs run, ground held and fronts owned. Nothing about what is traded, how, or through where.

Then in `src/sim/contraband.ts:92`, change:

```ts
  return rankIndex(state.player.rank) >= rankIndex(TRADES[trade].minRank);
```

to also accept the behavioural route, using `opsBoard(state)` from `src/sim/operations.ts`. If that import cycles, move `opsBoard` into its own leaf module `src/sim/board.ts` and have both `operations.ts` and `contraband.ts` import it from there — that is the cheaper fix than duplicating the board.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/sim/__tests__/operations.test.ts src/sim/__tests__/contraband.test.ts
```

Expected: PASS.

- [ ] **Step 6: Full suite and typecheck**

```bash
npx tsc --noEmit && npx vitest run
```

Watch `grok.probe.test.ts` in particular — it asserts the last new kind of move arrives after week 4, and this task should push that number **later**, not earlier. If it moves earlier, a condition is too soft.

---

### Task 7: Locked rows say which route is nearer

**Files:**
- Modify: `src/ui/panels/OperationsPanel.tsx` (the locked-jobs table)

**Interfaces:**
- Consumes: `OperationDef.opens.need` from Task 5, `lockedOperations(state)` unchanged.

- [ ] **Step 1: Find the locked table**

In `src/ui/panels/OperationsPanel.tsx`, locate where `locked` (from `lockedOperations(state)`) is rendered and what each row currently states as its requirement — it names the rank today.

- [ ] **Step 2: State both routes**

Replace the rank-only cell with both, when a second route exists:

```tsx
{/*
   Two routes, both stated, because a goal you cannot see is not a goal.

   The rank line on its own sent a playtester after a clean-money threshold
   they were sixty days from meeting while a second route sat three truck
   jobs away, unmentioned.
*/}
<td className="dim">
  {def.opens
    ? `${RANK_BY_ID[def.minRank].name}, or ${def.opens.need.toLowerCase()}`
    : RANK_BY_ID[def.minRank].name}
</td>
```

Use whatever the file already imports for rank names — check the existing import rather than adding `RANK_BY_ID` if something else is in use.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 4: Verify in the browser**

Open Operations on a low-rank career and read the locked table:

```js
[...document.querySelectorAll('table')]
  .filter(t => /locked|still above|goal/i.test(t.previousElementSibling?.innerText || ''))
  .map(t => t.innerText)
```

If that selector finds nothing, read the whole panel text and locate the locked section by eye. Expected: at least one row reading `Crew Leader, or …`. Back up and restore any real save.

---

### Task 8: `sim/standing.ts` — how much work each person has done

**Files:**
- Create: `src/sim/standing.ts`
- Create: `src/config/standing.ts`
- Test: `src/sim/__tests__/standing.test.ts`

**Interfaces:**
- Consumes: `state.operationHistory` (`OperationResult[]`, `crewIds: Id[]`, `day: number`), `crewList(state)`.
- Produces:
  - `nightsWorked(state: GameState, npcId: Id): number`
  - `share(state: GameState, npcId: Id): number` — his nights divided by the crew average; 1 means exactly average, 0 when the crew has worked and he has not
  - `crewWasBusy(state: GameState): boolean` — whether the crew ran anything in the window at all
  - `STANDING` in `src/config/standing.ts`

No new saved state. `state.operationHistory` is capped at 200 entries in `src/sim/operations.ts` — fifty-plus weeks at a normal rate, and already the window `informants` reads across 180 days.

- [ ] **Step 1: Write the failing test**

Create `src/sim/__tests__/standing.test.ts`:

```ts
/**
 * Who has been carrying it.
 *
 * Derived from the job history rather than counted into a field, because the
 * history is already saved, already capped, and already the thing the
 * informant deduction reads. A counter would be a second copy of the same
 * fact that could disagree with it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { crewList } from '../npc';
import { nightsWorked, share, crewWasBusy } from '../standing';
import { STANDING } from '../../config/standing';
import type { GameState, Id } from '../types';

function ran(state: GameState, day: number, crewIds: Id[]): void {
  state.operationHistory.unshift({ defId: 'corner_shakedown', day, crewIds } as never);
}

describe('nights worked', () => {
  it('counts only the jobs inside the window', () => {
    const state = newGame({ name: 'Nights', difficulty: 'normal', seed: 31 });
    const [a] = crewList(state);
    state.day = 100;

    ran(state, 100 - STANDING.windowDays + 1, [a.id]);
    ran(state, 100 - STANDING.windowDays - 1, [a.id]);

    expect(nightsWorked(state, a.id)).toBe(1);
  });

  it('is zero for somebody who has not been out', () => {
    const state = newGame({ name: 'Nights', difficulty: 'normal', seed: 32 });
    const [a, b] = crewList(state);
    state.day = 60;
    ran(state, 58, [a.id]);

    expect(nightsWorked(state, b.id)).toBe(0);
  });
});

describe('share', () => {
  it('is one when everybody works the same amount', () => {
    const state = newGame({ name: 'Share', difficulty: 'normal', seed: 33 });
    const [a, b] = crewList(state);
    state.day = 60;
    ran(state, 55, [a.id, b.id]);
    ran(state, 56, [a.id, b.id]);

    expect(share(state, a.id)).toBeCloseTo(share(state, b.id), 5);
  });

  it('is above one for the man who gets sent and below for the man who does not', () => {
    const state = newGame({ name: 'Share', difficulty: 'normal', seed: 34 });
    const [a, b] = crewList(state);
    state.day = 60;
    for (let d = 50; d < 58; d++) ran(state, d, [a.id]);

    expect(share(state, a.id)).toBeGreaterThan(1);
    expect(share(state, b.id)).toBeLessThan(1);
  });

  it('is one for everybody when nothing has happened, rather than dividing by zero', () => {
    /*
       The whole crew idle is the state a new career starts in, and a NaN here
       would propagate silently into a loyalty drift and be very hard to find.
    */
    const state = newGame({ name: 'Share', difficulty: 'normal', seed: 35 });
    for (const npc of crewList(state)) {
      expect(Number.isFinite(share(state, npc.id))).toBe(true);
      expect(share(state, npc.id)).toBe(1);
    }
    expect(crewWasBusy(state)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/sim/__tests__/standing.test.ts
```

Expected: FAIL — cannot resolve `../standing`.

- [ ] **Step 3: Write the config**

Create `src/config/standing.ts`:

```ts
/**
 * What carrying the work does to somebody, and what being left out of it does.
 *
 * Every number here is set by the `spread` probe rather than by feel — see
 * `src/sim/__tests__/spread.probe.test.ts`. The probe's whole job is to show
 * whether a boss who always sends their best three ends up somewhere
 * different from one who rotates. If it does not, these numbers are wrong and
 * no amount of adjusting the prose above them will help.
 */
export const STANDING = {
  /** How far back "lately" reaches. Eight weeks. */
  windowDays: 56,
  /** Above this share of the crew average, a man knows he is load-bearing. */
  carryAbove: 1.6,
  /** Below this share, a man knows he is not being used. */
  benchBelow: 0.4,
  /** Days in the crew before the bench mark can apply — a new hire is not being snubbed. */
  settledAfterDays: 21,
  /** What carrying it does. He is not more loyal for it; that is the point. */
  carry: {
    ambition: 1.5,
    /** Read through `wageExpectation` in npc.ts — raising greed raises his price. */
    greed: 1.2,
  },
  /** What being left out does. */
  bench: {
    loyalty: -2,
    grievance: 3,
  },
} as const;
```

- [ ] **Step 4: Write the module**

Create `src/sim/standing.ts`:

```ts
/**
 * Who has been carrying it.
 *
 * A leaf module, the same shape as `memory.ts`: it reads the job history and
 * the crew list and imports nothing that imports it back.
 *
 * The recurring decision in this game was "which two or three jobs can I
 * afford, and who is free" — a hundred and seventy-nine days of it, in a
 * playtest where the tester put the moment their decisions stopped changing at
 * day sixty. What was missing was any consequence to *who* went. This is the
 * measurement that gives the choice one: not a new screen, a fact about the
 * jobs you have already been running.
 *
 * Derived rather than counted. `state.operationHistory` already holds every
 * job with the men who were on it, already persists, and is already capped at
 * two hundred entries — fifty-odd weeks. A per-person counter would be a
 * second copy of the same fact, and second copies drift.
 */

import { STANDING } from '../config/standing';
import { crewList } from './npc';
import type { GameState, Id } from './types';

function inWindow(state: GameState) {
  return state.operationHistory.filter((r) => state.day - r.day <= STANDING.windowDays);
}

/** Jobs he has been out on in the last `windowDays`. */
export function nightsWorked(state: GameState, npcId: Id): number {
  return inWindow(state).filter((r) => r.crewIds.includes(npcId)).length;
}

/** Whether anybody has been out at all lately. */
export function crewWasBusy(state: GameState): boolean {
  return inWindow(state).some((r) => r.crewIds.length > 0);
}

/**
 * His nights against the crew average. One is exactly average.
 *
 * Returns 1 rather than 0 or NaN when nothing has happened. A quiet fortnight
 * is not the same as being passed over, and the difference matters because the
 * bench mark below reads this number to decide whether somebody has been
 * snubbed.
 */
export function share(state: GameState, npcId: Id): number {
  const crew = crewList(state).filter((n) => n.status === 'active' || n.status === 'busy');
  if (crew.length === 0) return 1;

  const total = crew.reduce((sum, n) => sum + nightsWorked(state, n.id), 0);
  if (total === 0) return 1;

  return nightsWorked(state, npcId) / (total / crew.length);
}
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run src/sim/__tests__/standing.test.ts
```

Expected: PASS, six tests.

- [ ] **Step 6: Full suite and typecheck**

```bash
npx tsc --noEmit && npx vitest run
```

---

### Task 9: The two marks

**Files:**
- Modify: `src/config/memories.ts` (two new `MemoryKind`s and their `MemoryDef`s)
- Modify: `src/sim/standing.ts` (add `markStanding`)
- Modify: `src/sim/clock.ts` (call it at step 5c)
- Test: `src/sim/__tests__/standing.test.ts`

**Interfaces:**
- Consumes: `share`, `crewWasBusy`, `nightsWorked` from Task 8; `remember(npc, day, kind, about, scale)` from `src/sim/memory.ts`; `addNote(npc, day, text, kind)` from `src/sim/npc.ts`.
- Produces: `markStanding(state: GameState): void` — idempotent within a day, called weekly.

Both marks are carried by memories, which are already read by sit-down reasons, defection, `claimFrom` and goals. That is why this task writes no new consumers.

- [ ] **Step 1: Write the failing test**

Append to `src/sim/__tests__/standing.test.ts`:

```ts
describe('marking who carried it', () => {
  it('marks the man who has been out far more than the rest', () => {
    const state = newGame({ name: 'Mark', difficulty: 'normal', seed: 41 });
    const [a, b, c] = crewList(state);
    state.day = 56;
    for (const npc of [a, b, c]) npc.daysInCrew = 56;
    for (let d = 20; d < 40; d++) ran(state, d, [a.id]);
    ran(state, 30, [b.id]);

    const ambitionBefore = a.stats.ambition;
    markStanding(state);

    expect(a.memories.some((m) => m.kind === 'carried_the_work')).toBe(true);
    expect(a.stats.ambition).toBeGreaterThan(ambitionBefore);
  });

  it('does not make him more loyal for it', () => {
    /*
       The sting, asserted. A man who does all the work knows he is
       load-bearing; that makes him expensive and dangerous, not devoted. If
       this ever starts raising loyalty the mechanic has become a reward and
       the decision it was built to create is gone.
    */
    const state = newGame({ name: 'Mark', difficulty: 'normal', seed: 42 });
    const [a, b] = crewList(state);
    state.day = 56;
    a.daysInCrew = 56;
    b.daysInCrew = 56;
    for (let d = 20; d < 40; d++) ran(state, d, [a.id]);

    const before = a.stats.loyalty;
    markStanding(state);
    expect(a.stats.loyalty).toBeLessThanOrEqual(before);
  });

  it('marks the man nobody sends, while the rest are working', () => {
    const state = newGame({ name: 'Bench', difficulty: 'normal', seed: 43 });
    const [a, b] = crewList(state);
    state.day = 56;
    a.daysInCrew = 56;
    b.daysInCrew = 56;
    for (let d = 20; d < 40; d++) ran(state, d, [a.id]);

    const loyaltyBefore = b.stats.loyalty;
    markStanding(state);

    expect(b.memories.some((m) => m.kind === 'left_on_the_bench')).toBe(true);
    expect(b.stats.loyalty).toBeLessThan(loyaltyBefore);
  });

  it('does not mark a bench when nobody has been working', () => {
    const state = newGame({ name: 'Bench', difficulty: 'normal', seed: 44 });
    for (const npc of crewList(state)) npc.daysInCrew = 56;
    state.day = 56;

    markStanding(state);
    expect(crewList(state).some((n) => n.memories.some((m) => m.kind === 'left_on_the_bench')))
      .toBe(false);
  });

  it('does not mark a man who is hurt, inside, or newly hired', () => {
    /*
       Three guards on one mark, because the bench penalty is the part of this
       most likely to punish a player for something correct. Holding a reserve
       is legitimate and the arrest and injury systems make it necessary; a man
       in a cell is not being snubbed; and somebody hired on Tuesday has not
       been passed over by Friday.
    */
    const state = newGame({ name: 'Bench', difficulty: 'normal', seed: 45 });
    const [worker, hurt, inside, fresh] = crewList(state);
    state.day = 56;
    worker.daysInCrew = 56;
    for (let d = 20; d < 40; d++) ran(state, d, [worker.id]);

    hurt.status = 'injured';
    hurt.daysInCrew = 56;
    inside.status = 'arrested';
    inside.daysInCrew = 56;
    fresh.status = 'active';
    fresh.daysInCrew = STANDING.settledAfterDays - 1;

    markStanding(state);

    for (const npc of [hurt, inside, fresh]) {
      expect(
        npc.memories.some((m) => m.kind === 'left_on_the_bench'),
        `${npc.name} was marked and should not have been`,
      ).toBe(false);
    }
  });
});
```

Add `markStanding` to the `../standing` import and `STANDING` to the config import.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/sim/__tests__/standing.test.ts
```

Expected: FAIL — `markStanding is not exported`.

- [ ] **Step 3: Add the two memory kinds**

In `src/config/memories.ts`, extend the `MemoryKind` union with `'carried_the_work'` and `'left_on_the_bench'`, then add to `MEMORIES`:

```ts
  carried_the_work: {
    kind: 'carried_the_work',
    text: 'has been the one you send, and knows it',
    tone: 'good',
    weight: 45,
    fadePerYear: 15,
    floor: 6,
  },
  left_on_the_bench: {
    kind: 'left_on_the_bench',
    text: 'watched the work go to other people',
    tone: 'bad',
    weight: 35,
    fadePerYear: 16,
    floor: 5,
  },
```

`tone: 'good'` on `carried_the_work` is deliberate and is not the same as loyalty: from his point of view being the one who gets sent is recognition. What it does to him — ambition, price, claim — is in `STANDING.carry`.

- [ ] **Step 4: Write the marker**

Append to `src/sim/standing.ts`:

```ts
/**
 * The weekly read of who has been carrying it.
 *
 * Runs before `driftNpcs`, on the same principle as `tickPromises`: a man
 * marked this morning should be aggrieved when the drift asks him how he feels
 * about you this afternoon.
 */
export function markStanding(state: GameState): void {
  const busy = crewWasBusy(state);

  for (const npc of crewList(state)) {
    if (npc.status !== 'active' && npc.status !== 'busy') continue;
    if (npc.daysInCrew < STANDING.settledAfterDays) continue;

    const s = share(state, npc.id);

    if (s >= STANDING.carryAbove) {
      npc.stats.ambition = clamp(npc.stats.ambition + STANDING.carry.ambition, 0, 100);
      npc.wageDrift = (npc.wageDrift ?? 0) + STANDING.carry.wageExpectation;
      remember(npc, state.day, 'carried_the_work');
      addNote(npc, state.day, 'Has been out more than anybody else.', 'neutral');
      continue;
    }

    if (busy && s <= STANDING.benchBelow) {
      npc.stats.loyalty = clamp(npc.stats.loyalty + STANDING.bench.loyalty, 0, 100);
      npc.stats.grievance = clamp(npc.stats.grievance + STANDING.bench.grievance, 0, 100);
      remember(npc, state.day, 'left_on_the_bench');
      addNote(npc, state.day, 'Has not been out while the others have.', 'bad');
    }
  }
}
```

`npc.wageDrift` does not exist and is not being added. Use greed:

```ts
      npc.stats.greed = clamp(npc.stats.greed + STANDING.carry.greed, 0, 100);
```

`wageExpectation` in `src/sim/npc.ts` already reads `npc.stats.greed` through `DRIFT.wageExpectationFromGreed`, so raising greed *is* raising his price, through the path that already exists. No new field, no `SAVE_VERSION` question, and it reads correctly in the fiction: the man who does all the work does not develop a new abstract "wage drift", he starts wanting more money.

Change the config in Step 3 of this task to match — `STANDING.carry` is:

```ts
  /** What carrying it does. He is not more loyal for it; that is the point. */
  carry: {
    ambition: 1.5,
    greed: 1.2,
  },
```

Delete `wageExpectation` from `STANDING.carry`; nothing reads it.

Add the imports `clamp` from `./rng`, `remember` from `./memory`, `addNote` from `./npc`.

- [ ] **Step 5: Run the test**

```bash
npx vitest run src/sim/__tests__/standing.test.ts
```

Expected: PASS, eleven tests total in the file.

- [ ] **Step 6: Wire it into the clock**

In `src/sim/clock.ts`, immediately before the `driftNpcs` call at step 6:

```ts
  // 5c. Who has been carrying the work, and who has been watching it happen.
  //     Before the weekly drift for the same reason `tickPromises` is: a man
  //     marked this morning should be aggrieved when the drift asks him how he
  //     feels about you this afternoon.
  if (state.day % DRIFT_INTERVAL_DAYS === 0) markStanding(state);
  // 6. The weekly re-evaluation of everybody's position.
  if (state.day % DRIFT_INTERVAL_DAYS === 0) driftNpcs(state, rng);
```

Import `markStanding` from `./standing`.

- [ ] **Step 7: Full suite and typecheck**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all pass. `soak.test.ts` is the one to watch — it runs 365 days and asserts no NaN and no orphaned references.

---

### Task 10: A job that goes clean marks the people who ran it

**Files:**
- Modify: `src/sim/operations.ts` (the resolution path, near `gainFamiliarity` at ~line 352)
- Test: `src/sim/__tests__/operations.test.ts`

**Interfaces:**
- Consumes: `addNote` from `src/sim/npc.ts`.
- Produces: no new exports.

Today only the hurt and the arrested get a note. A job that goes clean marks nobody, so the visible record the player is meant to reason from does not record the ordinary case — which is nearly every case.

- [ ] **Step 1: Write the failing test**

```ts
describe('the record of a job', () => {
  it('writes a note for everybody who was on it, not only the casualties', () => {
    const state = newGame({ name: 'Record', difficulty: 'normal', seed: 51 });
    state.org.cash = 50_000;
    const crew = crewList(state).filter((n) => n.status === 'active').slice(0, 2);
    const notesBefore = crew.map((n) => n.notes.length);

    const def = OPERATION_BY_ID.corner_shakedown;
    const t = operableTerritories(state)[0];
    launchOperation(state, def.id, crew.map((n) => n.id), t.territory.id, 'straight');

    const rng = new Rng(7);
    for (let i = 0; i < def.durationDays + 1; i++) advanceDay(state, rng);

    crew.forEach((npc, i) => {
      expect(
        npc.notes.length,
        `${npc.name} ran a job and it left no trace on their sheet`,
      ).toBeGreaterThan(notesBefore[i]);
      expect(npc.notes[0].text).toContain(def.name);
    });
  });
});
```

Check `advanceDay`'s real signature before writing this — it may take only `state`. Match it.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/sim/__tests__/operations.test.ts
```

Expected: FAIL — note count unchanged.

- [ ] **Step 3: Write the note**

In the resolution path in `src/sim/operations.ts`, at the loop that already calls `gainFamiliarity(npc, FAMILIARITY_PER_OPERATION)`:

```ts
      gainFamiliarity(npc, FAMILIARITY_PER_OPERATION);
      /*
         The ordinary case, which was the one going unrecorded.

         Notes were written when somebody was hurt or arrested and at no other
         time, so a man could run thirty clean jobs and have a blank sheet.
         That is the record the player is supposed to read who-carries-what
         from, and it only ever held the disasters.
      */
      addNote(
        npc,
        state.day,
        success ? `Out on the ${def.name}. It went clean.` : `Out on the ${def.name}. It did not.`,
        success ? 'good' : 'neutral',
      );
```

Match the surrounding code's names for `success` and `def` — read the enclosing function rather than assuming. Failure is `'neutral'`, not `'bad'`: the job going wrong is not something that was done *to him*, and `'bad'` is reserved for that.

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/sim/__tests__/operations.test.ts
```

Expected: PASS.

- [ ] **Step 5: Voice guard and full suite**

```bash
npx tsc --noEmit && npx vitest run
```

`voice.test.ts` scans string literals across the codebase. If it flags the new strings, fix the string — do not add an exemption.

---

### Task 11: Nights, where the choice is made

**Files:**
- Modify: `src/ui/panels/CrewPanel.tsx:98-108` (table header) and the row body below it
- Modify: `src/ui/panels/OperationsPanel.tsx:338-380` (the assemble crew picker)

**Interfaces:**
- Consumes: `nightsWorked(state, npcId)` from Task 8.

The second placement is the one that matters. In the crew table it is a record; in the crew picker it is a decision, because the imbalance is in front of you at the moment you are choosing who to send.

- [ ] **Step 1: Add the column to the crew table**

In `src/ui/panels/CrewPanel.tsx`, add a header cell after `Skill`:

```tsx
                  <th className="num">Nights</th>
```

and the matching body cell in the row, using the same `className="num mono"` the other numeric cells use:

```tsx
                  <td className="num mono">{nightsWorked(state, npc.id)}</td>
```

- [ ] **Step 2: Add it to the crew picker, where it changes a decision**

In `src/ui/panels/OperationsPanel.tsx`, in the assemble panel's crew table, add after the `Care` header:

```tsx
                        <th className="num">Nights</th>
```

and in the row:

```tsx
                          <td className="num mono">{nightsWorked(state, npc.id)}</td>
```

Add a comment above the header:

```tsx
                        {/*
                           How many nights each of them has had lately.

                           A count of what you did, never a stat about them —
                           the effect it has on a man is his business and stays
                           hidden. It is here rather than only on the crew
                           sheet because this is where the decision is made:
                           the reason to rotate has to be visible at the moment
                           you are picking, not on a page you visit afterwards.
                        */}
```

Import `nightsWorked` from `../../sim/standing` in both files.

- [ ] **Step 3: Typecheck and suite**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 4: Verify in the browser**

Back up any real save. Open Operations, select a job, and read the picker:

```js
(() => {
  const t = [...document.querySelectorAll('table')].find(x => /nights/i.test(x.querySelector('thead')?.innerText || ''));
  return t ? t.innerText.split('\n').slice(0, 12) : 'no Nights column found';
})()
```

Expected: a Nights header and a number per row. Then open Organization and confirm the same column is on the crew table. Restore the save.

---

### Task 12: Complicity — the law reaches for the people who were there

**Files:**
- Modify: `src/sim/investigation.ts:359-380` (`witnesses`), `:412-435` (`arrests`)
- Test: `src/sim/__tests__/investigation.test.ts`

**Interfaces:**
- Consumes: `nightsWorked` from Task 8, `LAWYER_BY_LEVEL` (already imported in this file).

Three changes. The third is a bug.

- [ ] **Step 1: Write the failing tests**

```ts
describe('who the law reaches for', () => {
  it('sweeps up the people who were actually out there', () => {
    /*
       The sweep was `rng.sample(available, count)` — a lottery over the
       payroll. That made losing a man to a federal sweep a dice roll rather
       than something the player built over forty days of sending the same
       three people, and it left the one decision this game asks a hundred
       times with no consequence attached to it.
    */
    const state = newGame({ name: 'Sweep', difficulty: 'normal', seed: 61 });
    const crew = crewList(state).filter((n) => n.status === 'active');
    const worker = crew[0];
    state.day = 60;
    for (let d = 20; d < 55; d++) {
      state.operationHistory.unshift(
        { defId: 'corner_shakedown', day: d, crewIds: [worker.id] } as never,
      );
    }

    let taken = 0;
    for (let seed = 0; seed < 20; seed++) {
      const world = structuredClone(state) as typeof state;
      sweep(world, new Rng(seed));
      if (world.npcs[worker.id].status === 'arrested') taken++;
    }

    expect(taken, 'the man who ran every job was no likelier to be taken').toBeGreaterThan(10);
  });

  it('applies retained counsel to a sweep, the same as to any other arrest', () => {
    /*
       The bug. `operations.ts` scaled an on-the-job arrest by the retainer's
       sentenceMultiplier and the sweep did not, so the same lawyer gave two
       different answers depending on how a man was picked up.
    */
    const withCounsel = newGame({ name: 'Sweep', difficulty: 'normal', seed: 62 });
    withCounsel.org.cash = 500_000;
    retainLawyer(withCounsel, 'best');
    const without = newGame({ name: 'Sweep', difficulty: 'normal', seed: 62 });

    sweep(withCounsel, new Rng(3));
    sweep(without, new Rng(3));

    const held = (s: typeof without) =>
      crewList(s)
        .filter((n) => n.status === 'arrested')
        .map((n) => n.unavailableUntilDay - s.day);

    expect(held(withCounsel).length).toBeGreaterThan(0);
    expect(Math.max(...held(withCounsel))).toBeLessThan(Math.max(...held(without)));
  });
});
```

`sweep` is not exported today — the `arrests` stage runs inside `applyStageEffect`. Export a named function for it as part of Step 3 rather than testing through the whole stage machine; a test that has to advance an investigation five stages to reach the line under test is testing the stage machine.

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run src/sim/__tests__/investigation.test.ts
```

Expected: FAIL — `sweep is not exported`.

- [ ] **Step 3: Rewrite the sweep**

Extract the `arrests` case body into an exported function and change the selection and the sentence:

```ts
/**
 * A sweep takes the people who were out there.
 *
 * This was `rng.sample` over the whole payroll — a lottery, which is both
 * wrong about how a case is built and the reason a playtester read losing a
 * soldier for forty-five days as bad luck rather than as the bill for sending
 * the same man on everything. Nights worked is what a case actually
 * accumulates against somebody, so it is what decides who gets taken, with
 * enough jitter that it is not a certainty.
 */
export function sweep(state: GameState, rng: Rng, agencyShortName = 'the police'): Npc[] {
  const available = crewList(state).filter(
    (n) => n.status === 'active' || n.status === 'busy',
  );
  if (available.length === 0) return [];

  const count = Math.min(available.length, rng.int(ARREST_SWEEP_COUNT[0], ARREST_SWEEP_COUNT[1]));
  const taken = [...available]
    .sort(
      (a, b) =>
        nightsWorked(state, b.id) + rng.float(0, SWEEP_JITTER) -
        (nightsWorked(state, a.id) + rng.float(0, SWEEP_JITTER)),
    )
    .slice(0, count);

  const shorten = LAWYER_BY_LEVEL[state.law.lawyer].sentenceMultiplier;
  for (const npc of taken) {
    npc.status = 'arrested';
    const rolled = rng.int(ARREST_SWEEP_DAYS[0], ARREST_SWEEP_DAYS[1]);
    // The retainer applies here too. It did not, which meant the same lawyer
    // gave two different answers depending on how a man was picked up.
    npc.unavailableUntilDay = state.day + Math.max(7, Math.round(rolled * shorten));
    npc.stats.fear = clamp(npc.stats.fear + 20, 0, 100);
    addNote(npc, state.day, `Swept up by ${agencyShortName}.`, 'bad');
  }
  return taken;
}
```

Add `SWEEP_JITTER` to `src/config/lawEnforcement.ts` beside the other sweep constants:

```ts
/**
 * How much luck there is in who a sweep takes, in nights-worked units.
 *
 * Without this the same three men are taken every time, which is a lookup
 * rather than a risk. With it, doing all the work makes you far likelier to be
 * taken and never certain.
 */
export const SWEEP_JITTER = 3;
```

Then replace the `case 'arrests':` body with a call to `sweep`, keeping the existing `suspectIds` push, the `record(...)` line and the `cover(...)` call — those belong to the stage, not to the sweep.

- [ ] **Step 4: Blend presence into the witness list**

In the `witnesses` case, replace the sort:

```ts
        .sort((a, b) => b.stats.fear - a.stats.fear);
```

with:

```ts
        /*
           Who looks likely to talk, among the people who were there.

           Fear alone picked the most frightened man on the payroll whether or
           not he had ever been out on anything, which is not how anybody
           builds a case. Presence first, breakability second.
        */
        .sort(
          (a, b) =>
            nightsWorked(state, b.id) * WITNESS_PRESENCE_WEIGHT + b.stats.fear -
            (nightsWorked(state, a.id) * WITNESS_PRESENCE_WEIGHT + a.stats.fear),
        );
```

with `WITNESS_PRESENCE_WEIGHT = 6` in `src/config/lawEnforcement.ts` and a comment saying it is stated in fear-points per night.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/sim/__tests__/investigation.test.ts src/sim/__tests__/counsel.test.ts
```

Expected: PASS. `counsel.test.ts` asserts the retainer ladder is monotonic and never makes an arrest free — the sweep now shares that guarantee via `Math.max(7, …)`.

- [ ] **Step 6: Full suite and typecheck**

```bash
npx tsc --noEmit && npx vitest run
```

---

### Task 13: The spread probe — does any of this bite?

**Files:**
- Create: `src/sim/__tests__/spread.probe.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 5–12.

This is the honest check on Tasks 8–11. If a boss who always sends their best three ends up in the same state as one who rotates, then "work marks people" is a diary and this plan should say so rather than ship it.

- [ ] **Step 1: Write the probe**

Copy `play()` from `src/sim/__tests__/floor.probe.test.ts` into the new file as the world runner — it already handles memos, recruiting, fronts and game-over, and copying it keeps the two probes independent so a change to one cannot silently move the other. Give it one extra parameter, the crew-picking policy, and replace whatever it currently does to choose crew with a call to it:

```ts
type Policy = 'best' | 'rotate';

/**
 * The two ways a boss can staff a job, and the whole question this probe asks.
 *
 * `best` is what everybody does without thinking about it: send the people
 * most likely to succeed. `rotate` gives up some of tonight's odds to spread
 * the work. If those two produce the same organization after a hundred and
 * eighty days, then marking who carried the work is a diary and not a
 * decision, and the section of the design that built it is wrong.
 */
function pickCrew(state: GameState, def: OperationDef, policy: Policy): Id[] {
  const free = crewList(state).filter((n) => n.status === 'active');
  const ranked =
    policy === 'best'
      ? [...free].sort((a, b) => b.stats.skill - a.stats.skill)
      : [...free].sort((a, b) => nightsWorked(state, a.id) - nightsWorked(state, b.id));
  return ranked.slice(0, def.crewRequired).map((n) => n.id);
}
```

Check `free`'s definition against how the existing probe filters availability — it uses an `idle(state)` helper, and reusing that is better than re-deriving the filter.

Record per world, in the result object beside the fields `play()` already returns:

```ts
interface Spread {
  /** Share of all crew-slots filled by the three most-used people. */
  topThreeShare: number;
  /** People ending with grievance at or above 55 — the badge threshold. */
  carrying: number;
  /** People who defected over the run. */
  walked: number;
  /** Of the seven behaviourally-gated jobs, how many opened before the rank did. */
  openedByBehaviour: number;
}
```

`topThreeShare` is computed at the end from `state.operationHistory`: count crew-slots per person across the whole history, sort descending, and divide the top three's total by the sum of all of them.

`openedByBehaviour` needs recording as it happens, not at the end — check each of the seven each week and note the first week it is open together with whether `rankIndex(def.minRank) <= rankIndex(state.player.rank)` was true at that moment. If it was not, behaviour opened it.

Run 30 seeds of 180 days for each policy, on the **same** seed set:

```ts
const DAYS = 180;
const SEEDS = Array.from({ length: 30 }, (_, i) => 2000 + i);
const best = SEEDS.map((s) => play(s, DAYS, 'best'));
const rotate = SEEDS.map((s) => play(s, DAYS, 'rotate'));
```

- [ ] **Step 2: Assert the two policies separate**

```ts
  it('separates a boss who always sends their best from one who rotates', () => {
    // eslint-disable-next-line no-console
    console.log(
      `spread: always-best ${median(best.map((r) => r.topThreeShare)).toFixed(2)} of slots to three men, ` +
        `${median(best.map((r) => r.carrying))} carrying, ${median(best.map((r) => r.walked))} walked; ` +
        `rotate ${median(rotate.map((r) => r.topThreeShare)).toFixed(2)}, ` +
        `${median(rotate.map((r) => r.carrying))} carrying, ${median(rotate.map((r) => r.walked))} walked`,
    );

    /*
       The pre-committed condition. Concentrating the work has to cost
       something measurable, or the marks are decoration. This is deliberately
       stated on grievance and defections rather than on any score: if the
       always-best boss ends up with the same crew as the rotating one, the
       decision this whole section was built to create does not exist.
    */
    expect(
      median(best.map((r) => r.carrying)),
      'concentrating every job on three men cost nothing',
    ).toBeGreaterThan(median(rotate.map((r) => r.carrying)));
  });
```

- [ ] **Step 3: Assert behaviour is not opening everything**

```ts
  it('does not open the whole back half on behaviour alone', () => {
    const byBehaviour = median(best.map((r) => r.openedByBehaviour));
    // eslint-disable-next-line no-console
    console.log(`spread: ${byBehaviour} of 7 gated jobs opened on behaviour before rank`);
    expect(byBehaviour, 'the behavioural conditions are too soft — rank is now cosmetic')
      .toBeLessThan(6);
  });
```

- [ ] **Step 4: Guard the instrument first**

Before either assertion, assert the probe actually played — worlds that survived past day 60, jobs actually launched, at least three distinct people used. Every instrument in this project that measured nothing did so while returning a plausible number.

- [ ] **Step 5: Run it**

```bash
npx vitest run src/sim/__tests__/spread.probe.test.ts
```

If the separation assertion fails: **do not adjust `STANDING`'s thresholds to make it pass.** Record the result under `## Probe results`, and treat it as the finding — either the marks need to reach something with more consequence than grievance, or the mechanic does not work and should not ship. That decision goes back to the spec, not into a threshold.

- [ ] **Step 6: Full suite**

```bash
npx tsc --noEmit && npx vitest run
```

---

### Task 14: Record what the instruments said

**Files:**
- Modify: `docs/plans/2026-08-19-fun-depth-pacing.md` (`## Probe results`)
- Modify: `README.md`
- Modify: `docs/PLAYTEST.md`

- [ ] **Step 1: Run all three probes and paste their lines verbatim**

```bash
npx vitest run src/sim/__tests__/floor.probe.test.ts src/sim/__tests__/grok.probe.test.ts src/sim/__tests__/spread.probe.test.ts
```

Paste the `surplus:`, `grok:` and `spread:` lines into `## Probe results` with the date. Verbatim — not summarised.

- [ ] **Step 2: Check them against the conditions committed in this plan**

| Probe | Committed condition | Met? |
|---|---|---|
| surplus | grows with crew size; Crew Leader day 70–110 median | |
| grok | later than the baseline printed before this work | |
| spread | always-best and rotate separate on `carrying` | |

Fill in the third column honestly. A condition that was not met is the finding, and goes in the write-up next to the ones that were.

- [ ] **Step 3: Update the README**

The README already carries the honest reading of the grok figure. Add the surplus and spread figures beside it in the same voice, and say what each is for.

- [ ] **Step 4: Add a round-7 note to `docs/PLAYTEST.md`**

Under "What changed, and why", record that round 6's plateau finding drove this work and what it changed, so the next reader knows which build the next report is against.

- [ ] **Step 5: Final full run**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: every test passes. Note the total count — it was 499 before this plan.

---

## Probe results

### 2026-08-19 — Task 3, the surplus probe

24 worlds, 180 days each, no safety net, bot playing best expected money per
crew-day and hiring only what recent weeks could carry.

```
surplus: 2 crew +0/wk on a 300 wage bill (n=34), 3 crew +91/wk on a 450 wage bill (n=163),
         4 crew +0/wk on a 600 wage bill (n=85), 5 crew -111/wk on a 603 wage bill (n=71),
         6 crew -750/wk on a 754 wage bill (n=203), 7 crew -504/wk on a 1052 wage bill (n=40)
         Crew Leader reached in 0/24 worlds
```

For comparison, the same run's existing line:

```
floor: over 180 days (26 weeks), median 0 stuck weeks (worst 0), median longest unbroken run 0 (worst 0)
       stuck because: no bodies 0, no money 0, something else 0, no bodies but could have hired 0
```

**Branch A, in a stronger form than the spec anticipated.** The spec's Branch A
was written for a surplus that is *flat* across crew sizes. It is not flat. It
peaks at three people (+$91/wk) and falls away monotonically after, reaching
−$750/wk at six. The organization does not merely fail to grow richer as it
grows — **growing makes it poorer**. These are diseconomies of scale.

The wage column rules out the obvious alternative reading. Between three crew
and six the bill goes 450 → 754, up about $300, while the weekly result goes
+91 → −750, down about $840. Wages account for barely a third of the fall. The
rest is that a bigger outfit does not run proportionally more work — the extra
bodies are idle, injured, inside, or waiting on a job the crew cannot staff and
afford at the same time.

**Consequences, recorded before acting:**

1. Payouts are untouched, per the committed rule. And the data says more than
   the rule required: a payout rise would lift the whole line and leave the
   slope negative, so a richer bot would hire more and hiring is precisely what
   makes it poorer. It would make the measured problem worse, not better.
2. Delegation as currently priced cannot close this. `worthPerWeek: 420` at
   real standing yields about $182/week on a held district — measured live on
   a day-349 save. Against −$750/week at six crew, a steward is a rounding
   error. Section 1's claim that delegation is the economies-of-scale lever is
   *directionally* right and *quantitatively* nowhere near enough.
3. Crew Leader was reached in **0 of 24 worlds** in 180 days. Round 6's tester
   reaching day 179 at Enforcer was not an unlucky run. It is the median
   outcome.

This does not refute the spec — the spec's diagnosis, that the organization has
no economies of scale, is confirmed and then some. It refutes the *sizing* of
the fix in section 1.

### 2026-08-19 — Task 4, what the surplus is actually made of

Branch A taken. **Payouts untouched.**

Acting on Branch A immediately hit an instrument problem: the floor probe's bot
had never delegated in its life, so it could not test the fix Branch A names.
Taught it to (weekly, most senior free man onto the district with the most
standing), which is the policy a player would follow. Result:

```
5 crew  -111/wk  ->  -37/wk
6 crew  -750/wk  -> -644/wk
```

Delegation is worth roughly **$100 a week** against a **$650 a week** hole. It
is directionally right and about an order of magnitude short, which settles the
open question in section 1 item 3: `worthPerWeek: 420` cannot carry this
argument on its own.

Then a measurement of where the bodies are, which took three attempts and got
two confident wrong answers first — recorded here because both were the exact
failure this project keeps repeating:

1. Sampled weekly. Jobs run one to five days, so short jobs were caught only
   sometimes. Reported "under one person working at any crew size".
2. Sampled daily but at the *top* of the loop — after `advanceDay` resolved
   everything and before the bot launched anything, which makes every
   single-day job structurally invisible. The two cheapest jobs in the game
   both run a single day. Reported "0.02 to 0.24 jobs running", i.e. an
   organization that almost never works.
3. Sampled after the work is set going and before the clock resolves it. This
   one is right.

```
where the bodies were:
  2: 0.5 idle / 0.4 on a job / 1.1 out, 0.39 jobs running
  3: 1.3 idle / 0.7 on a job / 1.0 out, 0.46 jobs running
  4: 2.2 idle / 0.5 on a job / 1.3 out, 0.35 jobs running
  5: 2.9 idle / 0.7 on a job / 1.5 out, 0.43 jobs running
  6: 3.7 idle / 0.7 on a job / 1.6 out, 0.42 jobs running
  7: 4.6 idle / 0.5 on a job / 1.9 out, 0.32 jobs running
```

**Throughput is constant and low.** Jobs running holds at 0.32–0.46 whatever
the size of the crew, and the number of people on a job holds at 0.4–0.7. Every
body hired past the third joins the idle column: idle rises 0.5 → 4.6 while
work does not move at all. That is the mechanism behind the negative surplus,
and it is not the wage bill — it is that the organization cannot put more
people to work by having more people.

**Two things are out of the crew at all times.** The `out` column — injured or
in a cell — is 1.1 of two people and 1.9 of seven. It is the one column that
cannot be a sampling artifact, because a status that lasts thirty to ninety
days is visible whenever you look. Over half a small crew is unavailable; a
seventh crew member is, on this evidence, mostly buying a 27% chance of being
present.

**This changes the design.** Section 1 assumed the surplus problem was
financial — income scaling like wages. It is not. It is a throughput problem:
you can pay for seven people and field one. Delegation helps because it is the
only way to earn from a body that is not on a job, which is why it was the
right instinct, but at $100/week it is a patch on a $650/week hole.

### 2026-08-19 — Task 4b, why the throughput is flat

Every day of every career sorted into exactly one bucket by what stopped the
organization starting work. Counted rather than reasoned about, because
reasoning about it is how the two wrong answers above were produced.

```
why not working, over 4320 crew-days:
  started something 25%
  too hot 53%
  laying low 20%
  already doing the solo job 2%
  no ground to work 0%, no bodies 0%, no money 0%, could have and did not 0%
  46 jobs started in the median career
```

**It is heat, and it is not close.** Seventy-three per cent of the life of an
organization is spent unable to work because of attention — 53% sitting above
the point where working is reckless, 20% deliberately laying low. Territory,
bodies and money account for **zero**.

That is the mechanism behind everything above, and it is a single sentence:

> Throughput is capped by heat. Heat is global and does not scale with the
> organization. So every body hired past the point where heat binds is pure
> cost, and the organization gets poorer as it grows.

It also closes a loop that explains why no career escapes. `heatScale` already
makes work far beneath your standing nearly invisible — that is the intended
release valve, and it is the main reward for rank. But rank needs clean money,
clean money needs throughput, and throughput needs heat headroom that only rank
provides. Crew Leader in 0 of 24 worlds is that circle, measured.

Three candidate causes were proposed before this was run — arrest and injury
downtime, a hidden launch constraint, and "the game intends this and careers
are meant to be larger". All three were wrong. The arrest figure is real (1.1
of two crew, 1.9 of seven are out at any moment) and is **not** what binds:
bodies were never once the reason a day passed without work.

**Consequences for the plan.** Section 1's remaining items are aimed at the
wrong quantity and should not be built as written. `worthPerWeek` is not the
knob. The question the design now has to answer is what gives a growing
organization more heat headroom — insulation through people, falling heat per
job as standing rises, or a rank ladder that does not depend on the thing it
gates. That is a design decision, not a tuning one.

Sections 2, 3 and 4 are untouched by this and still stand on their own.

### 2026-08-19 — Task 5, distance instead of rank gap

`heatScale` now reads `heatDistance` — rank gap plus the seniority of whoever
was sent, whether the ground has a steward on it, and how many people are on
the payroll, capped at `maxFromOrganization: 2.5` so rank still matters. The
table itself is unchanged and is now interpolated, so every whole rank of
separation returns exactly what it always did.

Before, and after, on the same 24 seeds:

```
                        before        after
Crew Leader reached     0/24          8/24, median day 132
started something       25%           32%
too hot                 53%           45%
laying low              20%           18%
jobs in median career   46            64
largest crew observed   7             12
```

```
surplus: 1 crew +0/wk (n=9), 2 crew -103/wk (303 bill, n=12), 3 crew +31/wk (301, n=163),
         4 crew -240/wk (600, n=53), 5 crew +0/wk (750, n=60), 6 crew -384/wk (900, n=186),
         7 crew -1202/wk (1202, n=57), 10 crew -579/wk (1210, n=8),
         11 crew -1104/wk (1505, n=13), 12 crew -1858/wk (1807, n=25)
```

**One of the two committed targets met, and the important one.** Careers that
previously could not exist now do: Crew Leader in a third of worlds where it
was none, at a median of day 132, and organizations reaching twelve people
where seven was the ceiling. The circle is broken.

**The second target was not met.** Peak surplus is still at three crew. What
changed is the regime beyond it: at twelve people the weekly loss (−1858) has
converged on the wage bill (1807), where before the wage bill explained barely
a third of the fall. That is Part One's original diagnosis — income not scaling
like wages — becoming true at a size the game previously never reached. It was
the wrong answer to the old question and may be the right answer to the new
one, and it should be measured again rather than assumed.

**Not tuned to taste.** The four `HEAT_DISTANCE` constants were set once,
before this run, and have not been adjusted since. If they get adjusted later
it must be against a re-run, and the before/after above is the baseline.

Unchanged and worth watching: the grok probe still puts the last new kind of
move at week 7 of 92. Throughput is not what that measures, and nothing in this
task was aimed at it — section 2 is.

### 2026-08-20 — Tasks 6 and 7, behavioural unlocks and the perCrew correction

Six `opens` conditions on the six `crew_leader` jobs, each naming specific work
that leads to that work, plus `opsBoard` and 14 tests. The guard that matters:
the minimal board satisfying any one condition satisfies none of the other
five, checked mechanically, so this cannot become the same wall a fortnight
later.

Adding them turned `broke.probe` red, and the failure was a finding rather than
a broken test. The recruit warning the game shows a player — hire within your
income — had become false, because under `perCrew: 1/6` every body bought
distance and so hiring aggressively bought *safety*:

```
hiring whenever affordable: 12 short weeks, 11 serious, in 3 worlds
hiring within income:        7 short weeks,  5 serious, in 4 worlds
```

`perCrew` halved to 1/12 on a rule set before re-measuring — headcount alone
must never be worth more than one rank of separation at a realistic crew size.
After:

```
hiring whenever affordable: 11 short weeks, 11 serious, in 8 worlds
hiring within income:       13 short weeks, 13 serious, in 5 worlds
...and keeping Friday back:  2 short weeks,  2 serious, in 2 worlds
```

Ordering restored, and with far better resolution than the assertion has ever
had: 8 against 5 against 2, where the previous re-anchoring was arguing about 3
against 4 out of 24. The assertion itself was **not** moved. It has been
re-anchored twice in this project's history and a third move would have been
the point at which it stopped measuring anything.

The whole arc, on the same 24 seeds:

```
                        baseline   +heat    +unlocks   +perCrew fix
Crew Leader reached     0/24       8/24     6/24       4/24, median day 78
started something       25%        32%      33%        29%
jobs in median career   46         64       67         54
grok, last new move     week 7     week 7   week 7     week 10
grok tail (worst world) week 9     week 9   week 16    week 54
```

**The pacing metric moved for the first time.** `grok` measures the week the
last new *kind* of move appears, and it had sat at week 7 through every change
this project has made. It is now week 10, with a spread of 5, 6, 7, 8, 10, 28,
38, 54 across careers running 120 weeks. Two careers were still being handed
new kinds of decision most of a year in. That is what section 2 was for, and it
is the one number that speaks to the Pacing score of 6.

**The trade-off, stated plainly.** Halving `perCrew` cost rank reachability: 6
of 24 worlds down to 4. Against a baseline of 0 that is still the difference
between a gate nobody passes and a gate a sixth of careers pass, and an honest
recruit warning is worth more than two worlds — a player reads that warning and
acts on it, and a warning that is not true is worse than none.

**Still open.** Surplus remains negative at scale (12 crew, −2836/wk against an
1815 wage bill) and peak surplus is still at three crew. Fewer careers now
reach twelve people, so it binds less often, but Part One's original diagnosis
is now genuinely true in the regime past ten and has not been addressed.

**A criticism of the shape that measurement has not answered.** Headcount is
the only contributor to distance that is unconditional — you are quieter for
having people whether or not you use them, where seniority and a steward both
require you to have done something with them. Halving the number treated the
size of that effect and not its shape. Left alone deliberately, and recorded
here so that the next person to look at it knows it was seen rather than
missed.

### 2026-08-20 — Sections 3 and the spread probe

Section 3 built: `config/standing.ts`, `sim/standing.ts`, two memory kinds, the
weekly mark at clock step 5c, a note for everybody on a job, and the Nights
column in the crew table and the assemble picker. 11 tests.

The deferral in Part Two was wrong and the pre-check said so:

```
standing material: median 3 nights per person per 8 weeks
                   (84% of readings above zero, worst-to-best 0-33)
marks would fire on 17% carrying, 25% benched, of 2142 person-readings
```

The reasoning behind the deferral was arithmetic about the median. The ratio
does not read the median, it reads the spread, and the spread is 0 to 33.

Then the probe that was built to disprove the mechanic. Two policies, 30 seeds
each, everything else identical:

```
spread: three men carried 59% of the work under always-best, 52% under rotate
spread: always-best 1.13 carrying a grievance (median 1), 5 walked,
        14 carry marks / 8 bench marks;
        rotate 0.73 carrying (median 0), 5 walked,
        8 carry marks / 5 bench marks
```

**The mechanic bites, and it bites lightly.** The two policies do staff
differently (59% against 52%) and the marks fire often enough to be a mechanic
(14 and 8 per career). Concentrating the work costs you more aggrieved people —
1.13 against 0.73 — which is the pre-committed condition, met, and it is met by
a margin small enough to be worth saying out loud rather than celebrating.
Defections are identical at 5 and 5, so nothing has yet reached the point of
people walking out over it.

**What this probe is not entitled to say.** The plan asked it to report how many
gated jobs open on behaviour before rank. It reports 0 of 6, and that figure is
about the bot: it launches in config order until it runs out of bodies, so it
only ever ran 5 kinds of job, and four of the six conditions count exactly the
kinds it never reaches. The assertion was rewritten to state the limitation
rather than to pass at zero, because an assertion that cannot fail in the
informative direction is worse than none. The instrument that does speak to the
unlocks is `grok.probe`, which moved from week 7 to week 10 with a tail to week
54.

**Open, and deliberately not tuned.** The pre-check predicted the bench mark
would fire on 25% of person-readings, which is a quarter of a crew aggrieved
every week. The measured 8 bench marks per career suggests it is milder in
practice than that predicted. Neither number has been used to adjust
`benchBelow`, and the first person to adjust it should re-run this file.

### 2026-08-20 — Section 4, complicity

Two changes and a bug.

**The bug.** The `arrests` stage rolled `ARREST_SWEEP_DAYS` with no
`sentenceMultiplier`, while an arrest on a job applied one. The same retainer
gave two different answers depending on how a man happened to be picked up.
`sweep()` is now extracted from the stage, applies the multiplier, and keeps
the `Math.max(7, ...)` floor the on-the-job path has.

**The weighting**, with the acceptance rule committed before the change: `no
bodies` must stay at 0% and `started something` must not fall below 29%.

The first attempt sorted on nights-worked plus small noise. A test caught it
taking the same man in **40 worlds out of 40** — once one man is far enough
ahead, small noise never reorders him, and the sweep becomes a lookup rather
than a risk. Replaced with a weighted draw, `nights + SWEEP_JITTER`, so
everybody stays possible and the man who ran everything is much the most
likely. `SWEEP_JITTER` is the floor weight rather than added noise, which is
what stops the quiet men being untouchable.

After:

```
why not working: started something 29%, no ground 0%, no bodies 0%, no money 0%,
                 too hot 44%, laying low 23%
                 57 jobs started in the median career
spread:          always-best 1.20 carrying a grievance, rotate 0.80
                 (was 1.13 against 0.73 before the weighting)
```

**Accepted.** Both committed conditions met, with `started something` exactly on
its floor rather than comfortably above it. The separation in `spread` widened
slightly, which is the intended effect — concentrating the work now costs you
on the law's side as well as in grievance.

**A cost that was not pre-registered, recorded rather than buried.** Crew Leader
is still reached in 4 of 24 worlds, but the median day moved from 78 to 135.
The sweep now takes the people you use most, who are the people who earn most,
so a career recovers more slowly from one. Whether that is the mechanic working
or the mechanic overreaching is not something this run can say, and it should
be the first thing looked at if the next playtest reports the back half as
slow.

### 2026-08-20 — The ladder, measured over four years

The 180-day probe reached the second of seven ranks in 4 worlds of 24, and that
figure was doing two jobs at once: it could not tell a slow ladder from a stuck
one. Six months is not a career. So: 12 careers, 1460 days each, same bot.

```
ladder: over 1460 days (4 years), 12 careers
        Street Criminal: 12/12 (median day 0)
        Enforcer:        11/12 (median day 21)
        Crew Leader:     10/12 (median day 319)
        Capo:             0/12
        Underboss:        0/12
        Boss:             0/12
        Crime Lord:       0/12
        furthest requirement at the end: clean money 8, respect 3, crew 1
        median final crew 3, districts 1, fronts 2, peak clean 19068
```

**Crew Leader is slow, not blocked.** 10 of 12 careers reach it, median day 319.
The 16% figure was an artifact of the window.

**Capo is a wall, and so is everything above it.** Zero careers in four years.
Not one. That is not a balance number — a rung that no career passes in four
years is a requirement the game does not afford a way to meet.

**A correction, recorded because the first version of this was wrong.** The
probe initially reported respect as the furthest requirement in all 12 careers.
That was a NaN: `state.player.respect` does not exist — respect lives on
`state.org` — so the share was `undefined / 140` and sorted to the front every
time. The typechecker caught it. The probe had been perfectly happy printing a
confident wrong answer, which is the fourth time in this project a measurement
has done exactly that. The blocker filter now discards non-finite shares, so
the same mistake produces no answer rather than a plausible one.

**Where the wall actually is.** Capo asks for respect 140, crew 10, clean
$45,000, 35 operations and 2 districts. The median career ends with **3 crew, 1
district, 2 fronts and a peak of $19,068**. The true furthest requirement is
**clean money in 8 of 12 careers**, respect in 3, crew in 1.

**And the cause is already measured.** Peak weekly surplus is at three crew, and
goes negative above it. The economy has a stable attractor at exactly the size
where an outfit breaks even — three people — and Capo needs ten. Careers do not
stall at Capo because Capo is expensive. They stall because nothing in the game
pulls an organization past the size at which it stops losing money, so the
inputs to every rank above Crew Leader never accumulate.

This is the same finding as "surplus is negative past 3 crew", seen from the
other end. The heat work moved Crew Leader from unreachable to routine. It did
not move the equilibrium crew size, and the equilibrium crew size is what the
top five ranks are made of.

### 2026-08-20 — The resting point, and why the ladder stopped at three ranks

Root cause, and it is not a balance number. `addHeat` sets `quietDays = 0`, and
decay requires `quietDays >= 2`. **An organization that generates heat at least
every other day never decays at all.** A three-man crew gets quiet gaps between
jobs by accident. A twelve-man crew working continuously gets none. Attention
therefore behaved *worse* the larger you got, so heat removed per day was a
constant while heat generated per day rose with the payroll. The two met at
three people, and that is where every career sat.

`HEAT_ABSORPTION`: an organization above four people makes a little street heat
go away every day whether or not it was quiet. It is the other half of
`heatDistance` — that made each job quieter, this makes the organization itself
absorb attention continuously.

Two failing tests caught the first version being too broad, and both were right:

- It decayed from day one, breaking "you cannot idle your way out". Fixed with
  `fromCrew: 4` — a man alone has no apparatus, so the early game is untouched
  and the rule still holds where it matters most.
- It cooled every channel, which says a bigger payroll does something about an
  informant already inside. It does not. Restricted to `street`, which is what
  jobs generate and what a fixer can actually make quieter.

Four-year ladder, same twelve seeds:

```
                    before          after
Enforcer            11/12 day 21    12/12 day 22
Crew Leader         10/12 day 319   12/12 day 172
Capo                 0/12            0/12
median final crew    3               5
median districts     1               2
median fronts        2               3
median peak clean    $19,068         $51,171
```

**The resting point moved from three people to five.** Crew Leader is now
universal and arrives in half the time. Peak clean money passed the Capo
threshold of $45,000. Districts reached the Capo requirement of 2.

**Capo is still 0 of 12.** It needs ten crew and careers rest at five. The wall
moved; it did not open. The remaining gap is crew size alone.

### A correction: the spread probe was measuring the economy

The pre-committed condition was "the two policies separate on people carrying a
grievance". That metric counts grievance from every source, and the largest is
not who you sent — it is missing payday:

```
always-best  14 carry /  8 bench /  5 unpaid marks
rotate        9 carry /  4 bench / 21 unpaid marks
```

Rotate misses payroll four times as often, because weaker crew fail more jobs.
The grievance figure was reading that, not the marks. It pointed the right way
once and inverted as soon as the economy changed under it.

**The earlier reading of 1.20 against 0.80 was reported here as evidence the
mechanic bites. It was not evidence of anything and should be disregarded.**

The assertion now measures what the mechanic controls — how often the marks
fire — which has separated in the same direction in every run. Whether
concentration costs the player something in the *end state* is now an open
question rather than an answered one. Isolating it needs both policies earning
the same money, which this probe cannot arrange.

### 2026-08-20 — Correction to the ladder table, and why the crew stops at five

**The table in the previous entry is wrong and is corrected here.** Those
figures came from the first, too-broad version of `HEAT_ABSORPTION` — the one
that failed two heat tests by decaying from day one and by cooling every
channel. The ladder probe was never re-run after that version was narrowed. The
honest numbers, with `fromCrew: 4` and street-only absorption:

```
                    before          reported (wrong)   actual
Enforcer            11/12 day 21    12/12 day 22       11/12 day 21
Crew Leader         10/12 day 319   12/12 day 172      11/12 day 161
Capo                 0/12            0/12               0/12
median final crew    3               5                  4
median fronts        2               3                  5
median peak clean    $19,068         $51,171            $22,908
```

Crew Leader still arrives in half the time, which is the real gain. The crew
and money figures were overstated by roughly the amount the broad version was
cheating.

**Why the payroll stops growing, measured.**

```
hires 58 per career; lost 0 dead, 65 walked, 2 inside at the end, 69 bench marks
weeks below the cap: nobody offered 32, game refused 414, bot declined 530,
                     could and did 174; at the cap 811
```

Careers do not stop hiring. They hire **58 people** across four years. **65
walk out.** The organization is a leaky bucket, and the leak is defection — not
death, not arrest, not a cap, not the recruit pool, and not the bot's caution.
Capo needs ten people on the payroll at once and the game cannot hold five.

**An attempt to isolate the bench mark's share of that, which failed.** Setting
`STANDING.bench.loyalty` to 0 for one run gave 54 walked instead of 65 — but
also median final crew 1 instead of 4, and Crew Leader at day 291 instead of
161. Changing any number reshuffles the RNG stream and every world diverges, so
at twelve seeds the experiment cannot separate a small effect from the noise it
sits in. The config was restored. What can be said is that defections run at 54
to 65 per career either way, so the bench mark is not the cause of the leak —
it is at most a contributor to a hole that was already there.

**Next question, unanswered.** Why do sixty-odd people walk out of a
four-year career? That is the thing standing between this game and its top five
ranks, and nothing measured so far explains it.

### 2026-08-20 — Why sixty people walk out

Defection is rival poaching against anybody under loyalty 45 (`POACH.loyaltyBelow`).
So the question is why loyalty sits there. `driftNpcs` adds six terms every
week; four of them can be negative. Recomputed on the same people at the same
moment, summed across 9810 crew-weeks:

```
what pushes loyalty down, per crew-week:
  underpaid   -0.23
  grievance   -1.58
  heat/fear   -1.24
  stagnation  -0.64
```

Against that, the player's one positive lever is `wellPaidLoyalty: +2.5` a week
for paying somebody what they think they are worth.

**The sums do not work.** Grievance and heat-fear alone are −2.82 a week. Paying
every man properly earns +2.5. Loyalty is downhill even for a boss who does the
one thing the game tells them to do, which is why fifty-eight hires produce
sixty-five leavers and the payroll rests at four.

**Heat is upstream again.** `heatFearThreshold` is 45 and careers spend 44% of
their days above the working line, so the −1.24 fear term is close to always
on. Heat now demonstrably drives: throughput, the resting crew size, loyalty
loss, defection, and therefore every rank above Crew Leader.

**The caveat that stops this being a conclusion.** Grievance has counterplay —
`sitdown.ts` exists precisely to clear it, and the round-6 tester called it the
best surprise in the build. **No probe in this project has ever held a
sit-down.** The −1.58 above is therefore measured in a world with the remedy
switched off, which is the same mistake as the bot that never delegated and the
bot that never bought a front.

Before any number here is changed, a probe has to hold sit-downs and the drift
has to be measured again. If a boss who works his people's grievances can close
a −1.58, the loop is already correct and the finding is that nobody discovers
it. If he cannot, the arithmetic above is the fault and `wellPaidLoyalty`,
`grievanceLoyaltyFactor` or `heatFearThreshold` is where it lives.

### 2026-08-20 — Does working grievances hold a crew together?

The ladder probe now holds sit-downs. Two runs, because the first one was the
bot's fault and the correction matters more than the number.

**Run one: 125 sit-downs a career, and grievance got worse** — the drain went
from −1.58 to −2.07. The bot opened every conversation with `listen`, which is
correct, and then took whatever was next on the list. `listen` reveals what a
man is carrying; **`name_it`** is the register that takes it off the table, and
it only unlocks once you have listened. The bot started 125 conversations and
finished none of them. Third instance in this project of a probe measuring a
remedy it was not actually applying.

**Run two, with the bot playing the designed line** — `name_it` first when it
is on the table, `listen` when it is not:

```
                        no sit-downs   clumsy      played properly
grievance drain/week    -1.58          -2.07       -1.26
heat/fear drain/week    -1.24          -1.20       -1.16
sit-downs per career    0              125         76
walked per career       65             67          63
Crew Leader median day  161            161         112
```

**The answer is both.** Working grievances properly cuts that drain by about a
fifth, and Crew Leader arrives fifty days sooner, so the loop is real and it
rewards a player who finds it. It does not close the gap. Summed, the negative
terms are still −3.24 a week against the +2.5 a boss earns by paying everybody
what they think they are worth. Defections moved 65 → 63.

**And this points at heat for the fifth time.** Grievance has counterplay and a
player can cut it by a fifth. **Heat-fear at −1.16 has no counterplay at all**
except lowering heat, which is the thing already binding everything else. It is
the second-largest force pulling a crew apart and nothing in the game answers
it.

**A sample-size warning that applies to this whole file.** `median final crew`
came out 4, 1, 4, 1 across four runs that differed by small config changes.
Twelve seeds is not enough for that statistic — changing any number reshuffles
the RNG and worlds diverge chaotically. The drift figures are averaged over
7601–9810 crew-weeks and are stable. The per-career medians are not, and should
not be read as movement.

### 2026-08-20 — Fear had no answer, and the one that existed was nominal

`reassure` — "Tell them they are covered", `against: 'fear'`, landed line "some
of it goes out of their shoulders" — reduced **grievance**. It reveals
`settled` like every closing register, and settling is written in terms of a
grudge. A frightened man is not an aggrieved one, so the register answered the
wrong question and the prose wrote a cheque the code did not honour.

Nothing anywhere in the simulation reduced `npc.stats.fear` outside a handful
of event branches. Heat has laying low and distance. A grudge has this
conversation. Being broke has the job board. Being frightened had nothing, and
it was measured at −1.16 loyalty per crew-week, the second largest force
pulling a crew apart.

**The fix, data-driven rather than special-cased.** `RegisterDef.calms?:
NpcStatId` and `SITDOWN.calmed: 18`, applied in `chooseRegister` beside
`promises`. `reassure` declares `calms: 'fear'`. Any future register can put
something down by naming it. 18 rather than the 30 a settled grievance removes,
because being frightened is a reasonable response to a real danger — telling a
man he is covered takes the edge off and has to be said again.

Two tests: it calms when it lands, and it does **not** when it misses. A man
who does not believe you is not less frightened for having been told, which is
what his own missed line says.

The four-year ladder, with the probe reassuring frightened people as well as
working grudges:

```
                        no counterplay   grudges only   grudges + fear
grievance drain/week     -1.58            -1.26          -0.92
heat/fear drain/week     -1.24            -1.16          -1.18
sit-downs per career      0                76             239
walked per career         65               63             60
Crew Leader median day    161              112            108
Capo                      0/12             0/12           1/12, day 575
```

**A career reached Capo.** One in twelve, on day 575, and it is the first time
any career in this project has passed the third rung. The negative terms now
total −2.93 a week against the +2.5 a boss earns by paying well, down from
−3.69.

**The fear term itself barely moved**, and that is the honest reading rather
than a disappointment. `calms` removes 18 from one man; the pressure is heat,
it is constant, and every new hire arrives frightened into the same weather. It
buys time with a specific person. It does not change the climate.

**Sample-size warning still applies.** `median final crew` read 6 here against 4
and 1 in adjacent runs. Twelve seeds cannot support that statistic. The drift
figures are averaged over 9585 crew-weeks and are the ones worth reading.

### 2026-08-20 — Sweeping `heatFearThreshold`

The threshold is the heat level *above* which a frightened man starts losing
loyalty. Careers spend most of their days above it, so the question was whether
45 is the right place for the line. Three runs, same twelve seeds, nothing else
changed.

```
                            30        45        60
heat/fear drain/week      -1.94     -1.18     -0.64
grievance drain/week      -1.04     -0.92     -0.95
crew-weeks lived           9426      9585     11785
median final crew             3         6         7
walked per career            58        60        71
Crew Leader median day      295       108       231
Capo                       0/12      1/12      0/12
peak clean                $30,985   $26,956   $36,959
furthest requirement    clean money 10  clean money 7  clean money 10
```

**Lowering it is strictly worse.** At 30 the fear term nearly doubles, the
resting crew falls to three, and Crew Leader arrives 187 days later. Nothing
in the run improves.

**Raising it helps the crew economy and does not touch the ladder.** At 60 the
fear term halves, crew-weeks rise 23% — the most stable figure here, being a
sum over the whole four years rather than a median of twelve — and the payroll
rests at seven instead of six. But Capo still does not arrive.

**The Capo count cannot tell these apart.** 0/12 against 1/12 is one career.
Crew Leader's median day and `peak clean` are twelve-sample medians and move
non-monotonically across the sweep, which is what noise looks like. Only the
drift terms and the crew-week total are stable at this sample size.

**The wall is clean money, and it is not heat.** Capo wants $45,000 clean and
ten bodies. Peak clean over four entire years is $27k–$37k depending on the
setting, and `clean money` is the furthest requirement in 7 to 10 of every 12
careers in all three runs. Heat sets how many people you can keep; laundering
throughput sets whether the rank arrives. Moving the fear line changes the
first and leaves the second exactly where it was.

Config left at 45. Changing it is a real improvement to the crew economy and
not a route to the top of the ladder, so it should be decided on its own terms
rather than as a rank fix.

### 2026-08-20 — `heatFearThreshold` set to 60, and where the clean money goes

The threshold is now 60, on the sweep above: the fear drain halves and a family
holds together 23% longer. The comment on it says what it does not buy, so the
next person does not read it as a progression dial.

Then the question that sweep pointed at. Capo wants $45,000 clean and careers
peak at $37,000 after four years, with `clean money` the furthest requirement in
ten of twelve. Is the laundering system too small?

**The instrument.** `tickBusinesses` now records `capacity` and `washable`
alongside what it moved, and the probe reads that rather than `launderOutlook`.
This is not fussiness. Jobs and trades resolve *earlier in the same day* than
the fronts do, so an outlook sampled before `advanceDay` misses the morning's
dirty money and reports a starved machine that was in fact full. Same class of
mistake as the weekly body sampling and the top-of-loop sampling before it.

The clean-flow buckets had the same fault in their first version and it was
caught by arithmetic: the sinks summed to $41,000 more than the reported
income, because an event that *pays* the player was invisible to a helper that
only recorded outgoings. Measured symmetrically the books close to within $754
over four years.

```
the washing machine, 2412 paydays over 12 careers
  no fronts yet          38%
  nothing to wash        32%    the wage bill had already claimed the dirty
  dirty ran out           6%
  capacity ran out       24%

per career
  laundered              $194,497 of $434,531 offered — 45% used
  lost in the wash        $62,099 — a 32% cut
  fronts earned clean     $82,617

clean money in           $220,761
peak balance held         $36,959
Capo wants                $45,000

where the clean went
  jobs                    $98,477   45%
  events                  $60,848   27%
  upkeep                  $52,157   24%
  hires                    $6,077
  fronts                   $3,956
```

**Capacity is not the wall.** It binds a quarter of paydays and runs at 45%
utilisation. Building bigger fronts would move almost nothing.

**A career earns five times the Capo requirement and never holds it once.**
$220,761 in, $45,000 needed at one moment, $36,959 the best it ever managed.
The rank is gated on a held balance and the game gives clean money no standing
as a balance — `spend` takes dirty first, so the clean pool is simply the
wallet everything falls back on the moment dirty runs out, which is a third of
all weeks.

**Which produces a loop that eats a third of the money every time round it.**
Dirty goes through a front at a 32% cut, comes out clean, and is then spent on
the next job because dirty is empty — $98,477 of the $194,497 ever laundered.
The laundering system is funding the operations budget. `LAUNDER_CUT_BASE` is
0.35 against `LAUNDER_CUT_MIN` 0.12, and the bot's Business attribute never
climbs far enough to matter.

**Three candidate repairs, not yet chosen.**

1. *Do not spend the savings.* Give operations and hires a dirty-only cost, or
   let the player mark clean cash as reserved. Makes the held balance a thing
   the player controls rather than a residue.
2. *Charge the cut once.* Money that has been washed should not be spendable
   into a position where it needs washing again — the cycle, not the rate, is
   what makes 32% brutal.
3. *Lower the requirement.* $45,000 held is a lot for an outfit whose fronts
   earn $82,617 clean across four years. But this treats the symptom and the
   same shape recurs at Underboss ($180,000) and Boss ($650,000).

1 and 2 are the same observation from two sides and either would move the
ladder. 3 would not, because the ratio is what is wrong rather than the number.

### 2026-08-20 — Why there is no legitimate side

The premise was wrong, and the probe said so immediately.

**The first front arrives on day 35**, in eleven careers out of twelve. It is
not late. The 38% of paydays with no front was two different situations added
together, and the giveaway was that they could not both be true: a front bought
on day 35 cannot leave a third of a four-year career without one.

`ownedBusinesses` filters on `status === 'operating'`, and a front that goes
under stays in `state.businesses` as a shuttered record. So "no fronts" meant
"nothing operating", which covers never having bought one *and* having buried
them all. Split apart:

```
never owned one         16% of paydays
buried them all         22% of paydays
bought per career         4
gone under per career     4
```

**Every front a career buys eventually fails.** Four bought, four dead, over
and over for four years. The legitimate side never compounds, which is why
lifetime front revenue is $82,617 and laundering runs at 45% of capacity.

The same reading also condemns the old `median fronts 5` line, which counted
`Object.keys(state.businesses)` — corpses included. It was never five going
concerns.

**What wears them down, per front-week over 3,063 front-weeks:**

```
hostile neighbourhood   -0.87
rivals                  -0.36
city mood               -0.33
leaned on as a laundry  -0.00
                        -----
                        -1.56   against +2.2 recovery
```

Two things about that column.

**Exposure does not bite at all.** The comment at the top of `business.ts`
says the decision is that throughput is what gets a business noticed. It is
the only term the player controls, and it is zero. `exposureFine` is 40 and
nothing reaches it, because the machine runs at 45% and exposure tracks how
hard you leaned rather than how much you moved.

**Recovery is a cliff, not a rate.** `healthPressure` ends
`total < 0 ? total : HEALTH.recoverPerWeek`, so a front under *any* pressure
gets none of the +2.2. A district one point below `sentimentFine` costs a
front its entire recovery. There is no state where a front is slightly
pressured and stable — it is either untouched or dying, and at −1.56 a week
from full health it dies in about fifteen months.

**Sentiment is the thread through all of it.** It is also what blocks the
purchase: of the weeks before a career owns anything, 64% could not cover the
cost and **35% could not find anyone who would sell** — `t.sentiment` under
`SENTIMENT_HOSTILE_BELOW`. And the numbers barely leave room: districts start
at 50, recovery is capped at 50, `sentimentFine` is 45. A district has five
points of headroom before every front in it stops recovering, and being feared
drags it down every week by design (`FEAR.sentimentPerWeekAtMax`).

So the legitimate economy is gated on neighbourhood goodwill at both ends,
goodwill has a ceiling five points above the line that matters, and the one
pressure the player is supposed to manage contributes nothing.

Not yet acted on. The candidates, in the order I would take them:

1. *Make recovery a rate.* `total + recoverPerWeek` rather than the ternary.
   A front under light pressure should hold its ground; only real pressure
   should kill it. This is one line and it changes the whole shape.
2. *Give sentiment headroom.* `SENTIMENT_START` 50 against `sentimentFine` 45
   means the healthy case is the knife edge. Either lift the cap or drop the
   line.
3. *Make exposure matter.* It is the term the player is supposed to trade
   against throughput and it reads -0.00. Until it bites, laundering hard has
   no cost except the cut.

### 2026-08-20 — Recovery as a rate, and two figures I had to withdraw

`healthPressure` now ends `sentiment + exposure + competition + city +
HEALTH.recoverPerWeek` instead of `total < 0 ? total : recoverPerWeek`. A front
under light pressure holds its ground; a front under more than -2.2 a week
still goes under.

The probe now runs **36 careers, not 12**. Twelve was enough for drift terms
averaged over ten thousand crew-weeks. It was never enough for anything counted
once per career, and two of the figures I reported off twelve seeds did not
survive the wider sample.

**Withdrawn: "the first front arrives on day 35, so it is not late."** That was
the median of twelve. At thirty-six it is **day 175**, in 34 of 36 careers. The
first front *is* late. What was correct in that finding is the other half —
fronts die — and it stands.

**Withdrawn: "peak clean now clears the $45,000 Capo bar at $47,657."** Also a
twelve-seed artifact. At thirty-six it is $30,477 against a baseline $28,819.
It does not clear the bar and barely moved.

Both arms at 36 seeds, same twelve-hundred-odd seeds each, nothing else changed:

```
                              cliff      rate
fronts bought / lost         4 / 3      3 / 1
weeks with all fronts dead     20%        0%
weeks never owning one         26%       30%
front clean revenue        $62,353   $94,263    +51%
laundering capacity offered $335,909  $419,961
of which used                  47%       38%
clean money in            $179,921  $193,776
peak clean balance         $28,819   $30,477
Crew Leader                31/36 d323 32/36 d358
Capo                         0/36      0/36
careers ended early          13/36     23/36
median career length          1461      1155
  killed by a rival              3        10
  convicted                      5        10
  broke and alone                5         3
```

**The change did exactly what it was aimed at.** Fronts stop being disposable:
the 20% of paydays spent with every front the player owned already shuttered
goes to zero, and the legitimate side earns half as much again.

**And it gets the boss killed.** Early endings go from 13 to 23 out of 36, and
the median career loses ten months. Rival killings triple and convictions
double. Only "broke and alone" improves, which is the economy working.

That is not divergence. It was 2/12 against 8/12 at twelve seeds and could
have been dismissed as noise; at thirty-six it holds in the same direction with
the same causes.

**The mechanism is the one this whole session keeps arriving at.** A durable
legitimate side makes the player bigger for longer — the bot's hiring refusals
fall from 1645 to 907 and its successful hires rise from 411 to 527. Every
system that reads organizational size reads it as a threat: heat distance,
rival target selection, federal attention. The game punishes growth, and the
top of the ladder requires growth.

**Left in.** The cliff is not defensible on its own terms — there is no reading
of `total < 0 ? total : recoverPerWeek` under which a front one point below
`sentimentFine` should lose its entire recovery. Reverting would restore a
longer career spent owning nothing. But the early-ending jump is real and it is
now the largest known cost of this change, so it is the next thing to measure
rather than something to leave recorded and forgotten.

**One assertion was re-expressed, and it should be visible that it was.**
`careers cannot even leave the bottom rank` read `RUNS.length - 2`, written
when the sample was twelve — "at most two of twelve", 83%. Tripling the sample
would have silently made it 34 of 36 and three times stricter. It now reads
`Math.floor(RUNS.length * (10 / 12))`, which is the share that was meant. The
33/36 that failed against the absolute passes against the share.

### 2026-08-20 — Why being big gets you killed. It does not.

The hypothesis was that rival target selection and federal attention read
organizational size the way `heatDistance` used to read rank. It is wrong, and
the probe says so in one line.

`playerStrength` is `crew × 2.2 × quality`, capped at 100.
`declareWarMinTargetStrength` is 22. Below it a family will not mobilise
against you at all, and at average quality 22 is ten men — which is exactly
`RANKS.capo.requires.crew`. That looked like the mechanism. It is not, because
almost nobody is ever up there.

Both arms, 36 careers, measured weekly:

```
                                    cliff     rate
big enough to be worth attacking      8%       10%
a rival able to declare               3%        4%
at war                                5%        6%
peak player strength                26.4     26.8   (threshold 22)
mean heat                           57.3     61.2
mean open case strength             85.7     86.3   (of 100)
peak open case                     100.0    100.0
careers ended early                 13/36    23/36
```

**The exposure inputs are the same in both arms and the removals doubled.**
Eight per cent against ten, three against four, 85.7 against 86.3. Nothing
there explains 13 becoming 23, so the size story cannot be the mechanism and I
am withdrawing it rather than dressing it up.

**What the instrument found instead is much worse.** The mean strength of the
strongest open case, across every week of every career, is **86 out of 100**,
and the median career peaks at exactly **100**. Split at the first year it is
**72.8 in year one** and 86 thereafter — so it is not something a career grows
into. It is at three-quarters of maximum before the first anniversary and
saturated for the rest.

War is a rare event: a rival can even declare in 4% of weeks, and the player is
at war in 6%. **The law is not an event at all. It is the weather**, and it is
sitting one roll from an indictment permanently, in every career, from month
eight onward.

That also explains the doubling without any change in exposure. When a
quantity is pinned at the top of its range, the thing that decides how many
convictions land is simply how many opportunities to roll occur — and a career
with a durable legitimate side keeps more surfaces in play, including fronts
that survive long enough to keep filing irregular accounts against themselves.
The pressure did not rise. There was more to draw against.

Mean heat is 61.2 against a `heatFearThreshold` of 60 that was raised from 45
this morning, which is worth writing down: the working temperature moved up
with it, and the fear term is on more than half the time again.

**Not acted on.** The finding is one number and it should be looked at on its
own before anything else in this file is: an open case at 86 of 100 for four
years means every piece of counterplay the law system offers — lawyers,
contacts, going quiet, corruption — is being applied to a bar that is already
full. Whether that is a case-growth problem, a case-decay problem, or a
`CASE_CLOSED_BELOW` problem is the next measurement, not a guess to make here.

### 2026-08-20 — Growth, decay, or `CASE_CLOSED_BELOW`. It is growth.

`tickInvestigations` now writes down what it did — `state.law.ledger`, optional
so old saves still load, recording the four terms as it applies them. Same
reasoning as `lastLaunderReport`: a reconstruction from outside would drift
from the code the first time somebody edited it, and this file has been fooled
by exactly that before.

Thirty-six four-year careers, 10,130 case-weeks:

```
what moves a case, per case-week
  evidence coming in        +6.60
  the agency's own work     +2.10
  being visibly loud        +2.33
                            -----
                           +11.03

  decay                     -0.24
```

**Forty-six to one.** That is the answer and it is not close. It is growth, and
it is specifically evidence: 60% of everything that lands on a case is absorbed
traces, which are generated by the player doing the things the game is about.

**`CASE_CLOSED_BELOW` has never fired. Not once, in 457 cases across 36
careers.** The constant is 6, the mechanism is real, and no file has ever
reached it.

**Decay cannot fire either, and the arithmetic says why.** It only runs on a
cold case, and a case goes cold after 35 days with no progress. Progress needs
either fresh evidence or `state.org.heat` above `MOMENTUM_HEAT_FLOOR`, which is
20. Mean career heat is 61. Cases are cold in 13% of weeks and shed 1.8 a week
while they are, which is the -0.24 average. To drain a case from 86 to under 6
would take about forty-five consecutive cold weeks in a game where five in a
row is already unusual.

So the three candidates are not three. Decay and closure are the same
mechanism, that mechanism is gated behind a heat floor the career never goes
under, and the growth term is nine times what it would be able to remove even
if it ran continuously.

**What this means for the counterplay.** Lawyers reduce `evidenceMultiplier`,
which scales *work* — the +2.10 term, a fifth of the inflow. Going quiet
suppresses *visibility* — the +2.33 term. Neither touches the +6.60. The
biggest lever in the law system is aimed at the smallest term, which is why
retaining the best firm in the city does not visibly change anything.

**Not acted on, and this one deserves a design decision rather than a constant
tweak.** The honest options are different in kind:

1. *Let evidence go stale.* `decayEvidence` exists and runs weekly — measure
   what it actually removes before assuming it works, given everything else in
   this file.
2. *Make the heat floor reachable.* `MOMENTUM_HEAT_FLOOR` 20 against a working
   heat of 61 means going quiet is not a thing a career can do. This is the
   heat finding again, arriving from a fourth direction.
3. *Point the counterplay at the big term.* A lawyer who suppresses absorbed
   evidence rather than agency work would be doing what the fiction says a
   lawyer does — getting things excluded.

3 is the one I would take, and 2 is the one that keeps turning up.

### 2026-08-20 — Counsel now keeps evidence out, and it changes nothing

`evidenceMultiplier` now scales absorbed evidence as well as agency work. It is
what the multiplier is named for and what the fiction has always claimed a
defence lawyer does: get things excluded. A contact inside the agency compounds
with it, because somebody who loses paperwork is doing the same job by other
means.

**The probe had to be taught to hire a lawyer first.** The bot had never
retained one, so `evidenceMultiplier` was 1 in every career and the rerun would
have been byte-identical to the baseline with a confident conclusion attached.
Third time this session — the bot that never delegated, the bot that opened
sit-downs and never closed one, and now this.

**Isolated properly: same bot, only the absorption rule toggled.**

```
                          control    treatment
evidence per case-week      +6.69       +6.55
their own work              +2.14       +2.13
being visibly loud          +2.37       +2.36
careers ended early         16/36       17/36
convicted                       5           5
peak clean                $19,771     $19,569
```

**Two per cent. It is inside the noise.** The change is correct and it is
invisible, and the reason is one number:

```
14 weeks a career on retainer, of 145 with a case open
a serious firm: $8,380 a week, against a payroll of $1,373
```

**Counsel costs six times the entire wage bill.** `weeklyLegalCost` multiplies
the agency's `legalCostPerWeek` by `costMultiplier` *per active case*, and
careers carry about two concurrent cases, so a `firm` retainer prices at
roughly 2 × $2,400 × 2.6. A boss paying eight men $1,373 a week is asked
$8,380 to be represented.

The counterplay is not weak. It is priced out of the game by roughly an order
of magnitude, and no adjustment to what it *does* can matter until that is
true.

**One earlier reading corrected.** Teaching the bot to retain counsel halved
convictions in the first run, 10 to 5, and I nearly attributed that to this
change. The control has 5 as well. It came from retaining counsel at all —
`trialBonus` and `sentenceMultiplier` land at trial — and from the world
diverging, not from evidence being excluded.

**Left in.** It is right on its own terms, it costs nothing, and it is the
mechanism that will carry the fix once the price is addressed. But the finding
of this pass is the price, not the mechanism.

Next measurement, and it is a small one: what `legalCostPerWeek` and
`costMultiplier` should be against a payroll that the ladder probe now reports
directly. The per-case multiplication is the part I would look at first — being
investigated by two agencies doubling your legal bill is defensible, but it
compounds with `costMultiplier` and produces the six-times figure above.

### 2026-08-20 — Repricing counsel, and where this pass stops being readable

Two changes, both aimed at the $8,380-against-$1,373 finding.

**Cases no longer compound with the retainer.** `weeklyLegalCost` summed every
active case at full rate and then multiplied the total by `costMultiplier`, so
two agencies did not cost twice as much, they cost twice as much *times* 2.6.
It now charges the worst case in full and `ADDITIONAL_CASE_SHARE` (0.4) of each
of the others. A retainer is a relationship with a firm, not an invoice per
file.

**Agency rates come down.** 900/2200/2600/3000 to 380/900/1050/1250, set
against the payroll the probe reports rather than picked. The target is stated
in the config: `local` is a bill a working boss pays without thinking, `firm`
is a real decision, `best` is the ruinous thing its blurb claims.

```
a serious firm, per week      $8,380 → $6,969 → $2,909
against a payroll of          $1,373   $1,461   $1,536
weeks on retainer, of weeks
  under investigation         14/145   19/140   31/132
mean open case strength         86.3     80.2     79.9
```

**The thing it set out to fix is fixed.** Six times the payroll to 1.9 times,
and a bot that could buy representation in 10% of investigated weeks can now
buy it in 24%.

**Everything downstream of that is not readable at this sample size, and I am
going to say so rather than pick the run I like.** Careers ending early read
17, 19, 23 and 21 out of 36 across the four arms, and "broke and alone" read
4, 5, 7 and 6. Those are 36-sample counts moving by six against mechanical
changes worth a couple of per cent on the aggregates. The stable figures — the
bill, the uptake, the case ledger over ten thousand case-weeks — all move in
the intended direction and none of them are in dispute.

**One thing that looked like a finding and was not.** The jump in bankruptcies
after repricing looked like the price still being wrong. It was partly the
probe's bot: it took `firm` whenever four weeks of it were covered, which is a
boss with $17,000 in the bank signing for $2,909 a week. Given a sane rule —
never pay the lawyer more than the whole crew — bankruptcies went 7 to 6 and
retainer weeks fell from 31 to 15. Both readings are inside the noise, so the
honest statement is that the bot's policy mattered about as much as the price
did, and neither is resolvable at 36 careers.

**The remaining gap is the economy, again.** Even after the cut, a `firm`
against two cases is $2,914 against a $1,501 payroll, so a boss following the
sane rule still cannot retain one. The legal system is priced for an
organization the game does not let anybody build. Cutting further would make
counsel free for the family the player is supposed to become, so it is the
wrong lever, and this is the fifth time today that the answer has been the size
of the operation rather than the system being looked at.

**Where the ladder stands after everything today:** Crew Leader 31/36 around
day 346, Capo 0/36, clean money the furthest requirement in 25 of 36 careers,
peak clean $23,530 against $45,000.

### 2026-08-20 — Making the economy bigger. One change kept, one refuted.

First the number that reframes the whole request:

```
a crew-week earns   $1,054      of which dirty      $959
a crew-week costs     $256          new clean        $95
                                    dirty returning $128
```

**The economy is not small. It is four times profitable per head, and growth
pays for itself.** What is small is the *clean* economy: under a tenth of what
the organization earns is new legitimate money, and every rank above Crew
Leader is gated on clean cash held. The ladder is gated on a tenth of the
economy while the other nine tenths sit in a pool that cannot satisfy it.

**The obvious lever was the wrong one.** `LEGITIMATE_REVENUE_SCALE` is 0.72 and
the note above it records a balance pass where fronts out-earning jobs turned
this into a business simulator with a crime setting. Crime stays the engine.
Front payback is already 20–26 weeks on the catalogue; the sheet is fine.

**Kept: `LAUNDER_CUT_BASE` 0.35 → 0.24.** The engine produces plenty and a
third of it was disappearing on the way to being usable. Loss in the wash falls
from $48,518 to $31,483 a career and peak clean rises from $23,530 to $28,711.
Real, and not enough on its own.

**Refuted, and this is the more useful result: jobs paid only in dirty money.**
Street work in street money, no cheque for a hijacking. It targets the largest
clean sink there is — $87,685 a career, 46% of every clean dollar earned — and
it is the change I proposed, withdrew, and have now actually measured.

It fails `balance.test.ts > lets careful play build a bigger organization`:
careful 1.083 against greedy 1.125. Isolated by reverting only this change,
which restores both failures to passing.

The mechanism is the objection I raised earlier and could not previously
support: a careful boss launders, laundering converts working capital into
clean, and under a dirty-only rule that capital can no longer fund work. The
greedy boss keeps everything dirty and keeps working. The change inverts the
central promise of the game, and a pre-committed test that exists to protect
exactly that promise caught it. Not adjusted, and it should not be.

It also broke `informants.probe > ran enough worlds` at 29 of 30 — an
instrument precondition, and a second signal that fewer jobs run.

**Where the request stands: unmet.** Capo is 0/36. Peak clean $28,711 against
$45,000. `clean money` is the furthest requirement in 28 of 36 careers.

**What would actually meet it, given everything measured today.** The clean
share of the economy has to rise without fronts out-earning crime and without
starving the street of working capital. That rules out the front dial, the
job-payment rule, and cutting the cut any further. What is left is the shape of
the gate rather than the size of the flow:

1. *Gate on what was earned, not what is in the drawer.* A rank that reads
   lifetime clean income — or a high-water mark — would be met by a career that
   demonstrably earned five times it. This is the smallest change that fits
   every measurement in this file and it does not touch the economy at all.
2. *A place to put money that is not the wallet.* Clean cash that has been
   moved somewhere — property, a holding, a bank — counts for rank and cannot
   be reached by the next job. The player chooses to lock it away, which is a
   decision rather than protection, and it answers the objection that a boss
   who never spends clean has it too easy.
3. *Rescale the ladder.* $45,000 / $180,000 / $650,000 against a game where
   $28,711 is the best four years produce. Honest, but it concedes the ladder
   was priced for an economy that was never built.

1 and 2 are the same observation from two sides, exactly as the clean-money
pair was earlier. My recommendation is 2: it makes the hoard a thing the player
builds on purpose.

### 2026-08-20 — A place to put money that is not the wallet. Capo appears.

`state.org.holdings` (optional, so old saves load holding nothing), `putAway`
and `takeBack` in `economy.ts`, `cleanWorth` read by the one place that decides
rank, `HOLDINGS` in config, a `Put away` panel in Finances, and seven tests.

The trade, stated in the tests rather than in prose: it counts for rank, it
pays for nothing, and it comes back at 85%. A boss who banks his Capo money
cannot also spend it on the lawyer who keeps his underboss out of prison, and
selling in a hurry is not selling well.

**Capo 2/36, median day 708.** The first time it has appeared at this sample
size in this project. Peak clean worth $31,582 against $30,450 in the wallet
alone.

**The first bot policy was worse than not having the mechanic**, and the
failure is worth keeping because it is a real property of the design rather
than a coding mistake. Keeping six weeks of bills liquid and banking the rest
gave:

```
                        no holdings   bank the surplus   invest first
peak clean worth          $28,711         $22,755          $31,582
clean spent on fronts      $3,385            $507           $2,900+
put away / sold back            —   $39,586 / $30,390  $18,815 / $13,257
Capo                         0/36            0/36             2/36
```

Banking the surplus starved front acquisition — and fronts are the only source
of new clean money there is — while churning $30,390 back out at a 15% haircut
each way. The deposit was eating the thing that fills it.

The rule that works keeps the cheapest front's price liquid as well as the
bills: **invest before you bank**. That is a genuine strategic statement about
this economy and it should probably be said to the player somewhere, because a
new boss will make exactly the first mistake.

**Still churning, and it is the bot.** $13,257 of $18,815 comes back, because
the bot spends its wallet to zero on jobs and then has to sell. A player who
kept a float would lose less. The mechanic does not need changing for that.

**Where the ladder stands.** Crew Leader 33/36 around day 316, Capo 2/36 at day
708, Underboss and above 0/36. Peak clean worth $31,582 against $45,000, so the
two who made it did so by banking steadily rather than by earning more.

**552 tests pass, and the build is clean.** The panel is written and typechecks
but has not been looked at in a browser — that needs the sandbox save backed up
first, and it is the one part of this that is not verified.

### 2026-08-20 — Round 7's confirmed list, fixed

Five things, all verified against the code before anything was touched. Two of
the three MUST FIX items held completely, one split.

**Zero-crew jobs stacked without limit.** `canLaunch` limits work by occupying
people, and `work_it_yourself` needs zero people, so nothing was ever occupied
and it could be launched as many times as the player had patience for.
Unlimited income capped only by attention. Guarded in `canLaunch` now, with
four tests in `reach.test.ts`.

The uncomfortable part: `floor.probe`, `ladder.probe` and `spread.probe` all
carried the line `if (def.crewRequired === 0 && activeOperations.length > 0)
continue;`, one of them under the comment "One solo job at a time — there is
only one of you." The rule was understood well enough to be written into three
bots and never put in the game. The two decorative copies are removed;
`floor.probe` keeps its because its `why` accounting reads it, and now says so.

**Actions were live on a man in a cell.** Every guard was written against
`isFormerCrew`, which covers dead, defected and boss — being arrested is none
of those. Added `isOutOfReach` in `npc.ts` and pointed `canPromote`, `canRaise`
and `canSitDownWith` at it. He stays on the crew sheet, which is deliberate and
asserted: unreachable is not gone.

The first version of that guard rejected any id it could not find in
`state.npcs` and broke both rival sit-downs, because `canSitDownWith` is also
the gate for sitting down with a *house*, which passes a faction id. Caught by
two existing tests within a minute.

**The front header quoted the wrong number.** `shortfalls` was built from
options that are refused *and* cost more than you hold, so a front you can
afford but which is blocked on the district fell out of the filter and the page
quoted the distance to the next item up the list. The tester sat on $10,800 in
front of a $10,300 laundromat and was told they were $4,826 short. The header
now names the actual refusal when the cheapest blocked front is one you could
pay for.

**And the gate it was hiding is now labelled.** District sentiment under
`SENTIMENT_HOSTILE_BELOW` means nobody sells you anything at any price. The row
was a bare integer. It now carries the threshold and what moves it — the same
mechanic the probe measured this morning as blocking 35–45% of every week
before a career's first front. Two instruments, one from a script and one from
the chair, on the same number.

**"Street heat falls fast" was true and unqualified.** `decayMultiplier` runs
1.0 when Quiet to 0.32 Under Siege, deliberately, so that nobody idles out of
an eighty. The tooltip promised the opposite to a player at ninety-eight. It
now names the tier and the actual rate. The mechanic is unchanged.

The tester's second claim on that item — that heat is an inescapable trap
because world events outpace decay — does not survive their own disclosure.
They measured days 150–175 while a script auto-answered memos, and one of its
picks was a violent option that adds heat. Recorded as unproven rather than
refuted.

**The advance button lied during a sit-down.** `step()` guards on a memo and on
an open conversation; only the memo had a disabled button. The control now
matches the guard.

**561 tests pass, build clean.** The ladder probe is unmoved by removing the
bot workarounds: Crew Leader 33/36, Capo 1/36, peak clean worth $30,972 —
within the noise of the 2/36 recorded before, and the sample is too small to
distinguish them.

### 2026-08-20 — Twenty years, to settle whether the ladder is slow or stuck

The question was whether to scale the economy so the top rank is reachable.
The ladder probe was built to tell those two cases apart, so it was asked
instead of argued with: same 36 careers, `DAYS` raised from 1,460 to 7,300.

```
                      4 years        20 years
Crew Leader        33/36 d330      33/36 d330
Capo                1/36 d673       1/36 d673
Underboss                0/36            0/36
clean money in       $191,222        $271,189
peak clean worth      $30,972         $39,867
careers ended early     23/36           35/36
median career length  ~1,300 days     1,358 days
```

**Sixteen extra years bought $80,000 and no ranks at all.** Identical rungs on
identical days. That is this file's own definition of stuck rather than slow.

**And the reason is not the economy.** 35 of 36 careers end early and the
median career lasts **1,358 days** — under four years. The twenty-year window
is not being played. Careers are removed at three and a half years and the
extra sixteen belong to the one that lasted.

Cause of death across the long run: **killed by a rival 16, convicted 13, broke
and alone 6.** Only six of thirty-five ran out of money. Twenty-nine were taken
off the board.

**So scaling the economy is the wrong first move, and the numbers say so
rather than my judgement.** Crime Lord wants $2,500,000 held and 42 people
against a career that holds $39,867 and six — but multiplying the economy by
eighty would only mean dying rich at day 1,358. Every downstream number tuned
today against a $1,600 payroll — lawyers, front prices, loan ceilings, event
costs — would have to be re-tuned against a moving target, to reach a rung no
career survives to approach.

**The binding constraint is career length.** Nothing above Capo can be assessed
until a career can run long enough to be assessed, and at present none does.

Two things follow, in this order:

1. *Find out what a career is supposed to be.* Crime Lord at 42 crew and $2.5M
   describes a decades-long dynasty; the game currently produces a three-year
   run ending in a shooting. Succession exists precisely so an organization
   outlives a boss — 29 of 35 removals had an heir path available and the run
   still stopped, which is worth measuring on its own before anything else.
2. *Then the economy, sized to that answer.* If the intended arc is four
   years, the top three ranks are priced wrong. If it is thirty, the economy is
   priced wrong. The same measurement decides which, and doing the economy
   first commits to an answer nobody has chosen.

### 2026-08-20 — Both: a boss's rise and fall, and something that outlives him

The design answer changes what the ladder is for, so the probe was corrected
before anything was concluded from it.

**The bot had never named an heir. Not once, in any run this file has
produced.** `removePlayer` only ends the game when there is nobody to hand to,
so every previous statement here about how long an organization lasts was a
statement about a boss who died without a will. Fifth time this session the
probe could not perform the thing it was measuring.

Taught it to keep the most senior available person named, and rename when that
person is gone:

```
                          no heir      heir named
careers ended early         23/36           16/36
median career length     ~1,300 d        1,461 d  (the whole run)
handovers                       0     18 across 16/36 organizations
heirs named                     0        200 in all
Capo                    1/36 d673       1/36 d1177
```

**The family does outlive the boss.** Sixteen organizations in thirty-six lost
a boss and carried on, eighteen times between them, and the median organization
now survives the full four years instead of dying at three and a half.

**And it does not grow. It shrinks.** Capo now arrives on day 1,177 instead of
673 — succession made the ladder *slower*, because every handover is a haircut
on precisely the things rank is gated on:

```
respect kept     45%
clean cash       70%
dirty cash       55%
influence        78%
case strength    40%   (the one that helps)
ranks lost        1    the new boss starts a rung below
```

A rung lost every two or three years against a rung gained every three is not
a dynasty, it is a treadmill. The organization persists and never compounds,
which is exactly half of what the design asks for.

**The mechanic that closes the gap already exists and was built this morning
for another reason.** `state.org.holdings` is the only thing a handover does
not touch — `succession.ts` scales respect, clean cash and dirty cash, and
never mentions it. Money put away deliberately passes whole to the next boss
while everything else takes its cut.

That is the shape the design wants, stated in one sentence: **what you spend
dies with you, what you put away is what you leave behind.** It makes the
holdings decision generational rather than merely a rank gate, it gives the
successor a floor to build from, and it is already true in the code.

What is not decided, and is a design call rather than a measurement:

1. *Should `ranksLost: 1` stand?* It is dramatically right and mathematically
   fatal at the current pace. If it stands, the rungs above Capo have to be
   reachable within one boss's run, which they are not.
2. *Should the top of the ladder be personal at all?* Crime Lord at 42 crew and
   $2.5M reads as what a family becomes, not what a man reaches. An
   organizational tier that survives handovers whole — measured on holdings,
   districts and fronts rather than on the boss's respect — would let the thing
   the player leaves behind be the thing that keeps score.

### 2026-08-20 — Both halves, built

Two decisions, both taken, both measured.

**A rung is lost only by a boss who left no plan.** `resolveSuccession` reads
the named heir *before* the handover clears it, and keeps the rank when that
man is the one who takes the chair. Somebody seizing it over your written
intention is not your plan holding, and still costs a rung. `inheritRank` stays
exported so the succession panel can show what is at stake.

**The rank table reads what the family has ever managed.** `state.org.record`
keeps high-water marks for respect, crew, clean worth and districts, and a
running total for operations — optional, so old saves start keeping one the day
they load. A handover never touches it.

Operations accumulate rather than peak, and that distinction is the whole
mechanism: `player.opsCompleted` is replaced by the successor's own count at a
handover, so a plain maximum would freeze the family total the moment a long
record was replaced by a short one. Tracking the last value seen and adding
only the increase makes the total belong to the organization.

**It fires. 18 handovers held the rank, 1 lost it.** Worth stating because a
conditional nobody satisfies is the same as a conditional nobody wrote, and
this file has five instances today of exactly that.

```
                        heir named,      heir named,
                        rank always      rank kept when
                        lost             the plan held
Crew Leader             35/36 d351       36/36 d200
Capo                     1/36 d1177            0/36
careers ended early          16/36            16/36
handovers                       18     19 across 14/36
peak clean worth           $26,005          $21,481
```

**Everyone now reaches Crew Leader, 150 days sooner.** The record does the work
at rungs whose requirement sits below what the family has already touched —
Crew Leader wants $9,000 clean and every family passes through that figure at
some point, even if it does not hold it.

**And Capo went from 1 to 0, which is not a regression to chase.** One career
in thirty-six either way is noise, and the mechanism says why it cannot help
there: Capo wants $45,000 and the highest clean worth any family ever reaches
is $21,481. A high-water mark cannot remember a peak that never happened. The
top of the ladder is still gated on a figure the economy does not produce,
which is the finding from this morning and is untouched by any of this.

**What this did and did not buy.** The family now keeps its position through a
handover, so succession stopped being a treadmill — that was the stated
problem and it is solved. It did not make the top ranks reachable, and was
never going to: those need the economy question answered, and that question now
has a shape it did not have this morning, because the thing that survives a
boss whole is holdings, and holdings are the only clean money in the game that
compounds rather than being spent.

568 tests pass, build clean.

### 2026-08-20 — Trying to widen the clean share

Only $77 of every $1,073 a crew-week earns is new clean money, and rank counts
clean and nothing else. Three attempts, one useful result, one invalid
experiment I have to withdraw, and one change reverted by a test.

**Withdrawn: "holding dirty back does not raise laundering."** The first
version of that experiment subtracted the reserve from `totalFunds` — clean
plus dirty — and `spend` draws dirty first whatever the budget says. The dirty
pile was never protected. It reported no effect, which was a statement about a
reserve that did not exist. Same class of fault as every other instrument
failure in this file, and it very nearly closed off the one thing that worked.

**Reserving the dirty properly is worth 16%.** Holding back one week of
laundering capacity before launching any job:

```
                        spend it all    hold a week back
peak clean worth            $21,481             $24,908
laundered per career       $145,587            $135,709
clean money in             $184,077            $179,391
```

Laundering *volume* falls, because fewer jobs run and less dirty is earned.
What rises is the part that matters — the clean the family actually holds.

**And it is a strategy, not a fix.** This is a change to the probe's bot, not
to the game. It says a player who keeps working capital dirty for the fronts
does 16% better on the only currency rank reads, and the game never says so,
never shows the trade, and gives no control for it. `launderOutlook` already
computes `heldBack` for the wage bill; the player-facing version of this
finding is letting them see and set the rest.

Kept at `WASH_RESERVE = 1` because a competent player would do it, which shifts
the baseline for every measurement in this file taken after today. Said loudly
here rather than discovered later.

**Reverted: `SENTIMENT_START` 50 → 65.** The band is genuinely too tight —
districts start at 50, recovery caps at 50, and fronts start dying below 45 —
but widening it there was the wrong place. `deep.test.ts` asserts that a
district worked hard loses population, and at 65 Little Sicily held above its
founding figure through the exact treatment the test applies. Population
follows sentiment, so lifting the floor under one lifts it under the
consequence, and strip-mining a neighbourhood is one of the few mechanics a
blind tester has ever said landed. The pre-committed test is the finding and
was not adjusted.

It also bought nothing: laundering per career *fell* to $134,623. The gain that
run appeared to show belonged to the reserve, measured at the same time — two
variables in one reading, which is a mistake this file has made before.

`HEALTH.sentimentFine` at 45 is the untried version: it decides whether a front
survives without touching where people live.

**Where the clean share stands: still not close.** Peak clean worth $24,908
against a $45,000 Capo requirement. 16% was a real gain and the gap is 80%.
Nothing tried today moves the top of the ladder, and the reason has not changed
since this morning — the legitimate side is a tenth of an economy that is
otherwise healthy, and no rate applied to a tenth produces a whole.

568 tests pass.

---

## Survival and the ladder - moved out

The four investigations that followed this plan (survival, and three passes at
making Boss reachable) grew longer than the plan itself and are findings rather
than tasks. They now live in
`docs/findings/2026-08-20-survival-and-the-ladder.md`.
