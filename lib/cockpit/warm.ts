import "server-only";
import { fetchLiveCockpit } from "../meta-sync.ts";

// The ONE window a default page load uses: resolveCockpitScope forces COMPARISON_DAYS (90) unless the user
// picks another window in the topbar, so warming 90 covers the view every user lands on. Matches the cron's
// WARM_WINDOWS so the pre-warmed key is exactly the one the page reads.
const WARM_WINDOW_DAYS = 90;

// Pre-warm the default cockpit view's cache right after a sync COMPLETES, server-side where nobody waits, so
// the first user load reads a warm cockpit_cache row instead of paying the cold Meta pull (~8s) on their own
// request. fetchLiveCockpit resolves the user's ACTIVE account itself (the only account the page shows) and
// writes the L2 cache as a side effect - we just need to trigger it.
//
// Best-effort BY CONTRACT: callers wrap this in .catch()/after() - a warm failure must NEVER affect the sync
// outcome or delay the response. This is why the cold path (queue sync, on-demand sync) was still slow: the
// non-queue cron warmed the cache but the completion paths (ingest/run, continue-hop, sync-account job) did
// not, so the first load after those syncs was cold. Warming here closes that gap.
export async function warmCockpitCache(userId: string): Promise<void> {
  await fetchLiveCockpit(userId, WARM_WINDOW_DAYS);
}
