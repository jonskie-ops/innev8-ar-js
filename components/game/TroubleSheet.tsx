"use client";

import { useState } from "react";
import { useBack } from "@/lib/back";
import { chromeLink, type InApp } from "@/lib/inapp";
import { askMotion } from "@/lib/motion";

/** What the scanner sees going wrong now (the first fix in the pop-up), most pressing first. */
export type Trouble =
  | { kind: "inapp"; where: InApp }
  | { kind: "camera"; blocked: boolean }
  | { kind: "location"; title: string; text: string }
  | { kind: "weak"; accuracy: number }
  | { kind: "motion" }
  | { kind: "compass" }
  | { kind: "stuck"; num: string };

/** The fixes the scanner can do itself. */
export type Fixes = {
  camera: () => void;
  location: () => void;
  compass: (() => void) | null; // (GPS spots only)
  codes: () => void;
};

type Fix = { label: string; run: () => void; keep?: boolean };

/** iPhone asks before the game may follow the phone's movement: a button can ask again. */
const canAskMotion = () =>
  typeof window !== "undefined" &&
  typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined)?.requestPermission === "function";

/**
 * "Having trouble?" in the scanner: what's wrong right now (if the scanner can tell) with buttons that
 * fix it on the spot, then the other quick fixes, and, if it's still not working, the hunter tag to
 * show at the prize desk. A fix closes the pop-up, so its result shows in the scanner.
 */
export function TroubleSheet({
  troubles,
  fixes,
  tag,
  claimPlace,
  onClose,
}: {
  troubles: Trouble[];
  fixes: Fixes;
  tag: string | null;
  claimPlace: string;
  onClose: () => void;
}) {
  useBack(true, onClose);
  const [copied, setCopied] = useState(false);
  const run = (f: Fix) => {
    f.run();
    if (!f.keep) onClose();
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {}
  };

  const camera: Fix = { label: "Restart the camera", run: fixes.camera };
  const where: Fix = { label: "Refresh my location", run: fixes.location };
  const compass: Fix | null = fixes.compass && { label: "Reset the compass", run: fixes.compass };
  const codes: Fix = { label: "Show the codes again", run: fixes.codes };
  const motion: Fix | null = canAskMotion() ? { label: "Allow motion", run: askMotion } : null;
  const reload: Fix = { label: "Reload the game", run: () => location.reload(), keep: true };

  // What's wrong now: a sentence, what to do, and the buttons that help
  const now = troubles.map((t) => {
    switch (t.kind) {
      case "inapp":
        return {
          key: t.kind,
          title: `You're in ${t.where.app || "another app"}'s browser`,
          text: `It may block the camera, compass or GPS. Open the game in ${t.where.ios ? "Safari" : "Chrome"} instead: tap ${t.where.ios ? "•••" : "⋮"}, then "Open in ${t.where.ios ? "Safari" : "Chrome"}" (or "Open in browser").`,
          fixes: [] as Fix[],
          inapp: t.where,
        };
      case "camera":
        return {
          key: t.kind,
          title: "The camera isn't working",
          text: t.blocked
            ? "Camera access is blocked. Tap the icon beside the address bar (or your browser's site settings), allow the camera, then tap Restart the camera."
            : "Another app may be using it. Close other camera apps, then tap Restart the camera.",
          fixes: [camera],
        };
      case "location":
        return { key: t.kind, title: t.title, text: t.text, fixes: [where] };
      case "weak":
        return {
          key: t.kind,
          title: `Your GPS is weak (±${t.accuracy} m)`,
          text: "Step into the open, away from walls and roofs, and stand still for a few seconds. On iPhone, check Precise Location is on.",
          fixes: [where],
        };
      case "motion":
        return {
          key: t.kind,
          title: "The scanner can't follow your phone's movement",
          text: motion ? "Tap Allow motion, then choose Allow." : "Drag the screen to look around instead.",
          fixes: motion ? [motion] : [],
        };
      case "compass":
        return {
          key: t.kind,
          title: "The arrow can't tell which way you're facing",
          text: "Wave your phone in a figure 8 a few times, away from metal, then tap Reset the compass.",
          fixes: compass ? [compass] : [],
        };
      case "stuck":
        return {
          key: t.kind,
          title: `QR code #${t.num} is here but not showing`,
          text: "Hold your phone upright and turn slowly all the way around. Still nothing? Tap Show the codes again.",
          fixes: [codes],
        };
    }
  });
  const shown = new Set(now.flatMap((n) => n.fixes.map((f) => f.label)));
  const more = [camera, where, compass, codes, reload].filter((f): f is Fix => Boolean(f) && !shown.has(f!.label));

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="trouble-title">
      <div className="catch trouble">
        <p className="catch__eyebrow">Help</p>
        <h2 id="trouble-title">Having trouble?</h2>

        {now.length > 0 && (
          <ul className="trouble__now" role="list">
            {now.map((n) => (
              <li key={n.key}>
                <b>{n.title}</b>
                <p>{n.text}</p>
                {(n.fixes.length > 0 || n.inapp) && (
                  <div className="trouble__btns">
                    {n.fixes.map((f) => (
                      <button key={f.label} type="button" className="btn btn--primary btn--sm" onClick={() => run(f)}>
                        {f.label}
                      </button>
                    ))}
                    {n.inapp && !n.inapp.ios && (
                      <a className="btn btn--primary btn--sm" href={chromeLink(location.href)}>
                        Open in Chrome
                      </a>
                    )}
                    {n.inapp && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyLink()}>
                        {copied ? "Link copied" : "Copy the link"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="trouble__more">
          <p>{now.length ? "Other quick fixes" : "Quick fixes: try these first"}</p>
          <div className="trouble__btns">
            {more.map((f) => (
              <button key={f.label} type="button" className="btn btn--ghost btn--sm" onClick={() => run(f)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="trouble__desk">
          Still stuck? Go to the <b>{claimPlace}</b>
          {tag ? (
            <>
              {" "}
              and show your hunter tag: <b className="trouble__tag">{tag}</b>
            </>
          ) : (
            "."
          )}
        </p>

        <div className="catch__btns">
          <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
