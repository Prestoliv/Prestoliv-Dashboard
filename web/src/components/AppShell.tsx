'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./SidebarNav";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import type { UserRole } from "@/lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, userId, role, name } = useCurrentUserRole();
  const nav = useMemo(() => ({ role, userId, name }), [role, userId, name]);
  const [signOutBusy, setSignOutBusy] = useState(false);

  // Completely skip AppShell for login and API docs pages.
  if (pathname?.startsWith("/login") || pathname?.startsWith("/api-docs")) {
    return <>{children}</>;
  }

  const showShell = pathname !== "/" && !pathname.startsWith("/login");

  if (!showShell) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="p-5 sm:p-6 border-b border-slate-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
            <Link href="/" className="font-semibold text-slate-900 text-lg">
              Prestoliv
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-slate-700 hover:text-slate-900">
                Sign in
              </Link>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="p-5 text-xs text-slate-500 text-center">Project Tracking</footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SidebarNav role={nav.role as UserRole | null} loading={loading} name={nav.name ?? null} />

      <div className="lg:hidden sticky top-0 z-40 bg-slate-50/80 backdrop-blur border-b border-slate-200/70">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-slate-900">Prestoliv</div>
            {role ? <Badge tone="blue">{role}</Badge> : null}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-sm text-slate-700 hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/queries" className="text-sm text-slate-700 hover:text-slate-900">
              Queries
            </Link>
            {role === "admin" ? (
              <Link href="/admin" className="text-sm text-slate-700 hover:text-slate-900">
                Admin
              </Link>
            ) : null}
            {role ? (
              <Button
                size="sm"
                variant="secondary"
                className="!px-3"
                disabled={signOutBusy}
                onClick={async () => {
                  setSignOutBusy(true);
                  try {
                    await supabase.auth.signOut();
                    window.location.href = "/login";
                  } finally {
                    setSignOutBusy(false);
                  }
                }}
              >
                Sign out
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <main className="lg:ml-64 p-4">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <footer className="p-4 text-xs text-slate-500 text-center">
        <Link href="/" className="hover:underline">
          Prestoliv
        </Link>
      </footer>
    </div>
  );
}

