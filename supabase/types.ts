// Supabase database types.
//
// The canonical, generated types live in the database package so the app can
// import them via `@trustip/database`:
//
//   import type { Database } from "@trustip/database";
//
// Regenerate from the live local schema with:
//   pnpm db:generate-types        # -> supabase gen types typescript --local
//                                 #    (writes packages/database/src/types.ts)
//
// This file is intentionally a thin re-export so `supabase/types.ts` (the path
// referenced by the Architecture spec) stays valid.
export type { Database, Json } from "../packages/database/src/types";
