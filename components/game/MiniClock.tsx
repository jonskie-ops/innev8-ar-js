"use client";

import { useClock } from "../Countdown";

/** Compact countdown to the summit, e.g. "36d 18h 17m" (with seconds when `seconds` is set). */
export function MiniClock({ seconds = false }: { seconds?: boolean }) {
  const clock = useClock();
  if (!clock) return <span className="mini-clock">--d --h --m</span>;
  return (
    <span className="mini-clock">
      {clock.d}
      <small>d</small> {clock.h}
      <small>h</small> {clock.m}
      <small>m</small>
      {seconds && (
        <>
          {" "}
          {clock.s}
          <small>s</small>
        </>
      )}
    </span>
  );
}
