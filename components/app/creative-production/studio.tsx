"use client";

import { useCallback, useEffect, useState } from "react";

// Creative Studio workflow (Phases 10, 14, 22, 27, 28 UI). One stateful client component drives the whole
// flow: connect/sync Shopify -> pick up to 10 products -> understand the brand (+ Brand Control Panel) ->
// ranked concepts (formula-scored, with "why") -> generate QA'd assets -> approve/reject -> export.
// Everything is DRAFTS: nothing is auto-published to Meta. Provider-independent: with no image key the
// pipeline composes deterministic placeholders so the flow is fully testable end-to-end.

type Product = { productId: string; title: string; description: string; price: number | null; compareAtPrice: number | null; image: string | null; status: string | null; productType: string | null };
type Concept = { id: string; formatId: string; headline: string; supportingCopy: string; cta: string; offer: string | null; angle: string; whyThisConcept: string; whyNow: string; score: number; awarenessStage: string; visualDirection: string };
type QA = { status: "READY" | "REVIEW" | "FAILED"; checks: { name: string; pass: boolean; severity: string; detail: string }[] };
type Asset = { creativeId: string; formatId: string; provider: string; qa: QA; approval: string; costUsd: number; url: string | null };
type Brand = { palette: { primary: string; secondary: string; background: string; text: string }; fonts: { heading: string; body: string }; imageStyle: string; designStyle: string; ctaStyle: string; tone: string; density: string; source: string; version: number };

const CARD = "rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)]";
const BTN = "rounded-[var(--radius-pill)] px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} bg-[var(--accent)] text-white hover:opacity-90`;
const BTN_GHOST = `${BTN} border border-[var(--hairline)] text-[var(--ink)] hover:border-[var(--accent)]`;
const MAX_SELECT = 10;

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

function money(n: number | null): string {
  return n == null ? "" : `$${n.toFixed(2)}`;
}

