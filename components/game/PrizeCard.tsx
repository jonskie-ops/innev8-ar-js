"use client";
/* eslint-disable @next/next/no-img-element -- the prize's photo, from the organisers' storage */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Prize } from "@/lib/hunt";
import { claimText, loadPrizes, prizeQrText, refusedFinds, type PrizeClaim } from "@/lib/hunter";
import type { Progress } from "@/lib/store";
import { qrPath } from "./HunterQr";
import { CheckIcon, GiftIcon } from "./icons";

const when = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * A prize the player has won: show this screen at the prize desk. Its claim code (a QR, and the same
 * as text) comes from the database, which checked their finds: the desk gives the prize once, and the
 * card says so after.
 */
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
  // undefined: asking; null: no signal
  const [claim, setClaim] = useState<PrizeClaim | null | undefined>(undefined);
  // This prize's claim, from the database (not in its answer: not won)
  const fetchClaim = useCallback(
    async () =>
      loadPrizes(progress.name, progress.province).then((all) =>
        all ? (all.find((c) => c.id === prize.id) ?? { id: prize.id, won: false, code: null, claimed: null, left: 0 }) : null,
      ),
    [progress.name, progress.province, prize.id],
  );
  const ask = () => {
    setClaim(undefined);
    void fetchClaim().then(setClaim);
  };
  useEffect(() => {
    let alive = true;
    void fetchClaim().then((c) => alive && setClaim(c));
    return () => {
      alive = false;
    };
  }, [fetchClaim]);
  const qr = useMemo(() => (claim?.code && !claim.claimed ? qrPath(prizeQrText(claim.code)) : null), [claim]);
  const refused = claim && !claim.code ? refusedFinds().length : 0;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="prize-title">
      <div className="catch catch--legendary prize">
        <p className="catch__eyebrow">{claim?.claimed ? "Your prize" : "You won a prize"}</p>
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

        <div className="prize__claim" aria-live="polite">
          {claim === undefined ? (
            <p className="prize__wait">
              <span className="spin" aria-hidden="true" />
              Getting your prize code…
            </p>
          ) : claim === null ? (
            <p className="catch__blurb">Your prize code needs a signal. Connect to the internet, then try again.</p>
          ) : claim.claimed ? (
            <p className="prize__given">
              <CheckIcon />
              <span>
                <b>Claimed</b> at the {claimPlace}, {when.format(new Date(claim.claimed))}. Enjoy it, {progress.name}!
              </span>
            </p>
          ) : claim.code && qr ? (
            <>
              <p className="catch__blurb">
                Congratulations, {progress.name}! Show this at the <b>{claimPlace}</b> to claim it. It can be claimed once.
              </p>
              <div className="prize__qr">
                <svg viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label="Your prize QR">
                  <rect width={qr.size} height={qr.size} fill="#fff" />
                  <path d={qr.d} fill="#030817" />
                </svg>
              </div>
              <p className="prize__code">{claimText(claim.code)}</p>
              {claim.left <= 0 && <p className="prize__note">None left at the moment: ask at the {claimPlace}.</p>}
            </>
          ) : (
            <p className="catch__blurb">
              {refused
                ? `${refused} of your finds didn't count: your phone wasn't near the QR code when you collected it. Ask at the ${claimPlace}.`
                : "We couldn't confirm all your finds yet. Check your signal and try again."}
            </p>
          )}
        </div>

        <div className="catch__btns">
          {(claim === null || (claim && !claim.code && !claim.claimed)) && (
            <button type="button" className="btn btn--ghost" onClick={ask}>
              Try again
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
