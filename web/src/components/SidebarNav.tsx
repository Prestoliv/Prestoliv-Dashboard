'use client';

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useState, useEffect } from "react";

/* ── Icons ──────────────────────────────────────────────────────── */
const IconGrid = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);

const IconChat = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M13.5 2.5H2.5C2 2.5 1.5 3 1.5 3.5v7c0 .5.5 1 1 1H5l2 2.5L9 11.5h4.5c.5 0 1-.5 1-1v-7c0-.5-.5-1-1-1z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M4.5 6.5h7M4.5 8.5h4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconShield = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M8 1.5l5.5 2v5c0 3-2.5 5-5.5 6C5 13.5 2.5 11.5 2.5 8.5v-5L8 1.5z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M5.5 8.5l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconLogout = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M5.5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M9.5 10l3-3-3-3M12.5 7H5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconChevronLeft = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ── Role config ─────────────────────────────────────────────────── */
const roleConfig: Record<string, { from: string; to: string; badge: string; dot: string }> = {
  admin:    { from: "#f43f5e", to: "#f97316", badge: "bg-rose-50 text-rose-600 ring-rose-100",      dot: "#f43f5e" },
  pm:       { from: "#0891b2", to: "#0d9488", badge: "bg-teal-50 text-teal-700 ring-teal-100",      dot: "#0891b2" },
  customer: { from: "#0ea5e9", to: "#06b6d4", badge: "bg-sky-50 text-sky-600 ring-sky-100",          dot: "#0ea5e9" },
};

/* ── NavItem ─────────────────────────────────────────────────────── */
function NavItem({
  href, label, Icon, active, collapsed,
}: {
  href: string; label: string; Icon: React.FC; active: boolean; collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`
        group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold
        transition-all duration-200 select-none
        ${active
          ? "text-white shadow-md"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
        }
        ${collapsed ? "justify-center" : ""}
      `}
      style={active ? {
        background: "linear-gradient(135deg, #0891b2, #0d9488)",
        boxShadow: "0 4px 14px rgba(8,145,178,.25), inset 0 1px 0 rgba(255,255,255,.15)",
      } : {}}
    >
      {/* Active indicator dot */}
      {active && !collapsed && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white/60" />
      )}

      <span className={`flex-shrink-0 transition-transform duration-200 ${!active ? "group-hover:scale-110" : ""}`}>
        <Icon />
      </span>

      <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
        {label}
      </span>

      {/* Hover left accent */}
      {!active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 rounded-full bg-teal-500
                         group-hover:h-5 transition-all duration-200" />
      )}
    </Link>
  );
}

