import { getAdminStatus } from "../lib/runtime.mjs";

export function GET() {
  return Response.json(getAdminStatus(), { headers: { "Cache-Control": "no-store" } });
}
