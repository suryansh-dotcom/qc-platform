"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendLink() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setStage("code");
    setMsg("Check your email. Tap the link, or enter the 6-digit code below.");
  }

  async function verifyCode() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.replace("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold tracking-tight">QC Platform</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with your work email.</p>

        <div className="mt-5 space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              disabled={stage === "code"}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          {stage === "code" && (
            <div>
              <Label>6-digit code (webview fallback)</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
              />
            </div>
          )}

          {stage === "email" ? (
            <Button className="w-full" disabled={busy || !email} onClick={sendLink}>
              {busy ? "Sending…" : "Send magic link"}
            </Button>
          ) : (
            <Button className="w-full" disabled={busy || code.length !== 6} onClick={verifyCode}>
              {busy ? "Verifying…" : "Verify code"}
            </Button>
          )}

          {msg && <p className="text-xs text-slate-600">{msg}</p>}
        </div>
      </Card>
    </main>
  );
}
