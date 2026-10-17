/* eslint-disable @next/next/no-img-element -- decorative full-bleed background, sized by CSS */
import { GOOGLE_CALENDAR_URL, ICS_URL } from "@/lib/site";
import { CountdownClock } from "./Countdown";
import { GetApp } from "./GetApp";
import { CalendarAddIcon, DownloadIcon } from "./icons";

export function CountdownSection() {
  return (
    <section className="countdown" id="countdown">
      <div className="countdown__media" aria-hidden="true">
        <img src="/assets/img/tunnel-1200.webp" alt="" width={2400} height={1800} decoding="async" />
        <div className="countdown__veil"></div>
      </div>
      <div className="container countdown__inner">
        <p className="eyebrow reveal">The road to November 20</p>
        <h1 className="reveal">
          The countdown <span className="grad">is on.</span>
        </h1>
        <CountdownClock />
        <div className="save reveal" id="save">
          <p className="save__date">
            <strong>
              <time dateTime="2026-11-20">Fri, Nov 20</time> – <time dateTime="2026-11-21">Sat, Nov 21, 2026</time>
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
