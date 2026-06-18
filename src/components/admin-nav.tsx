"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Console" },
  { href: "/admin/dashboard", label: "Team Dashboard" },
  { href: "/admin/reconcile", label: "Reconciliation" },
  { href: "/admin/benchmarks", label: "Benchmarks" },
  { href: "/leave", label: "Leave Inbox" },
];

export function AdminNav() {
  const path = usePathname();
  const supabase = createClient();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold">QC Platform · Admin</span>
        <div className="flex items-center gap-2">
          <a href="/api/export?table=audit_log"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
            Export audit log
          </a>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
            Sign out
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
        {LINKS.map((l) => {
          const active = path === l.href;
          return (
            <Link key={l.href} href={l.href}
              className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                active ? "border-obsidian font-medium text-obsidian"
                       : "border-transparent text-slate-500 hover:text-obsidian")}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
