"use client";

import { useState } from "react";
import { levelOf, TOTAL } from "@/lib/hunt";
import { PROVINCES, TEST_MODE } from "@/lib/site";
import { progress } from "@/lib/store";
import type { Phase } from "../Countdown";
import { ClockIcon } from "./icons";
import { MiniClock } from "./MiniClock";

export function MeView({
  name,
  province,
  count,
  points,
  phase,
  onCountdown,
  onDeletePlayer,
}: {
  name: string;
  province: string;
  count: number;
  points: number;
  phase: Phase;
  onCountdown: () => void;
  onDeletePlayer: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const changed = draft.trim() !== "" && draft.trim() !== name;

  return (
    <div className="me">
      <div className="view-head">
        <h1>Hunter</h1>
      </div>

      <section className="card profile">
        <span className="avatar avatar--lg" aria-hidden="true">
          {(name || "?").charAt(0).toUpperCase()}
        </span>
        <form
          className="profile__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (changed) progress.rename(draft);
          }}
        >
          <label className="label" htmlFor="me-name">
            Hunter name
          </label>
          <div className="field">
            <input id="me-name" value={draft} maxLength={20} onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className="btn btn--ghost btn--sm" disabled={!changed}>
              Save
            </button>
          </div>
          <label className="label profile__province-label" htmlFor="me-province">
            Province
          </label>
          <select id="me-province" value={province} onChange={(e) => progress.setProvince(e.target.value)}>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </form>
        <dl className="stats">
          <div>
            <dt>QR codes</dt>
            <dd>
              {count}/{TOTAL}
            </dd>
          </div>
          <div>
            <dt>Points</dt>
            <dd>{points}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{levelOf(points)}</dd>
          </div>
        </dl>
      </section>

      {phase === "before" && (
        <section className="card side-countdown">
          <p className="label">
            <ClockIcon /> The road to November 20
          </p>
          <p className="side-countdown__clock">
            <MiniClock seconds />
          </p>
          {TEST_MODE && (
            <p className="test-note">
              Test mode: the hunt is open early. In production, &ldquo;The countdown is on.&rdquo; fills the screen
              until the summit starts.
            </p>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCountdown}>
            Open countdown screen
          </button>
        </section>
      )}

      <section className="card how">
        <p className="label">How to play</p>
        <ol>
          <li>
            <b>Explore.</b> {TOTAL} INNEV8 QR codes are hidden across the venue. The map shows roughly where.
          </li>
          <li>
            <b>Scan.</b> Found one? Tap Scan and point your camera at the QR code.
          </li>
          <li>
            <b>Collect.</b> Tap the code that pops up to add it to your collection. Collect all {TOTAL} to win a prize.
          </li>
        </ol>
      </section>

      {TEST_MODE && (
        <section className="card tools">
          <p className="label">Test tools</p>
          <a className="btn btn--ghost btn--sm" href="/markers" target="_blank" rel="noopener">
            Printable test QR codes
          </a>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (confirm("Clear all collected QR codes on this device? Your name stays.")) progress.reset();
            }}
          >
            Reset progress
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm btn--danger"
            onClick={() => {
              if (confirm("Delete this player (name and all progress) on this device? You'll go back to the name screen.")) {
                onDeletePlayer();
              }
            }}
          >
            Delete player
          </button>
          <p className="test-note">
            Reset progress keeps your name. Delete player starts over from the &ldquo;Your hunter name&rdquo; screen.
          </p>
        </section>
      )}
    </div>
  );
}
