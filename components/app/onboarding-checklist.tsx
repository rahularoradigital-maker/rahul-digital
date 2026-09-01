// First-run setup checklist. Shows ONLY while setup is incomplete; returns null once the user has
// connected Meta and confirmed their brand, so a fully set-up account never sees it (zero impact on the
// steady-state cockpit). Minimises time-to-value: it says what AdScale does, what is needed, and the two
// steps to a first decision - and never asks for anything not required to activate. Design-system native
// (same tokens/card as ConnectState). Pure presentational; the parent passes the real setup signals.

type Step = {
  done: boolean;
  title: string;
  body: string;
  cta: { label: string; href: string };
};

export function OnboardingChecklist({ metaConnected, brandConfirmed }: { metaConnected: boolean; brandConfirmed: boolean }) {
  if (metaConnected && brandConfirmed) return null; // setup complete -> nothing to show

  const steps: Step[] = [
    {
      done: metaConnected,
      title: "Connect your Meta account",
      body: "AdScale reads your live ad data to tell you what to fix, scale, and test. It never changes anything automatically.",
      cta: { label: "Connect Meta", href: "/api/connect/meta/authorize" },
    },
    {
      done: brandConfirmed,
      title: "Confirm your brand",
      body: "One quick review of your category and products. It powers competitor and creator intelligence.",
      cta: { label: "Set up brand", href: "/app/market?tab=brand" },
    },
  ];
  // The first not-yet-done step is the ACTIVE one (its CTA is shown); later steps stay quiet until reached.
  const activeIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-normal text-[var(--ink)]">Welcome - let&apos;s get you set up</h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">Two steps, about two minutes, to your first decision.</p>

      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => {
          const active = i === activeIdx;
          return (
            <li key={s.title} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${
                  s.done
                    ? "bg-[var(--good-bg)] text-[var(--good-ink)]"
                    : active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--surface-alt)] text-[var(--ink-muted)]"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${s.done ? "text-[var(--ink-muted)]" : "text-[var(--ink)]"}`}>
                  {s.title}
                  {s.done ? <span className="ml-2 text-[11px] font-normal text-[var(--good-ink)]">Done</span> : null}
                </div>
                {!s.done ? <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{s.body}</p> : null}
                {active ? (
                  <a
                    href={s.cta.href}
                    className="mt-2 inline-block rounded-full bg-[var(--ink)] px-5 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
                  >
                    {s.cta.label}
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
