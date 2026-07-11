import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness (Phase 19, Part 6). Answers "is the process up?"
 * with zero dependency checks so it never flaps on a downstream blip. Use
 * /api/ready for dependency readiness. No sensitive data.
 */
export function GET(): NextResponse {
  return NextResponse.json({
    status: "ok",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.1.0",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
