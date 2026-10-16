"use client";
/* eslint-disable @next/next/no-img-element -- static SVG logo, nothing for next/image to optimize */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clamp, prefersReducedMotion } from "@/lib/dom";
import { pixelWipe } from "@/lib/pixelWipe";
import { THEME_COLOR } from "@/lib/site";
import { Emblem } from "./Emblem";

const MIN_MS = 2100; // splash runs at least this long
const MAX_MS = 3600; // give up waiting for the background photo after this

const SplashDone = createContext(false);
/** True once the splash is over and its pixels have cleared (straight away with reduced motion). */
export const useSplashDone = () => useContext(SplashDone);

/**
 * Full-screen INNEV8 splash over `children`. Once the minimum time has passed and the countdown's
 * background photo (if shown) has loaded, pixels spread out from the emblem (or from a tap) to cover
 * it, the splash unmounts, and the pixels dissolve to reveal the content. A click or any key skips ahead.
 */
export function Splash({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(false); // eslint-disable-line react-hooks/set-state-in-effect -- media query is client-only
      setReady(true);
      setDone(true);
      return;
    }

    const splash = rootRef.current!;
    const start = performance.now();
    let done = false;
    let raf = 0;
    let cancelWipe: (() => void) | undefined;

    const finish = (e?: Event) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const mark = splash.querySelector(".splash__mark")!.getBoundingClientRect();
      const [x, y] =
        e instanceof MouseEvent
          ? [e.clientX, e.clientY]
          : [mark.left + mark.width / 2, mark.top + mark.height / 2];
      cancelWipe = pixelWipe(
        x,
        y,
        THEME_COLOR,
        () => {
          setShown(false);
          setReady(true);
        },
        () => setDone(true),
      );
    };

    const tick = (now: number) => {
      if (done) return;
      const p = clamp((now - start) / MIN_MS);
      // Looked up each frame: the content under the splash renders after mount.
      const photo = document.querySelector<HTMLImageElement>(".countdown__media img");
      const photoReady = !photo || (photo.complete && photo.naturalWidth > 0);
      if ((p >= 1 && photoReady) || now - start > MAX_MS) finish();
      else raf = requestAnimationFrame(tick);
    };

    splash.addEventListener("click", finish);
    addEventListener("keydown", finish, { once: true });
    raf = requestAnimationFrame(tick);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      cancelWipe?.();
      splash.removeEventListener("click", finish);
      removeEventListener("keydown", finish);
    };
  }, []);

  return (
    <>
      {shown && (
        <div className="splash" aria-hidden="true" ref={rootRef}>
          <div className="splash__stage">
            <div className="splash__mark">
              <Emblem />
            </div>
            <img
              className="splash__wordmark"
              src="/assets/img/logo/innev8-wordmark-reversed.svg"
              alt=""
              width={460}
              height={140}
            />
          </div>
          <div className="splash__curtain"></div>
        </div>
      )}
      <SplashDone.Provider value={done}>
        <div className={ready ? "app is-ready" : "app"}>{children}</div>
      </SplashDone.Provider>
    </>
  );
}
