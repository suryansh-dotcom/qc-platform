"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/daily", label: "Daily Work Sync" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile & Leave" },
  { href: "/feedback", label: "Feedback" },
];

export function AssociateNav({ name }: { name: string }) {
  const path = usePathname();
  const supabase = createClient();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold tracking-tight">QC Platform</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-500 sm:inline">{name}</span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                active
                  ? "border-obsidian font-medium text-obsidian"
                  : "border-transparent text-slate-500 hover:text-obsidian"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
