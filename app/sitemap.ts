import type { MetadataRoute } from "next";
import { listPublishedArticles } from "@/lib/growth/articles";
import { GLOSSARY } from "@/lib/glossary/terms";
import { TOOLS } from "@/lib/tools/tools";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// Regenerate hourly so a newly-published blog post appears in the sitemap without a redeploy.
export const revalidate = 3600;

// The public, indexable pages. Signed-in app + auth pages are intentionally excluded (they are also
// disallowed in robots.ts). The blog index + every PUBLISHED article are included dynamically so new
// posts are discoverable without a code change. A DB hiccup degrades to the static pages - never a build break.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/product", "/pricing", "/integrations/meta", "/integrations/google-ads", "/blog", "/glossary", "/tools", "/book-demo", "/privacy", "/terms", "/cookie-policy", "/data-deletion"];
  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === "/blog" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p === "/pricing" ? 0.9 : p === "/blog" || p === "/product" || p === "/glossary" || p === "/tools" ? 0.8 : 0.5,
  }));

  // Free calculator pages (static, indexable backlink-magnet surface).
  const toolEntries: MetadataRoute.Sitemap = TOOLS.map((t) => ({
    url: `${SITE_URL}/tools/${t.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Every glossary term is a static, indexable page (AEO surface). Included so all definitions are crawled.
  const glossaryEntries: MetadataRoute.Sitemap = GLOSSARY.map((t) => ({
    url: `${SITE_URL}/glossary/${t.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
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

  return [...staticEntries, ...toolEntries, ...glossaryEntries, ...posts];
}
