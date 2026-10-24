"use client";

import { useId, type CSSProperties } from "react";
import { planOf, type Place } from "@/lib/geo";
import { useHunt } from "@/lib/huntStore";
import { VENUE } from "@/lib/venue";
import { CheckIcon, FitIcon, LocateIcon, MinusIcon, PlusIcon } from "./icons";
import { cameraTransform, MAX_ZOOM, useMapCamera, type Home } from "./useMapCamera";

type View = { x: number; y: number; w: number; h: number };
/** The part of the 360×520 plan shown on the plane: framed on the two buildings (same aspect ratio). */
const LAC_VIEW: View = { x: 30, y: 26, w: 300, h: 433 };
/** Any other location: its middle (180, 260) in the middle */
const PLACE_VIEW: View = { x: 30, y: 43.5, w: 300, h: 433 };

/**
 * The floor drawing extends this far past the view on each side (as a fraction of the view), so the
 * grounds run on and fade out (CSS mask) instead of stopping at a hard edge.
 */
const BLEED = { x: 0.5, y: 0.4 };
const floorBox = (VIEW: View) =>
  `${VIEW.x - VIEW.w * BLEED.x} ${VIEW.y - VIEW.h * BLEED.y} ${VIEW.w * (1 + 2 * BLEED.x)} ${VIEW.h * (1 + 2 * BLEED.y)}`;
const FLOOR_STYLE: CSSProperties = {
  left: `${-BLEED.x * 100}%`,
  top: `${-BLEED.y * 100}%`,
  width: `${(1 + 2 * BLEED.x) * 100}%`,
  height: `${(1 + 2 * BLEED.y) * 100}%`,
};

/** Position of an upright element on the floor plane, as percentages of the view. */
const at = (VIEW: View, x: number, y: number, i = 0) =>
  ({
    "--x": `${((x - VIEW.x) / VIEW.w) * 100}%`,
    "--y": `${((y - VIEW.y) / VIEW.h) * 100}%`,
    "--i": i,
  }) as CSSProperties;

/**
 * The map opens zoomed in and centred on the Annex A–B building and its codes (as wide as a phone allows), and doesn't zoom
 * out any further than that.
 */
const LAC_HOME: Home = {
  z: 1.1,
  x: (161 - (LAC_VIEW.x + LAC_VIEW.w / 2)) / LAC_VIEW.w,
  y: (137 - (LAC_VIEW.y + LAC_VIEW.h / 2)) / LAC_VIEW.h, // the building with its pins, balanced top and bottom
};
/** Any other location opens on its middle */
const PLACE_HOME: Home = { z: 1.1, x: 0, y: 0 };


const WALLS = VENUE.annex;

/** Interior partitions. Illustrative: the real buildings' outlines come from OSM, their insides don't. */
const PARTITIONS = [
  "M54 120H267M54 136H267", // Annex A: corridor
  "M107 57.5V120M160 57.5V120M213 57.5V120", // Annex A: rooms
  "M160 136V160M160 182V207", // Annex A: halls
].join("");

/** Parking stalls. */
const STALLS = Array.from({ length: 15 }, (_, i) => {
  const x = 72 + i * 11;
  return `M${x} 446V464M${x} 474V492`;
}).join("");

/** Context labels (not hunt zones). */
const LANDMARKS = [{ name: "Parking", x: 112, y: 452, tone: "dim" }] as const;

/**
 * A location as a glowing holographic site plan: Leyte Academic Center drawn by hand, any other from
 * OpenStreetMap's buildings, roads and grounds (`place.outlines`, drawn by the admin), seen straight from above (styled after
 * the main site's Eastern Visayas map). Zone names and QR spots stand on it like map pins; tap a spot
 * to select it (its dashed ring: how close you must be for it to show in the scanner). Pinch, wheel or
 * the +/− buttons zoom (HOME.z–MAX_ZOOM); drag pans. `me`: the player, as a dot with a ring for how
 * sure the GPS is (plan units); the locate button turns that on and off.
 */
/** The facing cone: how far it reaches (map units) and half its width (degrees). */
const CONE = { length: 46, half: 28 };

