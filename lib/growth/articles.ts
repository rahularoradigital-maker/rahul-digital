import "server-only";
import { createAdminClient } from "../supabase/admin.ts";
import { runTaskJson } from "../ai/router.ts";
import { compose } from "../ai/compose.ts";
import { BRAND } from "./knowledge.ts";

// Scout's content engine. From a recurring topic it writes a genuinely useful, sourced article (AI), stored as
// a DRAFT. You one-tap publish; then it renders publicly at /blog/<slug>. No fabrication: the article is
// educational and must not invent stats or results (the prompt forbids it). The public /blog reads published
// rows server-side. Pure helpers (slugify) are testable; generateArticle needs the AI layer.

export type Article = { id: string; slug: string; title: string; topic: string | null; dek: string | null; body_md: string; status: string; published_at: string | null };

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "article";
}

// Ask the AI for {title, dek, body} on a topic. Educational, honest, on-brand. Returns null without AI.
export async function generateArticle(topic: string): Promise<{ title: string; dek: string; body: string } | null> {
  const system =
    `You are writing a genuinely useful, expert blog article for ${BRAND.name} (${BRAND.url}), which helps media buyers ` +
    `decide what to change in their Meta/Google ads, with a reason for every call. Write for a performance marketer. ` +
    `Rules: teach something real and specific; NO invented statistics, results, or case studies; no hype, no clichés ` +
    `("unleash", "game-changer", "seamless"); plain, confident, first-hand-expert tone. 600-900 words, markdown with ` +
    `## subheadings. You MAY mention ${BRAND.name} once, briefly, only where it genuinely fits, with disclosure. ` +
    `Ground everything in real, well-known media-buying practice. Return JSON: {"title","dek","body"}.`;
  const out = await runTaskJson(
    "concept-gen",
    compose(system, [{ label: "topic", content: `Write the article about: ${topic}` }]),
    { title: "string", dek: "string (one-line subtitle)", body: "string (markdown article)" },
  );
  if (!out || typeof out.title !== "string" || typeof out.body !== "string") return null;
  const title = String(out.title).trim();
  const body = String(out.body).trim();
  if (title.length < 8 || body.length < 300) return null; // reject an empty/degenerate generation
  return { title, dek: String(out.dek ?? "").trim(), body };
}

// Save a generated article as a DRAFT (never public until published). Slug is de-duplicated. Best-effort.
export async function saveDraftArticle(a: { title: string; dek: string; body: string; topic: string }): Promise<void> {
  try {
    const admin = createAdminClient();
    let slug = slugify(a.title);
    const { data: existing } = await admin.from("growth_articles").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const { error } = await admin.from("growth_articles").insert({ slug, title: a.title, dek: a.dek, body_md: a.body, topic: a.topic, status: "draft" });
    if (error) console.warn(`[growth] saveDraftArticle failed: ${error.message}`);
  } catch (err) {
    console.warn("[growth] saveDraftArticle failed:", err instanceof Error ? err.message : err);
  }
}

export async function listDraftArticles(): Promise<Article[]> {
  return listByStatus("draft");
}
export async function listPublishedArticles(): Promise<Article[]> {
  return listByStatus("published");
}
async function listByStatus(status: string): Promise<Article[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("growth_articles").select("id,slug,title,topic,dek,body_md,status,published_at").eq("status", status).order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(50);
    return (data ?? []) as Article[];
  } catch {
    return [];
  }
}

// Has Scout already written an article (draft or published) on this topic? Prevents re-generating the same one.
export async function topicHasArticle(topic: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("growth_articles").select("id").eq("topic", topic).neq("status", "archived").limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return true; // on error, assume yes so we don't spam duplicates
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("growth_articles").select("id,slug,title,topic,dek,body_md,status,published_at").eq("slug", slug).eq("status", "published").maybeSingle();
    return (data as Article | undefined) ?? null;
  } catch {
    return null;
  }
}

// One-tap publish / archive (owner action). Never called automatically - a human tap makes an article public.
export async function setArticleStatus(id: string, status: "published" | "archived" | "draft"): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const patch: Record<string, unknown> = { status };
    if (status === "published") patch.published_at = new Date().toISOString();
    const { data, error } = await admin.from("growth_articles").update(patch).eq("id", id).select("id");
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
