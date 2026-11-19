"use client";

import { useState, type ComponentType } from "react";
import { useBack } from "@/lib/back";
import { chromeLink, type InApp } from "@/lib/inapp";
import { askMotion } from "@/lib/motion";
import { CameraIcon, CompassIcon, CopyIcon, LocateIcon, MotionIcon, OpenIcon, ReloadIcon, ScanIcon } from "./icons";

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

/** A fix: its tile's icon, name and when it helps, its colour, and what it does. */
type Fix = {
  id: string;
  label: string;
  sub: string;
  Icon: ComponentType;
  tone: "cyan" | "turq" | "royal" | "gold";
  run: () => void;
  /** Stays open after (the default closes, so the result shows in the scanner) */
  keep?: boolean;
  /** A link instead of a button */
  href?: string;
};

/** iPhone asks before the game may follow the phone's movement: a button can ask again. */
const canAskMotion = () =>
  typeof window !== "undefined" &&
  typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined)?.requestPermission === "function";

/** One fix as a tile: a glowing icon, its name, and when it helps. `wide`: the fix for what's wrong now. */
function FixTile({ fix, wide, onRun }: { fix: Fix; wide?: boolean; onRun: (f: Fix) => void }) {
  const cls = `tfix tfix--${fix.tone}${wide ? " tfix--wide" : ""}`;
  const inner = (
    <>
      <span className="tfix__icon">
        <fix.Icon />
      </span>
      <span className="tfix__text">
        <b>{fix.label}</b>
        <small>{fix.sub}</small>
      </span>
    </>
  );
  return fix.href ? (
    <a className={cls} href={fix.href}>
      {inner}
    </a>
  ) : (
    <button type="button" className={cls} onClick={() => onRun(fix)}>
      {inner}
    </button>
  );
}

/**
 * "Having trouble?" in the scanner: what's wrong right now (if the scanner can tell) with the fix for
 * it, then the other quick fixes as tiles, and, if it's still not working, the hunter tag to show at
 * the prize desk. A fix closes the pop-up, so its result shows in the scanner.
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

  const camera: Fix = { id: "camera", label: "Restart the camera", sub: "Black or frozen picture", Icon: CameraIcon, tone: "cyan", run: fixes.camera };
  const where: Fix = { id: "where", label: "Refresh my location", sub: "Weak or wrong GPS", Icon: LocateIcon, tone: "turq", run: fixes.location };
  const compass: Fix | null = fixes.compass && {
    id: "compass",
    label: "Reset the compass",
    sub: "Arrow points the wrong way",
    Icon: CompassIcon,
    tone: "royal",
    run: fixes.compass,
  };
  const codes: Fix = { id: "codes", label: "Show the codes again", sub: "A code is here but hidden", Icon: ScanIcon, tone: "cyan", run: fixes.codes };
  const motion: Fix | null = canAskMotion()
    ? { id: "motion", label: "Allow motion", sub: "So the view follows your phone", Icon: MotionIcon, tone: "turq", run: askMotion }
    : null;
  const reload: Fix = { id: "reload", label: "Reload the game", sub: "Start fresh: nothing is lost", Icon: ReloadIcon, tone: "gold", run: () => location.reload(), keep: true };
  const copy: Fix = {
    id: "copy",
    label: copied ? "Link copied" : "Copy the link",
    sub: "Paste it in your browser",
    Icon: CopyIcon,
    tone: "turq",
    keep: true,
    run: () => {
      navigator.clipboard.writeText(location.href).then(() => setCopied(true), () => {});
    },
  };

  // What's wrong now: a sentence, what to do, and the fixes that help
  const now = troubles.map((t) => {
    switch (t.kind) {
      case "inapp": {
        const browser = t.where.ios ? "Safari" : "Chrome";
        const open: Fix | null = t.where.ios
          ? null
          : { id: "chrome", label: "Open in Chrome", sub: "The camera and GPS work there", Icon: OpenIcon, tone: "cyan", run: () => {}, href: chromeLink(location.href) };
        return {
          key: t.kind,
          title: `You're in ${t.where.app || "another app"}'s browser`,
          text: `It may block the camera, compass or GPS. Open the game in ${browser}: tap ${t.where.ios ? "•••" : "⋮"}, then "Open in ${browser}".`,
          fixes: [open, copy].filter((f): f is Fix => Boolean(f)),
        };
      }
      case "camera":
        return {
          key: t.kind,
          title: "The camera isn't working",
          text: t.blocked
            ? "Camera access is blocked. Tap the icon beside the address bar (or your browser's site settings), allow the camera, then restart it."
            : "Another app may be using it. Close other camera apps, then restart it.",
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
          title: "The scanner can't follow your phone",
          text: motion ? "Tap Allow motion, then choose Allow." : "Drag the screen to look around instead.",
          fixes: motion ? [motion] : [],
        };
      case "compass":
        return {
          key: t.kind,
          title: "The arrow can't tell which way you face",
          text: "Wave your phone in a figure 8 a few times, away from metal, then reset the compass.",
          fixes: compass ? [compass] : [],
        };
      case "stuck":
        return {
          key: t.kind,
          title: `QR code #${t.num} is here but not showing`,
          text: "Hold your phone upright and turn slowly all the way around. Still nothing? Show the codes again.",
          fixes: [codes],
        };
    }
  });
  const shown = new Set(now.flatMap((n) => n.fixes.map((f) => f.id)));
  const more = [camera, where, compass, codes, reload].filter((f): f is Fix => Boolean(f) && !shown.has(f!.id));

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="trouble-title">
      <div className="catch trouble">
        <p className="catch__eyebrow">Help</p>
        <h2 id="trouble-title">Having trouble?</h2>

        {now.length > 0 && (
          <ul className="trouble__now" role="list">
            {now.map((n) => (
              <li key={n.key}>
                <p className="trouble__issue">
                  <i aria-hidden="true" />
                  {n.title}
                </p>
                <p>{n.text}</p>
                {n.fixes.map((f) => (
                  <FixTile key={f.id} fix={f} wide onRun={run} />
                ))}
              </li>
            ))}
          </ul>
        )}

        <p className="trouble__label">{now.length ? "Other quick fixes" : "Quick fixes"}</p>
        <div className="tfix-grid">
          {more.map((f) => (
            <FixTile key={f.id} fix={f} onRun={run} />
          ))}
        </div>

        <div className="trouble__desk">
          <p>
            Still stuck? Go to the <b>{claimPlace}</b>
            {tag ? " and show your hunter tag:" : "."}
          </p>
          {tag && <span className="trouble__tag">{tag}</span>}
        </div>

        <div className="catch__btns">
          <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
