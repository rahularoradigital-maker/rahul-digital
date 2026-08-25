export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Your brands</h1>
      <p className="mt-1 text-[var(--muted)]">
        Create a brand to start building its Brand Brain and get your first test plan.
      </p>

      <div className="mt-10 rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
        <p className="text-lg font-medium">No brands yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
          Phase 1 adds brand creation, competitor ad scanning, and the ranked weekly test plan.
          The foundation is live: you are logged in and the app is wired to Claude and your database.
        </p>
        <button
          disabled
          className="mt-6 cursor-not-allowed rounded-lg bg-[var(--brand)] px-5 py-2.5 font-medium text-[var(--brand-foreground)] opacity-60"
        >
          Create a brand (coming in Phase 1)
        </button>
      </div>
    </div>
  );
}
