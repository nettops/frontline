# Map Lab isometric render pass (Phase 1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Map Lab's top-down renderer with an isometric one (Habbo-style projection, Tiny-Tower-influenced character/palette), per `docs/superpowers/specs/2026-09-14-isometric-render-design.md`, without touching the map data model or any of its 18 existing tests.

**Architecture:** A new pure `src/render/iso.ts` provides the cell↔screen projection. `layers.ts` is rewritten to build floor diamonds, N/W-only angled walls, and depth-sorted furniture/spawn sprites through it — same `MapLayers`/`buildMapLayers`/`mapPixelBounds` public shape Task 6 of the original plan already consumes, so `PixiStage.tsx` only changes where it converts screen↔cell itself (picking, status bar, frame-selected). Furniture/person art and ambient motion land last, on top of a working, geometrically-correct skeleton.

## Global Constraints

- `src/map/types.ts`, `src/map/grid.ts`, `src/map/restaurant.ts` do not change. All 18 existing tests stay green throughout every task.
- Work continues on branch `map-lab-impl` in the existing worktree — no new worktree, no new dependency.
- `MapLayers`, `buildMapLayers(map, grid)`, `mapPixelBounds(map)` keep their existing signatures (defined in `src/render/layers.ts`) — only their internals change.
- No player movement, no mechanics wiring, no multi-floor, no shader/lighting system beyond the flicker accents in Task 5.
- Windows 11, PowerShell 5.1 primary shell; commands below are plain `npm`/`npx`, run the same from PowerShell or Git Bash.

---

### Task 1: Isometric projection math

**Files:**
- Create: `maplab/src/render/iso.ts`
- Test: `maplab/src/render/__tests__/iso.test.ts`

**Interfaces:**
- Produces (for Tasks 2, 3): `TILE_W = 64`, `TILE_H = 32`, `HEIGHT_PX = 20` (constants), `ScreenPoint { x: number; y: number }`, `cellToScreen(cx: number, cy: number): ScreenPoint`, `screenToCell(sx: number, sy: number): { x: number; y: number }` (fractional — callers floor as needed), `heightOffset(height: number): number`.

- [ ] **Step 1: Write the failing test — `src/render/__tests__/iso.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { cellToScreen, screenToCell, heightOffset, TILE_W, TILE_H, HEIGHT_PX } from '../iso';

describe('cellToScreen', () => {
  it('places the origin cell at the screen origin', () => {
    expect(cellToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('moves right and down as cx increases', () => {
    const p = cellToScreen(1, 0);
    expect(p.x).toBe(TILE_W / 2);
    expect(p.y).toBe(TILE_H / 2);
  });

  it('moves left and down as cy increases', () => {
    const p = cellToScreen(0, 1);
    expect(p.x).toBe(-TILE_W / 2);
    expect(p.y).toBe(TILE_H / 2);
  });
});

describe('screenToCell', () => {
  it('is the exact inverse of cellToScreen', () => {
    const cases: [number, number][] = [[0, 0], [5, 3], [-2, 7], [1.5, 2.25], [10, 10]];
    for (const [cx, cy] of cases) {
      const p = cellToScreen(cx, cy);
      const back = screenToCell(p.x, p.y);
      expect(back.x).toBeCloseTo(cx);
      expect(back.y).toBeCloseTo(cy);
    }
  });
});

describe('heightOffset', () => {
  it('lifts a sprite up-screen (negative y) proportional to height', () => {
    expect(heightOffset(0)).toBe(0);
    expect(heightOffset(1)).toBe(-HEIGHT_PX);
    expect(heightOffset(2)).toBe(-HEIGHT_PX * 2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/__tests__/iso.test.ts`
Expected: FAIL — `../iso` does not exist.

- [ ] **Step 3: Write `src/render/iso.ts`**

