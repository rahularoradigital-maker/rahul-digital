import "server-only";
import { runTaskText } from "../ai/router.ts";
import { compose } from "../ai/compose.ts";
import { BRAND } from "./knowledge.ts";
import { tagAdScaleLinks } from "./attribution.ts";
import { checkContent } from "./quality.ts";
import type { Opportunity } from "./engine.ts";

// Scout's draft-writer: for an opportunity worth a reply, the AI writes a SHORT, genuinely useful, human reply
// - for YOUR review. It is NEVER posted. The conversation content is fenced (compose) so a crafted post can't
// inject instructions. Best-effort: returns null when no AI is configured or the model has nothing useful to
// add (so a bad draft never gets queued). Promotion is gated by the community rule already decided upstream.

export async function writeDraft(o: Opportunity): Promise<string | null> {
  const mayMention = o.promote.mayMention;
  const system =
    `You are an experienced performance marketer replying in an online community thread. Write a SHORT reply ` +
    `(3-5 sentences), genuinely useful and specific to what they asked. Human, plain, no hype, no emojis, no ` +
    `"check out". ` +
    (mayMention
      ? `You MAY briefly mention AdScale (${BRAND.url}) ONLY if it truly helps, and you MUST disclose ("full disclosure, I work on AdScale"). Be useful first. `
      : `Do NOT mention any product or link - just be helpful. `) +
    `If you have nothing genuinely useful to add, reply with exactly: SKIP`;
  const draft = await runTaskText("analyze-text", compose(system, [{ label: "conversation", content: `${o.conversation.title ?? ""}\n\n${o.conversation.content}` }]));
  if (!draft) return null;
  const t = draft.trim();
  if (t === "SKIP" || t.length < 20) return null;
  // Quality gate: never queue a draft with a CRITICAL flaw (unsupported claim, undisclosed/disallowed mention).
  if (!checkContent(t, { mayMention }).pass) return null;
  // Attribution: tag any AdScale link in the reply so a click from this thread is traceable to its source.
  return tagAdScaleLinks(t, { source: o.conversation.platform, content: o.conversation.conversationId });
}

// Enrich the top opportunities with drafts, in parallel, capped so a run stays cheap. Never throws.
export async function draftTop(opportunities: Opportunity[], cap = 5): Promise<Opportunity[]> {
  const targets = opportunities.slice(0, cap);
  const drafts = await Promise.all(targets.map((o) => writeDraft(o).catch(() => null)));
  targets.forEach((o, i) => (o.draft = drafts[i]));
  return opportunities;
}
