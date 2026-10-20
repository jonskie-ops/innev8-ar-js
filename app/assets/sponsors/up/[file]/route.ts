/**
 * A sponsor's badge the organisers uploaded on the admin's Sponsors page (its "sponsors" storage
 * bucket), at the game's own address: the phone keeps it with the game's other pictures (public/sw.js
 * keeps everything under /assets/), and the 3D code can draw it without asking another site.
 * Each upload has its own name, so it never changes: kept for a year.
 */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  if (!url || !/^[a-z0-9-]{1,64}\.(webp|png)$/.test(file)) return new Response("Not found", { status: 404 });
  const res = await fetch(`${url}/storage/v1/object/public/sponsors/${file}`).catch(() => null);
  if (!res?.ok || !res.body) return new Response("Not found", { status: res?.status === 404 || res?.status === 400 ? 404 : 502 });
  return new Response(res.body, {
    headers: {
      "Content-Type": file.endsWith(".png") ? "image/png" : "image/webp",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