export function CreativeStudio() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"meta" | "google">("meta");
  // connect form
  const [formDomain, setFormDomain] = useState("");
  const [formToken, setFormToken] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await jsonFetch<{ connected: boolean; shopDomain: string | null; products: Product[] }>("/api/creative-production/products");
      setConnected(r.connected);
      setShopDomain(r.shopDomain);
      setProducts(r.products);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setErr(null);
    setBusy(key);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(null); }
  };

  const connect = () => run("connect", async () => {
    await jsonFetch("/api/creative-production/shopify/connect", { method: "POST", body: JSON.stringify({ shopDomain: formDomain.trim(), accessToken: formToken.trim(), urlOnly: !formToken.trim() }) });
    await jsonFetch("/api/creative-production/shopify/sync", { method: "POST" });
    await loadProducts();
  });

  const sync = () => run("sync", async () => {
    await jsonFetch("/api/creative-production/shopify/sync", { method: "POST" });
    await loadProducts();
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_SELECT) { setErr(`You can select up to ${MAX_SELECT} products per batch.`); return prev; }
      setErr(null);
      return [...prev, id];
    });
  };

  const deriveBrand = () => run("brand", async () => {
    const r = await jsonFetch<{ brand: Brand }>("/api/creative-production/brand", { method: "POST", body: JSON.stringify({ action: "derive" }) });
    setBrand(r.brand);
  });
  const resetBrand = () => run("brand", async () => {
    const r = await jsonFetch<{ brand: Brand }>("/api/creative-production/brand", { method: "POST", body: JSON.stringify({ action: "reset" }) });
    setBrand(r.brand);
  });
  const saveBrandField = (field: keyof Brand | "primary", value: string) => run("brand", async () => {
    const override = field === "primary" ? { palette: { primary: value } } : { [field]: value };
    const r = await jsonFetch<{ brand: Brand }>("/api/creative-production/brand", { method: "POST", body: JSON.stringify({ action: "override", override }) });
    setBrand(r.brand);
  });

  const openProduct = (id: string) => run("concepts:" + id, async () => {
    setActive(id);
    setConcepts([]);
    setAssets([]);
    const r = await jsonFetch<{ product?: unknown; concepts: Concept[] }>("/api/creative-production/concepts", { method: "POST", body: JSON.stringify({ productId: id }) });
    setConcepts(r.concepts);
    const a = await jsonFetch<{ assets: Asset[] }>(`/api/creative-production/assets?productId=${encodeURIComponent(id)}`);
    setAssets(a.assets);
  });

  const generate = (conceptId: string) => run("gen:" + conceptId, async () => {
    if (!active) return;
    const r = await jsonFetch<{ assets: Asset[] }>("/api/creative-production/generate", { method: "POST", body: JSON.stringify({ conceptId, productId: active, platform }) });
    // merge/replace by creativeId
    setAssets((prev) => {
      const byId = new Map(prev.map((x) => [x.creativeId, x]));
      for (const a of r.assets) byId.set(a.creativeId, a);
      return [...byId.values()];
    });
  });

  const setApproval = (creativeId: string, approval: string) => run("appr:" + creativeId, async () => {
    await jsonFetch("/api/creative-production/assets", { method: "POST", body: JSON.stringify({ creativeId, approval }) });
    setAssets((prev) => prev.map((a) => (a.creativeId === creativeId ? { ...a, approval } : a)));
  });

  if (loading) return <p className="text-[14px] text-[var(--ink-muted)]">Loading Studio…</p>;

  return (
    <div className="space-y-6">
      {err ? <div className={`${CARD} border-red-500/40 bg-red-500/5 px-4 py-3 text-[13px] text-red-500`}>{err}</div> : null}

      {/* CONNECT */}
      {!connected ? (
        <div className={`${CARD} p-5 space-y-3`}>
          <h2 className="text-[16px] font-medium">Add your store</h2>
          <p className="text-[13px] text-[var(--ink-muted)]">Just paste your store website. If it is a Shopify store, Studio pulls in every published product automatically. No login or API key needed.</p>
          <div className="flex flex-wrap gap-2">
            <input value={formDomain} onChange={(e) => setFormDomain(e.target.value)} placeholder="your-store.com" className="min-w-[280px] flex-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-[13px]" />
            <button className={BTN_PRIMARY} disabled={busy === "connect" || !formDomain.trim()} onClick={connect}>{busy === "connect" ? "Fetching products…" : "Fetch products"}</button>
          </div>
          <details className="text-[12px] text-[var(--ink-muted)]">
            <summary className="cursor-pointer select-none">Have an Admin API token? (optional — for private/full data)</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <input value={formToken} onChange={(e) => setFormToken(e.target.value)} placeholder="shpat_… (Admin API token)" className="min-w-[280px] flex-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-[13px]" />
              <span className="text-[11px]">A token also pulls unpublished products, inventory and metafields. The public feed covers published products, prices and images.</span>
            </div>
          </details>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-[var(--ink-muted)]">Connected: <span className="text-[var(--ink)]">{shopDomain}</span> · {products.length} products</p>
          <button className={BTN_GHOST} disabled={busy === "sync"} onClick={sync}>{busy === "sync" ? "Syncing…" : "Re-sync catalogue"}</button>
        </div>
      )}

      {connected ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* LEFT: brand + product picker */}
          <div className="space-y-5">
            <BrandPanel brand={brand} busy={busy === "brand"} onDerive={deriveBrand} onReset={resetBrand} onSave={saveBrandField} />

            <div className={`${CARD} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-medium">Products</h2>
                <span className="text-[12px] text-[var(--ink-muted)]">{selected.length}/{MAX_SELECT} selected</span>
              </div>
              {products.length === 0 ? (
                <p className="text-[13px] text-[var(--ink-muted)]">No products yet. Re-sync the catalogue.</p>
              ) : (
                <div className="grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {products.map((p) => {
                    const isSel = selected.includes(p.productId);
                    return (
                      <div key={p.productId} className={`rounded-[12px] border p-2.5 transition ${isSel ? "border-[var(--accent)]" : "border-[var(--hairline)]"}`}>
                        <div className="flex gap-2.5">
                          {p.image ? <img src={p.image} alt="" className="h-14 w-14 shrink-0 rounded-[8px] object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-[8px] bg-[var(--hairline)]" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">{p.title}</p>
                            <p className="text-[12px] text-[var(--ink-muted)]">{money(p.price)}{p.compareAtPrice && p.price && p.compareAtPrice > p.price ? <span className="ml-1 line-through">{money(p.compareAtPrice)}</span> : null}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button className={`${BTN_GHOST} flex-1 py-1.5`} onClick={() => toggleSelect(p.productId)}>{isSel ? "Selected" : "Select"}</button>
                          <button className={`${BTN_PRIMARY} flex-1 py-1.5`} disabled={busy === "concepts:" + p.productId} onClick={() => openProduct(p.productId)}>{busy === "concepts:" + p.productId ? "…" : "Concepts"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: concepts + assets for the active product */}
          <div className="space-y-5">
            {!active ? (
              <div className={`${CARD} p-6 text-[13px] text-[var(--ink-muted)]`}>Pick a product and press <span className="text-[var(--ink)]">Concepts</span> to see formula-ranked creative ideas, then generate ad assets.</div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[var(--ink-muted)]">Platform:</span>
                  {(["meta", "google"] as const).map((pf) => (
                    <button key={pf} className={pf === platform ? BTN_PRIMARY : BTN_GHOST} onClick={() => setPlatform(pf)}>{pf === "meta" ? "Meta" : "Google"}</button>
                  ))}
                </div>

                {concepts.length === 0 ? (
                  <p className="text-[13px] text-[var(--ink-muted)]">No concepts yet.</p>
                ) : concepts.map((c) => {
                  const cAssets = assets.filter((a) => a.creativeId.includes(c.id));
                  return (
                    <div key={c.id} className={`${CARD} p-4 space-y-3`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium">{c.headline || c.angle}</p>
                          <p className="text-[12px] text-[var(--ink-muted)]">{c.formatId} · {c.awarenessStage} · score {c.score}</p>
                        </div>
                        <button className={BTN_PRIMARY} disabled={busy === "gen:" + c.id} onClick={() => generate(c.id)}>{busy === "gen:" + c.id ? "Generating…" : "Generate"}</button>
                      </div>
                      {c.supportingCopy ? <p className="text-[13px]">{c.supportingCopy}</p> : null}
                      <p className="text-[12px] text-[var(--ink-muted)]"><span className="text-[var(--ink)]">Why:</span> {c.whyThisConcept}</p>
                      <div className="flex flex-wrap gap-2 text-[12px]">
                        {c.cta ? <span className="rounded-[6px] bg-[var(--hairline)] px-2 py-0.5">CTA: {c.cta}</span> : null}
                        {c.offer ? <span className="rounded-[6px] bg-[var(--hairline)] px-2 py-0.5">Offer: {c.offer}</span> : null}
                      </div>
                      {cAssets.length ? (
                        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                          {cAssets.map((a) => <AssetCard key={a.creativeId} asset={a} busy={busy === "appr:" + a.creativeId} onApprove={() => setApproval(a.creativeId, "approved")} onReject={() => setApproval(a.creativeId, "rejected")} />)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function qaColor(status: string): string {
  return status === "READY" ? "text-emerald-500" : status === "REVIEW" ? "text-amber-500" : "text-red-500";
}

function AssetCard({ asset, busy, onApprove, onReject }: { asset: Asset; busy: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] p-2">
      <div className="aspect-square overflow-hidden rounded-[6px] bg-[var(--hairline)]">
        {asset.url ? <img src={asset.url} alt={asset.formatId} className="h-full w-full object-contain" /> : null}
      </div>
      <p className="mt-1.5 truncate text-[11px] text-[var(--ink-muted)]">{asset.formatId}</p>
      <p className={`text-[11px] font-medium ${qaColor(asset.qa?.status ?? "")}`}>QA {asset.qa?.status ?? "?"}{asset.provider === "stub" ? " · placeholder" : ""}</p>
      <div className="mt-1.5 flex gap-1">
        <button className={`flex-1 rounded-[6px] py-1 text-[11px] font-medium ${asset.approval === "approved" ? "bg-emerald-500 text-white" : "border border-[var(--hairline)]"}`} disabled={busy} onClick={onApprove}>✓</button>
        <button className={`flex-1 rounded-[6px] py-1 text-[11px] font-medium ${asset.approval === "rejected" ? "bg-red-500 text-white" : "border border-[var(--hairline)]"}`} disabled={busy} onClick={onReject}>✕</button>
        {asset.url ? <a className="flex-1 rounded-[6px] border border-[var(--hairline)] py-1 text-center text-[11px] font-medium" href={asset.url} target="_blank" rel="noreferrer">↧</a> : null}
      </div>
    </div>
  );
}

function BrandPanel({ brand, busy, onDerive, onReset, onSave }: { brand: Brand | null; busy: boolean; onDerive: () => void; onReset: () => void; onSave: (field: "primary" | keyof Brand, value: string) => void }) {
  const val = (v: string) => (v && v !== "UNKNOWN" ? v : "");
  return (
    <div className={`${CARD} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium">Brand DNA</h2>
        <div className="flex gap-2">
          <button className={BTN_GHOST} disabled={busy} onClick={onReset}>Defaults</button>
          <button className={BTN_PRIMARY} disabled={busy} onClick={onDerive}>{busy ? "…" : brand ? "Re-derive" : "Understand brand"}</button>
        </div>
      </div>
      {!brand ? (
        <p className="text-[13px] text-[var(--ink-muted)]">Derive your brand identity from your store, then fine-tune it in the control panel.</p>
      ) : (
        <div className="space-y-2 text-[12px]">
          <p className="text-[var(--ink-muted)]">Source: {brand.source} · v{brand.version} · tone {val(brand.tone) || "—"}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2">Primary
              <input type="color" value={val(brand.palette.primary) || "#3b6ef5"} onChange={(e) => onSave("primary", e.target.value)} className="h-6 w-10 rounded border border-[var(--hairline)]" />
            </label>
            <label className="flex items-center gap-2">Tone
              <input defaultValue={val(brand.tone)} onBlur={(e) => e.target.value !== val(brand.tone) && onSave("tone", e.target.value)} className="min-w-0 flex-1 rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
