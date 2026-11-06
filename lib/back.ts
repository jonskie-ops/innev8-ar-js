"use client";

import { useEffect, useRef } from "react";

/**
 * The phone's Back (Android's back button or swipe, the browser's back): closes what's open on top
 * (the scanner, a pop-up, Qufoo, a tab other than the map) instead of leaving the game.
 *
 * Each thing open has its own entry in the browser's history (same address), added as it opens
 * (from the tap that opened it: Chrome skips entries a page adds on its own). Back takes the newest
 * entry and the newest thing open closes. Closed another way (its ✕, a button), its entry is taken
 * back out quietly. Changes are looked at once React has finished (setTimeout), so one thing closing
 * as another opens (the scanner as the catch card comes up) keeps the same entry.
 */
type Layer = { close: () => void };
const layers: Layer[] = [];
let entries = 0; // the game's entries in the history now, on top of where it started
let going = false; // the game stepped back itself (to take entries out) and that hasn't landed yet
let timer = 0;

function sync() {
  timer = 0;
  if (going) return; // carries on once that step has landed
  const want = layers.length;
  for (; entries < want; entries++) history.pushState(null, "");
  if (entries > want) {
    going = true;
    history.go(want - entries);
    entries = want;
  }
}
const later = () => {
  if (!timer) timer = window.setTimeout(sync, 0);
};

if (typeof window !== "undefined")
  addEventListener("popstate", () => {
    if (going) {
      going = false;
      return later();
    }
    if (!entries) return; // not one of the game's entries
    entries--;
    layers.at(-1)?.close();
    later();
  });

/** While `open`, the phone's Back calls `close` (the newest one open goes first). */
export function useBack(open: boolean, close: () => void) {
  const ref = useRef(close);
  useEffect(() => {
    ref.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const layer: Layer = { close: () => ref.current() };
    layers.push(layer);
    later();
    return () => {
      const i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
      later();
    };
  }, [open]);
}
