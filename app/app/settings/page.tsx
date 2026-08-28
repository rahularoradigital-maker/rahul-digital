import { loadCockpit } from "@/lib/app/cockpit-data";
import { SettingsPanel } from "@/components/app/settings-panel";

// Settings: connected account, an honest per-source status list (no fake
// connections), and the editable CreativeScore verdict weights (rulebook 5B.1 /
// 5E). loadCockpit(30) is only used here for connection state and account name,
// not for a data window, so 30 is an arbitrary but harmless default.

export default async function SettingsPage() {
  const data = await loadCockpit(30);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] text-[var(--ink-muted)]">Account and data sources</div>
        <h1 className="mt-1.5 text-[26px] font-normal tracking-tight">Settings</h1>
      </div>

      {/* Connected account */}
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <div className="mb-1 text-base font-normal">Connected account</div>
        {data.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
              <span className="font-medium text-[var(--ink)]">{data.accountName}</span>
            </div>
            <a
              href="/api/connect/meta/authorize"
              className="rounded-full border border-[var(--hairline)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
            >
              Switch account
            </a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-muted)]" />
              No account connected
            </div>
            <a
              href="/api/connect/meta/authorize"
              className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Connect Meta
            </a>
          </div>
        )}
      </div>

      {/* Data sources: honest status, no fake connections */}
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <div className="mb-1 text-base font-normal">Data sources</div>
        <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
          Only what is actually connected shows as connected. Nothing here is simulated.
        </div>
        <div className="divide-y divide-[var(--surface-alt)]">
          <SourceRow label="Meta" connected={data.connected} />
          <SourceRow label="Shopify" connected={false} />
          <SourceRow label="GA4" connected={false} />
          <SourceRow label="Finance sheet" connected={false} />
          <SourceRow label="Creative decoder" connected={false} />
        </div>
      </div>

      {/* Editable verdict weights */}
      <SettingsPanel />
    </div>
  );
}

function SourceRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-[var(--ink)]">{label}</span>
      {connected ? (
        <span className="flex items-center gap-1.5 font-medium text-[var(--good-ink)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
          Connected
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-[var(--ink-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-muted)]" />
          Not connected
        </span>
      )}
    </div>
  );
}
