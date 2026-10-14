export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const pad2 = (n: number) => String(n).padStart(2, "0");

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
