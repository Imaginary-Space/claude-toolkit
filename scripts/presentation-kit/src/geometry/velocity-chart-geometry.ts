/**
 * SVG path math used by the velocity chart slide. Pure functions — safe to
 * reuse in non-presentation contexts (roadmap views, mini sparkline embeds).
 */

export function valuesToXY(values: number[], max: number): { x: number; y: number }[] {
  const n = values.length;
  return values.map((v, i) => ({ x: (i / (n - 1)) * 1000, y: 1000 - (v / max) * 1000 }));
}

export function xyToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
    d += ` C ${cpx1},${prev.y} ${cpx2},${curr.y} ${curr.x},${curr.y}`;
  }
  return d;
}

export function valuesToPath(values: number[], max: number): string {
  if (values.length === 0) return "";
  return xyToPath(valuesToXY(values, max));
}

export function fillBetweenPaths(upperVals: number[], lowerVals: number[], max: number): string {
  if (upperVals.length === 0 || lowerVals.length === 0) return "";
  const upper = valuesToXY(upperVals, max);
  const lower = valuesToXY(lowerVals, max);
  let d = xyToPath(upper);
  const lowerRev = [...lower].reverse();
  for (let i = 0; i < lowerRev.length; i++) {
    if (i === 0) {
      d += ` L ${lowerRev[0].x},${lowerRev[0].y}`;
    } else {
      const prev = lowerRev[i - 1];
      const curr = lowerRev[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
      d += ` C ${cpx1},${prev.y} ${cpx2},${curr.y} ${curr.x},${curr.y}`;
    }
  }
  d += " Z";
  return d;
}

export function valuesToPoints(values: number[], max: number): number[][] {
  if (values.length === 0) return [];
  const n = values.length;
  return values.map((v, i) => [(i / (n - 1)) * 1000 - 2, 1000 - (v / max) * 1000 - 2]);
}

/** Pad or trim to 5 points (Mon–Fri), matching presentation velocity slides. */
export function padVelocitySeries(arr: number[]): number[] {
  if (arr.length === 0) return arr;
  if (arr.length >= 5) return arr.slice(0, 5);
  const last = arr[arr.length - 1];
  return [...arr, ...Array(5 - arr.length).fill(last)];
}
