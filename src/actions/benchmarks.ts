"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function requireSuper() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
  return data?.role === "super_admin" ? user : null;
}

export async function saveBenchmark(input: {
  id?: string;
  version?: number;
  team_id: string | null;
  name: string;
  calculation_type: "absolute" | "tenure_adjusted" | "dynamic_stddev";
  config: Record<string, unknown>;
  is_active: boolean;
}) {
  const user = await requireSuper();
  if (!user) return { ok: false, error: "Super-admin only." };
  const admin = createAdminClient();

  if (input.id) {
    const { data, error } = await admin.from("benchmarks").update({
      team_id: input.team_id, name: input.name,
      calculation_type: input.calculation_type, config: input.config, is_active: input.is_active,
    }).eq("id", input.id).eq("version", input.version ?? -1).select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: "Version conflict — refresh." };
  } else {
    const { error } = await admin.from("benchmarks").insert({
      team_id: input.team_id, name: input.name, calculation_type: input.calculation_type,
      config: input.config, is_active: input.is_active, created_by: user.id,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin/benchmarks");
  return { ok: true };
}
