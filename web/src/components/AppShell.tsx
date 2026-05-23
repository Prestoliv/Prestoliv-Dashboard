'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SidebarNav, IconMenu } from "./SidebarNav";
import { FloatingProjectsChatWidget } from "./FloatingProjectsChatWidget";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import {
  ContactUsNotificationsProvider,
  useContactUsNotificationsOptional,
} from "@/lib/contactUs/ContactUsNotifications";
import type { UserRole } from "@/lib/types";

const LogoMark = () => (
  <div className="h-7 w-7 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
    <Image
      src="/logo.svg"
      alt="Prestoliv logo"
      width={28}
      height={28}
      className="object-contain"
      unoptimized
      priority
    />
  </div>
);

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { loading, userId, role, name } = useCurrentUserRole();
  const nav = useMemo(() => ({ role, userId, name }), [role, userId, name]);
  const contactNotif = useContactUsNotificationsOptional();
  const contactUsUnseen = contactNotif?.unseenCount ?? 0;
  const [supportOpen, setSupportOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f0f7f9] flex flex-col lg:flex-row w-full">
      <SidebarNav
        role={nav.role as UserRole | null}
        loading={loading}
        name={nav.name ?? null}
        onOpenSupport={() => setSupportOpen(true)}
        contactUsUnseen={contactUsUnseen}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      <div className="flex flex-1 flex-col min-w-0 w-full">
      <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div
          className="px-3 sm:px-4 min-h-14 py-2 flex items-center gap-3"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-200 transition-colors"
            aria-label="Open navigation menu"
            aria-expanded={mobileSidebarOpen}
          >
            <IconMenu />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 flex-1 min-w-0" onClick={() => setMobileSidebarOpen(false)}>
            <LogoMark />
            <span className="text-[13px] font-bold text-slate-700 tracking-wider uppercase truncate">
              Prestoliv
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 min-w-0 w-full overflow-x-hidden">{children}</main>
      </div>

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
                  const mailto = `mailto:shravya@dzynd.co?subject=${encodeURIComponent(
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
  const pathname = usePathname();
  const { role } = useCurrentUserRole();
  const nav = useMemo(() => ({ role }), [role]);

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
    <ContactUsNotificationsProvider role={nav.role as UserRole | null}>
      <AppShellInner>{children}</AppShellInner>
    </ContactUsNotificationsProvider>
  );
}