import { listPublishedArticles } from "@/lib/growth/articles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// /llms.txt (llmstxt.org): a curated, plain-text map of the site for AI/LLM tools that read it (ChatGPT,
// Perplexity, Claude, etc.). Google Search does NOT use this file (per Google's AI-optimization guide, it
// "will neither harm nor help"), so it is purely for the broader AI ecosystem. Generated dynamically so
// newly published articles appear without a redeploy. Honest: only real, shipped pages and published posts.
export const revalidate = 3600;

export async function GET() {
  const u = (p: string) => `${SITE_URL}${p}`;

  let articles: { slug: string; title: string; dek: string | null }[] = [];
  try {
    articles = (await listPublishedArticles()).map((a) => ({ slug: a.slug, title: a.title, dek: a.dek }));
  } catch {
    // DB unreachable -> ship the map without the articles list rather than failing
  }

  const guides = articles.length
    ? articles.map((a) => `- [${a.title}](${u(`/blog/${a.slug}`)})${a.dek ? `: ${a.dek}` : ""}`).join("\n")
    : `- [The AdScale blog](${u("/blog")}): guides on deciding what to change in your Meta and Google ads.`;

  const body = `# AdScale

> AdScale is creative decision intelligence for Meta and Google ads. It connects to your ad account read-only, reads your day-wise performance, and tells you what to scale, refresh, or kill, with a reason for every call. It never changes your account; every recommendation is a draft you action yourself.

AdScale is for D2C founders and media buyers. It judges each ad on its own objective (conversion, awareness, traffic, and so on), applies buyer-grade rigor (statistical sufficiency and materiality before any verdict), ranks what to do by money at stake, reads ad set and campaign at their native metrics, catches creative fatigue early from day-wise signals, and for Google reads the levers that decide whether you show at all: impression share, budget-vs-rank, and Quality Score.

## Product
- [How AdScale works](${u("/product")}): the weekly decision loop, from signal to ranked plan.
- [Meta Ads integration](${u("/integrations/meta")}): what connects, what data is read, and what AdScale decides from it. Read-only and safe by design.
- [Google Ads integration](${u("/integrations/google-ads")}): budget-vs-rank routing, Quality Score triage, value-bidding readiness, and the right north-star metric per campaign type.

## Guides
${guides}

## Company
- [Book a demo](${u("/book-demo")}): request access to the private beta.
- [Blog](${u("/blog")}): practical, no-hype guides for performance marketers.
- [Privacy](${u("/privacy")})
- [Terms](${u("/terms")})

## Notes
- AdScale connects with read-only scope and encrypts stored tokens. It does not spend, pause, or edit ad accounts.
- Access is currently private beta; new sign-ups join a waitlist until approved.
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=3600" },
  });
}
