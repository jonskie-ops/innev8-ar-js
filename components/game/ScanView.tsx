"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { clamp, pad2 } from "@/lib/dom";
import { STATIONS, TOTAL, stationFromPayload, type Station } from "@/lib/hunt";
import { TEST_MODE } from "@/lib/site";
import { CameraOffIcon, CloseIcon } from "./icons";
import { QrTile } from "./QrTile";

type Cam = "starting" | "on" | "denied" | "unavailable" | "insecure";
type Target = { station: Station; x: number; y: number; size: number };

const SAMPLE_W = 480; // frames are downscaled to this width before decoding
const SCAN_MS = 110; // decode at most ~9 times a second
const TOAST_MS = 3000; // don't repeat the same scan message more often than this
const CATCH_MS = 900; // length of the collect animation

const CAM_MESSAGE: Record<Exclude<Cam, "on">, string> = {
  starting: "Starting camera…",
  denied: "Camera access is blocked. Allow it in your browser's site settings, then reopen the scanner.",
  unavailable: "No camera is available on this device.",
  insecure: "The camera only works on a secure (https://) page.",
};

/** A code floating mid-screen, for deep links and simulated finds. */
function centered(station: Station): Target {
  return { station, x: innerWidth / 2, y: innerHeight * 0.44, size: Math.min(innerWidth * 0.42, 180) };
}

/**
 * Full-screen AR scanner. Reads the hunt's INNEV8 QR codes from the rear camera and pins a
 * glowing holographic copy of the code over it; tapping it collects the code.
 */
export function ScanView({
  preset,
  found,
  onCatch,
  onClose,
  onToast,
}: {
  /** Start with this code already in view (deep link). */
  preset?: Station;
  found: Record<string, number>;
  onCatch: (station: Station) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<Cam>("starting");
  const [target, setTarget] = useState<Target | null>(() => (preset ? centered(preset) : null));
  const [catching, setCatching] = useState(false);
  const catchTimer = useRef(0);

  // The decode loop is set up once; it reads the latest props through this ref.
  const live = useRef({ found, onToast, catching });
  useEffect(() => {
    live.current = { found, onToast, catching };
  });

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCam(window.isSecureContext ? "unavailable" : "insecure"); // eslint-disable-line react-hooks/set-state-in-effect -- browser capability check
      return;
    }

    let stopped = false;
    let stream: MediaStream | undefined;
    let raf = 0;
    let last = 0;
    const toasted = new Map<string, number>();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const toastOnce = (key: string, msg: string) => {
      const now = Date.now();
      if (now - (toasted.get(key) ?? 0) < TOAST_MS) return;
      toasted.set(key, now);
      live.current.onToast(msg);
    };

    const detect = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(detect);
      const video = videoRef.current;
      if (now - last < SCAN_MS || live.current.catching || !video || video.readyState < 2 || !video.videoWidth) return;
      last = now;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const k = Math.min(1, SAMPLE_W / vw);
      const w = Math.round(vw * k);
      const h = Math.round(vh * k);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.drawImage(video, 0, 0, w, h);
      const qr = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
      if (!qr) return;

      const station = stationFromPayload(qr.data);
      if (!station) return toastOnce("?", "That's not an INNEV8 QR code.");
      if (live.current.found[station.id]) {
        return toastOnce(station.id, `You already found QR code #${station.num}. Find another one!`);
      }

      // Pin the holographic copy on the real code: map its corners from the sampled frame onto the
      // on-screen video, which is scaled to cover the viewport (object-fit: cover).
      const { topLeftCorner: a, topRightCorner: b, bottomLeftCorner: c, bottomRightCorner: d } = qr.location;
      const box = video.getBoundingClientRect();
      const cover = Math.max(box.width / vw, box.height / vh);
      const f = cover / k;
      const ox = (box.width - vw * cover) / 2;
      const oy = (box.height - vh * cover) / 2;
      const side = Math.hypot(b.x - a.x, b.y - a.y) * f;
      setTarget({
        station,
        x: ((a.x + b.x + c.x + d.x) / 4) * f + ox,
        y: ((a.y + b.y + c.y + d.y) / 4) * f + oy,
        size: clamp(side * 1.2, 96, 260),
      });
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        await video.play().catch(() => {});
        setCam("on");
        raf = requestAnimationFrame(detect);
      })
      .catch((e: unknown) => setCam(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unavailable"));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => clearTimeout(catchTimer.current), []);

  function catchIt() {
    if (!target || catching) return;
    setCatching(true);
    navigator.vibrate?.([20, 40, 80]);
    const { station } = target;
    catchTimer.current = window.setTimeout(() => onCatch(station), CATCH_MS);
  }

  const count = Object.keys(found).length;
  const unfound = STATIONS.filter((s) => !found[s.id]);

  return (
    <div className={cam === "on" ? "scan is-live" : "scan"} role="dialog" aria-modal="true" aria-label="AR scanner">
      <video ref={videoRef} className="scan__video" playsInline muted autoPlay />
      <div className="scan__shade" aria-hidden="true"></div>

      {cam !== "on" && (
        <div className="scan__nocam">
          {cam !== "starting" && <CameraOffIcon />}
          <p>{CAM_MESSAGE[cam]}</p>
          {cam === "insecure" && TEST_MODE && (
            <p className="scan__dev">
              Run <code>npm run dev:https</code>, or collect with the test buttons below.
            </p>
          )}
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

      {!target && (
        <div className="scanner scan__frame" aria-hidden="true">
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__beam"></span>
        </div>
      )}

      {target && (
        <button
          type="button"
          className={`scan__qr scan__qr--${target.station.rarity}${catching ? " is-caught" : ""}`}
          style={{
            width: target.size,
            transform: `translate(${target.x - target.size / 2}px, ${target.y - target.size / 2}px)`,
          }}
          onClick={catchIt}
          aria-label={`Collect QR code #${target.station.num}`}
        >
          <span className="scan__ring" aria-hidden="true"></span>
          <QrTile station={target.station} state="reveal" size="lg" />
        </button>
      )}

      <div className="scan__bottom">
        <p className="scan__hint" aria-live="polite">
          {catching ? (
            <>Collecting QR code #{target?.station.num}…</>
          ) : target ? (
            <>
              <b>QR code #{target.station.num}</b> found! Tap it to collect.
            </>
          ) : (
            <>
              Scanning<span className="blink">…</span> point at an INNEV8 QR code
            </>
          )}
        </p>
        {TEST_MODE && !target && unfound.length > 0 && (
          <div className="scan__sim">
            <p className="scan__sim-label">Test mode · simulate a find</p>
            <div className="scan__sim-list">
              {unfound.map((s) => (
                <button key={s.id} type="button" className="chip chip--btn" onClick={() => setTarget(centered(s))}>
                  #{pad2(s.num)} {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
