'use client';

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import type { Project, UserRow } from "@/lib/domain";
import type { UserRole } from "@/lib/types";
import { fetchPmAndCustomersForAdmin, setPmNameAndRole, updateProfileRole } from "@/lib/api/adminUsers";
import Link from "next/link";

/* ── Types ───────────────────────────────────────────────────────── */
type Template     = { id: string; name: string };
type TemplateItem = { id: string; template_id: string; title: string; percentage: number };
type Log          = { id: string; user_id: string; action: string; created_at: string };

/* ── Small shared primitives ─────────────────────────────────────── */
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 " +
  "placeholder-slate-400 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100";

const selectCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 " +
  "outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 cursor-pointer";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{children}</p>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PrimaryButton({ children, disabled, type = "submit", onClick }: {
  children: React.ReactNode; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all
                 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
    >
      {children}
    </button>
  );
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: "#f0fdfa", text: "#0d9488" },
  completed: { bg: "#f0fdf4", text: "#16a34a" },
  on_hold:   { bg: "#fffbeb", text: "#d97706" },
  cancelled: { bg: "#fef2f2", text: "#dc2626" },
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#f8fafc", text: "#64748b" };
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ background: c.bg, color: c.text }}>
      {status.replace("_", " ")}
    </span>
  );
}

/* ── Icons ───────────────────────────────────────────────────────── */
const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M1 13.5c0-2.485 2.239-4.5 5-4.5s5 2.015 5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M11 7a2 2 0 100-4M15 13.5c0-2-1.5-3.5-3.5-3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconTemplate = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M1.5 5.5h13M5.5 5.5v9" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const IconProject = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3.5" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 3.5V2.5a1 1 0 011-1h4a1 1 0 011 1v1M5 8h3M5 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconLog = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M11 2v3h3M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M12 7A5 5 0 112 7a5 5 0 015-5 4.97 4.97 0 013.5 1.44L12 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 2v3H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ── Stat card ───────────────────────────────────────────────────── */
function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl flex items-center justify-center text-teal-600 flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#cffafe,#ccfbf1)" }}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
      </div>
    </div>
  );
}

