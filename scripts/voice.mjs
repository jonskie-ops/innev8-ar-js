// Adds Qufoo's voice clips to the app.
//
//   node scripts/voice.mjs ["Qufoo voice lines"]
//
// Each clip is an MP3 named after the line it says, e.g. "Let's get you signed up first!.mp3"
// (a file name can't hold ? : " * / so leave those out; they're ignored when matching).
// 1. Copies every clip to public/assets/audio/qufoo/ under a web-safe name.
// 2. Writes lib/voice-clips.json: each line (as lib/voice.ts matches it) and its clip. A line with
//    a clip is said out loud; the rest stay text only. Run it again after adding or changing clips.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SRC = path.resolve(ROOT, process.argv[2] ?? "Qufoo voice lines");
const OUT = path.join(ROOT, "public/assets/audio/qufoo");
const MANIFEST = path.join(ROOT, "lib/voice-clips.json");

// The same as voiceKey in lib/voice.ts: letters and numbers only
const voiceKey = (text) =>
  text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

if (!fs.existsSync(SRC)) {
  console.error(`No folder at ${SRC}`);
  process.exit(1);
}
const files = fs.readdirSync(SRC).filter((f) => /\.mp3$/i.test(f));
if (!files.length) {
  console.error(`No .mp3 files in ${SRC}`);
  process.exit(1);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// Two recordings of the same words: the newer one is used
const byKey = new Map();
for (const f of files) {
  const key = voiceKey(f.replace(/\.mp3$/i, ""));
  const time = fs.statSync(path.join(SRC, f)).mtimeMs;
  const seen = byKey.get(key);
  if (seen) console.warn(`Same words twice: "${seen.f}" and "${f}"; using the newer one`);
  if (!seen || time > seen.time) byKey.set(key, { f, time });
}
const clips = {};
for (const [key, { f }] of [...byKey].sort()) {
  const name = `${key.replace(/ /g, "-")}.mp3`;
  fs.copyFileSync(path.join(SRC, f), path.join(OUT, name));
  clips[key] = `/assets/audio/qufoo/${name}`;
  console.log(`${f}  ->  ${name}  (${Math.round(fs.statSync(path.join(SRC, f)).size / 1024)} KB)`);
}
fs.writeFileSync(MANIFEST, JSON.stringify(clips, null, 2) + "\n");
console.log(`${byKey.size} clip${byKey.size > 1 ? "s" : ""} -> lib/voice-clips.json`);
