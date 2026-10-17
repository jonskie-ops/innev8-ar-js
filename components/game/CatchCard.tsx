"use client";

import { pad2 } from "@/lib/dom";
import { RARITY_LABEL, zoneName, type Prize, type Station } from "@/lib/hunt";
import { useHunt } from "@/lib/huntStore";
import { QrTile } from "./QrTile";

/** Shown right after a QR code is collected (and, if that catch won a prize, the way to it). */
export function CatchCard({
  station,
  count,
  total,
  won,
  onHunt,
  onDex,
  onPrize,
}: {
  station: Station;
  count: number;
  total: number;
  /** A prize this catch won. */
  won: Prize | null;
  /** Keep hunting: back to scanning. */
  onHunt: () => void;
  onDex: () => void;
  onPrize: (prize: Prize) => void;
}) {
  const { hunt } = useHunt();
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
          {zoneName(hunt, station.zone)} · {station.spot}
        </p>
        <p className="catch__blurb">{station.blurb}</p>
        <div className="catch__stats">
          <span>
            <b>+{station.points}</b> pts
          </span>
          <span>
            <b>{count}</b>/{total} QR codes
          </span>
        </div>
        <div className="catch__btns">
          {won ? (
            <button type="button" className="btn btn--primary" onClick={() => onPrize(won)}>
              You won a prize!
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
