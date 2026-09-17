# Map Lab Movement (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time avatar movement to the Map Lab sandbox — a click-to-move
controllable player avatar and 4 idle-wandering NPCs — reusing Phase 1's collision/nav
data unchanged.

**Architecture:** Two new pure modules (`movement.ts` for path interpolation/facing,
`wander.ts` for NPC target selection) consumed by `PixiStage.tsx`'s existing
`requestAnimationFrame` loop. A Move/Inspect mode toggle in the side panel decides what
a click on the canvas does. No sim/gameplay wiring — see the spec's non-goals.

**Tech Stack:** TypeScript, Vitest, PixiJS v8 (`pixi.js`), React — same as Phases 1/1.5.

**Spec:** `maplab/docs/superpowers/specs/2026-09-14-map-lab-movement-design.md`

## Global Constraints

- `src/map/types.ts`, `src/map/grid.ts`, `src/map/restaurant.ts` do not change.
- Grid movement is 4-directional (N/E/S/W) — no diagonals.
- Default walk speed: 3 cells/sec, a named constant, not a scattered literal.
- NPC wander idle pause: 1–3 seconds between walks, randomized per NPC.
- Map Lab only — no `src/sim/` wiring, no gameplay triggers on movement.
- `npm test` stays green throughout, plus new tests for every pure function added.
- `TILE_W = 64`, `TILE_H = 32`, `HEIGHT_PX = 20` (from `iso.ts`) are unchanged and reused.

---

### Task 1: `movement.ts` — path interpolation and facing

**Files:**
- Create: `maplab/src/render/movement.ts`
- Test: `maplab/src/render/__tests__/movement.test.ts`

**Interfaces:**
- Consumes: `Point` (`[number, number]`) from `maplab/src/map/grid.ts` (already exported).
- Produces: `Facing` (`'N'|'E'|'S'|'W'`), `MoveState { x: number; y: number; facing: Facing; done: boolean }`, `DEFAULT_SPEED_CELLS_PER_SEC` (number, `3`), `stepAlongPath(path: Point[], elapsedMs: number, speedCellsPerSec?: number): MoveState`, `SpriteFacing { variant: 'front' | 'back'; flipX: boolean }`, `facingToSprite(facing: Facing): SpriteFacing`, `Mode` (`'inspect' | 'move'`) — all consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `maplab/src/render/__tests__/movement.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stepAlongPath, facingToSprite, DEFAULT_SPEED_CELLS_PER_SEC } from '../movement';
import type { Point } from '../../map/grid';

describe('stepAlongPath', () => {
  it('starts at the path origin with the first segment\'s facing', () => {
    const path: Point[] = [[0, 0], [1, 0]];
    const state = stepAlongPath(path, 0, DEFAULT_SPEED_CELLS_PER_SEC);
    expect(state.x).toBeCloseTo(0);
    expect(state.y).toBeCloseTo(0);
    expect(state.facing).toBe('E');
    expect(state.done).toBe(false);
  });

  it('interpolates fractionally partway through a segment', () => {
    const path: Point[] = [[0, 0], [1, 0]];
    // distance = (elapsedMs/1000) * speed = 0.5 cells at speed 2
    const state = stepAlongPath(path, 250, 2);
    expect(state.x).toBeCloseTo(0.5);
    expect(state.y).toBeCloseTo(0);
    expect(state.facing).toBe('E');
    expect(state.done).toBe(false);
  });

  it('carries facing across a direction change into the second segment', () => {
    const path: Point[] = [[0, 0], [1, 0], [1, 1]]; // E then S
    // distance = 1.5 cells at speed 3 -> 500ms
    const state = stepAlongPath(path, 500, 3);
    expect(state.x).toBeCloseTo(1);
    expect(state.y).toBeCloseTo(0.5);
    expect(state.facing).toBe('S');
    expect(state.done).toBe(false);
  });

  it('clamps to the exact endpoint and reports done once elapsed time exceeds the path length', () => {
    const path: Point[] = [[0, 0], [1, 0]];
    const state = stepAlongPath(path, 10_000, DEFAULT_SPEED_CELLS_PER_SEC);
    expect(state.x).toBe(1);
    expect(state.y).toBe(0);
    expect(state.facing).toBe('E');
    expect(state.done).toBe(true);
  });

  it('treats a single-cell path as already arrived, facing south by default', () => {
    const path: Point[] = [[3, 4]];
    const state = stepAlongPath(path, 0, DEFAULT_SPEED_CELLS_PER_SEC);
    expect(state.x).toBe(3);
    expect(state.y).toBe(4);
    expect(state.facing).toBe('S');
    expect(state.done).toBe(true);
  });

  it('covers all 4 grid directions', () => {
    expect(stepAlongPath([[0, 0], [1, 0]], 0, 1).facing).toBe('E');
    expect(stepAlongPath([[0, 0], [-1, 0]], 0, 1).facing).toBe('W');
    expect(stepAlongPath([[0, 0], [0, 1]], 0, 1).facing).toBe('S');
    expect(stepAlongPath([[0, 0], [0, -1]], 0, 1).facing).toBe('N');
  });
});

describe('facingToSprite', () => {
  it('maps toward-camera directions (S/E) to the front sprite, E mirrored', () => {
    expect(facingToSprite('S')).toEqual({ variant: 'front', flipX: false });
    expect(facingToSprite('E')).toEqual({ variant: 'front', flipX: true });
  });

  it('maps away-from-camera directions (N/W) to the back sprite, W mirrored', () => {
    expect(facingToSprite('N')).toEqual({ variant: 'back', flipX: false });
    expect(facingToSprite('W')).toEqual({ variant: 'back', flipX: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd maplab && npx vitest run src/render/__tests__/movement.test.ts`
