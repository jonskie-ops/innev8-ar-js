"use client";

/**
 * The player as a hunter (networking): an ID from the admin's database, with a 5-letter tag and a
 * secret only this phone knows. Their hunter QR carries the tag and a PIN worked out from the secret
 * that changes every minute (the database works out the same, see …_networking.sql), so a screenshot
 * of someone's QR soon stops working. Meeting someone = scanning (or typing) their tag and PIN.
 */
export type Hunter = { id: string; tag: string; secret: string };
export type Met = { id: string; name: string; province: string; at: string };

const KEY = "i8ar-hunter-v1";
const MET_KEY = "i8ar-met-v1";

const load = <T,>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};

const call = async <T,>(action: string, args: Record<string, string>): Promise<T | { error: string }> => {
  try {
    const res = await fetch("/api/hunter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...args }),
    });
    return (await res.json()) as T | { error: string };
  } catch {
    return { error: "offline" };
  }
};

export const savedHunter = () => {
  const h = load<Hunter>(KEY);
  return h && typeof h.id === "string" && typeof h.tag === "string" && typeof h.secret === "string" ? h : null;
};

let joining: Promise<Hunter | null> | null = null;
/** This phone's hunter ID: the saved one, or a new one (online), or null (no signal yet). */
export function joinHunter(name: string, province: string): Promise<Hunter | null> {
  const have = savedHunter();
  if (have) return Promise.resolve(have);
  if (!name.trim() || !province) return Promise.resolve(null);
  joining ??= call<Hunter>("join", { name: name.trim().slice(0, 20), province }).then((r) => {
    joining = null;
    if ("error" in r) return null;
    save(KEY, r);
    return r;
  });
  return joining;
}

/** Name or province changed: the people they meet see the new ones. */
export function updateHunter(name: string, province: string) {
  const h = savedHunter();
  if (h) void call("update", { id: h.id, secret: h.secret, name: name.trim().slice(0, 20), province });
}

/** A fresh start (the profile deleted): a new hunter next time. */
export function forgetHunter() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(MET_KEY);
  } catch {}
}

/**
 * The database doesn't know this phone's hunter ID (the organisers deleted it): forget it, so the
 * game makes a new one the next time it opens (the codes found stay).
 */
function deletedHunter(r: unknown) {
  if (r && typeof r === "object" && "error" in r && r.error === "unknown") forgetHunter();
}

export const minuteNow = () => Math.floor(Date.now() / 60_000);

/** The PIN for a minute: the first 7 hex digits of sha256("<secret>:<minute>"), mod 10000. */
export async function pinFor(secret: string, minute = minuteNow()) {
  const hex = await sha256Hex(`${secret}:${minute}`);
  return String(parseInt(hex.slice(0, 7), 16) % 10000).padStart(4, "0");
}

/** What a hunter QR says. */
export const badgeText = (tag: string, pin: string) => `INNEV8-HUNTER:${tag}:${pin}`;

/** A scanned hunter QR, or a typed "ABCDE 1234": its tag and PIN (null: not a hunter QR). */
export function readBadge(text: string) {
  const qr = /INNEV8-HUNTER:([A-Z0-9]{5}):(\d{4})/i.exec(text);
  const typed = /^\s*([A-Z0-9]{5})[\s·:-]*(\d{4})\s*$/i.exec(text);
  const m = qr ?? typed;
  return m ? { tag: m[1].toUpperCase(), pin: m[2] } : null;
}

export type MeetResult =
  | { ok: true; again: boolean; hunter: { id: string; name: string; province: string } }
  | { error: "unknown" | "wait" | "self" | "nomatch" | "offline" | "server" | "bad" };

/** Meeting the hunter whose tag and PIN these are. */
export async function meetHunter(me: Hunter, tag: string, pin: string): Promise<MeetResult> {
  const r = await call<MeetResult>("meet", { id: me.id, secret: me.secret, tag, pin });
  deletedHunter(r);
  if ("ok" in r && r.ok) {
    const met = savedMeetings();
    if (!met.some((m) => m.id === r.hunter.id)) save(MET_KEY, [...met, { ...r.hunter, at: new Date().toISOString() }]);
  }
  return r as MeetResult;
}

export const savedMeetings = () => {
  const m = load<Met[]>(MET_KEY);
  return Array.isArray(m) ? m : [];
};

/** Everyone they've met, either of them scanning (kept for offline; the saved list without a signal). */
export async function loadMeetings(me: Hunter): Promise<Met[]> {
  const r = await call<Met[]>("meetings", { id: me.id, secret: me.secret });
  deletedHunter(r);
  if (!Array.isArray(r)) return savedMeetings();
  save(MET_KEY, r);
  return r;
}

/**
 * This phone's hunter ID and who they've met (see joinHunter and loadMeetings). One the organisers
 * deleted is replaced by a new one now.
 */
export async function myHunter(name: string, province: string): Promise<{ hunter: Hunter | null; met: Met[] }> {
  let hunter = await joinHunter(name, province);
  if (!hunter) return { hunter, met: savedMeetings() };
  let met = await loadMeetings(hunter);
  if (!savedHunter()) {
    hunter = await joinHunter(name, province);
    met = hunter ? await loadMeetings(hunter) : [];
  }
  return { hunter, met };
}

// ---- SHA-256: the browser's own where it can (https), else this (an http page on the local network)

async function sha256Hex(text: string) {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Js(bytes);
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Js(msg: Uint8Array) {
  const len = msg.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[len] = 0x80;
  const bits = len * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
  view.setUint32(padded.length - 4, bits >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}

/** For tests: the fallback, checked against the browser's own. */
export const _sha256Js = (text: string) => sha256Js(new TextEncoder().encode(text));
