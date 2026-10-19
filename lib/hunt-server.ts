import { cacheLife } from "next/cache";
import { TASKS, type Hunt, type Prize, type PrizeRule, type Rarity, type Station, type Task, type Zone } from "./hunt";
import { firstSponsor } from "./sponsors";

/**
 * The hunt as the organisers set it in the admin, read from its Supabase database with the public
 * key (SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, on the server only). The database's rules give that
 * key only what players may see: the codes and prizes that are on, the zones and the event settings.
 *
 * Kept for 30 seconds and refreshed in the background, so however many phones ask, the database is
 * asked about twice a minute. Null when the admin isn't set up here or can't be reached (the phones
 * then keep what they have).
 */
export async function loadHunt(): Promise<{ hunt: Hunt | null; at: string }> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });
  const at = new Date().toISOString();
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { hunt: null, at };
  // The legacy anon key (a JWT) also goes as the bearer token; a new publishable key (sb_publishable_…)
  // goes only as the apikey, as Supabase asks
  const headers: Record<string, string> = key.startsWith("eyJ") ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key };
  try {
    const get = async <T,>(path: string): Promise<T[]> => {
      const res = await fetch(`${url}/rest/v1/${path}`, { headers });
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      return res.json();
    };
    const [codes, zones, prizes, settings] = await Promise.all([
      // Every column: a database without the networking or sponsors update yet simply has no task or sponsor
      get<CodeRow>("codes?select=*&live=eq.true&order=num"),
      get<ZoneRow>("zones?select=id,name,label_x,label_y&order=sort,name"),
      get<PrizeRow>("prizes?select=id,name,description,photo_path,rule,rule_value&live=eq.true&order=sort,created_at"),
      get<SettingsRow>("settings?select=starts_at,ends_at,test_mode,claim_place&limit=1"),
    ]);
    const s = settings[0];
    if (!s) throw new Error("no settings");
    return {
      at,
      hunt: {
        stations: codes.map(
          (c): Station => ({
            id: c.id,
            code: c.code.toUpperCase(),
            num: c.num,
            name: c.name,
            zone: c.zone_id,
            spot: c.spot,
            rarity: c.rarity,
            points: c.points,
            task: TASKS.includes(c.task as Task) ? (c.task as Task) : "none",
            // A database without sponsors yet: each code's first sponsor, as the update would start it
            sponsor: c.sponsor ?? firstSponsor(c.num),
            clue: c.clue,
            blurb: c.blurb,
            x: Number(c.x),
            y: Number(c.y),
          }),
        ),
        zones: zones.map(
          (z): Zone => ({
            id: z.id,
            name: z.name,
            label: z.label_x === null || z.label_y === null ? null : { x: Number(z.label_x), y: Number(z.label_y) },
          }),
        ),
        prizes: prizes.map(
          (p): Prize => ({
            id: p.id,
            name: p.name,
            description: p.description,
            photo: p.photo_path ? `${url}/storage/v1/object/public/prizes/${encodeURI(p.photo_path)}` : null,
            rule: p.rule,
            value: p.rule_value,
          }),
        ),
        settings: {
          start: new Date(s.starts_at).getTime(),
          end: new Date(s.ends_at).getTime(),
          testMode: s.test_mode,
          claimPlace: s.claim_place,
        },
      },
    };
  } catch (e) {
    console.error("The hunt couldn't be read from the admin:", e);
    return { hunt: null, at };
  }
}

type CodeRow = {
  id: string;
  code: string;
  num: number;
  name: string;
  zone_id: string;
  spot: string;
  rarity: Rarity;
  points: number;
  clue: string;
  blurb: string;
  x: number | string;
  y: number | string;
  task?: string;
  sponsor?: string;
};
type ZoneRow = { id: string; name: string; label_x: number | string | null; label_y: number | string | null };
type PrizeRow = {
  id: string;
  name: string;
  description: string;
  photo_path: string | null;
  rule: PrizeRule;
  rule_value: number | null;
};
type SettingsRow = { starts_at: string; ends_at: string; test_mode: boolean; claim_place: string };
