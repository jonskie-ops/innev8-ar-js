"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { badgeText, minuteNow, pinFor, type Hunter } from "@/lib/hunter";

/** A QR code as an SVG path (its modules, one unit each, inside a 4-unit quiet zone). */
export function qrPath(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  return { d, size: n + 8 };
}

/**
 * This player's hunter QR, for another hunter to scan: their tag and this minute's PIN (it changes
 * every minute, so an old screenshot stops working), with the same written under it for a phone whose
 * camera can't scan. Works offline: the PIN is worked out on the phone.
 */
export function HunterQr({ hunter, name }: { hunter: Hunter; name: string }) {
  const [minute, setMinute] = useState(minuteNow);
  const [pin, setPin] = useState<string | null>(null);

  // A new PIN on each new minute
  useEffect(() => {
    let t = 0;
    const next = () => {
      setMinute(minuteNow());
      t = window.setTimeout(next, 60_000 - (Date.now() % 60_000) + 50);
    };
    t = window.setTimeout(next, 60_000 - (Date.now() % 60_000) + 50);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let alive = true;
    void pinFor(hunter.secret, minute).then((p) => alive && setPin(p));
    return () => {
      alive = false;
    };
  }, [hunter.secret, minute]);

  const path = useMemo(() => (pin ? qrPath(badgeText(hunter.tag, pin)) : null), [hunter.tag, pin]);

  return (
    <figure className="hqr">
      <div className="hqr__code">
        {path ? (
          <svg viewBox={`0 0 ${path.size} ${path.size}`} shapeRendering="crispEdges" role="img" aria-label={`${name}'s hunter QR`}>
            <rect width={path.size} height={path.size} fill="#fff" />
            <path d={path.d} fill="#030817" />
          </svg>
        ) : (
          <span className="spin" aria-hidden="true" />
        )}
      </div>
      <figcaption>
        <b className="hqr__id">
          {hunter.tag}
          <span aria-hidden="true"> · </span>
          <span className="hqr__pin">{pin ?? "····"}</span>
        </b>
        <small>Changes every minute. Can&apos;t scan? Type these instead.</small>
      </figcaption>
    </figure>
  );
}