```ts
/**
 * Cell <-> screen projection for the isometric renderer. Pure math, no
 * Pixi/DOM — the same separation `camera.ts` already keeps.
 *
 * 2:1 diamond-tile projection (the Habbo/RTS convention): moving one cell in
 * +x goes right-and-down on screen, moving one cell in +y goes left-and-down.
 * `screenToCell` is the algebraic inverse of `cellToScreen`.
 */

export const TILE_W = 64;
export const TILE_H = 32;
/** Screen px lifted per 1.0 unit of MapObject/wall height. */
export const HEIGHT_PX = 20;

export interface ScreenPoint {
  x: number;
  y: number;
}

export function cellToScreen(cx: number, cy: number): ScreenPoint {
  return { x: (cx - cy) * (TILE_W / 2), y: (cx + cy) * (TILE_H / 2) };
}

export function screenToCell(sx: number, sy: number): { x: number; y: number } {
  const cx = sx / TILE_W + sy / TILE_H;
  const cy = sy / TILE_H - sx / TILE_W;
  return { x: cx, y: cy };
}

/** Negative y = up-screen, so taller things draw higher. */
export function heightOffset(height: number): number {
  return -height * HEIGHT_PX;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/render/__tests__/iso.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Put the fault back, confirm the test catches it, restore**

Temporarily swap the sign in `heightOffset` (`return height * HEIGHT_PX;`). Run the test again — expected: "lifts a sprite up-screen" FAILS (`heightOffset(1)` returns `20`, not `-20`). Restore the minus sign.

- [ ] **Step 6: Full suite check and commit**

Run: `npm test` — expected 18 pre-existing + 5 new = 23 passing.

```bash
git add maplab/src/render/iso.ts maplab/src/render/__tests__/iso.test.ts
git commit -m "Map Lab: isometric cell<->screen projection math"
```

---

### Task 2: Isometric floor, walls, and placeholder furniture/spawns

**Files:**
- Modify: `maplab/src/render/layers.ts` (rewrite floor/wall/object/spawn construction; keep `MapLayers`, `buildMapLayers`, `mapPixelBounds`, `SelectableGraphics` exports)
- Modify: `maplab/src/render/palette.ts` (add wall-height and floor-shade constants if needed)

**Interfaces:**
- Consumes: `cellToScreen`, `heightOffset`, `TILE_W`, `TILE_H` from `./iso`; unchanged `MapDef`/`RoomDef`/`WallEdge`/`MapObject`/`SpawnPoint` from `../map/types`; unchanged `WalkGrid` from `../map/grid`.
- Produces (for Task 3): same `MapLayers` shape as before (`world, floor, walls, objects, grid, collision, nav, roomBounds, spawns`), same `mapPixelBounds(map): Bounds` name/shape but now returning the iso-transformed bounding box (see design doc's "Bounds" section) instead of the old `cols*cellSize × rows*cellSize` rectangle.

No dedicated automated test (Pixi-runtime code, same as the original `layers.ts` had none) — verified visually in Task 6. Build this task with **placeholder shapes** for furniture and spawns (colored `Graphics` polygons sized to footprint, NOT real art yet — Task 4 replaces them) so the projection/depth-sort geometry can be checked before any art is written.

- [ ] **Step 1: Rewrite `mapPixelBounds`**

```ts
export function mapPixelBounds(map: MapDef): Bounds {
  const corners = [
    cellToScreen(0, 0),
    cellToScreen(map.grid.cols, 0),
    cellToScreen(map.grid.cols, map.grid.rows),
    cellToScreen(0, map.grid.rows),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
```

- [ ] **Step 2: Rewrite the floor**

Replace the per-cell `g.rect(...)` floor loop with a per-cell diamond, still colored by `ROOM_COLORS[cellRoomIndex(...)]`/`cellRoomKind`, using the existing `cellRoomIndex` helper from `../map/grid` (already used in the current `layers.ts` — keep that import). For a cell at `(c, r)`, its diamond's four corners are `cellToScreen(c, r)`, `cellToScreen(c + 1, r)`, `cellToScreen(c + 1, r + 1)`, `cellToScreen(c, r + 1)`:

```ts
for (let r = 0; r < map.grid.rows; r++) {
  for (let c = 0; c < map.grid.cols; c++) {
    if (map.cells[r][c] !== 'floor') continue;
    const room = roomIndex.get(`${c},${r}`);
    const color = room ? ROOM_COLORS[room.kind] : VOID_COLOR;
    const p0 = cellToScreen(c, r);
    const p1 = cellToScreen(c + 1, r);
    const p2 = cellToScreen(c + 1, r + 1);
    const p3 = cellToScreen(c, r + 1);
    const g = new Graphics();
    g.poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]).fill(color);
    floor.addChild(g);
  }
}
```

(`roomIndex = cellRoomIndex(map)`, computed once before this loop, replacing the old per-cell `roomKindAt` lookup — same pattern the final Phase 1 review already established.)

- [ ] **Step 3: Rewrite walls — only N and W edges**

```ts
const WALL_HEIGHT = 3; // world-height units, tall enough to read as a wall

