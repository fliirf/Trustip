import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Phase 0 placeholder middleware: pass-through only.
// Auth, role enforcement, and network guards are implemented in later phases.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
