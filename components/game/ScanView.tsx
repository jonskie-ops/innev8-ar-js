"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pad2 } from "@/lib/dom";
import { bearing, howFar, metresBetween, onOpenSide } from "@/lib/geo";
import { unlocked, type Station } from "@/lib/hunt";
import { getHunt, useHunt } from "@/lib/huntStore";
import { retryLocation, useLocation, type LocationState } from "@/lib/location";
import { COLLECT_HIT_MS } from "@/lib/sfx";
import { useProgress } from "@/lib/store";
import { ScanQufoo, type Line } from "../Mascot";
import { AllFoundCard } from "./AllFoundCard";
import type { ArMode, ArPhase, ArStage, CamState, Guide, Near } from "./ar/stage";
import { ArrowRightIcon, CameraOffIcon, CloseIcon, LockIcon, PinOffIcon } from "./icons";
import { NoCodes } from "./NoCodes";
import { QrTile } from "./QrTile";
import { SoundButton } from "./SoundButton";

/** Random spots: codes hidden around the player each time the scanner opens. */
const PER_SCAN = 3;
/** A code in range stays in range until the player is this much farther than its distance (m, at least). */
const LEAVE_MARGIN = 5;
/** The distance meter fills from this far away (m) to the code's distance. */
const METER_FROM = 80;
/** GPS readings less sure than this (m) are called weak. */
const WEAK_GPS = 25;

const TURN_HINT: Record<NonNullable<Guide["turn"]>, string> = {
  left: "is nearby: turn left",
  right: "is nearby: turn right",
  down: "Look a little lower",
  up: "Look a little higher",
};

const CAM_MESSAGE: Partial<Record<CamState, string>> = {
  denied: "Camera access is blocked. Allow it in your browser's site settings, then reopen the scanner.",
  unavailable: "No camera is available on this device.",
};

/**
 * The camera, asked for as the scanner opens (while the 3D layer loads), so the live picture shows
 * straight away. Null: not asked here. A phone with full AR (WebXR) tries that first and needs the
 * camera free, so the 3D layer asks for it after, as before.
 */
async function cameraEarly(): Promise<MediaStream | null> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return null;
  const xr = navigator.xr ? await navigator.xr.isSessionSupported("immersive-ar").catch(() => false) : false;
  if (xr) return null;
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
}

/** Why there's no location yet, as the scanner says it. */
const LOCATION_HINT: Record<Exclude<LocationState["status"], "on">, string> = {
  off: "Finding where you are…",
  asking: "Finding where you are…",
  denied: "Location is blocked. Allow it for this site, then tap Try again: QR codes show when you're near them.",
  unavailable: "No GPS signal yet. Step outside or near a window.",
  insecure: "Location needs the game's https address.",
  lost: "Your location turned off.",
};

/**
 * The hunt needs the player's location (QR codes show only near them): with none, the scanner says
 * so in the middle of the screen until it's back.
 */
const NO_LOCATION: Record<"denied" | "unavailable" | "insecure" | "lost", { title: string; text: string }> = {
  lost: {
    title: "Your location turned off",
    text: "The hunt needs it: QR codes show only when you're near them. Turn Location back on for your phone, and the hunt carries on by itself.",
  },
  denied: {
    title: "Turn on your location",
    text: "The hunt needs it: QR codes show only when you're near them. Allow location for this site (and turn Location on for your phone), then tap Try again.",
  },
  unavailable: {
    title: "Can't find your location",
    text: "Check that Location is on for your phone, then step outside or near a window.",
  },
  insecure: {
    title: "Location needs https",
    text: "Open the game at its https address so it can use your location.",
  },
};

/** Random spots: a few of the codes still to find, always including the one the player chose (if any). */
function pickHidden(stations: Station[], found: Record<string, number>, target?: Station) {
  // (stations: the ones that can be found now, not locked by an extra task)
  const rest = stations.filter((s) => !found[s.id] && s !== target).sort(() => Math.random() - 0.5);
  return (target && !found[target.id] ? [target, ...rest] : rest).slice(0, PER_SCAN);
}

