"use client";
import { useState, useTransition } from "react";
import { upsertDailyEntry, registerAttachment } from "@/actions/entries";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { DEFECT_CATEGORIES } from "@/lib/utils";
import { istDateKey, isPastLockWindow, nowIST } from "@/lib/dates";

type Existing = {
  id?: string;
  unique_reviewed: number; rework_reviews: number;
  items_passed: number; items_failed: number;
  hours_worked: number; defect_category_tags: string[];
  plan_for_today: string; plan_for_tomorrow: string;
};

export function DailyEntryForm({
  entryDate, existing, carriedPlan,
}: {
  entryDate: string;
  existing: Existing | null;
  carriedPlan: string;
}) {
  const supabase = createClient();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const locked = isPastLockWindow(entryDate);

  const [form, setForm] = useState<Existing>(
    existing ?? {
      unique_reviewed: 0, rework_reviews: 0, items_passed: 0, items_failed: 0,
      hours_worked: 0, defect_category_tags: [],
      plan_for_today: carriedPlan ?? "", plan_for_tomorrow: "",
    }
  );

  function num(v: string) { return Math.max(0, Number(v) || 0); }

  async function uploadFiles(files: FileList) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { setMsg(`${file.name} exceeds 10MB.`); continue; }
      const path = `${user.id}/${entryDate}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("daily-attachments").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) { setMsg(error.message); continue; }
      if (form && (existing?.id)) {
        await registerAttachment({
          daily_entry_id: existing.id, storage_path: path, file_name: file.name,
          mime_type: file.type, file_size_bytes: file.size,
        });
      }
    }
    setMsg("Attachments uploaded.");
  }

  function submit() {
    if (busy || locked) return;
    setBusy(true); setMsg(null);
    startTransition(async () => {
      const res = await upsertDailyEntry({
        entry_date: entryDate,
        unique_reviewed: form.unique_reviewed,
        rework_reviews: form.rework_reviews,
        items_passed: form.items_passed,
        items_failed: form.items_failed,
        hours_worked: form.hours_worked,
        defect_category_tags: form.defect_category_tags,
        plan_for_today: form.plan_for_today,
        plan_for_tomorrow: form.plan_for_tomorrow,
      });
      setBusy(false);
      setMsg(res.ok ? "Saved." : res.error ?? "Error");
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Daily entry — {entryDate}</h2>
        {locked && <span className="rounded-md bg-status-red px-2 py-0.5 text-xs text-white">Locked</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Unique reviewed (first-time)">
          <Input type="number" min={0} value={form.unique_reviewed}
            onChange={(e) => setForm({ ...form, unique_reviewed: num(e.target.value) })} disabled={locked} />
        </Field>
        <Field label="Rework reviews (re-reviews)">
          <Input type="number" min={0} value={form.rework_reviews}
            onChange={(e) => setForm({ ...form, rework_reviews: num(e.target.value) })} disabled={locked} />
        </Field>
        <Field label="Hours worked">
          <Input type="number" min={0} max={24} step={0.25} value={form.hours_worked}
            onChange={(e) => setForm({ ...form, hours_worked: num(e.target.value) })} disabled={locked} />
        </Field>
        <Field label="Items passed">
          <Input type="number" min={0} value={form.items_passed}
            onChange={(e) => setForm({ ...form, items_passed: num(e.target.value) })} disabled={locked} />
        </Field>
        <Field label="Items failed">
          <Input type="number" min={0} value={form.items_failed}
            onChange={(e) => setForm({ ...form, items_failed: num(e.target.value) })} disabled={locked} />
        </Field>
        <Field label="Defect category">
          <Select
            disabled={locked}
            value={form.defect_category_tags[0] ?? ""}
            onChange={(e) => setForm({ ...form, defect_category_tags: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">— none —</option>
            {DEFECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Plan for today">
          <Textarea rows={2} disabled={locked} value={form.plan_for_today}
            onChange={(e) => setForm({ ...form, plan_for_today: e.target.value })} />
        </Field>
        <Field label="Plan for tomorrow (pre-fills next entry)">
          <Textarea rows={2} disabled={locked} value={form.plan_for_tomorrow}
            onChange={(e) => setForm({ ...form, plan_for_tomorrow: e.target.value })} />
        </Field>
      </div>

      <div className="mt-3">
        <Label>Attachments (≤10MB each, private bucket)</Label>
        <input type="file" multiple disabled={locked}
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          className="block text-xs text-slate-600 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} disabled={busy || pending || locked}>
          {busy || pending ? "Saving…" : "Save entry"}
        </Button>
        {msg && <span className="text-xs text-slate-600">{msg}</span>}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}
