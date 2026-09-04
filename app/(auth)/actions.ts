"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logEvent, failedLoginCount } from "@/lib/owner/events";
import { cancelAccountDeletion } from "@/lib/account/deletion";

export type AuthState = { error?: string; message?: string } | null;

// Security: brute-force lockout. After this many failed logins for one email inside the window, refuse
// further attempts until the window rolls off. Counts come from the append-only owner_events audit log,
// so there is no lockout state to store or expire - it is a rolling count of recent failures.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60_000; // 15 minutes

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Refuse before touching auth once too many recent failures are on record for this email. Generic
  // message (no "account exists" signal) so it can't be used to enumerate real accounts.
  if (email && (await failedLoginCount(email, LOCKOUT_WINDOW_MS)) >= LOCKOUT_THRESHOLD) {
    return { error: "Too many failed attempts. Please wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    logEvent("login.failed", { meta: { email } }); // feeds the lockout counter + the audit trail
    return { error: error.message };
  }
  logEvent("login", { userId: data.user?.id ?? null });
  // "Re-login cancels" (Rahul's deletion decision): signing back in during the grace aborts a pending
  // account deletion. One write, only at login, and a no-op unless a pending row exists. Best-effort - a
  // hiccup here must never block a valid sign-in.
  if (data.user?.id) await cancelAccountDeletion(data.user.id).catch(() => {});
  redirect("/app");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  logEvent("signup", { userId: data.user?.id ?? null });
  if (!data.session) {
    return { message: "Check your email to confirm your account, then log in." };
  }
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  logEvent("logout", { userId: data.user?.id ?? null });
  redirect("/");
}
