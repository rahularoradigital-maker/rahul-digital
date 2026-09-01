import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/app/user";
import { GeneratePositioning } from "./generate-positioning";

// Positioning intelligence: OUR ICP + content pillars vs THEIR ICP + content pillars, from real data only.
// SERVER-RENDERED (cleanup #5): the cached synthesis is read on the server (its own user_id row in
// creative_insights) and the sections render server-side. Only the Generate button is a client island
// (generate-positioning.tsx). This whole component used to be "use client" and fetched the cached content in
// a useEffect, flashing "Loading…". The heavy synthesis stays in the POST route (grounded Gemini).

// Split the model's plain-text answer into "N) HEADING" sections so each renders as a titled block. Any
// preamble before the first numbered heading is kept as an intro. No fabrication: we render exactly what the
// grounded model returned, just formatted.
function parseSections(text: string): { title: string; body: string }[] {
  const parts = text.split(/\n(?=\d\)\s)/); // split before lines like "2) COMPETITORS' ICP"
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^\d\)\s*(.+?)(?:\s*[-–:]\s*|\n)([\s\S]*)$/);
      if (!m) return { title: "", body: p };
      return { title: m[1].trim(), body: m[2].trim() };
    });
}

export async function PositioningSection() {
  const user = await getCurrentUser();
  let content: string | null = null;
  if (user) {
    const { data } = await createAdminClient()
      .from("creative_insights")
      .select("content")
      .eq("user_id", user.id)
      .eq("type", "positioning")
      .order("updated_at", { ascending: false })
      .limit(1);
    content = (data?.[0]?.content as string | undefined) ?? null;
  }
  const sections = content ? parseSections(content) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Positioning: ICP &amp; content pillars</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          Who your ads target and the themes you run, read from your real ads, versus your tracked competitors. Audience
          reads are inferences from the ad copy, flagged as such, never invented. Track competitors on the Competitors tab
          to fill in the &ldquo;theirs&rdquo; side.
        </p>
      </div>

      <GeneratePositioning hasContent={!!content} />

      {!content ? (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 text-sm text-[var(--ink-muted)]">
          No positioning read yet. Hit Generate - it reads your live ads, brand profile, and website to describe your ICP
          and content pillars, and compares them to any competitors you have tracked.
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
              {s.title && <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--accent)]">{s.title}</div>}
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">{s.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
