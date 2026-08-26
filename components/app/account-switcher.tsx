"use client";

import { useEffect, useState } from "react";

type Acct = { externalId: string; name: string; businessName?: string };

// Topbar account switcher (BM -> Account). Self-fetches the user's accounts client-side
// so it never slows the page render; caches in sessionStorage for a few minutes so it
// does not re-hit Meta on every navigation. Picking an account switches which account
// the whole dashboard analyses (server-side, via the select-account route).
export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [active, setActive] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const CACHE_KEY = "adbrain.accounts";
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; accounts: Acct[]; activeExternalId: string };
        if (Date.now() - cached.at < 5 * 60 * 1000) {
          setAccounts(cached.accounts ?? []);
          setActive(cached.activeExternalId ?? "");
          setLoaded(true);
          return () => {
            alive = false;
          };
        }
      }
    } catch {
      // ignore cache read errors
    }
    fetch("/api/meta/accounts")
      .then((r) => r.json())
      .then((d: { accounts?: Acct[]; activeExternalId?: string }) => {
        if (!alive) return;
        setAccounts(d.accounts ?? []);
        setActive(d.activeExternalId ?? "");
        setLoaded(true);
        try {
          sessionStorage.setItem("adbrain.accounts", JSON.stringify({ at: Date.now(), accounts: d.accounts ?? [], activeExternalId: d.activeExternalId ?? "" }));
        } catch {
          // ignore cache write errors
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded || accounts.length === 0) return null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const acct = accounts.find((a) => a.externalId === id);
    if (!id || !acct) return;
    window.location.href = `/api/connect/meta/select-account?id=${encodeURIComponent(id)}&name=${encodeURIComponent(acct.name)}`;
  }

  const groups = new Map<string, Acct[]>();
  for (const a of accounts) {
    const g = a.businessName ?? "Other";
    const list = groups.get(g) ?? [];
    list.push(a);
    groups.set(g, list);
  }

  return (
    <label className="hidden items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium xl:flex">
      <span className="text-[var(--ink-muted)]">Account ·</span>
      <select
        value={active}
        onChange={onChange}
        aria-label="Ad account"
        className="max-w-[150px] cursor-pointer truncate bg-transparent font-medium text-[var(--ink)] outline-none"
      >
        {Array.from(groups.entries()).map(([g, accts]) => (
          <optgroup key={g} label={g}>
            {accts.map((a) => (
              <option key={a.externalId} value={a.externalId}>
                {a.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