/**
 * Full-screen AR scanner. The hunt's QR codes are virtual. Each one is at its real spot on the ground
 * (its GPS spot, set in the admin): it shows only once the player is within its distance of it (10 m
 * unless the organisers set more), in its direction from them, and invisible until the camera is held
 * on it from close enough (too far: "walk closer"). Then the code assembles in 3D and a tap collects
 * it. Until then a distance meter at the top shows how far the chosen code is (or the nearest), with
 * an arrow toward it once the compass is known; Qufoo speaks up and the phone buzzes as one comes in
 * range. No set order: whichever code is fully scanned first is the one collected.
 * All the codes sit in a strip at the bottom with one selected (the one they came for, else the
 * nearest): tap another to head for it instead. Its clue shows, and the test radar shows only it.
 *
 * With the admin's "Random spots" switch on (or, in test mode, when the phone can't give its
 * location and the tester asks for it), a few codes are hidden at random spots around the player
 * instead, wherever they are, as before the venue spots.
 */
export function ScanView({
  target,
  found,
  paused = false,
  onCatch,
  onClose,
  onDex,
}: {
  /** The code the player came to look for (e.g. Find it): the meter and the radar point to it. */
  target?: Station;
  found: Record<string, number>;
  /**
   * A code's card is up over the scanner (just collected): it carries on searching once it's closed,
   * with the camera and everything as it was.
   */
  paused?: boolean;
  /**
   * A code was collected. `stay`: the scanner can stay open under its card (not in full AR, where
   * only the scanner shows: it closes for the card).
   */
  onCatch: (station: Station, stay: boolean) => void;
  onClose: () => void;
  /** To their collection and prizes (from the pop-up once every code is found) */
  onDex: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<ArStage | null>(null);
  // The codes as they are when the scanner opens (a change from the admin meanwhile waits until next time)
  const [stations] = useState(() => getHunt().hunt.stations);
  const settings = useHunt().hunt.settings;
  const testMode = settings.testMode;
  const { tasks } = useProgress();
  // Codes still locked by an extra task can't be found here (the game opens their task instead)
  const [open] = useState(() => stations.filter((s) => unlocked(s, tasks)));
  const [start] = useState(() => (target && !found[target.id] && open.includes(target) ? target : open.find((s) => !found[s.id])));
  // Where the codes are: at their GPS spots, or (the admin's switch, or a tester's choice) at random spots
  const [tryRandom, setTryRandom] = useState(false);
  const mode: ArMode = settings.randomSpots || tryRandom ? "random" : "gps";
  const gps = mode === "gps";
  const [hidden] = useState(() => ({
    random: pickHidden(open, found, start),
    gps: open.filter((s) => !found[s.id]),
  }));
  const [chosen, setChosen] = useState(start); // changed in the strip at the bottom
  const [picked, setPicked] = useState(Boolean(target)); // chosen by the player (else, with GPS: the nearest)
  const [phase, setPhase] = useState<ArPhase | "loading">("loading");
  const [station, setStation] = useState<Station | null>(null);
  const [cam, setCam] = useState<CamState | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [failed, setFailed] = useState(false);
  const [xr, setXr] = useState<"on" | "offer" | null>(null);
  const [near, setNear] = useState(false); // a hidden code is on screen
  const [compass, setCompass] = useState<number | null>(null); // which way the camera faces, from north
  const choose = (s: Station) => {
    setPicked(true);
    setChosen(s);
  };

  // ---- Where the player is, and which codes they're in range of (GPS)
  const loc = useLocation(gps);
  const fix = gps ? loc.fix : null;
  // Each code's distance and direction from the player, nearest first
  // (collected while the scanner's open: gone from here)
  const ways = fix
    ? hidden.gps
        .filter((s) => !found[s.id])
        .map((s) => ({ s, d: metresBetween(fix, s), b: bearing(fix, s) }))
        .sort((a, b) => a.d - b.d)
    : [];
  // In range: within its distance, and staying in until a little past it (a GPS jump doesn't hide it).
  // A code "Seen from" one side (while the admin's switch is on) also needs the player on that side
  // first (lib/geo.ts onOpenSide): until then it's `blocked`, a wall or building in the way. Once it
  // shows, it stays. Worked out once per GPS reading; `entered`: when one last came in range (by the GPS's clock).
  // With the admin's "See codes from farther away" on, a code also shows from that far off, `locked`:
  // in the camera but not to be revealed until the player is within its own distance ("walk closer").
  const [range, setRange] = useState<{ at: number; ids: Set<string>; blocked: Set<string>; locked: Set<string>; entered: number }>({
    at: 0,
    ids: new Set(),
    blocked: new Set(),
    locked: new Set(),
    entered: 0,
  });
  if (fix && fix.at !== range.at) {
    const ids = new Set<string>();
    const blocked = new Set<string>();
    const locked = new Set<string>();
    const seeFar = settings.seeFar ?? 0;
    for (const { s, d } of ways) {
      const was = range.ids.has(s.id);
      const open = was || !settings.seenFrom || onOpenSide(s, fix, fix.accuracy);
      if (!(d <= s.radius || (was && d <= s.radius + Math.max(LEAVE_MARGIN, s.radius * 0.5)))) {
        // Farther than its own distance: seen from afar (and from its open side), locked
        const far = seeFar > s.radius && (d <= seeFar || (range.locked.has(s.id) && d <= seeFar + LEAVE_MARGIN));
        if (far && open) locked.add(s.id);
        continue;
      }
      if (open) ids.add(s.id);
      else blocked.add(s.id);
    }
    const entered = [...ids].some((id) => !range.ids.has(id)) ? fix.at : range.entered;
    setRange({ at: fix.at, ids, blocked, locked, entered });
  }
  const inRange = gps ? new Set([...range.ids].filter((id) => !found[id])) : new Set<string>();
  const nearRef = useRef<Near[]>([]);
  useEffect(() => {
    nearRef.current = ways
      .filter((w) => range.ids.has(w.s.id) || range.locked.has(w.s.id))
      .map((w) => ({ station: w.s, bearing: w.b, distance: w.d, accuracy: fix?.accuracy ?? 0, locked: range.locked.has(w.s.id) }));
    stageRef.current?.setNearby(nearRef.current);
    // (ways: worked out from the same reading as range, and the codes found)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, found]);
  useEffect(() => {
    if (range.entered) navigator.vibrate?.([60, 50, 60]); // one more in range
  }, [range.entered]);
  useEffect(() => {
    if (gps && loc.status === "lost") navigator.vibrate?.([250, 120, 250]); // its location just turned off
  }, [gps, loc.status]);
  // The code headed for: the one the player chose, else (GPS) the nearest still to find
  // (one collected while the scanner's open: the next one, as if none was chosen)
  const still = chosen && !found[chosen.id] ? chosen : undefined;
  const aimed = gps && (!picked || !still) && ways[0] ? ways[0].s : (still ?? open.find((s) => !found[s.id]));
  const aimedRef = useRef(aimed);
  useEffect(() => {
    aimedRef.current = aimed;
    stageRef.current?.setTarget(aimed);
  }, [aimed]);

  // The latest callbacks, for the AR stage that's set up once
  const live = useRef({ onCatch, onClose, xr });
  useEffect(() => {
    live.current = { onCatch, onClose, xr };
  });
  // A code's card closed: carry on searching (nothing to do if none was just collected)
  useEffect(() => {
    if (!paused) stageRef.current?.resume();
  }, [paused]);

  // The 3D layer (and three.js) loads only when the scanner opens (and again, if the tester switches
  // to random spots). The camera is asked for at the same time, so the live picture shows while it
  // loads (the 3D layer takes it over).
  useEffect(() => {
    let alive = true;
    const early = cameraEarly();
    void early
      .then((s) => {
        const v = videoRef.current;
        if (!s || !alive || !v || v.srcObject) return;
        v.srcObject = s;
        void v.play().catch(() => {});
        setCam("on");
      })
      .catch(() => {}); // (the 3D layer says why: blocked, or no camera)
    import("./ar/stage")
      .then(({ createArStage }) =>
        createArStage(
          hostRef.current!,
          videoRef.current!,
          rootRef.current!,
          mode === "gps" ? hidden.gps : hidden.random,
          start,
          {
            onPhase: (p, st) => {
              setPhase(p);
              setStation(st);
            },
            onCamera: setCam,
            onGuide: setGuide,
            onCollect: (st) => live.current.onCatch(st, live.current.xr !== "on"),
            onXr: setXr,
            onNear: setNear,
            onCompass: setCompass,
            onEnd: () => live.current.onClose(), // e.g. the phone's back button during AR
          },
          mode,
          early,
        ),
      )
      .then((s) => {
        if (!alive) return s.dispose();
        stageRef.current = s;
        s.setNearby(nearRef.current); // the location may have come first
        s.setTarget(aimedRef.current); // (and the code headed for, if it changed while it loaded)
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      stageRef.current?.dispose();
      stageRef.current = null;
      // (closed before the 3D layer took the camera: it's let go here too)
      void early.then((s) => s?.getTracks().forEach((t) => t.stop())).catch(() => {});
    };
  }, [hidden, start, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = stations.filter((s) => found[s.id]).length;
  const none = !stations.length; // every location (or code) off in the admin: nothing to find
  const allFound = phase === "done" && !none && count === stations.length; // the pop-up says so
  const num = station ? `#${pad2(station.num)}` : "";
  const help = testMode && phase === "searching" ? guide : null; // the radar is a test aid
  // Which way to turn to a code that's around here (in range) but not on screen: for every player
  const sideTurn = phase === "searching" ? (guide?.turn ?? null) : null;
  // The code the meter points to: the one headed for, if it's still to find
  const aim = gps && aimed && !found[aimed.id] ? ways.find((w) => w.s === aimed) : undefined;
  const aimIn = aim ? inRange.has(aim.s.id) : false;
  const anyIn = inRange.size > 0;
  // Close enough, but on the wrong side of a code "Seen from" one side
  const aimBlocked = gps && aim ? range.blocked.has(aim.s.id) : false;
  const anyBlocked = gps && range.blocked.size > 0;
  const weak = fix ? fix.accuracy > WEAK_GPS : false;
  // Qufoo speaks up for a few seconds after a code comes in range
  const recently = Boolean(fix && range.entered && fix.at - range.entered < 6000);

  let hint: ReactNode = "Starting AR…";
  if (failed) hint = "AR isn't available in this browser.";
  else if (phase === "searching" && gps && !fix) hint = LOCATION_HINT[loc.status === "on" ? "asking" : loc.status];
  else if (phase === "searching" && gps && !anyIn)
    // (walking to a code: its meter says how far, so nothing here covers the radar)
    hint = anyBlocked
      ? "Something's in the way. Find a way around to see the QR code."
      : range.locked.size && guide?.away
        ? // A code seen from afar, in view: how far to walk before it can be collected
          `A QR code is about ${Math.max(1, Math.round(guide.away))} m ahead: walk closer to collect it`
        : aim
          ? null
          : "Walk around the venue: QR codes show when you're near them.";
  else if (phase === "searching") {
    const away = guide?.away;
    hint = away ? (
      `A QR code is about ${Math.max(1, Math.round(away))} m ahead: walk closer`
    ) : sideTurn ? (
      sideTurn === "left" || sideTurn === "right" ? (
        `${aimed && guide?.toTarget ? `QR code #${pad2(aimed.num)}` : "A QR code"} ${TURN_HINT[sideTurn]}`
      ) : (
        TURN_HINT[sideTurn]
      )
    ) : help ? (
      <>
        Hold still<span className="blink">…</span> something is here
      </>
    ) : gps ? (
      <>
        A QR code is right around you<span className="blink">…</span> look around
      </>
    ) : aimed ? (
      <>
        Scanning<span className="blink">…</span> look for QR code #{pad2(aimed.num)}
      </>
    ) : (
      <>
        Scanning<span className="blink">…</span> look around for a hidden INNEV8 QR code
      </>
    );
  } else if (phase === "found") hint = <>QR code {num} revealed!</>;
  else if (phase === "ready") hint = "Tap the QR code to collect it";
  else if (phase === "collecting") hint = <>Collecting QR code {num}…</>;
  else if (phase === "done") hint = none || allFound ? null : `You've found all ${stations.length} QR codes!`;

  const camMessage = cam && xr !== "on" ? CAM_MESSAGE[cam] : undefined;
  // Qufoo sniffs while you search (you hear him sniff), and speaks up once a code is near
  const qufooSays: Line | null =
    phase === "searching"
      ? near
        ? { text: "Sniff sniff… I smell a QR code! It's close, hold steady.", say: "I smell a QR code! It's close, hold steady." }
        : gps && anyIn && recently
          ? { text: "Sniff sniff… a QR code is around here! Look around." }
          : null
      : phase === "found"
        ? { text: "There it is!" }
        : phase === "ready"
          ? { text: "Tap it to collect it!" }
          : phase === "collecting"
            ? { text: "Got it! Good job!", wait: COLLECT_HIT_MS } // after the collect sound's hit
            : phase === "done" && !none && !allFound
              ? { text: `You found all ${stations.length}! Amazing!` }
              : null;
  // The arrow on the meter: which way the code is, from where the camera faces. In range there's no
  // arrow: the code is around the player in the view now (GPS is too rough up close to point at it).
  const turn = aim && !aimIn && compass !== null ? ((aim.b - compass + 540) % 360) - 180 : null;
  const closeness = aim ? Math.min(1, Math.max(0, 1 - (aim.d - aim.s.radius) / (METER_FROM - aim.s.radius))) : 0;
  const showMeter = gps && phase === "searching" && Boolean(fix) && Boolean(aim);
  const noLocation =
    gps && phase === "searching" && !fix && loc.status !== "asking" && loc.status !== "off" && loc.status !== "on"
      ? NO_LOCATION[loc.status]
      : null;

  return (
    <div
      ref={rootRef}
      className={xr === "on" ? "scan is-xr" : cam === "on" ? "scan is-live" : "scan"}
      role="dialog"
      aria-modal="true"
      aria-label="AR scanner"
    >
      <video ref={videoRef} className="scan__video" playsInline muted autoPlay />
      <div ref={hostRef} className="scan__stage" />
      <div className="scan__shade" aria-hidden="true"></div>

      {none && <NoCodes boxed />}
      {allFound && <AllFoundCard found={found} onDex={onDex} onClose={onClose} />}

      {camMessage && (
        <div className="scan__nocam">
          <CameraOffIcon />
          <p>{camMessage}</p>
        </div>
      )}

      <div className="scan__top">
        <span className="scan__btns">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close scanner">
            <CloseIcon />
          </button>
          <SoundButton />
        </span>
        {fix && (testMode || weak) && (
          <span className={weak ? "chip chip--gps is-weak" : "chip chip--gps"}>
            {weak ? "Weak GPS" : "GPS"} ±{fix.accuracy} m
          </span>
        )}
        {testMode && !gps && <span className="chip chip--mode">Random spots</span>}
        <span className="chip chip--count">
          <i className="chip__px" aria-hidden="true"></i>
          {count}/{stations.length}
        </span>
      </div>

      {/* How far the chosen code is, and which way (GPS) */}
      {showMeter && aim && (
        <div className={aimIn ? "scan__meter is-in" : "scan__meter"} role="status" aria-live="polite">
          <span
            className={aimIn ? "scan__meter-dir is-here" : turn === null ? "scan__meter-dir is-unknown" : "scan__meter-dir"}
            style={{ "--turn": `${turn ?? 0}deg` } as CSSProperties}
            aria-hidden="true"
          >
            {aimIn ? (
              <i />
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M12 3l6.5 15.5L12 15l-6.5 3.5z" />
              </svg>
            )}
          </span>
          <span className="scan__meter-text">
            <b>
              #{pad2(aim.s.num)} · {aimIn ? "Here!" : howFar(aim.d)}
            </b>
            <small>
              {aimIn
                ? "Look around for it"
                : aimBlocked
                  ? "Something's in the way · find a way around"
                  : turn === null
                    ? `Shows within ${aim.s.radius} m`
                    : `Shows within ${aim.s.radius} m · follow the arrow`}
            </small>
          </span>
          <span className="scan__meter-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(closeness * 100)}%` }} />
          </span>
        </div>
      )}

      {help && (
        <div className="scan__radar" aria-hidden="true">
          <span className="scan__radar-cone"></span>
          {/* Only the code being looked for */}
          {help.blips
            .filter((b) => b.target)
            .map((b, i) => (
              <span key={i} className="scan__radar-blip" style={{ "--a": `${b.angle}rad` } as CSSProperties}></span>
            ))}
        </div>
      )}

      {phase === "searching" && (
        <div className="scanner scan__frame" aria-hidden="true">
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__corner"></span>
          <span className="scanner__beam"></span>
        </div>
      )}

      {sideTurn && (
        <span className={`scan__arrow scan__arrow--${sideTurn}`} aria-hidden="true">
          <ArrowRightIcon />
        </span>
      )}

      {/* What's happening (no location: over the scan frame; the hint: just below it) */}
      {noLocation && (
        <div className={loc.status === "lost" ? "scan__noloc is-lost" : "scan__noloc"} role="alert">
          <PinOffIcon />
          <b>{noLocation.title}</b>
          <p>{noLocation.text}</p>
          <div className="scan__locate">
            {loc.status !== "insecure" && (
              <button type="button" className="btn btn--primary btn--sm" onClick={retryLocation}>
                Try again
              </button>
            )}
            {testMode && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTryRandom(true)}>
                Use random spots instead
              </button>
            )}
          </div>
        </div>
      )}

      {hint !== null && !noLocation && (
        <p className="scan__hint" aria-live="polite">
          {hint}
        </p>
      )}

      <div className="scan__bottom">
        {xr === "offer" && (
          <>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => stageRef.current?.startXr()}>
              Start full AR
            </button>
            <p className="scan__tip">Walk around the QR codes: they stay in place as you move</p>
          </>
        )}
        {/* The tip and clue, centred, with Qufoo level with them at the right end */}
        <div className="scan__row">
          <div className="scan__words">
            {phase === "searching" && guide && !guide.sensors && <p className="scan__tip">Drag to look around</p>}
            {aimed && phase === "searching" && (
              <p className="scan__clue">
                <b>#{pad2(aimed.num)}</b> &ldquo;{aimed.clue}&rdquo;
              </p>
            )}
          </div>
          {/* No QR codes in the game: nothing for him to smell, so he stays away */}
          {!failed && !none && phase !== "loading" && <ScanQufoo say={qufooSays} />}
        </div>
        <div className="scan__codes" role="group" aria-label="Choose a QR code to look for">
          {stations.map((s, i) => {
            const got = Boolean(found[s.id]);
            const on = aimed === s;
            const locked = !got && !open.includes(s);
            const far = !got && !locked ? ways.find((w) => w.s === s) : undefined;
            return (
              <button
                key={s.id}
                type="button"
                className={`scan__code${on ? " is-on" : ""}${locked ? " is-locked" : ""}${inRange.has(s.id) ? " is-near" : ""}`}
                disabled={got || locked}
                aria-pressed={on}
                aria-label={
                  got
                    ? `QR code #${s.num}, found`
                    : locked
                      ? `QR code #${s.num}: do its extra task first`
                      : `Look for QR code #${s.num}${far ? `, ${howFar(far.d)} away` : ""}`
                }
                onClick={() => choose(s)}
              >
                <QrTile station={s} state={got ? "found" : "locked"} size="sm" i={i} />
                <span className="scan__code-num">{pad2(s.num)}</span>
                {far && <span className="scan__code-far">{inRange.has(s.id) ? "here" : howFar(far.d)}</span>}
                {locked && (
                  <span className="scan__code-lock" aria-hidden="true">
                    <LockIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
