import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { getConnectionHealth } from "@/lib/connection/status";
import { ConnectionHealthCard } from "@/components/app/connection-health";
import { SettingsPanel } from "@/components/app/settings-panel";
import { DeleteAccountCard } from "@/components/app/delete-account-card";
import { getPendingDeletion } from "@/lib/account/deletion";
import { GRACE_PERIOD_DAYS } from "@/lib/account/deletion-manifest";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Settings: connected account, an honest per-source status list (no fake connections), and the
// editable CreativeScore verdict weights. This page only needs connection state + account name, so
// it does a single ad_accounts read (getUserMetaSession) instead of the full ~9s cockpit Meta pull
// loadCockpit would trigger - Settings now loads instantly, especially right after an account
// switch (which busts the cockpit cache and would otherwise force a cold pull here).

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const session = await getUserMetaSession(user.id);
  const data = { connected: !!session, accountName: session?.activeAccountName };
  // Honest connection health (freshness / last error / reconnect) - reads ad_sync_state, tenancy-scoped.
  const health = await getConnectionHealth(user.id, !!session, session?.activeExternalId ?? null);
  const pendingDeletion = await getPendingDeletion(user.id);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] text-[var(--ink-muted)]">Account and data sources</div>
        <h1 className="mt-1.5 text-[26px] font-normal tracking-tight">Settings</h1>
      </div>

      {/* Connected account */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-1 text-base font-normal">Connected account</div>
          {data.connected ? (
            <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
                <span className="font-medium">{data.accountName}</span>
              </div>
              <Button asChild variant="outline" className="rounded-full"><a href="/api/connect/meta/authorize">Switch account</a></Button>
            </div>
            <ConnectionHealthCard health={health} />
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-muted)]" />
                No account connected
              </div>
              <Button asChild className="rounded-full"><a href="/api/connect/meta/authorize">Connect Meta</a></Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data sources: honest status, no fake connections */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-1 text-base font-normal">Data sources</div>
          <div className="mb-4 text-[13px] text-muted-foreground">
            Only what is actually connected shows as connected. Nothing here is simulated.
          </div>
          <div className="divide-y divide-border">
            {/* Meta is the only connectable source today; the rest are honestly labelled "Coming soon"
                (Rahul ruling 2026-09-02) rather than "Not connected", which implied a connect path that
                does not exist yet. */}
            <SourceRow label="Meta" status={data.connected ? "connected" : "not-connected"} />
            <SourceRow label="Shopify" status="coming-soon" />
            <SourceRow label="GA4" status="coming-soon" />
            <SourceRow label="Finance sheet" status="coming-soon" />
            <SourceRow label="Creative decoder" status="coming-soon" />
          </div>
        </CardContent>
      </Card>

      {/* Editable verdict weights */}
      <SettingsPanel />

      {/* Data portability (GDPR): download a JSON copy of your own data. Read-only, secrets excluded. */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Export your data</h2>
          <p className="mt-2 text-[13px] text-[var(--ink-muted)]">Download a JSON copy of your account, connected ad accounts, and analysis data. Access tokens and secrets are never included.</p>
          <a href="/api/account/export" download className="mt-3 inline-flex">
            <Button variant="outline" size="sm">Download my data</Button>
          </a>
        </CardContent>
      </Card>

      {/* Danger zone: self-serve account deletion (soft-delete + grace). */}
      <DeleteAccountCard initialPurgeAfter={pendingDeletion?.purgeAfter ?? null} graceDays={GRACE_PERIOD_DAYS} />
    </div>
  );
}

function SourceRow({ label, status }: { label: string; status: "connected" | "not-connected" | "coming-soon" }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-[var(--ink)]">{label}</span>
      {status === "connected" ? (
        <span className="flex items-center gap-1.5 font-medium text-[var(--good-ink)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
          Connected
        </span>
      ) : status === "coming-soon" ? (
        <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink-muted)]">
          Coming soon
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