Expected: FAIL — `Cannot find module '../movement'`.

- [ ] **Step 3: Implement `movement.ts`**

Create `maplab/src/render/movement.ts`:

```ts
/**
 * Pure path-interpolation and facing math for Map Lab's movement pass. No
 * Pixi/DOM — same separation `iso.ts`/`grid.ts` already keep. `PixiStage.tsx`
 * drives this from its per-frame loop.
 */

import type { Point } from '../map/grid';

export type Facing = 'N' | 'E' | 'S' | 'W';

/** Which Map Lab interaction mode is active — decides what a canvas click does. */
export type Mode = 'inspect' | 'move';

export interface MoveState {
  x: number;
  y: number;
  facing: Facing;
  done: boolean;
}

export const DEFAULT_SPEED_CELLS_PER_SEC = 3;

function directionOf(dx: number, dy: number): Facing {
  if (dx === 1) return 'E';
  if (dx === -1) return 'W';
  if (dy === 1) return 'S';
  return 'N'; // dy === -1
}

/** Walks `path` (a findPath() result, 4-directional unit steps) at
 * `speedCellsPerSec`, returning the interpolated position/facing at
 * `elapsedMs` since the walk started. A single-cell path (already at the
 * target) is immediately done, facing south — there is no direction to
 * derive it from. */
export function stepAlongPath(
  path: Point[],
  elapsedMs: number,
  speedCellsPerSec: number = DEFAULT_SPEED_CELLS_PER_SEC,
): MoveState {
  if (path.length === 0) throw new Error('stepAlongPath requires a non-empty path');
  if (path.length === 1) {
    return { x: path[0][0], y: path[0][1], facing: 'S', done: true };
  }

  const totalSegments = path.length - 1;
  const distance = Math.min((elapsedMs / 1000) * speedCellsPerSec, totalSegments);
  const done = distance >= totalSegments;
  const segmentIndex = done ? totalSegments - 1 : Math.floor(distance);
  const fraction = done ? 1 : distance - segmentIndex;

  const [fx, fy] = path[segmentIndex];
  const [tx, ty] = path[segmentIndex + 1];
  const x = fx + (tx - fx) * fraction;
  const y = fy + (ty - fy) * fraction;
  const facing = directionOf(tx - fx, ty - fy);

  return { x, y, facing, done };
}

export interface SpriteFacing {
  variant: 'front' | 'back';
  flipX: boolean;
}

/** S and E both walk toward the camera (down-screen in this projection) —
 * front sprite, E mirrored. N and W both walk away from the camera —
 * back sprite, W mirrored. 2 drawn sprites cover all 4 grid directions. */
export function facingToSprite(facing: Facing): SpriteFacing {
  switch (facing) {
    case 'S': return { variant: 'front', flipX: false };
    case 'E': return { variant: 'front', flipX: true };
    case 'N': return { variant: 'back', flipX: false };
    case 'W': return { variant: 'back', flipX: true };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd maplab && npx vitest run src/render/__tests__/movement.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add maplab/src/render/movement.ts maplab/src/render/__tests__/movement.test.ts
git commit -m "Map Lab: movement path-interpolation and facing math

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `wander.ts` — NPC wander target selection

**Files:**
- Create: `maplab/src/render/wander.ts`
- Test: `maplab/src/render/__tests__/wander.test.ts`

**Interfaces:**
- Consumes: `MapDef`, `RoomDef` from `maplab/src/map/types.ts`; `Point`, `findPath` from `maplab/src/map/grid.ts` (all already exported, unchanged).
- Produces: `pickWanderTarget(map: MapDef, roomId: string, currentCell: Point, rng: () => number): Point | null` — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `maplab/src/render/__tests__/wander.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickWanderTarget } from '../wander';
import type { MapDef, RoomDef, WallEdge } from '../../map/types';

function roomMap(rooms: RoomDef[], walls: WallEdge[] = []): MapDef {
  return {
    id: 'test', name: 'Test',
    grid: { cols: 3, rows: 1, cellSize: 32 },
    cells: [['floor', 'floor', 'floor']],
    walls,
    rooms,
    objects: [],
    spawns: [],
    exits: [],
  };
}

