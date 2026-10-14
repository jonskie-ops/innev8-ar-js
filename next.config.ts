import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Let other devices on the LAN (and this machine's own network URL) load dev scripts.
  // Without this, the page never hydrates there and the splash never closes.
  allowedDevOrigins: ["192.168.1.88"],
};

export default nextConfig;
