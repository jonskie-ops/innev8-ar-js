"use client";

import { useEffect, useState } from "react";
import { pad2 } from "@/lib/dom";
import { howFar, LAC_PLACE, metresBetween, planOf, type Place } from "@/lib/geo";
import { RARITY_LABEL, TASK_TEXT, unlocked, zoneName, type Station } from "@/lib/hunt";
import { useHunt } from "@/lib/huntStore";
import { locationAllowed, useLocation } from "@/lib/location";
import { useProgress } from "@/lib/store";
import { CheckIcon, CloseIcon, LocateIcon, LockIcon, PinIcon, ScanIcon } from "./icons";
import { NoCodes } from "./NoCodes";
import { QrTile } from "./QrTile";
import { VenueMap } from "./VenueMap";

/** Farther than this from the venue (m), the map says how far instead of showing the dot off its edge. */
const OFF_MAP = 400;
/** The accuracy ring is drawn no bigger than this (m), so a rough fix doesn't cover the map. */
const RING_MAX = 60;

/**
 * The locations to show: those that are on and have codes (Leyte Academic Center alone before the
 * admin's locations update).
 */
function placesOf(places: Place[] | null, stations: Station[]) {
  const withCodes = (places ?? [LAC_PLACE]).filter((p) => stations.some((s) => s.location === p.id));
  return withCodes.length ? withCodes : (places?.slice(0, 1) ?? [LAC_PLACE]);
}

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

  // Which location's map: the picked code's, else the one picked above the map, else the nearest
  // to the player, else the first
  const places = placesOf(hunt.places, hunt.stations);
  const [chosen, setChosen] = useState<string | null>(null);
  const nearest = fix ? [...places].sort((a, b) => metresBetween(fix, a) - metresBetween(fix, b))[0]?.id : null;
  const place = places.find((p) => p.id === (sel?.location ?? chosen ?? nearest)) ?? places[0];
  // Every location off in the admin: no map to show
  if (!place)
    return (
      <div className="mapview">
        <NoCodes />
      </div>
    );
  const plan = planOf(place);
  const here = hunt.stations.filter((s) => s.location === place.id);

  const at = fix ? plan.toPlan(fix.lat, fix.lng) : null;
  const fromVenue = fix && here[0] ? Math.min(...here.map((s) => metresBetween(fix, s))) : 0;
  const onMap = at && fromVenue < OFF_MAP + (plan.hand ? 0 : place.width / 2);
  const away = fix && sel ? metresBetween(fix, sel) : null;

  return (
    <div className="mapview">
      <VenueMap
        key={place.id}
        place={place}
        found={found}
        focus={focus}
        onFocus={onFocus}
        me={onMap && at ? { ...at, r: Math.min(fix!.accuracy, RING_MAX) * plan.perM } : null}
        locating={locating}
        onLocate={random ? undefined : () => setLocating(!locating)}
      />

      {!hunt.stations.length && <NoCodes />}

      {places.length > 1 && (
        <div className="mapview__places" role="group" aria-label="Locations">
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === place.id}
              onClick={() => {
                setChosen(p.id);
                if (sel && sel.location !== p.id) onFocus(null);
              }}
            >
              <PinIcon />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {locating && !random && (!fix || !onMap) && (
        <p className={places.length > 1 ? "mapview__where is-low" : "mapview__where"} role="status">
          <LocateIcon />
          {fix
            ? `You're ${howFar(fromVenue)} from ${places.length > 1 ? `${place.name}'s` : "the"} QR codes`
            : loc.status === "denied"
              ? "Location is blocked for this site"
              : loc.status === "insecure"
                ? "Location needs the game's https address"
                : loc.status === "unavailable"
                  ? "No GPS signal yet"
                  : loc.status === "lost"
                    ? "Your location turned off: turn it back on"
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
