import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";

// Public marketing pages are crawlable; the signed-in app and API stay out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api", "/auth"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
