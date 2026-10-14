"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pad2 } from "@/lib/dom";
import { POINTS, RARITY_LABEL, type Station } from "@/lib/hunt";
import { ArrowRightIcon, CloseIcon } from "../game/icons";
import type { CamState, Guide, Phase, Stage } from "./stage";

const TURN_HINT: Record<NonNullable<Guide["turn"]>, string> = {
  left: "A QR code is nearby: turn left",
  right: "A QR code is nearby: turn right",
  down: "Look a little lower",
  up: "Look a little higher",
};

/**
 * AR test: 3D QR codes hidden at fixed spots around you, each invisible until the camera is held
 * on it. Nothing to print. Nothing here touches the player's real collection.
 */
export function Showcase() {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [station, setStation] = useState<Station | null>(null);
  const [score, setScore] = useState({ found: 0, total: 3 });
  const [cam, setCam] = useState<CamState | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [secure, setSecure] = useState(true);

  // The 3D stage (and three.js) loads only on this page.
  useEffect(() => {
    setSecure(window.isSecureContext); // eslint-disable-line react-hooks/set-state-in-effect -- browser-only check
    let alive = true;
    import("./stage")
      .then(({ createStage }) =>
        createStage(hostRef.current!, videoRef.current!, {
          onPhase: (p, st, found, total) => {
            setPhase(p);
            setStation(st);
            setScore({ found, total });
          },
          onCamera: setCam,
          onGuide: setGuide,
        }),
      )
      .then((stage) => {
        if (!alive) return stage.dispose();
        stageRef.current = stage;
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, []);

  const num = station ? `#${pad2(station.num)}` : "";
  let hint: ReactNode = ready ? "" : "Loading 3D…";
  if (failed) hint = "3D isn't available in this browser.";
  else if (phase === "searching") {
    hint = guide?.turn ? (
      TURN_HINT[guide.turn]
    ) : (
      <>
        Hold still<span className="blink">…</span> something is here
      </>
    );
  } else if (phase === "found") hint = <>QR code {num} revealed!</>;
  else if (phase === "ready") hint = "Tap the QR code to collect it";
  else if (phase === "collecting") hint = <>Collecting QR code {num}…</>;

  const left = score.total - score.found;
  const camNote =
    cam === "insecure"
      ? "No camera on this address, so you're in a virtual room. Open the https:// site on your phone for the real thing."
      : cam === "denied"
        ? "Camera blocked, so you're in a virtual room. Allow the camera in your browser's site settings."
        : cam === "unavailable"
          ? "No camera found, so you're in a virtual room."
          : null;

  return (
    <div className={`show${cam === "on" ? " is-live" : ""}`}>
      <video ref={videoRef} className="show__video" playsInline muted autoPlay />
      <div ref={hostRef} className="show__stage" />

      <div className="show__top">
        <Link className="icon-btn" href="/" aria-label="Back to the hunt">
          <CloseIcon />
        </Link>
        <span className="show__title">AR test · hidden QR codes</span>
        <span className="chip chip--count" aria-label={`${score.found} of ${score.total} found`}>
          <i className="chip__px" aria-hidden="true"></i>
          {score.found}/{score.total}
        </span>
      </div>

      {phase === "searching" && guide && (
        <div className="show__radar" aria-hidden="true">
          <span className="show__radar-cone"></span>
          {guide.blips.map((a, i) => (
            <span key={i} className="show__radar-blip" style={{ "--a": `${a}rad` } as CSSProperties}></span>
          ))}
        </div>
      )}

      {phase === "searching" && (
        <div className="scanner scan__frame" aria-hidden="true">
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__beam"></span>
        </div>
      )}

      {phase === "searching" && guide?.turn && (
        <span className={`show__arrow show__arrow--${guide.turn}`} aria-hidden="true">
          <ArrowRightIcon />
        </span>
      )}

      {phase === "intro" && ready && (
        <div className="card show__panel">
          <p className="label">AR test</p>
          <h2>{score.total} QR codes are hidden around you</h2>
          <p>
            They&apos;re invisible until your camera points at them. Turn around with your phone, hold the frame on a
            spot until a code appears, then tap it to collect it.
          </p>
          {!secure && <p className="show__note">This address has no camera, so you&apos;ll get a virtual room.</p>}
          <button type="button" className="btn btn--primary btn--sm" onClick={() => stageRef.current?.start()}>
            Start
          </button>
        </div>
      )}

      {phase === "collected" && station && (
        <div className="card show__panel" role="status">
          <p className="label">QR code collected!</p>
          <h2>
            {num} {station.name}
          </h2>
          <p className="show__meta">
            <span className={`rarity rarity--${station.rarity}`}>{RARITY_LABEL[station.rarity]}</span> · +
            {POINTS[station.rarity]} pts
          </p>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => stageRef.current?.next()}>
            {left > 0 ? `Keep hunting (${left} left)` : "Finish"}
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="card show__panel" role="status">
          <p className="label">All found</p>
          <h2>You found all {score.total} QR codes!</h2>
          <p className="show__note">Test only: this doesn&apos;t change your real collection.</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => stageRef.current?.scatter()}>
            Hide new codes
          </button>
        </div>
      )}

      <div className="show__bottom">
        <p className="scan__hint" aria-live="polite">
          {hint}
        </p>
        {phase === "searching" && (
          <>
            {camNote && <p className="show__tip">{camNote}</p>}
            <p className="show__tip">
              {guide?.sensors ? "Turn around with your phone to look" : "Drag to look around"}
            </p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => stageRef.current?.scatter()}>
              Hide new codes
            </button>
          </>
        )}
      </div>
    </div>
  );
}
