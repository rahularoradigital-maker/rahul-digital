"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Camp = { id: string; name: string; objective?: string };

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split("; ");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx > -1 && p.slice(0, idx) === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return "";
}

// Campaign filter for the active account. Self-fetches (non-blocking), stores the choice
// in the "adbrain.campaign" cookie which loadCockpit reads on the server, then refreshes
// so every page re-scopes to that campaign. "All campaigns" clears the cookie.
export function CampaignSwitcher() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Camp[]>([]);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSelected(readCookie("adbrain.campaign"));
    let alive = true;
    fetch("/api/meta/campaigns")
      .then((r) => r.json())
      .then((d: { campaigns?: Camp[] }) => {
        if (!alive) return;
        setCampaigns(d.campaigns ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded || campaigns.length === 0) return null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelected(id);
    const maxAge = id ? 60 * 60 * 24 * 30 : 0;
    document.cookie = `adbrain.campaign=${encodeURIComponent(id)}; path=/; max-age=${maxAge}`;
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium">
      <span className="text-[var(--ink-muted)]">Campaign ·</span>
      <select
        value={selected}
        onChange={onChange}
        aria-label="Campaign"
        className="max-w-[150px] cursor-pointer truncate bg-transparent font-medium text-[var(--ink)] outline-none"
      >
        <option value="">All campaigns</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
