"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { scoreOf, stationFromPayload, TOTAL, type Station } from "@/lib/hunt";
import { askMotion } from "@/lib/motion";
import { TEST_MODE } from "@/lib/site";
import { progress, useProgress } from "@/lib/store";
import { CountdownSection } from "../CountdownSection";
import type { Phase } from "../Countdown";
import { CatchCard } from "./CatchCard";
import { DexView } from "./DexView";
import { ClockIcon, CloseIcon, DexIcon, MapIcon, QuestIcon, ScanIcon, UserIcon } from "./icons";
import { MapView } from "./MapView";
import { MeView } from "./MeView";
import { MiniClock } from "./MiniClock";
import { Onboarding } from "./Onboarding";
import { PrizeCard } from "./PrizeCard";
import { QuestsView } from "./QuestsView";
import { ScanView } from "./ScanView";

type Tab = "map" | "dex" | "quests" | "me";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "map", label: "Map", icon: <MapIcon /> },
  { id: "dex", label: "Codes", icon: <DexIcon /> },
  { id: "quests", label: "Quests", icon: <QuestIcon /> },
  { id: "me", label: "Me", icon: <UserIcon /> },
];

function useToast() {
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const timer = useRef(0);
  const show = useCallback((msg: string) => {
    setToast({ msg, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [toast, show] as const;
}

/** The hunt: HUD, the four tabs, the scanner and the catch/prize/countdown overlays. */
export function Game({ phase }: { phase: Phase }) {
  const p = useProgress();
  const [tab, setTab] = useState<Tab>("map");
  const [focus, setFocus] = useState<string | null>(null);
  // The scanner, optionally looking for one chosen code
  const [scan, setScan] = useState<{ target?: Station } | null>(null);
  const [caught, setCaught] = useState<Station | null>(null);
  const [overlay, setOverlay] = useState<"countdown" | "prize" | null>(null);
  const [toast, showToast] = useToast();
  // A code opened from a link (/?s=<code>), waiting for onboarding.
  const [pending, setPending] = useState<Station | null>(null);

  // Sign-up needs both steps; older saves have a name but no province yet.
  const signedUp = p.onboarded && p.province !== "";
  const count = Object.keys(p.found).length;
  const points = scoreOf(p.found);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get("s");
    if (!code) return;
    history.replaceState(null, "", location.pathname);
    const station = stationFromPayload(code);
    if (station) setPending(station); // eslint-disable-line react-hooks/set-state-in-effect -- reads the URL once on mount
    else showToast("That link isn't an INNEV8 QR code.");
  }, [showToast]);

  useEffect(() => {
    if (!pending || !signedUp) return;
    if (p.found[pending.id]) showToast(`You already found QR code #${pending.num}.`);
    else setScan({ target: pending }); // eslint-disable-line react-hooks/set-state-in-effect -- opens the linked code's hunt once
    setPending(null);
  }, [pending, signedUp, p.found, showToast]);

  const closeScan = useCallback(() => setScan(null), []);
  // Opened by a tap, so iPhone can ask for the motion sensors the AR view turns with.
  const openScan = (target?: Station) => {
    askMotion();
    setScan({ target });
  };
  const onCatch = useCallback((station: Station) => {
    progress.collect(station.id);
    setScan(null);
    setCaught(station);
  }, []);

  if (!signedUp) return <Onboarding />;

  return (
    <div className="game">
      <header className="hud">
        <div className="hud__player">
          <span className="avatar" aria-hidden="true">
            {p.name.charAt(0).toUpperCase()}
          </span>
          <span className="hud__who">
            <strong>{p.name}</strong>
            <small>{points} pts</small>
          </span>
        </div>
        <div className="hud__chips">
          {phase === "before" && (
            <button
              type="button"
              className="chip chip--btn chip--clock"
              onClick={() => setOverlay("countdown")}
              aria-label="Open the countdown"
            >
              <ClockIcon />
              <MiniClock />
            </button>
          )}
          <span className="chip chip--count" aria-label={`${count} of ${TOTAL} QR codes found`}>
            <i className="chip__px" aria-hidden="true"></i>
            {count}/{TOTAL}
          </span>
        </div>
        {TEST_MODE && <span className="hud__test">Test mode</span>}
      </header>

      <div className={tab === "map" ? "game__body game__body--map" : "game__body"}>
        {tab === "map" && (
          <MapView found={p.found} focus={focus} onFocus={setFocus} onScan={openScan} />
        )}
        {tab === "dex" && (
          <DexView
            found={p.found}
            onFind={openScan}
            onShowOnMap={(id) => {
              setFocus(id);
              setTab("map");
            }}
            onPrize={() => setOverlay("prize")}
          />
        )}
        {tab === "quests" && <QuestsView found={p.found} />}
        {tab === "me" && (
          <MeView
            name={p.name}
            province={p.province}
            found={p.found}
            points={points}
            phase={phase}
            onCountdown={() => setOverlay("countdown")}
            onOpenCodes={() => setTab("dex")}
          />
        )}
      </div>

      <nav className="tabbar" aria-label="Game">
        <svg className="tabbar__hump" viewBox="0 0 150 42" aria-hidden="true">
          <path
            className="tabbar__hump-fill"
            d="M0 40.5C28 40.5 36 34 44 22C52 8 62 2 75 2C88 2 98 8 106 22C114 34 122 40.5 150 40.5V42H0Z"
          />
          <path
            className="tabbar__hump-line"
            d="M0 40.5C28 40.5 36 34 44 22C52 8 62 2 75 2C88 2 98 8 106 22C114 34 122 40.5 150 40.5"
          />
        </svg>
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.id} tab={t} active={tab === t.id} onSelect={setTab} />
        ))}
        <button type="button" className="tabbar__scan" onClick={() => openScan()}>
          <span className="tabbar__scan-ring" aria-hidden="true">
            <ScanIcon />
          </span>
          <span>Scan</span>
        </button>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.id} tab={t} active={tab === t.id} onSelect={setTab} />
        ))}
      </nav>

      {scan && <ScanView target={scan.target} found={p.found} onCatch={onCatch} onClose={closeScan} />}

      {caught && (
        <CatchCard
          station={caught}
          count={count}
          onClose={() => setCaught(null)}
          onDex={() => {
            setCaught(null);
            setTab("dex");
          }}
          onPrize={() => {
            setCaught(null);
            setOverlay("prize");
          }}
        />
      )}

      {overlay === "prize" && count === TOTAL && (
        <PrizeCard progress={p} points={points} onClose={() => setOverlay(null)} />
      )}

      {overlay === "countdown" && (
        <div className="countdown-overlay" role="dialog" aria-modal="true" aria-label="Countdown">
          <button
            type="button"
            className="icon-btn countdown-overlay__close"
            onClick={() => setOverlay(null)}
            aria-label="Close countdown"
          >
            <CloseIcon />
          </button>
          <CountdownSection />
        </div>
      )}

      {toast && (
        <p key={toast.id} className="toast" role="status">
          {toast.msg}
        </p>
      )}
    </div>
  );
}

function TabButton({
  tab,
  active,
  onSelect,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onSelect: (id: Tab) => void;
}) {
  return (
    <button
      type="button"
      className={active ? "tabbar__btn is-active" : "tabbar__btn"}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(tab.id)}
    >
      {tab.icon}
      <span>{tab.label}</span>
    </button>
  );
}
