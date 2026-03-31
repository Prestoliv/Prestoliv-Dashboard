'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Project, Query, QueryReply } from "@/lib/domain";
import { QueryThreadUI } from "@/components/QueryThreadUI";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import { isMissingTableError } from "@/lib/supabase/errors";

type View = "projects" | "queries" | "thread";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 " +
  "placeholder-slate-400 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100";

function projectStatusLabel(s: Project["status"]) {
  const map: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    on_hold: "On hold",
    cancelled: "Cancelled",
  };
  return map[s] ?? s;
}

function StatusDot({ status }: { status: Project["status"] }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-500",
    completed: "bg-blue-500",
    on_hold: "bg-amber-500",
    cancelled: "bg-red-400",
  };
  return <span className={`h-2 w-2 rounded-full flex-shrink-0 ${colors[status] ?? "bg-slate-400"}`} />;
}

function QueryStatusPill({ status }: { status: string }) {
  const open = status === "open";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        open ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {status}
    </span>
  );
}

export function FloatingProjectsChatWidget() {
  const { loading, userId, role } = useCurrentUserRole();
  const [panelOpen, setPanelOpen] = useState(true);
  const [view, setView] = useState<View>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [replies, setReplies] = useState<QueryReply[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryFeatureUnavailable, setQueryFeatureUnavailable] = useState(false);

  const [projectFilter, setProjectFilter] = useState<"active" | "closed">("active");
  const [queryStatusFilter, setQueryStatusFilter] = useState<"open" | "closed" | "all">("open");

  const [newQueryText, setNewQueryText] = useState("");
  const [creatingQuery, setCreatingQuery] = useState(false);

  const canReply = role === "pm" || role === "admin";
  const canClose = role === "pm" || role === "admin";
  const canCreateQuery = role === "customer" || role === "pm" || role === "admin";

  const filteredProjects = useMemo(() => {
    if (projectFilter === "active") return projects.filter((p) => p.status === "active");
    return projects.filter((p) => p.status !== "active");
  }, [projects, projectFilter]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const queriesForProject = useMemo(() => {
    if (!selectedProjectId) return [];
    return queries.filter((q) => q.project_id === selectedProjectId);
  }, [queries, selectedProjectId]);

  const visibleQueries = useMemo(() => {
    if (queryStatusFilter === "all") return queriesForProject;
    return queriesForProject.filter((q) => q.status === queryStatusFilter);
  }, [queriesForProject, queryStatusFilter]);

  const selectedQuery = useMemo(
    () => queries.find((q) => q.id === selectedQueryId) ?? null,
    [queries, selectedQueryId]
  );

  /* Load projects */
  useEffect(() => {
    if (loading || !userId || !role) return;
    let mounted = true;
    (async () => {
      try {
        const base = supabase.from("projects").select("*");
        let q;
        if (role === "admin") q = base.order("id", { ascending: false });
        else if (role === "pm") q = base.eq("pm_id", userId).order("id", { ascending: false });
        else q = base.eq("customer_id", userId).order("id", { ascending: false });
        const { data, error: err } = await q;
        if (err) throw err;
        if (!mounted) return;
        setError(null);
        setProjects((data ?? []) as Project[]);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load projects");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loading, userId, role]);

  /* Load queries */
  useEffect(() => {
    if (loading || !userId || !role) return;
    let mounted = true;
    (async () => {
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
            return;
          }
          throw qErr;
        }
        if (!mounted) return;
        setError(null);
        setQueries((data ?? []) as Query[]);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load queries");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loading, userId, role]);

  /* Replies for selected query */
  useEffect(() => {
    if (!selectedQueryId) {
      setReplies([]);
      return;
    }
    setLoadingThread(true);
    (async () => {
      try {
        const { data, error: rErr } = await supabase
          .from("query_replies")
          .select("*")
          .eq("query_id", selectedQueryId)
          .order("created_at", { ascending: true });
        if (rErr) {
          if (isMissingTableError(rErr, "query_replies")) {
            setReplies([]);
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
  }, [selectedQueryId]);

  /* Realtime replies */
  useEffect(() => {
    if (!selectedQueryId || !userId || !role) return;
    const channel = supabase
      .channel(`widget:query_replies:${selectedQueryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "query_replies", filter: `query_id=eq.${selectedQueryId}` },
        (payload: { new: QueryReply }) => {
          const row = payload.new;
          if (!row?.id) return;
          setReplies((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [...prev, row].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedQueryId, userId, role]);

  function openProject(id: string) {
    setSelectedProjectId(id);
    setSelectedQueryId(null);
    setView("queries");
    setQueryStatusFilter("open");
  }

  function openThread(queryId: string) {
    setSelectedQueryId(queryId);
    setView("thread");
  }

  function goBack() {
    if (view === "thread") {
      setSelectedQueryId(null);
      setView("queries");
    } else if (view === "queries") {
      setSelectedProjectId(null);
      setView("projects");
    }
  }

  function closePanel() {
    setPanelOpen(false);
    setView("projects");
    setSelectedProjectId(null);
    setSelectedQueryId(null);
  }

  if (loading || !userId || !role) return null;

  return (
    <>
      {/* Floating button */}
      {!panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-5 right-5 z-[95] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-2"
          style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
          aria-label="Open project messages"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Panel */}
      {panelOpen && (
        <div
          className="fixed bottom-5 right-5 z-[95] flex w-[min(100vw-24px,400px)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl"
          style={{ height: "min(580px, calc(100vh - 40px))" }}
          role="dialog"
          aria-modal="true"
          aria-label="Project messages"
        >
          {/* Header */}
          <div
            className="flex flex-shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-2.5"
            style={{ background: "linear-gradient(135deg,#f0fdfa,#ecfeff)" }}
          >
            {view !== "projects" && (
              <button
                type="button"
                onClick={goBack}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-white/80"
                aria-label="Back"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">
                {view === "projects" && "Messages"}
                {view === "queries" && (selectedProject?.name ?? "Project")}
                {view === "thread" && "Conversation"}
              </p>
              <p className="text-[11px] text-slate-500">
                {view === "projects" && "Your projects"}
                {view === "queries" && "Queries for this project"}
                {view === "thread" && (selectedQuery ? selectedQuery.message.slice(0, 42) + (selectedQuery.message.length > 42 ? "…" : "") : "")}
              </p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/80 hover:text-slate-800"
              aria-label="Minimize"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {error && (
            <p
              className={`flex-shrink-0 border-b px-3 py-2 text-xs ${
                queryFeatureUnavailable
                  ? "border-amber-100 bg-amber-50 text-amber-800"
                  : "border-red-100 bg-red-50 text-red-700"
              }`}
            >
              {queryFeatureUnavailable ? "Queries unavailable." : error}
            </p>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Projects list */}
          {view === "projects" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex gap-1 border-b border-slate-100 bg-slate-50/80 px-2 py-2">
                <button
                  type="button"
                  onClick={() => setProjectFilter("active")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                    projectFilter === "active"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-500 hover:text-teal-700"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setProjectFilter("closed")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                    projectFilter === "closed"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-500 hover:text-teal-700"
                  }`}
                >
                  Closed
                </button>
              </div>
              <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {projectFilter === "active" ? "Active projects" : "Inactive / ended projects"}
              </p>
              <div className="flex-1 overflow-y-auto px-2 pb-3 pt-1" style={{ minHeight: 0 }}>
                {filteredProjects.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-400">No projects in this filter.</p>
                ) : (
                  <ul className="space-y-1">
                    {filteredProjects.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => openProject(p.id)}
                          className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-teal-200 hover:bg-teal-50/60"
                        >
                          <div
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
                          >
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <StatusDot status={p.status} />
                              <span className="text-[11px] text-slate-500">{projectStatusLabel(p.status)}</span>
                            </div>
                          </div>
                          <svg width="16" height="16" className="flex-shrink-0 text-slate-300" viewBox="0 0 16 16" fill="none">
                            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Queries for project */}
          {view === "queries" && selectedProjectId && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex gap-1 border-b border-slate-100 bg-slate-50/80 px-2 py-2">
                {(["open", "closed", "all"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setQueryStatusFilter(f)}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold capitalize transition ${
                      queryStatusFilter === f ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-teal-700"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2" style={{ minHeight: 0 }}>
                {!queryFeatureUnavailable && canCreateQuery && (
                  <form
                    className="mb-2 mt-2 space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!userId || !newQueryText.trim() || !selectedProjectId) return;
                      setCreatingQuery(true);
                      try {
                        const { data, error: insErr } = await supabase
                          .from("queries")
                          .insert({
                            project_id: selectedProjectId,
                            created_by: userId,
                            message: newQueryText.trim(),
                            status: "open",
                          })
                          .select("*")
                          .single();
                        if (insErr) throw insErr;
                        if (data) {
                          setQueries((prev) => [data as Query, ...prev]);
                          setNewQueryText("");
                          openThread((data as Query).id);
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to create query");
                      } finally {
                        setCreatingQuery(false);
                      }
                    }}
                  >
                    <textarea
                      value={newQueryText}
                      onChange={(e) => setNewQueryText(e.target.value)}
                      placeholder="New message…"
                      rows={2}
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      disabled={creatingQuery || !newQueryText.trim()}
                      className="w-full rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
                    >
                      {creatingQuery ? "Sending…" : "Start conversation"}
                    </button>
                  </form>
                )}

                {visibleQueries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">No threads match this filter.</p>
                ) : (
                  <ul className="space-y-1">
                    {visibleQueries.map((q) => (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => openThread(q.id)}
                          className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                            selectedQueryId === q.id
                              ? "border-teal-300 bg-teal-50"
                              : "border-slate-100 hover:border-teal-200 hover:bg-teal-50/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 font-medium text-slate-800">{q.message}</p>
                            <QueryStatusPill status={q.status} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Thread */}
          {view === "thread" && selectedQuery && userId && (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3 pt-2">
              {loadingThread ? (
                <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
              ) : (
                <QueryThreadUI
                  query={selectedQuery}
                  replies={replies}
                  senderId={userId}
                  canReply={canReply}
                  canClose={canClose}
                  compact
                  onSendReply={async (message) => {
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
                    if (upErr) throw upErr;
                    setQueries((prev) =>
                      prev.map((q) => (q.id === selectedQuery.id ? { ...q, status: "closed" as const } : q))
                    );
                  }}
                />
              )}
            </div>
          )}
          </div>
        </div>
      )}
    </>
  );
}
