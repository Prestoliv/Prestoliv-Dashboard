'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Media, Milestone, Project, Query, QueryReply, Update } from "@/lib/domain";
import { MilestoneProgressBar } from "@/components/MilestoneProgressBar";
import { UpdateFeed } from "@/components/UpdateFeed";
import { MediaUpload } from "@/components/MediaUpload";
import { QueryThreadUI } from "@/components/QueryThreadUI";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import { isMissingTableError } from "@/lib/supabase/errors";

/* ── Shared primitives ──────────────────────────────────────────── */

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 " +
  "placeholder-slate-400 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100";

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
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          {description && (
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
        {action}
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
      className="rounded-xl py-2.5 px-5 text-sm font-semibold text-white shadow-sm transition-all
                 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
    >
      {children}
    </button>
  );
}

/* ── Status pill ─────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    active:    { bg: "#f0fdfa", text: "#0d9488" },
    completed: { bg: "#f0fdf4", text: "#16a34a" },
    paused:    { bg: "#fefce8", text: "#ca8a04" },
    cancelled: { bg: "#fef2f2", text: "#dc2626" },
    open:      { bg: "#f0fdfa", text: "#0d9488" },
    closed:    { bg: "#f1f5f9", text: "#64748b" },
  };
  const c = styles[status] ?? { bg: "#f8fafc", text: "#94a3b8" };
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

/* ── Icons ───────────────────────────────────────────────────────── */
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M12 7A5 5 0 112 7a5 5 0 015-5 4.97 4.97 0 013.5 1.44L12 5"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
    />
    <path d="M12 2v3H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Queries sidebar list ─────────────────────────────────────────── */
