/**
 * Walking, read from the camera feed, for phones without WebXR (iPhones, Android phones without ARCore,
 * in-app browsers). Small patches of the picture are followed from frame to frame (pyramidal
 * Lucas–Kanade optical flow): when they spread apart the phone moved toward the scene, when they draw
 * together it backed away. Turning is left to the motion sensors; this only measures the zoom.
 * Each camera frame is shrunk on the GPU and read back without waiting for it, so the scanner keeps
 * its frame rate.
 */
import * as THREE from "three";

const SHORT = 144; // the picture is analysed this small (short side, px)
const LEVELS = 3; // pyramid: full, ½ and ¼ size, for fast movement
const R = 4; // tracking window radius: 9×9 px
const ITERS = 10;
const MIN_EIG = 2; // texture a patch needs to be followed (smallest eigenvalue, grey levels² per px)
const CORNER_EIG = 10; // ...and to be picked as a new point
const CELL = 16; // at most one point per 16×16 px cell
const MAX_POINTS = 64;
const KEEP = 28; // pick new points when fewer than this are still followed
const MIN_PAIR = 24; // only points at least this far apart judge the zoom
const FB_ERR = 0.6; // a point must track back to within this many px of where it started
const STILL = 0.0008; // zoom steps smaller than this (log) are noise
const SPREAD = 0.04; // pairs disagree more than this (log, median deviation): not a clean zoom

type Level = { w: number; h: number; img: Float32Array; gx: Float32Array; gy: Float32Array };

function pyramid(w: number, h: number): Level[] {
  const out: Level[] = [];
  for (let l = 0; l < LEVELS; l++, w >>= 1, h >>= 1) {
    out.push({ w, h, img: new Float32Array(w * h), gx: new Float32Array(w * h), gy: new Float32Array(w * h) });
  }
  return out;
}

/** Grey picture, its smaller copies, and their gradients. */
function fill(p: Level[], rgba: Uint8Array) {
  const top = p[0].img;
  for (let i = 0; i < top.length; i++) top[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  for (let l = 1; l < p.length; l++) {
    const a = p[l - 1];
    const b = p[l];
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const i = 2 * y * a.w + 2 * x;
        b.img[y * b.w + x] = 0.25 * (a.img[i] + a.img[i + 1] + a.img[i + a.w] + a.img[i + a.w + 1]);
      }
  }
  for (const { w, h, img, gx, gy } of p)
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        gx[i] = 0.5 * (img[i + 1] - img[i - 1]);
        gy[i] = 0.5 * (img[i + w] - img[i - w]);
      }
}

/** Bilinear sample; (x, y) must be inside [0, w−1) × [0, h−1). */
function at(img: Float32Array, w: number, x: number, y: number) {
  const x0 = x | 0;
  const y0 = y | 0;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * w + x0;
  const a = img[i];
  const b = img[i + 1];
  const c = img[i + w];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + img[i + w + 1]) * fx * fy;
}

const inside = (l: Level, x: number, y: number) => x - R >= 0 && y - R >= 0 && x + R < l.w - 1 && y + R < l.h - 1;

const N = (2 * R + 1) ** 2;
const winI = new Float32Array(N);
const winX = new Float32Array(N);
const winY = new Float32Array(N);

/** Where the patch at (x, y) in picture A went in picture B (into `out`); false if it was lost. */
function track(A: Level[], B: Level[], x: number, y: number, out: Float32Array) {
  let gx = 0;
  let gy = 0;
  for (let l = LEVELS - 1; l >= 0; l--) {
    const a = A[l];
    const b = B[l];
    const px = x / (1 << l);
    const py = y / (1 << l);
    if (!inside(a, px, py)) return false;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (let j = -R, k = 0; j <= R; j++)
      for (let i = -R; i <= R; i++, k++) {
        const ix = at(a.gx, a.w, px + i, py + j);
        const iy = at(a.gy, a.w, px + i, py + j);
        winI[k] = at(a.img, a.w, px + i, py + j);
        winX[k] = ix;
        winY[k] = iy;
        sxx += ix * ix;
        sxy += ix * iy;
        syy += iy * iy;
      }
    const det = sxx * syy - sxy * sxy;
    const minEig = (sxx + syy - Math.sqrt((sxx - syy) ** 2 + 4 * sxy * sxy)) / 2 / N;
    if (minEig < MIN_EIG || det <= 0) return false;
    let vx = 0;
    let vy = 0;
    for (let it = 0; it < ITERS; it++) {
      const qx = px + gx + vx;
      const qy = py + gy + vy;
      if (!inside(b, qx, qy)) return false;
      let bx = 0;
      let by = 0;
      for (let j = -R, k = 0; j <= R; j++)
        for (let i = -R; i <= R; i++, k++) {
          const d = winI[k] - at(b.img, b.w, qx + i, qy + j);
          bx += d * winX[k];
          by += d * winY[k];
        }
      const ex = (syy * bx - sxy * by) / det;
      const ey = (sxx * by - sxy * bx) / det;
      vx += ex;
      vy += ey;
      if (ex * ex + ey * ey < 1e-3) break;
    }
    gx = l ? 2 * (gx + vx) : gx + vx;
    gy = l ? 2 * (gy + vy) : gy + vy;
  }
  out[0] = x + gx;
  out[1] = y + gy;
  return true;
}

