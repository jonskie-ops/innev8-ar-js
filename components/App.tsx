"use client";

import { TEST_MODE } from "@/lib/site";
import { AppUpdate } from "./AppUpdate";
import { useEventPhase } from "./Countdown";
import { CountdownSection } from "./CountdownSection";
import { Game } from "./game/Game";
import { Mascot } from "./Mascot";

/**
 * What shows after the splash. Production: "The countdown is on." until the summit starts, then
 * the hunt. Test mode: the hunt right away, with the countdown moved to the side. Either way the
 * mascot comes up to say hello once the splash has cleared. On top: "a new version is ready".
 */
export function App() {
  const phase = useEventPhase(); // null until mounted; the splash covers that moment
  if (!phase) return null;
  const countdown = phase === "before" && !TEST_MODE;
  return (
    <>
      {countdown ? <CountdownSection /> : <Game phase={phase} />}
      <Mascot screen={countdown ? "countdown" : "game"} />
      <AppUpdate />
    </>
  );
}
