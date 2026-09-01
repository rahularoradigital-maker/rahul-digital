"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Scout's approval queue. Each drafted reply: read it, then EITHER "Copy reply & open thread" (copies the
// draft to your clipboard and opens the conversation so you paste + post yourself - Scout never posts), or
// Dismiss. Approving/marking-posted just records status. Optimistically removes the row on action.

export type DraftRow = { id: string; day: string; platform: string; community: string | null; url: string; title: string | null; decision: string; score: number; may_mention: boolean; draft: string | null; status: string };

export function ReviewQueue({ initial }: { initial: DraftRow[] }) {
  const [rows, setRows] = useState<DraftRow[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "approved" | "dismissed" | "posted") {
    setBusy(id);
    try {
      const res = await fetch("/api/growth/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
      if (res.ok) setRows((r) => r.filter((x) => x.id !== id));
    } finally {
      setBusy(null);
    }
  }

  async function copyAndOpen(row: DraftRow) {
    try {
      if (row.draft) await navigator.clipboard.writeText(row.draft);
    } catch {
      /* clipboard blocked - the draft is still visible to copy manually */
    }
    window.open(row.url, "_blank", "noopener,noreferrer");
    void act(row.id, "posted"); // mark it handled; you still post it yourself in the opened tab
  }

  if (rows.length === 0) return <p className="text-[13px] text-[var(--ink-muted)]">Nothing awaiting review. Scout will queue new drafts on its next run.</p>;

  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.id} className="rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] p-4">
          <div className="flex items-start justify-between gap-2">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-[var(--accent)] hover:underline">{r.title ?? r.url}</a>
            <Badge variant="success" className="shrink-0 rounded-full bg-[var(--good-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--good-ink)]">{r.decision} · {r.score}/100</Badge>
          </div>
          <div className="mt-1 text-[12px] text-[var(--ink-muted)]">{r.community} · {r.may_mention ? "product mention allowed" : "be useful only, no mention"}</div>
          {r.draft ? (
            <div className="mt-2 rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Scout&apos;s draft reply</div>
              <p className="whitespace-pre-wrap text-[13px] leading-snug text-[var(--ink)]">{r.draft}</p>
            </div>
          ) : (
            <div className="mt-2 text-[12px] italic text-[var(--ink-muted)]">No draft (Scout skipped - be useful in your own words, or dismiss).</div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="default" size="sm" disabled={busy === r.id} onClick={() => copyAndOpen(r)} className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">Copy reply &amp; open thread</Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy === r.id} onClick={() => act(r.id, "dismissed")} className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-50">Dismiss</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