for (const wall of map.walls) {
  if (wall.side !== 'N' && wall.side !== 'W') continue; // only the two visible faces
  const [c, r] = wall.cell;
  // Ground-level endpoints of this cell edge.
  const a = wall.side === 'N' ? cellToScreen(c, r) : cellToScreen(c, r);
  const b = wall.side === 'N' ? cellToScreen(c + 1, r) : cellToScreen(c, r + 1);
  const lift = heightOffset(wall.kind === 'door' ? WALL_HEIGHT * 0.4 : WALL_HEIGHT);
  const color = wall.kind === 'wall' ? WALL_COLOR : wall.kind === 'door' ? DOOR_COLOR : 0x666666;
  const g = new Graphics();
  g.poly([a.x, a.y, b.x, b.y, b.x, b.y + lift, a.x, a.y + lift]).fill(color);
  walls.addChild(g);
}
```

(A `door`-kind edge is drawn at 40% of full wall height — a visible gap/lintel rather than a solid plane, satisfying the design doc's "visible gap" requirement without needing a separate door-sprite asset yet.)

- [ ] **Step 4: Rewrite furniture and spawns as depth-sorted placeholder shapes**

Keep the existing `SelectableGraphics`/`mapEntity` tagging and `eventMode: 'static'` exactly as before — only the position/shape math changes:

```ts
const orderedObjects = [...map.objects].sort(
  (a, b) => (Math.floor(a.y) + Math.floor(a.x)) - (Math.floor(b.y) + Math.floor(b.x)),
);
for (const obj of orderedObjects) {
  const base = cellToScreen(obj.x + obj.footprint.w / 2, obj.y + obj.footprint.h / 2);
  const lift = heightOffset(obj.height);
  const halfW = (obj.footprint.w * TILE_W) / 4;
  const halfH = (obj.footprint.h * TILE_H) / 4;
  const g: SelectableGraphics = new Graphics();
  g.poly([
    base.x, base.y + lift - halfH,
    base.x + halfW, base.y + lift,
    base.x, base.y + lift + halfH,
    base.x - halfW, base.y + lift,
  ]).fill(OBJECT_COLOR);
  g.eventMode = 'static';
  g.cursor = 'pointer';
  g.mapEntity = obj;
  objects.addChild(g);
}
```

Apply the same `cellToScreen` + `heightOffset` repositioning to the `spawns` loop (keep its existing circle shape and `SPAWN_PLAYER_COLOR`/`SPAWN_NPC_COLOR` logic — only recompute where it's drawn: `const base = cellToScreen(spawn.x, spawn.y); const lift = heightOffset(0.5);` then draw the circle at `base.x, base.y + lift`).

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit` — 0 errors.

- [ ] **Step 6: Full suite check and commit**

Run: `npm test` — still 23 passing (this task touches no test files).

```bash
git add maplab/src/render/layers.ts maplab/src/render/palette.ts
git commit -m "Map Lab: isometric floor/walls/placeholder furniture, depth-sorted"
```

---

### Task 3: Overlay rework + picking/frame-selected in iso space

**Files:**
- Modify: `maplab/src/render/layers.ts` (grid, collision, nav, room-bounds overlay loops)
- Modify: `maplab/src/render/PixiStage.tsx` (picking math, status-bar cell readout, `frameSelected`)

**Interfaces:**
- Consumes: `cellToScreen`, `screenToCell` from `./iso` (new import in `PixiStage.tsx`).
- No signature changes — `PixiStageHandle`, `SelectedEntity`, the `onPointerMove`/`onSelect` prop shapes are unchanged from Phase 1.

- [ ] **Step 1: Grid and collision overlays**

Both currently draw one square per cell; change each to the same 4-point diamond `poly(...)` used for the floor in Task 2 (reuse the same corner computation, just with the grid-line stroke or the collision fill instead of the room color).

- [ ] **Step 2: Navigation overlay**

Currently draws a line between adjacent cell centers computed as `c*cs + cs/2`. Replace each center with `cellToScreen(c + 0.5, r + 0.5)`, keep the same `grid.canMove(...)` adjacency checks driving which lines get drawn.

