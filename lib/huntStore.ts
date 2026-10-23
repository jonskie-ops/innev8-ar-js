"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PLACE, toLatLng, type Place } from "./geo";
import { BUILT_IN, inOrder, RADIUS, RARITIES, TASKS, type Hunt, type Prize, type PrizeRule, type Station, type Task, type Zone } from "./hunt";
import { firstSponsor, type Sponsor } from "./sponsors";

/**
 * The hunt on this phone: the latest copy of what the organisers set (from /api/hunt), saved so the
 * game opens and plays offline. Checked when the game opens, when it comes back to the front, when
 * the signal returns, and every minute while it's open.
 *
 * `known`: every code this phone has ever seen, so a code turned off after a player found it stays
 * in their collection (lib/hunt.ts, standing()). `ready`: false only while a first-ever open waits
 * (a few seconds at most) for the organisers' copy, so it doesn't flash the built-in codes first.
 */
export type HuntState = { hunt: Hunt; known: Record<string, Station>; ready: boolean };

const KEY = "i8ar-hunt-v1";
const EVERY_MS = 60_000;
const AGAIN_MS = 15_000; // back to the front after at least this long: check again
const WAIT_MS = 3000;

const byId = (stations: Station[]) => Object.fromEntries(stations.map((s) => [s.id, s]));
const SERVER: HuntState = { hunt: BUILT_IN, known: byId(BUILT_IN.stations), ready: false };

let state: HuntState | null = null;
const listeners = new Set<() => void>();

function load(): HuntState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { hunt?: unknown; known?: unknown } | null;
    const hunt = parseHunt(saved?.hunt);
    if (hunt) {
      const known = Array.isArray(saved?.known) ? saved.known.map(parseStation).filter(isSome) : [];
      return { hunt, known: { ...byId(BUILT_IN.stations), ...byId(known), ...byId(hunt.stations) }, ready: true };
    }
  } catch {}
  return { ...SERVER };
}
const read = () => (state ??= load());

function set(next: HuntState) {
  state = next;
  listeners.forEach((l) => l());
}

let lastAsked = 0;
let asking: Promise<void> | null = null;
const AGAIN_STALE_MS = 4000;
/**
 * The server's copy is past its 30 seconds: it was handed out while a fresh one is fetched in the
 * background (Vercel says "STALE", or its age shows it), so the latest is a few seconds away.
 */
function wasStale(res: Response, at: unknown) {
  const cache = `${res.headers.get("x-vercel-cache") ?? ""} ${res.headers.get("x-nextjs-cache") ?? ""}`;
  const age = Number(res.headers.get("age"));
  const made = typeof at === "string" ? Date.parse(at) : NaN;
  return /STALE/i.test(cache) || age >= 30 || Date.now() - made > 45_000;
}

/**
 * Asks for the organisers' latest; keeps what it has if there's no answer. Handed an old copy, it
 * asks once more a few seconds later, so a change shows up right away instead of a check later.
 */
function refresh(again = false) {
  if (asking) return asking;
  lastAsked = Date.now();
  asking = (async () => {
    try {
      const res = await fetch("/api/hunt", { cache: "no-store" });
      const body = res.ok ? ((await res.json()) as { hunt?: unknown; at?: unknown }) : null;
      if (body && !again && wasStale(res, body.at)) setTimeout(() => void refresh(true), AGAIN_STALE_MS);
      const hunt = body ? parseHunt(body.hunt) : null;
      if (!hunt) return;
      const now = read();
      const known = { ...now.known, ...byId(hunt.stations) };
      // Saved only when something changed (the game re-draws only then, too)
      if (now.ready && JSON.stringify(now.hunt) === JSON.stringify(hunt)) return;
      try {
        localStorage.setItem(KEY, JSON.stringify({ hunt, known: Object.values(known) }));
      } catch {}
      set({ hunt, known, ready: true });
    } catch {
      // No signal: the saved copy (or the built-in codes) carry on
    } finally {
      asking = null;
      if (!read().ready) set({ ...read(), ready: true });
    }
  })();
  return asking;
}

let started = false;
function start() {
  if (started) return;
  started = true;
  void refresh();
  setTimeout(() => {
    if (!read().ready) set({ ...read(), ready: true });
  }, WAIT_MS);
  setInterval(() => {
    if (document.visibilityState === "visible") void refresh();
  }, EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastAsked > AGAIN_MS) void refresh();
  });
  addEventListener("online", () => void refresh());
  // Another tab got a newer copy
  addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = null;
    listeners.forEach((l) => l());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

/** The hunt as this phone knows it. */
export const useHunt = () => useSyncExternalStore(subscribe, read, () => SERVER);
/** The same, outside React (Qufoo's lines). */
export const getHunt = () => read();

