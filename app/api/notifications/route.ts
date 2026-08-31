import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { listNotifications, unreadCount, markRead } from "@/lib/notifications/store";

// The per-user Notification Center feed. GET returns the user's newest notifications + unread count;
// PATCH marks one (by id) or all read. Always scoped to the signed-in user (getUser()), so one user can
// never read or touch another's feed - the store itself also filters by user_id as a second guard.

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const [items, unread] = await Promise.all([listNotifications(user.id, 30), unreadCount(user.id)]);
  return NextResponse.json({ items, unread });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { id?: string } = {};
  try { body = (await request.json()) as { id?: string }; } catch { /* mark-all */ }
  await markRead(user.id, body.id); // no id => mark all read
  return NextResponse.json({ ok: true });
}
