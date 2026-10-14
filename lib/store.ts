"use client";

import { useSyncExternalStore } from "react";

/** Player progress, kept on the device (localStorage). Shared by every component through useProgress(). */
export type Progress = {
  name: string;
  /** One of PROVINCES (lib/site.ts); empty until chosen during sign-up. */
  province: string;
  onboarded: boolean;
  /** Station id → time its QR code was collected (ms since epoch). */
  found: Record<string, number>;
};

const KEY = "i8ar-progress-v1";
const EMPTY: Progress = { name: "", province: "", onboarded: false, found: {} };

let cache: Progress | null = null;
const listeners = new Set<() => void>();

function read(): Progress {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Progress>) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Progress) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed progress: drop the cache so the next read picks it up.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

export function useProgress() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const progress = {
  /** Finishes sign-up. */
  start(name: string, province: string) {
    write({ ...read(), name: name.trim().slice(0, 20), province, onboarded: true });
  },
  rename(name: string) {
    write({ ...read(), name: name.trim().slice(0, 20) });
  },
  setProvince(province: string) {
    write({ ...read(), province });
  },
  /** Returns false if that QR code was already collected. */
  collect(id: string) {
    const p = read();
    if (p.found[id]) return false;
    write({ ...p, found: { ...p.found, [id]: Date.now() } });
    return true;
  },
  /** Clears collected QR codes; the player keeps their name. */
  reset() {
    write({ ...read(), found: {} });
  },
  /** Forgets the player entirely, back to the first-launch name prompt (test tool). */
  clear() {
    cache = EMPTY;
    try {
      localStorage.removeItem(KEY);
    } catch {}
    listeners.forEach((l) => l());
  },
};