/** Adds the best corner of each empty cell in the middle of the picture; returns the new count. */
function pick(l: Level, pts: Float32Array, n: number) {
  const x0 = Math.round(l.w * 0.1);
  const y0 = Math.round(l.h * 0.1);
  const cols = Math.floor((l.w * 0.8) / CELL);
  const rows = Math.floor((l.h * 0.8) / CELL);
  const taken = new Uint8Array(cols * rows);
  for (let i = 0; i < n; i++) {
    const c = Math.floor((pts[2 * i] - x0) / CELL);
    const r = Math.floor((pts[2 * i + 1] - y0) / CELL);
    if (c >= 0 && r >= 0 && c < cols && r < rows) taken[r * cols + c] = 1;
  }
  const { w, gx, gy } = l;
  for (let r = 0; r < rows && n < MAX_POINTS; r++)
    for (let c = 0; c < cols && n < MAX_POINTS; c++) {
      if (taken[r * cols + c]) continue;
      let best = CORNER_EIG;
      let bx = -1;
      let by = -1;
      for (let y = y0 + r * CELL + 2; y < y0 + (r + 1) * CELL - 2; y += 2)
        for (let x = x0 + c * CELL + 2; x < x0 + (c + 1) * CELL - 2; x += 2) {
          let sxx = 0;
          let sxy = 0;
          let syy = 0;
          for (let j = -2; j <= 2; j++)
            for (let i = -2; i <= 2; i++) {
              const q = (y + j) * w + x + i;
              sxx += gx[q] * gx[q];
              sxy += gx[q] * gy[q];
              syy += gy[q] * gy[q];
            }
          const e = (sxx + syy - Math.sqrt((sxx - syy) ** 2 + 4 * sxy * sxy)) / 50;
          if (e > best) {
            best = e;
            bx = x;
            by = y;
          }
        }
      if (bx >= 0) {
        pts[2 * n] = bx;
        pts[2 * n + 1] = by;
        n++;
      }
    }
  return n;
}

const logs = new Float32Array((MAX_POINTS * (MAX_POINTS - 1)) / 2);
const devs = new Float32Array(logs.length);

/** How much the points spread apart from `a` to `b` (1 = not at all), or 1 when it's unclear. */
function zoomOf(a: Float32Array, b: Float32Array, n: number) {
  let k = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d0 = (a[2 * i] - a[2 * j]) ** 2 + (a[2 * i + 1] - a[2 * j + 1]) ** 2;
      if (d0 < MIN_PAIR * MIN_PAIR) continue;
      const d1 = (b[2 * i] - b[2 * j]) ** 2 + (b[2 * i + 1] - b[2 * j + 1]) ** 2;
      logs[k++] = 0.5 * Math.log(d1 / d0);
    }
  if (k < 24) return 1;
  const s = logs.subarray(0, k).sort();
  const med = s[k >> 1];
  for (let i = 0; i < k; i++) devs[i] = Math.abs(s[i] - med);
  const spread = devs.subarray(0, k).sort()[k >> 1];
  // People walking past, a fast swing or a blur: the pairs disagree, so it wasn't the phone moving
  if (spread > SPREAD || Math.abs(med) > 0.15 || Math.abs(med) < STILL) return 1;
  return Math.exp(med);
}

