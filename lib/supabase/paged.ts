// Read every row of an ordered query past PostgREST's 1,000-row cap, in PARALLEL bursts.
//
// Perf (Phase-0 audit): every store reader paged serially - page 1, wait, page 2, wait... - so a 15-page
// account paid 15 sequential round-trips on every cold cockpit / funnel / change-impact load. Here page 1 is
// fetched alone (a small account still costs exactly one query), and only when it comes back FULL are the
// next BURST pages fired together; the read stops at the first short page. Ordering semantics are unchanged:
// each range is the same ordered query the serial loop issued, and rows are appended in range order.
//
// `page(from, to)` must build a fresh, fully-ordered query for that range (a PostgREST builder cannot be
// reused after .range). The order MUST be total (e.g. ad_id + date for ad_metrics) - offset paging over a
// non-total order has no stability guarantee in Postgres, serial or parallel.
//
// ponytail: a burst may issue a few ranges past the end of the data (they return 0 rows against the index -
// cheap). Upgrade path if it ever matters: a count-first head query to size the burst exactly.

// `data` is loosely typed on purpose: an untyped Supabase builder yields generic rows, and every caller already
// names the row type via the generic (readAllPages<Row>) exactly as it used to cast `(data ?? []) as Row[]`.
export type PageResult<T> = { data: T[] | Record<string, unknown>[] | null; error: { message: string } | null };

export const PAGE = 1000; // PostgREST's default max-rows; every store reader pages at this size

export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  opts: { size?: number; burst?: number } = {},
): Promise<T[]> {
  const size = opts.size ?? PAGE;
  const burst = opts.burst ?? 8;
  const out: T[] = [];
  const first = await page(0, size - 1);
  if (first.error) throw new Error(first.error.message);
  out.push(...((first.data ?? []) as T[]));
  if ((first.data?.length ?? 0) < size) return out;

  for (let from = size; ; from += size * burst) {
    const results = await Promise.all(Array.from({ length: burst }, (_, i) => page(from + i * size, from + (i + 1) * size - 1)));
    for (const r of results) {
      if (r.error) throw new Error(r.error.message);
      const rows = (r.data ?? []) as T[];
      out.push(...rows);
      if (rows.length < size) return out;
    }
  }
}
