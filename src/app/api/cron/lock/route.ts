import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/cron-auth";
import { isPastLockWindow, istDateKey, nowIST } from "@/lib/dates";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const cutoff = istDateKey(subDays(nowIST(), 1));

  let locked = 0;
  for (let i = 0; i < 50; i++) {
    const { data: rows } = await admin
      .from("daily_entries").select("id, entry_date")
      .eq("is_locked", false).lte("entry_date", cutoff)
      .order("entry_date").limit(10);
    if (!rows || rows.length === 0) break;
    const due = rows.filter((r) => isPastLockWindow(r.entry_date)).map((r) => r.id);
    if (due.length) {
      await admin.from("daily_entries")
        .update({ is_locked: true, locked_at: new Date().toISOString() })
        .in("id", due);
      locked += due.length;
    }
    if (rows.length < 10) break;
  }
  return NextResponse.json({ ok: true, locked });
}

// Vercel Cron always invokes via GET; Supabase pg_cron/pg_net uses POST.
// Both are supported so either scheduler works against this same handler.
export async function GET(request: Request) {
  return POST(request);
}
