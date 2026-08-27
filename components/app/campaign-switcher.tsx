"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";

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

// Campaign filter for the active account, as a SEARCHABLE dropdown (accounts can have 100+
// campaigns, so a plain select is unusable). Self-fetches; stores the choice in the
// "adbrain.campaign" cookie which loadCockpit reads server-side, then refreshes so every
// page re-scopes. "All campaigns" clears the cookie.
export function CampaignSwitcher() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Camp[]>([]);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => c.name.toLowerCase().includes(q));
  }, [campaigns, query]);

  if (!loaded || campaigns.length === 0) return null;

  function choose(id: string) {
    setSelected(id);
    setOpen(false);
    setQuery("");
    const maxAge = id ? 60 * 60 * 24 * 30 : 0;
    document.cookie = `adbrain.campaign=${encodeURIComponent(id)}; path=/; max-age=${maxAge}`;
    startTransition(() => router.refresh());
  }

  const label = selected ? campaigns.find((c) => c.id === selected)?.name ?? "1 campaign" : "All campaigns";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={FILTER_TRIGGER}
      >
        <span className={FILTER_LABEL}>Campaign</span>
        <span className="max-w-[150px] truncate">{label}</span>
        <span className={FILTER_LABEL}>▾</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-80 max-w-[85vw] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns..."
            aria-label="Search campaigns"
            className="mb-1.5 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <div className="max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => choose("")}
              className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${selected === "" ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
            >
              All campaigns
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c.id)}
                title={c.name}
                className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${selected === c.id ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
              >
                {c.name}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-2.5 py-2 text-[13px] text-[var(--ink-muted)]">No campaigns match.</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
