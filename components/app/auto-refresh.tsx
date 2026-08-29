"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the server component after a short delay. Used by the "syncing" state: a cold pull warms
// the cache in the background, so a refresh a few seconds later serves the real data. If it is still
// warming, the page renders the syncing state again and this remounts and retries - a self-healing
// loop that needs no manual reload. router.refresh() re-runs the RSC without a full navigation.
export function AutoRefresh({ seconds = 4 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.refresh(), seconds * 1000);
    return () => clearTimeout(t);
  }, [router, seconds]);
  return null;
}
