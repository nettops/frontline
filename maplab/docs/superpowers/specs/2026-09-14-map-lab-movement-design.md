# Map Lab — movement pass (Phase 2) design

## Why

Phase 1 and 1.5 proved the data model and the isometric renderer, but everything in the
scene is static — furniture and people sit where they spawn. This phase adds real-time
movement inside the Map Lab sandbox: a controllable avatar and wandering NPCs, walking
the same collision/nav data Phase 1 already derives. It exists to prove the tech, not to
ship a feature — see Scope boundary.

## Scope boundary

Map Lab only. Nothing here connects to Frontline's actual sim (`src/sim/`) or its UI —
there is no player-position concept anywhere in the sim today, and this phase does not
add one. Walking into a room triggers nothing. Whether/how movement ever reaches the
real game is a separate, later decision.

`src/map/types.ts`, `src/map/grid.ts`, `src/map/restaurant.ts` do not change — same
invariant as Phase 1.5. The data this phase needs already exists:
`SpawnPoint.kind: 'player' | 'npc'` and each NPC's `roomId` (`restaurant.ts:94-99`), and
`findPath`/`buildWalkGrid` (`grid.ts`) are consumed unchanged.

## Architecture

Two new pure modules, no Pixi/DOM — same convention as `iso.ts`/`grid.ts`:

```ts
// src/render/movement.ts
export type Facing = 'N' | 'E' | 'S' | 'W';

export interface MoveState {
  x: number;       // fractional cell coords, mid-walk
  y: number;
  facing: Facing;
  done: boolean;    // true once the path is fully walked
}

/** Walks `path` (a findPath() result) at `speedCellsPerSec`, returning the
    interpolated position/facing at `elapsedMs` since the walk started. */
export function stepAlongPath(
  path: Point[],
  elapsedMs: number,
  speedCellsPerSec: number,
): MoveState;
```

```ts
// src/render/wander.ts
/** Picks a random reachable cell inside `roomId`, excluding `currentCell`.
    Returns null if the room has nowhere else to go (NPC stays put — not an error). */
export function pickWanderTarget(
  map: MapDef,
  roomId: string,
  currentCell: Point,
  rng: () => number,
): Point | null;
```

Everything else is additive to `PixiStage.tsx`:

- A Move/Inspect mode toggle (new small UI control in the side panel, alongside
  `LayerToggles`).
- A per-frame update, folded into the existing `requestAnimationFrame` ambient-motion
  loop (the one already driving stove flicker and idle sway): for the player avatar and
  each of the 4 NPCs, advance an active path through `stepAlongPath`, update the
  sprite's screen position (`cellToScreen` + `heightOffset`, same as every other
  entity) and texture (facing).
- NPC wander scheduling: on spawn and whenever an NPC's path completes, pause a
  randomized beat (1–3s), then call `pickWanderTarget` + `findPath` for the next walk.

Default walk speed: 3 cells/sec for both the avatar and NPCs — a tunable constant in
`movement.ts`, not a hardcoded literal scattered across call sites.

## Interaction

- **Inspect mode** (default): unchanged from Phase 1.5 — click selects object/spawn/room.
- **Move mode:** click a walkable cell → `findPath(map, avatarCell, targetCell)`. A
  `null` result (wall, object, unreachable) is a no-op — no error, no feedback beyond
  "nothing happened," matching how invalid clicks already behave elsewhere in Map Lab.
  Clicking again while the avatar is mid-walk re-targets from its current (floored)
  cell, discarding the old path.
- One click always means one thing — the toggle, not a modifier key, decides which.

## Sprites

`isoSprites.ts` gains one new drawn row-string per person palette variant: a
"facing-away" (north-ish) sprite, alongside the existing "facing-camera" (south-ish)
one. East and west reuse those two sprites horizontally flipped
(`sprite.scale.x = -1`) — 2 drawn assets cover all 4 grid directions, the same
mirroring convention Habbo itself uses. Facing comes straight from `MoveState.facing`;
an idle (non-moving) entity keeps its last facing.

## Depth sort

No changes to the depth-sort mechanism itself (`entities` `RenderLayer`, `zIndex =
floor(x)+floor(y)`, both fixed and re-verified in Phase 1.5's final review). Moving
entities simply feed live `x`/`y` into the same key every frame instead of a fixed
spawn position — the sort already recomputes from current position, so walking through
a doorway resorts correctly for free.

## Testing

`movement.ts` and `wander.ts` are pure — fully Vitest-covered: path interpolation at
various `elapsedMs` (start, mid-step, past the end), facing derivation for all 4
directions, `pickWanderTarget`'s "nowhere to go" case, and a round-trip sanity check
against `findPath`'s existing test fixtures. `PixiStage`'s mode toggle, click routing,
and per-frame sprite updates are screenshot-verified in the running browser, same
convention as every other Phase 1.5 overlay — no new Pixi/DOM tests, by design.

## Explicit non-goals

No sim/gameplay wiring of any kind. No collision between moving entities (NPCs and the
avatar may visually overlap — cosmetic only). No diagonal movement (the grid is
4-directional, per `grid.ts`). No multi-floor. Still Map Lab only, not the real game.

## Done means

- `npm test` still green, plus new passing tests for `movement.ts` and `wander.ts`.
- Click-to-move works: valid clicks path and walk the avatar; invalid clicks no-op;
  re-clicking mid-walk retargets.
- All 4 NPCs wander their own rooms continuously, never crash on a dead-end room.
- Avatar and NPCs visibly face the direction they're walking (4-directional, mirrored).
- Depth sort stays correct while entities move (screenshot-verified crossing a doorway).
- Mode toggle cleanly separates Move and Inspect — Phase 1.5's inspect/select behavior
  is unchanged in Inspect mode.
