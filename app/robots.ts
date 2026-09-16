import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// Public marketing + blog pages are crawlable; the signed-in app and API stay out of the index.
// AI answer engines (ChatGPT, Perplexity, Claude, Google AI, Apple) are named EXPLICITLY and allowed, so
// there is zero ambiguity that AdScale's guides may be read and cited. The wildcard rule already permits
// them, but naming each removes any doubt and documents the intent. The private surfaces stay disallowed
// for every agent. See also /llms.txt for the curated site map these tools read.
const AI_AND_SEARCH_AGENTS = [
  "GPTBot", // OpenAI training crawler
  "OAI-SearchBot", // ChatGPT search index
  "ChatGPT-User", // ChatGPT live browsing on a user's behalf
  "PerplexityBot", // Perplexity index
  "Perplexity-User", // Perplexity live fetch
  "ClaudeBot", // Anthropic crawler
  "Claude-Web", // Anthropic live browsing
  "anthropic-ai", // Anthropic
  "Google-Extended", // Google Gemini / AI Overviews training + grounding
  "Applebot-Extended", // Apple Intelligence
  "Amazonbot", // Amazon (Alexa/AI)
  "Meta-ExternalAgent", // Meta AI
];

const PRIVATE = ["/app", "/api", "/auth"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_AND_SEARCH_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
