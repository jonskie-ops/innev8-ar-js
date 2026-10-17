"use client";

import { useEffect } from "react";
import { startApp, useAppUpdate } from "@/lib/pwa";

/** Starts the app's service worker, and offers a new version once one has come in. */
export function AppUpdate() {
  const ready = useAppUpdate();
  useEffect(() => startApp(), []);
  if (!ready) return null;
  return (
    <div className="appupdate" role="status">
      <span>A new version is ready</span>
      <button type="button" className="btn btn--primary btn--sm" onClick={() => location.reload()}>
        Update
      </button>
    </div>
  );
}
