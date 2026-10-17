"use client";
/* eslint-disable @next/next/no-img-element -- the prize's photo, from the organisers' storage */

import type { Prize } from "@/lib/hunt";
import type { Progress } from "@/lib/store";
import { GiftIcon } from "./icons";

/**
 * Short code staff can note down at the prize desk. Derived from the player's name, the prize and
 * their catch times, so it's stable per device. NOT tamper-proof: real verification needs a server.
 */
function claimCode(p: Progress, prize: Prize) {
  const src = p.name + prize.id + Object.keys(p.found).sort().map((id) => p.found[id]).join(".");
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  const code = (h >>> 0).toString(36).toUpperCase().padStart(7, "0");
  return `I8-${code.slice(0, 4)}-${code.slice(4)}`;
}

/** A prize the player has won: show this screen at the prize desk. */
export function PrizeCard({
  prize,
  progress,
  claimPlace,
  onClose,
}: {
  prize: Prize;
  progress: Progress;
  claimPlace: string;
  onClose: () => void;
}) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="prize-title">
      <div className="catch catch--legendary prize">
        <p className="catch__eyebrow">You won a prize</p>
        <div className="prize__photo">
          {prize.photo ? (
            <img src={prize.photo} alt="" width={480} height={300} decoding="async" />
          ) : (
            <span className="prize__photo-ph" aria-hidden="true">
              <GiftIcon />
            </span>
          )}
        </div>
        <h2 id="prize-title">{prize.name}</h2>
        {prize.description && <p className="catch__blurb">{prize.description}</p>}
        <p className="catch__blurb">
          Congratulations, {progress.name}! Show this screen at the <b>{claimPlace}</b> to claim it.
        </p>
        <p className="prize__code">{claimCode(progress, prize)}</p>
        <div className="catch__btns">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
