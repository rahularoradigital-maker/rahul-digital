// Creative Studio product search — sanitize the user's query BEFORE it enters a PostgREST `.or(...ilike...)`
// filter. The filter grammar is comma/parenthesis-delimited, and `%`/`*` are ilike wildcards, so those
// characters (and a stray backslash) must not reach it or a query could break the grammar or widen the
// match. Trust-boundary logic, kept pure + gated (scripts/check-cp-search.ts). Also length-capped.
export function sanitizeSearchTerm(raw: string): string {
  return (raw ?? "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80);
}
