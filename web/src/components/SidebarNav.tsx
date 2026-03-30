'use client';

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useState } from "react";

/* ── Icons ──────────────────────────────────────────────────────── */
const IconGrid = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="1.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1.5" y="9.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9.5" y="9.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IconChat = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M2 3.5h13a1 1 0 011 1v7a1 1 0 01-1 1H5.5L2 15.5V4.5a1 1 0 011-1z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

const IconShield = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M8.5 1.5l5.5 2v5c0 3-2.5 5.5-5.5 6.5C5.5 14 3 11.5 3 8.5v-5l5.5-2z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M6 8.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M6 13H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M10 10.5l3-3-3-3M13 7.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M1.5 13c0-2.485 2.686-4.5 6-4.5s6 2.015 6 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

/* Animated chevron — points right when collapsed, left when expanded */
const IconToggle = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width="15" height="15" viewBox="0 0 15 15" fill="none"
    style={{ transition: "transform 0.3s ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
  >
    <path d="M5.5 3l4.5 4.5L5.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LogoMark = () => (
  <div
    className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
    style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)", boxShadow: "0 2px 8px rgba(8,145,178,.25)" }}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8h4M8 2v4M8 10v4M10 8h4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="2" fill="white"/>
    </svg>
  </div>
);

/* ── Role badge meta ─────────────────────────────────────────────── */
const roleMeta: Record<string, { bg: string; text: string; dot: string }> = {
  admin:    { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  pm:       { bg: "#f5f3ff", text: "#7c3aed", dot: "#8b5cf6" },
  customer: { bg: "#f0fdfa", text: "#0d9488", dot: "#14b8a6" },
};

/* ── Component ────────────────────────────────────────────────────── */
export function SidebarNav({
  role,
  loading,
  name,
}: {
  role: UserRole | null;
  loading: boolean;
  name?: string | null;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const EXPANDED_W = 232;
  const COLLAPSED_W = 68;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", Icon: IconGrid },
    { href: "/queries",   label: "Queries",   Icon: IconChat },
    ...(role === "admin" ? [{ href: "/admin", label: "Admin", Icon: IconShield }] : []),
  ];

  const meta     = role ? (roleMeta[role] ?? roleMeta.customer) : null;
  const initials = name ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?";

  return (
    <>
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
        className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-white border-r border-slate-100 shadow-sm overflow-hidden"
      >

        {/* Header */}
        <div
          className="flex items-center px-3 border-b border-slate-100"
          style={{ height: 60, gap: collapsed ? 0 : 10 }}
        >
          <LogoMark />

          {/* Brand text */}
          <div
            style={{
              overflow: "hidden",
              width: collapsed ? 0 : 130,
              opacity: collapsed ? 0 : 1,
              transition: "width 0.25s ease, opacity 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            <p className="text-[14px] font-bold text-slate-400 tracking-[.15em] uppercase leading-none mb-0.5">
              Prestoliv
            </p>
          </div>

          {/* Toggle button */}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expand" : "Collapse"}
            className="ml-auto flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400
                       hover:bg-teal-50 hover:text-teal-600 transition-colors"
          >
            <IconToggle collapsed={collapsed} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {/* Section label — only when expanded */}
          <div
            style={{
              overflow: "hidden",
              height: collapsed ? 0 : 24,
              opacity: collapsed ? 0 : 1,
              transition: "height 0.2s ease, opacity 0.15s ease",
            }}
          >
            <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
              Menu
            </p>
          </div>

          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center rounded-xl text-sm font-medium transition-all duration-150 ${
                  active ? "text-white" : "text-slate-500 hover:text-teal-700 hover:bg-teal-50"
                }`}
                style={{
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? "10px 0" : "9px 10px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  ...(active ? {
                    background: "linear-gradient(135deg,#0891b2,#0d9488)",
                    boxShadow: "0 2px 8px rgba(8,145,178,.2)",
                  } : {}),
                  transition: "all 0.2s ease",
                }}
              >
                {/* Icon */}
                <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20 }}>
                  <Icon />
                </span>

                {/* Label */}
                <span
                  style={{
                    overflow: "hidden",
                    width: collapsed ? 0 : 120,
                    opacity: collapsed ? 0 : 1,
                    transition: "width 0.22s ease, opacity 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>

                {/* Active indicator dot */}
                {active && (
                  <span
                    style={{
                      overflow: "hidden",
                      width: collapsed ? 0 : 6,
                      opacity: collapsed ? 0 : 1,
                      transition: "width 0.2s ease, opacity 0.15s ease",
                      marginLeft: "auto",
                      height: 6,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.6)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-slate-100" />

        {/* Footer */}
        <div className="px-2 py-3 space-y-2">

          {/* User info */}
          <div
            className="flex items-center rounded-xl px-2 py-2"
            style={{ gap: collapsed ? 0 : 10, background: "#f8fafb" }}
          >
            {/* Avatar */}
            <div
              className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                background: "linear-gradient(135deg,#cffafe,#ccfbf1)",
                color: "#0d9488",
                border: "1.5px solid #99f6e4",
                minWidth: 32,
              }}
            >
              {loading ? "…" : initials}
            </div>

            {/* Name + role badge */}
            <div
              style={{
                overflow: "hidden",
                width: collapsed ? 0 : 140,
                opacity: collapsed ? 0 : 1,
                transition: "width 0.22s ease, opacity 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? (
                <div className="h-2.5 w-20 rounded bg-slate-200 animate-pulse mb-1" />
              ) : (
                <p className="text-xs font-semibold text-slate-700 truncate leading-tight">
                  {name ?? "Guest"}
                </p>
              )}
              {meta && role && (
                <span
                  className="inline-flex items-center gap-1 mt-0.5 rounded-full px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: meta.bg, color: meta.text }}
                >
                  <span className="h-1 w-1 rounded-full" style={{ background: meta.dot }} />
                  {role}
                </span>
              )}
            </div>
          </div>

          {/* Sign out / Sign in */}
          {role ? (
            <button
              title={collapsed ? "Sign out" : undefined}
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className="w-full flex items-center rounded-xl px-3 py-2 text-xs font-semibold
                         text-slate-500 border border-slate-100 bg-white
                         hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-all"
              style={{
                gap: collapsed ? 0 : 8,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <IconLogout />
              <span
                style={{
                  overflow: "hidden",
                  width: collapsed ? 0 : 80,
                  opacity: collapsed ? 0 : 1,
                  transition: "width 0.2s ease, opacity 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Sign out
              </span>
            </button>
          ) : (
            <Link
              href="/login"
              title={collapsed ? "Sign in" : undefined}
              className="flex items-center rounded-xl px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              style={{
                background: "linear-gradient(135deg,#0891b2,#0d9488)",
                gap: collapsed ? 0 : 8,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <IconUser />
              <span
                style={{
                  overflow: "hidden",
                  width: collapsed ? 0 : 80,
                  opacity: collapsed ? 0 : 1,
                  transition: "width 0.2s ease, opacity 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Sign in
              </span>
            </Link>
          )}
        </div>
      </aside>

      {/* Content offset spacer */}
      <div
        className="hidden lg:block flex-shrink-0"
        style={{
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </>
  );
}