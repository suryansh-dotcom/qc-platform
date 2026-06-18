import { NextResponse } from "next/server";
import { processEmailQueue } from "@/actions/email";
import { cronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processEmailQueue(10);
  return NextResponse.json({ ok: true, ...result });
}

// Vercel Cron always invokes via GET; Supabase pg_cron/pg_net uses POST.
export async function GET(request: Request) {
  return POST(request);
}
