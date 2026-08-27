"use server";

import { createClient } from "@/lib/supabase/server";
import { bustCockpitCache } from "@/lib/meta-sync";

// Re-scan: drop the cached cockpit (both cache levels for this user) so the next render
// pulls the account fresh from Meta. The cockpit fetch is cached so page-to-page
// navigation is instant; this is how the user forces a live refresh on demand.
export async function rescanCockpit() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await bustCockpitCache(user?.id);
}
