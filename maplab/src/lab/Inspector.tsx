import type { SelectedEntity } from '../map/types';

export default function Inspector({ entity }: { entity: SelectedEntity }) {
  return (
    <aside style={{ padding: 12, borderLeft: '1px solid #332a22', overflow: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Inspector</h3>
      {!entity ? (
        <p>Click an object or spawn point to inspect it.</p>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(entity, null, 2)}</pre>
      )}
    </aside>
  );
}
