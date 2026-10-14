"use client";

import type { CSSProperties } from "react";
import { STATIONS, ZONES } from "@/lib/hunt";
import { VENUE } from "@/lib/venue";
import { CheckIcon, FitIcon, MinusIcon, PlusIcon } from "./icons";
import { cameraTransform, MAX_ZOOM, MIN_ZOOM, useMapCamera } from "./useMapCamera";

/** The part of the 360×520 plan shown on the plane: framed on the two buildings (same aspect ratio). */
const VIEW = { x: 30, y: 26, w: 300, h: 433 };

/**
 * The floor drawing extends this far past the view on each side (as a fraction of the view), so the
 * grounds run on and fade out (CSS mask) instead of stopping at a hard edge.
 */
const BLEED = { x: 0.5, y: 0.4 };
const FLOOR_BOX = `${VIEW.x - VIEW.w * BLEED.x} ${VIEW.y - VIEW.h * BLEED.y} ${VIEW.w * (1 + 2 * BLEED.x)} ${VIEW.h * (1 + 2 * BLEED.y)}`;
const FLOOR_STYLE: CSSProperties = {
  left: `${-BLEED.x * 100}%`,
  top: `${-BLEED.y * 100}%`,
  width: `${(1 + 2 * BLEED.x) * 100}%`,
  height: `${(1 + 2 * BLEED.y) * 100}%`,
};

/** Position of an upright element on the floor plane, as percentages of the view. */
const at = (x: number, y: number, i = 0) =>
  ({
    "--x": `${((x - VIEW.x) / VIEW.w) * 100}%`,
    "--y": `${((y - VIEW.y) / VIEW.h) * 100}%`,
    "--i": i,
  }) as CSSProperties;

const WALLS = VENUE.convention + VENUE.annex;

/** Interior partitions. Illustrative: the real buildings' outlines come from OSM, their insides don't. */
const PARTITIONS = [
  "M74 279V356M246.5 283V357", // Convention Complex: wings
  "M135.3 388H146M164 388H175", // Convention Complex: entrance doors
  "M54 120H267M54 136H267", // Annex A: corridor
  "M107 57.5V120M160 57.5V120M213 57.5V120", // Annex A: rooms
  "M160 136V160M160 182V207", // Annex A: halls
].join("");

/** Parking stalls in front of the entrance. */
const STALLS = Array.from({ length: 15 }, (_, i) => {
  const x = 72 + i * 11;
  return `M${x} 446V464M${x} 474V492`;
}).join("");

/** Context labels (not hunt zones). */
const LANDMARKS = [
  { name: "Parking", x: 112, y: 452, tone: "dim" },
  { name: "Entrance", x: 155, y: 428, tone: "gold" },
] as const;

/**
 * Leyte Academic Center as a glowing holographic site plan on a tilted grid (styled after the main
 * site's Eastern Visayas map). Zone names and QR spots stand upright on the plane; tap a spot to
 * select it. Pinch, wheel or the +/− buttons zoom (MIN_ZOOM–MAX_ZOOM); drag pans when zoomed in.
 */
export function VenueMap({
  found,
  focus,
  onFocus,
}: {
  found: Record<string, number>;
  focus: string | null;
  onFocus: (id: string) => void;
}) {
  const { boxRef, layerRef, cam, gesturing, zoomIn, zoomOut, reset } = useMapCamera();
  const zoomed = cam.z > 1.001;
  const moved = cam.z !== 1 || cam.x !== 0 || cam.y !== 0;

  return (
    <div
      ref={boxRef}
      className={`v3d${zoomed ? " is-zoomed" : ""}${gesturing ? " is-gesturing" : ""}`}
      role="group"
      aria-label="Map of Leyte Academic Center"
    >
      <div className="v3d__glow" aria-hidden="true"></div>
      <div ref={layerRef} className="v3d__cam" style={{ transform: cameraTransform(cam) }}>
        <div className="v3d__world">
          <div className="v3d__plane">
            <div className="v3d__grid" aria-hidden="true"></div>
            <div className="v3d__sweep" aria-hidden="true"></div>

            <svg className="v3d__floor" viewBox={FLOOR_BOX} style={FLOOR_STYLE} aria-hidden="true">
              <g className="v3d__grounds">
                <path className="v3d__road" d={VENUE.roads} />
                <path className="v3d__road-line" d={VENUE.roads} />
                <path className="v3d__lot" d={VENUE.parking} />
                <path className="v3d__stalls" d={STALLS} />
                <path className="v3d__other" d={VENUE.academic} />
              </g>
              <g className="v3d__walkways">
                <path d="M54 228H316M155 410V438" />
              </g>
              <path className="v3d__slab" d={WALLS} />
              <g className="v3d__details">
                {/* Convention Complex: stage, arena floor, seating */}
                <rect className="v3d__gold" x="118" y="257" width="84" height="14" rx="3" />
                <rect x="112" y="296" width="96" height="64" rx="3" />
                <path d="M160 296V360" />
                <circle cx="160" cy="328" r="11" />
                <path className="v3d__seats" d="M92 300V356M100 300V356M220 300V356M228 300V356" />
                <path className="v3d__gold" d="M149 406l6-6 6 6M149 399l6-6 6 6" />
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
              {STATIONS.map((s) => (
                <g
                  key={s.id}
                  className={`v3d__spot v3d__spot--${s.rarity}${found[s.id] ? " is-found" : ""}${
                    focus === s.id ? " is-focus" : ""
                  }`}
                >
                  {!found[s.id] && <circle className="v3d__ring" cx={s.x} cy={s.y} r="12" />}
                  <circle className="v3d__core" cx={s.x} cy={s.y} r="4.5" />
                </g>
              ))}
            </svg>

            {ZONES.map((z, i) => (
              <span key={z.id} className="v3d__up v3d__tag" style={at(z.label.x, z.label.y, i)} aria-hidden="true">
                <i>{z.name}</i>
              </span>
            ))}
            {LANDMARKS.map((l, i) => (
              <span
                key={l.name}
                className={`v3d__up v3d__tag v3d__tag--${l.tone}`}
                style={at(l.x, l.y, ZONES.length + i)}
                aria-hidden="true"
              >
                <i>{l.name}</i>
              </span>
            ))}

            {STATIONS.map((s, i) => {
              const got = Boolean(found[s.id]);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`v3d__up beacon beacon--${s.rarity}${got ? " is-found" : ""}${
                    focus === s.id ? " is-focus" : ""
                  }`}
                  style={at(s.x, s.y, i)}
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
        <button type="button" className="icon-btn" onClick={zoomIn} disabled={cam.z >= MAX_ZOOM} aria-label="Zoom in">
          <PlusIcon />
        </button>
        <button type="button" className="icon-btn" onClick={zoomOut} disabled={cam.z <= MIN_ZOOM} aria-label="Zoom out">
          <MinusIcon />
        </button>
        {moved && (
          <button type="button" className="icon-btn" onClick={reset} aria-label="Reset map view">
            <FitIcon />
          </button>
        )}
      </div>
      <span className="v3d__credit">© OpenStreetMap contributors</span>
    </div>
  );
}
