import badges from "./sponsors.json";

/** A QR code's sponsor: their logo shows in a circle on the code's top-right corner. */
export type Sponsor = { id: string; name: string; badge: string };

// How each name is written (else it's made from the id)
const NAMES: Record<string, string> = {
  converge: "Converge",
  dost: "DOST",
  gcash: "GCash",
  globe: "Globe",
  oppo: "OPPO",
  prodigy: "Prodigy",
  samsung: "Samsung",
  symphonics: "Symphonics",
};

/**
 * The sponsors that came with the game (added with scripts/sponsors.mjs), in order of their id:
 * until the organisers keep their own on the admin's Sponsors page (the hunt's `sponsors`).
 */
export const BUILT_IN_SPONSORS: Sponsor[] = Object.entries(badges as Record<string, string>).map(([id, badge]) => ({
  id,
  name: NAMES[id] ?? id.replace(/(^|-)([a-z])/g, (_, s: string, c: string) => (s ? " " : "") + c.toUpperCase()),
  badge,
}));

/** A built-in sponsor's badge, for the organisers' sponsors still on theirs. */
export const builtInBadge = (id: string) => (badges as Record<string, string>)[id] ?? null;

/** A code's sponsor among the hunt's (null: the ones that came with the game), or null (none). */
export const sponsorIn = (sponsors: Sponsor[] | null, id: string | undefined): Sponsor | null =>
  (sponsors ?? BUILT_IN_SPONSORS).find((s) => s.id === id) ?? null;

/**
 * Code #n's sponsor until the organisers choose one (an admin without sponsors yet): the nth, in
 * the same order the admin's database update starts them in.
 */
export const firstSponsor = (num: number) =>
  BUILT_IN_SPONSORS.length ? BUILT_IN_SPONSORS[(num - 1) % BUILT_IN_SPONSORS.length].id : "none";
