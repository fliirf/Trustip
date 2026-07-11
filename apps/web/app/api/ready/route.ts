import { collectConfigProblems, getRateLimitStore } from "@trustip/config";
import { getServiceClient } from "@trustip/database";
import { getRpcServer, networkName } from "@trustip/stellar";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ready — readiness (Phase 19, Part 6). Checks the dependencies the app
 * needs to actually serve: database, Soroban RPC, worker freshness, rate-limit
 * store, and production config. Returns 503 when a hard dependency is down so a
 * load balancer stops routing to this instance. No secrets in the payload.
 */

const CHECK_TIMEOUT_MS = 3_000;
// Indexer checkpoint older than this ⇒ the indexer is likely stuck/stopped.
const WORKER_STALE_MS = 5 * 60_000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  // Supabase query builders are thenables, not real Promises — normalize first.
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

type Check = { status: "ok" | "degraded" | "down" | "skipped"; detail?: string };

async function checkDatabase(): Promise<Check> {
  try {
    const client = getServiceClient();
    const { error } = await withTimeout(
      client.from("indexer_checkpoints").select("worker").limit(1),
      CHECK_TIMEOUT_MS,
    );
    return error ? { status: "down", detail: error.message } : { status: "ok" };
  } catch (err) {
    return { status: "down", detail: (err as Error).message };
  }
}

async function checkRpc(): Promise<Check> {
  try {
    const latest = await withTimeout(
      getRpcServer().getLatestLedger(),
      CHECK_TIMEOUT_MS,
    );
    return { status: "ok", detail: `ledger ${latest.sequence}` };
  } catch (err) {
    return { status: "down", detail: (err as Error).message };
  }
}

async function checkWorkers(): Promise<Check> {
  try {
    const client = getServiceClient();
    const { data, error } = await withTimeout(
      client
        .from("indexer_checkpoints")
        .select("updated_at")
        .eq("worker", "escrow-event-indexer")
        .eq("network", networkName())
        .maybeSingle(),
      CHECK_TIMEOUT_MS,
    );
    if (error) return { status: "down", detail: error.message };
    if (!data) return { status: "degraded", detail: "no checkpoint yet" };
    const age = Date.now() - new Date(data.updated_at).getTime();
    return age <= WORKER_STALE_MS
      ? { status: "ok", detail: `${Math.round(age / 1000)}s since last pass` }
      : { status: "degraded", detail: `stale ${Math.round(age / 1000)}s` };
  } catch (err) {
    return { status: "down", detail: (err as Error).message };
  }
}

export async function GET(): Promise<NextResponse> {
  const [database, rpc, workers] = await Promise.all([
    checkDatabase(),
    checkRpc(),
    checkWorkers(),
  ]);

  const configProblems = collectConfigProblems();
  const config: Check =
    configProblems.length === 0
      ? { status: "ok" }
      : { status: "down", detail: `${configProblems.length} problem(s)` };

  const queue: Check = getRateLimitStore()
    ? { status: "ok", detail: process.env.UPSTASH_REDIS_REST_URL ? "redis" : "memory" }
    : { status: "degraded", detail: "no distributed store" };

  // Hard dependencies gate readiness; a degraded worker/queue is reported but
  // does not fail readiness (the app can still serve requests).
  const hardDown = [database, rpc, config].some((c) => c.status === "down");

  return NextResponse.json(
    {
      status: hardDown ? "not_ready" : "ready",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.1.0",
      environment: process.env.NODE_ENV ?? "development",
      network: networkName(),
      checks: { database, rpc, workers, queue, config },
      configProblems: configProblems.map((p) => p.key),
      timestamp: new Date().toISOString(),
    },
    { status: hardDown ? 503 : 200 },
  );
}
