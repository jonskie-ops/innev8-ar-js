// Builds the mascot's transparent talking sprite from an animated GIF on a white background.
//
//   node scripts/mascot.mjs <animation.gif>
//
// 1. Cuts every frame out of its white background: the background is filled in from the corners
//    (the outline keeps it out of the white fur), and the outline's soft edge is un-matted from
//    the white so it sits cleanly on the dark app.
// 2. Finds the shortest seamless loop (2.4–5 s, starting on a closed mouth) and the frames in it
//    where his mouth is closed.
// 3. Writes public/assets/img/mascot/talk.webp (the loop as a sprite sheet, 6 across) and idle.webp
//    (its first frame), and prints the numbers to put in components/Mascot.tsx (TALK and REST).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const gif = process.argv[2];
if (!gif) {
  console.error("Usage: node scripts/mascot.mjs <animation.gif>");
  process.exit(1);
}
const OUT = path.join(import.meta.dirname, "../public/assets/img/mascot");
const CELL_W = 320; // ~160 CSS px on 2x screens
const COLS = 6;
const QUALITY = 70;

// ---- 1. Cut-out
const BG_MIN = 236; // background: every channel at least this
const WALL_MIN = 225; // darker pixels, grown by 1 px, stop the fill (closes hairline gaps in the outline)
const BAND_DEPTH = 4; // soft edge: up to this many px in from the background...
const BAND_TOL = 3; // ...stepping only to pixels no lighter than this, so it stops at the outline

const meta = await sharp(gif, { animated: true }).metadata();
const { data: src, info } = await sharp(gif, { animated: true }).raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = meta.pageHeight;
const N = info.height / H;
const P = W * H;
const out = Buffer.alloc(src.length);
const minC = new Uint8Array(P);
const wall = new Uint8Array(P);
const bg = new Uint8Array(P);
const depth = new Uint8Array(P);
const stack = new Int32Array(P * 4);
const N4 = [-1, 1, -W, W];
const inside = (p, d) => p + d >= 0 && p + d < P && !(d === -1 && p % W === 0) && !(d === 1 && p % W === W - 1);

for (let f = 0; f < N; f++) {
  const o = f * P * 4;
  for (let p = 0; p < P; p++) minC[p] = Math.min(src[o + p * 4], src[o + p * 4 + 1], src[o + p * 4 + 2]);
  wall.fill(0);
  for (let p = 0; p < P; p++) {
    if (minC[p] >= WALL_MIN) continue;
    const x = p % W;
    const y = (p / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) wall[(y + dy) * W + x + dx] = 1;
  }
  // From the corners only: parts of him (an ear, the shirt) run off the frame's edges
  bg.fill(0);
  let sp = 0;
  for (const p of [0, W - 1, P - W, P - 1])
    if (minC[p] >= BG_MIN && !wall[p]) {
      bg[p] = 1;
      stack[sp++] = p;
    }
  while (sp) {
    const p = stack[--sp];
    for (const d of N4)
      if (inside(p, d) && !bg[p + d] && !wall[p + d] && minC[p + d] >= BG_MIN) {
        bg[p + d] = 1;
        stack[sp++] = p + d;
      }
  }
  depth.fill(0);
  sp = 0;
  for (let p = 0; p < P; p++)
    if (!bg[p] && N4.some((d) => inside(p, d) && bg[p + d])) {
      depth[p] = 1;
      stack[sp++] = p;
    }
  for (let head = 0; head < sp; head++) {
    const p = stack[head];
    if (depth[p] >= BAND_DEPTH) continue;
    for (const d of N4) {
      const q = p + d;
      if (inside(p, d) && !bg[q] && !depth[q] && minC[q] <= minC[p] + BAND_TOL) {
        depth[q] = depth[p] + 1;
        stack[sp++] = q;
      }
    }
  }
  for (let p = 0; p < P; p++) {
    const i = o + p * 4;
    if (bg[p]) continue; // stays transparent black
    if (!depth[p]) {
      src.copy(out, i, i, i + 3);
      out[i + 3] = 255;
      continue;
    }
    const a = 1 - minC[p] / 255; // un-matte the white
    if (a <= 0.004) continue;
    for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, Math.round((src[i + c] - (1 - a) * 255) / a)));
    out[i + 3] = Math.round(a * 255);
  }
}

