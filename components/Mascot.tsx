"use client";
/* eslint-disable @next/next/no-img-element -- a 20 KB still shown until the talking sprite is ready */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { prefersReducedMotion } from "@/lib/dom";
import { getHunt } from "@/lib/huntStore";
import { duckFor } from "@/lib/music";
import { progress, useProgress, type Progress } from "@/lib/store";
import { anyClip, voiceFor } from "@/lib/voice";
import { useSplashDone } from "./Splash";

/** The mascot's name. */
export const MASCOT = "Qufoo";

/**
 * One thing the mascot says. A line with a voice clip is said out loud, and he talks for as long as
 * it plays: `audio`, or the recorded clip that matches its words (lib/voice.ts), or the words in
 * `say` when the recording's differ from the text (a clip can't say the player's name, so it's the
 * line without it). Text before the words in `say` shows at once (e.g. "Sniff sniff…", after you've
 * heard him sniffing). `wait`: milliseconds before he starts saying it (e.g. after a sound).
 */
export type Line = { text: string; say?: string; audio?: string; wait?: number };
/** A line's voice clip, how many characters of its text come before the clip's words, and its wait. */
function clipOf(line?: Line | null): { clip?: string; lead: number; wait: number } {
  if (!line) return { lead: 0, wait: 0 };
  const said = line.say ?? line.text;
  return {
    clip: line.audio ?? voiceFor(said),
    lead: line.text.endsWith(said) ? line.text.length - said.length : 0,
    wait: line.wait ?? 0,
  };
}

/**
 * His talking loop: 36 frames (2.4 s at 15 fps) cut out of the source animation, 6 across in one
 * sprite sheet. His mouth is closed on the REST frames, so he can stop talking on any of them.
 */
const TALK = { src: "/assets/img/mascot/talk.webp", cols: 6, frames: 36, w: 320, h: 340, fps: 15 };
const REST = new Set([0, 1, 2, 3, 4, 17, 18, 19, 20, 26]);
/** Sniffing (the scanner, while he searches): a 2 s loop, cut to the same frame as TALK. */
const SNIFF = { src: "/assets/img/mascot/sniff.webp", cols: 6, frames: 30, w: 240, h: 255, fps: 15 };
/**
 * The sniff sound, looped with his sniffing: its first 2 s line up with the 2 s loop (the sniffs
 * with his head's moves) when it's played from SNIFF_SOUND_AT at the loop's first frame.
 */
const SNIFF_SOUND = voiceFor("Sniff Sound");
const SNIFF_SOUND_AT = 0.06;
const IDLE = "/assets/img/mascot/idle.webp"; // frame 0 on its own: shown until the sprite is ready
const CPS = 34; // typing speed, characters per second
const LOAD_WAIT_MS = 4000; // after the splash, wait at most this long for the sprite
const RISE_MS = 700;
const LEAVE_MS = 450;
const MAP_DELAY_MS = 500; // after sign-up, let the map appear before he comes up
const VOICE_WAIT_MS = 1500; // a slow clip holds a line's words back at most this long

type Screen = "countdown" | "game";
type Stage = "wait" | "in" | "on" | "out" | "gone";
/**
 * What he's saying; whether the sign-up guide takes over after the last line; and what happens once
 * he's done (Scan: the scanner opens).
 */
type Talk = { lines: Line[]; guideNext: boolean; then?: () => void };

const signedUp = (p: Progress) => p.onboarded && p.province !== "";

