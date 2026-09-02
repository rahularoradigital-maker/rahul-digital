"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reportToText, reportToHtml, type CreativeReport } from "@/lib/creative/creative-report";

// Renders the deterministic creative health report + lets a buyer copy or download it (plain text) to share
// with a client / team. No data is computed here - it just presents what the section already assembled.
export function CreativeReportCard({ report }: { report: CreativeReport }) {
  const [copied, setCopied] = useState(false);
  const text = reportToText(report);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  function downloadBlob(content: string, mime: string, filename: string) {
    try {
      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* download blocked */
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-base font-normal">Creative health report</div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
          <Button variant="outline" size="sm" onClick={() => downloadBlob(text, "text/plain", "creative-health-report.txt")}>.txt</Button>
          <Button variant="outline" size="sm" onClick={() => downloadBlob(reportToHtml(report), "text/html", "creative-health-report.html")}>.html</Button>
        </div>
      </div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">{report.generatedFor}</div>
      <div className="mb-4 text-[15px] font-medium text-[var(--ink)]">{report.headline}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        {report.sections.map((s) => (
          <div key={s.title}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{s.title}</div>
            <ul className="space-y-1">
              {s.lines.map((l, i) => (
                <li key={i} className="text-[13px] text-[var(--ink)]">{l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
