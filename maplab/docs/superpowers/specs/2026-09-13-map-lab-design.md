# Map Lab — Phase 1 design

## Why

Static HTML/SVG mockups of Frontline's map ideas force visual decisions without a way to
inspect, iterate, or validate an actual map. This phase builds the foundation instead:
a data-driven map representation, a real renderer that consumes it, and a dev tool
(`/map-lab`) to pan/zoom/inspect/validate it — proven on one restaurant test map.

## Scope boundary

The original ask bundles two things:

1. Map data model + renderer + Map Lab dev tool + a restaurant map that is inspectable
   (rooms, walls, collision, nav, spawns all present and correct).
2. Wiring that map into actual mechanical gameplay — the player/NPCs moving through it,
   with outcomes that depend on movement and pathing.

**This spec is (1) only.** (2) is real, confirmed future work — the eventual target is
interactive spatial gameplay, not decoration — but it is a separate spec once (1) is
built and proven. Nothing in this design should make (2) harder later; nothing in this
design should attempt to pre-build it now.

## Location

Standalone package in `maplab/` (own `package.json`, own Vite app, own tests). Zero
import path into `mafia/src`. This is a deliberate proving ground: prove the map/render
approach in isolation before touching Frontline's actual sim, panels, tests, or build.
When it's ready to become Frontline's real visual layer, porting it in is copying files
(the map data format has no React or canvas coupling), not a rewrite.

## Stack

React 18 + TypeScript + Vite, matching Frontline's existing app. One new dependency:
**PixiJS**, for camera transforms, layered rendering, and later lighting/depth
experiments — the actual visual-range question this tool exists to answer. Everything
else (map data, grid, pathfinding, test map) is plain TypeScript, no dependency.

Grid-based map data, not polygon walls. Rationale: visual creative freedom (curved bar,
round tables, angled dressing) comes from what objects render as, not from where the
structural collision boundary sits — objects can be any shape regardless of the grid
underneath. Polygon walls would buy a narrow amount of structural freedom (an
off-axis wall) at the cost of hand-built navmesh/polygon collision, which is exactly the
slow, error-prone work this tool exists to eliminate.

## Data model (`src/map/types.ts`)

The renderer, the Lab, and the tests all read this. Nothing about the restaurant's
layout is hard-coded into rendering code.

```ts
interface MapDef {
  id: string;
  name: string;
  grid: { cols: number; rows: number; cellSize: number };
  cells: CellKind[][];          // rows x cols: 'floor' | 'void'
  walls: WallEdge[];            // edges BETWEEN cells, not wall cells
  rooms: RoomDef[];
  objects: MapObject[];         // furniture/props
  spawns: SpawnPoint[];
  exits: ExitDef[];
}

interface WallEdge {
  cell: [number, number];
  side: 'N' | 'E' | 'S' | 'W';
  kind: 'wall' | 'door' | 'window' | 'open';
  height?: number;              // default 1; for depth-sort/occlusion later
}

interface RoomDef {
  id: string;
  name: string;
  kind: 'dining' | 'bar' | 'kitchen' | 'back-room' | 'staff' | 'corridor' | 'bathroom' | 'entrance';
  cells: [number, number][];
  level: number;                // reserved for multi-floor; always 0 this phase
}

interface MapObject {
  id: string;
  kind: string;                 // 'table' | 'chair' | 'bar-counter' | 'stove' | ...
  x: number; y: number;         // world units (sub-cell allowed)
  footprint: { w: number; h: number };
  height: number;               // world units, for depth-sort and future 2.5D
  walkable?: boolean;           // default false; a rug or mat can be true
  roomId: string;
}

interface SpawnPoint {
  id: string;
  kind: 'player' | 'npc';
  x: number; y: number;
  roomId: string;
}

interface ExitDef {
  id: string;
  roomId: string;
  wall: WallEdge;
  kind: 'front' | 'rear' | 'side';
  leadsTo: 'outside';
}
```

Collision and navigation are **derived**, not authored:

- `grid.ts` builds a walkability grid from `cells` + `walls` (a `wall`-kind edge blocks
  movement between the two cells it separates; `door`/`open`/`window` do not) +
  `objects` (occupied footprint cells are blocked unless `walkable: true`).
- The same module runs A* over that grid. This is what "are rooms connected," "can
  NPCs navigate," "is this spawn point reachable" resolve to — as code, not as a
  reading of a screenshot.

## Renderer (`src/render/`)

PixiJS. One `Container` per layer: floor, walls, objects, and toggleable overlays
(grid, collision, nav, room-bounds, spawns). Objects within the object layer sort by
`y + height * k` — real footprint/height data driving depth, not an arbitrary offset.
Camera is a single `world` container; pan/zoom/reset/frame-selected are transform math
on it (drag to pan, wheel to zoom clamped to a sane range, reset fits the whole map,
frame-selected fits the selected entity's bounds).

## Map Lab UI (`src/lab/`, route: the app's one page)

- Pixi canvas, live-rendering the loaded `MapDef`.
- Pan (drag), zoom (wheel), reset camera, frame selected object.
- Click-to-select an object/room; a plain-React side panel (`Inspector.tsx`) shows its
  raw fields, read from the same `MapDef`/grid the renderer drew — inspection cannot
  show something the renderer didn't actually draw.
- Layer-visibility checkboxes (floor / walls / objects / collision / nav / room-bounds
  / spawns), grid toggle.
- Coordinate + zoom readout in a status bar.
- **Editing is: change `src/map/restaurant.ts`, Vite HMR reloads the Lab.** There is no
  in-lab visual editor this phase — this is the largest cut from the original ask's
  literal wording, called out explicitly so it isn't assumed to exist.

## Restaurant test map (`src/map/restaurant.ts`)

Dining room, bar, kitchen, back room, staff/service area, front entrance, rear exit,
side exit, bathrooms, connecting corridors, placeholder furniture, player spawn, NPC
spawns. Simple colored placeholder shapes — no art pass.

## Testing (`src/map/__tests__/restaurant.test.ts`, Vitest)

The one runnable check per non-trivial logic path, on the data layer (no Pixi needed):

- Every room is reachable from the front entrance via A* over the derived grid.
- Every spawn point sits on a walkable cell inside its declared room.
- Every door/window/open edge joins two distinct rooms (or a room and the exterior via
  an `ExitDef`).
- No orphan (unreachable) rooms.

## Explicit non-goals this phase

- No player-controlled movement or mechanical wiring into Frontline's sim/state.
- No multi-floor stacking (the `level` field is reserved, unused).
- No in-lab visual map editor.
- No lighting/shaders beyond whatever's needed to see depth — that's a fast-follow
  once the foundation is visible and proven, not a requirement to ship this phase.
- No final art.

## Done means

- `npm test` (Vitest, in `maplab/`) passes, including the reachability/spawn/door
  assertions above.
- The Map Lab runs, renders the restaurant map, and every listed inspection feature
  (pan/zoom/select/layers/coordinates/collision/nav/room-bounds/reset/frame) works.
- `mafia/`'s own tests and build are untouched — this package cannot affect them by
  construction (no shared imports).
