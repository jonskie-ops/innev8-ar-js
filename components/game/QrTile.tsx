/* eslint-disable @next/next/no-img-element -- a small, fixed-size badge that's kept on the phone */
import type { CSSProperties } from "react";
import type { Station } from "@/lib/hunt";
import { useHunt } from "@/lib/huntStore";
import { sponsorIn } from "@/lib/sponsors";
import { CheckIcon } from "./icons";
import { QrGlyph } from "./QrGlyph";

/**
 * A floating QR-code tile for one station, in its rarity colour, with its sponsor's logo in a circle
 * on the top-right corner.
 * - `locked`: not found yet, a dim ghost of the code with a "?"
 * - `reveal`: just detected by the scanner, bright with a scan line
 * - `found`: collected, bright with a scan line and a check badge
 */
export function QrTile({
  station,
  state,
  size = "md",
  i = 0,
}: {
  station: Station;
  state: "locked" | "reveal" | "found";
  size?: "sm" | "md" | "lg";
  /** Staggers the float so a grid of tiles doesn't bob in unison. */
  i?: number;
}) {
  const sponsor = sponsorIn(useHunt().hunt.sponsors, station.sponsor);
  return (
    <span
      className={`qrt qrt--${station.rarity} qrt--${size} is-${state}${sponsor ? " has-sponsor" : ""}`}
      style={{ "--i": i } as CSSProperties}
      aria-hidden="true"
    >
      <span className="qrt__card">
        <QrGlyph seed={station.id} className="qrt__code" />
        {state !== "locked" && <span className="qrt__beam"></span>}
        {state === "locked" && <span className="qrt__lock">?</span>}
      </span>
      {sponsor && <img className="qrt__sponsor" src={sponsor.badge} alt="" title={`Sponsored by ${sponsor.name}`} />}
      {state === "found" && (
        <span className="qrt__badge">
          <CheckIcon />
        </span>
      )}
    </span>
  );
}
