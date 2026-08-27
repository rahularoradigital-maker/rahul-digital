import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Request-deduped current user. The app shell (layout) and the data loader both need
// the user on every page; React cache() collapses that to a single Supabase auth call
// per render instead of two round-trips.
export const getCurrentUser = cache(async () => {
  // A transient Supabase-auth failure must NOT throw here: this runs in the /app segment
  // LAYOUT, whose errors escape app/app/error.tsx and would hard-500 every route. Treat any
  // failure as "no user" (the caller redirects to /login), never an unhandled throw.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});
