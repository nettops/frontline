import { useMemo } from 'react';
import type { PlayerLook, RankId } from '../sim/types';
import { compose, paletteFor, SPRITE_H, SPRITE_W } from './art/parts';
import {
  KIT_NOTE,
  PLAYER_FIELDS,
  PLAYER_LABELS,
  PLAYER_OPTIONS,
  lookForPlayer,
  randomPlayerLook,
} from './art/playerLook';
import { paint, resolve } from './art/paint';
import { currentSkin } from './skin';
import { useEffect, useRef } from 'react';

/**
 * Who you are, before there is a game to be it in.
 *
 * Cyclers rather than a grid of swatches: five fields, one line each, and the
 * portrait redraws on every press. A grid would need thumbnails of every
 * option, which at this sprite size is forty tiny faces and a worse read than
 * one big one that changes.
 *
 * The preview is drawn at the rank you will actually start at, so what you
 * are looking at is the man on day one and not a promotional shot. The line
 * underneath says what the ladder is dressing you in, because otherwise the
 * absence of a hat looks like an option you failed to find.
 */
export function PlayerCustomiser({
  look,
  onChange,
  rank = 'street_criminal',
}: {
  look: PlayerLook;
  onChange: (next: PlayerLook) => void;
  rank?: RankId;
}) {
  const cycle = (key: keyof PlayerLook, dir: 1 | -1) => {
    const options = PLAYER_OPTIONS[key] as unknown[];
    const at = options.findIndex((o) => o === look[key]);
    const next = options[(at + dir + options.length) % options.length];
    onChange({ ...look, [key]: next });
  };

  return (
    <div className="customiser">
      <Preview look={look} rank={rank} />
      <div className="customiser-fields">
        {PLAYER_FIELDS.map(({ key, label }) => (
          <div className="customiser-row" key={key}>
            <span className="field-label">{label}</span>
            <div className="cycler">
              <button
                className="btn tiny"
                aria-label={`Previous ${label.toLowerCase()}`}
                onClick={() => cycle(key, -1)}
              >
                ‹
              </button>
              <span className="cycler-value">
                {PLAYER_LABELS[key]?.[String(look[key])] ?? String(look[key])}
              </span>
              <button
                className="btn tiny"
                aria-label={`Next ${label.toLowerCase()}`}
                onClick={() => cycle(key, 1)}
              >
                ›
              </button>
            </div>
          </div>
        ))}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn small" onClick={() => onChange(randomPlayerLook())}>
            Randomise
          </button>
        </div>
      </div>
    </div>
  );
}

function Preview({ look, rank }: { look: PlayerLook; rank: RankId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const skin = currentSkin();
  const scale = 4;
  // A whole Player is more than the preview needs, but building the look from
  // one keeps this and the in-game portrait on the same code path — a preview
  // that drew a different man from the game would be worse than none.
  const full = useMemo(
    () => lookForPlayer({ name: '', rank, look } as never),
    [look, rank],
  );
  const rows = useMemo(() => compose(full), [full]);
  const palette = useMemo(() => resolve(paletteFor(full), 100), [full, skin]);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    paint(ctx, rows, palette, scale, true);
  }, [rows, palette]);

  return (
    <figure className="customiser-preview">
      <canvas
        ref={ref}
        className="crew-portrait"
        width={SPRITE_W * scale}
        height={SPRITE_H * scale}
        aria-hidden="true"
      />
      <figcaption className="tiny faint">{KIT_NOTE[rank]}</figcaption>
    </figure>
  );
}
