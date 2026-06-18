"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBenchmark } from "@/actions/benchmarks";
import { Button, Card, Input, Label, Select } from "@/components/ui/primitives";

type Benchmark = {
  id: string; version: number; team_id: string | null; name: string;
  calculation_type: "absolute" | "tenure_adjusted" | "dynamic_stddev";
  config: Record<string, any>; is_active: boolean;
};

export function BenchmarkManager({
  benchmarks, teams,
}: { benchmarks: Benchmark[]; teams: { id: string; name: string }[] }) {
  return (
    <div className="space-y-6">
      <Editor teams={teams} />
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Existing benchmarks</h2>
        <div className="mt-2 divide-y divide-slate-100 text-sm">
          {benchmarks.length === 0 && <p className="py-2 text-slate-400">None yet.</p>}
          {benchmarks.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium">{b.name}</span>
                <span className="ml-2 text-xs text-slate-500">{b.calculation_type}</span>
                <span className="ml-2 text-xs text-slate-400">{JSON.stringify(b.config)}</span>
              </div>
              <span className={b.is_active ? "text-status-green text-xs" : "text-slate-400 text-xs"}>
                {b.is_active ? "active" : "inactive"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Editor({ teams }: { teams: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [type, setType] = useState<"absolute" | "tenure_adjusted" | "dynamic_stddev">("absolute");
  const [target, setTarget] = useState("20");
  const [graceDays, setGraceDays] = useState("30");
  const [k, setK] = useState("1");
  const [busy, setBusy] = useState(false);
  const [t, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function config(): Record<string, unknown> {
    if (type === "absolute") return { type, target: Number(target) };
    if (type === "tenure_adjusted") return { type, target: Number(target), graceDays: Number(graceDays), floorRatio: 0.5 };
    return { type, k: Number(k) };
  }

  function submit() {
    if (busy || !name) return; setBusy(true); setMsg(null);
    start(async () => {
      const res = await saveBenchmark({
        team_id: teamId || null, name, calculation_type: type, config: config(), is_active: true,
      });
      setBusy(false);
      if (res.ok) { setMsg("Saved."); setName(""); router.refresh(); }
      else setMsg(res.error ?? "Error");
    });
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">New / update benchmark</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Team (blank = global)</Label>
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Global</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select></div>
        <div><Label>Calculation</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="absolute">Absolute target</option>
            <option value="tenure_adjusted">Tenure-adjusted</option>
            <option value="dynamic_stddev">Dynamic std-dev</option>
          </Select></div>
        {type !== "dynamic_stddev" && (
          <div><Label>Target (unique/day)</Label>
            <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
        )}
        {type === "tenure_adjusted" && (
          <div><Label>Grace days</Label>
            <Input type="number" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} /></div>
        )}
        {type === "dynamic_stddev" && (
          <div><Label>k (std-devs below median)</Label>
            <Input type="number" step="0.5" value={k} onChange={(e) => setK(e.target.value)} /></div>
        )}
      </div>
      <Button className="mt-3" disabled={busy || t || !name} onClick={submit}>
        {busy || t ? "Saving…" : "Save benchmark"}
      </Button>
      {msg && <span className="ml-3 text-xs text-slate-600">{msg}</span>}
    </Card>
  );
}
