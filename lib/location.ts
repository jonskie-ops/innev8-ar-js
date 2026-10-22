"use client";

import { useEffect, useSyncExternalStore } from "react";
import { metresBetween } from "./geo";

/**
 * Where the player is: the phone's GPS, shared by everything that wants it (the scanner, the map's
 * "you are here"), watched only while one of them is on screen.
 *
 * GPS readings jump about by a few metres, more near buildings. Each reading is blended into the
 * estimate by how sure the phone says it is (a simple Kalman filter: the estimate gets less sure as
 * time passes, at about walking pace), so a code doesn't flicker in and out of range on a bad reading.
 */

export type Fix = {
  lat: number;
  lng: number;
  /** How sure the phone says its latest reading is, in metres (shown to the player) */
  accuracy: number;
  at: number;
};

export type LocationState = {
  /**
   * off: nobody's asked; asking: waiting for permission or a first fix; lost: it was on, then the
   * phone stopped giving it (its location turned off): it comes back by itself once it's on again
   */
  status: "off" | "asking" | "on" | "denied" | "unavailable" | "insecure" | "lost";
  fix: Fix | null;
};

/** Walking pace, as the estimate's growing doubt: about (1.7 m/s)² each second. */
const WALK_VAR = 3;
/** A gap this long (ms) starts the estimate again from the next reading. */
const RESTART_MS = 30000;
/** Readings worse than this (m) are only used while there's nothing better. */
const POOR = 60;
/**
 * A sure reading this far from the estimate (m, or 4× their combined doubt if more) means the player
 * really is somewhere else (back in the app after a walk, say): start again from it rather than drift.
 */
const JUMP = 25;
/**
 * No exact GPS fix after this long (ms; indoors, or the GPS just switched on, it can take a minute):
 * also take the phone's quicker rough location (Wi-Fi, cell towers), so the player shows up at all.
 * Its readings are usually worse than POOR, so a GPS fix takes over as soon as there is one.
 */
const ROUGH_AFTER_MS = 6000;
/**
 * The phone saying it has no location, this long (ms) after its last reading: its location was turned
 * off (a moment's "no location" in between readings is left alone). No reading at all for LOST_MS, and
 * it's lost too.
 */
const GONE_MS = 3000;
const LOST_MS = 30000;
/** While it's lost, how often (ms) to ask the phone again (with no signal yet: every few of these). */
const RETRY_MS = 4000;
const SLOW_RETRIES = 4;

let state: LocationState = { status: "off", fix: null };
const listeners = new Set<() => void>();
let users = 0;
let watch: number | null = null;
let rough: number | null = null;
let roughTimer: number | undefined;
let gotFix = false;
let lastAt = 0; // when the last reading came, or the game came back on screen (this clock)
let lostAt = 0;
let revive: number | undefined;
let ticks = 0;
let hooked = false;
let est: { lat: number; lng: number; v: number; at: number } | null = null;

function set(next: LocationState) {
  state = next;
  listeners.forEach((l) => l());
}

function take(p: GeolocationPosition) {
  if (state.status === "lost" && p.timestamp && p.timestamp < lostAt) return; // (one the phone kept from before)
  gotFix = true;
  lastAt = Date.now();
  const acc = Math.max(1, p.coords.accuracy || POOR);
  const at = p.timestamp || Date.now();
  if (acc > POOR && est && at - est.at < RESTART_MS) return; // a bad reading: keep the good estimate
  const here = { lat: p.coords.latitude, lng: p.coords.longitude };
  const jumped = est && metresBetween(est, here) > Math.max(JUMP, 4 * Math.sqrt(est.v + acc * acc));
  if (!est || at - est.at > RESTART_MS || jumped) est = { ...here, v: acc * acc, at };
  else {
    est.v += (Math.max(0, at - est.at) / 1000) * WALK_VAR;
    const k = est.v / (est.v + acc * acc);
    est.lat += k * (p.coords.latitude - est.lat);
    est.lng += k * (p.coords.longitude - est.lng);
    est.v *= 1 - k;
    est.at = at;
  }
  set({ status: "on", fix: { lat: est.lat, lng: est.lng, accuracy: Math.round(acc), at } });
}

