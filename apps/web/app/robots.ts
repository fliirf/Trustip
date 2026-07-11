import type { MetadataRoute } from "next";

// Checkout and status URLs are capability URLs: knowing the address is knowing
// the order. They must never end up in a search index, so they are disallowed
// explicitly along with the seller area, the API, and the dev harness. The
// public marketing/help pages stay crawlable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/buyer", "/cara-kerja", "/faq"],
        disallow: ["/checkout/", "/seller/", "/api/", "/dev/"],
      },
    ],
  };
}
