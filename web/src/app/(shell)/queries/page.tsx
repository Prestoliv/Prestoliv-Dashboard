'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Project, Query, QueryReply } from "@/lib/domain";
import {
  httpBroadcastQueryThread,
  subscribeQueryThreadBroadcast,
} from "@/lib/realtime/queryThreadRealtime";
import { RequireAuth } from "@/components/RequireAuth";
import { QueryThreadUI } from "@/components/QueryThreadUI";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import { isMissingTableError } from "@/lib/supabase/errors";
import { useSWRCache } from "@/lib/cache/useSWRCache";

/* ─────────────────────────────────────────────────────────────────
   PRIMITIVES
───────────────────────────────────────────────────────────────── */
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

function Panel({
  title, subtitle, children, action, noPad = false,
}: {
  title: string; subtitle?: string; children: React.ReactNode;
  action?: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={noPad ? "" : "p-5"}>{children}</div>
    </div>
  );
}

function PrimaryButton({ children, disabled, type = "submit", onClick }: {
  children: React.ReactNode; disabled?: boolean;
  type?: "submit" | "button"; onClick?: () => void;
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all
                 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}>
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────── */
const IconQuery = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 3A1.5 1.5 0 013.5 1.5h11A1.5 1.5 0 0116 3v9a1.5 1.5 0 01-1.5 1.5H10l-3.5 3.5V13.5H3.5A1.5 1.5 0 012 12V3z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M5.5 6h7M5.5 9h4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconOpen = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M6 9.5l2.5 2.5 4-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClosed = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M6 6l6 6M12 6l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M12 7A5 5 0 112 7a5 5 0 015-5 4.97 4.97 0 013.5 1.44L12 5"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 2v3H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M13 2L1 7l5 2.5L9 15l4-13z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M6 9.5l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconEmpty = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-slate-200">
    <path d="M5 8A3 3 0 018 5h24a3 3 0 013 3v18a3 3 0 01-3 3H22l-7 7v-7H8a3 3 0 01-3-3V8z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M13 15h14M13 21h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/* ─────────────────────────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon, color = "teal", pct }: {
  label: string; value: number; icon: React.ReactNode;
  color?: "teal" | "emerald" | "slate"; pct?: number;
}) {
  const gradients = {
    teal:    { bar: "#0d9488", bg: "from-teal-50 to-cyan-50",     text: "text-teal-600" },
    emerald: { bar: "#10b981", bg: "from-emerald-50 to-teal-50",  text: "text-emerald-600" },
    slate:   { bar: "#94a3b8", bg: "from-slate-50 to-slate-100",  text: "text-slate-500" },
  };
  const c = gradients[color];

  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 overflow-hidden relative
                    hover:border-slate-200 hover:shadow-md hover:shadow-slate-100 transition-all duration-200 group">
      <div className={`absolute top-0 left-0 right-0 h-0.5`} style={{ background: c.bar, opacity: 0.5 }}/>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${c.bg} ${c.text} flex-shrink-0`}>
          {icon}
        </div>
        {pct !== undefined && (
          <span className="text-[11px] font-semibold text-slate-400">{pct}%</span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-xs text-slate-500 font-medium mt-1">{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MINI RESOLUTION RATE BAR
───────────────────────────────────────────────────────────────── */
function ResolutionRate({ open, closed }: { open: number; closed: number }) {
  const total = open + closed;
  const rate  = total > 0 ? Math.round((closed / total) * 100) : 0;

  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 overflow-hidden relative
                    hover:border-slate-200 hover:shadow-md transition-all duration-200">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400 opacity-50"/>
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2a7 7 0 100 14A7 7 0 009 2z" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9 6v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">of {total} total</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{rate}%</p>
      <p className="text-xs text-slate-500 font-medium mt-1">Resolution Rate</p>
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out bg-blue-500"
          style={{ width: `${rate}%` }}/>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STATUS PILL
───────────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; dot: string }> = {
    open:   { bg: "#f0fdfa", text: "#0d9488", dot: "#0d9488" },
    closed: { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  };
  const c = cfg[status] ?? { bg: "#f8fafc", text: "#94a3b8", dot: "#cbd5e1" };
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }}/>
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   QUERY LIST ITEM
───────────────────────────────────────────────────────────────── */
function QueryListItem({ query, active, onClick }: {
  query: Query; active: boolean; onClick: () => void;
}) {
  const relTime = useMemo(() => {
    try {
      const diff = Date.now() - new Date(query.created_at).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60)  return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24)   return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch { return ""; }
  }, [query.created_at]);

  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all duration-150 group ${
        active
          ? "border-teal-300 bg-teal-50/80 shadow-sm"
          : "border-slate-100 bg-white hover:border-teal-200 hover:bg-teal-50/40"
      }`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`text-sm font-semibold truncate leading-snug flex-1 ${active ? "text-teal-800" : "text-slate-800"}`}>
          {query.message}
        </p>
        <StatusPill status={query.status}/>
      </div>
      <p className="text-[11px] text-slate-400">{relTime}</p>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   QUERY COMPOSER
