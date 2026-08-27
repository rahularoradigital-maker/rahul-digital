import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Request-deduped current user. The app shell (layout) and the data loader both need
// the user on every page; React cache() collapses that to a single Supabase auth call
// per render instead of two round-trips.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
