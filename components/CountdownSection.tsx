"use client";
/* eslint-disable @next/next/no-img-element -- decorative full-bleed background, sized by CSS */

import { useHunt } from "@/lib/huntStore";
import { GOOGLE_CALENDAR_URL, ICS_URL } from "@/lib/site";
import { CountdownClock } from "./Countdown";
import { GetApp } from "./GetApp";
import { CalendarAddIcon, DownloadIcon } from "./icons";

const TZ = "Asia/Manila";
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
const yearFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" });
const longFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric" });
const isoDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ms); // 2026-11-20

export function CountdownSection() {
  // The summit's days, as set on the admin's Event page (Philippine time)
  const { start, end } = useHunt().hunt.settings;
  const sameDay = isoDay(start) === isoDay(end);
  return (
    <section className="countdown" id="countdown">
      <div className="countdown__media" aria-hidden="true">
        <img src="/assets/img/tunnel-1200.webp" alt="" width={2400} height={1800} decoding="async" />
        <div className="countdown__veil"></div>
      </div>
      <div className="container countdown__inner">
        <p className="eyebrow reveal">The road to {longFmt.format(start)}</p>
        <h1 className="reveal">
          The countdown <span className="grad">is on.</span>
        </h1>
        <CountdownClock />
        <div className="save reveal" id="save">
          <p className="save__date">
            <strong>
              {!sameDay && (
                <>
                  <time dateTime={isoDay(start)}>{dayFmt.format(start)}</time> –{" "}
                </>
              )}
              <time dateTime={isoDay(end)}>
                {dayFmt.format(end)}, {yearFmt.format(end)}
              </time>
            </strong>
            <span>Leyte Academic Center · Palo, Leyte</span>
          </p>
          <div className="save__btns">
            <a className="btn btn--primary" target="_blank" rel="noopener" href={GOOGLE_CALENDAR_URL}>
              <CalendarAddIcon />
              Google Calendar
            </a>{" "}
            <a className="btn btn--ghost" href={ICS_URL} download>
              <DownloadIcon />
              Apple / Outlook (.ics)
            </a>
          </div>
          <p className="save__note">Registration opens soon.</p>
        </div>
        <GetApp variant="card" />
      </div>
    </section>
  );
}
