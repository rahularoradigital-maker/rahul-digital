"use client";

// Client UI for the free calculators. Imports the PURE math from lib/tools/tools.ts (one tested source),
// switches on slug for input state + result formatting. No fabricated defaults: fields start empty with
// example placeholders. Themed with the shared .rd classes.
import { useMemo, useState } from "react";
import {
  getTool,
  computeBreakEvenRoas,
  computeLtvCac,
  computeAdTriage,
  type Verdict,
} from "@/lib/tools/tools";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

const VERDICT_LABEL: Record<Verdict, string> = { scale: "Scale", refresh: "Refresh the creative", kill: "Kill", hold: "Hold" };
const VERDICT_COLOR: Record<Verdict, string> = { scale: "#2f7d5f", refresh: "#b06b00", kill: "#c0392b", hold: "#6b6b63" };

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

export default function ToolCalculator({ slug }: { slug: string }) {
  const tool = getTool(slug);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  const result = useMemo(() => {
    if (!tool) return null;
    try {
      if (slug === "roas-break-even-calculator") {
        const m = num(vals.marginPct);
        if (!Number.isFinite(m)) return null;
        const { breakEvenRoas } = computeBreakEvenRoas(m);
        if (Number.isNaN(breakEvenRoas)) return null;
        return { kind: "roas" as const, breakEvenRoas };
      }
      if (slug === "ltv-cac-ratio-calculator") {
        const aov = num(vals.aov), marginPct = num(vals.marginPct), ordersPerCustomer = num(vals.ordersPerCustomer), cac = num(vals.cac);
        if (![aov, marginPct, ordersPerCustomer, cac].every(Number.isFinite)) return null;
        return { kind: "ltvcac" as const, ...computeLtvCac({ aov, marginPct, ordersPerCustomer, cac }) };
      }
      if (slug === "scale-refresh-kill-calculator") {
        const roas = num(vals.roas), targetRoas = num(vals.targetRoas), frequency = num(vals.frequency), freqBaseline = num(vals.freqBaseline);
        if (![roas, targetRoas, frequency, freqBaseline].every(Number.isFinite)) return null;
        return { kind: "triage" as const, ...computeAdTriage({ roas, targetRoas, frequency, freqBaseline, inLearning: !!toggles.inLearning }) };
      }
    } catch {
      return null;
    }
    return null;
  }, [slug, tool, vals, toggles]);

  if (!tool) return null;
  const embed = `<iframe src="${SITE_URL}/tools/${tool.slug}" width="100%" height="720" style="border:1px solid #ddd;border-radius:8px" title="${tool.name} by AdScale" loading="lazy"></iframe>`;

  return (
    <div>
      <div style={{ border: "1px solid var(--line2)", background: "var(--bg2)", padding: "26px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tool.fields.map((f) => (
            <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor={`f-${f.key}`} style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</label>
              {f.kind === "toggle" ? (
                <button
                  id={`f-${f.key}`}
                  type="button"
                  role="switch"
                  aria-checked={!!toggles[f.key]}
                  onClick={() => setToggles((t) => ({ ...t, [f.key]: !t[f.key] }))}
                  className="btn"
                  style={{ alignSelf: "flex-start", ...(toggles[f.key] ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}) }}
                >
                  {toggles[f.key] ? "Yes" : "No"}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 260 }}>
                  {f.suffix === "$" && <span style={{ color: "var(--faint)", fontFamily: "var(--mono)" }}>$</span>}
                  <input
                    id={`f-${f.key}`}
                    type="number"
                    inputMode="decimal"
                    placeholder={f.placeholder}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={vals[f.key] ?? ""}
                    onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                    style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--line2)", background: "var(--bg)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 15, outline: "none" }}
                  />
                  {f.suffix && f.suffix !== "$" && <span style={{ color: "var(--faint)", fontFamily: "var(--mono)" }}>{f.suffix}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Result */}
        <div style={{ marginTop: 24, borderTop: "1px solid var(--line2)", paddingTop: 20 }} aria-live="polite">
          {!result ? (
            <p style={{ color: "var(--faint)", fontSize: 14, fontFamily: "var(--mono)", margin: 0 }}>Enter your numbers to see the result.</p>
          ) : result.kind === "roas" ? (
            <div>
              <p className="lab" style={{ marginBottom: 6 }}>Your break-even ROAS</p>
              <p style={{ fontSize: 42, fontWeight: 700, margin: 0, letterSpacing: "-.02em" }}>{result.breakEvenRoas}x</p>
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>Above {result.breakEvenRoas}x is profit on ad spend; below it, you lose money on each sale.</p>
            </div>
          ) : result.kind === "ltvcac" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 18 }}>
              <div><p className="lab" style={{ marginBottom: 6 }}>LTV (gross)</p><p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>${result.ltv}</p></div>
              <div><p className="lab" style={{ marginBottom: 6 }}>LTV : CAC</p><p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: result.ratio >= 3 ? "#2f7d5f" : result.ratio >= 1 ? "#b06b00" : "#c0392b" }}>{Number.isFinite(result.ratio) ? `${result.ratio}:1` : "—"}</p></div>
              <div><p className="lab" style={{ marginBottom: 6 }}>Payback</p><p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{Number.isFinite(result.paybackOrders) ? `${result.paybackOrders} orders` : "—"}</p></div>
            </div>
          ) : result.kind === "triage" ? (
            <div>
              <p className="lab" style={{ marginBottom: 8 }}>Verdict</p>
              <p style={{ fontSize: 30, fontWeight: 700, margin: 0, color: VERDICT_COLOR[result.verdict] }}>{VERDICT_LABEL[result.verdict]}</p>
              <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.55, marginTop: 10 }}>{result.reason}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Embed (each embed on another site is a backlink) */}
      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)" }}>Embed this calculator</summary>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "12px 0 8px" }}>Free to embed on your own site with attribution. Copy the code:</p>
        <textarea
          readOnly
          value={embed}
          onFocus={(e) => e.currentTarget.select()}
          rows={3}
          style={{ width: "100%", padding: "12px", border: "1px solid var(--line2)", background: "var(--bg2)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 12, resize: "vertical" }}
        />
      </details>
    </div>
  );
}
