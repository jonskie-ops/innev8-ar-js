const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const SPARKS = ["#12BFEA", "#087BE8", "#20C9BC", "#D6B56D", "#8fe9ff"];
const IN = 520;
const HOLD = 90;
const OUT = 620;

/**
 * Pixel-dissolve transition (same as the main site's theme toggle): a grid of cells floods out from
 * (x, y) in `color` with a sparkling brand-colour edge, calls `onCover` at full cover, then dissolves
 * away from the same point. Returns a cancel function that removes the overlay.
 */
export function pixelWipe(x: number, y: number, color: string, onCover: () => void, onDone?: () => void) {
  const w = innerWidth;
  const h = innerHeight;
  const canvas = document.createElement("canvas");
  canvas.className = "pixel-fx";
  canvas.width = w;
  canvas.height = h;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  const cell = w < 700 ? 16 : 22;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const band = cell * 4.5;
  const reach = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + band + cell * 2;
  const dist = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      dist[r * cols + c] =
        Math.hypot(c * cell + cell / 2 - x, r * cell + cell / 2 - y) + (Math.random() - 0.5) * cell * 3;

  let t0 = 0;
  let covered = false;
  let raf = 0;

  function frame(now: number) {
    if (!t0) t0 = now;
    const t = now - t0;
    ctx.clearRect(0, 0, w, h);
    const covering = t < IN + HOLD;
    if (t >= IN && !covered) {
      covered = true;
      onCover();
    }
    const front = (covering ? ease(Math.min(1, t / IN)) : ease(Math.min(1, (t - IN - HOLD) / OUT))) * reach;

    for (let i = 0; i < dist.length; i++) {
      const d = dist[i];
      let fill: string | null;
      if (covering) fill = d < front - band ? color : d < front ? SPARKS[(Math.random() * SPARKS.length) | 0] : null;
      else fill = d < front - band ? null : d < front ? SPARKS[(Math.random() * SPARKS.length) | 0] : color;
      if (!fill) continue;
      const px = (i % cols) * cell;
      const py = ((i / cols) | 0) * cell;
      ctx.fillStyle = fill;
      if (fill === color) ctx.fillRect(px, py, cell, cell);
      else {
        const s = Math.random() < 0.35 ? cell * 0.55 : cell - 2;
        ctx.fillRect(px + (cell - s) / 2, py + (cell - s) / 2, s, s);
      }
    }

    if (t < IN + HOLD + OUT) raf = requestAnimationFrame(frame);
    else {
      canvas.remove();
      onDone?.();
    }
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    canvas.remove();
  };
}
