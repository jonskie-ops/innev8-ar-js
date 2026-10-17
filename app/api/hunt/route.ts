import { loadHunt } from "@/lib/hunt-server";

/** The hunt as the organisers set it (lib/hunt-server.ts): what every phone asks for. */
export async function GET() {
  return Response.json(await loadHunt());
}
