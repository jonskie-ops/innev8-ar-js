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

/** Every sponsor with a logo (added with scripts/sponsors.mjs), in order of their id. */
export const SPONSORS: Sponsor[] = Object.entries(badges as Record<string, string>).map(([id, badge]) => ({
  id,
  name: NAMES[id] ?? id.replace(/(^|-)([a-z])/g, (_, s: string, c: string) => (s ? " " : "") + c.toUpperCase()),
  badge,
}));

export const sponsorOf = (id: string | undefined): Sponsor | null => SPONSORS.find((s) => s.id === id) ?? null;

/**
 * Code #n's sponsor until the organisers choose one (an admin without sponsors yet): the nth, in
 * the same order the admin's database update starts them in.
 */
export const firstSponsor = (num: number) => (SPONSORS.length ? SPONSORS[(num - 1) % SPONSORS.length].id : "none");
