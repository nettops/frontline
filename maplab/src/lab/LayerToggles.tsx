import type { LayerVisibility } from '../render/layers';

const LABELS: Record<keyof LayerVisibility, string> = {
  floor: 'Floor', walls: 'Walls', objects: 'Objects', grid: 'Grid',
  collision: 'Collision', nav: 'Navigation', roomBounds: 'Room bounds', spawns: 'Spawns',
};

export default function LayerToggles({
  value,
  onChange,
}: {
  value: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
}) {
  return (
    <aside style={{ padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>Layers</h3>
      {(Object.keys(LABELS) as (keyof LayerVisibility)[]).map((key) => (
        <label key={key} style={{ display: 'block', marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />{' '}
          {LABELS[key]}
        </label>
      ))}
    </aside>
  );
}
