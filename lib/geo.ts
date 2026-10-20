/**
 * Places on the ground. The venue map's plan units (lib/venue.ts, 360×520, about 3.3 units to the
 * metre) to latitude and longitude and back: the plan was drawn from OpenStreetMap by turning the
 * grounds and scaling them around a point near Annex A, and this undoes that. The admin
 * (INNEV8-AR-ADMIN, lib/venue.ts) has the same numbers: keep the two the same.
 */

export type LatLng = { lat: number; lng: number };

const LAT0 = 11.17824;
const LON0 = 125.00224;
const EARTH = 6371000;
const TURN = (112 * Math.PI) / 180; // from north
const SQUARE = (4.6 * Math.PI) / 180; // the extra turn that squares the buildings up
const PER_M = 3.3;
const ORIGIN = { x: 92.888067, y: -121.087091 }; // metres, at plan (180, 260)

export function toLatLng(x: number, y: number): LatLng {
  const xa = (x - 180) / PER_M + ORIGIN.x;
  const ya = (y - 260) / PER_M + ORIGIN.y;
  const xr = xa * Math.cos(SQUARE) - ya * Math.sin(SQUARE);
  const yr = -(xa * Math.sin(SQUARE) + ya * Math.cos(SQUARE));
  const east = xr * Math.cos(TURN) + yr * Math.sin(TURN);
  const north = -xr * Math.sin(TURN) + yr * Math.cos(TURN);
  const lat = LAT0 + (north / EARTH) * (180 / Math.PI);
  const lng = LON0 + (east / (EARTH * Math.cos((LAT0 * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

/** Latitude and longitude to plan units (where the player's dot goes on the venue map). */
export function toPlan(lat: number, lng: number) {
  const east = ((lng - LON0) * Math.PI) / 180 * EARTH * Math.cos((LAT0 * Math.PI) / 180);
  const north = ((lat - LAT0) * Math.PI) / 180 * EARTH;
  const xr = east * Math.cos(TURN) - north * Math.sin(TURN);
  const yr = -(east * Math.sin(TURN) + north * Math.cos(TURN));
  const xa = xr * Math.cos(SQUARE) + yr * Math.sin(SQUARE);
  const ya = -xr * Math.sin(SQUARE) + yr * Math.cos(SQUARE);
  return { x: 180 + (xa - ORIGIN.x) * PER_M, y: 260 + (ya - ORIGIN.y) * PER_M };
}

/** Plan units per metre (the venue map's scale). */
export const PLAN_PER_M = PER_M;

const RAD = Math.PI / 180;

/** Metres east and north from `a` to `b` (flat-earth: exact enough across a venue, and for a few km). */
function offset(a: LatLng, b: LatLng) {
  return {
    east: (b.lng - a.lng) * RAD * EARTH * Math.cos(((a.lat + b.lat) / 2) * RAD),
    north: (b.lat - a.lat) * RAD * EARTH,
  };
}

/** Metres between two places. */
export function metresBetween(a: LatLng, b: LatLng) {
  const { east, north } = offset(a, b);
  return Math.hypot(east, north);
}

/** Which way `b` is from `a`: degrees clockwise from north (0 north, 90 east). */
export function bearing(a: LatLng, b: LatLng) {
  const { east, north } = offset(a, b);
  return ((Math.atan2(east, north) / RAD) % 360 + 360) % 360;
}

/** "8 m", "120 m", "2.4 km" (never split across lines) */
export const howFar = (m: number) =>
  m < 1000 ? `${Math.max(1, Math.round(m))} m` : `${(m / 1000).toFixed(1)} km`;
