/**
 * A decorative QR-code graphic (21×21 modules, three finder squares, timing lines). Each `seed`
 * gives its own pattern. The data modules are random, so it reads as a QR code but doesn't decode
 * to anything (players can't scan a code off someone else's screen).
 * Colours come from CSS: `--qr-mod` (modules) and `--qr-eye` (finder centres).
 */
const N = 21;

type Paths = { modules: string; centers: string };
const cache = new Map<string, Paths>();

function buildPaths(seedText: string): Paths {
  let seed = 0x1e8a7;
  for (let i = 0; i < seedText.length; i++) seed = (Math.imul(seed ^ seedText.charCodeAt(i), 16777619) >>> 0) || 1;
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const inFinder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);
  const square = (x: number, y: number) => `M${x} ${y}h1v1h-1z`;

  let modules = "";
  let centers = "";
  // Finder patterns: a 7×7 ring with a 3×3 centre, in three corners.
  for (const [r0, c0] of [
    [0, 0],
    [0, N - 7],
    [N - 7, 0],
  ]) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (ring) modules += square(c0 + c, r0 + r);
        else if (core) centers += square(c0 + c, r0 + r);
      }
    }
  }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (inFinder(r, c)) continue;
      const timing = r === 6 || c === 6;
      if (timing ? (r + c) % 2 === 0 : rand() < 0.5) modules += square(c, r);
    }
  }
  return { modules, centers };
}

export function QrGlyph({ seed = "innev8", className }: { seed?: string; className?: string }) {
  let paths = cache.get(seed);
  if (!paths) {
    paths = buildPaths(seed);
    cache.set(seed, paths);
  }
  return (
    <svg className={className} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" aria-hidden="true">
      <path className="qr__mod" d={paths.modules} />
      <path className="qr__eye" d={paths.centers} />
    </svg>
  );
}
