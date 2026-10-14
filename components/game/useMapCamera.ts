"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "@/lib/dom";

export const MIN_ZOOM = 0.8; // zoom-out limit: a little wider than the default framing, no further
export const MAX_ZOOM = 3;
const STEP = 1.5; // per +/− button press
const DRAG_PX = 6; // movement before a press counts as a drag (and not a tap on a beacon)

export type Camera = { z: number; x: number; y: number };
const HOME: Camera = { z: 1, x: 0, y: 0 };

/** Zoom by `k` keeping the point (px, py), relative to the box centre, fixed on screen. */
function zoomAt(c: Camera, k: number, px: number, py: number): Camera {
  const z = clamp(c.z * k, MIN_ZOOM, MAX_ZOOM);
  const r = z / c.z;
  return { z, x: px - (px - c.x) * r, y: py - (py - c.y) * r };
}

/** Keep the zoomed content covering the box: no panning at or below 1×, bounded panning above. */
function bound(c: Camera, w: number, h: number): Camera {
  const z = clamp(c.z, MIN_ZOOM, MAX_ZOOM);
  const mx = Math.max(0, ((z - 1) * w) / 2);
  const my = Math.max(0, ((z - 1) * h) / 2);
  return { z, x: clamp(c.x, -mx, mx), y: clamp(c.y, -my, my) };
}

export const cameraTransform = (c: Camera) => `translate(${c.x}px, ${c.y}px) scale(${c.z})`;

/**
 * Pinch / wheel zoom and drag-to-pan for the venue map. During a gesture the transform is written
 * straight to the layer (no re-render per frame); React state is synced when the gesture ends.
 */
export function useMapCamera() {
  const boxRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Camera>(HOME);
  const [cam, setCam] = useState<Camera>(HOME);
  const [gesturing, setGesturing] = useState(false);

  const commit = useCallback((c: Camera) => {
    camRef.current = c;
    setCam(c);
  }, []);

  const zoomBy = useCallback(
    (k: number) => {
      const r = boxRef.current?.getBoundingClientRect();
      commit(bound(zoomAt(camRef.current, k, 0, 0), r?.width ?? 0, r?.height ?? 0));
    },
    [commit],
  );
  const zoomIn = useCallback(() => zoomBy(STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / STEP), [zoomBy]);
  const reset = useCallback(() => commit(HOME), [commit]);

  useEffect(() => {
    const box = boxRef.current!;
    const pts = new Map<number, { x: number; y: number }>();
    let start: { cam: Camera; mid: { x: number; y: number }; dist: number } | null = null;
    let dragging = false;
    let suppressClick = false;

    const live = (c: Camera) => {
      camRef.current = c;
      if (layerRef.current) layerRef.current.style.transform = cameraTransform(c);
    };
    const centre = () => {
      const r = box.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
    };
    const measure = () => {
      const list = [...pts.values()];
      if (list.length >= 2) {
        const [a, b] = list;
        return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
      }
      return { mid: list[0], dist: 0 };
    };
    const restart = () => {
      start = pts.size ? { cam: camRef.current, ...measure() } : null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as Element).closest(".v3d__zoom")) return; // the +/−/reset buttons
      if (pts.size === 0) {
        dragging = false;
        suppressClick = false;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      restart();
    };

    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId) || !start) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const { mid, dist } = measure();
      const dx = mid.x - start.mid.x;
      const dy = mid.y - start.mid.y;
      if (!dragging) {
        if (pts.size < 2 && Math.hypot(dx, dy) < DRAG_PX) return;
        dragging = true;
        suppressClick = true;
        setGesturing(true);
        for (const id of pts.keys()) box.setPointerCapture?.(id);
      }
      const { cx, cy, w, h } = centre();
      let next: Camera = { ...start.cam, x: start.cam.x + dx, y: start.cam.y + dy };
      if (pts.size >= 2 && start.dist > 0) {
        next = zoomAt(start.cam, dist / start.dist, start.mid.x - cx, start.mid.y - cy);
        next = { ...next, x: next.x + dx, y: next.y + dy };
      }
      live(bound(next, w, h));
    };

    const onUp = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size) {
        restart(); // one finger lifted mid-pinch: keep going from here
        return;
      }
      start = null;
      if (dragging) {
        dragging = false;
        setGesturing(false);
        setCam(camRef.current);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { cx, cy, w, h } = centre();
      commit(bound(zoomAt(camRef.current, Math.exp(-e.deltaY * 0.0015), e.clientX - cx, e.clientY - cy), w, h));
    };

    // A drag that started on a beacon must not also select it.
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    box.addEventListener("wheel", onWheel, { passive: false });
    box.addEventListener("click", onClickCapture, true);
    return () => {
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp);
      box.removeEventListener("pointercancel", onUp);
      box.removeEventListener("wheel", onWheel);
      box.removeEventListener("click", onClickCapture, true);
    };
  }, [commit]);

  return { boxRef, layerRef, cam, gesturing, zoomIn, zoomOut, reset };
}
