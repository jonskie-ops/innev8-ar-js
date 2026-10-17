import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Let other devices on the LAN (and this machine's own network URL) load dev scripts.
  // Without this, the page never hydrates there and the splash never closes.
  allowedDevOrigins: ["192.168.1.88"],
  // The service worker (public/sw.js): always checked for a newer one, never served stale
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
