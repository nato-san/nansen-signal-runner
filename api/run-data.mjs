import { getPublicRunError, getRunData } from "../lib/runtime.mjs";

export async function GET() {
  try {
    return Response.json(await getRunData(), {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "max-age=600, stale-while-revalidate=60"
      }
    });
  } catch (error) {
    console.error("Live Nansen pricing failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json(
      getPublicRunError(),
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
