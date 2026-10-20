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
  /** off: nobody's asked; asking: waiting for permission or a first fix */
  status: "off" | "asking" | "on" | "denied" | "unavailable" | "insecure";
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

let state: LocationState = { status: "off", fix: null };
const listeners = new Set<() => void>();
let users = 0;
let watch: number | null = null;
let est: { lat: number; lng: number; v: number; at: number } | null = null;

function set(next: LocationState) {
  state = next;
  listeners.forEach((l) => l());
}

function take(p: GeolocationPosition) {
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

function start() {
  if (watch !== null) return;
  if (!window.isSecureContext) return set({ status: "insecure", fix: null });
  if (!navigator.geolocation) return set({ status: "unavailable", fix: null });
  if (state.status !== "on") set({ ...state, status: "asking" });
  watch = navigator.geolocation.watchPosition(
    take,
    (e) => {
      if (e.code === e.PERMISSION_DENIED) {
        stop();
        set({ status: "denied", fix: null });
      } else if (!state.fix) set({ status: "unavailable", fix: null }); // keeps trying; a later fix turns it on
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
  );
}

function stop() {
  if (watch !== null) navigator.geolocation.clearWatch(watch);
  watch = null;
}

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
      if (users === 0) stop(); // keeps the last fix for a moment's reopen; a gap of 30 s+ starts over
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
