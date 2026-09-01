# Rollbacks (NOT auto-applied)

These `.sql` files reverse a forward migration. They live OUTSIDE `supabase/migrations/` on purpose: the
migration runner applies every file in `migrations/` in filename order, so a destructive `*_down.sql` in
that folder would be applied as a forward step and undo the thing it was meant to reverse (e.g.
`0022_access_state_down.sql` would `drop table profiles` right after `0022_access_state.sql` created it).

Run a rollback DELIBERATELY, by hand, never as part of `db push`. `scripts/check-migrations.ts` fails CI if a
down/rollback/revert file ever appears in `supabase/migrations/` again.
