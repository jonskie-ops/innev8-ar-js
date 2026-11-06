"use client";

import { setMuted, useMuted } from "@/lib/sound";
import { SoundIcon, SoundOffIcon } from "./icons";

/** Turns the game's sound (music, Qufoo, the collect sound) off or back on. */
export function SoundButton({ className = "icon-btn" }: { className?: string }) {
  const muted = useMuted();
  return (
    <button
      type="button"
      className={className}
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
    >
      {muted ? <SoundOffIcon /> : <SoundIcon />}
    </button>
  );
}