// ---- Checking what comes in: anything malformed is left out (or the whole copy, without settings)

const isSome = <T,>(v: T | null): v is T => v !== null;
const str = (v: unknown): v is string => typeof v === "string";
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const RULES: PrizeRule[] = ["all", "count", "legendary", "points"];

function parseStation(v: unknown): Station | null {
  const s = v as Partial<Station> | null;
  if (!s || !str(s.id) || !str(s.code) || !num(s.num) || !str(s.name) || !str(s.zone) || !str(s.spot)) return null;
  if (!RARITIES.includes(s.rarity as Station["rarity"]) || !num(s.points) || !str(s.clue) || !str(s.blurb)) return null;
  if (!num(s.x) || !num(s.y)) return null;
  const task: Task = TASKS.includes(s.task as Task) ? (s.task as Task) : "none"; // copies saved before tasks: none
  const sponsor = str(s.sponsor) ? s.sponsor : firstSponsor(s.num); // and before sponsors: each code's first
  // and before GPS spots: where its map pin is, at the usual distance
  const spot = num(s.lat) && num(s.lng) ? { lat: s.lat, lng: s.lng } : toLatLng(s.x, s.y);
  const radius = num(s.radius) && s.radius > 0 ? s.radius : RADIUS;
  const location = str(s.location) ? s.location : DEFAULT_PLACE; // and before locations: Leyte Academic Center
  return { id: s.id, code: s.code, num: s.num, name: s.name, zone: s.zone, spot: s.spot, rarity: s.rarity!, points: s.points, task, sponsor, location, clue: s.clue, blurb: s.blurb, x: s.x, y: s.y, ...spot, radius };
}
function parseZone(v: unknown): Zone | null {
  const z = v as Partial<Zone> | null;
  if (!z || !str(z.id) || !str(z.name)) return null;
  const label = z.label && num(z.label.x) && num(z.label.y) ? { x: z.label.x, y: z.label.y } : null;
  return { id: z.id, name: z.name, label };
}
function parsePrize(v: unknown): Prize | null {
  const p = v as Partial<Prize> | null;
  if (!p || !str(p.id) || !str(p.name) || !RULES.includes(p.rule as PrizeRule)) return null;
  return {
    id: p.id,
    name: p.name,
    description: str(p.description) ? p.description : "",
    photo: str(p.photo) && p.photo.startsWith("https://") ? p.photo : null,
    rule: p.rule!,
    value: num(p.value) ? p.value : null,
  };
}
function parsePlace(v: unknown): Place | null {
  const p = v as Partial<Place> | null;
  if (!p || !str(p.id) || !str(p.name) || !num(p.lat) || !num(p.lng) || !num(p.width) || p.width <= 0) return null;
  const o = p.outlines;
  const outlines = o && str(o.buildings) && str(o.roads) && str(o.grounds) ? { buildings: o.buildings, roads: o.roads, grounds: o.grounds } : null;
  // (a copy saved before `hand`: Leyte Academic Center was always on its hand-drawn plan)
  const hand = typeof p.hand === "boolean" ? p.hand : p.id === DEFAULT_PLACE;
  return { id: p.id, name: p.name, address: str(p.address) ? p.address : "", lat: p.lat, lng: p.lng, width: p.width, outlines, hand };
}
function parseSponsor(v: unknown): Sponsor | null {
  const s = v as Partial<Sponsor> | null;
  if (!s || !str(s.id) || !str(s.name) || !str(s.badge) || !s.badge.startsWith("/assets/sponsors/")) return null;
  return { id: s.id, name: s.name, badge: s.badge };
}
function parseHunt(v: unknown): Hunt | null {
  const h = v as Partial<Record<keyof Hunt, unknown>> | null;
  const s = h?.settings as Partial<Hunt["settings"]> | undefined;
  if (!h || !Array.isArray(h.stations) || !Array.isArray(h.zones) || !Array.isArray(h.prizes) || !s) return null;
  if (!num(s.start) || !num(s.end) || typeof s.testMode !== "boolean" || !str(s.claimPlace)) return null;
  // (before the locations update, or saved before it: Leyte Academic Center only)
  const places = Array.isArray(h.places) ? h.places.map(parsePlace).filter(isSome) : null;
  return {
    stations: h.stations.map(parseStation).filter(isSome).sort(inOrder(places)),
    zones: h.zones.map(parseZone).filter(isSome),
    prizes: h.prizes.map(parsePrize).filter(isSome),
    // (a copy from before the sponsor logos update, or saved before it: the game's own)
    sponsors: Array.isArray(h.sponsors) ? h.sponsors.map(parseSponsor).filter(isSome) : null,
    places,
    settings: { start: s.start, end: s.end, testMode: s.testMode, claimPlace: s.claimPlace, randomSpots: s.randomSpots === true },
  };
}
