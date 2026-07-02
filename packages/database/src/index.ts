import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export * from "./types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export type TrustipClient = SupabaseClient<Database>;

/**
 * Anon/public client. Subject to Row-Level Security — safe for client and
 * server use with the user's session.
 */
export const supabase: TrustipClient = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
);

/**
 * Service-role client. BYPASSES RLS — server/worker contexts ONLY.
 * Never import this into client code or expose the service role key.
 */
export function getServiceClient(serviceRoleKey?: string): TrustipClient {
  // Hard guard: the service-role client bypasses RLS and must never run in a
  // browser bundle. (The service key is also non-NEXT_PUBLIC, so it is absent
  // client-side — this makes accidental client use fail loudly and early.)
  if (typeof window !== "undefined") {
    throw new Error(
      "getServiceClient must only be used server-side (never in the browser)",
    );
  }
  const key = serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing service role key");
  }
  return createClient<Database>(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
