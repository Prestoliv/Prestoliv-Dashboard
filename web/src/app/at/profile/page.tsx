'use client';

import "./portal.css";
import { useEffect, useMemo, useState, useRef } from "react";
import type { Milestone, Project, Query, QueryReply } from "@/lib/domain";
import {
  httpBroadcastQueryThread,
  subscribeQueryThreadBroadcast,
} from "@/lib/realtime/queryThreadRealtime";
import { supabase } from "@/lib/supabase/client";
import { ProjectSideDrawer } from "@/components/ProjectSideDrawer";

type ProfileRow = {
  id: string;
  name: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

function getUidFromLocation(): string | null {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get("uid") || u.searchParams.get("user") || null;
  } catch {
    return null;
  }
}

function formatPct(n: number) {
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "open" || status === "active";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 99,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const,
      background: active ? "#eff6ff" : "#f8fafc",
      color: active ? "#1d4ed8" : "#64748b",
      border: `1px solid ${active ? "#bfdbfe" : "#e2e8f0"}`,
      whiteSpace: "nowrap" as const,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: active ? "#3b82f6" : "#cbd5e1",
        display: "inline-block", flexShrink: 0,
      }} />
      {status}
    </span>
  );
}

export default function TokenCustomerProfilePage() {
  const [uid, setUid] = useState("");
  const atSecret = process.env.NEXT_PUBLIC_AT_SHARED_SECRET ?? "";
  const [bootstrapped, setBootstrapped] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [repliesByQueryId, setRepliesByQueryId] = useState<Record<string, QueryReply[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [projectDrawerId, setProjectDrawerId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastRealtimeReplyAtRef = useRef(0);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingThrottleRef = useRef(0);
  const webflowSyncDoneRef = useRef(false);

  useEffect(() => {
    webflowSyncDoneRef.current = false;
  }, [uid]);

  useEffect(() => {
    if (bootstrapped) return;
    const u = getUidFromLocation();
    if (u) setUid(u);
    setBootstrapped(true);
  }, [bootstrapped]);

  const progressByProjectId = useMemo(() => {
    const accum: Record<string, { sum: number; count: number }> = {};
    for (const m of milestones) {
      const b = accum[m.project_id] ?? { sum: 0, count: 0 };
      b.sum += m.percentage ?? 0; b.count += 1;
      accum[m.project_id] = b;
    }
    const next: Record<string, number> = {};
    for (const [pid, v] of Object.entries(accum)) next[pid] = v.count ? v.sum / v.count : 0;
    return next;
  }, [milestones]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const projectQueries = useMemo(
    () => !selectedProjectId ? [] : queries.filter((q) => q.project_id === selectedProjectId),
    [queries, selectedProjectId]
  );
  const selectedQuery = useMemo(
    () => queries.find((q) => q.id === selectedQueryId) ?? null,
    [queries, selectedQueryId]
  );
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.status === "active" && b.status !== "active" ? -1 : 0)),
    [projects]
  );

  async function loadAll(targetUid: string) {
    setLoading(true); setError(null);
    try {
      const url = new URL("/api/at/bundle", window.location.origin);
      url.searchParams.set("uid", targetUid);
      if (atSecret) url.searchParams.set("secret", atSecret);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setProfile(json.profile ?? null);
      setProjects(json.projects ?? []);
      setMilestones(json.milestones ?? []);
      setQueries(json.queries ?? []);
      setRepliesByQueryId(json.repliesByQueryId ?? {});
      const proj = json.projects ?? [];
      setSelectedProjectId((prev) => prev ?? proj[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setProjects([]); setMilestones([]); setQueries([]); setRepliesByQueryId({});
      setSelectedProjectId(null); setSelectedQueryId(null);
    } finally { setLoading(false); }
  }

  useEffect(() => { const u = uid.trim(); if (!u) return; loadAll(u); }, [uid]);

  /* Webflow / embed: localStorage + optional Webflow tab to sync query params (same user as portal uid) */
  useEffect(() => {
    const u = uid.trim();
    if (!u || loading || error) return;

    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      if (user.id !== u) return;
      if (webflowSyncDoneRef.current) return;
      webflowSyncDoneRef.current = true;

      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "";
      const avatar = user.user_metadata?.avatar_url;

      try {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userName", name != null ? String(name) : "");
        localStorage.setItem("userAvatar", avatar != null ? String(avatar) : "");
      } catch {
        /* private mode / quota */
      }

      const base = (
        process.env.NEXT_PUBLIC_WEBFLOW_SYNC_URL ??
        "https://prestoliversslaunch.webflow.io"
      ).replace(/\/$/, "");
      const syncUrl = `${base}?name=${encodeURIComponent(name != null ? String(name) : "")}&avatar=${encodeURIComponent(avatar != null ? String(avatar) : "")}`;
      window.open(syncUrl, "_blank", "width=1,height=1");

      // eslint-disable-next-line no-console -- intentional sync confirmation for Webflow debugging
      console.log("✅ Synced user to Webflow");
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, error, uid]);

  /* Realtime: replies + read + typing (broadcast; portal has no Postgres realtime session) */
  useEffect(() => {
    const qid = selectedQueryId;
    const u = uid.trim();
    if (!qid || !u) return;
    const off = subscribeQueryThreadBroadcast(supabase, qid, {
      onReply: (reply) => {
        if (reply.query_id !== qid) return;
        lastRealtimeReplyAtRef.current = Date.now();
        setRepliesByQueryId((prev) => {
          const list = prev[qid] ?? [];
          if (list.some((r) => r.id === reply.id)) return prev;
          const next = [...list, reply].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return { ...prev, [qid]: next };
        });
      },
      onRead: (p) => {
        setQueries((prev) => prev.map((q) => (q.id === qid ? { ...q, ...p } : q)));
      },
      onTyping: (p) => {
        if (p.userId === u) return;
        setPeerTyping(p.typing);
      },
    });
    return off;
  }, [selectedQueryId, uid]);

  useEffect(() => {
    setPeerTyping(false);
  }, [selectedQueryId]);

  /* Mark read for team (seen receipts) while chat is open */
  useEffect(() => {
    const qid = selectedQueryId;
    const u = uid.trim();
    if (!qid || !u || !chatOpen) return;
    const ping = () => {
      void fetch("/api/at/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(atSecret ? { "x-at-secret": atSecret } : {}),
        },
        body: JSON.stringify({ uid: u, queryId: qid }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (json?.query) {
            setQueries((prev) =>
              prev.map((q) => (q.id === qid ? { ...q, ...json.query } : q))
            );
          }
        })
        .catch(() => {});
    };
    ping();
    const t = setInterval(ping, 14_000);
    return () => clearInterval(t);
  }, [selectedQueryId, uid, chatOpen]);

  /* Fallback: if realtime/broadcast is flaky, poll bundle replies while chat is open. */
  useEffect(() => {
    const qid = selectedQueryId;
    const u = uid.trim();
    if (!qid || !u || !chatOpen) return;

    const iv = setInterval(async () => {
      // If we got a realtime reply very recently, skip polling.
      if (Date.now() - lastRealtimeReplyAtRef.current < 8_000) return;

      try {
        const url = new URL("/api/at/bundle", window.location.origin);
        url.searchParams.set("uid", u);
        if (atSecret) url.searchParams.set("secret", atSecret);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const incoming = (json.repliesByQueryId?.[qid] ?? []) as QueryReply[];
        if (!incoming.length) return;

        setRepliesByQueryId((prev) => {
          const existing = prev[qid] ?? [];
          const map = new Map<string, QueryReply>();
          for (const r of existing) map.set(r.id, r);
          for (const r of incoming) map.set(r.id, r);
          const next = [...map.values()].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return { ...prev, [qid]: next };
        });
      } catch {
        // best-effort
      }
    }, 10_000);

    return () => clearInterval(iv);
  }, [selectedQueryId, uid, chatOpen]);

  async function emitPortalTyping(active: boolean) {
    const qid = selectedQueryId;
    const u = uid.trim();
    if (!qid || !u) return;
    const now = Date.now();
    if (active && now - typingThrottleRef.current < 400) return;
    typingThrottleRef.current = now;
    try {
      await httpBroadcastQueryThread(supabase, qid, "typing", { userId: u, typing: active });
    } catch {
      /* ignore */
    }
  }

  // Auto-scroll thread to bottom whenever query or replies change
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [selectedQueryId, repliesByQueryId]);

  const displayName = profile?.name ?? profile?.full_name ?? "Customer";
  const openQueries = queries.filter((q) => q.status === "open").length;
  const avgProgress = projects.length
    ? Math.round(Object.values(progressByProjectId).reduce((a, b) => a + b, 0) / projects.length)
    : 0;

  function openChat(queryId: string) {
    setSelectedQueryId(queryId);
    setChatOpen(true);
  }

  const canSendReply =
    Boolean(uid.trim() && selectedQuery && selectedQuery.status === "open");

  async function sendMessage() {
    const u = uid.trim();
    if (!selectedQuery || !u) return;
    const text = draft.trim();
    if (!text || sending || !canSendReply) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/at/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(atSecret ? { "x-at-secret": atSecret } : {}),
        },
        body: JSON.stringify({ uid: u, queryId: selectedQuery.id, message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to send");
      const reply = json.reply as QueryReply;
      setDraft("");
      setRepliesByQueryId((prev) => {
        const list = prev[selectedQuery.id] ?? [];
        if (list.some((r) => r.id === reply.id)) return prev;
        return {
          ...prev,
          [selectedQuery.id]: [...list, reply].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
        };
      });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {loading && <div className="loading-bar" />}

      {/* ── TOP NAV ────────────────────────────────── */}
      <header className="topnav">
        <div className="nav-brand">
          <div className="nav-dot">P</div>
          <span className="nav-name">Customer Portal</span>
        </div>
        <div className="nav-right">
          {profile && (
            <div>
              <div className="nav-user-name">{displayName}</div>
              <div className="nav-user-sub">{profile.email ?? profile.role ?? "customer"}</div>
            </div>
          )}
          <div className="nav-avatar">{getInitials(displayName)}</div>
        </div>
      </header>

      {/* ── MAIN PAGE ──────────────────────────────── */}
      <div className="page">
        {bootstrapped && !uid.trim() && (
          <div className="alert alert-warn">
            This page requires a personal link with a <code>uid</code> parameter in the URL.
          </div>
        )}
        {error && <div className="alert alert-err">{error}</div>}

        {/* Stats */}
        <div className="stats">
          {[
            { l: "Projects", v: projects.length },
            { l: "Open queries", v: openQueries },
            { l: "Avg progress", v: formatPct(avgProgress) },
            { l: "Account role", v: profile?.role ?? "customer" },
          ].map((s) => (
            <div key={s.l} className="stat">
              <div className="stat-l">{s.l}</div>
              <div className="stat-v">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div className="section-head">
          Your projects <span>({projects.length})</span>
        </div>
        <div className="proj-grid">
          {projects.length === 0 ? (
            <p style={{ color: "var(--text3)", fontSize: 13 }}>No projects found.</p>
          ) : (
            sortedProjects.map((p) => {
              const pct = progressByProjectId[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="proj-card"
                  onClick={() => { setSelectedProjectId(p.id); setProjectDrawerId(p.id); }}
                >
                  <div className="proj-top">
                    <div className="proj-name">{p.name}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="proj-bar">
                    <div className="proj-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="proj-foot">
                    <span className="proj-pct">{formatPct(pct)} complete</span>
                    <span className="proj-cta">Details →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Queries table */}
        <div className="section-head">
          Queries {selectedProject && <span>— {selectedProject.name}</span>}
        </div>
        <div className="table-wrap">
          <div className="table-head">
            <div>
              <div className="table-title">Support queries</div>
              <div className="table-sub">Click "Open chat" to view the conversation</div>
            </div>
            <div className="proj-tabs">
              {sortedProjects.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  className={`proj-tab${selectedProjectId === p.id ? " active" : ""}`}
                  onClick={() => { setSelectedProjectId(p.id); setSelectedQueryId(null); }}
                >
                  {p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name}
                </button>
              ))}
            </div>
          </div>

          {!selectedProjectId ? (
            <div className="empty-row">Select a project above to view its queries.</div>
          ) : projectQueries.length === 0 ? (
            <div className="empty-row">No queries for this project yet.</div>
          ) : (
            projectQueries.slice(0, 10).map((q) => (
              <div
                key={q.id}
                className={`q-row${selectedQueryId === q.id ? " active" : ""}`}
                onClick={() => setSelectedQueryId(q.id)}
              >
                <div className="q-icon">Q</div>
                <div className="q-body">
                  <div className="q-msg">{q.message}</div>
                  <div className="q-meta">{q.status} · ref #{q.id.slice(0, 8)}</div>
                </div>
                <StatusBadge status={q.status} />
                <button
                  className="q-open-btn"
                  onClick={(e) => { e.stopPropagation(); openChat(q.id); }}
                >
                  Open chat ↗
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── FAB ─────────────────────────────────────── */}
      <div className="fab-wrap">
        <button className="fab" onClick={() => setChatOpen((o) => !o)} aria-label="Toggle chat">
          {chatOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3l12 12M15 3L3 15" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 4.5h15a1 1 0 011 1v8a1 1 0 01-1 1H6l-4.5 3V5.5a1 1 0 011-1z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round"/>
              <circle cx="7" cy="10" r="1" fill="#fff"/>
              <circle cx="10" cy="10" r="1" fill="#fff"/>
              <circle cx="13" cy="10" r="1" fill="#fff"/>
            </svg>
          )}
          {openQueries > 0 && !chatOpen && (
            <span className="fab-badge">{openQueries}</span>
          )}
        </button>
      </div>

      {/* ── OVERLAY ─────────────────────────────────── */}
      <div className={`chat-overlay${chatOpen ? " open" : ""}`} onClick={() => setChatOpen(false)} />

      {/* ── CHAT PANEL: right side, slides bottom → top ── */}
      <div className={`chat-panel${chatOpen ? " open" : ""}`}>

        {/* Header */}
        <div className="chat-hdr">
          <div className="chat-hdr-av">
            {selectedQuery ? "💬" : "✉"}
          </div>
          <div className="chat-hdr-info">
            <div className="chat-hdr-name">
              {selectedQuery ? "Thread" : "Messages"}
            </div>
            <div className="chat-hdr-sub">
              {selectedQuery?.message ?? (selectedProject?.name ?? "Select a project to begin")}
            </div>
          </div>
          {selectedQuery && <StatusBadge status={selectedQuery.status} />}
          <button className="close-btn" onClick={() => setChatOpen(false)}>✕</button>
        </div>

        {/* Project tabs */}
        <div className="chat-tabs">
          {sortedProjects.slice(0, 6).map((p) => (
            <button
              key={p.id}
              className={`chat-tab-btn${selectedProjectId === p.id ? " active" : ""}`}
              onClick={() => { setSelectedProjectId(p.id); setSelectedQueryId(null); }}
            >
              {p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name}
            </button>
          ))}
          {sortedProjects.length === 0 && (
            <span style={{ padding: "9px 14px", fontSize: 12, color: "var(--text3)" }}>No projects</span>
          )}
        </div>

        {/* Query chips */}
        {selectedProjectId && (
          <div className="chat-chips">
            {projectQueries.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text3)", padding: "4px 0" }}>No queries for this project.</div>
            ) : (
              projectQueries.slice(0, 6).map((q) => (
                <button
                  key={q.id}
                  className={`chat-chip${selectedQueryId === q.id ? " active" : ""}`}
                  onClick={() => setSelectedQueryId(q.id)}
                >
                  <StatusBadge status={q.status} />
                  <span className="chat-chip-msg">{q.message}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── THREAD BODY ─ messages grow from bottom ── */}
        {selectedQuery ? (
          <div className="chat-body" ref={threadRef}>
            {/* Spacer pushes messages to bottom when count is low */}
            <div className="chat-body-spacer" />

            {/* Original query */}
            <div className="msg-row them">
              <div className="msg-av them">C</div>
              <div className="msg-col">
                <div className="msg-bbl">{selectedQuery.message}</div>
                <div className="msg-ts">Query opened</div>
              </div>
            </div>

            {/* Replies */}
            {(repliesByQueryId[selectedQuery.id] ?? []).map((reply, i) => {
              const isMe = reply.sender_id === profile?.id;
              const teamRead = selectedQuery.last_read_team_at;
              const showSeen =
                isMe &&
                teamRead &&
                new Date(teamRead).getTime() >= new Date(reply.created_at).getTime() - 500;
              return (
                <div key={reply.id ?? i} className={`msg-row${isMe ? " me" : " them"}`}>
                  <div className={`msg-av${isMe ? " me" : " them"}`}>
                    {isMe ? getInitials(displayName) : "S"}
                  </div>
                  <div className={`msg-col${isMe ? " me" : ""}`}>
                    <div className={`msg-bbl${isMe ? " me" : ""}`}>
                      {reply.message}
                      {isMe && (
                        <div className="msg-receipt" aria-label={showSeen ? "Seen" : "Delivered"}>
                          <span>{showSeen ? "✓✓" : "✓"}</span>
                        </div>
                      )}
                    </div>
                    {reply.created_at && (
                      <div className={`msg-ts${isMe ? " me" : ""}`}>
                        {new Date(reply.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="chat-empty">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M4 6h28a2 2 0 012 2v16a2 2 0 01-2 2H10l-8 6V8a2 2 0 012-2z" stroke="var(--text3)" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            <span>Select a query above to view the conversation</span>
          </div>
        )}

        {peerTyping && selectedQuery && (
          <div className="chat-typing-bar" aria-live="polite">
            <span className="chat-typing-dots" aria-hidden>
              <span /><span /><span />
            </span>
            <span>Support is typing…</span>
          </div>
        )}

        {/* Footer */}
        <form
          className="chat-footer"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          {sendError && (
            <div className="chat-send-err" role="alert">
              {sendError}
            </div>
          )}
          <div className="chat-inp-wrap">
            <input
              className="chat-inp"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (sendError) setSendError(null);
                void emitPortalTyping(true);
                if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
                typingIdleRef.current = setTimeout(() => void emitPortalTyping(false), 2200);
              }}
              placeholder={
                !selectedQuery
                  ? "Select a query to reply"
                  : selectedQuery.status !== "open"
                    ? "This query is closed"
                    : "Type a message…"
              }
              disabled={!canSendReply || sending}
              aria-label="Message"
            />
          </div>
          <button
            type="submit"
            className="refresh-btn"
            disabled={!canSendReply || sending || !draft.trim()}
            title="Send message"
            aria-label="Send message"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <path d="M1.5 7.5L13.5 1.5L9 7.5l4.5 6-12-6z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            type="button"
            className="refresh-btn"
            onClick={() => loadAll(uid.trim())}
            title="Refresh thread"
            aria-label="Refresh thread"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <path d="M12.5 7.5A5 5 0 112.5 7.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10.5 5l2 2.5L10.5 10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </div>

      <ProjectSideDrawer
        projectId={projectDrawerId}
        open={projectDrawerId !== null}
        onClose={() => setProjectDrawerId(null)}
        readOnly
      />
    </>
  );
}