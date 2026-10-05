export const VIEW = { width: 1000, height: 560 };
export const NODE = { width: 156, height: 52 };

const PAD_X = NODE.width / 2 + 8;
const PAD_Y = NODE.height / 2 + 12;

export function toView(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(PAD_X + (x / 100) * (VIEW.width - PAD_X * 2)),
    y: Math.round(PAD_Y + (y / 100) * (VIEW.height - PAD_Y * 2)),
  };
}

type Point = { x: number; y: number };

// Distance from a rectangle's centre to its border along direction (dx, dy).
function borderDistance(dx: number, dy: number): number {
  const hw = NODE.width / 2;
  const hh = NODE.height / 2;
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
  return Math.min(tx, ty);
}

export function edgePath(from: Point, to: Point): { d: string; mid: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const start = borderDistance(ux, uy) + 4;
  const end = borderDistance(ux, uy) + 8; // leave room for the arrow head
  const r = (n: number) => Math.round(n * 10) / 10;
  const sx = r(from.x + ux * start);
  const sy = r(from.y + uy * start);
  const ex = r(to.x - ux * end);
  const ey = r(to.y - uy * end);
  return { d: `M ${sx} ${sy} L ${ex} ${ey}`, mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } };
}
