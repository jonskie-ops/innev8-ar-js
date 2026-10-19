/**
 * The hunt: its QR codes, zones, prizes and the event's dates and test mode. The organisers set them
 * in the admin (INNEV8-AR-ADMIN), and the game reads them through /api/hunt (lib/huntStore.ts keeps
 * the latest copy on the phone).
 *
 * BUILT_IN below is the hunt as it was before the admin: a TEST SAMPLE of 8 codes in and around the
 * Annex A–B building at Leyte Academic Center (Palo, Leyte). It's used only until a phone has heard
 * from the admin once (first open with no signal, or the admin not set up). Map coordinates are in
 * the VenueMap's 360×520 plan units (x right, y down).
 */

import { EVENT_END, EVENT_START, TEST_MODE } from "./site";

export type Rarity = "common" | "rare" | "legendary";

export type Zone = {
  id: string;
  name: string;
  /** Where the zone's name tag stands on the map (none: no tag, like the Courtyard). */
  label: { x: number; y: number } | null;
};

const BUILT_IN_ZONES: Zone[] = [
  { id: "annex", name: "Annex A", label: { x: 190, y: 206 } },
  { id: "annexb", name: "Annex B", label: { x: 252, y: 167 } },
  { id: "court", name: "Courtyard", label: null },
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
  /** What finding it is worth (set per code in the admin; by rarity unless changed). */
  points: number;
  /** An extra task to do before it can be found (networking), or none. */
  task: Task;
  clue: string;
  blurb: string;
  /** Position on the venue map. */
  x: number;
  y: number;
};

const BUILT_IN_STATIONS: Omit<Station, "points" | "task">[] = [
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

export const POINTS: Record<Rarity, number> = { common: 100, rare: 250, legendary: 500 };
export const RARITY_LABEL: Record<Rarity, string> = { common: "Common", rare: "Rare", legendary: "Legendary" };
export const RARITIES: Rarity[] = ["common", "rare", "legendary"];

/**
 * Networking: an extra task the organisers can give a code, done after reading its clue. Until it's
 * done the code stays locked. Meeting tasks need a hunter the player hasn't used for another code.
 */
export type Task = "none" | "any" | "province" | "selfie";
export const TASKS: Task[] = ["none", "any", "province", "selfie"];
export const TASK_TEXT: Record<Exclude<Task, "none">, string> = {
  any: "Meet another hunter: scan their hunter QR, or let them scan yours.",
  province: "Meet a hunter from another province: scan their hunter QR, or let them scan yours.",
  selfie: "Take a selfie with another hunter.",
};
/** Can this code be looked for yet? (No task, or its task is done.) */
export const unlocked = (s: Station, tasks: Record<string, unknown> | undefined) => s.task === "none" || Boolean(tasks?.[s.id]);

/** Who wins a prize: every code, a number of codes, the legendary code, or a number of points. */
export type PrizeRule = "all" | "count" | "legendary" | "points";
export type Prize = {
  id: string;
  name: string;
  description: string;
  /** Its photo's address, if it has one. */
  photo: string | null;
  rule: PrizeRule;
  /** The number of codes or points, for "count" and "points". */
  value: number | null;
};

export type Settings = {
  /** When the hunt opens and closes (ms since epoch). */
  start: number;
  end: number;
  /** On: anyone can play before the event, and the scanner shows its test tools. */
  testMode: boolean;
  /** Where winners show their prize card ("the INNEV8 help desk"). */
  claimPlace: string;
};

/** The hunt as the game plays it: the codes that are on, sorted by number. */
export type Hunt = { stations: Station[]; zones: Zone[]; prizes: Prize[]; settings: Settings };

export const BUILT_IN: Hunt = {
  stations: BUILT_IN_STATIONS.map((s) => ({ ...s, points: POINTS[s.rarity], task: "none" as const })),
  zones: BUILT_IN_ZONES,
  prizes: [],
  settings: { start: EVENT_START.getTime(), end: EVENT_END.getTime(), testMode: TEST_MODE, claimPlace: "INNEV8 help desk" },
};

export const zoneName = (hunt: Hunt, id: string) => hunt.zones.find((z) => z.id === id)?.name ?? id;

/** Accepts a raw marker code or a deep-link URL carrying `?s=<code>`: one of the codes that are on. */
export function stationFromPayload(hunt: Hunt, payload: string): Station | undefined {
  let code = payload.trim();
  try {
    const s = new URL(code).searchParams.get("s");
    if (s) code = s;
  } catch {}
  code = code.toUpperCase();
  return hunt.stations.find((s) => s.code === code);
}

/**
 * A player's standing. Codes an organiser has since turned off (or deleted) stay theirs: `kept`, from
 * `known` (every code this phone has seen), still counting toward points and prizes. `count`/`total`
 * are the codes that are on now.
 */
export function standing(hunt: Hunt, known: Record<string, Station>, found: Record<string, number>) {
  const on = new Set(hunt.stations.map((s) => s.id));
  const live = hunt.stations.filter((s) => found[s.id]);
  const kept = Object.keys(found)
    .filter((id) => !on.has(id) && known[id])
    .map((id) => known[id])
    .sort((a, b) => a.num - b.num);
  const mine = [...live, ...kept];
  return {
    count: live.length,
    total: hunt.stations.length,
    kept,
    /** Every code they've found that's still known, on or not */
    finds: mine.length,
    score: mine.reduce((sum, s) => sum + s.points, 0),
    legendary: mine.some((s) => s.rarity === "legendary"),
  };
}
export type Standing = ReturnType<typeof standing>;

/** "Collect all 8 QR codes", "Reach 1,000 points"… */
export function ruleText(p: Prize, total: number) {
  const v = p.value ?? 0;
  switch (p.rule) {
    case "all":
      return `Collect all ${total} QR codes`;
    case "count":
      return `Collect ${v} QR code${v === 1 ? "" : "s"}`;
    case "legendary":
      return "Find the legendary gold code";
    case "points":
      return `Reach ${v.toLocaleString("en-PH")} points`;
  }
}

/** How far a player is toward a prize (0 to 1), and whether they've won it. */
export function prizeProgress(p: Prize, s: Standing) {
  const v = Math.max(1, p.value ?? 1);
  const part =
    p.rule === "all"
      ? s.total
        ? s.count / s.total
        : 0
      : p.rule === "count"
        ? s.finds / v
        : p.rule === "legendary"
          ? s.legendary
            ? 1
            : 0
          : s.score / v;
  const won = p.rule === "all" ? s.total > 0 && s.count >= s.total : part >= 1;
  return { part: Math.min(1, part), won };
}

/** Level 1 at 0 points, +1 every 300. */
export const levelOf = (points: number) => 1 + Math.floor(points / 300);
