// Concepts: shows the concept-recipe FRAMEWORK (rulebook 6.1b), not fake recipes.
// A concept here is always a buildable recipe with five named parts, each part
// picked by weighing the same four sources. Real recipes need two connections we
// do not have yet (winning-creative decode, competitor Ad Library gaps), so this
// section shows structure and labels only. Nothing below is an invented pick.

type SourceTag = "OURS" | "AI" | "COMP" | "WORLD";

const SOURCE_STYLE: Record<SourceTag, { label: string; cls: string }> = {
  OURS: { label: "OURS", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
  AI: { label: "AI", cls: "bg-[var(--accent-soft)] text-[var(--accent)]" },
  COMP: { label: "COMP", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]" },
  WORLD: { label: "WORLD", cls: "bg-[var(--surface-alt)] text-[var(--ink-muted)]" },
};

const SOURCE_MEANING: { tag: SourceTag; meaning: string }[] = [
  { tag: "OURS", meaning: "Our own day-wise performance, what already wins for this account" },
  { tag: "AI", meaning: "The AdBrain category model's fit score" },
  { tag: "COMP", meaning: "Whitespace found in a competitor's Ad Library decode" },
  { tag: "WORLD", meaning: "The category benchmark, a world norm" },
];

const RECIPE_PARTS: { part: string; what: string }[] = [
  { part: "SKU", what: "The product picked, constrained to in stock and margin healthy" },
  { part: "Format", what: "The ad format, constrained to our best-winning format for the funnel stage" },
  { part: "Concept", what: "The creative idea, constrained to fill a real top-funnel or message gap" },
  { part: "Offer", what: "The offer, constrained to protect margin (a bundle or threshold beats a blanket discount)" },
  { part: "Landing", what: "The landing page, constrained to fix the weakest step in the funnel" },
];

export function ConceptsSection() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] text-[var(--ink-muted)]">Concept-recipe framework</div>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">Every concept is a recipe, not an idea.</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--ink-muted)]">
          AdBrain never hands a creative team a vague brief. A test concept is a recipe built from five named parts,
          and every part is chosen the same way: weigh what already works for us, the AI model&apos;s fit, the gap a
          competitor leaves open, and the category norm, then take the best score.
        </p>
      </div>

      {/* The recipe formula, straight from the spec, so the working is visible not hidden */}
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <div className="mb-3 text-base font-semibold">The formula</div>
        <pre className="overflow-x-auto rounded-lg bg-[var(--bg)] p-4 text-[12.5px] leading-relaxed text-[var(--ink)]">
{`recipe = pick(SKU) + pick(format) + pick(concept) + pick(offer) + pick(landing)

each pick = argmax over candidates of:
    0.40 x OURS   (our own performance)
  + 0.25 x AI     (AdBrain category model)
  + 0.20 x COMP   (competitor gap from the Ad Library decode)
  + 0.15 x WORLD  (category benchmark)`}
        </pre>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SOURCE_MEANING.map((s) => (
            <div key={s.tag} className="rounded-lg border border-[var(--hairline)] p-3">
              <span className={`rounded-[70px] px-2.5 py-0.5 text-xs font-semibold ${SOURCE_STYLE[s.tag].cls}`}>
                {SOURCE_STYLE[s.tag].label}
              </span>
              <div className="mt-2 text-xs text-[var(--ink-muted)]">{s.meaning}</div>
            </div>
          ))}
        </div>
      </div>

      {/* The 5 recipe parts and which sources feed each pick */}
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <div className="mb-1 text-base font-semibold">The five parts</div>
        <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
          Every part below is scored against the same four sources before a pick is made. This is the label and
          structure only, no product, offer or landing has been chosen here.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--hairline)] text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <th className="py-2 pr-4 font-medium">Part</th>
                <th className="py-2 pr-4 font-medium">What it decides</th>
                <th className="py-2 font-medium">Source tags</th>
              </tr>
            </thead>
            <tbody>
              {RECIPE_PARTS.map((row) => (
                <tr key={row.part} className="border-b border-[var(--surface-alt)] align-top">
                  <td className="py-3 pr-4 font-medium text-[var(--ink)]">{row.part}</td>
                  <td className="py-3 pr-4 text-[var(--ink-muted)]">{row.what}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(SOURCE_STYLE) as SourceTag[]).map((tag) => (
                        <span key={tag} className={`rounded-[70px] px-2.5 py-0.5 text-xs font-semibold ${SOURCE_STYLE[tag].cls}`}>
                          {SOURCE_STYLE[tag].label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Honest gate: no recipe is invented without the two real connections it needs */}
      <div className="grid min-h-[30vh] place-items-center">
        <div className="w-full max-w-md rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">No recipes yet, and none are invented here</h2>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            Generating real test recipes needs your winning-creative decode (what works for you) and competitor Ad
            Library gaps (what is open), both connect next. No recipes are invented here.
          </p>
        </div>
      </div>
    </div>
  );
}
