# Map Lab — isometric render pass (Phase 1.5) design

## Why

Phase 1's top-down renderer proved the data model, the dev tool, and the workflow, but
it reads as a flat blueprint, not a place. Reference: Habbo Hotel (true isometric —
diamond-tiled floor, angled walls, furniture/avatars with real depth) and Tiny Tower
(not isometric, but chunky saturated characters and instantly-readable per-space
identity). Decision: go isometric, matching Habbo's projection; borrow Tiny Tower's
character/palette sensibility for content.

## Scope boundary

This is a render-layer replacement only. `src/map/types.ts`, `src/map/grid.ts`,
`src/map/restaurant.ts` do not change — collision, nav, reachability, and all 18
existing tests stay green throughout. Only `src/render/*` and `src/lab/*` change.
Still no player movement, no mechanics wiring, no multi-floor — those non-goals from
the Phase 1 spec still hold.

## Projection

New module `src/render/iso.ts`, pure functions, no Pixi/DOM:

```ts
export const TILE_W = 64;   // px, full diamond width at scale 1
export const TILE_H = 32;   // px, full diamond height at scale 1 (2:1 ratio)
export const HEIGHT_PX = 20; // px per 1.0 unit of MapObject/wall height

export interface ScreenPoint { x: number; y: number }

/** Cell (and optional fractional sub-cell) coordinates to screen-space pixels,
    before height/camera transforms. */
export function cellToScreen(cx: number, cy: number): ScreenPoint {
  return { x: (cx - cy) * (TILE_W / 2), y: (cx + cy) * (TILE_H / 2) };
}

/** Inverse of cellToScreen — screen pixels back to fractional cell coordinates.
    Callers that need an integer cell (e.g. click-to-select) floor the result. */
export function screenToCell(sx: number, sy: number): { x: number; y: number } {
  const cx = sx / TILE_W + sy / TILE_H;
  const cy = sy / TILE_H - sx / TILE_W;
  return { x: cx, y: cy };
}

/** How far up-screen (negative y) a given height value lifts a sprite. */
export function heightOffset(height: number): number {
  return -height * HEIGHT_PX;
}
```

`cellToScreen`/`screenToCell` are exact inverses by construction — verified by a
round-trip test (`screenToCell(cellToScreen(cx, cy).x, cellToScreen(cx, cy).y)` ≈
`{cx, cy}`, for several representative points including negative and fractional
coordinates).

## Bounds

`mapPixelBounds(map)` (in `layers.ts`) changes from the simple `cols*cellSize ×
rows*cellSize` rectangle to the bounding box of the map's iso-transformed footprint:
transform all four corners of the cell grid `(0,0)`, `(cols,0)`, `(cols,rows)`,
`(0,rows)` through `cellToScreen`, take the min/max x and y. `camera.ts` itself
(`fitTransform`, `clampZoom`) does not change — it already just fits an arbitrary
`Bounds` rectangle, and this is still a rectangle, just a different one.

## Walls

Only `wall`- and `door`-kind edges on the **N** and **W** sides of a room's footprint
are drawn (the two faces "behind" the room from this camera angle) — a deliberate,
genre-standard simplification: the room stays open toward the camera so its interior
is always visible. S/E-side edges exist in the data (collision still respects them)
but are never rendered. Each drawn wall edge becomes a filled quad (a `Graphics`
polygon): the cell edge's two ground-level corners (via `cellToScreen`), lifted by
`heightOffset(WALL_HEIGHT)` for the top two corners. A `door`-kind edge gets a visible
gap (rendered shorter, or with a door-colored inset) rather than a solid plane.

## Depth sort

Painter's algorithm: every drawable (floor diamond, wall quad, furniture sprite,
person sprite) gets a sort key of `cx + cy` from its own base cell (the room's cell
for floor/walls, `Math.floor(x) + Math.floor(y)` for objects/spawns), ascending. Ties
(rare — two objects sharing a base cell) break on insertion order. This is the
standard painter's-algorithm order for this projection and needs no per-frame
z-buffering.

## Overlays (rework, not replace)

- **Grid / collision:** per-cell diamond (4 points via `cellToScreen`) instead of a
  square.
- **Navigation:** lines between adjacent walkable cells' iso-transformed centers
  instead of square-cell centers.
- **Room bounds:** the iso-transformed bounding diamond of the room's axis-aligned
  cell bounding box (its 4 corners through `cellToScreen`) — an approximation for
  non-rectangular rooms, same convention most isometric editors use for bounds
  highlighting. `ponytail: bounding-diamond approximation, not a true room-shape
  polygon — revisit if a future room shape makes this visibly wrong.`
- **Spawns:** unchanged in kind (a small marker), repositioned via `cellToScreen` +
  `heightOffset`.

## Picking / selection

Object and spawn sprites keep native Pixi hit-testing (`eventMode: 'static'` +
`mapEntity` tag) — unaffected by projection, since Pixi hit-tests each sprite's own
screen position regardless of how that position was computed. The stage-level
room-selection fallback and the status-bar coordinate readout both need the cursor's
local (world-space) point run through `screenToCell` (floored) instead of the old
`Math.floor(local.x / cellSize)` division.

## Furniture / person sprites

New module `src/render/isoSprites.ts`, same row-string + palette technique as the
game's existing `src/ui/art/*.ts`, but each sprite is authored as an isometric 3/4-view
silhouette (showing a top face and one or two side faces), not a top-down shape — these
are visually a different craft from the existing top-down street sprites and cannot be
copied from them directly. Covers: dining table+chairs, bar counter, stove, prep
counter, staff lockers, back-room desk, host stand, and one standing-person sprite (for
all 5 spawns, palette-varied per spawn the way the street's pedestrians are).

This is the one part of this phase that is genuinely hard to get right without looking
at it — plan for at least one iteration pass (build → run Map Lab → screenshot →
adjust) rather than expecting first-shot correctness.

## Ambient motion

Carried over from the original ask, unchanged in spirit: 2–3 flicker/glow accents
(stove, a candlelit table or two) and a subtle idle animation on the standing person
sprites (blink/sway, not walking). Same `requestAnimationFrame` +
`prefers-reduced-motion` pattern as `StreetScene` — motion never carries information a
panel doesn't already have, and stops entirely under reduced motion.

## Explicit non-goals (still true)

No player movement, no mechanics wiring, no multi-floor, no true room-shape polygon for
bounds (bounding-diamond approximation is enough), no lighting/shader system beyond the
flicker accents above.

## Done means

- `npm test` still 18/18 (no map/data test changes expected).
- `cellToScreen`/`screenToCell` round-trip verified by test.
- The restaurant renders isometrically: diamond floor, angled N/W walls with visible
  doors, depth-sorted furniture and people, all 8 existing overlays working in the new
  projection (screenshot-verified in a running browser, not just type-checked).
- Click-to-select (object, spawn, and room-via-empty-floor) still works.
- Pan/zoom/reset/frame-selected still work.
