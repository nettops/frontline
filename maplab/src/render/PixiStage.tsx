import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import type { MapDef, MapObject, SpawnPoint } from '../map/types';
import { buildWalkGrid } from '../map/grid';
import { buildMapLayers, mapPixelBounds, type MapLayers, type SelectableGraphics } from './layers';
import { fitTransform } from './camera';
import type { LayerVisibility } from '../lab/LayerToggles';

export type SelectedEntity = MapObject | SpawnPoint | null;

export interface PixiStageHandle {
  resetCamera: () => void;
  frameSelected: () => void;
}

interface Props {
  map: MapDef;
  layerVisibility: LayerVisibility;
  onSelect: (entity: SelectedEntity) => void;
  onPointerMove: (cell: { x: number; y: number } | null) => void;
  registerHandle: (handle: PixiStageHandle) => void;
}

export default function PixiStage({ map, layerVisibility, onSelect, onPointerMove, registerHandle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<MapLayers | null>(null);
  const selectedRef = useRef<SelectedEntity>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const app = new Application();

    (async () => {
      await app.init({ background: 0x0a0908, resizeTo: host, antialias: false });
      if (disposed) { app.destroy(true); return; }
      host.appendChild(app.canvas);
      appRef.current = app;

      const grid = buildWalkGrid(map);
      const layers = buildMapLayers(map, grid);
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
          const w = 'footprint' in sel ? sel.footprint.w : 2;
          const h = 'footprint' in sel ? sel.footprint.h : 2;
          const selBounds = {
            x: sel.x * map.grid.cellSize,
            y: sel.y * map.grid.cellSize,
            width: w * map.grid.cellSize,
            height: h * map.grid.cellSize,
          };
          applyTransform(fitTransform(selBounds, { width: host.clientWidth, height: host.clientHeight }, 80));
        },
      });

      let dragging = false;
      let last = { x: 0, y: 0 };
      app.stage.on('pointerdown', (e) => { dragging = true; last = { x: e.global.x, y: e.global.y }; });
      app.stage.on('pointerup', () => { dragging = false; });
      app.stage.on('pointerupoutside', () => { dragging = false; });
      app.stage.on('pointermove', (e) => {
        const local = layers.world.toLocal(e.global);
        onPointerMove({ x: Math.floor(local.x / map.grid.cellSize), y: Math.floor(local.y / map.grid.cellSize) });
        if (!dragging) return;
        const dx = e.global.x - last.x;
        const dy = e.global.y - last.y;
        last = { x: e.global.x, y: e.global.y };
        layers.world.position.set(layers.world.position.x + dx, layers.world.position.y + dy);
      });
      host.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          const nextScale = Math.min(4, Math.max(0.25, layers.world.scale.x * factor));
          layers.world.scale.set(nextScale);
        },
        { passive: false },
      );

      for (const child of [...layers.objects.children, ...layers.spawns.children] as SelectableGraphics[]) {
        child.on('pointertap', () => handleSelect(child.mapEntity ?? null));
      }

      forceRender((n) => n + 1); // now that layersRef is populated, re-run the visibility effect
    })();

    return () => {
      disposed = true;
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
