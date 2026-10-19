// Adds the QR codes' sponsors to the app.
//
//   node scripts/sponsors.mjs ["QR Sponsor"]
//
// Each logo is an image named after its sponsor (e.g. "globe.png"; a "-logo" or "-ico" ending is
// dropped). For each one:
// 1. Its plain background (white, grey…) is taken out and the empty edges trimmed.
// 2. It's set on a white circle, as big as fits with a margin, and saved as a round badge in
//    public/assets/sponsors/<id>.webp (the game shows it on the QR code's top-right corner).
// 3. lib/sponsors.json lists them: each sponsor's id and badge.
// Run it again after adding or changing logos, and copy the badges to the admin (public/sponsors/).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..");
const SRC = path.resolve(ROOT, process.argv[2] ?? "QR Sponsor");
const OUT = path.join(ROOT, "public/assets/sponsors");
const MANIFEST = path.join(ROOT, "lib/sponsors.json");
const SIZE = 256; // the badge, in pixels
const FIT = 0.84; // the logo's diagonal, as a share of the circle's width: an even margin all round

const idOf = (file) =>
  file
    .replace(/\.[a-z]+$/i, "")
    .toLowerCase()
    .replace(/[-_ ](logo|ico|icon)$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The logo with its plain background made see-through (filled in from the edges) and trimmed. */
async function cutOut(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => (y * w + x) * 4;
  // The background: the corners' colour, if they're solid (a logo on a transparent page is left be)
  const c = px(0, 0);
  if (data[c + 3] > 200) {
    const bg = [data[c], data[c + 1], data[c + 2]];
    const near = (i) => data[i + 3] > 0 && Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) < 40;
    const seen = new Uint8Array(w * h);
    const todo = [];
    for (let x = 0; x < w; x++) todo.push([x, 0], [x, h - 1]);
    for (let y = 0; y < h; y++) todo.push([0, y], [w - 1, y]);
    while (todo.length) {
      const [x, y] = todo.pop();
      if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue;
      seen[y * w + x] = 1;
      const i = px(x, y);
      if (!near(i)) continue;
      data[i + 3] = 0;
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }
  // Trim to what's left
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[px(x, y) + 3] > 16) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) throw new Error(`${path.basename(file)}: nothing left after taking out the background`);
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .png()
    .toBuffer({ resolveWithObject: true });
}

if (!fs.existsSync(SRC)) {
  console.error(`No folder at ${SRC}`);
  process.exit(1);
}
const files = fs.readdirSync(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!files.length) {
  console.error(`No logos (.png, .jpg, .webp) in ${SRC}`);
  process.exit(1);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const disc = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#fff"/></svg>`);
const sponsors = {};
for (const f of files.sort()) {
  const id = idOf(f);
  const { data, info } = await cutOut(path.join(SRC, f));
  // As big as fits in the circle: its diagonal FIT of the way across
  const k = (FIT * SIZE) / Math.hypot(info.width, info.height);
  const lw = Math.max(1, Math.round(info.width * k));
  const lh = Math.max(1, Math.round(info.height * k));
  const logo = await sharp(data).resize(lw, lh).toBuffer();
  const out = path.join(OUT, `${id}.webp`);
  await sharp(disc)
    .composite([{ input: logo, left: Math.round((SIZE - lw) / 2), top: Math.round((SIZE - lh) / 2) }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(out);
  sponsors[id] = `/assets/sponsors/${id}.webp`;
  console.log(`${f}  ->  ${id}.webp  (${Math.round(fs.statSync(out).size / 1024)} KB)`);
}
fs.writeFileSync(MANIFEST, JSON.stringify(sponsors, null, 2) + "\n");
console.log(`${files.length} sponsor${files.length > 1 ? "s" : ""} -> lib/sponsors.json`);
