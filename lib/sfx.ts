import { duckFor } from "./music";
import { voiceFor } from "./voice";

/** The sound of collecting a QR code ("collect.mp3", added with scripts/voice.mjs). */
const COLLECT = voiceFor("collect");
/** How long its hit lasts: Qufoo's "Got it!" waits this long, so the sound doesn't drown it out. */
export const COLLECT_HIT_MS = 350;

// Its own audio element, so it plays alongside Qufoo's voice rather than cutting him off. Phones only
// let an element make sound once it has played from a tap: the first tap anywhere readies it (a play()
// stopped straight away), as his voice is readied, so it can play from the AR view's taps too.
let el: HTMLAudioElement | null = null;
let unlocked = false;
const sound = () => {
  if (!el && COLLECT) {
    const a = new Audio(COLLECT);
    a.preload = "auto";
    // Back to the start as soon as it ends, so the next tap plays it straight away
    a.addEventListener("ended", () => (a.currentTime = 0));
    duckFor(a);
    el = a;
  }
  return el;
};
function unlock() {
  const a = sound();
  if (!a || unlocked || !a.paused || navigator.userActivation?.isActive === false) return;
  unlocked = true;
  a.play().catch((e: DOMException) => {
    if (e.name === "NotAllowedError") unlocked = false; // not a real tap after all: try the next one
  });
  a.pause();
}
if (typeof window !== "undefined") for (const t of ["touchend", "click", "keydown"]) addEventListener(t, unlock, true);

/** Plays the collect sound from the start. */
export function playCollect() {
  const a = sound();
  if (!a) return;
  if (a.currentTime > 0) a.currentTime = 0; // still playing from the last one: start over
  void a.play().catch(() => {});
}