/** Straight after the splash. A new player gets a hello, then the sign-up guide carries on. */
function introTalk(screen: Screen, p: Progress): Talk {
  const name = p.name.trim();
  if (screen === "countdown")
    return {
      lines: [
        {
          text: name ? `Hi, ${name}! I'm ${MASCOT}, your QR hunting buddy.` : `Hi! I'm ${MASCOT}, your QR hunting buddy.`,
          say: `Hi! I'm ${MASCOT}, your QR hunting buddy.`,
        },
        { text: "The hunt opens on November 20 at the summit. See you there!" },
      ],
      guideNext: false,
    };
  if (!signedUp(p))
    return {
      lines: [{ text: `Hi! I'm ${MASCOT}, your QR hunting buddy.` }, { text: "Let's get you signed up first!" }],
      guideNext: true,
    };
  const { hunt } = getHunt();
  const TOTAL = hunt.stations.length;
  const found = hunt.stations.filter((s) => p.found[s.id]).length;
  return {
    lines: [
      { text: `Welcome back, ${name}!`, say: "Welcome back!" },
      {
        text:
          TOTAL > 0 && found === TOTAL
            ? hunt.prizes.length
              ? `You found all ${TOTAL} QR codes! Your prize is waiting in Codes.`
              : `You found all ${TOTAL}! Amazing!`
            : found === 0
              ? `${TOTAL} QR codes are waiting for you. Tap Scan and look around!`
              : `You've found ${found} of ${TOTAL}. ${TOTAL - found} more to go: tap Scan and look around!`,
      },
    ],
    guideNext: false,
  };
}

/** The parts of the menu Qufoo shows new players, the first time each is tapped. */
export type TourStop = "map" | "dex" | "quests" | "me" | "scan";
const TOUR_STOPS: TourStop[] = ["map", "dex", "quests", "me", "scan"];

/** His tour of the menu: the map right after sign-up, then each menu button the first time it's tapped. */
function tourTalk(stop: TourStop, p: Progress, then?: () => void): Talk {
  const name = p.name.trim();
  const { hunt } = getHunt();
  const TOTAL = hunt.stations.length;
  // The prize line only when the organisers have set prizes (in their words if one needs every code)
  const prizeLine: Line[] = !hunt.prizes.length
    ? []
    : hunt.prizes.some((pr) => pr.rule === "all")
      ? [{ text: `Collect all ${TOTAL} to unlock your prize!` }]
      : [{ text: "Collect them to win prizes!" }];
  const lines: Line[] = {
    map: [
      { text: `Welcome to the hunt, ${name}! Let me show you around.`, say: "Welcome to the hunt! Let me show you around." },
      {
        text: `${TOTAL} INNEV8 QR codes are hiding around the summit, and only your camera can see them.`,
        say: `${TOTAL} QR codes are hiding around the summit, and only your camera can see them.`,
      },
      { text: "This is the Map of the venue. Each number marks where a QR code is hiding: tap one to read its clue." },
      { text: "Now try the menu below. Tap any button and I'll tell you what it's for!" },
    ],
    dex: [
      { text: `This is your QR Collection: all ${TOTAL} codes, with the ones you've found lit up.` },
      { text: "Tap a code to read its clue, then Find it to go look for it." },
      ...prizeLine,
    ],
    quests: [
      { text: "These are your Quests: goals like scanning your first code or finding the legendary gold one." },
      { text: "Each one fills up as you collect QR codes. Can you finish them all?" },
    ],
    me: [
      { text: "This is your profile: your points, your QR codes and your details." },
      { text: "Tap the pencil by your photo to change your name or province. The bin deletes your profile." },
    ],
    scan: [
      { text: "Scan opens your camera. The QR codes are hidden around the venue, and only your camera can see them." },
      { text: "Look around slowly. When a code appears in the frame, hold steady while it builds up." },
      { text: "Then tap it to collect it. Ready? Let's go!" },
    ],
  }[stop];
  const toured = new Set([...(p.tour ?? []), stop]);
  if (TOUR_STOPS.every((s) => toured.has(s))) {
    const outro = {
      text: `That's the whole tour, ${name}! Need me again? Tap me down in the corner.`,
      say: "That's the whole tour! Need me again? Tap me down in the corner.",
    };
    if (stop === "scan") lines.splice(lines.length - 1, 0, outro);
    else lines.push(outro);
  }
  return { lines, guideNext: false, then };
}