// Shrinks the camera picture to grey at analysis size: 4×4 taps per output pixel, so fine detail
// averages out instead of flickering
const SHRINK_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
const SHRINK_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 tap;
varying vec2 vUv;
void main() {
  float sum = 0.0;
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++)
      sum += dot(texture2D(map, vUv + (vec2(i, j) - 1.5) * tap).rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(vec3(sum / 16.0), 1.0);
}`;

export type ZoomTracker = {
  /** Call every frame: how much the picture zoomed since the last call (above 1: moved closer). */
  take: () => number;
  /** Forget the points (the camera stopped or restarted). */
  reset: () => void;
  dispose: () => void;
};

export function createZoomTracker(renderer: THREE.WebGLRenderer, video: HTMLVideoElement): ZoomTracker {
  const tex = new THREE.VideoTexture(video);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, tap: { value: new THREE.Vector2() } },
    vertexShader: SHRINK_VERT,
    fragmentShader: SHRINK_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const shrink = new THREE.Scene().add(quad);
  const flat = new THREE.Camera();
  const rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  let buf = new Uint8Array(4);

  let prev: Level[] | null = null;
  let next: Level[] | null = null;
  const pts = new Float32Array(MAX_POINTS * 2);
  const from = new Float32Array(MAX_POINTS * 2);
  const to = new Float32Array(MAX_POINTS * 2);
  const fwd = new Float32Array(2);
  const back = new Float32Array(2);
  let n = 0;
  let primed = false;
  let zoom = 1; // measured since the last take()
  let reading = false;
  let round = 0; // bumped by reset(): reads already under way are dropped
  let dead = false;

  // Only look at new camera frames
  let fresh = false;
  let lastTime = -1;
  let rvfc = 0;
  const rvfcOk = typeof video.requestVideoFrameCallback === "function";
  const onFrame = () => {
    fresh = true;
    rvfc = video.requestVideoFrameCallback(onFrame);
  };
  if (rvfcOk) rvfc = video.requestVideoFrameCallback(onFrame);
  const isNew = () => {
    if (rvfcOk) {
      const was = fresh;
      fresh = false;
      return was;
    }
    if (video.currentTime === lastTime) return false;
    lastTime = video.currentTime;
    return true;
  };

  const step = (frame: Uint8Array) => {
    if (!prev || !next) return;
    fill(next, frame);
    if (primed && n) {
      // Follow each point forward, then back again: keep it only if it returns to where it started
      let m = 0;
      for (let i = 0; i < n; i++) {
        const x = pts[2 * i];
        const y = pts[2 * i + 1];
        if (!track(prev, next, x, y, fwd) || !track(next, prev, fwd[0], fwd[1], back)) continue;
        if ((back[0] - x) ** 2 + (back[1] - y) ** 2 > FB_ERR * FB_ERR) continue;
        from[2 * m] = x;
        from[2 * m + 1] = y;
        to[2 * m] = fwd[0];
        to[2 * m + 1] = fwd[1];
        m++;
      }
      zoom *= zoomOf(from, to, m);
      pts.set(to.subarray(0, 2 * m));
      n = m;
    }
    if (n < KEEP) n = pick(next[0], pts, n);
    [prev, next] = [next, prev];
    primed = true;
  };

  // Shrink the newest camera frame on the GPU, and read it back once it's ready
  const grab = () => {
    if (reading || !isNew() || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    const k = SHORT / Math.min(video.videoWidth, video.videoHeight);
    const w = Math.round(video.videoWidth * k);
    const h = Math.round(video.videoHeight * k);
    if (!prev || !next || prev[0].w !== w || prev[0].h !== h) {
      prev = pyramid(w, h);
      next = pyramid(w, h);
      buf = new Uint8Array(w * h * 4);
      rt.setSize(w, h);
      mat.uniforms.tap.value.set(1 / (4 * w), 1 / (4 * h));
      n = 0;
      primed = false;
    }
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(shrink, flat);
    renderer.setRenderTarget(target);
    reading = true;
    const r = round;
    renderer
      .readRenderTargetPixelsAsync(rt, 0, 0, w, h, buf)
      .then((frame) => {
        if (!dead && r === round) step(frame as Uint8Array);
      })
      .catch(() => {})
      .finally(() => {
        reading = false;
      });
  };

  return {
    take: () => {
      grab();
      const z = zoom;
      zoom = 1;
      return z;
    },
    reset: () => {
      round++;
      n = 0;
      primed = false;
      zoom = 1;
    },
    dispose: () => {
      dead = true;
      if (rvfcOk) video.cancelVideoFrameCallback(rvfc);
      rt.dispose();
      tex.dispose();
      mat.dispose();
      quad.geometry.dispose();
    },
  };
}
