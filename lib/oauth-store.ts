import "server-only"; // compile-time tripwire: decrypted OAuth tokens must never reach the client
import { encryptToken, decryptToken } from "./crypto";
import { createAdminClient } from "./supabase/admin";
import { recordAudit } from "./security/audit-log";
import type { TokenSet } from "./ad-source";

// Encrypt OAuth tokens and upsert them into oauth_tokens (server-only, via the service role).
// Returns nothing: token values must NEVER leave the server (audit F4 boundary).
export async function storeToken(adAccountId: string, tokens: TokenSet): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("oauth_tokens").upsert(
    {
      ad_account_id: adAccountId,
      encrypted_access: encryptToken(tokens.accessToken),
      encrypted_refresh: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      expires_at: tokens.expiresAt ? tokens.expiresAt.toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ad_account_id" },
  );
  if (error) throw new Error(`storeToken failed: ${error.message}`);
}

// Read + decrypt a stored token (server-only). Returns null if none exists.
// Decrypted values must NEVER be sent to the client.
//
// Tenant guard (defense in depth): the caller must pass the owning userId, and we enforce ownership at the
// query via the ad_accounts FK (ad_accounts!inner + user_id filter). So even if a caller ever passed an
// ad_account_id it did not verify, this returns null rather than another tenant's token - isolation no
// longer depends on call-site discipline alone.
export async function readToken(adAccountId: string, userId: string): Promise<TokenSet | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("oauth_tokens")
    .select("encrypted_access, encrypted_refresh, expires_at, ad_accounts!inner(user_id)")
    .eq("ad_account_id", adAccountId)
    .eq("ad_accounts.user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`readToken failed: ${error.message}`);
  if (!data) return null;
  return {
    accessToken: decryptToken(data.encrypted_access),
    refreshToken: data.encrypted_refresh ? decryptToken(data.encrypted_refresh) : undefined,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
  };
}

// Revoke a stored credential: verify the caller owns the account, then destroy the token and mark the account
// disconnected. Ownership-checked (never revoke another tenant's credential) and AUDITED (credentials.revoke).
// Returns true if a credential was revoked, false if none was found for this owner. The token value is never
// read or logged - only the fact of revocation is recorded.
export async function revokeToken(adAccountId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  // Ownership gate: the account must belong to this user, or we do nothing (and reveal nothing).
  const { data: owned } = await admin.from("ad_accounts").select("id").eq("id", adAccountId).eq("user_id", userId).maybeSingle();
  if (!owned) {
    await recordAudit({ action: "credential.revoke", actorId: userId, targetType: "ad_account", targetId: adAccountId, result: "denied", reason: "not owner / account not found" });
    return false;
  }
  const { error } = await admin.from("oauth_tokens").delete().eq("ad_account_id", adAccountId);
  await admin.from("ad_accounts").update({ status: "disconnected", is_active: false }).eq("id", adAccountId).eq("user_id", userId);
  await recordAudit({
    action: "credential.revoke",
    actorId: userId,
    targetType: "ad_account",
    targetId: adAccountId,
    after: { status: "disconnected" },
    result: error ? "error" : "ok",
    reason: error ? `revoke failed: ${error.message}` : "credential revoked",
  });
  return !error;
}
