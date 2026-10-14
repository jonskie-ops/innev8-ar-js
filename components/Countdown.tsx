"use client";

import { Fragment, useEffect, useState } from "react";
import { pad2, prefersReducedMotion } from "@/lib/dom";
import { EVENT_END, EVENT_START } from "@/lib/site";

const DAY = 86_400_000;

export type Phase = "before" | "live" | "after";
type Clock = { d: string; h: string; m: string; s: string; phase: Phase };

const phaseAt = (now: number): Phase =>
  now < EVENT_START.getTime() ? "before" : now > EVENT_END.getTime() ? "after" : "live";

function readClock(now: number): Clock {
  const left = EVENT_START.getTime() - now;
  if (left <= 0) {
    return { d: "00", h: "00", m: "00", s: "00", phase: phaseAt(now) };
  }
  return {
    d: pad2(Math.floor(left / DAY)),
    h: pad2(Math.floor(left / 3_600_000) % 24),
    m: pad2(Math.floor(left / 60_000) % 60),
    s: pad2(Math.floor(left / 1000) % 60),
    phase: "before",
  };
}

/** Ticks once per second, aligned to the wall-clock second. Null until mounted (avoids hydration mismatch). */
export function useClock() {
  const [clock, setClock] = useState<Clock | null>(null);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const now = Date.now();
      const c = readClock(now);
      setClock(c);
      if (c.phase === "before") timer = window.setTimeout(tick, 1000 - (now % 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return clock;
}

/** The event phase, re-checked every 30 s (cheaper than useClock for components that only need the phase). */
export function useEventPhase() {
  const [phase, setPhase] = useState<Phase | null>(null);
  useEffect(() => {
    const check = () => setPhase(phaseAt(Date.now()));
    check();
    const id = window.setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
  return phase;
}

const UNITS = [
  { key: "d", label: "Days" },
  { key: "h", label: "Hours" },
  { key: "m", label: "Minutes" },
  { key: "s", label: "Seconds" },
] as const;

export function CountdownClock() {
  const clock = useClock();
  const [animate, setAnimate] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- media query is client-only
  useEffect(() => setAnimate(!prefersReducedMotion()), []);

  return (
    <>
      <div className="clock reveal" role="timer" aria-label="Time until the summit begins">
        {UNITS.map(({ key, label }, i) => {
          const value = clock ? clock[key] : "00";
          return (
            <Fragment key={key}>
              {i > 0 && (
                <span className="clock__sep" aria-hidden="true">
                  :
                </span>
              )}
              <div className="clock__cell">
                {/* Re-keying on each new value remounts the span, replaying the CSS tick animation. */}
                <span key={value} className={animate && clock ? "clock__num tick" : "clock__num"}>
                  {value}
                </span>
                <span className="clock__lbl">{label}</span>
              </div>
            </Fragment>
          );
        })}
      </div>
      <p className="countdown__live" hidden={!clock || clock.phase === "before"}>
        {clock?.phase === "after"
          ? "That's a wrap. Thank you, Eastern Visayas."
          : "It's happening. Welcome to the Regional ICT Summit 2026."}
      </p>
    </>
  );
}
