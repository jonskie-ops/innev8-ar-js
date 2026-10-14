"use client";

import { TEST_MODE } from "@/lib/site";
import { useEventPhase } from "./Countdown";
import { CountdownSection } from "./CountdownSection";
import { Game } from "./game/Game";

/**
 * What shows after the splash. Production: "The countdown is on." until the summit starts, then
 * the hunt. Test mode: the hunt right away, with the countdown moved to the side.
 */
export function App() {
  const phase = useEventPhase(); // null until mounted; the splash covers that moment
  if (!phase) return null;
  if (phase === "before" && !TEST_MODE) return <CountdownSection />;
  return <Game phase={phase} />;
}
