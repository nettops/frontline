export interface Transform { x: number; y: number; scale: number; }
export interface Size { width: number; height: number; }
export interface Bounds { x: number; y: number; width: number; height: number; }

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** A transform that centers `bounds` in `viewport`, leaving `padding` px of margin. */
export function fitTransform(bounds: Bounds, viewport: Size, padding = 32): Transform {
  const availW = Math.max(1, viewport.width - padding * 2);
  const availH = Math.max(1, viewport.height - padding * 2);
  const scale = clampZoom(Math.min(availW / bounds.width, availH / bounds.height));
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return {
    scale,
    x: viewport.width / 2 - cx * scale,
    y: viewport.height / 2 - cy * scale,
  };
}