/** When the player taps the corner Qufoo: what this page is for. */
function helpTalk(page: TourStop, p: Progress): Talk {
  if (page !== "map") return { ...tourTalk(page, { ...p, tour: [] }), guideNext: false };
  return {
    lines: [
      { text: "This is the Map of the venue. Each number marks where a QR code is hiding: tap one to read its clue." },
      { text: "Pinch or use the + and − buttons to zoom in, and drag to look around." },
      { text: "When you're ready, tap Scan and look around with your camera." },
    ],
    guideNext: false,
  };
}

// ---- The game asks him to explain a menu button
let onExplain: ((stop: TourStop, then?: () => void, help?: boolean) => boolean) | null = null;
/**
 * The game calls this when a new player taps a menu button Qufoo hasn't explained yet. He explains
 * it, then `then` runs (for Scan: the scanner opens, still within the tap). If he can't (he's
 * already talking, or not on screen), `then` runs straight away.
 */
export function explainMenu(stop: TourStop, then?: () => void) {
  if (!onExplain?.(stop, then)) then?.();
}

// ---- While the big Qufoo is on screen, the corner one steps away
let busy = false;
const busyListeners = new Set<() => void>();
function setBusy(next: boolean) {
  if (busy === next) return;
  busy = next;
  busyListeners.forEach((l) => l());
}
const useBusy = () =>
  useSyncExternalStore(
    (l) => {
      busyListeners.add(l);
      return () => busyListeners.delete(l);
    },
    () => busy,
    () => false,
  );

/** What he says on each sign-up step (components/game/Onboarding.tsx). */
export const signUpGuide = (step: number, name: string): Line | undefined =>
  [
    { text: "Type your name above and tap Next." },
    { text: "Now pick your province, then tap Next." },
    {
      text: `You're all set, ${name.trim()}! Tap Let's Go to start the hunt.`,
      say: "You're all set! Tap Let's Go to start the hunt.",
    },
  ][step];

// ---- The sign-up guide waits until the hello after the splash is over
let introOver = false;
const introListeners = new Set<() => void>();
function endIntro() {
  if (introOver) return;
  introOver = true;
  introListeners.forEach((l) => l());
}
const useIntroOver = () =>
  useSyncExternalStore(
    (l) => {
      introListeners.add(l);
      return () => introListeners.delete(l);
    },
    () => introOver,
    () => false,
  );

// ---- His voice: one audio element plays every clip. Phones only let a page make sound once it's
// been tapped, and then only from that tap; once this element has played from a tap, it can play
// the clips that come on their own (the scanner's) too.
let voiceEl: HTMLAudioElement | null = null;
let unlocked = false;
const player = () => {
  if (!voiceEl) {
    voiceEl = new Audio();
    duckFor(voiceEl); // the music goes quiet while he talks (or sniffs)
  }
  return voiceEl;
};
function loadClip(src: string) {
  const a = player();
  if (a.getAttribute("src") !== src) a.src = src;
  return a;
}
function speak(a: HTMLAudioElement) {
  a.currentTime = 0;
  return a.play().then(() => {
    unlocked = true;
  });
}
// The first tap anywhere readies the element (a play() from the tap, stopped straight away), even
// if he isn't saying anything then (e.g. Skip)
function unlock() {
  const a = player();
  if (unlocked || !a.paused || navigator.userActivation?.isActive === false) return;
  if (!a.getAttribute("src")) {
    if (!anyClip) return;
    a.src = anyClip;
  }
  unlocked = true;
  a.play().catch((e: DOMException) => {
    if (e.name === "NotAllowedError") unlocked = false; // not a real tap after all: try the next one
  });
  a.pause();
}
if (typeof window !== "undefined") for (const t of ["touchend", "click", "keydown"]) addEventListener(t, unlock, true);
const lengthOf = (a: HTMLAudioElement) => (Number.isFinite(a.duration) ? a.duration : 0);