/** A wedge from (x, y) toward `dir` degrees (0 = right, 90 = down: the map's own angles). */
function conePath(x: number, y: number, dir: number) {
  const r = Math.PI / 180;
  const a = (dir - CONE.half) * r;
  const b = (dir + CONE.half) * r;
  const L = CONE.length;
  const f = (n: number) => n.toFixed(2);
  return `M${f(x)} ${f(y)}L${f(x + L * Math.cos(a))} ${f(y + L * Math.sin(a))}A${L} ${L} 0 0 1 ${f(x + L * Math.cos(b))} ${f(y + L * Math.sin(b))}Z`;
}

export function VenueMap({
  place,
  found,
  focus,
  onFocus,
  me = null,
  locating = false,
  onLocate,
}: {
  /** The location shown, with its codes (key the map by it: a new one opens at its home view) */
  place: Place;
  found: Record<string, number>;
  focus: string | null;
  onFocus: (id: string) => void;
  /** The player: where, how sure (r), and which way they face on the map (dir, degrees; null: not known) */
  me?: { x: number; y: number; r: number; dir?: number | null } | null;
  locating?: boolean;
  onLocate?: () => void;
}) {
  const plan = planOf(place);
  const VIEW = plan.hand ? LAC_VIEW : PLACE_VIEW;
  const HOME = plan.hand ? LAC_HOME : PLACE_HOME;
  const { boxRef, layerRef, mapRef, cam, atHome, gesturing, zoomIn, zoomOut, reset } = useMapCamera(HOME);
  const zoomed = cam.z > 1.001;
  // This location's codes that are on, and the zones with a name tag (the Courtyard keeps its codes,
  // not a tag; only Leyte Academic Center's plan has tags)
  const { hunt } = useHunt();
  const stations = hunt.stations.filter((s) => s.location === place.id);
  const tags = plan.hand ? hunt.zones.filter((z) => z.label) : [];
  const landmarks = plan.hand ? LANDMARKS : [];
  const osm = plan.hand ? null : place.outlines;
  const coneId = `cone${useId().replace(/[^\w-]/g, "")}`; // (a plain id: it goes in url(#…))

  return (
    <div
      ref={boxRef}
      className={`v3d${zoomed ? " is-zoomed" : ""}${gesturing ? " is-gesturing" : ""}`}
      role="group"
      aria-label={`Map of ${place.name}`}
    >
      <div className="v3d__glow" aria-hidden="true"></div>
      <div ref={layerRef} className="v3d__cam" style={{ transform: cameraTransform(cam) }}>
        <div ref={mapRef} className="v3d__world">
          <div className="v3d__plane">
            <div className="v3d__grid" aria-hidden="true"></div>
            <div className="v3d__sweep" aria-hidden="true"></div>

            <svg className="v3d__floor" viewBox={floorBox(VIEW)} style={FLOOR_STYLE} aria-hidden="true">
              {osm && (
                <>
                  <g className="v3d__grounds">
                    <path className="v3d__lot" d={osm.grounds} />
                    <path className="v3d__road v3d__road--osm" d={osm.roads} />
                    <path className="v3d__road-line v3d__road--osm" d={osm.roads} />
                  </g>
                  <path className="v3d__slab" d={osm.buildings} />
                  <path className="v3d__wall-glow v3d__wall--osm" d={osm.buildings} pathLength="1" />
                  <path className="v3d__wall v3d__wall--osm" d={osm.buildings} pathLength="1" />
                </>
              )}
              {plan.hand && (
              <>
              <g className="v3d__grounds">
                <path className="v3d__road" d={VENUE.roads} />
                <path className="v3d__road-line" d={VENUE.roads} />
                <path className="v3d__lot" d={VENUE.parking} />
                <path className="v3d__stalls" d={STALLS} />
                <path className="v3d__other" d={VENUE.academic} />
              </g>
              <g className="v3d__walkways">
                <path d="M54 228H316" />
              </g>
              <path className="v3d__slab" d={WALLS} />
              <g className="v3d__details">
                {/* Annex A: exhibit booths */}
                <rect x="66" y="148" width="22" height="12" rx="2" />
                <rect x="118" y="150" width="22" height="12" rx="2" />
                <rect x="118" y="184" width="22" height="12" rx="2" />
                <rect x="180" y="148" width="22" height="12" rx="2" />
                <rect x="238" y="150" width="20" height="12" rx="2" />
                <rect x="238" y="184" width="20" height="12" rx="2" />
              </g>
              <path className="v3d__wall-glow" d={WALLS} pathLength="1" />
              <path className="v3d__wall" d={WALLS} pathLength="1" />
              <path className="v3d__room" d={PARTITIONS} pathLength="1" />
              </>
              )}
              {stations.map((s) => (
                <g
                  key={s.id}
                  className={`v3d__spot v3d__spot--${s.rarity}${found[s.id] ? " is-found" : ""}${
                    focus === s.id ? " is-focus" : ""
                  }`}
                >
                  {focus === s.id && !found[s.id] && (
                    <circle className="v3d__range" cx={s.x} cy={s.y} r={s.radius * plan.perM} />
                  )}
                  {!found[s.id] && <circle className="v3d__ring" cx={s.x} cy={s.y} r="12" />}
                  <circle className="v3d__core" cx={s.x} cy={s.y} r="4.5" />
                </g>
              ))}
              {me && (
                <g className="v3d__me">
                  <circle className="v3d__me-acc" cx={me.x} cy={me.y} r={me.r} />
                  {/* Which way they're facing: a beam from the dot, fading out */}
                  {me.dir != null && (
                    <>
                      <defs>
                        <radialGradient id={coneId} gradientUnits="userSpaceOnUse" cx={me.x} cy={me.y} r={CONE.length}>
                          <stop offset="0" stopColor="#9cc8ff" stopOpacity="0.95" />
                          <stop offset="0.55" stopColor="#4f9dff" stopOpacity="0.45" />
                          <stop offset="1" stopColor="#4f9dff" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <path className="v3d__me-cone" d={conePath(me.x, me.y, me.dir)} fill={`url(#${coneId})`} />
                    </>
                  )}
                  <circle className="v3d__me-pulse" cx={me.x} cy={me.y} r="7" />
                  <circle className="v3d__me-dot" cx={me.x} cy={me.y} r="4.4" />
                </g>
              )}
            </svg>

            {tags.map((z, i) => (
              <span key={z.id} className="v3d__up v3d__tag" style={at(VIEW, z.label!.x, z.label!.y, i)} aria-hidden="true">
                <i>{z.name}</i>
              </span>
            ))}
            {landmarks.map((l, i) => (
              <span
                key={l.name}
                className={`v3d__up v3d__tag v3d__tag--${l.tone}`}
                style={at(VIEW, l.x, l.y, tags.length + i)}
                aria-hidden="true"
              >
                <i>{l.name}</i>
              </span>
            ))}

            {stations.map((s, i) => {
              const got = Boolean(found[s.id]);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`v3d__up beacon beacon--${s.rarity}${got ? " is-found" : ""}${
                    focus === s.id ? " is-focus" : ""
                  }`}
                  style={at(VIEW, s.x, s.y, i)}
                  onClick={() => onFocus(s.id)}
                  aria-label={got ? `QR code #${s.num}, ${s.name}, found` : `QR code #${s.num}, not found yet`}
                  aria-pressed={focus === s.id}
                >
                  <span className="beacon__head">{got ? <CheckIcon /> : s.num}</span>
                  <span className="beacon__stalk"></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="v3d__vignette" aria-hidden="true"></div>
      <div className="v3d__zoom">
        {onLocate && (
          <button
            type="button"
            className={locating ? "icon-btn v3d__locate is-on" : "icon-btn v3d__locate"}
            onClick={onLocate}
            aria-pressed={locating}
            aria-label={locating ? "Hide where I am" : "Show where I am"}
          >
            <LocateIcon />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={zoomIn} disabled={cam.z >= MAX_ZOOM} aria-label="Zoom in">
          <PlusIcon />
        </button>
        <button type="button" className="icon-btn" onClick={zoomOut} disabled={cam.z <= HOME.z} aria-label="Zoom out">
          <MinusIcon />
        </button>
        {!atHome && (
          <button type="button" className="icon-btn" onClick={reset} aria-label="Reset map view">
            <FitIcon />
          </button>
        )}
      </div>
      <span className="v3d__credit">© OpenStreetMap contributors</span>
    </div>
  );
}
