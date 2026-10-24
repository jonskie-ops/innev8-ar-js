"use client";

import { useEffect, useState } from "react";

/**
 * Which way the player is facing, in degrees clockwise from north, for the cone on the map; null
 * while it isn't known (no compass, not allowed yet, or not settled).
 *
 * Held up, that's where the back camera looks; lying flat, where the top of the phone points. From
 * the same sensor readings the scanner uses: Android sends them measured from north
 * ("deviceorientationabsolute"); iPhone adds its compass to each "deviceorientation"
 * (webkitCompassHeading; −1 while it isn't calibrated), and only after asking (askMotion, in a tap).
 * Smoothed, as compasses wobble, and passed on a few times a second at most. Nothing leaves the phone.
 */
export function useHeading(on: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!on) return;
    let smooth: number | null = null;
    let shown: number | null = null;
    let at = 0;
    let absolute = false; // Android's north-based readings came: ignore the plain ones

    const take = (alphaNorth: number, beta: number, gamma: number) => {
      const raw = facing(alphaNorth, beta, gamma);
      // Smoothed the short way round (359° → 1° is 2°, not 358°)
      smooth = smooth === null ? raw : wrap(smooth + 0.3 * shortest(raw - smooth));
      const now = performance.now();
      if (now - at < 100) return;
      if (shown !== null && Math.abs(shortest(smooth - shown)) < 2) return;
      at = now;
      shown = smooth;
      setHeading(Math.round(smooth));
    };
    const onAbsolute = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      absolute = true;
      take(e.alpha, e.beta, e.gamma);
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (absolute || e.beta == null || e.gamma == null) return;
      const compass = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof compass !== "number" || compass < 0) return;
      take(360 - compass, e.beta, e.gamma); // as the scanner reads it
    };
    addEventListener("deviceorientationabsolute", onAbsolute as EventListener);
    addEventListener("deviceorientation", onOrient);
    return () => {
      removeEventListener("deviceorientationabsolute", onAbsolute as EventListener);
      removeEventListener("deviceorientation", onOrient);
      setHeading(null);
    };
  }, [on]);

  return on ? heading : null;
}

const wrap = (deg: number) => ((deg % 360) + 360) % 360;
const shortest = (deg: number) => ((deg + 540) % 360) - 180;

/**
 * The compass heading the phone faces, from its orientation angles (alpha measured from north): the
 * back camera's direction when the phone is held up, the top edge's when it lies flat (where the
 * camera points at the floor and says nothing about direction). From the rotation the angles
 * describe (W3C Device Orientation: Z, then X, then Y).
 */
function facing(alpha: number, beta: number, gamma: number): number {
  const r = Math.PI / 180;
  const [sA, cA, sB, cB, sG, cG] = [Math.sin(alpha * r), Math.cos(alpha * r), Math.sin(beta * r), Math.cos(beta * r), Math.sin(gamma * r), Math.cos(gamma * r)];
  // Out of the back of the phone, east and north parts
  const east = -cA * sG - sA * sB * cG;
  const north = -sA * sG + cA * sB * cG;
  // Held up by more than about 30°: that's where they're looking
  if (Math.hypot(east, north) > 0.5) return wrap(Math.atan2(east, north) / r);
  // Flat: where the top of the phone points
  return wrap(Math.atan2(-sA * cB, cA * cB) / r);
}