type Said = "wait" | "hush" | "go";
/**
 * Says `line`'s clip (if it has one) while `on`; a new line starts its own. `said`: "wait" until
 * his voice starts, "go" once it plays (or if it can't: a broken clip, or a slow one after
 * VOICE_WAIT_MS), "hush" if the phone wants a tap first (`sayNow`, from that tap, says it).
 * `cps`: how fast to type the words (after the `lead` characters) so they come as he says them.
 * `voice`: the clip is playing. With `keep`, a clip plays to its end even if he goes (the scanner
 * closes as he says "Got it!"). `wait`: milliseconds before the clip starts (the line before it
 * stops at once).
 */
function useVoice(line: unknown, text: string, clip: string | undefined, lead: number, on: boolean, keep = false, wait = 0) {
  const [heard, setHeard] = useState<{ line?: unknown; said: Said; secs: number }>({ said: "wait", secs: 0 });
  const [voice, setVoice] = useState(false);
  const leaving = useRef(false);
  const mine = Boolean(clip) && heard.line === line;
  const said: Said = !clip ? "go" : mine ? heard.said : "wait";
  const secs = mine ? heard.secs : 0;
  const cps = secs > 1 ? Math.min(Math.max((text.length - lead) / (secs - 0.4), 8), 60) : CPS;

  useLayoutEffect(() => {
    leaving.current = false;
    return () => {
      leaving.current = true; // unmounting (layout cleanups run before the voice's below)
    };
  }, []);

  useEffect(() => {
    if (!on || !clip) return;
    const a = loadClip(clip);
    const playing = () => setVoice(true);
    const stopped = () => setVoice(false);
    a.addEventListener("playing", playing);
    a.addEventListener("pause", stopped);
    a.addEventListener("ended", stopped);
    let open = true;
    const settle = (s: "hush" | "go") => {
      if (!open) return;
      open = false;
      setHeard({ line, said: s, secs: lengthOf(a) });
    };
    const start = () =>
      speak(a).then(
        () => settle("go"),
        (e: DOMException) => settle(e.name === "NotAllowedError" ? "hush" : "go"), // a broken clip: words only
      );
    let later = 0;
    if (wait > 0) later = window.setTimeout(start, wait);
    else void start();
    const id = window.setTimeout(() => settle("go"), wait + VOICE_WAIT_MS);
    return () => {
      open = false;
      clearTimeout(later);
      clearTimeout(id);
      a.removeEventListener("playing", playing);
      a.removeEventListener("pause", stopped);
      a.removeEventListener("ended", stopped);
      setVoice(false);
      if (!(keep && leaving.current) && a.getAttribute("src") === clip) a.pause();
    };
  }, [line, clip, on, keep, wait]);

  const sayNow = () => {
    if (!clip) return;
    const a = loadClip(clip);
    setHeard({ line, said: "go", secs: lengthOf(a) });
    void speak(a).catch(() => {});
  };
  return { said, cps, voice, sayNow };
}

// ---- Shared: the sprites (each fetched once), the talking dog, the typing
const spriteLoads = new Map<string, Promise<HTMLImageElement>>();
function useSprite(enabled: boolean, src = TALK.src) {
  const [sprite, setSprite] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let load = spriteLoads.get(src);
    if (!load) {
      const img = new Image();
      img.src = src;
      load = img.decode().then(() => img);
      spriteLoads.set(src, load);
    }
    load
      .then((img) => alive && setSprite(img))
      .catch(() => spriteLoads.delete(src)); // try again next time
    return () => {
      alive = false;
    };
  }, [enabled, src]);
  return sprite;
}

const useReducedMotion = () => useState(() => typeof window !== "undefined" && prefersReducedMotion())[0];

/**
 * Types `text` out while `run`, `cps` characters a second, after the first `from` (shown at once);
 * starts over whenever the text changes.
 */
function useTyping(text: string, run: boolean, instant: boolean, cps = CPS, from = 0) {
  const [state, setState] = useState({ text, n: 0 });
  const n = Math.max(state.text === text ? state.n : 0, from);
  useEffect(() => {
    if (!run || instant || n >= text.length) return;
    const id = window.setTimeout(() => setState({ text, n: n + 1 }), 1000 / cps);
    return () => clearTimeout(id);
  }, [run, instant, n, text, cps]);
  const typed = instant ? text.length : n;
  return {
    typed,
    done: typed >= text.length,
    finish: () => setState({ text, n: text.length }),
  };
}