───────────────────────────────────────────────────────────────── */
function QueryComposer({ projects, onCreate, disabled }: {
  projects: Project[];
  onCreate: (projectId: string, message: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [message, setMessage]     = useState("");
  const [creating, setCreating]   = useState(false);
  const [focused, setFocused]     = useState(false);

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  return (
    <Panel title="New Query" subtitle="Submit a question to your project manager">
      <form className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const m = message.trim();
          if (!projectId || !m) return;
          setCreating(true);
          try { await onCreate(projectId, m); setMessage(""); }
          finally { setCreating(false); }
        }}>
        <div>
          <FieldLabel>Project</FieldLabel>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            disabled={disabled || creating} className={selectCls}>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Your message</FieldLabel>
          <div className={`relative rounded-xl border transition-all duration-200 overflow-hidden
            ${focused ? "border-teal-300 ring-2 ring-teal-100 bg-white" : "border-slate-200 bg-slate-50"}`}>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              disabled={disabled || creating}
              className="w-full bg-transparent px-3.5 pt-3 pb-10 text-sm text-slate-800
                         placeholder-slate-400 outline-none resize-none leading-relaxed"
              style={{ minHeight: 100 }}
              placeholder="Describe your question clearly…"
              required/>
            {/* Footer with char count + send */}
            <div className="absolute bottom-0 inset-x-0 px-3 py-2 flex items-center justify-between
                            border-t border-slate-100 bg-white/80 backdrop-blur-sm">
              <span className={`text-[11px] font-medium ${message.length > 300 ? "text-red-500" : "text-slate-400"}`}>
                {message.length} chars
              </span>
              <button type="submit" disabled={disabled || creating || !message.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
                           text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}>
                {creating
                  ? <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block"/>
                  : <IconSend/>
                }
                {creating ? "Sending…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Panel>
  );
}

/* ─────────────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────────────── */
function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <IconEmpty/>
      <p className="mt-4 text-sm font-semibold text-slate-500">
        No {filter !== "all" ? filter : ""} queries
      </p>
      <p className="text-xs text-slate-400 mt-1">
        {filter === "open" ? "All caught up! No open queries right now." : "Nothing here yet."}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────── */
export default function QueriesPage() {
  return <RequireAuth><QueriesInner /></RequireAuth>;
}

function QueriesInner() {
  const { loading, userId, role } = useCurrentUserRole();
  const [projects, setProjects]   = useState<Project[]>([]);
  const [queries, setQueries]     = useState<Query[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replies, setReplies]     = useState<QueryReply[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [queryFeatureUnavailable, setQueryFeatureUnavailable] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [search, setSearch]       = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const typingThrottleRef = useRef(0);
  const lastRealtimeReplyAtRef = useRef(0);

  const canReply       = role === "pm" || role === "admin";
  const canClose       = role === "pm" || role === "admin";
  const canCreateQuery = role === "customer" || role === "pm" || role === "admin";

  const openCount   = useMemo(() => queries.filter(q => q.status === "open").length,   [queries]);
  const closedCount = useMemo(() => queries.filter(q => q.status === "closed").length, [queries]);
  const openPct     = queries.length ? Math.round((openCount / queries.length) * 100)   : 0;
  const closedPct   = queries.length ? Math.round((closedCount / queries.length) * 100) : 0;

  const visibleQueries = useMemo(() => {
    let list = statusFilter === "all" ? queries : queries.filter(q => q.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(q => q.message.toLowerCase().includes(s));
    }
    return list;
  }, [queries, statusFilter, search]);

  const enabled = !loading && !!userId && !!role;
  const projectsKey = enabled ? `queries:projects:${role}:${userId}` : "queries:projects:anon";
  const queriesKey = enabled ? `queries:list:${role}:${userId}` : "queries:list:anon";

  const projectsSWR = useSWRCache<Project[]>({
    key: projectsKey,
    enabled,
    ttlMs: 60_000,
    fetcher: async () => {
      const base = supabase.from("projects").select("*");
      const q =
        role === "admin"
          ? base.order("id", { ascending: false })
          : role === "pm"
            ? base.eq("pm_id", userId!).order("id", { ascending: false })
            : base.eq("customer_id", userId!).order("id", { ascending: false });
      const { data, error: e } = await q;
      if (e) throw e;
      return (data ?? []) as Project[];
    },
  });

  const queriesSWR = useSWRCache<Query[]>({
    key: queriesKey,
    enabled,
    ttlMs: 15_000,
    fetcher: async () => {
      const { data, error: qErr } = await supabase.from("queries").select("*").order("created_at", { ascending: false });
      if (qErr) {
        if (isMissingTableError(qErr, "queries")) {
          setQueryFeatureUnavailable(true);
          return [];
        }
        throw qErr;
      }
      return (data ?? []) as Query[];
    },
  });

  useEffect(() => {
    if (projectsSWR.data) setProjects(projectsSWR.data);
  }, [projectsSWR.data]);

  useEffect(() => {
    if (!queriesSWR.data) return;
    setQueries(queriesSWR.data);
    if (!selectedId && queriesSWR.data.length) setSelectedId(queriesSWR.data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queriesSWR.data]);

  useEffect(() => {
    const e = projectsSWR.error ?? queriesSWR.error;
    if (!e) return;
    setError(e instanceof Error ? e.message : "Failed to load queries");
  }, [projectsSWR.error, queriesSWR.error]);

  /* ── Load replies ── */
  useEffect(() => {
    if (!selectedId) { setReplies([]); return; }
    setLoadingThread(true);
    (async () => {
      try {
        const { data, error: rErr } = await supabase.from("query_replies")
          .select("*").eq("query_id", selectedId).order("created_at", { ascending: true });
        if (rErr) {
          if (isMissingTableError(rErr, "query_replies")) { setReplies([]); return; }
          throw rErr;
        }
        setReplies((data ?? []) as QueryReply[]);
        lastRealtimeReplyAtRef.current = Date.now();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load replies");
      } finally { setLoadingThread(false); }
    })();
  }, [selectedId]);

  /* ── Realtime: new replies ── */
  useEffect(() => {
    if (!selectedId || !userId || !role) return;
    const ch = supabase.channel(`qr:${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "query_replies", filter: `query_id=eq.${selectedId}` },
        (payload: any) => {
          const row = payload.new as QueryReply;
          if (!row?.id) return;
          lastRealtimeReplyAtRef.current = Date.now();
          setReplies(prev => prev.some(r => r.id === row.id) ? prev :
            [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, userId, role]);

  /* ── Realtime: new queries ── */
  useEffect(() => {
    if (!userId || !role || queryFeatureUnavailable || (role !== "pm" && role !== "admin")) return;
    const ids = new Set(queries.map(q => q.id));
    const ch = supabase.channel("queries:rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "queries" },
        (payload: any) => {
          const row = payload.new as Query;
          if (!row?.id || ids.has(row.id)) return;
          setQueries(prev => [row, ...prev]);
          ids.add(row.id);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queries, queryFeatureUnavailable, role, userId]);

  const selectedQuery = useMemo(
    () => queries.find(q => q.id === selectedId) ?? null,
    [queries, selectedId]
  );

  const lastReadByPeerAt = useMemo(() => {
    if (!selectedQuery) return null;
    if (role === "customer") return selectedQuery.last_read_team_at ?? null;
    return selectedQuery.last_read_customer_at ?? null;
  }, [selectedQuery, role]);

  const peerTypingLabel = role === "customer" ? "Support" : "Customer";

  /* ── Mark thread read (RPC) + broadcast for portal ── */
  useEffect(() => {
    if (!selectedId || !userId || !role) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (role === "pm" || role === "admin") {
          await supabase.rpc("mark_query_read_team", { p_query_id: selectedId });
        } else if (role === "customer") {
          await supabase.rpc("mark_query_read_customer", { p_query_id: selectedId });
        } else return;
        const { data } = await supabase
          .from("queries")
          .select("last_read_customer_at, last_read_team_at")
          .eq("id", selectedId)
          .single();
        if (cancelled || !data) return;
        setQueries((prev) => prev.map((q) => (q.id === selectedId ? { ...q, ...data } : q)));
        try {
          await httpBroadcastQueryThread(supabase, selectedId, "read", data as Record<string, unknown>);
        } catch { /* best-effort */ }
      } catch { /* ignore */ }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [selectedId, userId, role]);

  /* ── Realtime: query row updates (read receipts from other clients) ── */
  useEffect(() => {
    if (!selectedId || !userId) return;
    const ch = supabase
      .channel(`queries-up:${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "queries",
          filter: `id=eq.${selectedId}`,
        },
        (payload: { new: Query }) => {
          const row = payload.new;
          setQueries((prev) => prev.map((q) => (q.id === row.id ? { ...q, ...row } : q)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedId, userId]);

  /* ── Broadcast: typing + read (portal sends read/typing) ── */
  useEffect(() => {
    if (!selectedId || !userId) return;
    const off = subscribeQueryThreadBroadcast(supabase, selectedId, {
      onReply: (reply) => {
        if (reply.query_id !== selectedId) return;
        lastRealtimeReplyAtRef.current = Date.now();
        setReplies((prev) =>
          prev.some((r) => r.id === reply.id)
            ? prev
            : [...prev, reply].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
        );
      },
      onRead: (p) => {
        setQueries((prev) =>
          prev.map((q) => (q.id === selectedId ? { ...q, ...p } : q))
        );
      },
      onTyping: (p) => {
        if (p.userId === userId) return;
        setPeerTyping(p.typing);
      },
    });
    return off;
  }, [selectedId, userId]);

  useEffect(() => {
    setPeerTyping(false);
  }, [selectedId]);

  /* Fallback: if realtime/broadcast is flaky, poll replies every ~10s. */
  useEffect(() => {
    if (!selectedId || !userId) return;
    const iv = window.setInterval(async () => {
      if (Date.now() - lastRealtimeReplyAtRef.current < 8_000) return;
      try {
        const { data, error: rErr } = await supabase
          .from("query_replies")
          .select("*")
          .eq("query_id", selectedId)
          .order("created_at", { ascending: true });
        if (rErr) {
          setError(rErr.message);
          return;
        }
        const incoming = (data ?? []) as QueryReply[];
        setReplies(incoming);
        // If we got here without a recent realtime event, treat it as a fresh sync.
        lastRealtimeReplyAtRef.current = Date.now();
      } catch {
        // best-effort
      }
    }, 10_000);
    return () => window.clearInterval(iv);
  }, [selectedId, userId]);

  async function emitDashboardTyping(active: boolean) {
    if (!selectedId || !userId) return;
    const now = Date.now();
    if (active && now - typingThrottleRef.current < 400) return;
    typingThrottleRef.current = now;
    try {
      await httpBroadcastQueryThread(supabase, selectedId, "typing", { userId, typing: active });
    } catch { /* ignore */ }
  }

  /* ─── FILTER TABS ─── */
  const TABS: { key: "open" | "closed" | "all"; label: string; count?: number }[] = [
    { key: "open",   label: "Open",   count: openCount },
    { key: "closed", label: "Closed", count: closedCount },
    ...(role === "admin" ? [{ key: "all" as const, label: "All", count: queries.length }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f0f7f9]">
      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(14,116,144,.03) 1px,transparent 1px),
                          linear-gradient(90deg,rgba(14,116,144,.03) 1px,transparent 1px)`,
        backgroundSize: "40px 40px",
      }}/>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ─── HEADER ─── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none"
              style={{ fontFamily: "'Georgia', serif" }}>
              Queries
            </h1>
            <p className="text-sm text-slate-500 mt-1">Ticket system · real-time replies</p>
          </div>
          <button type="button" onClick={() => window.location.reload()} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2
                       text-xs font-semibold text-slate-600 hover:bg-teal-50 hover:text-teal-600
                       hover:border-teal-200 transition-all disabled:opacity-50">
            <span className={loading ? "animate-spin" : ""}><IconRefresh/></span>
            Refresh
          </button>
        </div>

        {/* ─── ERROR ─── */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="mt-0.5 flex-shrink-0" width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7.5 4.5v4M7.5 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {/* ─── STATS (4 cards) ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Queries" value={queries.length}  icon={<IconQuery/>}  color="teal"/>
          <StatCard label="Open"          value={openCount}       icon={<IconOpen/>}   color="emerald" pct={openPct}/>
          <StatCard label="Closed"        value={closedCount}     icon={<IconClosed/>} color="slate"   pct={closedPct}/>
          <ResolutionRate open={openCount} closed={closedCount}/>
        </div>

        {/* ─── COMPOSER ─── */}
        {canCreateQuery && !queryFeatureUnavailable && (
          <QueryComposer
            projects={projects}
            disabled={!projects.length || loadingThread}
            onCreate={async (projectId, message) => {
              if (!userId) return;
              const { data, error: insErr } = await supabase.from("queries")
                .insert({ project_id: projectId, created_by: userId, message, status: "open" })
                .select("*").single();
              if (insErr) {
                if (isMissingTableError(insErr, "queries")) {
                  setQueryFeatureUnavailable(true);
                  setError("`queries` table missing.");
                  return;
                }
                throw insErr;
              }
              if (data) {
                setQueries(prev => [data as Query, ...prev]);
                setSelectedId((data as Query).id);
              }
            }}
          />
        )}

        {/* ─── MAIN 2-col GRID ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: 600 }}>

          {/* ── LEFT: query list (2 cols) ── */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <Panel title="All Queries" subtitle={`${visibleQueries.length} shown`} noPad>

              {/* Filter tabs + search */}
              <div className="px-4 pt-4 pb-3 border-b border-slate-50 space-y-2">
                {/* Tabs */}
                <div className="flex gap-1 rounded-xl bg-slate-50 border border-slate-100 p-1">
                  {TABS.map(t => (
                    <button key={t.key} type="button" onClick={() => setStatusFilter(t.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150
                        ${statusFilter === t.key ? "text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
                      style={statusFilter === t.key ? { background: "linear-gradient(135deg,#0891b2,#0d9488)" } : {}}>
                      {t.label}
                      {t.count !== undefined && (
                        <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                          statusFilter === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {/* Search */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <IconSearch/>
                  </span>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search queries…"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3.5 py-2
                               text-sm text-slate-800 placeholder-slate-400 outline-none
                               focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"/>
                </div>
              </div>

              {/* List */}
              <div className="px-3 py-3 space-y-1.5 max-h-[520px] overflow-y-auto"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
                {visibleQueries.length === 0
                  ? <EmptyState filter={statusFilter}/>
                  : visibleQueries.map(q => (
                    <QueryListItem key={q.id} query={q}
                      active={q.id === selectedId}
                      onClick={() => setSelectedId(q.id)}/>
                  ))
                }
              </div>
            </Panel>
          </div>

          {/* ── RIGHT: thread panel (3 cols) ── */}
          <div className="lg:col-span-3">
            {loadingThread && !selectedQuery ? (
              <div className="h-full rounded-2xl border border-slate-100 bg-white flex items-center justify-center gap-3 text-slate-400 text-sm p-8">
                <div className="h-4 w-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin"/>
                Loading thread…
              </div>
            ) : selectedQuery ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden h-full flex flex-col">
                {/* Thread header */}
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800 truncate">{selectedQuery.message}</p>
                        <StatusPill status={selectedQuery.status}/>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {(() => {
                          try {
                            return new Date(selectedQuery.created_at).toLocaleDateString("en-GB", {
                              day: "numeric", month: "long", year: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            });
                          } catch { return ""; }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Thread body */}
                <div className="flex-1 p-5 overflow-hidden">
                  <QueryThreadUI
                    query={selectedQuery}
                    replies={replies}
                    senderId={userId ?? ""}
                    canReply={canReply}
                    canClose={canClose}
                    lastReadByPeerAt={lastReadByPeerAt}
                    peerIsTyping={peerTyping}
                    peerTypingLabel={peerTypingLabel}
                    onTypingActivity={emitDashboardTyping}
                    onSendReply={async (message) => {
                      if (!userId) return;
                      const { data: newReply, error: insErr } = await supabase.from("query_replies")
                        .insert({ query_id: selectedQuery.id, sender_id: userId, message })
                        .select("*")
                        .single();
                      if (insErr) throw insErr;
                      if (newReply) {
                        setReplies((prev) =>
                          prev.some((r) => r.id === newReply.id)
                            ? prev
                            : [...prev, newReply].sort(
                                (a, b) =>
                                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                              )
                        );
                        try {
                          await httpBroadcastQueryThread(supabase, selectedQuery.id, "reply", {
                            reply: newReply,
                          });
                        } catch { /* ignore */ }
                      }
                    }}
                    onClose={async () => {
                      const { error: upErr } = await supabase.from("queries")
                        .update({ status: "closed" }).eq("id", selectedQuery.id);
                      if (upErr) {
                        if (isMissingTableError(upErr, "queries")) {
                          setQueryFeatureUnavailable(true);
                          setError("`queries` table missing.");
                          return;
                        }
                        throw upErr;
                      }
                      setQueries(prev =>
                        prev.map(q => q.id === selectedQuery.id ? { ...q, status: "closed" } : q)
                      );
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full rounded-2xl border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-3 p-8 min-h-[400px]">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-slate-200">
                  <path d="M6 9A3 3 0 019 6h30a3 3 0 013 3v22a3 3 0 01-3 3H27l-7 8v-8H9a3 3 0 01-3-3V9z"
                    stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M15 18h18M15 25h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-400">Select a query</p>
                  <p className="text-xs text-slate-400 mt-1">Choose a thread from the left to view conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}