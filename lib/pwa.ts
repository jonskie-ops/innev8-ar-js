import { useSyncExternalStore } from "react";
import { getHunt } from "./huntStore";
import sponsors from "./sponsors.json";
import clips from "./voice-clips.json";

/**
 * The game as an app: public/sw.js keeps it on the phone (production builds only, on a secure
 * page), so it opens and plays on weak or no signal; this side starts it, says what to keep, and
 * passes on "there's a new version".
 */

/** What the game uses beyond the page's first load (sprites, clips…): kept on the phone ahead of time. */
const ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/assets/fonts/montserrat-var.woff2",
  "/assets/fonts/poppins-400.woff2",
  "/assets/img/tunnel-1200.webp",
  "/assets/img/bridge-1200.webp",
  "/assets/img/favicon.svg",
  "/assets/img/apple-touch-icon.png",
  "/assets/img/app/icon-192.png",
  "/assets/img/logo/innev8-wordmark-reversed.svg",
  "/assets/img/mascot/talk.webp",
  "/assets/img/mascot/idle.webp",
  "/assets/img/mascot/sniff.webp",
  "/assets/regional-ict-summit-2026.ics",
  ...Object.values(clips as Record<string, string>),
  ...Object.values(sponsors as Record<string, string>),
];
// After the game has loaded what it uses (the scanner's 3D comes a few seconds in), and again later
const WARM_MS = [8000, 30000];

// ---- Small stores the screens read
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let updateReady = false;
/** A new version is waiting: reload to get it. */
export const useAppUpdate = () =>
  useSyncExternalStore(
    subscribe,
    () => updateReady,
    () => false,
  );

let started = false;
/** Starts the service worker (once; production only). */
export function startApp() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type !== "update") return;
    updateReady = true;
    emit();
  });
  navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      for (const ms of WARM_MS)
        window.setTimeout(() => {
          const used = performance.getEntriesByType("resource").map((r) => r.name);
          // (and the organisers' sponsor badges, wherever they show)
          const badges = getHunt().hunt.sponsors?.map((s) => s.badge) ?? [];
          reg.active?.postMessage({ type: "warm", urls: [...ASSETS, ...badges, ...used] });
        }, ms);
    })
    .catch(() => {}); // no worker: it's a website as before
}
