"use client";
import { useState, useTransition } from "react";
import { submitProfileUpdate } from "@/actions/profile";
import { requestLeave, cancelLeave } from "@/actions/leave";
import { Button, Card, GhostButton, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { fmtIST } from "@/lib/dates";

type Profile = {
  full_name: string; email: string; phone: string | null;
  join_date: string; leave_balance: number;
};
type Pending = { requested_changes: Record<string, string>; created_at: string } | null;
type Leave = {
  id: string; start_date: string; end_date: string; day_type: string;
  days_count: number; status: string; version: number; rejection_reason: string | null;
};

export function ProfileLeave({
  profile, pending, leaves,
}: { profile: Profile; pending: Pending; leaves: Leave[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ProfileCard profile={profile} pending={pending} />
      <LeaveCard balance={profile.leave_balance} leaves={leaves} />
    </div>
  );
}

function ProfileCard({ profile, pending }: { profile: Profile; pending: Pending }) {
  const [name, setName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [t, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const editLocked = !!pending;

  function submit() {
    if (busy || editLocked) return;
    setBusy(true); setMsg(null);
    start(async () => {
      const res = await submitProfileUpdate({ full_name: name, phone });
      setBusy(false);
      setMsg(res.ok ? "Submitted for admin verification." : res.error ?? "Error");
    });
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">Profile</h2>
      <dl className="mt-3 space-y-1 text-sm">
        <Row k="Email" v={profile.email} />
        <Row k="Join date" v={fmtIST(profile.join_date + "T00:00:00", "dd MMM yyyy")} />
        <Row k="Leave balance" v={`${profile.leave_balance} days`} />
      </dl>

      {editLocked && (
        <div className="mt-4 rounded-md border border-slate-300 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-semibold">Pending Admin Verification</p>
          <p className="mt-1">Requested:</p>
          <ul className="mt-1 list-inside list-disc">
            {Object.entries(pending!.requested_changes).map(([k, v]) => (
              <li key={k}><span className="text-slate-500">{k}:</span> {String(v)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div><Label>Display name</Label>
          <Input value={name} disabled={editLocked} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Contact phone</Label>
          <Input value={phone} disabled={editLocked} onChange={(e) => setPhone(e.target.value)} /></div>
        <Button onClick={submit} disabled={busy || t || editLocked}>
          {busy || t ? "Submitting…" : "Request change"}
        </Button>
        {msg && <p className="text-xs text-slate-600">{msg}</p>}
      </div>
    </Card>
  );
}

function LeaveCard({ balance, leaves }: { balance: number; leaves: Leave[] }) {
  const [start_date, setStart] = useState("");
  const [end_date, setEnd] = useState("");
  const [day_type, setDayType] = useState<"full" | "half_first" | "half_second">("full");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [t, startT] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function submit() {
    if (busy || !start_date || !end_date) return;
    setBusy(true); setMsg(null);
    startT(async () => {
      const res = await requestLeave({ start_date, end_date, day_type, reason });
      setBusy(false);
      setMsg(res.ok ? `Submitted (${res.days} day(s)).` : res.error ?? "Error");
    });
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">Leave — balance {balance} days</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div><Label>Start</Label>
          <Input type="date" value={start_date} onChange={(e) => setStart(e.target.value)} /></div>
        <div><Label>End</Label>
          <Input type="date" value={end_date} onChange={(e) => setEnd(e.target.value)} /></div>
        <div><Label>Day type</Label>
          <Select value={day_type} onChange={(e) => setDayType(e.target.value as any)}>
            <option value="full">Full day(s)</option>
            <option value="half_first">Half — first</option>
            <option value="half_second">Half — second</option>
          </Select></div>
      </div>
      <div className="mt-3"><Label>Reason</Label>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <Button className="mt-3" onClick={submit} disabled={busy || t || !start_date || !end_date}>
        {busy || t ? "Submitting…" : "Apply for leave"}
      </Button>
      {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Requests</h3>
      <div className="mt-2 divide-y divide-slate-100">
        {leaves.length === 0 && <p className="py-2 text-sm text-slate-400">None yet.</p>}
        {leaves.map((l) => <LeaveRow key={l.id} l={l} />)}
      </div>
    </Card>
  );
}

function LeaveRow({ l }: { l: Leave }) {
  const [busy, setBusy] = useState(false);
  const color: Record<string, string> = {
    pending: "text-slate-600", approved: "text-status-green",
    rejected: "text-status-red", cancelled: "text-slate-400",
  };
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div>
        <span>{l.start_date} → {l.end_date}</span>
        <span className="ml-2 text-xs text-slate-400">{l.days_count}d · {l.day_type}</span>
        {l.rejection_reason && <span className="ml-2 text-xs text-status-red">({l.rejection_reason})</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${color[l.status]}`}>{l.status}</span>
        {l.status === "pending" && (
          <GhostButton
            disabled={busy}
            onClick={async () => { setBusy(true); await cancelLeave(l.id, l.version); setBusy(false); }}
            className="px-2 py-1 text-xs"
          >Cancel</GhostButton>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1">
      <dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd>
    </div>
  );
}