- [ ] **Step 3: Room-bounds overlay**

Currently an axis-aligned rectangle. Replace with the bounding diamond: compute `minC, minR, maxC, maxR` exactly as before, then build a 4-point polygon from `cellToScreen(minC, minR)`, `cellToScreen(maxC + 1, minR)`, `cellToScreen(maxC + 1, maxR + 1)`, `cellToScreen(minC, maxR + 1)`, stroked the same way the old rectangle was. Position the room-name `Text` label at the first corner (`cellToScreen(minC, minR)`) plus a small fixed offset, same as before.

- [ ] **Step 4: `PixiStage.tsx` picking and status bar**

Find the `pointermove` handler's `onPointerMove({ x: Math.floor(local.x / map.grid.cellSize), ... })` call and the stage-level `pointertap` room-selection fallback's equivalent division. Replace both with `screenToCell(local.x, local.y)`, floored:

```ts
import { screenToCell } from './iso';
// ...
const cellF = screenToCell(local.x, local.y);
const cell = { x: Math.floor(cellF.x), y: Math.floor(cellF.y) };
```

Use `cell.x`/`cell.y` everywhere the old `Math.floor(local.x / map.grid.cellSize)` result was used (the `onPointerMove` callback and the room-index lookup key `` `${cell.x},${cell.y}` ``).

- [ ] **Step 5: `frameSelected` for `RoomDef`**

The `'cells' in sel` branch (added in the Phase 1 final-fix batch) currently computes bounds as `minC * cellSize` etc. Replace with the same bounding-diamond corners from Step 3 of this task, reduced to a `Bounds` rectangle the same way `mapPixelBounds` does (min/max x and y across the 4 transformed corners) — `fitTransform` only needs a `Bounds`, not the polygon shape itself.

- [ ] **Step 6: Type-check, full suite, commit**

```bash
npx tsc -b --noEmit
npm test
```
Expected: 0 errors, 23/23 passing.

```bash
git add maplab/src/render/layers.ts maplab/src/render/PixiStage.tsx
git commit -m "Map Lab: isometric overlays, picking, and frame-selected"
```

---

### Task 4: Isometric furniture and person sprites

**Files:**
- Create: `maplab/src/render/isoSprites.ts`
- Modify: `maplab/src/render/layers.ts` (swap Task 2's placeholder diamonds for real sprites)

**Interfaces:**
- Produces (for this task's own consumption in `layers.ts`): a sprite registry keyed by furniture/person kind, each entry a `{ rows: string[]; palette: Record<string, string> }` pair (the same shape `src/ui/art/street.ts`'s `CAR_SPRITES`/`FRONT_SPRITES` already use), plus a `blitToCanvas(rows, palette, scale): HTMLCanvasElement` helper and a small `Texture` cache so each distinct sprite is only rasterized once.

This is the one task in this phase where visual judgment matters more than mechanical correctness — budget for at least one look-and-adjust pass in Step 4 below, and don't treat a single successful `tsc`/render as "done."

- [ ] **Step 1: Read the existing top-down sprite technique for the `blit` pattern**

Read `maplab/../../src/ui/art/street.ts`'s `blit()` function (mafia repo root, not this worktree's `maplab/`) for the row-string-to-pixels convention this project already uses — reuse that exact technique (a character grid, a palette dict from character to hex color, one filled rect per pixel), but every sprite here is authored as an **isometric 3/4-view silhouette** (you can see a top/lid face and one or two front faces, suggesting real volume), not a top-down shape. Do not copy the street's sprites directly — they're the wrong shape for this projection.

- [ ] **Step 2: Write `src/render/isoSprites.ts`**

