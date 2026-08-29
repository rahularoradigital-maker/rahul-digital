import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "@/lib/crypto";

// Creative Production — Shopify connection store. The access token is AES-256-GCM encrypted at rest via
// lib/crypto.ts (same envelope as the Meta OAuth token); it never leaves the server in plaintext. Service
// role only (shopify_connections is deny-by-default under RLS).

export type ShopifyConnection = { shopDomain: string; accessToken: string; apiVersion: string; status: string };

/** Store (or replace) a shop's connection. Pass a token for a real (custom-app or OAuth) connection, or
 *  omit it for the URL-only fallback. Returns false on write failure (caller reports it). */
export async function saveShopifyConnection(
  userId: string,
  shopDomain: string,
  accessToken: string | null,
  scopes: string | null,
  apiVersion = "2026-07",
  statusOverride?: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("shopify_connections").upsert(
    {
      user_id: userId,
      shop_domain: shopDomain,
      access_token_encrypted: accessToken ? encryptToken(accessToken) : null,
      scopes,
      api_version: apiVersion,
      status: statusOverride ?? (accessToken ? "connected" : "url_only"),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,shop_domain" },
  );
  return !error;
}

/** The user's most-recently-connected shop with a usable token, decrypted. null when none is connected. */
export async function readShopifyConnection(userId: string): Promise<ShopifyConnection | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("shopify_connections")
    .select("shop_domain, access_token_encrypted, api_version, status")
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.access_token_encrypted) return null;
  try {
    return {
      shopDomain: data.shop_domain as string,
      accessToken: decryptToken(data.access_token_encrypted as string),
      apiVersion: (data.api_version as string) ?? "2026-07",
      status: data.status as string,
    };
  } catch {
    return null; // key rotated / tampered payload -> treat as not connected rather than throw
  }
}

/** Lightweight "is a store connected?" for the UI (no token decrypt). Returns the shop + status or null. */
export async function getShopifyConnectionStatus(userId: string): Promise<{ shopDomain: string; status: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("shopify_connections")
    .select("shop_domain, status")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { shopDomain: data.shop_domain as string, status: data.status as string } : null;
}
