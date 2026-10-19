"use client";
/* eslint-disable @next/next/no-img-element -- the player's own selfie, from their camera */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { pad2 } from "@/lib/dom";
import { TASK_TEXT, type Station } from "@/lib/hunt";
import { joinHunter, loadMeetings, meetHunter, readBadge, savedHunter, savedMeetings, type Hunter, type Met } from "@/lib/hunter";
import { progress, useProgress } from "@/lib/store";
import { HunterQr } from "./HunterQr";
import { CameraIcon, CheckIcon, CloseIcon, KeyboardIcon, ScanIcon, UsersIcon } from "./icons";
import { QrReader } from "./QrReader";

type Mode = "menu" | "scan" | "show" | "type";

const WHY: Record<string, string> = {
  nomatch: "That code didn't match. Their PIN changes every minute: scan again, or ask for the new one.",
  self: "That's your own hunter QR. Scan someone else's!",
  wait: "Too many tries that didn't match. Wait a few minutes, then try again.",
  offline: "No signal. Meeting someone needs the internet for a moment: try again when you're online.",
  unknown: "Your hunter ID isn't recognised. Close and reopen the game, then try again.",
  server: "Something went wrong on our side. Try again in a moment.",
  bad: "That doesn't look like a hunter code.",
  denied: "Camera access is blocked. Allow it in your browser's settings, or type their code instead.",
  unavailable: "No camera here. Type their code instead.",
};

/**
 * A QR code's extra task (networking), done before it can be found. Meeting tasks: scan the other
 * hunter's QR, show them yours, or type their code; or pick someone already met who still counts (not
 * used for another code; from another province, if that's the task). Selfie: take one, on trust.
 */
