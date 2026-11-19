"use client";

import { useEffect, useState } from "react";
import { useBack } from "@/lib/back";
import { chromeLink, inAppBrowser, type InApp } from "@/lib/inapp";

/** Closed with "Continue here anyway": not shown again in this tab */
const SEEN = "innev8-inapp-ok";

/**
 * Opened from a link in Messenger, Facebook or another app: that app's own browser often blocks the
 * camera, the compass or the GPS. A pop-up says so and how to open the game in Safari (iPhone) or
 * Chrome (Android): a button straight to Chrome on Android, and the link to copy. It can be closed
 * (some of those browsers do work), and then stays closed in this tab.
 */
export function InAppNotice() {
  const [where, setWhere] = useState<InApp | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
    } catch {}
    if (seen) return;
    const standalone =
      matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const found = inAppBrowser(navigator.userAgent, standalone);
    // (read once, after the page is up: the server can't tell)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found) setWhere(found);
  }, []);

  const close = () => {
    try {
      sessionStorage.setItem(SEEN, "1");
    } catch {}
    setWhere(null);
  };
  useBack(where !== null, close);
  if (!where) return null;

  const link = location.href;
  const browser = where.ios ? "Safari" : "Chrome";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // (no clipboard here: the link is selected, to copy by hand)
      const box = document.getElementById("inapp-link") as HTMLInputElement | null;
      box?.focus();
      box?.select();
    }
  };

  return (
    <div className="modal modal--inapp" role="alertdialog" aria-modal="true" aria-labelledby="inapp-title" aria-describedby="inapp-text">
      <div className="catch catch--legendary inapp">
        <p className="catch__eyebrow">Open in {browser}</p>
        <h2 id="inapp-title">Open the game in {browser}</h2>
        <p id="inapp-text" className="catch__blurb">
          You opened it inside {where.app || "another app"}. Its browser may block the camera, compass or GPS that the hunt needs.
        </p>
        <ol className="inapp__steps">
          {where.ios ? (
            <>
              <li>
                Tap <b>•••</b> or the share button, at the top or bottom of the screen.
              </li>
              <li>
                Choose <b>Open in Safari</b> (or <b>Open in browser</b>).
              </li>
            </>
          ) : (
            <>
              <li>
                Tap <b>⋮</b> at the top right of the screen.
              </li>
              <li>
                Choose <b>Open in Chrome</b> (or <b>Open in browser</b>).
              </li>
            </>
          )}
        </ol>
        <label className="inapp__link">
          <span>Or copy the link and paste it in {browser}:</span>
          <input id="inapp-link" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </label>
        <div className="catch__btns">
          {!where.ios && (
            <a className="btn btn--primary" href={chromeLink(link)}>
              Open in Chrome
            </a>
          )}
          <button type="button" className={where.ios ? "btn btn--primary" : "btn btn--ghost"} onClick={() => void copy()}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={close}>
            Continue here anyway
          </button>
        </div>
      </div>
    </div>
  );
}
