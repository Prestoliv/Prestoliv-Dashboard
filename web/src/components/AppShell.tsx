'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./SidebarNav";
import { FloatingProjectsChatWidget } from "./FloatingProjectsChatWidget";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import type { UserRole } from "@/lib/types";

/* ── Mobile nav icons ────────────────────────────────────────────── */
const IconGrid = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1.5" y="1.5" width="6.5" height="6.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="10" y="1.5" width="6.5" height="6.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="1.5" y="10" width="6.5" height="6.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="10" y="10" width="6.5" height="6.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);

const IconChat = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M15 2H3a1 1 0 00-1 1v9a1 1 0 001 1h5.5l2.5 3 2.5-3H15a1 1 0 001-1V3a1 1 0 00-1-1z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
);

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 1.5l6 2.5v5c0 3.5-2.8 6-6 7-3.2-1-6-3.5-6-7V4L9 1.5z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6.5 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M11 11l3-3-3-3M14 8H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LogoMark = () => (
  <div className="h-7 w-7 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
    <Image
      src="/logo.png"
      alt="Prestoliv logo"
      width={28}
      height={28}
      className="object-contain"
      priority
    />
  </div>
);

/* ── Mobile nav link ─────────────────────────────────────────────── */
function MobileNavLink({ href, label, Icon, active }: {
  href: string; label: string; Icon: React.FC; active: boolean;
}) {
  return (
    <Link href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
        ${active ? "text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
      style={active ? { background: "linear-gradient(135deg,#0891b2,#0d9488)" } : {}}
    >
      <Icon />
      {label}
    </Link>
  );
}

type SupportIssue = {
  id: string;
  user_id: string;
  name: string | null;
  role: UserRole | null;
  message: string;
  screenshot_url: string | null;
  status: string | null;
  created_at: string;
};

function SupportDialog({
  open,
  onClose,
  userId,
  name,
  role,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  name: string | null | undefined;
  role: UserRole | null;
}) {
  const [message, setMessage] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoadingIssues(true);
    (async () => {
      try {
        const { data, error: qErr } = await supabase
          .from("support_issues")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (qErr) throw qErr;
        setIssues((data ?? []) as SupportIssue[]);
      } catch (e) {
        // If table is missing, just skip listing and show hint.
        console.error(e);
      } finally {
        setLoadingIssues(false);
      }
    })();
  }, [open, userId]);

  if (!open) return null;

  const disabled = !userId || busy;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close support"
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Help &amp; Support</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Tell us what went wrong or what you need help with.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-1.5">
                Your name
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {name ?? "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-1.5">
                Your role
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {role ?? "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-1.5">
              Describe the issue
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800
                         outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              placeholder="Tell us what you were doing, what you expected, and what happened instead."
            />
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-1.5">
              Screenshot link (optional)
            </p>
            <input
              value={screenshotUrl}
              onChange={(e) => setScreenshotUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800
                         outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              placeholder="Paste a public image URL or drive link"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {success}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-slate-400">
              You&apos;ll be contacted by the team within the next 24–48 hours.
            </p>
            <button
              type="button"
              disabled={disabled || !message.trim()}
              onClick={async () => {
                if (!userId) return;
                setBusy(true);
                setError(null);
                setSuccess(null);
                try {
                  const payload = {
                    user_id: userId,
                    name: name ?? null,
                    role: role ?? null,
                    message: message.trim(),
                    screenshot_url: screenshotUrl.trim() || null,
                    status: "open",
                  };
                  try {
                    const { data, error: insErr } = await supabase
                      .from("support_issues")
                      .insert(payload)
                      .select("*")
                      .single();
                    if (!insErr && data) {
                      setIssues((prev) => [data as SupportIssue, ...prev]);
                    }
                  } catch (e) {
                    console.error(e);
                  }

                  const bodyLines = [
                    `Name: ${name ?? "Unknown"}`,
                    `Role: ${role ?? "—"}`,
                    `User ID: ${userId}`,
                    "",
                    "Message:",
                    message.trim(),
                    "",
                    screenshotUrl.trim() ? `Screenshot: ${screenshotUrl.trim()}` : "",
                  ];
                  const mailto = `mailto:devanshsaxena1019@gmail.com?subject=${encodeURIComponent(
                    "Prestoliv support request"
                  )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
                  window.location.href = mailto;

                  setSuccess("Your issue has been submitted. You'll be contacted within 24–48 hours.");
                  setMessage("");
                  setScreenshotUrl("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to submit issue.");
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold
                         text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">Your previous issues</p>
              {loadingIssues && (
                <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin inline-block" />
              )}
            </div>
            {issues.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                No issues logged yet from this account.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {issues.map((iss) => (
                  <div
                    key={iss.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 flex items-start gap-2 justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-400 font-mono">
                        {new Date(iss.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-700 mt-0.5 line-clamp-2">
                        {iss.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Status: <span className="font-semibold">{iss.status ?? "open"}</span>
                      </p>
                    </div>
                    {iss.status !== "resolved" && (
                      <button
                        type="button"
                        className="ml-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        onClick={async () => {
                          try {
                            const { error: upErr } = await supabase
                              .from("support_issues")
                              .update({ status: "resolved" })
                              .eq("id", iss.id);
                            if (upErr) throw upErr;
                            setIssues((prev) =>
                              prev.map((x) => (x.id === iss.id ? { ...x, status: "resolved" } : x))
                            );
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      >
                        Mark resolved
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main AppShell ───────────────────────────────────────────────── */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname                          = usePathname();
  const { loading, userId, role, name }   = useCurrentUserRole();
  const nav                               = useMemo(() => ({ role, userId, name }), [role, userId, name]);
  const [signOutBusy, setSignOutBusy]     = useState(false);
  const [supportOpen, setSupportOpen]     = useState(false);

  /* Standalone routes: no sidebar, no app chrome (embed / public links) */
  if (
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/api-docs") ||
    pathname?.startsWith("/at")
  ) {
    return <>{children}</>;
  }

  const showShell = pathname !== "/" && !pathname.startsWith("/login");

  if (!showShell) {
    return (
      <div className="min-h-screen bg-[#f0f7f9]">
        <header className="h-16 px-6 border-b border-slate-100 bg-white flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-sm font-bold text-slate-700 tracking-wide uppercase">Prestoliv</span>
          </Link>
          <Link href="/login"
            className="text-sm font-medium px-4 py-2 rounded-xl text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}>
            Sign in
          </Link>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f7f9]">
      {/* Desktop sidebar */}
      <SidebarNav
        role={nav.role as UserRole | null}
        loading={loading}
        name={nav.name ?? null}
        onOpenSupport={() => setSupportOpen(true)}
      />

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden sticky top-0 z-40 h-14 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="px-4 h-full flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark />
            <span className="text-[13px] font-bold text-slate-700 tracking-wider uppercase">Prestoliv</span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5">
            <MobileNavLink href="/dashboard" label="Dashboard" Icon={IconGrid} active={pathname === "/dashboard"} />
            <MobileNavLink href="/queries"   label="Queries"   Icon={IconChat}  active={pathname === "/queries"} />
            {role === "admin" && (
              <MobileNavLink href="/admin" label="Admin" Icon={IconShield} active={pathname === "/admin"} />
            )}
          </nav>

          {/* Sign out */}
          {role && (
            <button
              disabled={signOutBusy}
              onClick={async () => {
                setSignOutBusy(true);
                try {
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                } finally { setSignOutBusy(false); }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold
                         text-slate-500 border border-slate-200 hover:bg-red-50 hover:text-red-600
                         hover:border-red-200 transition-all duration-150 disabled:opacity-50"
            >
              {signOutBusy ? (
                <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin inline-block" />
              ) : <IconLogout />}
              Out
            </button>
          )}
        </div>
      </header>

      {/* ── Page content ── */}
      <main>
        {children}
      </main>

      <FloatingProjectsChatWidget />

      <SupportDialog
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        userId={userId ?? null}
        name={name}
        role={role as UserRole | null}
      />
    </div>
  );
}