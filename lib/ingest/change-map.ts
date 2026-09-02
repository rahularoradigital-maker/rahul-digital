// Pure mapping of a Meta Ad-Activity row -> our ad_changes row shape. No I/O, no server-only, so the gate
// (scripts/check-change-ingest.ts) can exercise it in plain Node. Meta's activities give actor_id/actor_name
// (NOT email), an event_type, the affected object + object_type, and a JSON extra_data with old->new values.

export type RawActivity = {
  event_type?: string;
  event_time?: string;
  actor_id?: string | number;
  actor_name?: string;
  object_id?: string | number;
  object_name?: string;
  object_type?: string;
  extra_data?: string | Record<string, unknown>;
  translated_event_type?: string;
};

export type ChangeRow = {
  change_id: string;
  event_time: string;
  date: string;
  level: "account" | "campaign" | "adset" | "ad";
  object_id: string | null;
  object_name: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  event_type: string;
  change_type: string;
  source: "buyer" | "algo";
  actor_id: string | null;
  actor_name: string | null;
  extra_data: Record<string, unknown> | null;
};

// Normalize Meta's ~80 event_types into a small vocabulary the impact engine + change-log.ts brain reason over.
export function normalizeChangeType(eventType: string): string {
  const e = eventType.toLowerCase();
  if (e.includes("run_status") || e.includes("stop_delivery") || e.includes("ended") || e.includes("delivery")) return "status";
  if (e.includes("budget") || e.includes("spend_cap") || e.includes("min_spend")) return "budget";
  if (e.includes("bid")) return "bid";
  if (e.includes("target") || e.includes("audience") || e.includes("persona") || e.includes("value_rules") || e.includes("segment")) return "audience";
  if (e.includes("creative") || e.includes("image") || e.includes("video") || e.includes("create_ad")) return "creative";
  if (e.includes("name")) return "name";
  if (e.includes("optimization") || e.includes("conversion_goal") || e.includes("schedule") || e.includes("duration")) return "optimization";
  return "other";
}

// Which level the change hit. Prefer Meta's object_type; fall back to inferring from the event_type verb.
export function levelFromActivity(objectType: string | undefined, eventType: string): ChangeRow["level"] {
  const t = (objectType ?? "").toLowerCase();
  if (t.includes("account")) return "account";
  if (t.includes("campaign")) return "campaign";
  if (t.includes("adset") || t.includes("ad_set") || t.includes("ad set")) return "adset";
  if (t === "ad" || t.includes("adgroup") || t === "ad group") return "ad";
  const e = eventType.toLowerCase();
  if (e.includes("campaign")) return "campaign";
  if (e.includes("ad_set") || e.includes("adset")) return "adset";
  if (e.includes("adgroup") || /(^|_)ad_/.test(e) || e.startsWith("update_ad") || e.includes("_ad_")) return "ad";
  return "account";
}

// A logged actor => a human media buyer; no/zero actor => an algorithm/system move (Meta reallocation, etc.).
export function sourceFromActor(actorId: string | number | undefined | null): "buyer" | "algo" {
  const id = actorId == null ? "" : String(actorId);
  return id && id !== "0" ? "buyer" : "algo";
}

// A change fired by an AUTOMATED RULE (e.g. "Turn off if spend > 25k") or a system delivery event is NOT a
// human buyer's decision - even though Meta stamps a non-zero actor on it (the rule owner / "Meta"). Detect it
// from extra_data so it is credited to "algo", never to a media buyer's ranking. rule_info is present on
// rule-triggered changes; type:"delivery_event" marks a system delivery notification (not a change at all).
export function isAutomatedRule(extra: Record<string, unknown> | null | undefined): boolean {
  if (!extra) return false;
  if (extra.rule_info && typeof extra.rule_info === "object") return true;
  if (typeof extra.type === "string" && extra.type === "delivery_event") return true;
  return false;
}

// event_time is an ISO datetime ("2026-08-29T17:25:46+0000") or a unix-seconds string; return YYYY-MM-DD.
function toDate(eventTime: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(eventTime)) return eventTime.slice(0, 10);
  if (/^\d+$/.test(eventTime)) return new Date(Number(eventTime) * 1000).toISOString().slice(0, 10);
  return eventTime.slice(0, 10);
}

// Map one raw activity to a ChangeRow, or null if it lacks the minimum (event_type + event_time).
export function mapActivityRow(raw: RawActivity): ChangeRow | null {
  const eventType = String(raw.event_type ?? "").trim();
  const eventTime = String(raw.event_time ?? "").trim();
  if (!eventType || !eventTime) return null;

  const objectId = raw.object_id != null ? String(raw.object_id) : null;
  const level = levelFromActivity(raw.object_type, eventType);
  const actorId = raw.actor_id != null ? String(raw.actor_id) : null;

  let extra: Record<string, unknown> | null = null;
  if (typeof raw.extra_data === "string" && raw.extra_data) {
    try {
      extra = JSON.parse(raw.extra_data) as Record<string, unknown>;
    } catch {
      extra = { raw: raw.extra_data };
    }
  } else if (raw.extra_data && typeof raw.extra_data === "object") {
    extra = raw.extra_data as Record<string, unknown>;
  }

  return {
    change_id: `${objectId ?? "?"}:${eventTime}:${eventType}`,
    event_time: eventTime,
    date: toDate(eventTime),
    level,
    object_id: objectId,
    object_name: raw.object_name ? String(raw.object_name) : null,
    campaign_id: level === "campaign" ? objectId : null,
    adset_id: level === "adset" ? objectId : null,
    ad_id: level === "ad" ? objectId : null,
    event_type: eventType,
    change_type: normalizeChangeType(eventType),
    // Rule-fired / system events are algo even when they carry a non-zero actor, so they never inflate a
    // buyer's ranking; otherwise a logged actor => buyer.
    source: isAutomatedRule(extra) ? "algo" : sourceFromActor(actorId),
    actor_id: actorId,
    actor_name: raw.actor_name ? String(raw.actor_name) : null,
    extra_data: extra,
  };
}

// Dedupe a batch by change_id (two activities can share object:time:type) so an upsert never hits
// "cannot affect row a second time".
export function dedupeChanges(rows: ChangeRow[]): ChangeRow[] {
  return Array.from(new Map(rows.map((r) => [r.change_id, r])).values());
}
