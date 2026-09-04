import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { EXPORT_TABLES, scrubRow } from "./export-spec";

// GDPR data-portability EXECUTOR (the spec is export-spec.ts; this runs it). Assembles the SIGNED-IN user's own
// data into one JSON object, read-only + tenancy-scoped, with every row scrubbed of secret-looking fields.
// Never touches oauth_tokens / provider_keys (they are not in the allowlist). Best-effort per table so one
// absent/empty table never fails the whole export.
export type UserExport = { exportedAt: string; userId: string; tables: Record<string, unknown[]> };

export async function buildUserExport(userId: string): Promise<UserExport> {
  const admin = createAdminClient();
  const tables: Record<string, unknown[]> = {};

  for (const { table, key } of EXPORT_TABLES) {
    try {
      let rows: Record<string, unknown>[];
      if (table === "ad_accounts") {
        // ad_accounts is the one export table in the paged-reads LARGE set; page it, ordered by its PK (a
        // total order, required for correct paging) so an agency user's every account is exported.
        rows = await readAllPages<Record<string, unknown>>((from, to) =>
          admin.from(table).select("*").eq(key, userId).order("id", { ascending: true }).range(from, to),
        );
      } else {
        // The rest are small per-user tables (a user's own rollups / usage / notifications); a plain read is
        // complete and needs no total-order column (avoids silently dropping data on a wrong order guess).
        const { data } = await admin.from(table).select("*").eq(key, userId);
        rows = (data ?? []) as Record<string, unknown>[];
      }
      tables[table] = rows.map(scrubRow);
    } catch {
      tables[table] = []; // absent/empty table -> empty section, never a failed export
    }
  }

  return { exportedAt: new Date().toISOString(), userId, tables };
}
