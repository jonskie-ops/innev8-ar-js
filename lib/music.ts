import { voiceFor } from "./voice";

/** The game's background music ("BG Game.mp3", added with scripts/voice.mjs). */
const SRC = voiceFor("BG Game");
/** It's a 16-bar loop that ends here; what comes after is the last bar's echo. */
const LOOP_END_S = 27.57;
/** Quiet under the game, and quieter still while Qufoo talks (or sniffs) or the collect sound plays. */
const LEVEL = 0.3;
const DUCKED = 0.1;

// Through Web Audio, as iPhone ignores an audio element's volume. Phones only allow sound after a
// tap, so it starts with the first one (and starts again after a tap if the phone stopped it).
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let loading = false;
const sounding = new Set<HTMLMediaElement>();

/** Down quickly when a sound starts; back up gently once they've all stopped. */
function level() {
  if (!ctx || !gain) return;
  const g = gain.gain;
  const t = ctx.currentTime;
  const down = sounding.size > 0;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.setTargetAtTime(down ? DUCKED : LEVEL, down ? t : t + 0.4, down ? 0.08 : 0.4);
}

async function begin(c: AudioContext, out: GainNode) {
  const all = await c.decodeAudioData(await (await fetch(SRC!)).arrayBuffer());
  // One round of the loop, with the echo after its end laid over its start: seamless when looped
  const len = Math.min(all.length, Math.round(LOOP_END_S * all.sampleRate));
  const round = c.createBuffer(all.numberOfChannels, len, all.sampleRate);
  for (let ch = 0; ch < all.numberOfChannels; ch++) {
    const from = all.getChannelData(ch);
    const to = round.getChannelData(ch);
    to.set(from.subarray(0, len));
    for (let i = len; i < Math.min(from.length, 2 * len); i++) to[i - len] += from[i];
  }
  const music = c.createBufferSource();
  music.buffer = round;
  music.loop = true;
  music.connect(out);
  music.start();
  level(); // fades in
}

function start() {
  if (!SRC || navigator.userActivation?.isActive === false) return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
  }
  if (ctx.state !== "running" && !document.hidden) void ctx.resume().catch(() => {});
  if (!loading) {
    loading = true;
    begin(ctx, gain!).catch(() => (loading = false)); // e.g. offline before it was saved: the next tap tries again
  }
}

if (typeof window !== "undefined") {
  for (const t of ["touchend", "click", "keydown"]) addEventListener(t, start, true);
  // Quiet while the game is out of sight (another app, the phone locked)
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume().catch(() => {});
  });
}

/** Lowers the music while `el` plays: Qufoo's voice, the collect sound. */
export function duckFor(el: HTMLMediaElement) {
  el.addEventListener("playing", () => {
    sounding.add(el);
    level();
  });
  for (const t of ["pause", "ended", "emptied"])
    el.addEventListener(t, () => {
      if (sounding.delete(el)) level();
    });
}
