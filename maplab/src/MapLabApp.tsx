import { useRef, useState } from 'react';
import { restaurantMap } from './map/restaurant';
import PixiStage, { type PixiStageHandle, type SelectedEntity } from './render/PixiStage';
import Inspector from './lab/Inspector';
import LayerToggles, { DEFAULT_LAYER_VISIBILITY, type LayerVisibility } from './lab/LayerToggles';
import StatusBar from './lab/StatusBar';

export default function MapLabApp() {
  const [selected, setSelected] = useState<SelectedEntity>(null);
  const [cursorCell, setCursorCell] = useState<{ x: number; y: number } | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
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
      <LayerToggles value={layers} onChange={setLayers} />
      <div style={{ position: 'relative' }}>
        <PixiStage
          map={restaurantMap}
          layerVisibility={layers}
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
