// Shared "honest gate" card for a section that mostly needs data we do not have yet.
// Matches the ConnectState aesthetic (icon bubble + centered card) so an ungated and
// a gated screen never feel like two different apps. No fabricated numbers, no fake
// charts: just what this will show and what it needs to turn on.

export function GatedSection({
  title,
  what,
  delivers,
  needs,
  note,
}: {
  title: string;
  what: string;
  delivers: string[];
  needs: string;
  note?: string;
}) {
  return (
    <div className="grid min-h-[52vh] place-items-center">
      <div className="w-full max-w-lg rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <h2 className="text-lg font-normal text-[var(--ink)]">{title}</h2>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">{what}</p>

        <div className="mt-5 rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] p-4 text-left">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            This will show
          </div>
          <ul className="space-y-1.5">
            {delivers.map((d) => (
              <li key={d} className="flex gap-2 text-[13px] text-[var(--ink)]">
                <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-[var(--ink-muted)]">Needs: {needs}</p>
        {note ? <p className="mt-1.5 text-xs text-[var(--ink-muted)]">{note}</p> : null}
      </div>
    </div>
  );
}
