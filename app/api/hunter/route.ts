/**
 * Hunters: joining, renaming, meeting and listing who they've met (networking), the codes they
 * collect and the prizes they've won (the prize desk). Passed to the admin's database functions
 * (supabase/migrations/…_networking.sql and …_prize_desk.sql in INNEV8-AR-ADMIN), which check each
 * phone's secret; the public key itself can't read or write any hunter data.
 *
 * The phone's hunter is also kept in a cookie (only this route gets it, page scripts can't read it),
 * so clearing the game's storage doesn't make a new hunter: "remembered" hands it back. "remember"
 * keeps the one the phone has (each time the game opens: hunters from before the cookie, and a year
 * more); joining keeps the new one; one the organisers deleted is forgotten.
 */
const CALLS = {
  join: { fn: "hunter_join", args: ["name", "province"] },
  update: { fn: "hunter_update", args: ["id", "secret", "name", "province"] },
  meet: { fn: "hunter_meet", args: ["id", "secret", "tag", "pin"] },
  meetings: { fn: "hunter_meetings", args: ["id", "secret"] },
  find: { fn: "hunter_find", args: ["id", "secret", "code", "lat", "lng", "accuracy"] },
  prizes: { fn: "hunter_prizes", args: ["id", "secret"] },
} as const;
/** Where the phone was: a number, or null (no location) */
const NUMBERS = new Set(["lat", "lng", "accuracy"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const answer = (body: unknown, status = 200, cookie?: string) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...(cookie && { "set-cookie": cookie }) } });

// ---- The hunter kept in a cookie
type Kept = { id: string; tag: string; secret: string };
const COOKIE = "i8ar-hunter";
/** 400 days: as long as browsers keep a cookie */
const KEEP_S = 400 * 86400;
const isKept = (v: unknown): v is Kept => {
  const h = v as Kept | null;
  return (
    !!h &&
    typeof h.id === "string" &&
    UUID.test(h.id) &&
    typeof h.tag === "string" &&
    /^[A-Z0-9]{5}$/.test(h.tag) &&
    typeof h.secret === "string" &&
    h.secret.length > 0 &&
    h.secret.length <= 100
  );
};
function keptIn(req: Request): Kept | null {
  const raw = req.headers.get("cookie")?.match(/(?:^|;\s*)i8ar-hunter=([A-Za-z0-9_-]+)/)?.[1];
  if (!raw) return null;
  try {
    const h: unknown = JSON.parse(Buffer.from(raw, "base64url").toString());
    return isKept(h) ? { id: h.id, tag: h.tag, secret: h.secret } : null;
  } catch {
    return null;
  }
}
/** The Set-Cookie keeping this hunter (null: forgetting it). Secure on https (not over the local network). */
function keep(req: Request, h: Kept | null) {
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const value = h ? Buffer.from(JSON.stringify({ id: h.id, tag: h.tag, secret: h.secret })).toString("base64url") : "";
  return `${COOKIE}=${value}; Path=/api/hunter; Max-Age=${h ? KEEP_S : 0}; HttpOnly; SameSite=Strict${https ? "; Secure" : ""}`;
}

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return answer({ error: "offline" }, 503);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return answer({ error: "bad" }, 400);
  }
  if (body.action === "remembered") {
    const h = keptIn(req);
    return answer(h ?? { error: "none" });
  }
  if (body.action === "remember") {
    const h = { id: body.id, tag: body.tag, secret: body.secret };
    return isKept(h) ? answer({ ok: true }, 200, keep(req, h)) : answer({ error: "bad" }, 400);
  }
  const call = CALLS[body.action as keyof typeof CALLS];
  if (!call) return answer({ error: "bad" }, 400);
  const args: Record<string, string | number | null> = {};
  for (const a of call.args) {
    const v = body[a];
    if (NUMBERS.has(a)) {
      if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) return answer({ error: "bad" }, 400);
    } else if (
      typeof v !== "string" ||
      v.length > 100 ||
      (a === "id" && !UUID.test(v)) ||
      (a === "code" && !/^[a-z0-9]{2,16}$/.test(v))
    )
      return answer({ error: "bad" }, 400);
    args[`p_${a}`] = v as string | number | null;
  }
  // The legacy anon key (a JWT) also goes as the bearer token; a new publishable key only as the apikey
  const auth: Record<string, string> = key.startsWith("eyJ") ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${call.fn}`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`${call.fn}: ${res.status}`, await res.text());
      return answer({ error: "server" }, 502);
    }
    const out: unknown = await res.json();
    // A new hunter: kept. One the database doesn't know (the organisers deleted it): forgotten.
    if (body.action === "join" && isKept(out)) return answer(out, 200, keep(req, out));
    const unknown = !!out && typeof out === "object" && (out as { error?: unknown }).error === "unknown";
    if (unknown && keptIn(req)?.id === args.p_id) return answer(out, 200, keep(req, null));
    return answer(out);
  } catch (e) {
    console.error(`${call.fn}:`, e);
    return answer({ error: "offline" }, 503);
  }
}
