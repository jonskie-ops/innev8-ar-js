// Where a QR code sits in 3D, from the four corners the scanner finds in the camera image.

export type Pt = { x: number; y: number };

/** The code's corners in its own plane: a unit square around the centre, y pointing down like the image. */
const SQUARE = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
];

/** Solves A·x = b (n×n) by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  const x = new Array<number>(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Homography (row-major 3×3) taking the unit square onto the four image points. */
function homography(img: Pt[]): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  SQUARE.forEach(([X, Y], i) => {
    const { x: u, y: v } = img[i];
    A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]);
    b.push(u);
    A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]);
    b.push(v);
  });
  const h = solve(A, b);
  return h && [...h, 1];
}

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3) => scale(a, 1 / norm(a));
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Pose of a QR code seen by a pinhole camera with focal length `f` and principal point (cx, cy),
 * all in screen pixels. `corners` are the code's top-left, top-right, bottom-right and bottom-left.
 *
 * Returns a column-major 4×4 matrix (three.js `Matrix4.fromArray`) in three.js camera space
 * (x right, y up, z toward the viewer). The code's own axes: x to its right edge, y to its top
 * edge, z out of the code toward the camera. One unit is the code's side length.
 */
export function qrPose(corners: Pt[], f: number, cx: number, cy: number): number[] | null {
  const H = homography(corners);
  if (!H) return null;
  // K⁻¹·H: its columns are the code's x and y axes and its centre, up to one scale factor.
  const col = (j: number): V3 => [(H[j] - cx * H[6 + j]) / f, (H[3 + j] - cy * H[6 + j]) / f, H[6 + j]];
  let r1 = col(0);
  let r2 = col(1);
  let t = col(2);
  let k = 2 / (norm(r1) + norm(r2));
  if (t[2] * k < 0) k = -k; // keep the code in front of the camera
  r1 = unit(scale(r1, k));
  r2 = scale(r2, k);
  r2 = unit([r2[0] - dot(r1, r2) * r1[0], r2[1] - dot(r1, r2) * r1[1], r2[2] - dot(r1, r2) * r1[2]]);
  const r3 = cross(r1, r2);
  t = scale(t, k);

  // The math above uses image conventions (y down, z away). Flip y and z on both sides
  // (D·R·D, D·t with D = diag(1, -1, -1)) to get three.js conventions for camera and code.
  const R = [r1, r2, r3]; // columns
  const d = [1, -1, -1];
  const m = (i: number, j: number) => d[i] * d[j] * R[j][i];
  return [m(0, 0), m(1, 0), m(2, 0), 0, m(0, 1), m(1, 1), m(2, 1), 0, m(0, 2), m(1, 2), m(2, 2), 0, t[0], -t[1], -t[2], 1];
}
