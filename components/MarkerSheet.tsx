"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { pad2 } from "@/lib/dom";
import { RARITY_LABEL, STATIONS, zoneName } from "@/lib/hunt";

/**
 * One printable card per hunt QR code. Each QR holds a deep link (`<origin>/?s=<code>`), so the in-game
 * scanner reads it and a phone's own camera app opens the encounter directly.
 */
export function MarkerSheet() {
  const [origin, setOrigin] = useState("");
  const [svgs, setSvgs] = useState<string[]>([]);

  useEffect(() => {
    const o = location.origin;
    setOrigin(o); // eslint-disable-line react-hooks/set-state-in-effect -- origin is only known in the browser
    Promise.all(
      STATIONS.map((s) =>
        QRCode.toString(`${o}/?s=${s.code}`, {
          type: "svg",
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#030817", light: "#ffffff" },
        }),
      ),
    ).then(setSvgs);
  }, []);

  return (
    <div className="markers">
      <header className="markers__head">
        <h1>INNEV8 QR Code Hunt · Test codes</h1>
        <p>
          These are the QR codes players hunt for. Print them, or show them on another screen, and scan them
          with the in-game scanner. Each code links to{" "}
          <code>{origin || "…"}</code>, so open this page from the address your phone uses (e.g. the network URL).
        </p>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => print()}>
          Print QR codes
        </button>
      </header>
      <div className="markers__grid">
        {STATIONS.map((s, i) => (
          <article key={s.id} className="marker">
            <p className="marker__brand">INNEV8 QR Code Hunt</p>
            {/* SVG markup generated locally by the qrcode library from our own constants. */}
            <div className="marker__qr" dangerouslySetInnerHTML={{ __html: svgs[i] ?? "" }} />
            <p className="marker__title">
              #{pad2(s.num)} {s.name} · {RARITY_LABEL[s.rarity]}
            </p>
            <p className="marker__where">
              {zoneName(s.zone)} · {s.spot}
            </p>
            <p className="marker__code">{s.code}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
