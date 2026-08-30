import "server-only";
import { fetchWithTimeout } from "./http.ts";

// Operational alert channel. Posts to ALERT_WEBHOOK_URL (a Slack / Teams / Discord incoming-webhook, or any
// endpoint that accepts {text}). Keyless-graceful: with no webhook set it logs to the server (still captured
// by the platform), so an alert is never silently lost. NEVER throws - raising an alert must not break the
// job that raised it.

export type AlertSeverity = "info" | "warning" | "critical";

export async function sendAlert(input: { title: string; detail?: string; severity?: AlertSeverity; context?: Record<string, unknown> }): Promise<void> {
  const { title, detail, severity = "warning", context } = input;
  const icon = severity === "critical" ? "🔴" : severity === "warning" ? "🟠" : "🔵";
  const text = `${icon} AdBrain ${severity.toUpperCase()}: ${title}${detail ? `\n${detail}` : ""}${context ? `\n${JSON.stringify(context)}` : ""}`;
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) {
    console.warn(`[alert] ${severity}: ${title}${detail ? " - " + detail : ""}`);
    return;
  }
  try {
    await fetchWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }, 4_000);
  } catch (e) {
    console.error("[alert] send failed (logged instead):", title, e instanceof Error ? e.message : e);
  }
}