describe('pickWanderTarget', () => {
  it('picks a reachable cell in the room other than the current one, via the injected rng', () => {
    const room: RoomDef = { id: 'r', name: 'R', kind: 'dining', level: 0, cells: [[0, 0], [1, 0], [2, 0]] };
    const map = roomMap([room]);

    expect(pickWanderTarget(map, 'r', [0, 0], () => 0)).toEqual([1, 0]);
    expect(pickWanderTarget(map, 'r', [0, 0], () => 0.99)).toEqual([2, 0]);
  });

  it('returns null for an unknown room id', () => {
    const room: RoomDef = { id: 'r', name: 'R', kind: 'dining', level: 0, cells: [[0, 0], [1, 0]] };
    const map = roomMap([room]);
    expect(pickWanderTarget(map, 'nope', [0, 0], () => 0)).toBeNull();
  });

  it('returns null when the room has no other cell to go to', () => {
    const room: RoomDef = { id: 'r', name: 'R', kind: 'dining', level: 0, cells: [[0, 0]] };
    const map = roomMap([room]);
    expect(pickWanderTarget(map, 'r', [0, 0], () => 0)).toBeNull();
  });

  it('returns null when every other room cell is unreachable (walled off internally)', () => {
    const room: RoomDef = { id: 'r', name: 'R', kind: 'dining', level: 0, cells: [[0, 0], [1, 0]] };
    const map = roomMap([room], [{ cell: [0, 0], side: 'E', kind: 'wall' }]);
    expect(pickWanderTarget(map, 'r', [0, 0], () => 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd maplab && npx vitest run src/render/__tests__/wander.test.ts`
Expected: FAIL — `Cannot find module '../wander'`.

- [ ] **Step 3: Implement `wander.ts`**

Create `maplab/src/render/wander.ts`:

```ts
/**
 * NPC wander target selection for Map Lab's movement pass. Pure — no
 * Pixi/DOM, no timers. `PixiStage.tsx`'s per-frame loop calls this whenever
 * an NPC needs a new destination.
 */

import type { MapDef } from '../map/types';
import { findPath, type Point } from '../map/grid';

/** Picks a random cell inside `roomId`, other than `currentCell`, that is
 * actually reachable from `currentCell` (a room's cells can be internally
 * split by walls or furniture). Returns null if there's nowhere to go —
 * an unknown room, a single-cell room, or every other cell being
 * unreachable — which is a normal "stay put" outcome, not an error. */
export function pickWanderTarget(
  map: MapDef,
  roomId: string,
  currentCell: Point,
  rng: () => number,
): Point | null {
  const room = map.rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const candidates = room.cells.filter(
    ([c, r]) => !(c === currentCell[0] && r === currentCell[1]),
  );
  if (candidates.length === 0) return null;

  const reachable = candidates.filter((cell) => findPath(map, currentCell, cell) !== null);
  if (reachable.length === 0) return null;

  const idx = Math.floor(rng() * reachable.length);
  return reachable[idx];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd maplab && npx vitest run src/render/__tests__/wander.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add maplab/src/render/wander.ts maplab/src/render/__tests__/wander.test.ts
git commit -m "Map Lab: NPC wander target selection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Directional person sprite + texture cache

**Files:**
- Modify: `maplab/src/render/isoSprites.ts` (add `PERSON_BACK`, after the existing `PERSON` export around line 46)
- Modify: `maplab/src/render/layers.ts` (person texture cache, `MapLayers` interface, spawn-building loop)

**Interfaces:**
- Consumes: `facingToSprite`'s `'front' | 'back'` variant vocabulary (Task 1) — this task does not import `movement.ts`; it just needs to speak the same two-string vocabulary.
- Produces: `PERSON_BACK: IsoSprite` (exported from `isoSprites.ts`); `MapLayers.getPersonTexture(paletteIndex: number, variant: 'front' | 'back'): Texture` — consumed by Task 4. Also: each spawn's `container` now carries the spawn's world position itself (`container.x`/`container.y`), with `ring`/`person` at local `(0, 0)` — Task 4 moves an entity by setting `container.x`/`container.y`, not by touching `ring`/`person` positions directly.

- [ ] **Step 1: Add the back-facing sprite**

In `maplab/src/render/isoSprites.ts`, after the `PERSON` constant (line 46), add:

```ts
// Back view of the standing person: same silhouette as PERSON, but the face
// patch is covered by hair colour (nothing to see from behind) and a faint
// centre seam replaces the flat torso fill, so it reads as a distinct pose
// at a glance rather than a recoloured front sprite.
export const PERSON_BACK: IsoSprite = {
  rows: [
    '.hh.',
    '.hh.',
    '.hh.',
    'cccc',
    'cCCc',
    'c.C.',
    'c.C.',
  ],
  palette: { h: '#2e2a24', f: '#8a6a4f', c: '#3b3528', C: '#2a261f' },
};
```

(The `palette` field here is a placeholder default — `layers.ts` always overrides it with the spawn's actual `PERSON_PALETTES` entry, same as `PERSON` already does.)

- [ ] **Step 2: Run the full suite to confirm nothing broke**

Run: `cd maplab && npm test`
Expected: PASS — still 25/25 (this step only added a new unreferenced export, no behavior change yet).

- [ ] **Step 3: Wire the two-variant texture cache and container-relative spawn positioning**

In `maplab/src/render/layers.ts`:

1. Add `PERSON_BACK` to the import from `./isoSprites` (line 12):

```ts
import { SPRITES, PERSON_PALETTES, PERSON_BACK, blitIsoSprite, hash } from './isoSprites';
```

2. Add `Texture` to the `MapLayers` interface's needs — it's already imported (line 1) — and add `getPersonTexture` to the interface (after `spawns: Container;`, line 29):

```ts
export interface MapLayers {
  world: Container;
  floor: Container;
  walls: Container;
  objects: Container;
  grid: Container;
  collision: Container;
  nav: Container;
  roomBounds: Container;
  spawns: Container;
  getPersonTexture: (paletteIndex: number, variant: 'front' | 'back') => Texture;
}
```

3. Replace the `personTextures` cache and `personTexture` function (lines 100–109):

```ts
const personTextures = new Map<string, Texture>();
function personTexture(paletteIndex: number, facingVariant: 'front' | 'back' = 'front'): Texture {
  const key = `${paletteIndex}:${facingVariant}`;
  let tex = personTextures.get(key);
  if (!tex) {
    const base = facingVariant === 'back' ? PERSON_BACK : SPRITES.person;
    const sprite = { ...base, palette: PERSON_PALETTES[paletteIndex] };
    tex = Texture.from(blitIsoSprite(sprite, SPRITE_SCALE));
    personTextures.set(key, tex);
  }
  return tex;
}
```

4. Replace the spawn-building loop (lines 245–267) so the container itself carries world position, and `ring`/`person` are drawn at local `(0, 0)` — this is what makes moving an entity later a one-line `container.x`/`container.y` update instead of rebuilding the ring's geometry every frame:

```ts
for (const spawn of orderedSpawns) {
  const base = cellToScreen(spawn.x, spawn.y);
  const container: SelectableNode = new Container();
  container.x = base.x;
  container.y = base.y;
  // A small ground ring keeps the player/npc colour distinction the flat
  // marker used to carry; the person sprite stands on top of it, anchored
  // at its feet so it reads as standing on the spawn cell. Both are drawn
  // at the container's local origin — the container itself carries world
  // position, so moving an entity later is one `container.x/y` update.
  const ring = new Graphics();
  const ringColor = spawn.kind === 'player' ? SPAWN_PLAYER_COLOR : SPAWN_NPC_COLOR;
  ring.ellipse(0, 0, TILE_W * 0.28, TILE_H * 0.28).fill({ color: ringColor, alpha: 0.6 });
  const paletteIndex = hash(spawn.id) % PERSON_PALETTES.length;
  const person = new Sprite(personTexture(paletteIndex, 'front'));
  person.label = 'person';
  person.anchor.set(0.5, 1);
  container.addChild(ring, person);
  container.zIndex = Math.floor(spawn.x) + Math.floor(spawn.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.mapEntity = spawn;
  spawns.addChild(container);
  entities.attach(container);
}
```

5. Add `getPersonTexture: personTexture,` to the function's final return statement (line 275):

```ts
return {
  world, floor, walls, objects, grid: gridLines, collision, nav, roomBounds, spawns,
  getPersonTexture: personTexture,
};
```

**Note for the implementer:** `PixiStage.tsx`'s existing ambient-sway code reads `person.y` as the sway's baseline (`sway.push({ target: person, baseY: person.y, ... })`). After this change `person.y` is `0` (local, relative to the now-positioned container) instead of the old world-space value — the sway offset math is unchanged and still correct (it's a relative `±1.5px` wobble either way), but don't be surprised the baseline is `0` now; that's expected, not a bug.

- [ ] **Step 4: Run the full suite**

Run: `cd maplab && npm test`
Expected: PASS — still 25/25 (all changes here are internal to `buildMapLayers`'s Pixi construction, nothing pure-function-testable changed).

- [ ] **Step 5: Manual visual check**

Run: `cd maplab && npm run dev -- --port 5174 --strictPort`, open the preview, confirm the 5 spawned people render in the same positions and colours as before this task (the container refactor must be visually invisible — this is a pure internal restructure).

- [ ] **Step 6: Commit**

```bash
git add maplab/src/render/isoSprites.ts maplab/src/render/layers.ts
git commit -m "Map Lab: directional person sprite + container-relative spawn positioning

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Move mode, click-to-move, and NPC wander loop

**Files:**
- Create: `maplab/src/lab/ModeToggle.tsx`
- Modify: `maplab/src/MapLabApp.tsx`
- Modify: `maplab/src/lab/LayerToggles.tsx` (drop its own border — the wrapping div in `MapLabApp.tsx` now owns it)
- Modify: `maplab/src/render/PixiStage.tsx`

**Interfaces:**
- Consumes: `Mode`, `stepAlongPath`, `facingToSprite`, `Facing` from `movement.ts` (Task 1); `pickWanderTarget` from `wander.ts` (Task 2); `getPersonTexture` from `MapLayers` (Task 3); `findPath`, `cellOf`, `Point` from `maplab/src/map/grid.ts` (already exported, unchanged); `PERSON_PALETTES` from `isoSprites.ts` (already exported).
- Produces: nothing further downstream — this is the final integration task.

- [ ] **Step 1: Add the mode toggle component**

Create `maplab/src/lab/ModeToggle.tsx`:

```tsx
import type { Mode } from '../render/movement';

export default function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
}) {
  return (
    <div style={{ padding: 12, display: 'flex', gap: 8 }}>
      <button onClick={() => onChange('inspect')} disabled={value === 'inspect'}>
        Inspect
      </button>
      <button onClick={() => onChange('move')} disabled={value === 'move'}>
        Move
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire the mode toggle into the app shell**

In `maplab/src/lab/LayerToggles.tsx`, drop the border from the `<aside>` (line 16) since the wrapping div added below now owns it:

```tsx
<aside style={{ padding: 12 }}>
```

In `maplab/src/MapLabApp.tsx`, replace the whole file:

```tsx
import { useRef, useState } from 'react';
import { restaurantMap } from './map/restaurant';
import type { SelectedEntity } from './map/types';
import type { Mode } from './render/movement';
import PixiStage, { type PixiStageHandle } from './render/PixiStage';
import { DEFAULT_LAYER_VISIBILITY, type LayerVisibility } from './render/layers';
import Inspector from './lab/Inspector';
import LayerToggles from './lab/LayerToggles';
import ModeToggle from './lab/ModeToggle';
import StatusBar from './lab/StatusBar';

export default function MapLabApp() {
  const [selected, setSelected] = useState<SelectedEntity>(null);
  const [cursorCell, setCursorCell] = useState<{ x: number; y: number } | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [mode, setMode] = useState<Mode>('inspect');
  const handleRef = useRef<PixiStageHandle | null>(null);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 260px',
        gridTemplateRows: '1fr auto',
        height: '100vh',
        background: '#141110',
        color: '#ded3bc',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ borderRight: '1px solid #332a22', display: 'flex', flexDirection: 'column' }}>
        <ModeToggle value={mode} onChange={setMode} />
        <LayerToggles value={layers} onChange={setLayers} />
      </div>
      <div style={{ position: 'relative' }}>
        <PixiStage
          map={restaurantMap}
          layerVisibility={layers}
          mode={mode}
          onSelect={setSelected}
          onPointerMove={setCursorCell}
          registerHandle={(h) => { handleRef.current = h; }}
        />
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => handleRef.current?.resetCamera()}>Reset camera</button>
          <button onClick={() => handleRef.current?.frameSelected()} disabled={!selected}>
            Frame selected
          </button>
        </div>
      </div>
      <Inspector entity={selected} />
      <StatusBar cursorCell={cursorCell} mapName={restaurantMap.name} />
    </div>
  );
}
```

- [ ] **Step 3: Run the full suite**

Run: `cd maplab && npm test`
Expected: PASS — still 25/25 (UI-only change, no new pure logic yet).

- [ ] **Step 4: Commit the UI plumbing**

```bash
git add maplab/src/lab/ModeToggle.tsx maplab/src/lab/LayerToggles.tsx maplab/src/MapLabApp.tsx
git commit -m "Map Lab: Move/Inspect mode toggle in the side panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Wire movement into `PixiStage.tsx`**

Full replacement of `maplab/src/render/PixiStage.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Application, type Container, type Sprite } from 'pixi.js';
import type { MapDef, SelectedEntity, SpawnPoint } from '../map/types';
import { buildWalkGrid, cellRoomIndex, cellOf, findPath, type Point } from '../map/grid';
import { buildMapLayers, mapPixelBounds, type MapLayers, type LayerVisibility, type SelectableNode } from './layers';
import { fitTransform, clampZoom } from './camera';
import { cellToScreen, screenToCell } from './iso';
import { hash, PERSON_PALETTES } from './isoSprites';
import { stepAlongPath, facingToSprite, type Mode, type Facing } from './movement';
import { pickWanderTarget } from './wander';

export interface PixiStageHandle {
  resetCamera: () => void;
  frameSelected: () => void;
}

interface Props {
  map: MapDef;
  layerVisibility: LayerVisibility;
  mode: Mode;
  onSelect: (entity: SelectedEntity) => void;
  onPointerMove: (cell: { x: number; y: number } | null) => void;
  registerHandle: (handle: PixiStageHandle) => void;
}

interface Mover {
  spawn: SpawnPoint;
  container: SelectableNode;
  person: Sprite;
  paletteIndex: number;
  pos: { x: number; y: number };
  facing: Facing;
  path: Point[] | null;
  pathStartMs: number;
  nextWanderAtMs: number; // npc only
}

export default function PixiStage({ map, layerVisibility, mode, onSelect, onPointerMove, registerHandle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<MapLayers | null>(null);
  const selectedRef = useRef<SelectedEntity>(null);
  const modeRef = useRef<Mode>(mode);
  const ambientRaf = useRef(0);
  const [, forceRender] = useState(0);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let onWheel: ((e: WheelEvent) => void) | null = null;
    const app = new Application();

    (async () => {
      await app.init({ background: 0x0a0908, resizeTo: host, antialias: false });
      if (disposed) { app.destroy(true); return; }
      host.appendChild(app.canvas);
      appRef.current = app;

      const grid = buildWalkGrid(map);
      const layers = buildMapLayers(map, grid);
      const roomIndex = cellRoomIndex(map);
      layersRef.current = layers;
      app.stage.addChild(layers.world);
      app.stage.eventMode = 'static';
      // Pixi only hit-tests areas covered by an interactive display object; without an
      // explicit hitArea, pointermove never reaches the stage over empty canvas (only
      // when directly over an object/spawn graphic), so the status bar's cell readout
      // would appear frozen. `app.screen` is a live Rectangle that tracks resizeTo.
      app.stage.hitArea = app.screen;

      const bounds = mapPixelBounds(map);
      const applyTransform = (t: { x: number; y: number; scale: number }) => {
        layers.world.position.set(t.x, t.y);
        layers.world.scale.set(t.scale);
      };
      applyTransform(fitTransform(bounds, { width: host.clientWidth, height: host.clientHeight }));

      const handleSelect = (entity: SelectedEntity) => {
        selectedRef.current = entity;
        onSelect(entity);
      };

      registerHandle({
        resetCamera: () =>
          applyTransform(fitTransform(bounds, { width: host.clientWidth, height: host.clientHeight })),
        frameSelected: () => {
          const sel = selectedRef.current;
          if (!sel) return;
          let selBounds;
          if ('cells' in sel) {
            // RoomDef: frame its cell bounding box (same calc layers.ts uses for room outlines).
            const cols = sel.cells.map(([c]) => c);
            const rowsArr = sel.cells.map(([, r]) => r);
            const minC = Math.min(...cols);
            const minR = Math.min(...rowsArr);
            const maxC = Math.max(...cols);
            const maxR = Math.max(...rowsArr);
            const corners = [
              cellToScreen(minC, minR),
              cellToScreen(maxC + 1, minR),
              cellToScreen(maxC + 1, maxR + 1),
              cellToScreen(minC, maxR + 1),
            ];
            const xs = corners.map((p) => p.x);
            const ys = corners.map((p) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            selBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          } else {
            // MapObject/SpawnPoint: same corner-transform idiom as mapPixelBounds above,
            // over the footprint's cell-space box (spawns get a small 1x1 fallback box).
            const w = 'footprint' in sel ? sel.footprint.w : 1;
            const h = 'footprint' in sel ? sel.footprint.h : 1;
            const corners = [
              cellToScreen(sel.x, sel.y),
              cellToScreen(sel.x + w, sel.y),
              cellToScreen(sel.x + w, sel.y + h),
              cellToScreen(sel.x, sel.y + h),
            ];
            const xs = corners.map((p) => p.x);
            const ys = corners.map((p) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            selBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          }
          applyTransform(fitTransform(selBounds, { width: host.clientWidth, height: host.clientHeight }, 80));
        },
      });

      // Movement bookkeeping: one Mover per spawn (player + 4 npcs), built once from
      // the containers buildMapLayers already created. Position is authoritative on
      // `pos` (fractional cell coords); `container`/`person` are the Pixi objects a
      // moved entity's transform gets written to each frame.
      const movers: Mover[] = [];
      for (const child of layers.spawns.children as SelectableNode[]) {
        const spawn = child.mapEntity as SpawnPoint | undefined;
        const person = child.getChildByLabel('person') as Sprite | undefined;
        if (!spawn || !person) continue;
        movers.push({
          spawn,
          container: child,
          person,
          paletteIndex: hash(spawn.id) % PERSON_PALETTES.length,
          pos: { x: spawn.x, y: spawn.y },
          facing: 'S',
          path: null,
          pathStartMs: 0,
          nextWanderAtMs: 0, // eligible to wander from the very first frame
        });
      }
      const playerMover = movers.find((m) => m.spawn.kind === 'player') ?? null;

      function applyMoverTransform(mover: Mover) {
        const base = cellToScreen(mover.pos.x, mover.pos.y);
        mover.container.x = base.x;
        mover.container.y = base.y;
        mover.container.zIndex = Math.floor(mover.pos.x) + Math.floor(mover.pos.y);
        const { variant, flipX } = facingToSprite(mover.facing);
        mover.person.texture = layers.getPersonTexture(mover.paletteIndex, variant);
        mover.person.scale.x = flipX ? -1 : 1;
      }

      function updateMover(mover: Mover, now: number) {
        if (mover.path) {
          const state = stepAlongPath(mover.path, now - mover.pathStartMs);
          mover.pos = { x: state.x, y: state.y };
          mover.facing = state.facing;
          if (state.done) {
            mover.path = null;
            if (mover.spawn.kind === 'npc') {
              mover.nextWanderAtMs = now + 1000 + Math.random() * 2000; // 1-3s pause
            }
          }
        } else if (mover.spawn.kind === 'npc' && now >= mover.nextWanderAtMs) {
          const currentCell = cellOf(mover.pos.x, mover.pos.y);
          const target = pickWanderTarget(map, mover.spawn.roomId, currentCell, Math.random);
          if (target) {
            const path = findPath(map, currentCell, target);
            if (path) {
              mover.path = path;
              mover.pathStartMs = now;
            } else {
              mover.nextWanderAtMs = now + 1000 + Math.random() * 2000; // retry later
            }
          } else {
            mover.nextWanderAtMs = now + 2000 + Math.random() * 2000; // nothing reachable, wait longer
          }
        }
        applyMoverTransform(mover);
      }

      for (const mover of movers) applyMoverTransform(mover); // initial paint before the first tick

      let dragging = false;
      let last = { x: 0, y: 0 };
      let downAt = { x: 0, y: 0 };
      app.stage.on('pointerdown', (e) => {
        dragging = true;
        last = { x: e.global.x, y: e.global.y };
        downAt = { x: e.global.x, y: e.global.y };
      });
      app.stage.on('pointerup', () => { dragging = false; });
      app.stage.on('pointerupoutside', () => { dragging = false; });
      app.stage.on('pointermove', (e) => {
        const local = layers.world.toLocal(e.global);
        const cellF = screenToCell(local.x, local.y);
        onPointerMove({ x: Math.floor(cellF.x), y: Math.floor(cellF.y) });
        if (!dragging) return;
        const dx = e.global.x - last.x;
        const dy = e.global.y - last.y;
        last = { x: e.global.x, y: e.global.y };
        layers.world.position.set(layers.world.position.x + dx, layers.world.position.y + dy);
      });
      onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = host.getBoundingClientRect();
        const pointerScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const before = {
          x: (pointerScreen.x - layers.world.position.x) / layers.world.scale.x,
          y: (pointerScreen.y - layers.world.position.y) / layers.world.scale.y,
        };
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const nextScale = clampZoom(layers.world.scale.x * factor);
        layers.world.scale.set(nextScale);
        layers.world.position.set(
          pointerScreen.x - before.x * nextScale,
          pointerScreen.y - before.y * nextScale,
        );
      };
      host.addEventListener('wheel', onWheel, { passive: false });

      // One click always means one thing: in Move mode, object/spawn taps are a no-op
      // (can't walk into furniture or select while moving) — only the stage-level
      // empty-floor fallback below acts on Move mode.
      for (const child of [...layers.objects.children, ...layers.spawns.children] as SelectableNode[]) {
        child.on('pointertap', () => {
          if (modeRef.current === 'move') return;
          handleSelect(child.mapEntity ?? null);
        });
      }

      // Fires after any child's pointertap (Pixi bubbles child -> stage). If a child already
      // handled the tap, e.target is that child, not the stage — skip the room fallback then.
      // Also skip if the pointer moved more than a few pixels between down and up — that's
      // the release of a drag-pan, not a tap, and shouldn't touch selection.
      app.stage.on('pointertap', (e) => {
        if (e.target !== app.stage) return;
        const moved = Math.hypot(e.global.x - downAt.x, e.global.y - downAt.y);
        if (moved > 4) return;
        const local = layers.world.toLocal(e.global);
        const cellF = screenToCell(local.x, local.y);
        const cell: Point = [Math.floor(cellF.x), Math.floor(cellF.y)];

        if (modeRef.current === 'move') {
          if (!playerMover) return;
          const fromCell = cellOf(playerMover.pos.x, playerMover.pos.y);
          const path = findPath(map, fromCell, cell);
          if (path) {
            playerMover.path = path;
            playerMover.pathStartMs = performance.now();
          }
          return;
        }

        const room = roomIndex.get(`${cell[0]},${cell[1]}`) ?? null;
        handleSelect(room);
      });

      // Ambient motion: a slow candlelit flicker on the stove + a couple tables, and an
      // idle sway on standing people — purely decorative, nothing here is read by a test
      // or by gameplay code. Same reduced-motion contract as src/ui/StreetScene.tsx in
      // the main game: under prefers-reduced-motion, skip building it entirely rather
      // than just shrinking the amplitude. Movement itself is NOT gated by this — a
      // reduced-motion viewer must still be able to see the avatar/NPCs move, since that
      // carries real information (position), unlike the purely cosmetic flicker/sway.
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const flicker: { target: SelectableNode; phase: number }[] = [];
      const sway: { target: Container; baseY: number; phase: number }[] = [];
      if (!reducedMotion) {
        let tableCount = 0;
        for (const child of layers.objects.children as SelectableNode[]) {
          const ent = child.mapEntity;
          if (!ent || !('kind' in ent)) continue;
          const isStove = ent.kind === 'stove';
          const isCandlelitTable = ent.kind === 'table' && tableCount < 2;
          if (!isStove && !isCandlelitTable) continue;
          if (isCandlelitTable) tableCount++;
          // Hashed off the object's own id (same idiom art/street.ts uses) so the two
          // tables and the stove don't pulse in lockstep.
          flicker.push({ target: child, phase: ((hash(ent.id) % 1000) / 1000) * Math.PI * 2 });
        }

        for (const child of layers.spawns.children as SelectableNode[]) {
          const ent = child.mapEntity;
          const person = child.getChildByLabel('person');
          if (!ent || !person) continue;
          sway.push({ target: person, baseY: person.y, phase: ((hash(ent.id) % 1000) / 1000) * Math.PI * 2 });
        }
      }

      const tick = (now: number) => {
        const t = now / 1000;
        for (const f of flicker) f.target.alpha = 0.82 + 0.18 * Math.sin(t * 0.6 + f.phase);
        for (const s of sway) s.target.y = s.baseY + Math.sin(t * 0.5 + s.phase) * 1.5;
        for (const mover of movers) updateMover(mover, now);
        ambientRaf.current = requestAnimationFrame(tick);
      };
      ambientRaf.current = requestAnimationFrame(tick);

      forceRender((n) => n + 1); // now that layersRef is populated, re-run the visibility effect
    })();

    return () => {
      disposed = true;
      if (ambientRaf.current) cancelAnimationFrame(ambientRaf.current);
      ambientRaf.current = 0;
      if (onWheel) host.removeEventListener('wheel', onWheel);
      // second arg `true` = full cleanup (children + their textures/geometries), not just
      // the renderer — otherwise every layer under `layers.world` (and their pointertap
      // listeners) is detached but never disposed, leaking GPU resources on every remount.
      appRef.current?.destroy(true, true);
      appRef.current = null;
      layersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    layers.floor.visible = layerVisibility.floor;
    layers.walls.visible = layerVisibility.walls;
    layers.objects.visible = layerVisibility.objects;
    layers.grid.visible = layerVisibility.grid;
    layers.collision.visible = layerVisibility.collision;
    layers.nav.visible = layerVisibility.nav;
    layers.roomBounds.visible = layerVisibility.roomBounds;
    layers.spawns.visible = layerVisibility.spawns;
  });

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
```

- [ ] **Step 6: Run the full suite**

Run: `cd maplab && npm test`
Expected: PASS — 25 original + 9 (`movement.test.ts`) + 4 (`wander.test.ts`) = 38/38.

- [ ] **Step 7: Type-check**

Run: `cd maplab && npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Manual verification in the browser**

Run: `cd maplab && npm run dev -- --port 5174 --strictPort`, open the preview.

Check each of the spec's "Done means" items:
- Toggle to Move mode, click a walkable dining-room tile — the player avatar (the ring nearest the front entrance) walks there.
- Click a wall or a table while in Move mode — nothing happens.
- Click again mid-walk — the avatar retargets from where it currently is, not from where it started.
- Watch the 4 NPCs — each wanders within its own room continuously, pausing briefly between walks, never crashing or freezing on a small room.
- Confirm avatar/NPCs visibly flip to face left/right and swap front/back sprite when walking away vs. toward the camera.
- Walk the avatar through a doorway (e.g. dining → corridor) and confirm it still draws in front of/behind furniture and walls correctly on both sides — no pop-through.
- Switch back to Inspect mode — clicking objects/spawns/rooms selects them exactly as before this phase.

- [ ] **Step 9: Commit**

```bash
git add maplab/src/render/PixiStage.tsx
git commit -m "Map Lab: click-to-move avatar and continuous NPC wander

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** Architecture (movement.ts/wander.ts split, PixiStage integration) → Tasks 1/2/4. Interaction (mode toggle, click routing, retargeting) → Task 4. Sprites (2 drawn + mirror) → Tasks 1 (facingToSprite) + 3 (PERSON_BACK + texture cache). Depth sort (live zIndex) → Task 4's `applyMoverTransform`. Testing (pure-function coverage, no new Pixi tests) → Tasks 1/2 tests, Tasks 3/4 manual checks. Non-goals — no task adds sim wiring, entity collision, diagonal movement, or multi-floor. Default speed/wander pause constants match the spec's Global Constraints exactly.

**Placeholder scan:** No TBD/TODO; every step has complete code or an exact command+expected-output.

**Type consistency:** `Mode`, `Facing`, `MoveState`, `SpriteFacing` defined once in Task 1, imported (not redefined) everywhere else. `getPersonTexture`'s `'front' | 'back'` string union is used identically in Tasks 3 and 4 (no `Facing`-vs-string mismatch). `Point` imported from `grid.ts` throughout, never redefined locally.
