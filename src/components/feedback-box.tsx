"use client";
import { useState, useTransition } from "react";
import { submitFeedback } from "@/actions/feedback";
import { Button, Card, Label, Select, Textarea } from "@/components/ui/primitives";
import { FEEDBACK_CATEGORIES } from "@/lib/utils";

export function FeedbackBox() {
  const [category, setCategory] = useState<string>(FEEDBACK_CATEGORIES[0]);
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [t, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function submit() {
    if (busy || !body.trim()) return;
    setBusy(true); setMsg(null);
    start(async () => {
      const res = await submitFeedback({ category, body, anonymous: anon });
      setBusy(false);
      if (res.ok) { setBody(""); setMsg("Submitted. Thank you."); }
      else setMsg(res.error ?? "Error");
    });
  }

  return (
    <Card className="mx-auto max-w-2xl p-5">
      <h1 className="text-sm font-semibold">Feedback & suggestions</h1>
      <div className="mt-3 space-y-3">
        <div><Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {FEEDBACK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select></div>
        <div><Label>Your message</Label>
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          Anonymize submission
        </label>
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Anonymizing removes your identity and the exact timestamp from the stored record.
          It reduces but cannot fully eliminate the chance of re-identification based on writing
          style in a small team. Please keep that in mind.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={busy || t || !body.trim()}>
            {busy || t ? "Submitting…" : "Submit"}
          </Button>
          {msg && <span className="text-xs text-slate-600">{msg}</span>}
        </div>
      </div>
    </Card>
  );
}
