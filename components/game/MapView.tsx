"use client";

import { useEffect, useState } from "react";
import { pad2 } from "@/lib/dom";
import { howFar, metresBetween, PLAN_PER_M, toPlan } from "@/lib/geo";
import { RARITY_LABEL, TASK_TEXT, unlocked, zoneName, type Station } from "@/lib/hunt";
import { useHunt } from "@/lib/huntStore";
import { locationAllowed, useLocation } from "@/lib/location";
import { useProgress } from "@/lib/store";
import { CheckIcon, CloseIcon, LocateIcon, LockIcon, ScanIcon } from "./icons";
import { QrTile } from "./QrTile";
import { VenueMap } from "./VenueMap";

/** Farther than this from the venue (m), the map says how far instead of showing the dot off its edge. */
const OFF_MAP = 400;
/** The accuracy ring is drawn no bigger than this (m), so a rough fix doesn't cover the map. */
const RING_MAX = 60;

/**
 * Home screen: the 3D venue map with a beacon for every QR code, and the selected spot. With the
 * location on (the button by the zoom, or by itself once the site is allowed it), the player shows
 * on the map and the selected code says how far it is: a code shows in the scanner once they're
 * within its distance of it.
 */
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
  const { hunt } = useHunt();
  const { tasks } = useProgress();
  const sel = hunt.stations.find((s) => s.id === focus);
  const random = hunt.settings.randomSpots; // codes appear around the player, wherever they are: no distances

  // Where the player is: on by itself if the site is allowed the location already (no surprise prompt)
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    let alive = true;
    void locationAllowed().then((ok) => alive && ok && setLocating(true));
    return () => {
      alive = false;
    };
  }, []);
  const loc = useLocation(locating && !random);
  const fix = locating && !random ? loc.fix : null;
  const at = fix ? toPlan(fix.lat, fix.lng) : null;
  const fromVenue = fix && hunt.stations[0] ? Math.min(...hunt.stations.map((s) => metresBetween(fix, s))) : 0;
  const onMap = at && fromVenue < OFF_MAP;
  const away = fix && sel ? metresBetween(fix, sel) : null;

  return (
    <div className="mapview">
      <VenueMap
        found={found}
        focus={focus}
        onFocus={onFocus}
        me={onMap && at ? { ...at, r: Math.min(fix!.accuracy, RING_MAX) * PLAN_PER_M } : null}
        locating={locating}
        onLocate={random ? undefined : () => setLocating(!locating)}
      />

      {locating && !random && (!fix || !onMap) && (
        <p className="mapview__where" role="status">
          <LocateIcon />
          {fix
            ? `You're ${howFar(fromVenue)} from the QR codes`
            : loc.status === "denied"
              ? "Location is blocked for this site"
              : loc.status === "insecure"
                ? "Location needs the game's https address"
                : loc.status === "unavailable"
                  ? "No GPS signal yet"
                  : "Finding you…"}
        </p>
      )}

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
              {zoneName(hunt, sel.zone)}
              {found[sel.id] && <> · {sel.spot}</>}
            </p>
            {found[sel.id] ? (
              <p className="station__status">
                <CheckIcon /> Found
              </p>
            ) : (
              <>
                <p className="station__clue">“{sel.clue}”</p>
                {away !== null && (
                  <p className={away <= sel.radius ? "station__far is-in" : "station__far"}>
                    <LocateIcon />
                    {away <= sel.radius
                      ? "You're here: tap Find it and look around"
                      : `${howFar(away)} away · shows within ${sel.radius} m`}
                  </p>
                )}
                {sel.task !== "none" && (
                  <p className={unlocked(sel, tasks) ? "taskline is-done" : "taskline"}>
                    {unlocked(sel, tasks) ? <CheckIcon /> : <LockIcon />}
                    {unlocked(sel, tasks) ? "Extra task done" : TASK_TEXT[sel.task]}
                  </p>
                )}
                <button type="button" className="btn btn--primary btn--sm" onClick={() => onScan(sel)}>
                  {unlocked(sel, tasks) ? <ScanIcon /> : <LockIcon />}
                  {unlocked(sel, tasks) ? "Find it" : "Do the task"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
