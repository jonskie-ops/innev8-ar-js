"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { pad2 } from "@/lib/dom";
import { POINTS, RARITY_LABEL, STATIONS, type Rarity, type Station } from "@/lib/hunt";
import { CloseIcon } from "../game/icons";
import type { CamState, Mode, Phase, Stage } from "./stage";

/** The code shown on the demo card for each rarity. */
const DEMO: Record<Rarity, Station> = {
  common: STATIONS.find((s) => s.rarity === "common")!,
  rare: STATIONS.find((s) => s.rarity === "rare")!,
  legendary: STATIONS.find((s) => s.rarity === "legendary")!,
};

const CAM_NOTE: Record<CamState, string> = {
  starting: "Starting camera…",
  on: "",
  denied: "Camera access is blocked. Allow it in your browser's site settings, then try again.",
  unavailable: "No camera is available on this device.",
  insecure: "Camera mode needs the secure (https://) site. Open innev8-ar-js.vercel.app/showcase on your phone.",
};

/**
 * Showcase of the planned 3D collect moment. Demo plays it on a virtual table; Camera runs it on a
 * real printed code. Nothing here touches the player's real collection.
 */
export function Showcase() {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("demo");
  const [rarity, setRarity] = useState<Rarity>("legendary");
  const [phase, setPhase] = useState<Phase>("loading");
  const [station, setStation] = useState<Station>(DEMO.legendary);
  const [cam, setCam] = useState<CamState | null>(null);
  const [lost, setLost] = useState(false);
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const toastTimer = useRef(0);

  const showToast = useCallback((msg: string) => {
    setToast({ msg, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // The 3D stage (and three.js) loads only on this page.
  useEffect(() => {
    let alive = true;
    import("./stage")
      .then(({ createStage }) =>
        createStage(hostRef.current!, videoRef.current!, {
          onPhase: (p, st) => {
            setPhase(p);
            setStation(st);
            if (p === "collecting") setCount((c) => c + 1);
          },
          onCamera: setCam,
          onToast: showToast,
          onLost: setLost,
        }),
      )
      .then((stage) => {
        if (!alive) return stage.dispose();
        stageRef.current = stage;
        stage.setStation(DEMO.legendary);
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      stageRef.current?.dispose();
      stageRef.current = null;
      clearTimeout(toastTimer.current);
    };
  }, [showToast]);

  const pickMode = (m: Mode) => {
    setMode(m);
    setLost(false);
    stageRef.current?.setMode(m);
    if (m === "demo") stageRef.current?.setStation(DEMO[rarity]);
  };
  const pickRarity = (r: Rarity) => {
    setRarity(r);
    stageRef.current?.setStation(DEMO[r]);
  };

  const num = `#${pad2(station.num)}`;
  const camBlocked = mode === "camera" && cam !== null && cam !== "on";
  let hint: ReactNode = "Loading 3D…";
  if (failed) hint = "3D isn't available in this browser.";
  else if (camBlocked) hint = CAM_NOTE[cam];
  else if (phase === "scanning") hint = <>Scanning<span className="blink">…</span> point at an INNEV8 QR code</>;
  else if (phase === "found" || phase === "rising")
    hint = (
      <>
        <b>QR code {num}</b> found!
      </>
    );
  else if (phase === "ready") hint = lost ? "Keep the QR code in view" : "Tap the emblem to collect it";
  else if (phase === "collecting") hint = <>Collecting QR code {num}…</>;
  else if (phase === "collected") hint = mode === "demo" ? "Try another rarity, or switch to Camera" : "Scan another INNEV8 QR code";

  return (
    <div className={`show show--${mode}${cam === "on" ? " is-live" : ""}`}>
      <video ref={videoRef} className="show__video" playsInline muted autoPlay />
      <div ref={hostRef} className="show__stage" />

      <div className="show__top">
        <Link className="icon-btn" href="/" aria-label="Back to the hunt">
          <CloseIcon />
        </Link>
        <span className="show__title">3D collect · showcase</span>
        <span className="chip chip--count" aria-label={`${count} collected in this showcase`}>
          <i className="chip__px" aria-hidden="true"></i>
          {count}
        </span>
      </div>

      {ready && phase === "scanning" && !camBlocked && (
        <div className="scanner scan__frame" aria-hidden="true">
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__beam"></span>
        </div>
      )}

      {phase === "collected" && (
        <div className="card show__result" role="status">
          <p className="label">QR code collected!</p>
          <h2>
            {num} {station.name}
          </h2>
          <p className="show__meta">
            <span className={`rarity rarity--${station.rarity}`}>{RARITY_LABEL[station.rarity]}</span> · +
            {POINTS[station.rarity]} pts
          </p>
          <p className="show__note">Showcase only: this doesn&apos;t change your real collection.</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => stageRef.current?.replay()}>
            Play again
          </button>
        </div>
      )}

      <div className="show__bottom">
        <p className="scan__hint" aria-live="polite">
          {hint}
        </p>
        <div className="show__controls">
          <div className="seg" role="group" aria-label="Mode">
            {(["demo", "camera"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? "seg__btn is-on" : "seg__btn"}
                aria-pressed={mode === m}
                disabled={!ready}
                onClick={() => pickMode(m)}
              >
                {m === "demo" ? "Demo" : "Camera"}
              </button>
            ))}
          </div>
          {mode === "demo" && (
            <div className="seg" role="group" aria-label="Rarity">
              {(["common", "rare", "legendary"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={rarity === r ? "seg__btn is-on" : "seg__btn"}
                  aria-pressed={rarity === r}
                  disabled={!ready}
                  onClick={() => pickRarity(r)}
                >
                  {RARITY_LABEL[r]}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode === "demo" && ready && <p className="show__tip">Drag to look around · pinch to zoom</p>}
      </div>

      {toast && (
        <p key={toast.id} className="toast" role="status">
          {toast.msg}
        </p>
      )}
    </div>
  );
}
