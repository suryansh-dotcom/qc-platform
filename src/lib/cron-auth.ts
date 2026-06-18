// Authorizes scheduled invocations. Works with Vercel Cron (which sends
// Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set) and with
// Supabase pg_cron/pg_net calls that send an x-cron-secret header.
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-cron-secret");
  if (header && header === secret) return true;
  const auth = request.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;
  return false;
}
