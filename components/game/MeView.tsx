"use client";
/* eslint-disable @next/next/no-img-element -- decorative cover photo, already sized for phones */

import { useEffect, useRef, useState } from "react";
import { levelOf, STATIONS, TOTAL } from "@/lib/hunt";
import { PROVINCES, TEST_MODE } from "@/lib/site";
import { progress } from "@/lib/store";
import type { Phase } from "../Countdown";
import { I8Mark } from "./I8Mark";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  DexIcon,
  InfoIcon,
  PencilIcon,
  PinIcon,
  TrashIcon,
} from "./icons";
import { MiniClock } from "./MiniClock";
import { QrTile } from "./QrTile";

const timeFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * My Profile: a summit cover (bridge photo, event title, INNEV8 mark), then a sheet with the player's
 * avatar, name, province and stats, an About section that turns into the edit form, a strip of their
 * QR codes and the side countdown before the event. Beside the avatar: edit (opens the form) and
 * delete, which wipes the player from this device and starts the app over from the splash (asks first).
 */
export function MeView({
  name,
  province,
  found,
  points,
  phase,
  onCountdown,
  onOpenCodes,
}: {
  name: string;
  province: string;
  found: Record<string, number>;
  points: number;
  phase: Phase;
  onCountdown: () => void;
  onOpenCodes: () => void;
}) {
  const [aboutOpen, setAboutOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false); // the delete button by the avatar asks first
  const [draftName, setDraftName] = useState(name);
  const [draftProvince, setDraftProvince] = useState(province);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  const times = STATIONS.map((s) => found[s.id]).filter(Boolean);
  const count = STATIONS.filter((s) => found[s.id]).length;
  // Found codes first (oldest first), then the ones still out there.
  const strip = [...STATIONS]
    .sort((a, b) => (found[a.id] || Infinity) - (found[b.id] || Infinity) || a.num - b.num)
    .slice(0, 4);

  const startEdit = () => {
    if (!editing) {
      setDraftName(name);
      setDraftProvince(province);
    }
    setAboutOpen(true);
    setEditing(true);
  };
  const canSave = draftName.trim() !== "";
  const wipe = () => {
    progress.clear();
    location.replace("/"); // a fresh start: splash, mascot, sign-up
  };
  const lost = count ? `your ${count} QR code${count > 1 ? "s" : ""}` : "progress";

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [confirming]);

  return (
    <div className="me">
      <section className="pcover" aria-label="Regional ICT Summit 2026">
        <img
          className="pcover__photo"
          src="/assets/img/bridge-1200.webp"
          alt=""
          width={1200}
          height={810}
          decoding="async"
        />
        <div className="pcover__inner">
          <p className="pcover__title">
            <span className="pcover__l1">Regional</span>
            <span className="pcover__l2">ICT Summit</span>
            <span className="pcover__l3 grad">2026</span>
          </p>
          <div className="pcover__mark" aria-hidden="true">
            <I8Mark />
            <span className="pcover__pedestal"></span>
          </div>
          <span className="pcover__rule" aria-hidden="true"></span>
          <p className="pcover__tag">
            Bridging Industries. Building Partnerships.
            <br />
            <em>Creating a Digital Future.</em>
          </p>
          <ul className="pcover__meta" role="list">
            <li>
              <CalendarIcon />
              <span>
                <strong>November 20–21, 2026</strong>
                <small>Friday &amp; Saturday</small>
              </span>
            </li>
            <li>
              <PinIcon />
              <span>
                <strong>Leyte Academic Center</strong>
                <small>Brgy. Pawing, Palo, Leyte</small>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <div className="psheet">
        <div className="psheet__top">
          <span className="avatar psheet__avatar" aria-hidden="true">
            {(name || "?").charAt(0).toUpperCase()}
          </span>
          <div className="psheet__actions">
            <button type="button" className="icon-btn psheet__act" onClick={startEdit} aria-label="Edit profile">
              <PencilIcon />
            </button>
            <button
              type="button"
              className="icon-btn psheet__act psheet__act--danger"
              onClick={() => setConfirming(true)}
              aria-label="Delete profile"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        <h1 className="psheet__name">{name}</h1>
        <p className="psheet__where">
          <PinIcon />
          {province}
        </p>

        <dl className="pstats">
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

        <section className="psec">
          <button
            type="button"
            className="psec__head"
            aria-expanded={aboutOpen}
            aria-controls="me-about"
            onClick={() => setAboutOpen(!aboutOpen)}
          >
            <span className="psec__icon">
              <InfoIcon />
            </span>
            <span className="psec__title">About</span>
            <span className="psec__chev">
              <ChevronDownIcon />
            </span>
          </button>
          {aboutOpen && (
            <div id="me-about" className="psec__body">
              {editing ? (
                <form
                  className="pedit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!canSave) return;
                    if (draftName.trim() !== name) progress.rename(draftName);
                    if (draftProvince !== province) progress.setProvince(draftProvince);
                    setEditing(false);
                  }}
                >
                  <label className="label" htmlFor="me-name">
                    Name
                  </label>
                  <input
                    id="me-name"
                    ref={nameRef}
                    value={draftName}
                    maxLength={20}
                    autoComplete="nickname"
                    onChange={(e) => setDraftName(e.target.value)}
                  />
                  <label className="label pedit__gap" htmlFor="me-province">
                    Province
                  </label>
                  <select id="me-province" value={draftProvince} onChange={(e) => setDraftProvince(e.target.value)}>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="pedit__actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn--primary btn--sm" disabled={!canSave}>
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="pfacts">
                  <div>
                    <dt>Name</dt>
                    <dd>{name}</dd>
                  </div>
                  <div>
                    <dt>Province</dt>
                    <dd>{province}</dd>
                  </div>
                  <div>
                    <dt>First QR code</dt>
                    <dd>{times.length ? timeFmt.format(Math.min(...times)) : "Not yet"}</dd>
                  </div>
                  <div>
                    <dt>Latest QR code</dt>
                    <dd>{times.length ? timeFmt.format(Math.max(...times)) : "Not yet"}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </section>

        <section className="psec">
          <div className="psec__head">
            <span className="psec__icon">
              <DexIcon />
            </span>
            <span className="psec__title">QR Codes</span>
            <span className="psec__meta">
              {count}/{TOTAL}
            </span>
          </div>
          <div className="psec__strip">
            {strip.map((s, i) => (
              <QrTile key={s.id} station={s} state={found[s.id] ? "found" : "locked"} size="sm" i={i} />
            ))}
            <button type="button" className="psec__more" aria-label="Open your QR collection" onClick={onOpenCodes}>
              <ArrowRightIcon />
            </button>
          </div>
        </section>

        {phase === "before" && (
          <section className="psec">
            <div className="psec__head">
              <span className="psec__icon psec__icon--gold">
                <ClockIcon />
              </span>
              <span className="psec__title">The road to November 20</span>
            </div>
            <div className="psec__body psec__countdown">
              <p className="psec__clock">
                <MiniClock seconds />
              </p>
              {TEST_MODE && (
                <p className="test-note">
                  Test mode: the hunt is open early. In production, &ldquo;The countdown is on.&rdquo; fills the
                  screen until the summit starts.
                </p>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={onCountdown}>
                Open countdown screen
              </button>
            </div>
          </section>
        )}
      </div>

      {confirming && (
        <div
          className="modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="pconfirm-title"
          aria-describedby="pconfirm-text"
        >
          <div className="pconfirm">
            <span className="psec__icon psec__icon--danger pconfirm__icon">
              <TrashIcon />
            </span>
            <h2 id="pconfirm-title">Delete your profile?</h2>
            <p id="pconfirm-text" className="pdelete__text">
              This erases your name, province and {lost} from this phone, and the hunt starts over from the
              beginning.
            </p>
            <div className="pedit__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)} autoFocus>
                Cancel
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={wipe}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
