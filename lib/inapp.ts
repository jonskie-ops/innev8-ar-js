/**
 * Opened inside another app's own browser (Messenger, Facebook, Instagram…, where a shared link
 * opens)? Those often block the camera, the compass or the GPS that the hunt needs, or keep asking
 * for them. Null: a real browser (Safari, Chrome…) or the game added to the home screen.
 */
export type InApp = { app: string; ios: boolean };

const APPS: [RegExp, string][] = [
  [/MessengerForiOS|FBAN\/Messenger|Orca-Android|\bMessenger\b/, "Messenger"],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/, "Facebook"],
  [/Instagram/, "Instagram"],
  [/musical_ly|BytedanceWebview|TikTok/, "TikTok"],
  [/\bLine\//, "LINE"],
  [/MicroMessenger/, "WeChat"],
  [/Snapchat/, "Snapchat"],
  [/Viber/, "Viber"],
  [/Twitter/, "X"],
];

export function inAppBrowser(ua: string, standalone: boolean): InApp | null {
  if (standalone) return null;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const named = APPS.find(([re]) => re.test(ua));
  if (named) return { app: named[1], ios };
  // Another app's browser without its name: on Android it says "wv" (a web view); on iPhone, every
  // real browser (Safari, Chrome, Firefox, Edge…) says "Safari/", an app's own browser doesn't
  if (!ios && /Android/.test(ua) && /; wv\)/.test(ua)) return { app: "", ios };
  if (ios && !/Safari\//.test(ua)) return { app: "", ios };
  return null;
}

/** This page in Chrome, from another app's browser on Android (or here again, without Chrome). */
export function chromeLink(href: string) {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
