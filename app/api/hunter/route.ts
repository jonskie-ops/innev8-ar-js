/**
 * Networking: hunters joining, renaming, meeting and listing who they've met. Passed to the admin's
 * database functions (supabase/migrations/…_networking.sql in INNEV8-AR-ADMIN), which check each
 * phone's secret; the public key itself can't read or write any hunter data.
 */
const CALLS = {
  join: { fn: "hunter_join", args: ["name", "province"] },
  update: { fn: "hunter_update", args: ["id", "secret", "name", "province"] },
  meet: { fn: "hunter_meet", args: ["id", "secret", "tag", "pin"] },
  meetings: { fn: "hunter_meetings", args: ["id", "secret"] },
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const answer = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

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
  const call = CALLS[body.action as keyof typeof CALLS];
  if (!call) return answer({ error: "bad" }, 400);
  const args: Record<string, string> = {};
  for (const a of call.args) {
    const v = body[a];
    if (typeof v !== "string" || v.length > 100 || (a === "id" && !UUID.test(v))) return answer({ error: "bad" }, 400);
    args[`p_${a}`] = v;
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
    return answer(await res.json());
  } catch (e) {
    console.error(`${call.fn}:`, e);
    return answer({ error: "offline" }, 503);
  }
}
