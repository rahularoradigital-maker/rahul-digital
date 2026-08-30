// The "intelligent" half of the Notification Center: translate a technical failure into a plain-English
// notification a non-technical user understands - WHAT broke, WHY, and WHAT to do - and NEVER leak a raw
// stack trace or secret. PURE (no I/O) so it is unit-tested. Any unrecognized error falls back to a safe,
// generic message; the raw text is kept only in `context` for support, never shown as the detail.

export type NotifSeverity = "success" | "info" | "warning" | "error";
export type Humanized = { title: string; detail: string; action?: string; severity: NotifSeverity };

// Match against the real failure signals AdBrain produces (Meta Graph, ScrapeCreators, Gemini, sync state).
// Order matters: most specific first.
export function humanizeError(raw: string | null | undefined, source?: string): Humanized {
  const m = (raw ?? "").toLowerCase();

  // ScrapeCreators / competitor data source out of credits (HTTP 402). Match 402 as a bounded token, not a
  // substring - Meta subcodes like 1504022 contain "402" and would otherwise be misread as an out-of-credits.
  if (/\b402\b/.test(m) || m.includes("payment required") || m.includes("out of credit")) {
    return {
      title: "Competitor data source is out of credits",
      detail: "The service AdBrain uses to pull competitor ads has run out of credits, so competitor intelligence can't refresh right now.",
      action: "Top up the ScrapeCreators plan (or connect Meta Ad Library) to resume.",
      severity: "error",
    };
  }
  // Meta Ad Library identity verification (Graph subcode 2332002).
  if (m.includes("2332002") || (m.includes("ad_archive") && m.includes("verif")) || m.includes("identity verification")) {
    return {
      title: "Meta Ad Library needs identity verification",
      detail: "Meta requires a verified identity before it will return competitor ads from the Ad Library.",
      action: "Complete Meta identity verification, then re-run the competitor pull.",
      severity: "warning",
    };
  }
  // Meta app-level rate limit (Graph code 4 / subcode 1504022) - transient, self-clears.
  if (m.includes("1504022") || m.includes("application request limit") || m.includes("too many api requests") || (m.includes("rate") && m.includes("limit") && m.includes("meta"))) {
    return {
      title: "Meta is briefly rate-limiting this account",
      detail: "Meta has temporarily limited how many requests we can make. This clears on its own in a few minutes.",
      action: "No action needed - the sync retries automatically.",
      severity: "warning",
    };
  }
  // Meta token / OAuth expired or revoked.
  if (m.includes("oauthexception") || (m.includes("token") && (m.includes("expired") || m.includes("invalid") || m.includes("revoked"))) || m.includes("reconnect")) {
    return {
      title: "Your Meta connection needs re-authorizing",
      detail: "AdBrain can't reach your Meta ad account - the connection has expired or was revoked.",
      action: "Reconnect Meta from Settings to restore live data.",
      severity: "error",
    };
  }
  // AI provider (Gemini free tier) busy / rate-limited (429 / 503).
  if ((m.includes("gemini") || m.includes("generativelanguage")) && (m.includes("429") || m.includes("503") || m.includes("quota") || m.includes("overloaded"))) {
    return {
      title: "The AI is busy right now",
      detail: "The AI provider is temporarily overloaded, so this analysis couldn't complete.",
      action: "Try again in a minute - nothing was lost.",
      severity: "warning",
    };
  }
  // Scheduled sync disabled (CRON_SECRET not configured).
  if (m.includes("cron_secret") || m.includes("cron is not configured") || m.includes("not configured")) {
    return {
      title: "Automatic refresh isn't enabled yet",
      detail: "Scheduled background syncs are turned off, so data only refreshes when you re-scan manually.",
      action: "Set CRON_SECRET in the deployment to enable nightly auto-refresh.",
      severity: "info",
    };
  }
  // Metadata half of the day-wise sync failed (ad_sync_state.last_error = "metadata: ...").
  if (m.startsWith("metadata:") || (m.includes("ad_meta") && m.includes("upsert"))) {
    return {
      title: "Some ad details didn't finish syncing",
      detail: "The performance numbers synced, but a few ads' names/creatives didn't. The cockpit still works; those ads may show less detail until the next sync.",
      action: "Re-run the sync; it retries the missing ads automatically.",
      severity: "warning",
    };
  }

  // Fallback: never expose the raw message as the detail. Keep it safe + generic; support can read `context`.
  return {
    title: source ? `Something went wrong while ${source}` : "Something went wrong",
    detail: "We hit an unexpected issue and stopped safely - no data was lost. Our team can see the technical details.",
    action: "Try again shortly; if it keeps happening, contact support.",
    severity: "error",
  };
}
