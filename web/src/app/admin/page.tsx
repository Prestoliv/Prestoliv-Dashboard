'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import type { Project, UserRow } from "@/lib/domain";
import type { UserRole } from "@/lib/types";
import { fetchPmAndCustomersForAdmin, setPmNameAndRole, updateProfileRole } from "@/lib/api/adminUsers";
import Link from "next/link";
import { useSWRCache } from "@/lib/cache/useSWRCache";

/* ── Types ───────────────────────────────────────────────────────── */
type Template     = { id: string; name: string };
type TemplateItem = { id: string; template_id: string; title: string; percentage: number };
type Log          = { id: string; user_id: string; action: string; created_at: string };

/* ── Design tokens ───────────────────────────────────────────────── */
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 " +
  "placeholder-slate-400 outline-none transition-all duration-200 shadow-sm " +
  "focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

const selectCls =
  "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 " +
  "outline-none transition-all duration-200 cursor-pointer shadow-sm " +
  "focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-1.5">
      {children}
    </p>
  );
}

function SectionCard({
  title,
  description,
  children,
  accentColor = "#0891b2",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="relative rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ background: accentColor }}
      />
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="relative w-full rounded-xl py-2.5 text-sm font-bold tracking-wide text-white shadow-md
                 transition-all duration-200
                 hover:shadow-teal-200 hover:shadow-lg hover:-translate-y-0.5
                 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed
                 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
    >
      {children}
    </button>
  );
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  active:    { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  completed: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  on_hold:   { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  cancelled: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />
      {status.replace("_", " ")}
    </span>
  );
}

/* ── Icons ───────────────────────────────────────────────────────── */
const IconUsers = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <circle cx="6" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M1 13.5c0-2.485 2.239-4.5 5-4.5s5 2.015 5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M11 6.5a2 2 0 100-4M15 13.5c0-2-1.5-3.5-3.5-3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconTemplate = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M1.5 5.5h13M5.5 5.5v9" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const IconProject = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3.5" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 3.5V2.5a1 1 0 011-1h4a1 1 0 011 1v1M5 8h3M5 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconActivity = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M1 8h2.5l2-5 3 9 2-6 1.5 2H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M12 7A5 5 0 112 7a5 5 0 015-5 4.97 4.97 0 013.5 1.44L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 2v3H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ── Stat card ───────────────────────────────────────────────────── */
function StatCard({
  label, value, icon, color, lightColor,
}: {
  label: string; value: number; icon: React.ReactNode; color: string; lightColor: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 hover:shadow-md transition-shadow duration-200 group">
      <div className="flex items-center justify-between mb-4">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: lightColor, color }}>
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ background: lightColor, color }}>
          total
        </span>
      </div>
      <p className="text-3xl font-bold text-slate-800 leading-none mb-1 tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-bold text-slate-700 tabular-nums">{value}</span>
    </div>
  );
}

