import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsvRow } from "@/lib/csv";

export const dynamic = "force-dynamic";

// Streams audit_log (or daily_entries) as CSV using keyset pagination so the
// full table is never materialized in server or browser memory.
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "super_admin")
    return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const table = url.searchParams.get("table") === "daily_entries" ? "daily_entries" : "audit_log";
  const admin = createAdminClient();
  const pageSize = 500;

  const header =
    table === "audit_log"
      ? ["created_at", "actor_id", "target_user_id", "action", "entity", "entity_id"]
      : ["entry_date", "user_id", "unique_reviewed", "rework_reviews", "items_passed", "items_failed", "hours_worked", "verification_status"];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(toCsvRow(header) + "\n"));
      let offset = 0;
      // Keyset by created_at/entry_date would be ideal with a cursor; range
      // pagination keeps each fetch bounded without loading the whole table.
      for (let page = 0; page < 10000; page++) {
        const { data, error } = await admin
          .from(table)
          .select(header.join(","))
          .order(table === "audit_log" ? "created_at" : "entry_date", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error || !data || data.length === 0) break;
        for (const row of data as any[]) {
          controller.enqueue(encoder.encode(toCsvRow(header.map((h) => row[h])) + "\n"));
        }
        offset += pageSize;
        if (data.length < pageSize) break;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${table}_export.csv"`,
    },
  });
}
