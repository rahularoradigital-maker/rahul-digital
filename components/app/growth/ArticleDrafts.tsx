"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Scout's written articles awaiting your one-tap publish. Read the preview, then Publish (goes live at
// /blog/<slug>) or Dismiss. Nothing is public until you tap Publish - the human gate on AI-written content.

export type ArticleRow = { id: string; slug: string; title: string; dek: string | null; body_md: string; topic: string | null };

export function ArticleDrafts({ initial }: { initial: ArticleRow[] }) {
  const [rows, setRows] = useState<ArticleRow[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function act(id: string, action: "published" | "archived") {
    setBusy(id);
    try {
      const res = await fetch("/api/growth/article", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
      if (res.ok) setRows((r) => r.filter((x) => x.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return <p className="text-[13px] text-[var(--ink-muted)]">No draft articles. Scout writes one when a fresh topic emerges.</p>;

  return (
    <ul className="space-y-4">
      {rows.map((a) => (
        <li key={a.id} className="rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] p-4">
          <div className="text-[15px] font-semibold text-[var(--ink)]">{a.title}</div>
          {a.dek && <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{a.dek}</p>}
          <Button type="button" variant="link" size="sm" onClick={() => setOpen(open === a.id ? null : a.id)} className="h-auto p-0 mt-2 text-[12px] text-[var(--accent)] hover:underline">{open === a.id ? "Hide preview" : "Preview"}</Button>
          {open === a.id && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] p-3 text-[12px] leading-relaxed text-[var(--ink)]">{a.body_md}</pre>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="default" size="sm" disabled={busy === a.id} onClick={() => act(a.id, "published")} className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">Publish to /blog</Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy === a.id} onClick={() => act(a.id, "archived")} className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-50">Dismiss</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
