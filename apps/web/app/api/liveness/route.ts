import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/liveness — alias of /api/health for orchestrators (k8s livenessProbe)
 * that expect a dedicated path. Same contract: process-up only, no dep checks.
 */
export function GET(): NextResponse {
  return NextResponse.json({
    status: "ok",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.1.0",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
