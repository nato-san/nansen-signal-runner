import { getRunData } from "../lib/runtime.mjs";

export async function GET() {
  try {
    return Response.json(await getRunData(), {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "max-age=600, stale-while-revalidate=60"
      }
    });
  } catch (error) {
    return Response.json(
      { mode: "unavailable", message: error instanceof Error ? error.message : "Live prices unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
