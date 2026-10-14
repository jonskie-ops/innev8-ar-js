"use client";

import { STATIONS, TOTAL } from "@/lib/hunt";
import type { Progress } from "@/lib/store";
import { QrTile } from "./QrTile";

/**
 * Short code staff can note down at the help desk. Derived from the player's name and catch
 * times, so it's stable per device. NOT tamper-proof: real verification needs a server.
 */
function claimCode(p: Progress) {
  const src = p.name + STATIONS.map((s) => p.found[s.id] ?? 0).join(".");
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  const code = (h >>> 0).toString(36).toUpperCase().padStart(7, "0");
  return `I8-${code.slice(0, 4)}-${code.slice(4)}`;
}

export function PrizeCard({ progress, points, onClose }: { progress: Progress; points: number; onClose: () => void }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="prize-title">
      <div className="catch catch--legendary prize">
        <p className="catch__eyebrow">Hunt complete</p>
        <div className="prize__codes" aria-hidden="true">
          {STATIONS.map((s, i) => (
            <QrTile key={s.id} station={s} state="found" size="sm" i={i} />
          ))}
        </div>
        <h2 id="prize-title">Congratulations, {progress.name}!</h2>
        <p className="catch__blurb">
          You collected all {TOTAL} QR codes for {points} points. Show this screen at the INNEV8 help desk to claim your
          prize.
        </p>
        <p className="prize__code">{claimCode(progress)}</p>
        <div className="catch__btns">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
