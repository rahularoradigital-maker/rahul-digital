import { encryptToken } from "./crypto";
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
