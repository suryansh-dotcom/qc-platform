"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/primitives";

export function TeamPicker({ teams }: { teams: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("team") ?? "";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team</span>
      <Select
        className="max-w-xs"
        value={current}
        onChange={(e) => router.push(e.target.value ? `/admin/dashboard?team=${e.target.value}` : "/admin/dashboard")}
      >
        <option value="">— select a team —</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
    </div>
  );
}
