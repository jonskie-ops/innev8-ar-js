"use client";
/* eslint-disable @next/next/no-img-element -- a 20 KB still shown until the talking sprite is ready */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { prefersReducedMotion } from "@/lib/dom";
import { STATIONS, TOTAL } from "@/lib/hunt";
import { progress, useProgress, type Progress } from "@/lib/store";
import { useSplashDone } from "./Splash";

/** The mascot's name. */
export const MASCOT = "Qufoo";

/** One thing the mascot says. Add `audio` (a voice clip URL) and he talks for as long as it plays. */
export type Line = { text: string; audio?: string };

/**
 * His talking loop: 36 frames (2.4 s at 15 fps) cut out of the source animation, 6 across in one
 * sprite sheet. His mouth is closed on the REST frames, so he can stop talking on any of them.
 */
const TALK = { src: "/assets/img/mascot/talk.webp", cols: 6, frames: 36, w: 320, h: 340, fps: 15 };
const REST = new Set([0, 1, 2, 3, 4, 17, 18, 19, 20, 26]);
const IDLE = "/assets/img/mascot/idle.webp"; // frame 0 on its own: shown until the sprite is ready
const CPS = 34; // typing speed, characters per second
const LOAD_WAIT_MS = 4000; // after the splash, wait at most this long for the sprite
const RISE_MS = 700;
const LEAVE_MS = 450;
const MAP_DELAY_MS = 500; // after sign-up, let the map appear before he comes up

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
        { text: name ? `Hi, ${name}! I'm ${MASCOT}, your QR hunting buddy.` : `Hi! I'm ${MASCOT}, your QR hunting buddy.` },
        { text: "The hunt opens on November 20 at the summit. See you there!" },
      ],
      guideNext: false,
    };
  if (!signedUp(p))
    return {
      lines: [{ text: `Hi! I'm ${MASCOT}, your QR hunting buddy.` }, { text: "Let's get you signed up first!" }],
      guideNext: true,
    };
  const found = STATIONS.filter((s) => p.found[s.id]).length;
  return {
    lines: [
      { text: `Welcome back, ${name}!` },
      {
        text:
          found === TOTAL
            ? `You found all ${TOTAL} QR codes! Your prize is waiting in Codes.`
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
  const lines: Line[] = {
    map: [
      { text: `Welcome to the hunt, ${name}! Let me show you around.` },
      { text: `${TOTAL} INNEV8 QR codes are hiding around the summit, and only your camera can see them.` },
      { text: "This is the Map of the venue. Each number marks where a QR code is hiding: tap one to read its clue." },
      { text: "Now try the menu below. Tap any button and I'll tell you what it's for!" },
    ],
    dex: [
      { text: `This is your QR Collection: all ${TOTAL} codes, with the ones you've found lit up.` },
      { text: "Tap a code to read its clue, then Find it to go look for it." },
      { text: `Collect all ${TOTAL} to unlock your prize!` },
    ],
    quests: [
      { text: "These are your Quests: goals like scanning your first code or finding the legendary gold one." },
      { text: "Each one fills up as you collect QR codes. Can you finish them all?" },
    ],
    me: [
      { text: "This is your profile: your points, your QR codes and your details." },
      { text: "Tap Edit Profile any time to change your name or province." },
    ],
    scan: [
      { text: "Scan opens your camera. The QR codes are hidden around the venue, and only your camera can see them." },
      { text: "Look around slowly. When a code appears in the frame, hold steady while it builds up." },
      { text: "Then tap it to collect it. Ready? Let's go!" },
    ],
  }[stop];
  const toured = new Set([...(p.tour ?? []), stop]);
  if (stop !== "scan" && TOUR_STOPS.every((s) => toured.has(s)))
    lines.push({ text: `That's the whole tour, ${name}. Happy hunting!` });
  return { lines, guideNext: false, then };
}

// ---- The game asks him to explain a menu button
let onExplain: ((stop: TourStop, then?: () => void) => boolean) | null = null;
/**
 * The game calls this when a new player taps a menu button Qufoo hasn't explained yet. He explains
 * it, then `then` runs (for Scan: the scanner opens, still within the tap). If he can't (he's
 * already talking, or not on screen), `then` runs straight away.
 */
export function explainMenu(stop: TourStop, then?: () => void) {
  if (!onExplain?.(stop, then)) then?.();
}

/** What he says on each sign-up step (components/game/Onboarding.tsx). */
export const signUpGuide = (step: number, name: string) =>
  [
    "Type your name above and tap Next.",
    "Now pick your province, then tap Next.",
    `You're all set, ${name.trim()}! Tap Let's Go to start the hunt.`,
  ][step] ?? "";

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

// ---- Shared by both: the sprite (fetched once), the talking dog, the typing
let spriteLoad: Promise<HTMLImageElement> | null = null;
function useSprite(enabled: boolean) {
  const [sprite, setSprite] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    if (!spriteLoad) {
      const img = new Image();
      img.src = TALK.src;
      spriteLoad = img.decode().then(() => img);
    }
    spriteLoad
      .then((img) => alive && setSprite(img))
      .catch(() => {
        spriteLoad = null; // try again next time
      });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return sprite;
}

const useReducedMotion = () => useState(() => typeof window !== "undefined" && prefersReducedMotion())[0];

/** Types `text` out while `run`; starts over whenever the text changes. */
function useTyping(text: string, run: boolean, instant: boolean) {
  const [state, setState] = useState({ text, n: 0 });
  const n = state.text === text ? state.n : 0;
  useEffect(() => {
    if (!run || instant || n >= text.length) return;
    const id = window.setTimeout(() => setState({ text, n: n + 1 }), 1000 / CPS);
    return () => clearTimeout(id);
  }, [run, instant, n, text]);
  const typed = instant ? text.length : n;
  return { typed, done: typed >= text.length, finish: () => setState({ text, n: text.length }) };
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
  const [voice, setVoice] = useState(false); // a voice clip is playing
  const [waited, setWaited] = useState(false);
  const sprite = useSprite(!skipIntro);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    onExplain = (stop, then) => {
      if (stage === "in" || stage === "on") return false;
      setTalk(tourTalk(stop, progressNow, then));
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
    if (stage !== "in") return;
    const id = window.setTimeout(() => setStage("on"), reduced ? 0 : RISE_MS);
    return () => clearTimeout(id);
  }, [stage, reduced]);

  useEffect(() => {
    if (stage !== "out") return;
    const id = window.setTimeout(() => setStage("gone"), reduced ? 0 : LEAVE_MS);
    return () => clearTimeout(id);
  }, [stage, reduced]);

  const line = talk.lines[index];
  const text = line?.text ?? "";
  const { typed, done, finish } = useTyping(text, stage === "on", reduced);

  // Voice clip, when the line has one. If the browser won't play sound yet (no tap since the page
  // opened), the line just runs as text.
  useEffect(() => {
    if (stage !== "on" || !line?.audio) return;
    const a = new Audio(line.audio);
    audioRef.current = a;
    a.onplaying = () => setVoice(true);
    a.onpause = a.onended = () => setVoice(false);
    a.play().catch(() => setVoice(false));
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, [stage, line]);

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
    if (!done) return finish();
    audioRef.current?.pause();
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
  const talking = !reduced && stage === "on" && (!done || voice);

  return (
    <div className={`host is-${stage}`} role="dialog" aria-label={`${MASCOT}, your QR hunting buddy`} onClick={next}>
      <div className="host__stage">
        <div className="host__bubble">
          <span className="qufoo-name" aria-hidden="true">
            {MASCOT}
          </span>
          <Typed text={text} typed={typed} className="host__text" />
          <div className="host__foot">
            <span className="host__dots" aria-hidden="true">
              {talk.lines.map((_, i) => (
                <i key={i} className={i <= index ? "is-on" : undefined}></i>
              ))}
            </span>
            <span className="host__hint" aria-hidden="true">
              {!done ? "" : last && !talk.guideNext ? "Tap to close" : "Tap to continue"}
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
export function QufooGuide({ text }: { text: string }) {
  const show = useIntroOver();
  const reduced = useReducedMotion();
  const sprite = useSprite(show);
  const { typed, done } = useTyping(text, show, reduced);
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
        <QufooDog sprite={sprite} talking={!reduced && !done} />
      </div>
    </div>
  );
}