export function TaskSheet({ station, onClose, onFind }: { station: Station; onClose: () => void; onFind: (s: Station) => void }) {
  const p = useProgress();
  const [me, setMe] = useState<Hunter | null>(savedHunter);
  const [met, setMet] = useState<Met[]>(savedMeetings);
  const [mode, setMode] = useState<Mode>("menu");
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const done = Boolean(p.tasks?.[station.id]);
  const meeting = station.task === "any" || station.task === "province";

  // Who's already done another code's task (each hunter counts once)
  const used = new Map(Object.entries(p.tasks ?? {}).map(([code, t]) => [t.with, code]));
  const why = (h: { id: string; province: string }) =>
    used.has(h.id) && used.get(h.id) !== station.id
      ? "Already used for another code"
      : station.task === "province" && h.province === p.province
        ? `Also from ${h.province}`
        : null;
  const counted = (h: { id: string; name: string; province: string }) => {
    progress.doTask(station.id, h.id);
    setMode("menu");
    setNote({ text: `You met ${h.name} from ${h.province}. Task done!`, good: true });
  };

  // This phone's hunter ID (made now if it hasn't one yet), and who they've met
  useEffect(() => {
    let alive = true;
    void joinHunter(p.name, p.province).then(async (h) => {
      if (!alive || !h) return;
      setMe(h);
      const list = await loadMeetings(h);
      if (alive) setMet(list);
    });
    return () => {
      alive = false;
    };
  }, [p.name, p.province]);

  // Showing their QR: watch for the other hunter's scan, and count it when it fits
  const latest = useRef({ met, why, counted });
  useEffect(() => {
    latest.current = { met, why, counted };
  });
  useEffect(() => {
    if (mode !== "show" || !me || done) return;
    const t = window.setInterval(async () => {
      const list = await loadMeetings(me);
      const known = new Set(latest.current.met.map((m) => m.id));
      setMet(list);
      const fresh = list.find((m) => !known.has(m.id) && !latest.current.why(m));
      if (fresh) latest.current.counted(fresh);
    }, 3000);
    return () => clearInterval(t);
  }, [mode, me, done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const meet = async (tag: string, pin: string) => {
    if (!me) return setNote({ text: WHY.offline });
    setBusy(true);
    setNote(null);
    const r = await meetHunter(me, tag, pin);
    setBusy(false);
    if ("error" in r) {
      setMode("menu");
      return setNote({ text: WHY[r.error] ?? WHY.server });
    }
    setMet((list) => (list.some((m) => m.id === r.hunter.id) ? list : [...list, { ...r.hunter, at: new Date().toISOString() }]));
    const not = why(r.hunter);
    if (not) {
      setMode("menu");
      return setNote({
        text:
          not === "Already used for another code"
            ? `You met ${r.hunter.name}, but they already counted for another code. Meet someone new for this one!`
            : `You met ${r.hunter.name}, but they're also from ${r.hunter.province}. Find a hunter from another province!`,
      });
    }
    counted(r.hunter);
  };

  const onType = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const badge = readBadge(String(new FormData(e.currentTarget).get("code") ?? ""));
    if (!badge) return setNote({ text: "Type their 5-letter tag and 4-digit PIN, like K7QPX 4831." });
    void meet(badge.tag, badge.pin);
  };

  const onSelfie = (file: File | undefined) => {
    if (!file) return;
    setSelfie(URL.createObjectURL(file));
    progress.doTask(station.id, `selfie:${Date.now()}`);
    setNote({ text: "Nice one! Task done.", good: true });
  };
  useEffect(() => () => void (selfie && URL.revokeObjectURL(selfie)), [selfie]);

  const fits = met.filter((m) => !why(m));
  const text = station.task === "none" ? "" : TASK_TEXT[station.task];

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-title">
      <div className={`catch catch--${station.rarity} tsheet`}>
        <button type="button" className="icon-btn tsheet__close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <p className="catch__eyebrow">Extra task · #{pad2(station.num)}</p>
        <h2 id="task-title">{done ? "Task done!" : "Before you can find it"}</h2>
        <p className="tsheet__task">{text}</p>

        {note && (
          <p className={note.good ? "tsheet__note is-good" : "tsheet__note"} role={note.good ? "status" : "alert"}>
            {note.good && <CheckIcon />}
            {note.text}
          </p>
        )}

        {done && selfie && <img className="tsheet__photo" src={selfie} alt="Your selfie" />}

        {done ? (
          <div className="catch__btns">
            {selfie && (
              <a className="btn btn--ghost" href={selfie} download={`innev8-selfie-${pad2(station.num)}.jpg`}>
                Save the photo
              </a>
            )}
            <button type="button" className="btn btn--primary" onClick={() => onFind(station)}>
              <ScanIcon />
              Find #{pad2(station.num)} now
            </button>
          </div>
        ) : station.task === "selfie" ? (
          <div className="catch__btns">
            <label className="btn btn--primary tsheet__file">
              <CameraIcon />
              Take the selfie
              <input type="file" accept="image/*" capture="user" onChange={(e) => onSelfie(e.target.files?.[0])} />
            </label>
            <p className="tsheet__small">Your photo stays on your phone: nobody else sees it.</p>
          </div>
        ) : meeting && mode === "scan" ? (
          <>
            <QrReader onRead={(tag, pin) => void meet(tag, pin)} onFail={(w) => (setMode("menu"), setNote({ text: WHY[w] }))} />
            <p className="tsheet__small">{busy ? "Checking…" : "Point the camera at their hunter QR (on their Me tab)."}</p>
            <button type="button" className="btn btn--ghost" onClick={() => setMode("menu")}>
              Back
            </button>
          </>
        ) : meeting && mode === "show" ? (
          <>
            {me ? <HunterQr hunter={me} name={p.name} /> : <p className="tsheet__small">{WHY.offline}</p>}
            <p className="tsheet__small">Let them scan this with their game. It counts for both of you.</p>
            <button type="button" className="btn btn--ghost" onClick={() => setMode("menu")}>
              Back
            </button>
          </>
        ) : meeting && mode === "type" ? (
          <form className="tsheet__type" onSubmit={onType}>
            <label>
              <span className="label">Their tag and PIN</span>
              <input name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="K7QPX 4831" maxLength={14} required autoFocus />
            </label>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "Checking…" : "Meet"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setMode("menu")}>
              Back
            </button>
          </form>
        ) : (
          <>
            <div className="catch__btns">
              <button type="button" className="btn btn--primary" onClick={() => (setNote(null), setMode("scan"))}>
                <ScanIcon />
                Scan their hunter QR
              </button>
              <div className="tsheet__pair">
                <button type="button" className="btn btn--ghost" onClick={() => (setNote(null), setMode("show"))}>
                  <UsersIcon />
                  Show mine
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => (setNote(null), setMode("type"))}>
                  <KeyboardIcon />
                  Type a code
                </button>
              </div>
            </div>
            {met.length > 0 && (
              <div className="tsheet__met">
                <p className="label">Hunters you&apos;ve met</p>
                <ul>
                  {met.map((m) => {
                    const not = why(m);
                    return (
                      <li key={m.id}>
                        <span>
                          <b>{m.name}</b>
                          <small>{not ?? m.province}</small>
                        </span>
                        {!not && (
                          <button type="button" className="btn btn--primary btn--sm" onClick={() => counted(m)}>
                            Use
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {!fits.length && <p className="tsheet__small">Nobody here counts for this code yet: meet someone new.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