/* ── Section label ───────────────────────────────────────────────── */
function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <div className={`overflow-hidden transition-all duration-200 ${collapsed ? "h-0 opacity-0" : "h-6 opacity-100"}`}>
      <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap">
        {label}
      </p>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export function SidebarNav({
  role, loading, name, onOpenSupport,
}: {
  role: UserRole | null; loading: boolean; name?: string | null;
  onOpenSupport?: () => void;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const EXPANDED_W  = 248;
  const COLLAPSED_W = 68;
  const W = collapsed ? COLLAPSED_W : EXPANDED_W;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", Icon: IconGrid },
    { href: "/queries",   label: "Queries",   Icon: IconChat },
    ...(role === "admin" ? [{ href: "/admin", label: "Admin", Icon: IconShield }] : []),
  ];

  const cfg      = role ? (roleConfig[role] ?? roleConfig.customer) : null;
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  if (!mounted) return <div style={{ width: EXPANDED_W }} className="hidden lg:block flex-shrink-0" />;

  return (
    <>
      <aside
        style={{ width: W, transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)" }}
        className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-white border-r border-slate-100 overflow-hidden shadow-sm"
      >
        {/* Top rainbow accent line */}
        <div className="absolute top-0 inset-x-0 h-0.5 z-10"
          style={{ background: "linear-gradient(90deg, #0891b2, #0d9488, #06b6d4)" }} />

        {/* ── Logo / Header ── */}
        <div className={`flex items-center h-16 px-3 border-b border-slate-100 gap-2.5 flex-shrink-0 ${collapsed ? "justify-center" : ""}`}>
          {/* Logo mark */}
          <div className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)", boxShadow: "0 2px 8px rgba(8,145,178,.25)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h3.5M8.5 7H12M7 2v3.5M7 8.5V12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="7" cy="7" r="1.8" fill="white"/>
            </svg>
          </div>

          {/* Brand */}
          <div className={`overflow-hidden transition-all duration-200 flex-1 min-w-0 ${collapsed ? "w-0 opacity-0" : "opacity-100"}`}>
            <p className="text-[13px] font-bold text-slate-800 tracking-[0.1em] uppercase leading-none whitespace-nowrap">
              Prestoliv
            </p>
            <p className="text-[10px] text-slate-400 tracking-wider uppercase mt-0.5 whitespace-nowrap">
              Project Tracker
            </p>
          </div>

          {/* Collapse toggle */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center
                         text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-all duration-200"
            >
              <IconChevronLeft />
            </button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          <SectionLabel label="Menu" collapsed={collapsed} />
          <div className="pt-1 space-y-0.5">
            {navItems.map(({ href, label, Icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={pathname === href}
                collapsed={collapsed}
              />
            ))}
          </div>
        </nav>

        {/* Divider */}
        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* ── Extras + user footer ── */}
        <div className="px-2 py-3 space-y-2">

          {/* Docs / support */}
          <div className="space-y-1.5">
            <button
              type="button"
              title={collapsed ? "Documentation" : undefined}
              onClick={() => { window.location.href = "/api-docs"; }}
              className={`
                w-full flex items-center rounded-xl px-3 py-1.5 text-[11px] font-semibold
                text-slate-500 border border-slate-100 bg-white
                hover:text-teal-700 hover:border-teal-200 hover:bg-teal-50
                transition-all duration-200
                ${collapsed ? "justify-center" : "gap-2"}
              `}
            >
              <span className="flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 2.5h4.5a1.5 1.5 0 011.5 1.5v5.5H4a1.5 1.5 0 01-1.5-1.5V2.5z" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M5 2.5v6.5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              </span>
              <span className={`overflow-hidden transition-all duration-200 whitespace-nowrap ${collapsed ? "w-0 opacity-0" : "opacity-100"}`}>
                Documentation
              </span>
            </button>

            <button
              type="button"
              title={collapsed ? "Help & support" : undefined}
              onClick={() => onOpenSupport?.()}
              className={`
                w-full flex items-center rounded-xl px-3 py-1.5 text-[11px] font-semibold
                text-slate-500 border border-slate-100 bg-white
                hover:text-sky-700 hover:border-sky-200 hover:bg-sky-50
                transition-all duration-200
                ${collapsed ? "justify-center" : "gap-2"}
              `}
            >
              <span className="flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1.5A3.5 3.5 0 009.5 5c0 1.9-1.6 3.5-3.5 3.5V9M6 10.5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={`overflow-hidden transition-all duration-200 whitespace-nowrap ${collapsed ? "w-0 opacity-0" : "opacity-100"}`}>
                Help &amp; support
              </span>
            </button>
          </div>

          {/* Expand button (only visible when collapsed) */}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="w-full h-8 flex items-center justify-center rounded-xl text-slate-400
                         hover:text-teal-700 hover:bg-teal-50 transition-all duration-200 border border-slate-100"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* User info card */}
          <div className={`flex items-center rounded-xl px-2.5 py-2.5 bg-slate-50 border border-slate-100 ${collapsed ? "justify-center" : "gap-2.5"}`}>
            {/* Avatar */}
            <div
              className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
              style={{
                background: cfg ? `linear-gradient(135deg, ${cfg.from}, ${cfg.to})` : "linear-gradient(135deg,#94a3b8,#64748b)",
                minWidth: 32,
              }}
            >
              {loading ? (
                <span className="h-3 w-3 rounded-sm bg-white/30 animate-pulse inline-block" />
              ) : initials}
            </div>

            {/* Name + role */}
            <div className={`overflow-hidden transition-all duration-200 flex-1 min-w-0 ${collapsed ? "w-0 opacity-0 pointer-events-none" : "opacity-100"}`}>
              {loading ? (
                <div className="h-2.5 w-20 rounded-full bg-slate-200 animate-pulse mb-1.5" />
              ) : (
                <p className="text-xs font-bold text-slate-700 truncate whitespace-nowrap leading-tight">
                  {name ?? "Guest"}
                </p>
              )}
              {cfg && role && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wider ring-1 whitespace-nowrap ${cfg.badge}`}
                >
                  <span className="h-1 w-1 rounded-full" style={{ background: cfg.dot }} />
                  {role}
                </span>
              )}
            </div>
          </div>

          {/* Sign out */}
          {role ? (
            <button
              title={collapsed ? "Sign out" : undefined}
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className={`
                w-full flex items-center rounded-xl px-3 py-2 text-xs font-semibold
                text-slate-500 border border-slate-100 bg-white
                hover:border-red-200 hover:bg-red-50 hover:text-red-600
                transition-all duration-200 group
                ${collapsed ? "justify-center" : "gap-2"}
              `}
            >
              <span className="flex-shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5">
                <IconLogout />
              </span>
              <span className={`overflow-hidden transition-all duration-200 whitespace-nowrap ${collapsed ? "w-0 opacity-0" : "opacity-100"}`}>
                Sign out
              </span>
            </button>
          ) : (
            <Link
              href="/login"
              className={`flex items-center rounded-xl px-3 py-2 text-xs font-bold text-white
                          transition-all hover:opacity-90 shadow-sm ${collapsed ? "justify-center" : "gap-2"}`}
              style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
            >
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "opacity-100"}`}>
                Sign in
              </span>
            </Link>
          )}
        </div>
      </aside>

      {/* Spacer */}
      <div
        className="hidden lg:block flex-shrink-0 transition-all duration-[250ms]"
        style={{ width: W }}
      />
    </>
  );
}