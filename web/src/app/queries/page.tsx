'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Project, Query, QueryReply } from "@/lib/domain";
import { RequireAuth } from "@/components/RequireAuth";
import { QueryThreadUI } from "@/components/QueryThreadUI";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import { isMissingTableError } from "@/lib/supabase/errors";

/* ── Shared primitives (mirrors admin panel) ─────────────────────── */

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 " +
  "placeholder-slate-400 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100";

const selectCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 " +
  "outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 cursor-pointer";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
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
      className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all
                 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
    >
      {children}
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
        active
          ? "text-white shadow-sm"
          : "text-slate-400 hover:text-teal-600 hover:bg-teal-50"
      }`}
      style={active ? { background: "linear-gradient(135deg,#0891b2,#0d9488)" } : {}}
    >
      {children}
    </button>
  );
}

/* ── Status pill ─────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    open:   { bg: "#f0fdfa", text: "#0d9488" },
    closed: { bg: "#f1f5f9", text: "#64748b" },
  };
  const c = styles[status] ?? { bg: "#f8fafc", text: "#94a3b8" };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

/* ── Stat card ───────────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center text-teal-600 flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#cffafe,#ccfbf1)" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
      </div>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────────── */
const IconQuery = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M2 2.5A1.5 1.5 0 013.5 1h9A1.5 1.5 0 0114 2.5v8A1.5 1.5 0 0112.5 12H9l-3 3v-3H3.5A1.5 1.5 0 012 10.5v-8z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M5 5h6M5 8h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconOpen = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.5 8.5l2 2 3-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconClosed = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M12 7A5 5 0 112 7a5 5 0 015-5 4.97 4.97 0 013.5 1.44L12 5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 2v3H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Query Composer ──────────────────────────────────────────────── */
function QueryComposer({
  projects,
  onCreate,
  disabled,
}: {
  projects: Project[];
  onCreate: (projectId: string, message: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  return (
    <SectionCard title="Raise a Query" description="Submit a question or request for your project">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const m = message.trim();
          if (!projectId || !m) return;
          setCreating(true);
          try {
            await onCreate(projectId, m);
            setMessage("");
          } finally {
            setCreating(false);
          }
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <FieldLabel>Project</FieldLabel>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={disabled || creating}
              className={selectCls}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Message</FieldLabel>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={disabled || creating}
              className={`${inputCls} min-h-[100px] resize-none`}
              placeholder="Write your question or request…"
              required
            />
          </div>
        </div>
        <PrimaryButton disabled={disabled || creating || !message.trim()}>
          {creating ? "Submitting…" : "Submit query"}
        </PrimaryButton>
      </form>
    </SectionCard>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function QueriesPage() {
  return (
    <RequireAuth>
      <QueriesInner />
    </RequireAuth>
  );
}

function QueriesInner() {
  const { loading, userId, role } = useCurrentUserRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<QueryReply[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryFeatureUnavailable, setQueryFeatureUnavailable] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");

  const canReply = role === "pm" || role === "admin";
  const canClose = role === "pm" || role === "admin";
  const canCreateQuery = role === "customer" || role === "pm" || role === "admin";

  const openCount   = useMemo(() => queries.filter((q) => q.status === "open").length,   [queries]);
  const closedCount = useMemo(() => queries.filter((q) => q.status === "closed").length, [queries]);

  const visibleQueries = useMemo(() => {
    if (statusFilter === "all") return queries;
    return queries.filter((q) => q.status === statusFilter);
  }, [queries, statusFilter]);

  /* ── Load projects ── */
  useEffect(() => {
    if (loading || !userId || !role) return;
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const base = supabase.from("projects").select("*");
        let q;
        if (role === "admin")         q = base.order("id", { ascending: false });
        else if (role === "pm")       q = base.eq("pm_id", userId).order("id", { ascending: false });
        else                          q = base.eq("customer_id", userId).order("id", { ascending: false });
        const { data: projData, error: projErr } = await q;
        if (projErr) throw projErr;
        if (!mounted) return;
        setProjects((projData ?? []) as Project[]);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load projects");
      }
    })();
    return () => { mounted = false; };
  }, [loading, userId, role]);

  /* ── Load queries ── */
  useEffect(() => {
    if (loading || !userId || !role) return;
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from("queries")
          .select("*")
          .order("created_at", { ascending: false });
        if (qErr) {
          if (isMissingTableError(qErr, "queries")) {
            if (!mounted) return;
            setQueries([]);
            setQueryFeatureUnavailable(true);
            setError("`queries` table is missing in Supabase. Run your DB migrations first.");
            return;
          }
          throw qErr;
        }
        if (!mounted) return;
        const list = (data ?? []) as Query[];
        setQueries(list);
        if (!selectedId && list.length) setSelectedId(list[0].id);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load queries");
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId, role]);

  /* ── Load replies for selected query ── */
  useEffect(() => {
    if (!selectedId) { setReplies([]); return; }
    setLoadingThread(true);
    (async () => {
      try {
        const { data, error: rErr } = await supabase
          .from("query_replies")
          .select("*")
          .eq("query_id", selectedId)
          .order("created_at", { ascending: true });
        if (rErr) {
          if (isMissingTableError(rErr, "query_replies")) {
            setReplies([]);
            setError("`query_replies` table is missing in Supabase. Run your DB migrations first.");
            return;
          }
          throw rErr;
        }
        setReplies((data ?? []) as QueryReply[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load replies");
      } finally {
        setLoadingThread(false);
      }
    })();
  }, [selectedId]);

  /* ── Realtime: new replies ── */
  useEffect(() => {
    if (!selectedId || !userId || !role) return;
    const channel = supabase
      .channel(`query_replies:realtime:${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "query_replies", filter: `query_id=eq.${selectedId}` },
        (payload: any) => {
          const row = payload.new as QueryReply;
          if (!row?.id) return;
          setReplies((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            const next = [...prev, row].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            return next;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, userId, role]);

  /* ── Realtime: new queries (PM/admin) ── */
  useEffect(() => {
    if (!userId || !role || queryFeatureUnavailable) return;
    if (role !== "pm" && role !== "admin") return;
    const openIds = new Set(queries.map((q) => q.id));
    const channel = supabase
      .channel("queries:realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "queries" },
        (payload: any) => {
          const row = payload.new as Query;
          if (!row?.id || openIds.has(row.id)) return;
          setQueries((prev) => [row, ...prev]);
          openIds.add(row.id);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queries, queryFeatureUnavailable, role, userId]);

  const selectedQuery = useMemo(
    () => queries.find((q) => q.id === selectedId) ?? null,
    [queries, selectedId]
  );

  return (
    <div className="min-h-screen bg-[#f0f7f9]">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
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
              Queries
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Ticket system with replies</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
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
              <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M7.5 4.5v4M7.5 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Stat row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total Queries" value={queries.length}  icon={<IconQuery />} />
          <StatCard label="Open"          value={openCount}       icon={<IconOpen />} />
          <StatCard label="Closed"        value={closedCount}     icon={<IconClosed />} />
        </div>

        {/* ── Query composer ── */}
        {canCreateQuery && !queryFeatureUnavailable && (
          <QueryComposer
            projects={projects}
            disabled={!projects.length || loadingThread}
            onCreate={async (projectId, message) => {
              if (!userId) return;
              const { data, error: insErr } = await supabase
                .from("queries")
                .insert({ project_id: projectId, created_by: userId, message, status: "open" })
                .select("*")
                .single();
              if (insErr) {
                if (isMissingTableError(insErr, "queries")) {
                  setQueryFeatureUnavailable(true);
                  setError("`queries` table is missing in Supabase. Run your DB migrations first.");
                  return;
                }
                throw insErr;
              }
              if (data) {
                setQueries((prev) => [data as Query, ...prev]);
                setSelectedId((data as Query).id);
              }
            }}
          />
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: query list */}
          <div className="lg:col-span-1">
            <SectionCard title="Queries" description="Select a thread to view">
              {/* Filter tab bar */}
              <div className="flex gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-1.5 mb-4">
                <FilterButton active={statusFilter === "open"}   onClick={() => setStatusFilter("open")}>Open</FilterButton>
                <FilterButton active={statusFilter === "closed"} onClick={() => setStatusFilter("closed")}>Closed</FilterButton>
                {role === "admin" && (
                  <FilterButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</FilterButton>
                )}
              </div>

              {visibleQueries.length === 0 ? (
                <p className="text-sm text-slate-400">No queries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {visibleQueries.map((q) => {
                    const isActive = q.id === selectedId;
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(q.id)}
                          className={`w-full text-left rounded-xl border px-3.5 py-3 text-sm transition-all ${
                            isActive
                              ? "border-teal-300 bg-teal-50 shadow-sm"
                              : "border-slate-100 hover:border-teal-200 hover:bg-teal-50/50 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-slate-800 truncate leading-snug flex-1">
                              {q.message}
                            </p>
                            <StatusPill status={q.status} />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Right: thread panel */}
          <div className="lg:col-span-2">
            {loadingThread && !selectedQuery ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6 text-sm text-slate-400">
                Loading thread…
              </div>
            ) : selectedQuery ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                {/* Thread header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedQuery.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Query thread</p>
                  </div>
                  <StatusPill status={selectedQuery.status} />
                </div>
                <div className="p-5">
                  <QueryThreadUI
                    query={selectedQuery}
                    replies={replies}
                    senderId={userId ?? ""}
                    canReply={canReply}
                    canClose={canClose}
                    onSendReply={async (message) => {
                      if (!userId) return;
                      const { error: insErr } = await supabase
                        .from("query_replies")
                        .insert({ query_id: selectedQuery.id, sender_id: userId, message });
                      if (insErr) throw insErr;
                      const { data } = await supabase
                        .from("query_replies")
                        .select("*")
                        .eq("query_id", selectedQuery.id)
                        .order("created_at", { ascending: true });
                      setReplies((data ?? []) as QueryReply[]);
                    }}
                    onClose={async () => {
                      const { error: upErr } = await supabase
                        .from("queries")
                        .update({ status: "closed" })
                        .eq("id", selectedQuery.id);
                      if (upErr) {
                        if (isMissingTableError(upErr, "queries")) {
                          setQueryFeatureUnavailable(true);
                          setError("`queries` table is missing in Supabase. Run your DB migrations first.");
                          return;
                        }
                        throw upErr;
                      }
                      setQueries((prev) =>
                        prev.map((q) =>
                          q.id === selectedQuery.id ? { ...q, status: "closed" } : q
                        )
                      );
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6 text-sm text-slate-400">
                Select a query to view the thread.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}