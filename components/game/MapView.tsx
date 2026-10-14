"use client";

import { pad2 } from "@/lib/dom";
import { RARITY_LABEL, STATIONS, zoneName, type Station } from "@/lib/hunt";
import { CheckIcon, CloseIcon, ScanIcon } from "./icons";
import { QrTile } from "./QrTile";
import { VenueMap } from "./VenueMap";

/** Home screen: the 3D venue map with a beacon for every QR code, and the selected spot. */
export function MapView({
  found,
  focus,
  onFocus,
  onScan,
}: {
  found: Record<string, number>;
  focus: string | null;
  onFocus: (id: string | null) => void;
  /** Open the scanner looking for this code. */
  onScan: (station: Station) => void;
}) {
  const sel = STATIONS.find((s) => s.id === focus);

  return (
    <div className="mapview">
      <VenueMap found={found} focus={focus} onFocus={onFocus} />

      {sel && (
        <div className="card station" role="region" aria-label="Selected QR code">
          <button type="button" className="icon-btn station__close" onClick={() => onFocus(null)} aria-label="Close">
            <CloseIcon />
          </button>
          <div className="station__art">
            <QrTile station={sel} state={found[sel.id] ? "found" : "locked"} size="md" />
          </div>
          <div className="station__info">
            <p className="label">
              #{pad2(sel.num)} · <span className={`rarity rarity--${sel.rarity}`}>{RARITY_LABEL[sel.rarity]}</span>
            </p>
            <h2>{found[sel.id] ? sel.name : `QR code #${sel.num}`}</h2>
            <p className="station__zone">
              {zoneName(sel.zone)}
              {found[sel.id] && <> · {sel.spot}</>}
            </p>
            {found[sel.id] ? (
              <p className="station__status">
                <CheckIcon /> Found
              </p>
            ) : (
              <>
                <p className="station__clue">“{sel.clue}”</p>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => onScan(sel)}>
                  <ScanIcon />
                  Find it
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
