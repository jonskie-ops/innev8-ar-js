"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pad2 } from "@/lib/dom";
import { STATIONS, TOTAL, type Station } from "@/lib/hunt";
import { TEST_MODE } from "@/lib/site";
import type { ArPhase, CamState, Guide } from "./ar/stage";
import { ArrowRightIcon, CameraOffIcon, CloseIcon } from "./icons";

/** Codes hidden around the player each time the scanner opens. */
const PER_SCAN = 3;

const TURN_HINT: Record<NonNullable<Guide["turn"]>, string> = {
  left: "is nearby: turn left",
  right: "is nearby: turn right",
  down: "Look a little lower",
  up: "Look a little higher",
};

const CAM_MESSAGE: Partial<Record<CamState, string>> = {
  denied: "Camera access is blocked. Allow it in your browser's site settings, then reopen the scanner.",
  unavailable: "No camera is available on this device.",
};

/** A few of the codes still to find, always including the one the player chose (if any). */
function pickHidden(found: Record<string, number>, target?: Station) {
  const rest = STATIONS.filter((s) => !found[s.id] && s !== target).sort(() => Math.random() - 0.5);
  return (target && !found[target.id] ? [target, ...rest] : rest).slice(0, PER_SCAN);
}

/**
 * Full-screen AR scanner. The hunt's QR codes are virtual: a few of the ones still to find are hidden
 * around the player, invisible until the camera is held on their spot. Then the code assembles in 3D
 * and a tap collects it. No set order: whichever code is fully scanned first is the one collected,
 * even when the player came looking for a different one. (Test placement: random spots around you;
 * the venue spots come later.)
 */
export function ScanView({
  target,
  found,
  onCatch,
  onClose,
}: {
  /** The code the player chose to look for: always hidden here, and the radar points to it. */
  target?: Station;
  found: Record<string, number>;
  onCatch: (station: Station) => void;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hidden] = useState(() => pickHidden(found, target));
  const [phase, setPhase] = useState<ArPhase | "loading">("loading");
  const [station, setStation] = useState<Station | null>(null);
  const [cam, setCam] = useState<CamState | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [failed, setFailed] = useState(false);

  // The latest callbacks, for the AR stage that's set up once
  const live = useRef({ onCatch });
  useEffect(() => {
    live.current = { onCatch };
  });

  // The 3D layer (and three.js) loads only when the scanner opens.
  useEffect(() => {
    let alive = true;
    let stage: { dispose: () => void } | undefined;
    import("./ar/stage")
      .then(({ createArStage }) =>
        createArStage(hostRef.current!, videoRef.current!, hidden, target, {
          onPhase: (p, st) => {
            setPhase(p);
            setStation(st);
          },
          onCamera: setCam,
          onGuide: setGuide,
          onCollect: (st) => live.current.onCatch(st),
        }),
      )
      .then((s) => {
        if (alive) stage = s;
        else s.dispose();
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      stage?.dispose();
    };
  }, [hidden, target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = Object.keys(found).length;
  const num = station ? `#${pad2(station.num)}` : "";
  const help = TEST_MODE && phase === "searching" ? guide : null; // radar and arrows are a test aid
  const chosen = target && !found[target.id] ? target : undefined;

  let hint: ReactNode = "Starting AR…";
  if (failed) hint = "AR isn't available in this browser.";
  else if (phase === "searching") {
    hint = help?.turn ? (
      help.turn === "left" || help.turn === "right" ? (
        `${chosen ? `QR code #${pad2(chosen.num)}` : "A QR code"} ${TURN_HINT[help.turn]}`
      ) : (
        TURN_HINT[help.turn]
      )
    ) : help ? (
      <>
        Hold still<span className="blink">…</span> something is here
      </>
    ) : (
      <>
        Scanning<span className="blink">…</span> look around for a hidden INNEV8 QR code
      </>
    );
  } else if (phase === "found") hint = <>QR code {num} revealed!</>;
  else if (phase === "ready") hint = "Tap the QR code to collect it";
  else if (phase === "collecting") hint = <>Collecting QR code {num}…</>;
  else if (phase === "done") hint = `You've found all ${TOTAL} QR codes!`;

  const camMessage = cam ? CAM_MESSAGE[cam] : undefined;

  return (
    <div className={cam === "on" ? "scan is-live" : "scan"} role="dialog" aria-modal="true" aria-label="AR scanner">
      <video ref={videoRef} className="scan__video" playsInline muted autoPlay />
      <div ref={hostRef} className="scan__stage" />
      <div className="scan__shade" aria-hidden="true"></div>

      {camMessage && (
        <div className="scan__nocam">
          <CameraOffIcon />
          <p>{camMessage}</p>
        </div>
      )}

      <div className="scan__top">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close scanner">
          <CloseIcon />
        </button>
        <span className="chip chip--count">
          <i className="chip__px" aria-hidden="true"></i>
          {count}/{TOTAL}
        </span>
      </div>

      {help && (
        <div className="scan__radar" aria-hidden="true">
          <span className="scan__radar-cone"></span>
          {help.blips.map((b, i) => (
            <span
              key={i}
              className={b.target ? "scan__radar-blip is-target" : "scan__radar-blip"}
              style={{ "--a": `${b.angle}rad` } as CSSProperties}
            ></span>
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

      {help?.turn && (
        <span className={`scan__arrow scan__arrow--${help.turn}`} aria-hidden="true">
          <ArrowRightIcon />
        </span>
      )}

      <div className="scan__bottom">
        <p className="scan__hint" aria-live="polite">
          {hint}
        </p>
        {phase === "searching" && guide && !guide.sensors && <p className="scan__tip">Drag to look around</p>}
      </div>
    </div>
  );
}
