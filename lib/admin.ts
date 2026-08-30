// Admin allowlist for the internal cost/ops console. Access is gated by email against ADMIN_EMAILS
// (comma-separated), defaulting to the founder account. Node-safe (env read only), no secrets.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "digitalwave27@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
