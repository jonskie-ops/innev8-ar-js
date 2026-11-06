"use client";

import { useSyncExternalStore } from "react";

/**
 * Sound on or off (the speaker button on the Me tab and in the scanner): the music, Qufoo's voice and
 * sniffing, and the collect sound. Kept on the phone. Off, they still "play" without a sound, so
 * Qufoo's words keep their pace and everything comes back in step when it's turned on again.
 */
const KEY = "i8ar-sound-v1";
const listeners = new Set<() => void>();
let off: boolean | null = null;

export function isMuted() {
  if (off === null) {
    try {
      off = localStorage.getItem(KEY) === "off";
    } catch {
      off = false;
    }
  }
  return off;
}

export function setMuted(next: boolean) {
  off = next;
  try {
    localStorage.setItem(KEY, next ? "off" : "on");
  } catch {}
  listeners.forEach((l) => l());
}

/** Calls `listener` whenever sound is turned on or off; returns how to stop. */
export function onMuted(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Keeps an audio element muted while sound is off. */
export function followMute(el: HTMLMediaElement) {
  el.muted = isMuted();
  onMuted(() => (el.muted = isMuted()));
}

/** Sound is off (for the speaker buttons). */
export const useMuted = () => useSyncExternalStore(onMuted, isMuted, () => false);
