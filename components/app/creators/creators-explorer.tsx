"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Mail, TrendingUp, Users, Activity, MapPin, SlidersHorizontal, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CreatorAvatar } from "@/components/ui/creator-avatar";
import { tierOf } from "@/lib/influencer/tiers";
import { guessGender, extractRegion, inEngBand, meetsConfidence, type EngBand, type MinConfidence } from "@/lib/influencer/derive";
import type { RankedCreator } from "@/lib/influencer/rank";
import type { Confidence } from "@/lib/influencer/types";

const fmt = (n: number | null): string => {
  if (n === null) return "n/a";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "K";
  return String(n);
};
const confBadge = (c: Confidence) => (c === "high" ? "success" : c === "medium" ? "warning" : "muted") as "success" | "warning" | "muted";
const scoreTone = (s: number) => (s >= 70 ? "good" : s >= 45 ? "warn" : "muted") as "good" | "warn" | "muted";

export function CreatorsExplorer({ creators, accountName }: { creators: RankedCreator[]; accountName: string }) {
  const [eng, setEng] = useState<EngBand>("any");
  const [gender, setGender] = useState<"any" | "f" | "m">("any");
  const [region, setRegion] = useState<string>("any");
  const [minConf, setMinConf] = useState<MinConfidence>("any");
  const [minFollowers, setMinFollowers] = useState<string>("");

  // Regions available in this run (creators' own stated locations, pulled from bios).
  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const r of creators) {
      const p = extractRegion(r.creator.bio.value);
      if (p) set.add(p);
    }
    return [...set].sort();
  }, [creators]);

  const filtered = useMemo(() => {
    const minF = parseInt(minFollowers.replace(/[^\d]/g, ""), 10);
    return creators
      .filter((r) => {
        const c = r.creator;
        if (!inEngBand(c.engagementRate.value, eng)) return false;
        if (Number.isFinite(minF) && (c.followers.value ?? 0) < minF) return false;
        if (gender !== "any" && guessGender(c.name.value).gender !== gender) return false;
        if (region !== "any" && extractRegion(c.bio.value) !== region) return false;
        if (!meetsConfidence(r.scorecard.quality.confidence, minConf)) return false;
        return true;
      })
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [creators, eng, gender, region, minConf, minFollowers]);

  const active = eng !== "any" || gender !== "any" || region !== "any" || minConf !== "any" || minFollowers !== "";
  const clear = () => { setEng("any"); setGender("any"); setRegion("any"); setMinConf("any"); setMinFollowers(""); };

  // Run a fresh discovery with the current filters as search inputs. min-followers drives what gets found;
  // the rest are applied server-side so the stored result matches. Costs provider credits, so it is explicit.
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const runSearch = async () => {
    setSearching(true);
    setSearchMsg(null);
    try {
      const res = await fetch("/api/influencer/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minFollowers: parseInt(minFollowers.replace(/[^\d]/g, ""), 10) || undefined, engagement: eng, gender, region, minConfidence: minConf }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string; count?: number };
      if (!d.ok) { setSearchMsg(d.error ?? "Search failed."); return; }
      startTransition(() => router.refresh());
    } catch {
      setSearchMsg("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };
  const busy = searching || pending;

  return (
    <div className="space-y-5">
      {/* Filter panel */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" /> Filters
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Engagement rate</span>
              <Select value={eng} onValueChange={(v) => setEng(v as EngBand)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1-5">1–5%</SelectItem>
                  <SelectItem value="5-10">5–10%</SelectItem>
                  <SelectItem value="10+">10%+</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Min. followers</span>
              <Input inputMode="numeric" placeholder="e.g. 50000" value={minFollowers} onChange={(e) => setMinFollowers(e.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Gender <span className="opacity-60">(inferred)</span></span>
              <Select value={gender} onValueChange={(v) => setGender(v as "any" | "f" | "m")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="f">Female</SelectItem>
                  <SelectItem value="m">Male</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Region <span className="opacity-60">(creator)</span></span>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All India</SelectItem>
                  {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Min. confidence</span>
              <Select value={minConf} onValueChange={(v) => setMinConf(v as MinConfidence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="medium">Medium+</SelectItem>
                  <SelectItem value="high">High only</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] text-muted-foreground"><span className="font-medium text-foreground">{filtered.length}</span> of {creators.length} shown{eng !== "any" ? ` · ${eng.replace("+", "%+").replace("-", "–")}% eng` : ""}</span>
            <div className="flex items-center gap-2">
              {active ? <Button variant="ghost" size="sm" onClick={clear} disabled={busy}>Clear</Button> : null}
              <Button size="sm" onClick={runSearch} disabled={busy}><Search /> {busy ? "Searching…" : "Run search with these filters"}</Button>
            </div>
          </div>
          {searchMsg ? <div className="mt-2 rounded-md border border-[var(--warn-ink)]/25 bg-[var(--warn-bg)] px-3 py-2 text-[12.5px] text-[var(--warn-ink)]">{searchMsg}</div> : null}
          <p className="mt-2 text-[11px] text-muted-foreground">Filters narrow the list instantly. <span className="font-medium">Run search</span> fetches a fresh set using min-followers as the search floor and applies the rest (uses provider credits).</p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No creators match these filters. Loosen them, or re-run the hunt for a fresh set.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => <CreatorRow key={r.creator.identity.platformUserId} r={r} />)}
        </div>
      )}
    </div>
  );
}

function CreatorRow({ r }: { r: RankedCreator }) {
  const c = r.creator;
  const q = r.scorecard.quality;
  const tier = c.followers.value !== null ? tierOf(c.followers.value) : null;
  const g = guessGender(c.name.value).gender;
  const region = extractRegion(c.bio.value);
  const reels = c.reels && c.reels.confidence !== "none" ? c.reels : null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row">
        {/* Left: identity */}
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex flex-col items-center gap-1">
            <CreatorAvatar src={c.avatarUrl} name={c.name.value ?? c.identity.handle} size={44} />
            <span className="text-[10px] font-medium text-muted-foreground">#{r.rank}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] font-semibold">{c.name.value ?? `@${c.identity.handle}`}</span>
              {c.verified.value ? <span title="verified" className="text-[var(--accent)]">✓</span> : null}
              <span className="text-[13px] text-muted-foreground">@{c.identity.handle}</span>
              {tier ? <Badge variant="muted" className="capitalize">{tier}</Badge> : null}
              <Badge variant={confBadge(q.confidence)}>{q.confidence} confidence</Badge>
            </div>
            {c.bio.value ? <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">{c.bio.value}</p> : null}
            <p className="mt-1.5 text-[13px]"><span className="font-medium">Why:</span> {r.topReason}</p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> <span className="font-medium text-foreground">{fmt(c.followers.value)}</span></span>
              <span className="inline-flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> <span className="font-medium text-foreground">{c.engagementRate.value != null ? (c.engagementRate.value * 100).toFixed(1) + "%" : "n/a"}</span> eng</span>
              {reels?.reachRatio != null ? <span className="inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> <span className="font-medium text-foreground">{reels.reachRatio.toFixed(1)}x</span> reach</span> : null}
              {region ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {region}</span> : null}
              {g ? <span className="capitalize">{g === "f" ? "female" : "male"} <span className="opacity-60">(guess)</span></span> : null}
            </div>
            {reels ? <p className="mt-1.5 text-[12px] text-muted-foreground">Reels · avg {fmt(reels.avgViews)} views · {reels.postsPerWeek ?? "?"}/week · {reels.daysSinceLastPost === 0 ? "posted today" : `posted ${reels.daysSinceLastPost}d ago`}</p> : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm"><Link href={`/app/creators/${c.identity.platformUserId}`}>View profile</Link></Button>
              {c.businessEmail.value ? <Button asChild size="sm" variant="outline"><a href={`mailto:${c.businessEmail.value}`}><Mail /> Email</a></Button> : null}
              <Button asChild size="sm" variant="ghost"><a href={c.identity.profileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> Instagram</a></Button>
            </div>
          </div>
        </div>

        {/* Right: quality + top signals */}
        <div className="shrink-0 lg:w-[240px] lg:border-l lg:border-border lg:pl-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quality</span>
            <span className={q.score >= 70 ? "text-[var(--good-ink)]" : q.score >= 45 ? "text-[var(--warn-ink)]" : "text-muted-foreground"}><span className="text-2xl font-semibold">{Math.round(q.score)}</span></span>
          </div>
          <div className="mt-2 space-y-1.5">
            {q.components.filter((x) => x.weight > 0).slice(0, 4).sort((a, b) => b.score * b.weight - a.score * a.weight).map((comp) => (
              <div key={comp.key} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] capitalize text-muted-foreground">{comp.key.replace(/_/g, " ")}</span>
                <Progress value={comp.score} tone={scoreTone(comp.score)} />
                <span className="w-6 shrink-0 text-right text-[11px] font-medium tabular-nums">{Math.round(comp.score)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
