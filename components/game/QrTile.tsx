import type { CSSProperties } from "react";
import type { Station } from "@/lib/hunt";
import { CheckIcon } from "./icons";
import { QrGlyph } from "./QrGlyph";

/**
 * A floating QR-code tile for one station, in its rarity colour.
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
  return (
    <span
      className={`qrt qrt--${station.rarity} qrt--${size} is-${state}`}
      style={{ "--i": i } as CSSProperties}
      aria-hidden="true"
    >
      <span className="qrt__card">
        <QrGlyph seed={station.id} className="qrt__code" />
        {state !== "locked" && <span className="qrt__beam"></span>}
        {state === "locked" && <span className="qrt__lock">?</span>}
      </span>
      {state === "found" && (
        <span className="qrt__badge">
          <CheckIcon />
        </span>
      )}
    </span>
  );
}
