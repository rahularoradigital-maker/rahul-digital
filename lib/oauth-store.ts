import { encryptToken, decryptToken } from "./crypto";
import { createAdminClient } from "./supabase/admin";
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
export async function readToken(adAccountId: string): Promise<TokenSet | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("oauth_tokens")
    .select("encrypted_access, encrypted_refresh, expires_at")
    .eq("ad_account_id", adAccountId)
    .maybeSingle();
  if (error) throw new Error(`readToken failed: ${error.message}`);
  if (!data) return null;
  return {
    accessToken: decryptToken(data.encrypted_access),
    refreshToken: data.encrypted_refresh ? decryptToken(data.encrypted_refresh) : undefined,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
  };
}
