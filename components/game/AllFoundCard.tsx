"use client";

import { standing } from "@/lib/hunt";
import { useHunt } from "@/lib/huntStore";
import { CheckIcon } from "./icons";

/** In the scanner when every QR code is already found: nothing left to look for, and the way to the prizes. */
export function AllFoundCard({
  found,
  onDex,
  onClose,
}: {
  found: Record<string, number>;
  /** Their collection (and prizes, with their prize cards) */
  onDex: () => void;
  /** Close the scanner */
  onClose: () => void;
}) {
  const { hunt, known } = useHunt();
  const { count, score } = standing(hunt, known, found);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="allfound-title">
      <div className="catch catch--legendary">
        <p className="catch__eyebrow">Hunt complete!</p>
        <div className="catch__art allfound__art">
          <CheckIcon />
        </div>
        <h2 id="allfound-title">You found all {count} QR codes!</h2>
        <p className="catch__blurb">
          {hunt.prizes.length
            ? "There's nothing left to scan. Open your collection for your prize cards, and show one at the prize desk."
            : "There's nothing left to scan. Every INNEV8 QR code is yours: amazing hunting!"}
        </p>
        <div className="catch__stats">
          <span>
            <b>{score}</b> pts
          </span>
          <span>
            <b>{count}</b>/{count} QR codes
          </span>
        </div>
        <div className="catch__btns">
          <button type="button" className="btn btn--primary" onClick={onDex} autoFocus>
            {hunt.prizes.length ? "See my prizes" : "View collection"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close scanner
          </button>
        </div>
      </div>
    </div>
  );
}
