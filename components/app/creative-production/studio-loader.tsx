"use client";

import dynamic from "next/dynamic";

// The Creative Studio is a ~1000-line client component and the whole body of the page. Load it via
// next/dynamic with ssr:false so its JS is a deferred chunk fetched after the page shell paints, instead of
// bloating the initial load. It takes no server props and is a fully interactive, auth-gated tool (no SEO),
// so client-only rendering is correct. A lightweight skeleton shows while the chunk loads.
const CreativeStudio = dynamic(() => import("./studio").then((m) => m.CreativeStudio), {
  ssr: false,
  loading: () => (
    <div className="space-y-4" aria-busy="true" aria-label="Loading Creative Studio">
      <div className="h-10 w-64 animate-pulse rounded-md bg-[var(--surface-alt)]" />
      <div className="h-40 w-full animate-pulse rounded-xl bg-[var(--surface-alt)]" />
      <div className="h-64 w-full animate-pulse rounded-xl bg-[var(--surface-alt)]" />
    </div>
  ),
});

export function StudioLoader() {
  return <CreativeStudio />;
}
