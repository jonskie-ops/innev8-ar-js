// Builds the installed app's icons from the INNEV8 icon (public/assets/img/favicon.svg).
//
//   node scripts/app-icons.mjs
//
// icon-*.png: the icon as it is (rounded corners). maskable-*.png: for Android, which crops icons
// to its own shape (circle, squircle…): the background fills the square and the mark is scaled into
// the middle 80%, the part every shape keeps. Written to public/assets/img/app/.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..");
const SVG = fs.readFileSync(path.join(ROOT, "public/assets/img/favicon.svg"), "utf8");
const OUT = path.join(ROOT, "public/assets/img/app");
fs.mkdirSync(OUT, { recursive: true });

// The maskable version: square corners, and everything after the background inside a scaled group
const bg = SVG.match(/<rect [^>]*rx="\d+"\/>/);
if (!bg) throw new Error("favicon.svg: no rounded background rect found");
const [head, rest] = SVG.split(bg[0]);
const body = rest.replace(/<\/svg>\s*$/, "");
const MASKABLE = `${head}${bg[0].replace(/ rx="\d+"/, "")}<g transform="translate(685 685) scale(0.78) translate(-685 -685)">${body}</g></svg>`;

for (const [name, svg] of [
  ["icon", SVG],
  ["maskable", MASKABLE],
]) {
  for (const size of [192, 512]) {
    const file = path.join(OUT, `${name}-${size}.png`);
    await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
    console.log(`${path.relative(ROOT, file)}  (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  }
}
