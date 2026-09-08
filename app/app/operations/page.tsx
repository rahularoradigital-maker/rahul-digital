"use client";

// A5 review queue. Every proposed operation waits here for the human to approve or reject. AdScale never
// executes: an approved proposal returns an Ads-Manager hand-off link the user acts on themselves. Read-only
// until you decide. Reachable at /app/operations.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isAwaiting, isDecided, outcomeLabel } from "@/lib/operations/monitoring";
import type { PendingStatus } from "@/lib/operations/approval";

type Pending = {
  id: string;
  kind: string;
  status: string;
  operation: { intentText?: string; slots?: Record<string, unknown> };
  validation?: { status?: string; violations?: string[]; computed?: Record<string, unknown> } | null;
  dispatch?: { target?: { name?: string; roas?: number | null; spendRs?: number } } | null;
  createdAt: string;
};

const BADGE: Record<string, string> = {
  ready_for_approval: "text-[var(--accent)]",
  approved: "text-[var(--good-ink)]",
  rejected: "text-[var(--ink-muted)]",
  blocked: "text-[var(--bad-ink)]",
  handed_off: "text-[var(--good-ink)]",
};

export default function OperationsQueuePage() {
  const [rows, setRows] = useState<Pending[]>([]);
  const [state, setState] = useState<"loading" | "idle">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<{ id: string; url: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/operations/pending")
      .then((r) => r.json())
      .then((d: { pending?: Pending[] }) => { setRows(d.pending ?? []); setState("idle"); })
      .catch(() => setState("idle"));
  }, []);
  useEffect(load, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const r = await fetch("/api/operations/pending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const d = (await r.json()) as { handoffUrl?: string | null };
      if (action === "approve" && d.handoffUrl) setHandoff({ id, url: d.handoffUrl });
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] text-[var(--ink-muted)]">Permissions and approval</div>
        <h1 className="mt-1.5 text-[26px] font-normal tracking-tight">Approval queue</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          Proposed changes wait here for your approval. AdScale never changes a live campaign on its own. When you approve, you get a direct link to make the change in Ads Manager.
        </p>
      </div>

      {state === "loading" ? (
        <div className="text-sm text-[var(--ink-muted)]">Loading...</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-[var(--ink-muted)]">No proposals yet. When you submit an operation, it appears here for approval.</CardContent></Card>
      ) : (
        <>
          <Section title="Awaiting your approval" empty="Nothing waiting.">
            {rows.filter((p) => isAwaiting(p.status as PendingStatus)).map((p) => (
              <OpCard key={p.id} p={p} busy={busy === p.id} decide={decide} handoff={handoff?.id === p.id ? handoff.url : null} />
            ))}
          </Section>
          <Section title="Recent decisions" empty="No decisions yet.">
            {rows.filter((p) => isDecided(p.status as PendingStatus)).map((p) => (
              <OpCard key={p.id} p={p} busy={false} decide={decide} handoff={handoff?.id === p.id ? handoff.url : null} />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasAny = items.some(Boolean) && items.flat().filter(Boolean).length > 0;
  return (
    <div className="space-y-3">
      <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">{title}</h2>
      {hasAny ? children : <div className="text-[13px] text-[var(--ink-muted)]">{empty}</div>}
    </div>
  );
}

function OpCard({ p, busy, decide, handoff }: { p: Pending; busy: boolean; decide: (id: string, a: "approve" | "reject") => void; handoff: string | null }) {
  const c = p.validation?.computed ?? {};
  const proposal = p.kind === "propose_budget_change" && c.appliedPct != null ? `${c.direction} budget by ${String(c.appliedPct)}%` : p.kind === "propose_pause" ? "pause" : p.kind;
  const decided = isDecided(p.status as PendingStatus);
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] text-[var(--ink-muted)]">{p.kind}</div>
            <div className="mt-0.5 text-sm font-medium text-[var(--ink)]">{p.dispatch?.target?.name ?? p.operation.intentText}</div>
            <div className="mt-1 text-sm text-[var(--ink)]">Proposal: {proposal}</div>
            {p.dispatch?.target && (
              <div className="mt-1 text-[13px] text-[var(--ink-muted)]">Read: ROAS {p.dispatch.target.roas ?? "n/a"}, spend Rs {p.dispatch.target.spendRs ?? "n/a"}</div>
            )}
            {(p.validation?.violations ?? []).length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-[13px] text-[var(--ink-muted)]">
                {p.validation!.violations!.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            )}
            {decided && <div className="mt-2 text-[13px] text-[var(--ink-muted)]">{outcomeLabel(p.status as PendingStatus)}</div>}
            {handoff && (
              <a href={handoff} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13px] font-medium text-[var(--accent)] underline underline-offset-2">Open in Ads Manager to make this change</a>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`text-[12px] font-medium ${BADGE[p.status] ?? ""}`}>{p.status.replace(/_/g, " ")}</span>
            {p.status === "ready_for_approval" && (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => decide(p.id, "approve")}>Approve</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(p.id, "reject")}>Reject</Button>
              </div>
            )}
            {p.status === "blocked" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(p.id, "reject")}>Dismiss</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
