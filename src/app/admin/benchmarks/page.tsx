import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BenchmarkManager } from "@/components/benchmark-manager";

export default async function BenchmarksPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("role").eq("id", user!.id).single();
  if (me?.role !== "super_admin") {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Benchmark configuration is restricted to super-admins.
      </div>
    );
  }
  const { data: benchmarks } = await supabase
    .from("benchmarks").select("id, version, team_id, name, calculation_type, config, is_active").order("created_at");
  const { data: teams } = await supabase.from("teams").select("id, name").order("name");

  return (
    <div>
      <h1 className="mb-4 text-base font-semibold">Benchmark engine</h1>
      <BenchmarkManager benchmarks={(benchmarks as any) ?? []} teams={teams ?? []} />
    </div>
  );
}
