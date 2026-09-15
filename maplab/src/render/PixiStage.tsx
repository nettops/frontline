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
            // pickWanderTarget only ever returns a findPath-verified cell, so `path`
            // here is never null — no retry-later branch needed for this call to fail.
            const path = findPath(map, currentCell, target);
            if (path) {
              mover.path = path;
              mover.pathStartMs = now;
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
