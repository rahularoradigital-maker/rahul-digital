import type { Article } from "@/lib/growth/articles";
import curated from "./curated-articles.json";

// Curated, version-controlled SEO articles. Imported as a JSON module (NOT read from disk at runtime) so
// Vercel's file tracing bundles them into the serverless function - runtime fs reads of content/ are not
// reliably included. These merge with the Scout-written DB articles at the blog reader (curated take slug
// precedence). Editing an article = edit curated-articles.json + redeploy.
const CURATED = curated as Article[];

export function getCuratedArticles(): Article[] {
  return CURATED;
}

export function getCuratedArticleBySlug(slug: string): Article | null {
  return CURATED.find((a) => a.slug === slug) ?? null;
}
