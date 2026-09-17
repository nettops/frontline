export default function StatusBar({
  cursorCell,
  mapName,
}: {
  cursorCell: { x: number; y: number } | null;
  mapName: string;
}) {
  return (
    <div style={{ gridColumn: '1 / -1', padding: '4px 12px', borderTop: '1px solid #332a22', fontSize: 12 }}>
      {mapName} · {cursorCell ? `cell (${cursorCell.x}, ${cursorCell.y})` : 'cell (—, —)'}
    </div>
  );
}
