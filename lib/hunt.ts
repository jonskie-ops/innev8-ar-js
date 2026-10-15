/**
 * The hunt's QR codes: a TEST SAMPLE of 8, all in and around the Annex A–B building at Leyte Academic
 * Center (Palo, Leyte). The building is real (lib/venue.ts); the spots, names and clues are
 * PLACEHOLDERS until the event floor plan is final. Map coordinates are in the VenueMap's 360×520
 * plan units (x right, y down). Numbered left to right, top to bottom on the map.
 */

export type Rarity = "common" | "rare" | "legendary";

export type Zone = {
  id: string;
  name: string;
  /** Where the zone's name tag stands on the map. */
  label: { x: number; y: number };
};

export const ZONES: Zone[] = [
  { id: "annex", name: "Annex A", label: { x: 190, y: 206 } },
  { id: "annexb", name: "Annex B", label: { x: 252, y: 167 } },
  { id: "court", name: "Courtyard", label: { x: 158, y: 268 } },
];

export type Station = {
  id: string;
  /** The code's value: seeds its 3D pattern, and opens it straight ahead as a `/?s=<code>` link. */
  code: string;
  num: number;
  name: string;
  zone: string;
  spot: string;
  rarity: Rarity;
  clue: string;
  blurb: string;
  /** Position on the venue map. */
  x: number;
  y: number;
};

export const STATIONS: Station[] = [
  {
    id: "px01",
    code: "I8AR-01-M2VD",
    num: 1,
    name: "Partner Booths",
    zone: "annex",
    spot: "Partner booths",
    rarity: "common",
    clue: "Where industry meets the region. Look among the partners.",
    blurb: "Meet the companies bridging industries across Eastern Visayas.",
    x: 80,
    y: 90,
  },
  {
    id: "px02",
    code: "I8AR-02-B7XQ",
    num: 2,
    name: "Registration",
    zone: "annex",
    spot: "Registration desk",
    rarity: "common",
    clue: "Look where attendees pick up their IDs.",
    blurb: "Where attendees pick up their IDs and summit kits.",
    x: 160,
    y: 100,
  },
  {
    id: "px03",
    code: "I8AR-03-R4CF",
    num: 3,
    name: "Capstone Rooms",
    zone: "annexb",
    spot: "Capstone rooms",
    rarity: "common",
    clue: "Students defend their best work here.",
    blurb: "Student teams present their best capstone projects in these rooms.",
    x: 236,
    y: 90,
  },
  {
    id: "px04",
    code: "I8AR-04-H6WN",
    num: 4,
    name: "Tech Showcase",
    zone: "annex",
    spot: "Tech showcase",
    rarity: "rare",
    clue: "Gadgets on display, and one of them blinks back.",
    blurb: "Gadgets, robots and live demos from across the region.",
    x: 96,
    y: 176,
  },
  {
    id: "px05",
    code: "I8AR-05-ZV2L",
    num: 5,
    name: "Hall of Icons",
    zone: "annex",
    spot: "Hall of Icons",
    rarity: "legendary",
    clue: "Stand where the region's icons are honored.",
    blurb: "The gold code, hidden where Eastern Visayas' tech trailblazers are honored.",
    x: 150,
    y: 176,
  },
  {
    id: "px06",
    code: "I8AR-06-P8JS",
    num: 6,
    name: "Games Area",
    zone: "annexb",
    spot: "Games area",
    rarity: "common",
    clue: "Press start to play.",
    blurb: "Interactive displays and games. Press start.",
    x: 216,
    y: 178,
  },
  {
    id: "px07",
    code: "I8AR-07-K3MD",
    num: 7,
    name: "Digital Marketing",
    zone: "court",
    spot: "Digital marketing booth",
    rarity: "common",
    clue: "Follow, like and share. It lives where brands go viral.",
    blurb: "Brands go viral here. Tag #RICTS2026 when you share your find.",
    x: 96,
    y: 228,
  },
  {
    id: "px08",
    code: "I8AR-08-T7GA",
    num: 8,
    name: "Photo Wall",
    zone: "court",
    spot: "Photo wall",
    rarity: "rare",
    clue: "Smile! This one hides where everyone takes their picture.",
    blurb: "Strike a pose. Every hunter needs a summit selfie.",
    x: 220,
    y: 228,
  },
];

export const TOTAL = STATIONS.length;

export const POINTS: Record<Rarity, number> = { common: 100, rare: 250, legendary: 500 };
export const RARITY_LABEL: Record<Rarity, string> = { common: "Common", rare: "Rare", legendary: "Legendary" };

export const zoneName = (id: string) => ZONES.find((z) => z.id === id)?.name ?? id;

/** Accepts a raw marker code or a deep-link URL carrying `?s=<code>`. */
export function stationFromPayload(payload: string): Station | undefined {
  let code = payload.trim();
  try {
    const s = new URL(code).searchParams.get("s");
    if (s) code = s;
  } catch {}
  code = code.toUpperCase();
  return STATIONS.find((s) => s.code === code);
}

export function scoreOf(found: Record<string, number>) {
  return STATIONS.reduce((sum, s) => (found[s.id] ? sum + POINTS[s.rarity] : sum), 0);
}

/** Level 1 at 0 points, +1 every 300. */
export const levelOf = (points: number) => 1 + Math.floor(points / 300);
