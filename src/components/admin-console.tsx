"use client";
import { useState, useTransition } from "react";
import { adminEditRow, decideProfileRequest } from "@/actions/admin";
import { Button, Card, GhostButton, Input, Label, Textarea } from "@/components/ui/primitives";

type Role = "admin" | "super_admin";
type PendingProfile = {
  id: string; user_id: string; version: number;
  requested_changes: Record<string, string>; created_at: string;
  user: { full_name: string; phone: string | null; avatar_url: string | null };
};

const SUPER_TABLES = [
  "teams", "users", "leave_requests", "daily_entries", "daily_attachments",
  "benchmarks", "performance_evals", "settings", "profile_update_requests", "feedback",
];

export function AdminConsole({
  role, pendingProfiles,
}: { role: Role; pendingProfiles: PendingProfile[] }) {
  const tables = role === "super_admin" ? SUPER_TABLES : SUPER_TABLES.filter((t) => t !== "feedback");
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-base font-semibold">Admin console</h1>
        <p className="text-sm text-slate-500">
          Role: <span className="font-medium">{role}</span>.{" "}
          {role === "admin"
            ? "You may edit all operational data. Feedback is restricted to super-admins."
            : "You may edit all data, including feedback."}
        </p>
      </section>

      <ProfileQueue items={pendingProfiles} />
      <UniversalEditor tables={tables} />
    </div>
  );
}

function ProfileQueue({ items }: { items: PendingProfile[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Profile verification queue</h2>
      {items.length === 0 && <p className="text-sm text-slate-400">No pending requests.</p>}
      <div className="space-y-3">
        {items.map((p) => <ProfileDiff key={p.id} p={p} />)}
      </div>
    </section>
  );
}

function ProfileDiff({ p }: { p: PendingProfile }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [t, start] = useTransition();
  const current: Record<string, string | null> = {
    full_name: p.user.full_name, phone: p.user.phone, avatar_url: p.user.avatar_url,
  };

  function decide(decision: "approve" | "reject") {
    if (busy) return; setBusy(true); setMsg(null);
    start(async () => {
      const res = await decideProfileRequest({
        requestId: p.id, version: p.version, decision, rejectionReason: reason,
      });
      setBusy(false);
      setMsg(res.ok ? "Done." : res.error ?? "Error");
    });
  }

  return (
    <Card className="p-4">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold uppercase text-slate-400">
        <span>Field</span><span>Current</span><span>Requested</span>
      </div>
      {Object.entries(p.requested_changes).map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-2 border-t border-slate-100 py-1.5 text-sm">
          <span className="text-slate-500">{k}</span>
          <span className="text-slate-700">{current[k] ?? "—"}</span>
          <span className="font-medium text-obsidian">{String(v)}</span>
        </div>
      ))}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={busy || t} onClick={() => decide("approve")}>Approve modification</Button>
        <Input className="max-w-xs" placeholder="Rejection reason (optional)"
          value={reason} onChange={(e) => setReason(e.target.value)} />
        <GhostButton disabled={busy || t} onClick={() => decide("reject")}>Reject modification</GhostButton>
        {msg && <span className="text-xs text-slate-600">{msg}</span>}
      </div>
    </Card>
  );
}

function UniversalEditor({ tables }: { tables: string[] }) {
  const [table, setTable] = useState(tables[0]);
  const [id, setId] = useState("");
  const [version, setVersion] = useState("");
  const [patch, setPatch] = useState('{\n  "field": "value"\n}');
  const [busy, setBusy] = useState(false);
  const [t, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function submit() {
    if (busy || !id) return; setBusy(true); setMsg(null);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(patch); }
    catch { setBusy(false); return setMsg("Patch is not valid JSON."); }
    start(async () => {
      const res = await adminEditRow({
        table: table as any, id,
        expectedVersion: version ? Number(version) : undefined,
        patch: parsed,
      });
      setBusy(false);
      setMsg(res.ok ? "Row updated." : res.error ?? "Error");
    });
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Universal row editor (version-checked, audited)</h2>
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><Label>Table</Label>
            <select value={table} onChange={(e) => setTable(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              {tables.map((tn) => <option key={tn} value={tn}>{tn}</option>)}
            </select></div>
          <div><Label>Row id (uuid)</Label>
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="…" /></div>
          <div><Label>Expected version (optimistic)</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="optional" /></div>
        </div>
        <div className="mt-3"><Label>Patch (JSON)</Label>
          <Textarea rows={5} className="font-mono text-xs" value={patch}
            onChange={(e) => setPatch(e.target.value)} /></div>
        <div className="mt-3 flex items-center gap-3">
          <Button disabled={busy || t || !id} onClick={submit}>
            {busy || t ? "Applying…" : "Apply edit"}
          </Button>
          {msg && <span className="text-xs text-slate-600">{msg}</span>}
        </div>
      </Card>
    </section>
  );
}
