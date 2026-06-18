"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/csv";
import { reconcileReference, resolveMismatch } from "@/actions/reconcile";
import { Button, Card, GhostButton } from "@/components/ui/primitives";

type Mismatch = {
  id: string; version: number; entry_date: string; unique_reviewed: number;
  reference_value: { unique_reviewed?: number } | null;
  user: { full_name: string } | null;
};

export function ReconcilePanel({ mismatches }: { mismatches: Mismatch[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [t, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  async function onFile(file: File) {
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length < 2) { setResult("CSV needs a header and at least one row."); return; }
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const rows = grid.slice(1).map((r) =>
      Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""]))
    );
    setBusy(true); setResult(null);
    start(async () => {
      const res = await reconcileReference(rows);
      setBusy(false);
      setResult(res.ok
        ? `Verified ${res.matched}, Mismatch ${res.mismatched}, Unverified ${res.unverified}.`
        : res.error ?? "Error");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Reference sheet upload</h2>
        <p className="mt-1 text-xs text-slate-500">
          CSV columns: <code>email, entry_date, unique_reviewed</code>. Unverified rows never block reporting.
        </p>
        <input type="file" accept=".csv" disabled={busy}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="mt-3 block text-xs file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1" />
        {result && <p className="mt-3 text-sm text-slate-700">{result}</p>}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Mismatches requiring action</h2>
        {mismatches.length === 0 && <p className="mt-2 text-sm text-slate-400">No open mismatches.</p>}
        <div className="mt-2 divide-y divide-slate-100">
          {mismatches.map((m) => <MismatchRow key={m.id} m={m} onDone={() => router.refresh()} />)}
        </div>
      </Card>
    </div>
  );
}

function MismatchRow({ m, onDone }: { m: Mismatch; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function resolve(acceptReference: boolean) {
    setBusy(true);
    await resolveMismatch({ entryId: m.id, version: m.version, acceptReference });
    setBusy(false); onDone();
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <div>
        <span className="font-medium">{m.user?.full_name ?? "—"}</span>
        <span className="ml-2 text-slate-500">{m.entry_date}</span>
        <span className="ml-2">entry <b>{m.unique_reviewed}</b> vs reference <b>{m.reference_value?.unique_reviewed ?? "—"}</b></span>
      </div>
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => resolve(true)} className="px-2 py-1 text-xs">Accept reference</Button>
        <GhostButton disabled={busy} onClick={() => resolve(false)} className="px-2 py-1 text-xs">Keep entry</GhostButton>
      </div>
    </div>
  );
}
