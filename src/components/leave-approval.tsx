"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideLeave } from "@/actions/leave-approval";
import { Button, GhostButton, Input } from "@/components/ui/primitives";

export function LeaveDecision({ id, version }: { id: string; version: number }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [t, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function decide(decision: "approve" | "reject") {
    if (busy) return;
    setBusy(true); setMsg(null);
    start(async () => {
      const res = await decideLeave({ id, version, decision, rejectionReason: reason });
      setBusy(false);
      if (res.ok) { setMsg(`Leave ${decision === "approve" ? "approved" : "rejected"}.`); router.refresh(); }
      else setMsg(res.error ?? "Error");
    });
  }

  return (
    <div className="mt-5 space-y-3">
      <Input placeholder="Rejection reason (optional)" value={reason}
        onChange={(e) => setReason(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button disabled={busy || t} onClick={() => decide("approve")}>
          {busy || t ? "Working…" : "Approve"}
        </Button>
        <GhostButton disabled={busy || t} onClick={() => decide("reject")}>Reject</GhostButton>
        {msg && <span className="text-xs text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}
