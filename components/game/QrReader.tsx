"use client";

import { useEffect, useRef, useState } from "react";
import { readBadge } from "@/lib/hunter";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (opts: { formats: string[] }) => Detector;

/**
 * The camera, reading another hunter's QR: the phone's own QR reader where it has one (Android), else
 * jsQR on frames from the camera (iPhone, computers). Reports the tag and PIN of the first hunter QR it
 * sees; anything else is ignored.
 */
export function QrReader({ onRead, onFail }: { onRead: (tag: string, pin: string) => void; onFail: (why: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const latest = useRef({ onRead, onFail });
  useEffect(() => {
    latest.current = { onRead, onFail };
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        if (!stopped) latest.current.onFail((e as Error).name === "NotAllowedError" ? "denied" : "unavailable");
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setLive(true);

      // The phone's own reader, if it reads QR codes
      const Native = (globalThis as { BarcodeDetector?: DetectorClass & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      let native: Detector | null = null;
      try {
        if (Native && (await Native.getSupportedFormats?.())?.includes("qr_code")) native = new Native({ formats: ["qr_code"] });
      } catch {}
      const jsQR = native ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped) return;
        if (v.readyState >= 2 && v.videoWidth) {
          let text: string | null = null;
          if (native) {
            text = (await native.detect(v).catch(() => []))[0]?.rawValue ?? null;
          } else if (jsQR && ctx) {
            // A smaller copy reads faster, and is plenty for a QR held up close
            const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
          }
          const badge = text ? readBadge(text) : null;
          if (badge && !stopped) {
            stopped = true;
            latest.current.onRead(badge.tag, badge.pin);
            return;
          }
        }
        timer = window.setTimeout(() => void tick(), 120);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className={live ? "qreader is-live" : "qreader"}>
      <video ref={video} playsInline muted aria-label="Camera: point it at their hunter QR" />
      <span className="qreader__frame" aria-hidden="true" />
      {!live && (
        <span className="qreader__wait">
          <span className="spin" aria-hidden="true" />
          Starting the camera…
        </span>
      )}
    </div>
  );
}