// ---- 2. Mouth and loop
const mouth = []; // red/pink mouth-interior pixels in the lower face
for (let f = 0; f < N; f++) {
  let n = 0;
  for (let y = Math.round(H * 0.46); y < Math.round(H * 0.78); y++)
    for (let x = Math.round(W * 0.3); x < Math.round(W * 0.85); x++) {
      const i = (f * P + y * W + x) * 4;
      if (out[i + 3] > 200 && out[i] > 110 && out[i] - out[i + 1] > 55 && out[i] - out[i + 2] > 35) n++;
    }
  mouth.push(n);
}
const closed = (f) => mouth[f] <= 15;
const S = 40;
const sig = Array.from({ length: N }, (_, f) => {
  const s = new Float32Array(S * S);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (f * P + y * W + x) * 4;
      const a = out[i + 3] / 255;
      s[Math.floor((y * S) / H) * S + Math.floor((x * S) / W)] += a * (0.3 * out[i] + 0.59 * out[i + 1] + 0.11 * out[i + 2]) + (1 - a) * 128;
    }
  return s.map((v) => v / ((W / S) * (H / S)));
});
const diff = (a, b) => sig[a].reduce((d, v, i) => d + Math.abs(v - sig[b][i]), 0) / (S * S);
const loops = [];
for (let i = 0; i < N; i++) {
  if (!closed(i)) continue;
  let ms = 0;
  for (let j = i + 1; j < N && ms <= 5000; j++) {
    ms += meta.delay[j - 1];
    if (ms >= 2400 && ms <= 5000) loops.push({ i, j, ms, seam: diff(i, j) });
  }
}
const good = loops.filter((l) => l.seam < 0.6);
const pick = (good.length ? good : loops).sort((a, b) => a.ms - b.ms || a.seam - b.seam)[0];
if (!pick) throw new Error("No seamless loop of 2.4–5 s starting on a closed mouth");
const FROM = pick.i;
const COUNT = pick.j - pick.i;

// ---- 3. Export
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let f = FROM; f < FROM + COUNT; f++)
  for (let p = 0; p < P; p++)
    if (out[(f * P + p) * 4 + 3] > 8) {
      const x = p % W;
      const y = (p / W) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
const cw = x1 - x0 + 1;
const ch = y1 - y0 + 1;
const CELL_H = Math.round((CELL_W * ch) / cw);
const cells = [];
for (let f = FROM; f < FROM + COUNT; f++)
  cells.push(
    await sharp(out.subarray(f * P * 4, (f + 1) * P * 4), { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: x0, top: y0, width: cw, height: ch })
      .resize(CELL_W, CELL_H, { kernel: "lanczos3" })
      .raw()
      .toBuffer(),
  );
const ROWS = Math.ceil(COUNT / COLS);
const sheet = await sharp({ create: { width: CELL_W * COLS, height: CELL_H * ROWS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells.map((c, k) => ({ input: c, raw: { width: CELL_W, height: CELL_H, channels: 4 }, left: (k % COLS) * CELL_W, top: Math.floor(k / COLS) * CELL_H })))
  .png()
  .toBuffer();
fs.mkdirSync(OUT, { recursive: true });
await sharp(sheet).webp({ quality: QUALITY, alphaQuality: 90, effort: 6, smartSubsample: true }).toFile(path.join(OUT, "talk.webp"));
await sharp(cells[0], { raw: { width: CELL_W, height: CELL_H, channels: 4 } }).webp({ quality: 88, alphaQuality: 90, effort: 6 }).toFile(path.join(OUT, "idle.webp"));

const fps = Math.round((COUNT * 1000) / pick.ms);
const rest = Array.from({ length: COUNT }, (_, k) => k).filter((k) => closed(FROM + k));
console.log(`${N} frames cut out. Loop: source frames ${FROM}–${FROM + COUNT - 1} (${COUNT} frames, ${(pick.ms / 1000).toFixed(2)} s, seam ${pick.seam.toFixed(2)})`);
console.log(`talk.webp ${(fs.statSync(path.join(OUT, "talk.webp")).size / 1024).toFixed(0)} KB, idle.webp ${(fs.statSync(path.join(OUT, "idle.webp")).size / 1024).toFixed(0)} KB`);
console.log("In components/Mascot.tsx:");
console.log(`const TALK = { src: "/assets/img/mascot/talk.webp", cols: ${COLS}, frames: ${COUNT}, w: ${CELL_W}, h: ${CELL_H}, fps: ${fps} };`);
console.log(`const REST = new Set([${rest.join(", ")}]);`);
