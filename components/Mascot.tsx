"use client";
/* eslint-disable @next/next/no-img-element -- a 20 KB still shown until the talking sprite is ready */

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/dom";
import { STATIONS, TOTAL } from "@/lib/hunt";
import { useProgress, type Progress } from "@/lib/store";
import { useSplashDone } from "./Splash";

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
const PAUSE_MS = 1500; // a finished line stays up this long (plus a little per character), then the next one
const LOAD_WAIT_MS = 4000; // after the splash, wait at most this long for the sprite
const RISE_MS = 700;
const LEAVE_MS = 450;

type Screen = "countdown" | "game";
type Stage = "wait" | "in" | "on" | "out" | "gone";

function linesFor(screen: Screen, p: Progress): Line[] {
  const name = p.name.trim();
  if (screen === "countdown")
    return [
      { text: name ? `Hi, ${name}! I'm your QR hunting buddy.` : "Hi! I'm your QR hunting buddy." },
      { text: "The hunt opens on November 20 at the summit. See you there!" },
    ];
  if (!p.onboarded || !p.province)
    return [
      { text: "Hi! I'm your QR hunting buddy." },
      { text: `${TOTAL} INNEV8 QR codes are hiding around the summit, and only your camera can see them.` },
      { text: "Let's get you signed up first!" },
    ];
  const found = STATIONS.filter((s) => p.found[s.id]).length;
  return [
    { text: `Welcome back, ${name}!` },
    {
      text:
        found === TOTAL
          ? `You found all ${TOTAL} QR codes! Your prize is waiting in Codes.`
          : found === 0
            ? `${TOTAL} QR codes are waiting for you. Tap Scan and look around!`
            : `You've found ${found} of ${TOTAL}. ${TOTAL - found} more to go: tap Scan and look around!`,
    },
  ];
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

/**
 * The QR hunting buddy: once the splash has cleared, he rises from the bottom of the screen and
 * says a few lines (a greeting for new players, progress for returning ones), typing each one out
 * while he talks. Lines move on by themselves or with a tap; Skip (or Esc) sends him away. He stays
 * away when a QR code link opens the scanner straight after the splash.
 */
export function Mascot({ screen }: { screen: Screen }) {
  const splashDone = useSplashDone();
  const progressNow = useProgress();
  // Decided once, on the first render: a signed-up player arriving from a QR code link goes straight to the scanner.
  const [skip] = useState(
    () =>
      typeof window !== "undefined" &&
      progressNow.onboarded &&
      progressNow.province !== "" &&
      new URLSearchParams(location.search).has("s"),
  );
  const [stage, setStage] = useState<Stage>("wait");
  const [lines, setLines] = useState<Line[]>([]);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [voice, setVoice] = useState(false); // a voice clip is playing
  const [sprite, setSprite] = useState<HTMLImageElement | null>(null);
  const [waited, setWaited] = useState(false);
  const [reduced] = useState(() => typeof window !== "undefined" && prefersReducedMotion());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch the talking sprite while the splash is still up
  useEffect(() => {
    if (skip) return;
    let alive = true;
    const img = new Image();
    img.src = TALK.src;
    img
      .decode()
      .then(() => alive && setSprite(img))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [skip]);

  // After the splash: come up as soon as the sprite is ready (or, failing that, with the still)
  useEffect(() => {
    if (skip || !splashDone || stage !== "wait") return;
    if (!sprite && !waited) {
      const id = window.setTimeout(() => setWaited(true), LOAD_WAIT_MS);
      return () => clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      setLines(linesFor(screen, progressNow));
      setStage("in");
    }, 0);
    return () => clearTimeout(id);
  }, [skip, splashDone, stage, sprite, waited, screen, progressNow]);

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

  const line = lines[index];
  const text = line?.text ?? "";
  const typed = reduced ? text.length : shown;
  const lineDone = typed >= text.length && !voice;

  // Type the line out
  useEffect(() => {
    if (stage !== "on" || typed >= text.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), 1000 / CPS);
    return () => clearTimeout(id);
  }, [stage, typed, text]);

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

  const leave = () => setStage((s) => (s === "on" || s === "in" ? "out" : s));
  const next = () => {
    if (stage !== "on") return;
    if (typed < text.length) return setShown(text.length); // first tap: finish the line
    audioRef.current?.pause();
    if (index < lines.length - 1) {
      setIndex(index + 1);
      setShown(0);
    } else leave();
  };
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  // A finished line moves on by itself after a pause
  useEffect(() => {
    if (stage !== "on" || !lineDone) return;
    const id = window.setTimeout(() => nextRef.current(), PAUSE_MS + text.length * 20);
    return () => clearTimeout(id);
  }, [stage, lineDone, text, index]);

  // Keyboard: Enter or Space for the next line, Esc to send him away
  useEffect(() => {
    if (stage !== "on") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStage("out");
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        nextRef.current();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [stage]);

  const talking = !reduced && stage === "on" && (typed < text.length || voice);
  useTalkLoop(canvasRef, stage === "wait" || stage === "gone" ? null : sprite, talking);

  if (stage === "wait" || stage === "gone") return null;

  return (
    <div className={`host is-${stage}`} role="dialog" aria-label="Your QR hunting buddy" onClick={next}>
      <div className="host__stage">
        <div className="host__bubble">
          <p className="host__text" aria-hidden="true">
            {text.slice(0, typed)}
            <span className="host__unsaid">{text.slice(typed)}</span>
          </p>
          <p className="host__sr" aria-live="polite">
            {stage === "on" ? text : ""}
          </p>
          <div className="host__foot">
            <span className="host__dots" aria-hidden="true">
              {lines.map((_, i) => (
                <i key={i} className={i <= index ? "is-on" : undefined}></i>
              ))}
            </span>
            <span className="host__hint" aria-hidden="true">
              {index < lines.length - 1 ? "Tap to continue" : "Tap to close"}
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
          {sprite ? (
            <canvas ref={canvasRef} width={TALK.w} height={TALK.h} />
          ) : (
            <img src={IDLE} alt="" width={TALK.w} height={TALK.h} />
          )}
        </div>
      </div>
    </div>
  );
}
