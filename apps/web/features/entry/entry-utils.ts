// Pure parsing for the buyer manual-entry page. Accepts a full checkout URL,
// a full status URL, a path, or a bare slug — never verifies existence
// (that stays server-side behind the public routes).

import { checkoutSlugSchema, orderNoSchema } from "@trustip/validators";

export type BuyerTarget = { slug: string; orderNo?: string };

/** Parse whatever the buyer pasted into a checkout target, or null if invalid. */
export function parseBuyerInput(raw: string): BuyerTarget | null {
  const value = raw.trim();
  if (!value) return null;

  let path = value;
  try {
    path = new URL(value).pathname;
  } catch {
    // not a URL — treat as path or bare slug
  }

  const match = path.match(
    /(?:^|\/)checkout\/([^/]+)(?:\/status\/([^/]+))?\/?$/,
  );
  const slug = match ? match[1] : path.replace(/^\/+|\/+$/g, "");
  const orderNo = match?.[2] ? normalizeOrderNo(match[2]) : undefined;

  if (!checkoutSlugSchema.safeParse(slug).success) return null;
  if (orderNo !== undefined && !orderNoSchema.safeParse(orderNo).success) {
    return null;
  }
  return orderNo !== undefined ? { slug, orderNo } : { slug };
}

/** Order numbers are issued uppercase (TRP-…); tolerate lowercase paste. */
export function normalizeOrderNo(raw: string): string {
  return raw.trim().toUpperCase();
}

export function targetUrl({ slug, orderNo }: BuyerTarget): string {
  return orderNo ? `/checkout/${slug}/status/${orderNo}` : `/checkout/${slug}`;
}
