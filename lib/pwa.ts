import { useSyncExternalStore } from "react";
import clips from "./voice-clips.json";

/**
 * The game as an app: public/sw.js keeps it on the phone (production builds only, on a secure
 * page), so it opens and plays on weak or no signal; this side starts it, says what to keep, and
 * passes on "there's a new version" and "this can be installed".
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
          reg.active?.postMessage({ type: "warm", urls: [...ASSETS, ...used] });
        }, ms);
    })
    .catch(() => {}); // no worker: it's a website as before
}

// ---- Installing
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallPrompt | null = null;
let installedNow = false;
if (typeof window !== "undefined") {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // our own Install button offers it
    deferred = e as InstallPrompt;
    emit();
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

/**
 * How this phone can install the app: "installed" (opened from the home screen), "ready" (the
 * browser can install it from our button: Android, desktop Chrome), "ios" (Share, then Add to Home
 * Screen), "inapp" (Messenger, Facebook…: open it in the browser first) or "manual" (from the
 * browser's own menu).
 */
export type InstallWay = "installed" | "ready" | "ios" | "inapp" | "manual";
function installWay(): InstallWay {
  const standalone =
    matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (installedNow || standalone) return "installed";
  if (deferred) return "ready";
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|MicroMessenger/i.test(ua)) return "inapp";
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "manual";
}
export const useInstallWay = () => useSyncExternalStore<InstallWay | null>(subscribe, installWay, () => null);

/** Shows the browser's install prompt (when the way is "ready"). */
export async function installApp() {
  const d = deferred;
  if (!d) return;
  deferred = null;
  emit();
  await d.prompt();
  if ((await d.userChoice).outcome === "accepted") installedNow = true;
  emit();
}
