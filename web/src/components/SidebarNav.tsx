'use client';

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

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

const IconMail = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M1.5 4.5L8 9l6.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
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

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
  href, label, Icon, active, collapsed, badge, onNavigate,
}: {
  href: string; label: string; Icon: React.FC; active: boolean; collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const showBadge = badge != null && badge > 0;
  const badgeLabel = badge! > 99 ? "99+" : String(badge);
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={() => onNavigate?.()}
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
      {active && !collapsed && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white/60" />
      )}

      <span className={`relative flex-shrink-0 transition-transform duration-200 ${!active ? "group-hover:scale-110" : ""}`}>
        <Icon />
        {showBadge && (
          <span
            className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ${active ? "ring-teal-600" : "ring-white"}`}
          >
            {badgeLabel}
          </span>
        )}
      </span>

      <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
        {label}
      </span>

      {!active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 rounded-full bg-teal-500
                         group-hover:h-5 transition-all duration-200" />
      )}
    </Link>
  );
}

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={`flex items-center min-w-0 ${collapsed ? "justify-center flex-shrink-0" : "flex-1 px-0.5"}`}
      title="Prestoliv"
    >
      <Image
        src="/logo.svg"
        alt="Prestoliv"
        width={156}
        height={28}
        className={`object-contain object-left ${collapsed ? "h-7 w-10" : "h-7 w-auto max-w-[168px]"}`}
        unoptimized
        priority
      />
    </Link>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <div className={`overflow-hidden transition-all duration-200 ${collapsed ? "h-0 opacity-0" : "h-6 opacity-100"}`}>
      <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap">
        {label}
      </p>
    </div>
  );
}

type NavItemDef = { href: string; label: string; Icon: React.FC; badge?: number };

function SidebarPanel({
  collapsed,
  showCollapseToggle,
  onCollapse,
  onExpand,
  onCloseMobile,
  showMobileClose,
  role,
  loading,
  name,
  navItems,
  cfg,
  initials,
  pathname,
  onOpenSupport,
}: {
  collapsed: boolean;
  showCollapseToggle: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  onCloseMobile?: () => void;
  showMobileClose?: boolean;
  role: UserRole | null;
  loading: boolean;
  name?: string | null;
  navItems: NavItemDef[];
  cfg: (typeof roleConfig)[string] | null;
  initials: string;
  pathname: string;
  onOpenSupport?: () => void;
}) {
  const router = useRouter();
  const afterNav = () => onCloseMobile?.();

  return (
    <>
      <div
        className="absolute top-0 inset-x-0 h-0.5 z-10"
        style={{ background: "linear-gradient(90deg, #0891b2, #0d9488, #06b6d4)" }}
      />

      <div
        className={`relative flex items-center h-16 border-b border-slate-100 flex-shrink-0 gap-2 ${
          collapsed ? "justify-center px-2" : "px-3 gap-2.5"
        }`}
      >
        <SidebarLogo collapsed={collapsed} />

        {showMobileClose && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <IconClose />
          </button>
        )}

        {showCollapseToggle && !collapsed && onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="hidden lg:flex flex-shrink-0 h-7 w-7 rounded-lg items-center justify-center
                       text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-all duration-200"
            aria-label="Collapse sidebar"
          >
            <IconChevronLeft />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        <SectionLabel label="Menu" collapsed={collapsed} />
        <div className="pt-1 space-y-0.5">
          {navItems.map(({ href, label, Icon, badge }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              badge={badge}
              active={pathname === href}
              collapsed={collapsed}
              onNavigate={afterNav}
            />
          ))}
        </div>
      </nav>

      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <div className="px-2 py-3 space-y-2 flex-shrink-0">
        <div className="space-y-1.5">
          <button
            type="button"
            title={collapsed ? "Documentation" : undefined}
            onClick={() => {
              afterNav();
              window.location.href = "/api-docs";
            }}
            className={`
              w-full flex items-center rounded-xl px-3 py-2 text-[11px] font-semibold min-h-[40px]
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
            onClick={() => {
              afterNav();
              onOpenSupport?.();
            }}
            className={`
              w-full flex items-center rounded-xl px-3 py-2 text-[11px] font-semibold min-h-[40px]
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

        {collapsed && onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="hidden lg:flex w-full h-8 items-center justify-center rounded-xl text-slate-400
                       hover:text-teal-700 hover:bg-teal-50 transition-all duration-200 border border-slate-100"
            aria-label="Expand sidebar"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <div className={`flex items-center rounded-xl px-2.5 py-2.5 bg-slate-50 border border-slate-100 ${collapsed ? "justify-center" : "gap-2.5"}`}>
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

        {role ? (
          <button
            type="button"
            title={collapsed ? "Sign out" : undefined}
            onClick={async () => {
              afterNav();
              await supabase.auth.signOut();
              router.push("/login");
            }}
            className={`
              w-full flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold min-h-[44px]
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
            onClick={afterNav}
            className={`flex items-center rounded-xl px-3 py-2.5 text-xs font-bold text-white min-h-[44px]
                        transition-all hover:opacity-90 shadow-sm ${collapsed ? "justify-center" : "gap-2"}`}
            style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
          >
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "opacity-100"}`}>
              Sign in
            </span>
          </Link>
        )}
      </div>
    </>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export function SidebarNav({
  role, loading, name, onOpenSupport, contactUsUnseen = 0,
  mobileOpen = false,
  onMobileOpenChange,
}: {
  role: UserRole | null; loading: boolean; name?: string | null;
  onOpenSupport?: () => void;
  contactUsUnseen?: number;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileEntered, setMobileEntered] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const closeMobile = useCallback(() => {
    onMobileOpenChange?.(false);
  }, [onMobileOpenChange]);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) {
      setMobileEntered(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => setMobileEntered(true));
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, closeMobile]);

  const EXPANDED_W = 248;
  const COLLAPSED_W = 68;
  const W = collapsed ? COLLAPSED_W : EXPANDED_W;

  const baseNav: NavItemDef[] = [
    { href: "/dashboard", label: "Dashboard", Icon: IconGrid },
    { href: "/queries", label: "Queries", Icon: IconChat },
  ];
  const navItems: NavItemDef[] =
    role === "admin"
      ? [
          ...baseNav,
          { href: "/admin/contact-us", label: "Contact Us", Icon: IconMail, badge: contactUsUnseen },
          { href: "/admin", label: "Admin", Icon: IconShield },
        ]
      : baseNav;

  const cfg = role ? (roleConfig[role] ?? roleConfig.customer) : null;
  const initials = name
    ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const panelProps = {
    role,
    loading,
    name,
    navItems,
    cfg,
    initials,
    pathname,
    onOpenSupport,
  };

  if (!mounted) {
    return (
      <div
        style={{ width: EXPANDED_W }}
        className="hidden lg:block flex-shrink-0 h-screen"
        aria-hidden
      />
    );
  }

  const mobileDrawer =
    mounted && mobileOpen
      ? createPortal(
          <div className="lg:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/45 transition-opacity duration-200"
              style={{ opacity: mobileEntered ? 1 : 0 }}
              aria-label="Close menu"
              onClick={closeMobile}
            />
            <aside
              className="absolute inset-y-0 left-0 flex w-[min(280px,88vw)] max-w-full flex-col bg-white border-r border-slate-100 shadow-xl transition-transform duration-200 ease-out"
              style={{
                transform: mobileEntered ? "translateX(0)" : "translateX(-100%)",
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <SidebarPanel
                {...panelProps}
                collapsed={false}
                showCollapseToggle={false}
                onCloseMobile={closeMobile}
                showMobileClose
              />
            </aside>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{ width: W, transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)" }}
        className="hidden lg:flex sticky top-0 h-screen flex-shrink-0 flex-col bg-white border-r border-slate-100 overflow-hidden shadow-sm z-20 relative"
      >
        <SidebarPanel
          {...panelProps}
          collapsed={collapsed}
          showCollapseToggle
          onCollapse={() => setCollapsed(true)}
          onExpand={() => setCollapsed(false)}
        />
      </aside>

      {mobileDrawer}
    </>
  );
}
