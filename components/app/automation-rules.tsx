"use client";

// Automation rules (Track A, Phase A2): the account rules that will gate proposed actions later - max budget
// step, floor ROAS, protected campaigns (never proposed for pausing), and creative tone. DB-backed per account
// (via /api/operations/rules), not a cookie, because these rules must be authoritative server-side and shared
// across the user's devices. Nothing here changes any live campaign; these only shape future PROPOSALS.

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Rules = { maxBudgetStepPct: number | null; minRoas: number | null; protectedCampaigns: string[]; creativeTone: string | null };

export function AutomationRules() {
  const [step, setStep] = useState("");
  const [roas, setRoas] = useState("");
  const [protectedList, setProtectedList] = useState("");
  const [tone, setTone] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved">("loading");

  useEffect(() => {
    fetch("/api/operations/rules")
      .then((r) => r.json())
      .then((d: { rules?: Rules }) => {
        const r = d.rules;
        if (r) {
          setStep(r.maxBudgetStepPct != null ? String(r.maxBudgetStepPct) : "");
          setRoas(r.minRoas != null ? String(r.minRoas) : "");
          setProtectedList((r.protectedCampaigns ?? []).join(", "));
          setTone(r.creativeTone ?? "");
        }
        setState("idle");
      })
      .catch(() => setState("idle"));
  }, []);

  async function save() {
    setState("saving");
    const body = {
      maxBudgetStepPct: step.trim() ? Number(step) : null,
      minRoas: roas.trim() ? Number(roas) : null,
      protectedCampaigns: protectedList.split(",").map((s) => s.trim()).filter(Boolean),
      creativeTone: tone.trim() || null,
    };
    try {
      await fetch("/api/operations/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-1 text-base font-normal">Automation rules</div>
        <div className="mb-4 text-[13px] text-muted-foreground">
          Your account rules. AdScale uses these to shape what it proposes. It never changes a live campaign on its own; you always approve.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-[var(--ink-muted)]">Max budget step (%)</span>
            <Input value={step} onChange={(e) => setStep(e.target.value)} placeholder="e.g. 20" inputMode="numeric" className="mt-1" />
          </label>
          <label className="text-sm">
            <span className="text-[var(--ink-muted)]">Do not scale below ROAS</span>
            <Input value={roas} onChange={(e) => setRoas(e.target.value)} placeholder="e.g. 2.5" inputMode="decimal" className="mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-[var(--ink-muted)]">Protected campaigns (comma separated, never proposed for pausing)</span>
            <Input value={protectedList} onChange={(e) => setProtectedList(e.target.value)} placeholder="e.g. Always-On Brand, Retargeting Core" className="mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-[var(--ink-muted)]">Creative tone</span>
            <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. confident, plain, no hype" className="mt-1" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save} disabled={state === "saving" || state === "loading"} size="sm">
            {state === "saving" ? "Saving..." : "Save rules"}
          </Button>
          {state === "saved" && <span className="text-[13px] text-[var(--good-ink)]">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}
