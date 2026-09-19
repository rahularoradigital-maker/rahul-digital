"use client";

// Themed /book-demo content in the shared marketing theme. The DemoForm (lead capture -> /api/leads)
// is rendered untouched so its logic stays intact; metadata stays in the server page.
import { ThemeShell } from "@/components/marketing/theme-shell";
import { DemoForm } from "@/components/marketing-extra/demo-form";

const PERKS = [
  { h: "Built from your real data", d: "We connect your Meta account and show a live plan." },
  { h: "No slideware", d: "Straight to decisions your team can act on Monday." },
  { h: "Founder-led", d: "You talk to the people who built the agents." },
];

export default function BookDemoThemed({ initialEmail = "" }: { initialEmail?: string }) {
  return (
    <ThemeShell active="/book-demo">
      <section className="page-hero">
        <div className="wrap" style={{ display: "grid", gap: 48, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", alignItems: "start" }}>
          {/* Left: pitch */}
          <div className="rv">
            <div className="eyebrow"><span className="tick" /><span className="lab">Talk to the founders</span></div>
            <h1>See your first weekly test plan, live.</h1>
            <p className="lede">Book 30 minutes. We will connect your account and build a ranked creative plan from your own data, no slides, just decisions.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 8 }}>
              {PERKS.map((p) => (
                <div key={p.h} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "var(--mono)", color: "var(--accent)", fontSize: 14, marginTop: 2 }}>&#10003;</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.h}</div>
                    <div style={{ color: "var(--muted)", fontSize: 14 }}>{p.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: the live form, untouched */}
          <div className="rv">
            <DemoForm initialEmail={initialEmail} />
          </div>
        </div>
      </section>
    </ThemeShell>
  );
}
