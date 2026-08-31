import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadLatestDiscovery } from "@/lib/influencer/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreatorAvatar } from "@/components/ui/creator-avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { tierOf } from "@/lib/influencer/tiers";
import { guessGender, extractRegion } from "@/lib/influencer/derive";
import type { Confidence } from "@/lib/influencer/types";

export const maxDuration = 60;

const fmt = (n: number | null): string => {
  if (n === null) return "n/a";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "K";
  return String(n);
};
const confBadge = (c: Confidence) => (c === "high" ? "success" : c === "medium" ? "warning" : "muted") as "success" | "warning" | "muted";
const tone = (s: number) => (s >= 70 ? "good" : s >= 45 ? "warn" : "muted") as "good" | "warn" | "muted";
const LABEL: Record<string, string> = { brand_fit: "Brand fit", audience_fit: "Audience fit", content_fit: "Content fit", engagement: "Engagement", reach: "Reach", consistency: "Consistency", safety: "Safety" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const session = user ? await getUserMetaSession(user.id) : null;
  const run = user && session ? await loadLatestDiscovery(user.id, session.activeExternalId) : null;
  const row = run?.ranked.find((r) => r.creator.identity.platformUserId === id);
  if (!row) notFound();

  const c = row.creator;
  const q = row.scorecard.quality;
  const tier = c.followers.value !== null ? tierOf(c.followers.value) : null;
  const g = guessGender(c.name.value).gender;
  const region = extractRegion(c.bio.value);
  const reels = c.reels && c.reels.confidence !== "none" ? c.reels : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/app/creators" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Influencer Hunt
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <CreatorAvatar src={c.avatarUrl} name={c.name.value ?? c.identity.handle} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-[22px] font-medium tracking-tight">{c.name.value ?? `@${c.identity.handle}`}</h1>
              {c.verified.value ? <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" /> : null}
              <a href={c.identity.profileUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted-foreground hover:underline">@{c.identity.handle}</a>
              {tier ? <Badge variant="muted" className="capitalize">{tier}</Badge> : null}
              <Badge variant={confBadge(q.confidence)}>{q.confidence} confidence</Badge>
            </div>
            {c.bio.value ? <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{c.bio.value}</p> : null}
            <p className="mt-2 text-[13px]"><span className="font-medium">Why this creator:</span> {row.topReason}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.businessEmail.value ? <Button asChild size="sm" variant="outline"><a href={`mailto:${c.businessEmail.value}`}><Mail /> {c.businessEmail.value}</a></Button> : <Badge variant="muted">No public email</Badge>}
              <Button asChild size="sm" variant="ghost"><a href={c.identity.profileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open on Instagram</a></Button>
            </div>
          </div>
          <div className="shrink-0 text-center">
            <div className={`text-4xl font-semibold ${q.score >= 70 ? "text-[var(--good-ink)]" : q.score >= 45 ? "text-[var(--warn-ink)]" : "text-muted-foreground"}`}>{Math.round(q.score)}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">quality</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scores">Score breakdown</TabsTrigger>
          <TabsTrigger value="reels">Reels &amp; reach</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Followers" value={fmt(c.followers.value)} />
            <Stat label="Engagement" value={c.engagementRate.value != null ? (c.engagementRate.value * 100).toFixed(1) + "%" : "n/a"} />
            <Stat label="Reel reach" value={reels?.reachRatio != null ? reels.reachRatio.toFixed(1) + "x" : "n/a"} />
            <Stat label="Posts" value={fmt(c.postsCount.value)} />
            <Stat label="Region (creator)" value={region ?? "unknown"} />
            <Stat label="Gender (guess)" value={g ? (g === "f" ? "female" : "male") : "unknown"} />
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">Region is the creator&apos;s own stated location (from their bio), not their audience. Gender is inferred from the name (low confidence). Audience demographics are not available from public data.</p>
        </TabsContent>

        <TabsContent value="scores">
          <Card>
            <CardContent className="space-y-3 p-5">
              {q.components.map((comp) => (
                <div key={comp.key}>
                  <div className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[13px]">{LABEL[comp.key] ?? comp.key}</span>
                    <Progress value={comp.confidence === "none" ? 0 : comp.score} tone={comp.confidence === "none" ? "muted" : tone(comp.score)} />
                    <span className="w-8 shrink-0 text-right text-[13px] font-medium tabular-nums">{comp.confidence === "none" ? "—" : Math.round(comp.score)}</span>
                    <span className="w-12 shrink-0 text-right text-[10px] uppercase tracking-wide text-muted-foreground">×{comp.weight.toFixed(2)}</span>
                  </div>
                  <p className="ml-24 pl-3 text-[11px] leading-snug text-muted-foreground">{comp.reason}</p>
                </div>
              ))}
              <Separator />
              <p className="text-[12px] text-muted-foreground">{q.formula}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reels">
          {reels ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Avg views / reel" value={fmt(reels.avgViews)} />
              <Stat label="Reach (views ÷ followers)" value={reels.reachRatio != null ? reels.reachRatio.toFixed(1) + "x" : "n/a"} />
              <Stat label="Reel engagement" value={reels.reelEngagementRate != null ? (reels.reelEngagementRate * 100).toFixed(1) + "%" : "n/a"} />
              <Stat label="Posting cadence" value={reels.postsPerWeek != null ? reels.postsPerWeek + "/week" : "n/a"} />
              <Stat label="Last posted" value={reels.daysSinceLastPost != null ? (reels.daysSinceLastPost === 0 ? "today" : reels.daysSinceLastPost + "d ago") : "n/a"} />
              <Stat label="Reels sampled" value={String(reels.sampled)} />
            </div>
          ) : (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No reel data available for this creator.</CardContent></Card>
          )}
          {reels ? <p className="mt-3 text-[12px] text-muted-foreground">Reach above 1x means the creator&apos;s reels are seen by more people than just their followers — the strongest organic-amplification signal, computed from {reels.sampled} recent reels.</p> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
