"use client";
/* eslint-disable @next/next/no-img-element -- decorative full-bleed background, sized by CSS */

import { useHunt } from "@/lib/huntStore";
import { CountdownClock } from "./Countdown";

const TZ = "Asia/Manila";
const whenFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Before the hunt starts (its start time, from the admin's Settings, or until they press Start): "The
 * hunt hasn't started yet", when it's planned, and the countdown to it. The page opens the hunt by
 * itself once it starts (the hunt's settings are checked every few seconds until then).
 */
export function CountdownSection() {
  const { start } = useHunt().hunt.settings;
  return (
    <section className="countdown" id="countdown">
      <div className="countdown__media" aria-hidden="true">
        <img src="/assets/img/tunnel-1200.webp" alt="" width={2400} height={1800} decoding="async" />
        <div className="countdown__veil"></div>
      </div>
      <div className="container countdown__inner">
        <p className="eyebrow reveal">INNEV8 QR Code Hunt · Regional ICT Summit 2026</p>
        <h1 className="reveal">
          The hunt <span className="grad">hasn&apos;t started yet.</span>
        </h1>
        <CountdownClock />
        <div className="save reveal" id="save">
          <p className="save__date">
            <strong>
              Planned: <time dateTime={new Date(start).toISOString()}>{whenFmt.format(start)}</time>
            </strong>
            <span>Stay on this page: it opens by itself when the organisers start the hunt.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
