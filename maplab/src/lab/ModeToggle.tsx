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
