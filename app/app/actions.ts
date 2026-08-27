"use server";

import { bustCockpitCache } from "@/lib/meta-sync";

// Re-scan: drop the cached cockpit so the next render pulls the account fresh from Meta.
// The cockpit fetch is cached for a short TTL so page-to-page navigation is instant;
// this is how the user forces a live refresh on demand.
export async function rescanCockpit() {
  bustCockpitCache();
}
