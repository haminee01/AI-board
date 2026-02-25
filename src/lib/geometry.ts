/**
 * 점 (px, py)에서 선분 (x1,y1)-(x2,y2)까지의 거리
 */
export function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export function getLineBoundingBox(points: number[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (points.length < 2) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = points[0]!;
  let minY = points[1]!;
  let maxX = minX;
  let maxY = minY;
  for (let i = 2; i < points.length; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function rectsIntersect(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

export function pointInRect(
  px: number,
  py: number,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return px >= x && px <= x + width && py >= y && py <= y + height;
}

export function pointInEllipse(
  px: number,
  py: number,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;
  if (rx <= 0 || ry <= 0) return false;
  return (px - cx) ** 2 / rx ** 2 + (py - cy) ** 2 / ry ** 2 <= 1;
}

/** 삼각형: (x, y+height), (x+width/2, y), (x+width, y+height) */
export function pointInTriangle(
  px: number,
  py: number,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const x1 = x;
  const y1 = y + height;
  const x2 = x + width / 2;
  const y2 = y;
  const x3 = x + width;
  const y3 = y + height;
  const sign = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
  ) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d1 = sign(px, py, x1, y1, x2, y2);
  const d2 = sign(px, py, x2, y2, x3, y3);
  const d3 = sign(px, py, x3, y3, x1, y1);
  return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
}
