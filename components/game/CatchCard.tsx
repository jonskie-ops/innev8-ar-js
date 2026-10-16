"use client";

import { pad2 } from "@/lib/dom";
import { POINTS, RARITY_LABEL, TOTAL, zoneName, type Station } from "@/lib/hunt";
import { QrTile } from "./QrTile";

/** Shown right after a QR code is collected. */
export function CatchCard({
  station,
  count,
  onHunt,
  onDex,
  onPrize,
}: {
  station: Station;
  count: number;
  /** Keep hunting: back to scanning. */
  onHunt: () => void;
  onDex: () => void;
  onPrize: () => void;
}) {
  const complete = count >= TOTAL;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="catch-title">
      <div className={`catch catch--${station.rarity}`}>
        <p className="catch__eyebrow">QR code collected!</p>
        <div className="catch__art">
          <QrTile station={station} state="found" size="lg" />
        </div>
        <p className="label">
          #{pad2(station.num)} ·{" "}
          <span className={`rarity rarity--${station.rarity}`}>{RARITY_LABEL[station.rarity]}</span>
        </p>
        <h2 id="catch-title">{station.name}</h2>
        <p className="catch__spot">
          {zoneName(station.zone)} · {station.spot}
        </p>
        <p className="catch__blurb">{station.blurb}</p>
        <div className="catch__stats">
          <span>
            <b>+{POINTS[station.rarity]}</b> pts
          </span>
          <span>
            <b>{count}</b>/{TOTAL} QR codes
          </span>
        </div>
        <div className="catch__btns">
          {complete ? (
            <button type="button" className="btn btn--primary" onClick={onPrize}>
              Claim your prize
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={onHunt}>
              Keep hunting
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onDex}>
            View collection
          </button>
        </div>
      </div>
    </div>
  );
}
