import type { MetadataRoute } from "next";
import { listPublishedArticles } from "@/lib/growth/articles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";

// Regenerate hourly so a newly-published blog post appears in the sitemap without a redeploy.
export const revalidate = 3600;

// The public, indexable pages. Signed-in app + auth pages are intentionally excluded (they are also
// disallowed in robots.ts). The blog index + every PUBLISHED article are included dynamically so new
// posts are discoverable without a code change. A DB hiccup degrades to the static pages - never a build break.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/product", "/integrations/meta", "/blog", "/book-demo", "/privacy", "/terms", "/cookie-policy", "/data-deletion"];
  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === "/blog" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p === "/blog" || p === "/product" ? 0.8 : 0.5,
  }));

  let posts: MetadataRoute.Sitemap = [];
  try {
    const articles = await listPublishedArticles();
    posts = articles.map((a) => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: a.published_at ? new Date(a.published_at) : undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch {
    // DB unavailable at build/request time -> ship the static pages, skip posts (they'll appear on next revalidate).
  }

  return [...staticEntries, ...posts];
}