/* ── Main inner component ────────────────────────────────────────── */
function AdminInner() {
  const [users, setUsers]                 = useState<UserRow[]>([]);
  const [templates, setTemplates]         = useState<Template[]>([]);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [projects, setProjects]           = useState<Project[]>([]);
  const [activityLogs, setActivityLogs]   = useState<Log[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [customerId, setCustomerId]   = useState("");
  const [pmId, setPmId]               = useState("");
  const [status, setStatus]           = useState("active");
  const [templateId, setTemplateId]   = useState("");

  const [newTemplateName, setNewTemplateName]   = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const [pmCreateName, setPmCreateName]         = useState("");
  const [pmCreateEmail, setPmCreateEmail]       = useState("");
  const [pmCreatePassword, setPmCreatePassword] = useState("");
  const [creatingPm, setCreatingPm]             = useState(false);
  const [pmCreateSuccess, setPmCreateSuccess]   = useState<string | null>(null);

  const [newTemplateItemTitle, setNewTemplateItemTitle]           = useState("");
  const [newTemplateItemPercentage, setNewTemplateItemPercentage] = useState(0);
  const [addingTemplateItem, setAddingTemplateItem]               = useState(false);

  const [tab, setTab] = useState<"users" | "templates" | "projects">("users");
  const [allUsersOpen, setAllUsersOpen] = useState(false);
  const [allUsersQuery, setAllUsersQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const q = allUsersQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      const role = (u.role ?? "").toString().toLowerCase();
      const id = u.id.toLowerCase();
      return name.includes(q) || role.includes(q) || id.includes(q);
    });
  }, [users, allUsersQuery]);

  function downloadUsersCsv(rows: UserRow[]) {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const header = ["name", "role", "id"].map(esc).join(",");
    const lines = rows.map((u) => [u.name ?? "", (u.role ?? "").toString(), u.id].map(esc).join(","));
    const csv = "\uFEFF" + [header, ...lines].join("\n"); // BOM for Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestoliv-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const adminKey = "admin:bundle:v1";
  const adminSWR = useSWRCache<{
    users: UserRow[];
    templates: Template[];
    projects: Project[];
    activityLogs: Log[];
  }>({
    key: adminKey,
    enabled: true,
    ttlMs: 30_000,
    fetcher: async () => {
      const [usersResult, tRes, pRes, lRes] = await Promise.all([
        fetchPmAndCustomersForAdmin(),
        supabase.from("milestone_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (pRes.error) throw pRes.error;

      const activity = lRes.error ? [] : ((lRes.data ?? []) as Log[]);
      const bundle = {
        users: usersResult.data,
        templates: (tRes.data ?? []) as Template[],
        projects: (pRes.data ?? []) as Project[],
        activityLogs: activity,
      };
      if (lRes.error) {
        // Keep data usable, but surface guidance.
        throw new Error(
          `${lRes.error.message} — Apply supabase/migrations/0005_admin_profiles_activity_logs_rls.sql in the SQL editor so activity logs load for admins.`
        );
      }
      return bundle;
    },
  });

  async function refresh() {
    try {
      await adminSWR.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh admin data");
    }
  }

  useEffect(() => {
    setLoading(adminSWR.loading && !adminSWR.data);
  }, [adminSWR.loading, adminSWR.data]);

  useEffect(() => {
    if (adminSWR.data) {
      setUsers(adminSWR.data.users);
      setTemplates(adminSWR.data.templates);
      setProjects(adminSWR.data.projects);
      setActivityLogs(adminSWR.data.activityLogs);
      setError(null);
    }
  }, [adminSWR.data]);

  useEffect(() => {
    if (!adminSWR.error) return;
    setError(adminSWR.error instanceof Error ? adminSWR.error.message : "Failed to load admin data");
  }, [adminSWR.error]);

  useEffect(() => {
    if (!templateId) { setTemplateItems([]); return; }
    supabase.from("milestone_template_items").select("*")
      .eq("template_id", templateId).order("id", { ascending: true })
      .then(({ data }: { data: TemplateItem[] | null }) => setTemplateItems((data ?? []) as TemplateItem[]));
  }, [templateId]);

  const customers = users.filter((u) => (u.role ?? "").toLowerCase() === "customer");
  const pms       = users.filter((u) => (u.role ?? "").toLowerCase() === "pm");

  const TABS = [
    { key: "users",     label: "Users & PMs",  icon: <IconUsers /> },
    { key: "templates", label: "Templates",     icon: <IconTemplate /> },
    { key: "projects",  label: "Projects",      icon: <IconProject /> },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50/80" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Dot grid background */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #cbd5e1 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          opacity: 0.3,
        }}
      />

      {/* Top accent bar */}
      <div className="fixed inset-x-0 top-0 h-0.5 z-50"
        style={{ background: "linear-gradient(90deg, #0891b2, #0d9488, #06b6d4)" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5L9 5.5H13L10 8.5L11 12.5L7 10.5L3 12.5L4 8.5L1 5.5H5L7 1.5Z" fill="white"/>
                </svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Control Center
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Panel</h1>
            <p className="text-sm text-slate-400 mt-1">Manage users, templates, projects &amp; activity</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-xs text-slate-500 font-medium">Live</span>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2
                         text-xs font-semibold text-slate-500 shadow-sm
                         hover:text-teal-700 hover:border-teal-200 hover:bg-teal-50
                         transition-all duration-200 disabled:opacity-50"
            >
              <span className={loading ? "animate-spin" : ""}><IconRefresh /></span>
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
            <svg className="mt-0.5 flex-shrink-0" width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7.5 4.5v4M7.5 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Customers"        value={customers.length}  icon={<IconUsers size={18}/>}    color="#3b82f6" lightColor="#eff6ff" />
          <StatCard label="Project Managers" value={pms.length}        icon={<IconUsers size={18}/>}    color="#0d9488" lightColor="#f0fdfa" />
          <StatCard label="Projects"         value={projects.length}   icon={<IconProject size={18}/>}  color="#0891b2" lightColor="#ecfeff" />
          <StatCard label="Templates"        value={templates.length}  icon={<IconTemplate size={18}/>} color="#0ea5e9" lightColor="#f0f9ff" />
        </div>

        {/* ── Main layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── Left main content ── */}
          <div className="xl:col-span-2 space-y-5">

            {/* Tab bar */}
            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all duration-200 ${
                    tab === t.key
                      ? "text-white shadow-md"
                      : "text-slate-400 hover:text-teal-700 hover:bg-teal-50"
                  }`}
                  style={tab === t.key ? { background: "linear-gradient(135deg, #0891b2, #0d9488)" } : {}}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── USERS TAB ── */}
            {tab === "users" && (
              <div className="space-y-5">
                <SectionCard title="Manage Users" description="Update roles for project managers and customers" accentColor="#3b82f6">
                  {users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                      <IconUsers size={28} />
                      <p className="text-sm mt-3 text-slate-400">No users found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ul className="space-y-2">
                      {users.slice(0, 5).map(u => (
                        <li key={u.id}
                          className="group flex items-center justify-between gap-4 rounded-xl border border-slate-100
                                     bg-slate-50 px-4 py-3 hover:border-teal-100 hover:bg-teal-50/40 transition-all duration-200">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm text-white text-sm font-bold"
                              style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}>
                              {(u.name ?? "?")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-slate-900 transition-colors">
                                {u.name ?? "—"}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">#{u.id.slice(0, 8)}</p>
                            </div>
                          </div>
                          <select
                            value={(u.role ?? "").toLowerCase() === "pm" ? "pm" : "customer"}
                            onChange={async e => {
                              const newRole = e.target.value as UserRole;
                              const { error: rErr } = await updateProfileRole(u.id, newRole);
                              if (rErr) { setError(rErr.message); return; }
                              setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600
                                       focus:outline-none focus:ring-2 focus:ring-teal-100 cursor-pointer
                                       hover:border-teal-300 transition-colors shadow-sm"
                          >
                            <option value="pm">PM</option>
                            <option value="customer">Customer</option>
                          </select>
                        </li>
                      ))}
                      </ul>

                      {users.length > 5 && (
                        <div className="flex items-center justify-between gap-3 pt-2">
                          <p className="text-xs text-slate-400 font-medium">
                            Showing 5 of {users.length}
                          </p>
                          <button
                            type="button"
                            onClick={() => setAllUsersOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2
                                       text-xs font-bold text-slate-600 shadow-sm
                                       hover:text-teal-700 hover:border-teal-200 hover:bg-teal-50
                                       transition-all duration-200"
                          >
                            See all users
                            <span className="text-slate-300">›</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Create PM Account" description="Registers via Supabase Auth — check Network → auth/v1/signup in DevTools." accentColor="#0d9488">
                  <form
                    className="space-y-4"
                    onSubmit={async e => {
                      e.preventDefault();
                      const email = pmCreateEmail.trim();
                      const name  = pmCreateName.trim();
                      const pwd   = pmCreatePassword;
                      if (!email || !pwd) return;
                      if (email.toLowerCase() === "admin@prestoliv.com") {
                        setError("Cannot create PM using admin@prestoliv.com.");
                        return;
                      }
                      setError(null);
                      setPmCreateSuccess(null);
                      setCreatingPm(true);
                      try {
                        const { data: sd, error: sErr } = await supabase.auth.signUp({
                          email, password: pwd, options: { data: { name: name || email } },
                        });
                        if (sErr) throw sErr;
                        const uid = sd.user?.id;
                        if (!uid) {
                          setPmCreateSuccess("Sign-up completed — email confirmation may be required. Confirm the email, then refresh.");
                          return;
                        }
                        const { error: rErr } = await setPmNameAndRole(uid, name || email);
                        if (rErr) throw rErr;
                        setPmCreateEmail(""); setPmCreatePassword(""); setPmCreateName("");
                        setPmCreateSuccess("PM account created and role set successfully.");
                        await refresh();
                      } catch (e2) {
                        setError(e2 instanceof Error ? e2.message : "Failed to create PM");
                      } finally {
                        setCreatingPm(false);
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel>Full name (optional)</FieldLabel>
                        <input value={pmCreateName} onChange={e => setPmCreateName(e.target.value)}
                          className={inputCls} placeholder="Jane Doe" />
                      </div>
                      <div>
                        <FieldLabel>Email address</FieldLabel>
                        <input value={pmCreateEmail} onChange={e => setPmCreateEmail(e.target.value)}
                          className={inputCls} placeholder="pm@example.com" required />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Password</FieldLabel>
                      <input type="password" value={pmCreatePassword} onChange={e => setPmCreatePassword(e.target.value)}
                        className={inputCls} placeholder="Minimum 6 characters" required />
                    </div>
                    {pmCreateSuccess && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <svg className="mt-0.5 flex-shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {pmCreateSuccess}
                      </div>
                    )}
                    <PrimaryButton type="submit" disabled={creatingPm || !pmCreateEmail.trim() || !pmCreatePassword}>
                      {creatingPm ? "Creating account…" : "Create PM Account"}
                    </PrimaryButton>
                  </form>
                </SectionCard>
              </div>
            )}

            {/* ── TEMPLATES TAB ── */}
            {tab === "templates" && (
              <div className="space-y-5">
                <SectionCard title="New Template" description="Define a reusable milestone set for future projects" accentColor="#0ea5e9">
                  <form
                    className="space-y-4"
                    onSubmit={async e => {
                      e.preventDefault();
                      if (!newTemplateName.trim()) return;
                      setError(null); setCreatingTemplate(true);
                      try {
                        const { data: created, error: cErr } = await supabase
                          .from("milestone_templates").insert({ name: newTemplateName.trim() }).select("*").single();
                        if (cErr) throw cErr;
                        const t = created as Template;
                        setTemplates(prev => [t, ...prev]);
                        setTemplateId(t.id);
                        setTemplateItems([]);
                        setNewTemplateName("");
                      } catch (e2) {
                        setError(e2 instanceof Error ? e2.message : "Failed to create template");
                      } finally { setCreatingTemplate(false); }
                    }}
                  >
                    <div>
                      <FieldLabel>Template name</FieldLabel>
                      <input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
                        className={inputCls} placeholder="e.g. Website Launch" required />
                    </div>
                    <PrimaryButton disabled={creatingTemplate || !newTemplateName.trim()}>
                      {creatingTemplate ? "Creating…" : "Create Template"}
                    </PrimaryButton>
                  </form>
                </SectionCard>

                <SectionCard title="Template Milestones" description="Select a template then add milestone items to it" accentColor="#0891b2">
                  <div className="space-y-5">
                    <div>
                      <FieldLabel>Active template</FieldLabel>
                      <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={selectCls}>
                        <option value="">Choose a template…</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    {templateId && (
                      <>
                        <form
                          className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3 items-end"
                          onSubmit={async e => {
                            e.preventDefault();
                            if (!newTemplateItemTitle.trim()) return;
                            setError(null); setAddingTemplateItem(true);
                            try {
                              await supabase.from("milestone_template_items").insert({
                                template_id: templateId,
                                title: newTemplateItemTitle.trim(),
                                percentage: newTemplateItemPercentage,
                              });
                              const { data: items } = await supabase.from("milestone_template_items")
                                .select("*").eq("template_id", templateId).order("id", { ascending: true });
                              setTemplateItems((items ?? []) as TemplateItem[]);
                              setNewTemplateItemTitle(""); setNewTemplateItemPercentage(0);
                            } catch (e2) {
                              setError(e2 instanceof Error ? e2.message : "Failed to add item");
                            } finally { setAddingTemplateItem(false); }
                          }}
                        >
                          <div>
                            <FieldLabel>Milestone title</FieldLabel>
                            <input value={newTemplateItemTitle} onChange={e => setNewTemplateItemTitle(e.target.value)}
                              className={inputCls} placeholder="e.g. Design complete" required />
                          </div>
                          <div>
                            <FieldLabel>Completion %</FieldLabel>
                            <input type="number" min={0} max={100} step={1}
                              value={newTemplateItemPercentage}
                              onChange={e => setNewTemplateItemPercentage(Number(e.target.value))}
                              className={inputCls} required />
                          </div>
                          <button
                            type="submit"
                            disabled={addingTemplateItem}
                            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200
                                       hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40"
                            style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
                          >
                            {addingTemplateItem ? "…" : "+ Add"}
                          </button>
                        </form>

                        {templateItems.length > 0 ? (
                          <div className="space-y-2">
                            {templateItems.map((it, i) => (
                              <div key={it.id}
                                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <span className="text-[10px] font-bold text-slate-400 w-5 text-center tabular-nums">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <span className="flex-1 text-sm text-slate-700">{it.title}</span>
                                <div className="flex items-center gap-2.5">
                                  <div className="hidden sm:block w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                    <div className="h-full rounded-full"
                                      style={{ width: `${it.percentage}%`, background: "linear-gradient(90deg, #0891b2, #0d9488)" }} />
                                  </div>
                                  <span className="text-xs font-bold text-teal-700 tabular-nums bg-teal-50 rounded-lg px-2 py-0.5">
                                    {it.percentage}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 text-center py-6">
                            No milestones yet — add one above.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ── PROJECTS TAB ── */}
            {tab === "projects" && (
              <SectionCard title="Create Project" description="Assign a PM, customer, and optionally seed from a milestone template" accentColor="#0891b2">
                <form
                  className="space-y-5"
                  onSubmit={async e => {
                    e.preventDefault();
                    setError(null);
                    try {
                      const { data: created, error: pErr } = await supabase
                        .from("projects")
                        .insert({ name: projectName.trim(), customer_id: customerId, client_id: customerId, pm_id: pmId, status })
                        .select("*").single();
                      if (pErr) throw pErr;
                      const project = created as Project;
                      if (templateId) {
                        const { data: items } = await supabase.from("milestone_template_items")
                          .select("*").eq("template_id", templateId);
                        if (items?.length) {
                          await supabase.from("milestones").insert(
                            (items as TemplateItem[]).map(it => ({
                              project_id: project.id, title: it.title, percentage: it.percentage,
                            }))
                          );
                        }
                      }
                      setProjectName(""); setCustomerId(""); setPmId(""); setTemplateId("");
                      await refresh();
                    } catch (e2) {
                      setError(e2 instanceof Error ? e2.message : "Failed to create project");
                    }
                  }}
                >
                  <div>
                    <FieldLabel>Project name</FieldLabel>
                    <input value={projectName} onChange={e => setProjectName(e.target.value)}
                      className={inputCls} placeholder="e.g. Acme Website Redesign" required />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Customer</FieldLabel>
                      <select value={customerId} onChange={e => setCustomerId(e.target.value)} className={selectCls} required>
                        <option value="">Select customer…</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Project Manager</FieldLabel>
                      <select value={pmId} onChange={e => setPmId(e.target.value)} className={selectCls} required>
                        <option value="">Select PM…</option>
                        {pms.map(p => <option key={p.id} value={p.id}>{p.name ?? p.id}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Initial Status</FieldLabel>
                      <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="on_hold">On Hold</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Milestone Template (optional)</FieldLabel>
                      <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={selectCls}>
                        <option value="">No template</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {templateId && templateItems.length > 0 && (
                    <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                      <p className="text-[10px] font-bold text-teal-700 uppercase tracking-[0.12em] mb-3">
                        Template Preview — {templateItems.length} milestone{templateItems.length !== 1 ? "s" : ""}
                      </p>
                      <ul className="space-y-2">
                        {templateItems.map((it, i) => (
                          <li key={it.id} className="flex items-center gap-3 text-sm">
                            <span className="text-[10px] font-bold text-slate-400 w-4 tabular-nums">{i + 1}.</span>
                            <span className="flex-1 text-slate-600">{it.title}</span>
                            <span className="text-xs font-bold text-teal-700 tabular-nums">{it.percentage}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <PrimaryButton disabled={loading || !projectName.trim() || !customerId || !pmId}>
                    Create Project
                  </PrimaryButton>
                </form>
              </SectionCard>
            )}
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-5">

            {/* Overview */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <div className="h-5 w-5 rounded-md flex items-center justify-center text-teal-700"
                  style={{ background: "#ecfeff" }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="1" width="4" height="4" rx="0.5" fill="currentColor"/>
                    <rect x="7" y="1" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4"/>
                    <rect x="1" y="7" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4"/>
                    <rect x="7" y="7" width="4" height="4" rx="0.5" fill="currentColor"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-800">Overview</p>
              </div>
              <div className="p-5">
                <MiniStat label="Total users"     value={users.length} />
                <MiniStat label="Active projects" value={projects.filter(p => p.status === "active").length} />
                <MiniStat label="Completed"       value={projects.filter(p => p.status === "completed").length} />
                <MiniStat label="On hold"         value={projects.filter(p => p.status === "on_hold").length} />
                <MiniStat label="Templates"       value={templates.length} />
                <MiniStat label="Log entries"     value={activityLogs.length} />
              </div>
            </div>

            {/* Activity feed */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <div className="h-5 w-5 rounded-md flex items-center justify-center text-teal-700"
                  style={{ background: "#f0fdfa" }}>
                  <IconActivity size={11} />
                </div>
                <p className="text-sm font-bold text-slate-800">Activity Feed</p>
                <span className="ml-auto text-[10px] text-slate-400 font-medium">Last 50</span>
              </div>
              <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
                {activityLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                    <IconActivity size={22} />
                    <p className="text-xs mt-2 text-slate-400">No activity yet</p>
                  </div>
                ) : activityLogs.map(l => (
                  <div key={l.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5
                               hover:border-teal-100 hover:bg-teal-50/30 transition-colors">
                    <p className="text-[10px] text-slate-400 font-mono">
                      {new Date(l.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">{l.action}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">{l.user_id}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* All projects */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <div className="h-5 w-5 rounded-md flex items-center justify-center text-teal-700"
                  style={{ background: "#ecfeff" }}>
                  <IconProject size={11} />
                </div>
                <p className="text-sm font-bold text-slate-800">All Projects</p>
                <span className="ml-auto text-[10px] text-slate-400 font-medium">{projects.length} total</span>
              </div>
              <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                    <IconProject size={22} />
                    <p className="text-xs mt-2 text-slate-400">No projects yet</p>
                  </div>
                ) : projects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100
                               bg-slate-50 hover:border-teal-200 hover:bg-teal-50/50
                               px-3 py-2.5 transition-all duration-200 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0">
                        <IconChevron />
                      </span>
                      <p className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 truncate transition-colors">
                        {p.name}
                      </p>
                    </div>
                    <StatusPill status={p.status} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── All users drawer ── */}
      {allUsersOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setAllUsersOpen(false)}
            aria-label="Close"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">All users</p>
                <p className="text-xs text-slate-400 mt-0.5">{filteredUsers.length} shown · {users.length} total</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadUsersCsv(filteredUsers)}
                  className="h-9 px-3 rounded-xl text-xs font-bold border border-slate-200 text-slate-600
                             hover:bg-slate-50 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setAllUsersOpen(false)}
                  className="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  aria-label="Close drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 border-b border-slate-50">
              <input
                value={allUsersQuery}
                onChange={(e) => setAllUsersQuery(e.target.value)}
                placeholder="Search by name, role, or id…"
                className={inputCls}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                  <IconUsers size={28} />
                  <p className="text-sm mt-3 text-slate-400">No matches</p>
                </div>
              ) : filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-slate-100
                             bg-slate-50 px-4 py-3 hover:border-teal-100 hover:bg-teal-50/40 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm text-white text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
                    >
                      {(u.name ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-slate-900 transition-colors">
                        {u.name ?? "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">#{u.id}</p>
                    </div>
                  </div>
                  <select
                    value={(u.role ?? "").toLowerCase() === "pm" ? "pm" : "customer"}
                    onChange={async (e) => {
                      const newRole = e.target.value as UserRole;
                      const { error: rErr } = await updateProfileRole(u.id, newRole);
                      if (rErr) { setError(rErr.message); return; }
                      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: newRole } : x));
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600
                               focus:outline-none focus:ring-2 focus:ring-teal-100 cursor-pointer
                               hover:border-teal-300 transition-colors shadow-sm"
                  >
                    <option value="pm">PM</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <AdminInner />
    </RequireAuth>
  );
}