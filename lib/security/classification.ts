// Data classification (control-plane spec section 14). Assigns every data store a sensitivity tier, and the
// tier drives the rules that must hold for it: encryption, whether it may be logged, who may access it, and
// retention. This is the machine-readable source of truth other systems check against (e.g. the audit
// redactor, an export gate, a retention job). Pure, no I/O - testable (scripts/check-classification.ts).

export type DataClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SENSITIVE" | "HIGHLY_SENSITIVE";

export type ClassPolicy = {
  encryptAtRest: boolean; // beyond the DB's own at-rest encryption - app-level envelope encryption
  loggable: boolean; // may raw values appear in logs / analytics / error messages / prompts?
  access: "public" | "tenant" | "service_role" | "control_plane"; // who may read it
  retentionDays: number | null; // null = keep per legal/billing requirement, not auto-expired
};

const POLICY: Record<DataClass, ClassPolicy> = {
  PUBLIC: { encryptAtRest: false, loggable: true, access: "public", retentionDays: null },
  INTERNAL: { encryptAtRest: false, loggable: true, access: "service_role", retentionDays: 365 },
  CONFIDENTIAL: { encryptAtRest: false, loggable: false, access: "tenant", retentionDays: 395 },
  SENSITIVE: { encryptAtRest: false, loggable: false, access: "service_role", retentionDays: 730 },
  HIGHLY_SENSITIVE: { encryptAtRest: true, loggable: false, access: "service_role", retentionDays: null },
};

// Real AdBrain tables -> tier. Anything not listed defaults to CONFIDENTIAL (fail safe: unknown = protected).
const TABLE_CLASS: Record<string, DataClass> = {
  // credentials + payment-adjacent -> highest tier, app-level encrypted, never logged, service-role only
  oauth_tokens: "HIGHLY_SENSITIVE",
  shopify_connections: "HIGHLY_SENSITIVE",
  // customer performance + derived intelligence -> tenant-confidential
  ad_metrics: "CONFIDENTIAL",
  ad_meta: "CONFIDENTIAL",
  ad_accounts: "CONFIDENTIAL",
  brands: "CONFIDENTIAL",
  brand_profiles: "CONFIDENTIAL",
  creative_insights: "CONFIDENTIAL",
  decision_triples: "CONFIDENTIAL",
  competitor_ads: "CONFIDENTIAL",
  competitor_creative_analysis: "CONFIDENTIAL",
  cockpit_cache: "CONFIDENTIAL",
  cp_assets: "CONFIDENTIAL",
  cp_generations: "CONFIDENTIAL",
  notifications: "CONFIDENTIAL",
  // tenant membership / identity -> sensitive (who-can-see-what)
  orgs: "SENSITIVE",
  org_members: "SENSITIVE",
  brand_members: "SENSITIVE",
  org_invites: "SENSITIVE",
  // control-plane operational records -> internal
  audit_log: "INTERNAL",
  system_flags: "INTERNAL",
  ask_log: "INTERNAL",
  ad_sync_state: "INTERNAL",
  demo_requests: "INTERNAL",
};

/** The sensitivity tier for a table (unknown -> CONFIDENTIAL, the safe default). */
export function classify(table: string): DataClass {
  return TABLE_CLASS[table] ?? "CONFIDENTIAL";
}

/** The policy that must hold for a table, derived from its tier. */
export function policyFor(table: string): ClassPolicy {
  return POLICY[classify(table)];
}

/** May raw values from this table appear in a log / prompt / error? */
export function isLoggable(table: string): boolean {
  return policyFor(table).loggable;
}

export { POLICY, TABLE_CLASS };
