// The app's service worker: keeps the game on the phone so it opens and plays on weak or no signal
// (registered by lib/pwa.ts, in production builds only).
//
// - The page itself: from the network when it answers within NAV_WAIT_MS, else the saved copy (the
//   network's answer is still saved for next time, and if it's a new version the page is told, so
//   it can offer to update).
// - The app's code (/_next/static/, names change with every build): saved the first time it's used.
// - Pictures, fonts, sprites and voice clips (/assets/): the saved copy, refreshed in the background
//   (so a re-recorded clip comes through). Audio is answered in the byte ranges the player asks for.
// - "warm" messages from the page list everything it uses, to save up front.

const CACHE = "i8ar-v1";
const NAV_WAIT_MS = 3500;

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/")));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;
  if (req.mode === "navigate") e.respondWith(page(e));
  else if (url.pathname.startsWith("/_next/static/")) e.respondWith(code(req));
  else if (url.pathname.startsWith("/assets/")) e.respondWith(asset(e, req, url));
  else e.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || Response.error())));
});

/** The page: network first (briefly), else the saved copy. */
async function page(e) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match("/");
  const net = fetch(e.request).then(async (res) => {
    if (res.ok) await cache.put("/", res.clone());
    return res;
  });
  if (!saved) return net;
  const before = saved.clone(); // (the saved copy itself goes to the page)
  const quick = await Promise.race([net.catch(() => null), new Promise((r) => setTimeout(() => r(null), NAV_WAIT_MS))]);
  if (quick && quick.ok) return quick;
  // Served the saved copy: if the network brings a different page later, it's a new version
  e.waitUntil(
    net
      .then(async (res) => {
        if (!res.ok) return;
        const [a, b] = await Promise.all([res.clone().text(), before.text()]);
        if (a !== b) for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ type: "update" });
      })
      .catch(() => {}),
  );
  return saved;
}

/** The app's code: saved once, forever (a new build has new names). */
async function code(req) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(req);
  if (saved) return saved;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

/** Pictures, fonts, sprites, clips: the saved copy (refreshed in the background), else the network. */
async function asset(e, req, url) {
  const cache = await caches.open(CACHE);
  const key = url.origin + url.pathname;
  const saved = await cache.match(key);
  // Fetched whole (not the byte range a player asks for), so it can be saved and sliced
  const fresh = fetch(key).then(async (res) => {
    if (res.ok && res.status === 200) await cache.put(key, res.clone());
    return res;
  });
  if (saved) {
    e.waitUntil(fresh.catch(() => {}));
    return ranged(req, saved);
  }
  return ranged(req, await fresh);
}

/** Answers a "Range: bytes=…" request (how phones load audio) from a whole saved file. */
async function ranged(req, res) {
  const range = req.headers.get("range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || res.status !== 200) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

// The page lists what it uses: save what isn't saved yet
self.addEventListener("message", (e) => {
  if (e.data?.type !== "warm" || !Array.isArray(e.data.urls)) return;
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const u of e.data.urls) {
        const url = new URL(u, self.location.origin);
        if (url.origin !== self.location.origin) continue;
        const key = url.pathname.startsWith("/_next/static/") ? url.href : url.origin + url.pathname;
        if (await cache.match(key)) continue;
        try {
          const res = await fetch(key);
          if (res.ok && res.status === 200) await cache.put(key, res);
        } catch {
          // offline: next time
        }
      }
    })(),
  );
});
