import { cacheLife } from "next/cache";
import { DEFAULT_PLACE, planOf, type Place } from "./geo";
import { inOrder, RADIUS, TASKS, type Hunt, type Prize, type PrizeRule, type Rarity, type Station, type Task, type Zone } from "./hunt";
import { builtInBadge, firstSponsor, type Sponsor } from "./sponsors";

/** A number from a database row (Postgres numbers can arrive as strings), or null. */
const n = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

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
    const [codes, zones, prizes, settings, sponsors, places] = await Promise.all([
      // Every column: a database without the networking, sponsors or GPS update yet simply has no task,
      // sponsor or GPS spot (nor random spots, in the settings)
      get<CodeRow>("codes?select=*&live=eq.true&order=num"), // (then location by location, below)
      get<ZoneRow>("zones?select=id,name,label_x,label_y&order=sort,name"),
      // (every column: a database without the prize code update simply has no chosen code)
      get<PrizeRow>("prizes?select=*&live=eq.true&order=sort,created_at"),
      get<SettingsRow>("settings?select=*&limit=1"),
      // The organisers' sponsors: null before the sponsor logos update (no such table: the game's own then)
      get<SponsorRow>("sponsors?select=id,name,badge_path").catch((e: Error) => {
        if (/: 404$/.test(e.message)) return null;
        throw e;
      }),
      // The locations that are on (their codes are the only ones the database hands out): null
      // before the locations update, when every code is at Leyte Academic Center
      get<PlaceRow>("locations?select=id,name,address,lat,lng,width,outlines&live=eq.true&order=sort,created_at").catch((e: Error) => {
        if (/: 404$/.test(e.message)) return null;
        throw e;
      }),
    ]);
    const s = settings[0];
    if (!s) throw new Error("no settings");
    return {
      at,
      hunt: {
        stations: codes.map((c): Station => {
          // Its own GPS spot, or (none yet, or before the GPS update) where its map pin is
          const location = c.location_id ?? DEFAULT_PLACE;
          const place = places?.find((p) => p.id === location);
          const lat = n(c.lat);
          const lng = n(c.lng);
          const spot =
            lat !== null && lng !== null
              ? { lat, lng }
              : planOf(
                  place
                    ? { lat: Number(place.lat), lng: Number(place.lng), width: Number(place.width), hand: handDrawn(place) }
                    : { lat: 0, lng: 0, width: 1, hand: true },
                ).toLatLng(Number(c.x), Number(c.y));
          const radius = n(c.radius);
          return {
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
            location,
            clue: c.clue,
            blurb: c.blurb,
            x: Number(c.x),
            y: Number(c.y),
            ...spot,
            radius: radius !== null && radius > 0 ? radius : RADIUS,
          };
        }).sort(inOrder(places)),
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
            code: p.rule_code ?? null,
            text: p.rule_text ?? null,
          }),
        ),
        places:
          places?.map(
            (p): Place => ({
              id: p.id,
              name: p.name,
              address: p.address ?? "",
              lat: Number(p.lat),
              lng: Number(p.lng),
              width: Number(p.width),
              outlines:
                p.outlines && typeof p.outlines.buildings === "string"
                  ? { buildings: p.outlines.buildings, roads: p.outlines.roads ?? "", grounds: p.outlines.grounds ?? "" }
                  : null,
              hand: handDrawn(p),
            }),
          ) ?? null,
        sponsors: sponsors
          ?.map((r): Sponsor | null => {
            // Their badge, through the game's own address (kept on the phone like its other pictures);
            // still none of their own: the one that came with the game
            const badge = r.badge_path ? `/assets/sponsors/up/${encodeURIComponent(r.badge_path)}` : builtInBadge(r.id);
            return badge ? { id: r.id, name: r.name, badge } : null;
          })
          .filter((x) => x !== null)
          .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })) ?? null,
        settings: {
          start: new Date(s.starts_at).getTime(),
          end: new Date(s.ends_at).getTime(),
          testMode: s.test_mode,
          claimPlace: s.claim_place,
          randomSpots: s.random_spots === true,
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
  location_id?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  radius?: number | string;
};
type ZoneRow = { id: string; name: string; label_x: number | string | null; label_y: number | string | null };
type PrizeRow = {
  id: string;
  name: string;
  description: string;
  photo_path: string | null;
  rule: PrizeRule;
  rule_value: number | null;
  rule_code?: string | null;
  rule_text?: string | null;
};
/** Leyte Academic Center still on its hand-drawn plan (its map not drawn from OpenStreetMap yet) */
const handDrawn = (p: PlaceRow) => p.id === DEFAULT_PLACE && p.outlines === null;

type PlaceRow = {
  id: string;
  name: string;
  address?: string;
  lat: number | string;
  lng: number | string;
  width: number | string;
  outlines: { buildings?: string; roads?: string; grounds?: string } | null;
};
type SponsorRow = { id: string; name: string; badge_path: string | null };
type SettingsRow = { starts_at: string; ends_at: string; test_mode: boolean; claim_place: string; random_spots?: boolean };