function ProjectQueriesBox({
  projectQueries,
  selectedId,
  onSelect,
  role,
  canReply,
}: {
  projectQueries: Query[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  role: string | null;
  canReply: boolean;
}) {
  return (
    <SectionCard title="Project Queries" description="Customer questions and PM replies">
      {!projectQueries.length ? (
        <p className="text-sm text-slate-400">No queries yet.</p>
      ) : (
        <ul className="space-y-2">
          {projectQueries
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((q) => {
              const isActive = q.id === selectedId;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(q.id)}
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
                    {role === "pm" && q.status === "open" && canReply && (
                      <p className="text-[11px] text-teal-500 mt-1 font-medium">Awaiting reply</p>
                    )}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </SectionCard>
  );
}

export type ProjectDetailVariant = "page" | "drawer";

export function ProjectDetailView({
  projectId,
  variant = "page",
}: {
  projectId: string;
  variant?: ProjectDetailVariant;
}) {

  const { loading, userId, role } = useCurrentUserRole();

  const canWrite = role === "pm" || role === "admin";
  const canReply = role === "pm" || role === "admin";
  const canClose = role === "pm" || role === "admin";

  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [projectQueries, setProjectQueries] = useState<Query[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [selectedReplies, setSelectedReplies] = useState<QueryReply[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [milestoneDraft, setMilestoneDraft] = useState<Record<string, number>>({});

  const [newUpdateText, setNewUpdateText] = useState("");
  const [createdUpdateId, setCreatedUpdateId] = useState<string | null>(null);

  const [newQueryMessage, setNewQueryMessage] = useState("");
  const [creatingQuery, setCreatingQuery] = useState(false);
  const [queryFeatureUnavailable, setQueryFeatureUnavailable] = useState(false);

  async function refreshAll() {
    if (!projectId) return;
    if (!userId) return;
    setError(null);
    try {
      const { data: pData, error: pErr } = await supabase
        .from("projects").select("*").eq("id", projectId).single();
      if (pErr) throw pErr;
      setProject(pData as Project);

      const { data: mData, error: mErr } = await supabase
        .from("milestones").select("*").eq("project_id", projectId).order("id", { ascending: true });
      if (mErr) throw mErr;
      const ms = (mData ?? []) as Milestone[];
      setMilestones(ms);
      setMilestoneDraft(Object.fromEntries(ms.map((m) => [m.id, m.percentage])));

      const { data: uData, error: uErr } = await supabase
        .from("updates").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
      if (uErr) throw uErr;
      setUpdates((uData ?? []) as Update[]);

      const { data: mediaData, error: mediaErr } = await supabase
        .from("media").select("*").eq("project_id", projectId);
      if (mediaErr) throw mediaErr;
      setMedia((mediaData ?? []) as Media[]);

      const { data: qData, error: qErr } = await supabase
        .from("queries").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (qErr) {
        if (isMissingTableError(qErr, "queries")) {
          setProjectQueries([]);
          setQueryFeatureUnavailable(true);
          setError("`queries` table is missing in Supabase. Run your DB migrations first.");
          return;
        }
        throw qErr;
      }
      const qList = (qData ?? []) as Query[];
      setProjectQueries(qList);
      if (!selectedQueryId && qList.length) setSelectedQueryId(qList[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project");
    }
  }

  useEffect(() => {
    if (!projectId || loading || !userId || !role) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, loading, userId, role]);

  useEffect(() => {
    if (!selectedQueryId) { setSelectedReplies([]); return; }
    (async () => {
      try {
        const { data, error: rErr } = await supabase
          .from("query_replies").select("*").eq("query_id", selectedQueryId).order("created_at", { ascending: true });
        if (rErr) {
          if (isMissingTableError(rErr, "query_replies")) {
            setSelectedReplies([]);
            setError("`query_replies` table is missing in Supabase. Run your DB migrations first.");
            return;
          }
          throw rErr;
        }
        setSelectedReplies((data ?? []) as QueryReply[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load replies");
      }
    })();
  }, [selectedQueryId]);

  useEffect(() => {
    if (!selectedQueryId || !userId || !role) return;
    const channel = supabase
      .channel(`query_replies:realtime:${selectedQueryId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "query_replies", filter: `query_id=eq.${selectedQueryId}` },
        (payload: any) => {
          const row = payload.new as QueryReply;
          if (!row?.id) return;
          setSelectedReplies((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedQueryId, userId, role]);

  useEffect(() => {
    if (!projectId || !role || queryFeatureUnavailable) return;
    const channel = supabase
      .channel(`project:${projectId}:realtime`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "updates", filter: `project_id=eq.${projectId}` }, () => refreshAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "queries", filter: `project_id=eq.${projectId}` }, () => refreshAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, queryFeatureUnavailable, role]);

  const selectedQuery = useMemo(
    () => projectQueries.find((q) => q.id === selectedQueryId) ?? null,
    [projectQueries, selectedQueryId]
  );

  const isDrawer = variant === "drawer";

  if (loading) {
    return (
      <div className={`text-slate-400 text-sm ${isDrawer ? "p-6" : "p-8"}`}>Loading…</div>
    );
  }

  return (
    <div className={isDrawer ? "bg-[#f0f7f9] min-h-0" : "min-h-screen bg-[#f0f7f9]"}>
      {!isDrawer && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(14,116,144,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(14,116,144,.04) 1px,transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      )}

      <div
        className={
          isDrawer
            ? "relative z-10 max-w-6xl mx-auto w-full px-3 sm:px-4 py-2 space-y-4 pb-6"
            : "relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6"
        }
      >

        {/* ── Page header ── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1
              className={`font-bold text-slate-800 ${isDrawer ? "text-xl" : "text-2xl"}`}
              style={{ fontFamily: "'Georgia',serif" }}
            >
              {project?.name ?? "Project"}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-xs text-slate-400 font-medium">ID: {projectId}</p>
              {project?.status && <StatusPill status={project.status} />}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refreshAll()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2
                       text-xs font-semibold text-slate-600 shadow-sm hover:bg-teal-50 hover:text-teal-600
                       hover:border-teal-200 transition-all"
          >
            <IconRefresh />
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

        {/* ── Milestone progress ── */}
        <SectionCard title="Milestone Progress" description="Overall project completion">
          <MilestoneProgressBar milestones={milestones} />
        </SectionCard>

        {/* ── PM write area ── */}
        {canWrite && (
          <div className={`grid gap-5 ${isDrawer ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>

            {/* Update milestones */}
            <SectionCard title="Update Milestones" description="Adjust progress percentages">
              {milestones.length ? (
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!userId) return;
                    try {
                      const changed = milestones.filter((m) => {
                        const v = milestoneDraft[m.id];
                        return typeof v === "number" && v !== m.percentage;
                      });
                      await Promise.all(
                        changed.map((m) =>
                          supabase.from("milestones").update({ percentage: milestoneDraft[m.id] }).eq("id", m.id)
                        )
                      );
                      await refreshAll();
                    } catch (e2) {
                      setError(e2 instanceof Error ? e2.message : "Failed to update milestones");
                    }
                  }}
                >
                  {milestones.map((m) => (
                    <div key={m.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <FieldLabel>{m.title}</FieldLabel>
                        <span className="text-[11px] font-bold text-teal-600">{milestoneDraft[m.id] ?? m.percentage}%</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={milestoneDraft[m.id] ?? m.percentage}
                        onChange={(e) =>
                          setMilestoneDraft((prev) => ({ ...prev, [m.id]: Number(e.target.value) }))
                        }
                        className={inputCls}
                      />
                    </div>
                  ))}
                  <PrimaryButton type="submit">Save milestone progress</PrimaryButton>
                </form>
              ) : (
                <p className="text-sm text-slate-400">No milestones yet.</p>
              )}
            </SectionCard>

            {/* Create update */}
            <SectionCard title="Create an Update" description="Share progress with customers">
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!userId || !newUpdateText.trim()) return;
                  try {
                    const { data, error: insErr } = await supabase
                      .from("updates")
                      .insert({ project_id: projectId, created_by: userId, text: newUpdateText.trim() })
                      .select("*")
                      .single();
                    if (insErr) throw insErr;
                    setCreatedUpdateId((data as Update).id);
                    setNewUpdateText("");
                    await refreshAll();
                  } catch (e2) {
                    setError(e2 instanceof Error ? e2.message : "Failed to create update");
                  }
                }}
              >
                <div>
                  <FieldLabel>Update text</FieldLabel>
                  <textarea
                    value={newUpdateText}
                    onChange={(e) => setNewUpdateText(e.target.value)}
                    className={`${inputCls} min-h-[120px] resize-none`}
                    placeholder="Write an update for customers…"
                    required
                  />
                </div>
                <PrimaryButton type="submit">Post update</PrimaryButton>
              </form>

              {createdUpdateId && (
                <div className="mt-4 space-y-3">
                  <MediaUpload
                    projectId={projectId}
                    updateId={createdUpdateId}
                    onUploaded={async () => { await refreshAll(); }}
                  />
                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm
                               font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                    onClick={() => setCreatedUpdateId(null)}
                  >
                    Done adding media
                  </button>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ── Update feed ── */}
        <SectionCard title="Update Feed" description="Customers see updates in real time">
          <UpdateFeed updates={updates} media={media} />
        </SectionCard>

        {/* ── Queries section ── */}
        <div className={`grid gap-5 ${isDrawer ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"}`}>

          {/* Left: raise query + list */}
          <div className={`space-y-4 ${isDrawer ? "" : "lg:col-span-1"}`}>
            {!canWrite && !queryFeatureUnavailable && (
              <SectionCard title="Raise a Query" description="Ask about this project">
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!userId) return;
                    const msg = newQueryMessage.trim();
                    if (!msg) return;
                    setCreatingQuery(true);
                    try {
                      const { data, error: insErr } = await supabase
                        .from("queries")
                        .insert({ project_id: projectId, created_by: userId, message: msg, status: "open" })
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
                      const q = data as Query;
                      setProjectQueries((prev) => [q, ...prev]);
                      setSelectedQueryId(q.id);
                      setNewQueryMessage("");
                    } catch (e2) {
                      setError(e2 instanceof Error ? e2.message : "Failed to create query");
                    } finally {
                      setCreatingQuery(false);
                    }
                  }}
                >
                  <div>
                    <FieldLabel>Message</FieldLabel>
                    <textarea
                      value={newQueryMessage}
                      onChange={(e) => setNewQueryMessage(e.target.value)}
                      className={`${inputCls} min-h-[110px] resize-none`}
                      placeholder="Ask about this project…"
                      required
                    />
                  </div>
                  <PrimaryButton
                    type="submit"
                    disabled={creatingQuery || !newQueryMessage.trim()}
                  >
                    {creatingQuery ? "Submitting…" : "Submit query"}
                  </PrimaryButton>
                </form>
              </SectionCard>
            )}

            <ProjectQueriesBox
              projectQueries={projectQueries}
              selectedId={selectedQueryId}
              onSelect={setSelectedQueryId}
              role={role}
              canReply={canReply}
            />
          </div>

          {/* Right: thread panel */}
          <div className={isDrawer ? "" : "lg:col-span-2"}>
            {selectedQuery ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
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
                    replies={selectedReplies}
                    senderId={userId ?? ""}
                    canReply={canReply}
                    canClose={canClose}
                    onSendReply={async (message) => {
                      if (!userId) return;
                      const { error: insErr } = await supabase
                        .from("query_replies")
                        .insert({ query_id: selectedQuery.id, sender_id: userId, message });
                      if (insErr) {
                        if (isMissingTableError(insErr, "query_replies")) {
                          setError("`query_replies` table is missing in Supabase. Run your DB migrations first.");
                          return;
                        }
                        throw insErr;
                      }
                      const { data } = await supabase
                        .from("query_replies").select("*").eq("query_id", selectedQuery.id).order("created_at", { ascending: true });
                      setSelectedReplies((data ?? []) as QueryReply[]);
                    }}
                    onClose={async () => {
                      const { error: upErr } = await supabase
                        .from("queries").update({ status: "closed" }).eq("id", selectedQuery.id);
                      if (upErr) {
                        if (isMissingTableError(upErr, "queries")) {
                          setQueryFeatureUnavailable(true);
                          setError("`queries` table is missing in Supabase. Run your DB migrations first.");
                          return;
                        }
                        throw upErr;
                      }
                      setProjectQueries((prev) =>
                        prev.map((q) => (q.id === selectedQuery.id ? { ...q, status: "closed" } : q))
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