/* ── Main inner component ────────────────────────────────────────── */
function AdminInner() {
  const [users, setUsers]               = useState<UserRow[]>([]);
  const [templates, setTemplates]       = useState<Template[]>([]);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [projects, setProjects]         = useState<Project[]>([]);
  const [activityLogs, setActivityLogs] = useState<Log[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  /* form state */
  const [projectName, setProjectName] = useState("");
  const [customerId, setCustomerId]   = useState("");
  const [pmId, setPmId]               = useState("");
  const [status, setStatus]           = useState("active");
  const [templateId, setTemplateId]   = useState("");

  const [newTemplateName, setNewTemplateName]     = useState("");
  const [creatingTemplate, setCreatingTemplate]   = useState(false);

  const [pmCreateName, setPmCreateName]         = useState("");
  const [pmCreateEmail, setPmCreateEmail]       = useState("");
  const [pmCreatePassword, setPmCreatePassword] = useState("");
  const [creatingPm, setCreatingPm]             = useState(false);
  const [pmCreateSuccess, setPmCreateSuccess]   = useState<string | null>(null);

  const [newTemplateItemTitle, setNewTemplateItemTitle]           = useState("");
  const [newTemplateItemPercentage, setNewTemplateItemPercentage] = useState(0);
  const [addingTemplateItem, setAddingTemplateItem]               = useState(false);

  /* active tab */
  const [tab, setTab] = useState<"users" | "templates" | "projects">("users");

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const [usersResult, tRes, pRes, lRes] = await Promise.all([
        fetchPmAndCustomersForAdmin(),
        supabase.from("milestone_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (pRes.error) throw pRes.error;
      setUsers(usersResult.data);
      setTemplates((tRes.data ?? []) as Template[]);
      setProjects((pRes.data ?? []) as Project[]);
      if (lRes.error) {
        setActivityLogs([]);
        setError(
          `${lRes.error.message} — Apply supabase/migrations/0005_admin_profiles_activity_logs_rls.sql in the SQL editor so activity logs load for admins.`
        );
      } else {
        setActivityLogs((lRes.data ?? []) as Log[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!templateId) { setTemplateItems([]); return; }
    supabase.from("milestone_template_items").select("*")
      .eq("template_id", templateId).order("id", { ascending: true })
      .then(({ data }) => setTemplateItems((data ?? []) as TemplateItem[]));
  }, [templateId]);

  const customers = users.filter((u) => (u.role ?? "").toLowerCase() === "customer");
  const pms       = users.filter((u) => (u.role ?? "").toLowerCase() === "pm");

  /* ── Tabs ── */
  const TABS = [
    { key: "users",     label: "Users & PMs",   icon: <IconUsers /> },
    { key: "templates", label: "Templates",      icon: <IconTemplate /> },
    { key: "projects",  label: "Projects",       icon: <IconProject /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f0f7f9]">
      {/* Subtle grid */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(14,116,144,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(14,116,144,.04) 1px,transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Georgia',serif" }}>
              Admin Panel
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage users, templates, projects &amp; activity</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2
                       text-xs font-semibold text-slate-600 shadow-sm hover:bg-teal-50 hover:text-teal-600
                       hover:border-teal-200 transition-all disabled:opacity-50"
          >
            <span className={loading ? "animate-spin" : ""}><IconRefresh /></span>
            Refresh
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="mt-0.5 flex-shrink-0" width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7.5 4.5v4M7.5 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Customers"  value={customers.length}    icon={<IconUsers />} />
          <StatCard label="PMs"        value={pms.length}          icon={<IconUsers />} />
          <StatCard label="Projects"   value={projects.length}     icon={<IconProject />} />
          <StatCard label="Templates"  value={templates.length}    icon={<IconTemplate />} />
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: tabbed panel */}
          <div className="lg:col-span-2 space-y-4">

            {/* Tab bar */}
            <div className="flex gap-1 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                    tab === t.key
                      ? "text-white shadow-sm"
                      : "text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                  }`}
                  style={tab === t.key ? { background: "linear-gradient(135deg,#0891b2,#0d9488)" } : {}}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── USERS TAB ── */}
            {tab === "users" && (
              <div className="space-y-4">
                <SectionCard title="Manage Users" description="Update roles for PMs and customers">
                  {users.length === 0 ? (
                    <p className="text-sm text-slate-400">No users found.</p>
                  ) : (
                    <ul className="space-y-2">
                      {users.map(u => (
                        <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{u.name ?? "—"}</p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{u.id}</p>
                          </div>
                          <select
                            value={(u.role ?? "").toLowerCase() === "pm" ? "pm" : "customer"}
                            onChange={async e => {
                              const newRole = e.target.value as UserRole;
                              const { error: rErr } = await updateProfileRole(u.id, newRole);
                              if (rErr) { setError(rErr.message); return; }
                              setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700
                                       focus:outline-none focus:ring-2 focus:ring-teal-100 cursor-pointer"
                          >
                            <option value="pm">pm</option>
                            <option value="customer">customer</option>
                          </select>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>

                <SectionCard
                  title="Create PM Account"
                  description="Uses Supabase Auth (sign-up). In DevTools → Network, look for auth/v1/signup — not rest/v1."
                >
                  <form
                    className="space-y-3"
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
                          email,
                          password: pwd,
                          options: { data: { name: name || email } },
                        });
                        if (sErr) throw sErr;
                        const uid = sd.user?.id;
                        if (!uid) {
                          setPmCreateSuccess(
                            "Sign-up completed without a user id in the response (common when email confirmation is required). " +
                              "Confirm the email if prompted, then refresh this page — or run the SQL migration so admins can see all profiles. " +
                              "If the email is already registered, use a different address or reset password."
                          );
                          return;
                        }
                        const { error: rErr } = await setPmNameAndRole(uid, name || email);
                        if (rErr) throw rErr;
                        setPmCreateEmail("");
                        setPmCreatePassword("");
                        setPmCreateName("");
                        setPmCreateSuccess("PM account created and role set.");
                        await refresh();
                      } catch (e2) {
                        setError(e2 instanceof Error ? e2.message : "Failed to create PM");
                      } finally {
                        setCreatingPm(false);
                      }
                    }}
                  >
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
                    <div>
                      <FieldLabel>Password</FieldLabel>
                      <input type="password" value={pmCreatePassword} onChange={e => setPmCreatePassword(e.target.value)}
                        className={inputCls} placeholder="Minimum 6 characters" required />
                    </div>
                    {pmCreateSuccess ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {pmCreateSuccess}
                      </div>
                    ) : null}
                    <PrimaryButton type="submit" disabled={creatingPm || !pmCreateEmail.trim() || !pmCreatePassword}>
                      {creatingPm ? "Creating…" : "Create PM"}
                    </PrimaryButton>
                  </form>
                </SectionCard>
              </div>
            )}

            {/* ── TEMPLATES TAB ── */}
            {tab === "templates" && (
              <div className="space-y-4">
                <SectionCard title="New Template" description="Create a reusable milestone set">
                  <form
                    className="space-y-3"
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
                      {creatingTemplate ? "Creating…" : "Create template"}
                    </PrimaryButton>
                  </form>
                </SectionCard>

                <SectionCard title="Template Items" description="Select a template to add milestones">
                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Selected template</FieldLabel>
                      <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={selectCls}>
                        <option value="">Choose a template…</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    {templateId && (
                      <>
                        <form
                          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
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
                            <FieldLabel>Percentage</FieldLabel>
                            <input type="number" min={0} max={100} step={1}
                              value={newTemplateItemPercentage}
                              onChange={e => setNewTemplateItemPercentage(Number(e.target.value))}
                              className={inputCls} required />
                          </div>
                          <div className="sm:col-span-2">
                            <PrimaryButton disabled={addingTemplateItem}>
                              {addingTemplateItem ? "Adding…" : "Add milestone"}
                            </PrimaryButton>
                          </div>
                        </form>

                        {templateItems.length > 0 ? (
                          <ul className="space-y-1.5 mt-2">
                            {templateItems.map((it, i) => (
                              <li key={it.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                                <span className="text-[10px] font-bold text-slate-400 w-5 text-center">{i + 1}</span>
                                <span className="flex-1 text-sm text-slate-700">{it.title}</span>
                                <span className="text-xs font-semibold text-teal-600 bg-teal-50 rounded-lg px-2 py-0.5">
                                  {it.percentage}%
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-400">No items yet. Add milestones above.</p>
                        )}
                      </>
                    )}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ── PROJECTS TAB ── */}
            {tab === "projects" && (
              <SectionCard title="Create Project" description="Assign a PM, customer, and optional milestone template">
                <form
                  className="space-y-4"
                  onSubmit={async e => {
                    e.preventDefault();
                    setError(null);
                    try {
                      const { data: created, error: pErr } = await supabase
                        .from("projects")
                        .insert({ name: projectName.trim(), customer_id: customerId, pm_id: pmId, status })
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <FieldLabel>Status</FieldLabel>
                      <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="on_hold">On hold</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Milestone template (optional)</FieldLabel>
                      <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={selectCls}>
                        <option value="">No template</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {templateId && templateItems.length > 0 && (
                    <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                      <p className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2">Template preview</p>
                      <ul className="space-y-1.5">
                        {templateItems.map(it => (
                          <li key={it.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">{it.title}</span>
                            <span className="text-xs font-semibold text-teal-600">{it.percentage}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <PrimaryButton disabled={loading || !projectName.trim() || !customerId || !pmId}>
                    Create project
                  </PrimaryButton>
                </form>
              </SectionCard>
            )}
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4">
            {/* Activity logs */}
            <SectionCard title="Activity Logs" description="Last 50 actions">
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 -mr-1">
                {activityLogs.length === 0 ? (
                  <p className="text-sm text-slate-400">No logs yet.</p>
                ) : activityLogs.map(l => (
                  <div key={l.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] text-slate-400 font-medium">
                      {new Date(l.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">{l.action}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 break-all truncate">{l.user_id}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* All projects */}
            <SectionCard title="All Projects" description="Quick links">
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 -mr-1">
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-400">No projects yet.</p>
                ) : projects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50
                               hover:border-teal-200 hover:bg-teal-50 px-3 py-2.5 transition-colors group">
                    <p className="text-xs font-semibold text-slate-700 group-hover:text-teal-700 truncate">{p.name}</p>
                    <StatusPill status={p.status} />
                  </Link>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
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