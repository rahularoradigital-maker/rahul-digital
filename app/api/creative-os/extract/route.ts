import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { extractAndSave } from "@/lib/creative-os/extract";
import { normalizeExtractItems } from "@/lib/creative-os/extract-pure";

// Creative Intelligence OS — extraction orchestrator (the write path into the Creative Database).
// POST { items: [{ caption?, transcript?, textOverlay?, comments?, reviewText?, source, sourceRef?, brandId? }] }
// Runs each creative through Gemini pattern extraction (budget/kill-switch gated at the primitive) and persists
// the patterns. Batch is capped (MAX_EXTRACT_ITEMS) so one call can't run unbounded AI cost. Auth + product gated.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const items = normalizeExtractItems(await request.json().catch(() => ({})));
  if (!items.length) return NextResponse.json({ error: "No extractable items (need at least one with content and a valid source)." }, { status: 400 });

  let saved = 0;
  let extracted = 0;
  for (const { input, ctx } of items) {
    const r = await extractAndSave(user.id, input, ctx);
    extracted += r.drafts.length;
    saved += r.saved;
  }
  return NextResponse.json({ items: items.length, extracted, saved });
}
