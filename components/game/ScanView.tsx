"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pad2 } from "@/lib/dom";
import { STATIONS, TOTAL, type Station } from "@/lib/hunt";
import { TEST_MODE } from "@/lib/site";
import { ScanQufoo, type Line } from "../Mascot";
import type { ArPhase, ArStage, CamState, Guide } from "./ar/stage";
import { ArrowRightIcon, CameraOffIcon, CloseIcon } from "./icons";
import { QrTile } from "./QrTile";

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
 * even when the player came looking for a different one. All 8 codes sit in a strip at the bottom
 * with one selected (the one they came for, else the first still to find): tap another to look for
 * it instead. Its clue shows, and the test radar shows only it.
 * (Test placement: random spots around you; the venue spots come later.)
 */
export function ScanView({
  target,
  found,
  onCatch,
  onClose,
}: {
  /** The code the player came to look for (e.g. Find it): always hidden here, and the radar points to it. */
  target?: Station;
  found: Record<string, number>;
  onCatch: (station: Station) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<ArStage | null>(null);
  // The code to look for first: the one they came for, else the first still to find
  const [start] = useState(() => (target && !found[target.id] ? target : STATIONS.find((s) => !found[s.id])));
  const [hidden] = useState(() => pickHidden(found, start));
  const [chosen, setChosen] = useState(start); // changed in the strip at the bottom
  const [phase, setPhase] = useState<ArPhase | "loading">("loading");
  const [station, setStation] = useState<Station | null>(null);
  const [cam, setCam] = useState<CamState | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [failed, setFailed] = useState(false);
  const [xr, setXr] = useState<"on" | "offer" | null>(null);
  const [near, setNear] = useState(false); // a hidden code is on screen
  const choose = (s: Station) => {
    if (s === chosen) return;
    setChosen(s);
    stageRef.current?.setTarget(s);
  };

  // The latest callbacks, for the AR stage that's set up once
  const live = useRef({ onCatch, onClose });
  useEffect(() => {
    live.current = { onCatch, onClose };
  });

  // The 3D layer (and three.js) loads only when the scanner opens.
  useEffect(() => {
    let alive = true;
    import("./ar/stage")
      .then(({ createArStage }) =>
        createArStage(hostRef.current!, videoRef.current!, rootRef.current!, hidden, start, {
          onPhase: (p, st) => {
            setPhase(p);
            setStation(st);
          },
          onCamera: setCam,
          onGuide: setGuide,
          onCollect: (st) => live.current.onCatch(st),
          onXr: setXr,
          onNear: setNear,
          onEnd: () => live.current.onClose(), // e.g. the phone's back button during AR
        }),
      )
      .then((s) => {
        if (alive) stageRef.current = s;
        else s.dispose();
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [hidden, start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = STATIONS.filter((s) => found[s.id]).length;
  const num = station ? `#${pad2(station.num)}` : "";
  const help = TEST_MODE && phase === "searching" ? guide : null; // radar and arrows are a test aid

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
    ) : chosen ? (
      <>
        Scanning<span className="blink">…</span> look for QR code #{pad2(chosen.num)}
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

  const camMessage = cam && xr !== "on" ? CAM_MESSAGE[cam] : undefined;
  // Qufoo sniffs while you search (you hear him sniff), and speaks up once a code is near
  const qufooSays: Line | null =
    phase === "searching"
      ? near
        ? { text: "Sniff sniff… I smell a QR code! It's close, hold steady.", say: "I smell a QR code! It's close, hold steady." }
        : null
      : phase === "found"
        ? { text: "There it is!" }
        : phase === "ready"
          ? { text: "Tap it to collect it!" }
          : phase === "collecting"
            ? { text: "Got it! Good job!" }
            : phase === "done"
              ? { text: `You found all ${TOTAL}! Amazing!` }
              : null;
  // Test aid: how this phone follows the player's movement
  const tracking =
    xr === "on" ? "WebXR tracking" : cam === "on" ? "Camera tracking" : cam && cam !== "starting" ? "No camera" : null;

  return (
    <div
      ref={rootRef}
      className={xr === "on" ? "scan is-xr" : cam === "on" ? "scan is-live" : "scan"}
      role="dialog"
      aria-modal="true"
      aria-label="AR scanner"
    >
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
        {TEST_MODE && tracking && <span className="chip chip--mode">{tracking}</span>}
        <span className="chip chip--count">
          <i className="chip__px" aria-hidden="true"></i>
          {count}/{TOTAL}
        </span>
      </div>

      {help && (
        <div className="scan__radar" aria-hidden="true">
          <span className="scan__radar-cone"></span>
          {/* Only the code being looked for */}
          {help.blips
            .filter((b) => b.target)
            .map((b, i) => (
              <span key={i} className="scan__radar-blip" style={{ "--a": `${b.angle}rad` } as CSSProperties}></span>
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

      {/* What's happening, just above the scan frame */}
      <p className="scan__hint" aria-live="polite">
        {hint}
      </p>

      <div className="scan__bottom">
        {xr === "offer" && (
          <>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => stageRef.current?.startXr()}>
              Start full AR
            </button>
            <p className="scan__tip">Walk around the QR codes: they stay in place as you move</p>
          </>
        )}
        {/* The tip and clue, centred, with Qufoo level with them at the right end */}
        <div className="scan__row">
          <div className="scan__words">
            {phase === "searching" && guide && !guide.sensors && <p className="scan__tip">Drag to look around</p>}
            {chosen && phase === "searching" && (
              <p className="scan__clue">
                <b>#{pad2(chosen.num)}</b> &ldquo;{chosen.clue}&rdquo;
              </p>
            )}
          </div>
          {!failed && phase !== "loading" && <ScanQufoo say={qufooSays} />}
        </div>
        <div className="scan__codes" role="group" aria-label="Choose a QR code to look for">
          {STATIONS.map((s, i) => {
            const got = Boolean(found[s.id]);
            const on = chosen === s;
            return (
              <button
                key={s.id}
                type="button"
                className={on ? "scan__code is-on" : "scan__code"}
                disabled={got}
                aria-pressed={on}
                aria-label={got ? `QR code #${s.num}, found` : `Look for QR code #${s.num}`}
                onClick={() => choose(s)}
              >
                <QrTile station={s} state={got ? "found" : "locked"} size="sm" i={i} />
                <span className="scan__code-num">{pad2(s.num)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
