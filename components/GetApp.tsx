"use client";

import { installApp, useInstallWay } from "@/lib/pwa";
import { APP_SHORT_NAME } from "@/lib/site";
import { DownloadIcon, PhoneIcon, ShareIcon } from "./icons";

/**
 * How to put the game on the home screen, for this phone: an Install button where the browser
 * offers one (Android, desktop Chrome), Share then Add to Home Screen on iPhone, or how to get out
 * of an in-app browser (Messenger…) first. Nothing once it's installed. `variant`: a section of the
 * Me page, or a card on the countdown screen.
 */
export function GetApp({ variant }: { variant: "section" | "card" }) {
  const way = useInstallWay();
  if (!way || way === "installed") return null;
  const body = (
    <div className="getapp">
      <p className="getapp__lead">
        Add <b>{APP_SHORT_NAME}</b> to your home screen: it opens like an app and keeps working when the
        venue&apos;s signal is weak.
      </p>
      {way === "ready" && (
        <button type="button" className="btn btn--primary btn--sm" onClick={() => void installApp()}>
          <DownloadIcon />
          Install app
        </button>
      )}
      {way === "ios" && (
        <>
          <ol className="getapp__steps">
            <li>
              Tap{" "}
              <span className="getapp__key">
                <ShareIcon />
                Share
              </span>{" "}
              in your browser&apos;s toolbar.
            </li>
            <li>
              Choose <b>Add to Home Screen</b>, then <b>Add</b>.
            </li>
            <li>
              Open <b>{APP_SHORT_NAME}</b> from your home screen.
            </li>
          </ol>
          <p className="getapp__note">
            On iPhone the app starts fresh, so add it before you collect codes: the ones you collect here
            stay in this browser.
          </p>
        </>
      )}
      {way === "inapp" && (
        <p className="getapp__note">
          Open this page in Safari or Chrome first (tap the menu, then <b>Open in browser</b>), then add it
          to your home screen.
        </p>
      )}
      {way === "manual" && (
        <p className="getapp__note">
          In your browser&apos;s menu, tap <b>Install app</b> or <b>Add to Home screen</b>.
        </p>
      )}
    </div>
  );
  if (variant === "card")
    return (
      <div className="getapp-card">
        <p className="getapp-card__title">
          <PhoneIcon />
          Get the app
        </p>
        {body}
      </div>
    );
  return (
    <section className="psec">
      <div className="psec__head">
        <span className="psec__icon">
          <PhoneIcon />
        </span>
        <span className="psec__title">Get the app</span>
      </div>
      <div className="psec__body">{body}</div>
    </section>
  );
}
