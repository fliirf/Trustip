/**
 * scripts/generate-types.ts
 *
 * Regenerates the Supabase TypeScript types from the local database schema and
 * writes them to packages/database/src/types.ts (the database package owns the
 * generated types; the app imports them via @trustip/database).
 *
 * Requires: Supabase CLI installed and a running local stack
 *   (`supabase start`, which needs Docker). See docs/Deployment guide.
 *
 * Usage:
 *   pnpm db:generate-types
 *   # or: tsx scripts/generate-types.ts
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const OUT_PATH = resolve(process.cwd(), "packages/database/src/types.ts");

function main(): void {
  console.log("[generate-types] Running `supabase gen types typescript`...");

  let output: string;
  try {
    output = execFileSync(
      "supabase",
      ["gen", "types", "typescript", "--local"],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (err) {
    console.error(
      "[generate-types] Failed. Ensure the Supabase CLI is installed and " +
        "`supabase start` is running (Docker required).",
    );
    throw err;
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, output, "utf8");
  console.log(`[generate-types] Wrote ${OUT_PATH}`);
}

main();
