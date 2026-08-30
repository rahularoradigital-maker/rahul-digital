import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";

// The public, indexable pages. Signed-in app + auth pages are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/product", "/book-demo", "/privacy", "/terms", "/cookie-policy", "/data-deletion"];
  return paths.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "monthly", priority: p === "" ? 1 : 0.6 }));
}