Author isometric pixel sprites for: `table` (with chairs implied by silhouette), `bar-counter`, `stove`, `counter` (prep counter), `lockers`, `desk`, `host-stand`, and one `person` sprite (palette-varied per spawn, same idea as the street's `PED_PALS` array). Two fully worked examples to match in style and structure (author the rest following this exact pattern — same row-string/palette technique, same rough pixel scale per world-unit of footprint):

```ts
export interface IsoSprite {
  rows: string[];
  palette: Record<string, string>;
}

// A small square table, viewed from the iso camera: a flat top face (t) and
// two visible side faces (s = near-left face, S = near-right face, slightly
// darker to read as shadowed) plus four short legs (l).
export const TABLE: IsoSprite = {
  rows: [
    '..tttttt..',
    '.tttttttt.',
    'ttttttttt.',
    'ttttttttt.',
    '.tttttttt.',
    'sssssSSSSS',
    'sssssSSSSS',
    'l........l',
  ],
  palette: { t: '#8a6a4f', s: '#6f5138', S: '#5a4029', l: '#3b2519' },
};

// The standing person: a head, torso, and two visible faces of legs (same
// near-left/near-right shading idea as the table), scaled to stand roughly
// one cell tall in this projection.
export const PERSON: IsoSprite = {
  rows: [
    '.hh.',
    '.hh.',
    '.ff.',
    'cccc',
    'cccc',
    'c.C.',
    'c.C.',
  ],
  palette: { h: '#2e2a24', f: '#8a6a4f', c: '#3b3528', C: '#2a261f' },
};

export const SPRITES: Record<string, IsoSprite> = {
  table: TABLE,
  person: PERSON,
  // ... 'bar-counter', 'stove', 'counter', 'lockers', 'desk', 'host-stand'
  // authored the same way: a top face, one or two shaded side faces, and
  // (where it reads better) short legs/feet, sized roughly to the object's
  // footprint in cells (a 2x2-footprint object reads at roughly double the
  // pixel width/height of a 1x1 one).
};

/** Rasterize one sprite to an offscreen canvas at `scale` px per pixel-row-unit. */
export function blitIsoSprite(sprite: IsoSprite, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const width = Math.max(...sprite.rows.map((r) => r.length));
  canvas.width = width * scale;
  canvas.height = sprite.rows.length * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      if (key === '.' || !sprite.palette[key]) continue;
      ctx.fillStyle = sprite.palette[key];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return canvas;
}
```

Fill in the remaining 6 sprites (`bar-counter`, `stove`, `counter`, `lockers`, `desk`, `host-stand`) using the same two-example pattern above — a flat top face, one or two shaded side faces implying depth, sized proportionally to each object's `footprint` in `restaurant.ts`.

- [ ] **Step 3: Wire sprites into `layers.ts`**

Replace Task 2's placeholder diamond `Graphics` for objects with a Pixi `Sprite` built from `Texture.from(blitIsoSprite(SPRITES[obj.kind] ?? SPRITES.table, SCALE))`, positioned at the same `base`/`lift` computed in Task 2 (anchor the sprite at its horizontal center, vertical base — `sprite.anchor.set(0.5, 1)` — so it "stands" on its base cell rather than being centered on it). Cache one `Texture` per distinct `(kind)` — don't re-rasterize per instance. Do the same for spawns using `SPRITES.person`, palette-varied per spawn the way the street's `PED_PALS` cycles palettes (pick a palette variant via a stable hash of the spawn's `id`, same idiom `street.ts`'s `hash()` function uses).

- [ ] **Step 4: Look at it — required iteration checkpoint**

Start `npm run dev`, open it in a browser, and actually look at the result. If any sprite reads as an unrecognizable blob rather than "a table," "a person," etc. at the zoom level the Map Lab defaults to, adjust that sprite's rows/palette and re-check — do not move on with a sprite that doesn't read. This is expected to take more than one pass; that's the point of building this on top of Map Lab rather than guessing blind.

- [ ] **Step 5: Type-check, full suite, commit**

```bash
npx tsc -b --noEmit
npm test
```
Expected: 0 errors, 23/23 passing (no test file touched this task).

```bash
git add maplab/src/render/isoSprites.ts maplab/src/render/layers.ts
git commit -m "Map Lab: isometric furniture and person sprites"
```

---

### Task 5: Ambient motion

**Files:**
- Modify: `maplab/src/render/PixiStage.tsx` (or a new small `src/render/ambient.ts` if the logic doesn't fit cleanly inline — implementer's call, matching how `StreetScene.tsx` in the main game keeps its animation loop in the component itself)

**Interfaces:**
- No new exports needed by later tasks — this is the last render-layer task before final verification.

- [ ] **Step 1: Add a reduced-motion-aware animation loop**

Following `src/ui/StreetScene.tsx`'s pattern exactly (read it first): check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once; if true, skip starting any `requestAnimationFrame` loop entirely and render every accent in its default (non-animated) state. Otherwise start one `rAF` loop for the `PixiStage`'s lifetime (cancelled in the same cleanup that already destroys the Pixi app).

- [ ] **Step 2: Flicker accents**

Pick 2–3 objects to animate (the `stove` object, and 1–2 `table` objects near it — "candlelit tables") — vary their sprite's alpha or a small tint pulse on a slow, gentle sine wave (different phase per object, seeded by a stable hash of the object's `id` the same way `street.ts` seeds its variety, so it isn't perfectly synchronized). Purely decorative — nothing here should be read by any test or by future gameplay code.

- [ ] **Step 3: Idle sway on person sprites**

A small, slow vertical bob or horizontal sway (a pixel or two, on a slow cycle, phase-seeded per spawn `id`) on each person sprite from Task 4 — not a walk cycle, just enough to read as "not a statue."

- [ ] **Step 4: Verify reduced-motion actually disables it**

Using the browser tools, emulate reduced motion if the tooling supports it, or at minimum re-read the code path to confirm the `matchMedia` check genuinely gates the `requestAnimationFrame` call (not just the visual amplitude) — a reduced-motion viewer should get a fully static scene, matching `StreetScene`'s own contract.

- [ ] **Step 5: Type-check, full suite, commit**

```bash
npx tsc -b --noEmit
npm test
```
Expected: 0 errors, 23/23 passing.

```bash
git add maplab/src/render/PixiStage.tsx
git commit -m "Map Lab: ambient flicker and idle sway, reduced-motion aware"
```
(Adjust the `git add` path if a separate `ambient.ts` was created.)

---

### Task 6: Full browser verification

**Files:** none created/modified — this task is verification only, with fixes folded in if anything doesn't hold.

- [ ] **Step 1: Start the dev server and open it**

`npm run dev`, navigate to it in the browser tooling available.

- [ ] **Step 2: Verify the isometric scene**

Screenshot and confirm: diamond floor tiles colored per room, angled walls on the north/west sides of each room with visible door gaps, furniture and people rendered as recognizable isometric sprites (not the Task 2 placeholder diamonds), correct depth-sorting (nothing draws behind something it should be in front of — check at least one spot where two objects are diagonally adjacent).

- [ ] **Step 3: Verify overlays**

Toggle each of Grid, Collision, Navigation, Room bounds on in turn; confirm each now renders as diamonds/iso-shapes consistent with the floor beneath it, not misaligned squares.

- [ ] **Step 4: Verify interaction**

Pan, zoom (still cursor-anchored per the Phase 1 fix), reset camera, click a table/person/empty-floor-room, confirm Inspector shows correct JSON in each case, click "Frame selected" on both a small selection (a person) and a large one (the dining room) and confirm sensible framing.

- [ ] **Step 5: Verify motion**

Confirm the flicker/sway accents are visible and subtle (not distracting), and that console has no errors.

- [ ] **Step 6: Fix anything that doesn't hold, then final commit**

If any check in Steps 2–5 fails, fix the responsible file before considering this task done — this is the real acceptance gate for the whole phase, same as Phase 1's final task. Stop the dev server when finished.

---

## Plan self-review

**Spec coverage:** projection math + round-trip test (Task 1) · floor/wall/depth-sort geometry (Task 2) · all 4 reworked overlays + picking/frame-selected (Task 3) · isometric sprite content, explicitly flagged as an iteration task (Task 4) · ambient motion, reduced-motion-gated (Task 5) · full visual acceptance pass (Task 6). Non-goals (map data changes, player movement, multi-floor, shaders) are not touched by any task.

**Type consistency:** `cellToScreen`/`screenToCell`/`heightOffset`/`TILE_W`/`TILE_H`/`HEIGHT_PX` defined once in Task 1, consumed unchanged in Tasks 2 and 3. `MapLayers`/`buildMapLayers`/`mapPixelBounds`/`SelectableGraphics` keep their Phase 1 signatures throughout — no downstream task needs to know the projection changed. `IsoSprite`/`SPRITES`/`blitIsoSprite` defined once in Task 4, consumed only within that task's `layers.ts` edit.

**No placeholders found** on re-read, except the deliberate, explicitly-labeled placeholder shapes in Task 2 (intentionally temporary, replaced in Task 4) and the explicitly-flagged "author the rest following this pattern" instruction in Task 4 Step 2 (sprite content, not logic — flagged as an iteration task rather than a spec ambiguity).
