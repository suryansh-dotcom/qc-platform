"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, GhostButton, Input, Label } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) {
      setMsg(
        err.includes("expired") || err.includes("invalid")
          ? "That link or code has expired. Request a new one below — use only the 6-digit code, do not click the email link."
          : decodeURIComponent(err)
      );
    }
  }, []);

  async function sendLink() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const normalizedEmail = email.trim().toLowerCase();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) {
      console.error("signInWithOtp error:", error);
      setMsg(error.message);
      return;
    }
    setEmail(normalizedEmail);
    setCode("");
    setStage("code");
    setMsg(
      "Enter the 6-digit code from your email. Do not click the magic link — email scanners often invalidate it before you can use it."
    );
  }

  async function verifyCode() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const normalizedEmail = email.trim().toLowerCase();
    const token = code.trim();
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: "email",
    });
    setBusy(false);
    if (error) {
      console.error("verifyOtp error:", error);
      setMsg(
        error.message.includes("expired") || error.message.includes("invalid")
          ? "Code expired or already used. Click “Send new code” — do not click the email link, only type the 6 digits."
          : error.message
      );
      return;
    }
    router.replace("/");
    router.refresh();
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
              <Label>6-digit code</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                autoComplete="one-time-code"
              />
            </div>
          )}

          {stage === "email" ? (
            <Button className="w-full" disabled={busy || !email.trim()} onClick={sendLink}>
              {busy ? "Sending…" : "Send magic link"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button className="w-full" disabled={busy || code.length !== 6} onClick={verifyCode}>
                {busy ? "Verifying…" : "Verify code"}
              </Button>
              <GhostButton
                className="w-full text-sm"
                disabled={busy}
                onClick={() => {
                  setStage("email");
                  setCode("");
                  setMsg(null);
                }}
              >
                Send new code
              </GhostButton>
            </div>
          )}

          {msg && <p className="text-xs text-slate-600">{msg}</p>}
        </div>
      </Card>
    </main>
  );
}