/** Its location went off: the warning shows, and the phone is asked again every few seconds. */
function lose() {
  if (state.status === "lost") return;
  lostAt = Date.now();
  set({ status: "lost", fix: null });
}

/**
 * Once: the site's location permission changing (blocked in the browser's settings, or allowed again),
 * and the player coming back to the game (from the phone's settings, say) with no location: ask again.
 */
function hook() {
  if (hooked) return;
  hooked = true;
  navigator.permissions
    ?.query({ name: "geolocation" })
    .then((perm) => {
      perm.onchange = () => {
        if (perm.state === "denied") {
          stop();
          set({ status: "denied", fix: null });
        } else if (users > 0 && state.status !== "on") restart();
      };
    })
    .catch(() => {});
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    lastAt = Date.now(); // (its readings were paused while away)
    if (users > 0 && state.status !== "on" && state.status !== "insecure") restart();
  });
}

function restart() {
  stop();
  start();
}

function start() {
  if (watch !== null) return;
  if (!window.isSecureContext) return set({ status: "insecure", fix: null });
  if (!navigator.geolocation) return set({ status: "unavailable", fix: null });
  hook();
  if (state.status !== "on" && state.status !== "lost") set({ ...state, status: "asking" });
  window.clearInterval(revive);
  revive = window.setInterval(() => {
    if (users === 0 || document.visibilityState !== "visible") return; // (a phone pauses it for a tab in the background)
    if (state.status === "on" && Date.now() - lastAt > LOST_MS) lose();
    // (no signal yet: not so often, the GPS may still be warming up)
    if (state.status === "lost" || (state.status === "unavailable" && ++ticks % SLOW_RETRIES === 0)) restart();
  }, RETRY_MS);
  gotFix = false;
  roughTimer = window.setTimeout(() => {
    if (gotFix || watch === null) return;
    rough = navigator.geolocation.watchPosition(take, () => {}, { enableHighAccuracy: false, maximumAge: 10000, timeout: 30000 });
  }, ROUGH_AFTER_MS);
  watch = navigator.geolocation.watchPosition(
    take,
    (e) => {
      if (e.code === e.PERMISSION_DENIED) {
        if (state.fix || state.status === "lost") return lose(); // (some phones say this when their location's switched off)
        stop();
        set({ status: "denied", fix: null });
      } else if (state.status === "lost") return;
      else if (state.fix) {
        // Had one: gone now if the phone says so a few seconds on (or nothing's come for a while)
        const quiet = Date.now() - lastAt;
        if ((e.code === e.POSITION_UNAVAILABLE && quiet > GONE_MS) || quiet > LOST_MS) lose();
      } else set({ status: "unavailable", fix: null }); // keeps trying; a later fix turns it on
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
  );
}

function stop() {
  window.clearTimeout(roughTimer);
  if (watch !== null) navigator.geolocation.clearWatch(watch);
  if (rough !== null) navigator.geolocation.clearWatch(rough);
  watch = null;
  rough = null;
}

/** Where the player is now, as far as the phone knows (null: no location). */
export const lastFix = () => (state.status === "on" ? state.fix : null);

/** Try again after a "blocked" or "no signal" (e.g. a Try again button, once they've allowed it). */
export function retryLocation() {
  stop();
  est = null;
  set({ status: "off", fix: null });
  if (users > 0) start();
}

/** Has this site been allowed the location before (so it can be turned on without a prompt)? */
export async function locationAllowed() {
  try {
    return (await navigator.permissions?.query({ name: "geolocation" }))?.state === "granted";
  } catch {
    return false;
  }
}

/** The player's location, followed while `on` (and while anything else wants it too). */
export function useLocation(on: boolean): LocationState {
  useEffect(() => {
    if (!on) return;
    users++;
    start();
    return () => {
      users--;
      if (users > 0) return;
      stop(); // keeps the last fix for a moment's reopen; a gap of 30 s+ starts over
      window.clearInterval(revive);
    };
  }, [on]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