/** Plays the talking loop on a canvas while `talking`; when he stops, he finishes on the next closed mouth. */
function useTalkLoop(canvas: React.RefObject<HTMLCanvasElement | null>, sprite: HTMLImageElement | null, talking: boolean) {
  const frame = useRef(0);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !sprite) return;
    const draw = () => {
      const i = frame.current;
      ctx.clearRect(0, 0, TALK.w, TALK.h);
      ctx.drawImage(
        sprite,
        (i % TALK.cols) * TALK.w,
        Math.floor(i / TALK.cols) * TALK.h,
        TALK.w,
        TALK.h,
        0,
        0,
        TALK.w,
        TALK.h,
      );
    };
    draw();
    const step = 1000 / TALK.fps;
    let raf = 0;
    let last = -1;
    let acc = 0;
    const tick = (now: number) => {
      acc += last < 0 ? step : Math.min(now - last, 250);
      last = now;
      for (; acc >= step; acc -= step) {
        if (!talking && REST.has(frame.current)) return; // mouth closed: hold this frame
        frame.current = (frame.current + 1) % TALK.frames;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    if (talking || !REST.has(frame.current)) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvas, sprite, talking]);
}

function QufooDog({ sprite, talking }: { sprite: HTMLImageElement | null; talking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useTalkLoop(canvasRef, sprite, talking);
  return sprite ? (
    <canvas ref={canvasRef} width={TALK.w} height={TALK.h} />
  ) : (
    <img src={IDLE} alt="" width={TALK.w} height={TALK.h} />
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

/** The line typed so far, with the rest held invisible so the bubble doesn't grow as it types. */
function Typed({ text, typed, className }: { text: string; typed: number; className: string }) {
  return (
    <>
      <p className={className} aria-hidden="true">
        {text.slice(0, typed)}
        <span className="qufoo-unsaid">{text.slice(typed)}</span>
      </p>
      <p className="qufoo-sr" aria-live="polite">
        {text}
      </p>
    </>
  );
}

/**
 * Qufoo, the QR hunting buddy, as a dialogue over the app: he rises from the bottom of the screen
 * and says a few lines, typing each one out while he talks; a tap finishes the line or moves on,
 * Skip (or Esc) sends him away. He comes up once the splash has cleared (a hello for new players,
 * progress for returning ones); for new players he then tours the menu: the map right after
 * sign-up, and each menu button the first time it's tapped (see explainMenu). He stays away when a
 * QR code link opens the scanner.
 */
export function Mascot({ screen }: { screen: Screen }) {
  const splashDone = useSplashDone();
  const progressNow = useProgress();
  const reduced = useReducedMotion();
  // Decided on the first render, before the game takes the link out of the address bar
  const [deepLink] = useState(() => typeof window !== "undefined" && new URLSearchParams(location.search).has("s"));
  const skipIntro = deepLink && signedUp(progressNow);
  const [stage, setStage] = useState<Stage>("wait");
  const [talk, setTalk] = useState<Talk>({ lines: [], guideNext: false });
  const [index, setIndex] = useState(0);
  const [waited, setWaited] = useState(false);
  const sprite = useSprite(!skipIntro);

  // After the splash: come up as soon as the sprite is ready (or, failing that, with the still)
  useEffect(() => {
    if (stage !== "wait") return;
    if (skipIntro) {
      endIntro();
      return;
    }
    if (!splashDone) return;
    if (!sprite && !waited) {
      const id = window.setTimeout(() => setWaited(true), LOAD_WAIT_MS);
      return () => clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      setTalk(introTalk(screen, progressNow));
      setIndex(0);
      setStage("in");
    }, 0);
    return () => clearTimeout(id);
  }, [skipIntro, splashDone, stage, sprite, waited, screen, progressNow]);

  // Right after sign-up, on the map: the first stop of his tour
  const wasSignedUp = useRef(signedUp(progressNow));
  useEffect(() => {
    const now = signedUp(progressNow);
    const justSignedUp = now && !wasSignedUp.current;
    wasSignedUp.current = now;
    if (!justSignedUp || deepLink) return;
    const id = window.setTimeout(() => {
      setTalk(tourTalk("map", progressNow));
      setIndex(0);
      setStage("in");
      progress.toured("map");
    }, MAP_DELAY_MS);
    return () => clearTimeout(id);
  }, [progressNow, deepLink]);

  // The game asks him to explain a menu button (with the latest stage and progress, every render)
  useEffect(() => {
    onExplain = (stop, then, help) => {
      if (stage === "in" || stage === "on") return false;
      setTalk(help ? helpTalk(stop, progressNow) : tourTalk(stop, progressNow, then));
      setIndex(0);
      setStage("in");
      progress.toured(stop);
      return true;
    };
    return () => {
      onExplain = null;
    };
  });

  useEffect(() => {
    setBusy(stage === "in" || stage === "on" || stage === "out");
  }, [stage]);

  useEffect(() => {
    if (stage !== "in") return;
    const { clip } = clipOf(talk.lines[0]);
    if (clip) loadClip(clip).load(); // fetched while he rises
    const id = window.setTimeout(() => setStage("on"), reduced ? 0 : RISE_MS);
    return () => clearTimeout(id);
  }, [stage, reduced, talk]);

  useEffect(() => {
    if (stage !== "out") return;
    const id = window.setTimeout(() => setStage("gone"), reduced ? 0 : LEAVE_MS);
    return () => clearTimeout(id);
  }, [stage, reduced]);

  const line = talk.lines[index];
  const text = line?.text ?? "";
  // The line's voice clip, if it has one. If the phone won't play sound yet (nothing tapped since
  // the page opened, e.g. his hello after the splash), he waits for a tap to say it (see next).
  const { clip, lead } = clipOf(line);
  const { said, cps, voice, sayNow } = useVoice(line, text, clip, lead, stage === "on");
  // A voiced line's words are typed as he says them, so each line shows once, said out loud
  const { typed, done, finish } = useTyping(text, stage === "on" && said === "go", reduced, cps, lead);

  const ran = useRef<Talk | null>(null);
  const leave = () => {
    if (stage !== "on" && stage !== "in") return;
    setStage("out");
    if (talk.guideNext) endIntro(); // the sign-up guide pops up as he goes down
    if (ran.current !== talk) {
      ran.current = talk;
      talk.then?.(); // e.g. open the scanner, still within this tap
    }
  };
  // No timers: every line waits for a tap. The first tap finishes typing, the next moves on.
  const next = () => {
    if (stage !== "on") return;
    if (said === "hush") return sayNow(); // sound is allowed now (this tap): he says the line
    if (!done) return finish();
    voiceEl?.pause();
    if (index < talk.lines.length - 1) setIndex(index + 1);
    else leave();
  };
  const keys = useRef({ next, leave });
  useEffect(() => {
    keys.current = { next, leave };
  });

  // Keyboard: Enter or Space for the next line, Esc to send him away
  useEffect(() => {
    if (stage !== "on") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") keys.current.leave();
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        keys.current.next();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [stage]);

  if (stage === "wait" || stage === "gone") return null;
  const last = index === talk.lines.length - 1;
  const talking = !reduced && stage === "on" && said === "go" && (!done || voice);
  const hush = said === "hush";

  return (
    <div className={`host is-${stage}`} role="dialog" aria-label={`${MASCOT}, your QR hunting buddy`} onClick={next}>
      <div className="host__stage">
        <div className="host__bubble">
          <span className="qufoo-name" aria-hidden="true">
            {MASCOT}
          </span>
          <div className="host__say">
            <Typed text={text} typed={hush ? 0 : typed} className="host__text" />
            {hush && (
              <p className="host__listen" aria-hidden="true">
                <SpeakerIcon />
                Tap to hear {MASCOT}
              </p>
            )}
          </div>
          <div className="host__foot">
            <span className="host__dots" aria-hidden="true">
              {talk.lines.map((_, i) => (
                <i key={i} className={i <= index ? "is-on" : undefined}></i>
              ))}
            </span>
            <span className="host__hint" aria-hidden="true">
              {hush || !done ? "" : last && !talk.guideNext ? "Tap to close" : "Tap to continue"}
            </span>
          </div>
          <button
            type="button"
            className="host__skip"
            onClick={(e) => {
              e.stopPropagation();
              leave();
            }}
          >
            Skip
          </button>
        </div>
        <div className="host__dog" aria-hidden="true">
          <QufooDog sprite={sprite} talking={talking} />
        </div>
      </div>
    </div>
  );
}

/**
 * Qufoo on the sign-up screens: a small Qufoo above the Next button saying what to do on this
 * step. Part of the page (nothing is covered); he shows up once the hello after the splash is over.
 */
export function QufooGuide({ line }: { line?: Line }) {
  const show = useIntroOver();
  const reduced = useReducedMotion();
  const sprite = useSprite(show);
  const text = line?.text ?? "";
  // Each step's line is said out loud (by now he's been tapped, so the phone allows it)
  const { clip, lead } = clipOf(line);
  const { said, cps, voice } = useVoice(text, text, clip, lead, show && text !== "");
  const { typed, done } = useTyping(text, show && said !== "wait", reduced, cps, lead);
  if (!show || !text) return null;
  return (
    <div className="qguide">
      <div className="qguide__bubble">
        <span className="qufoo-name" aria-hidden="true">
          {MASCOT}
        </span>
        <Typed text={text} typed={typed} className="qguide__text" />
      </div>
      <div className="qguide__dog" aria-hidden="true">
        <QufooDog sprite={sprite} talking={!reduced && said !== "wait" && (!done || voice)} />
      </div>
    </div>
  );
}

/** Dock frames: his mouth stays shut while his head moves a little, back and forth. */
const DOCK_FRAMES = [0, 1, 2, 3, 4, 3, 2, 1];
const DOCK_FPS = 7;
const DOCK_W = 240; // drawn at ~3x the 84 px he's shown at, sharp on any phone
const DOCK_H = 255;

/**
 * Small Qufoo waiting just above the menu, moving gently. Tap him and he comes up to explain the
 * page you're on. He steps away while the big Qufoo talks and when `hidden` (e.g. a QR code's card
 * is open on the map); otherwise he stays, down to the very end of a page.
 */
export function QufooDock({ page, hidden = false }: { page: TourStop; hidden?: boolean }) {
  const talking = useBusy();
  const reduced = useReducedMotion();
  const sprite = useSprite(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const away = talking || hidden;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !sprite) return;
    let k = 0;
    const draw = () => {
      const i = DOCK_FRAMES[k];
      ctx.clearRect(0, 0, DOCK_W, DOCK_H);
      ctx.drawImage(sprite, (i % TALK.cols) * TALK.w, Math.floor(i / TALK.cols) * TALK.h, TALK.w, TALK.h, 0, 0, DOCK_W, DOCK_H);
    };
    draw();
    if (reduced || away) return;
    const id = window.setInterval(() => {
      k = (k + 1) % DOCK_FRAMES.length;
      draw();
    }, 1000 / DOCK_FPS);
    return () => clearInterval(id);
  }, [sprite, reduced, away]);

  return (
    <button
      type="button"
      className={away ? "qdock is-away" : "qdock"}
      aria-label={`Ask ${MASCOT} about this page`}
      aria-hidden={away || undefined}
      tabIndex={away ? -1 : 0}
      onClick={() => onExplain?.(page, undefined, true)}
    >
      <span className="qdock__body">
        {sprite ? (
          <canvas ref={canvasRef} width={DOCK_W} height={DOCK_H} />
        ) : (
          <img src={IDLE} alt="" width={DOCK_W} height={DOCK_H} />
        )}
      </span>
      <span className="qdock__ask" aria-hidden="true">
        ?
      </span>
    </button>
  );
}

/**
 * Qufoo in the scanner: he sniffs while you search, and talks (`say`) once a hidden code is near,
 * and as you find and collect it. Decorative: taps go through him to the AR view.
 */
export function ScanQufoo({ say }: { say: Line | null }) {
  const reduced = useReducedMotion();
  const sniffSprite = useSprite(true, SNIFF.src);
  const talkSprite = useSprite(true);
  const sniffRef = useRef<HTMLCanvasElement>(null);
  const talking = say !== null;
  const text = say?.text ?? "";
  const { clip, lead, wait } = clipOf(say);
  // Said out loud; a clip plays to its end even when the scanner closes (e.g. "Got it! Good job!")
  const { said, cps, voice } = useVoice(text, text, clip, lead, talking, true, wait);
  const { typed, done } = useTyping(text, talking && said !== "wait", reduced, cps, lead);

  // Sniffing, on a loop, while he isn't talking, with the sniff sound in step: each frame is picked
  // from where the sound is (it loops the same 2 s), so his sniffs and the sound's stay together.
  // Until the sound plays (or without it), the frames go by the clock.
  useEffect(() => {
    const ctx = sniffRef.current?.getContext("2d");
    if (!ctx || !sniffSprite) return;
    let k = -1;
    const draw = (f: number) => {
      if (f === k) return;
      k = f;
      ctx.clearRect(0, 0, SNIFF.w, SNIFF.h);
      ctx.drawImage(sniffSprite, (f % SNIFF.cols) * SNIFF.w, Math.floor(f / SNIFF.cols) * SNIFF.h, SNIFF.w, SNIFF.h, 0, 0, SNIFF.w, SNIFF.h);
    };
    draw(0);
    if (reduced || talking) return;
    const loop = SNIFF.frames / SNIFF.fps;
    const a = SNIFF_SOUND ? loadClip(SNIFF_SOUND) : null;
    let heard = false; // the sound is playing
    const onPlaying = () => {
      heard = true;
    };
    if (a) {
      a.addEventListener("playing", onPlaying);
      a.currentTime = SNIFF_SOUND_AT;
      void a.play().catch(() => {}); // no sound yet (no tap): he sniffs by the clock
    }
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      let t = ((performance.now() - start) / 1000) % loop;
      if (a && !a.paused && a.getAttribute("src") === SNIFF_SOUND && (heard || a.currentTime > SNIFF_SOUND_AT + 0.05)) {
        t = a.currentTime - SNIFF_SOUND_AT;
        if (t >= loop || t < 0) {
          a.currentTime = SNIFF_SOUND_AT; // round again: the loop and the sound start over together
          t = 0;
        }
      }
      draw(Math.floor(t * SNIFF.fps) % SNIFF.frames);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (!a) return;
      a.removeEventListener("playing", onPlaying);
      if (a.getAttribute("src") === SNIFF_SOUND) a.pause();
    };
  }, [sniffSprite, reduced, talking]);

  return (
    <div className={talking ? "scanq is-talking" : "scanq"} aria-hidden="true">
      {talking && (
        <div className="scanq__bubble" key={text}>
          <span className="qufoo-name">{MASCOT}</span>
          <p className="scanq__text">
            {text.slice(0, typed)}
            <span className="qufoo-unsaid">{text.slice(typed)}</span>
          </p>
        </div>
      )}
      <div className="scanq__dog">
        <span className="scanq__sniff">
          {sniffSprite ? <canvas ref={sniffRef} width={SNIFF.w} height={SNIFF.h} /> : <img src={IDLE} alt="" />}
        </span>
        <span className="scanq__talk">
          <QufooDog sprite={talkSprite} talking={!reduced && talking && said !== "wait" && (!done || voice)} />
        </span>
      </div>
    </div>
  );
}
