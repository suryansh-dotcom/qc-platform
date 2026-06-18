import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssociateNav } from "@/components/nav";

export default async function AssociateLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users").select("full_name, role").eq("id", user.id).single();

  return (
    <div className="min-h-screen bg-slate-50">
      <AssociateNav name={profile?.full_name ?? user.email ?? ""} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
