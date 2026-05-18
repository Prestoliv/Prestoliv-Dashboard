'use client';

import "./portal.css";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import type { Milestone, Project, Query, QueryReply } from "@/lib/domain";
import {
  httpBroadcastQueryThread,
  subscribeQueryThreadBroadcast,
} from "@/lib/realtime/queryThreadRealtime";
import { supabase } from "@/lib/supabase/client";
import { ProjectSideDrawer } from "@/components/ProjectSideDrawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    <span className={`status-badge ${active ? "active" : "inactive"}`}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

const STAT_ICONS: Record<string, ReactNode> = {
  Projects: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2" y="3" width="6" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="10" y="3" width="6" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="2" y="10" width="14" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  "Open queries": (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M2.5 4.5h13a1 1 0 011 1v6a1 1 0 01-1 1H6l-3.5 2.5V5.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  "Avg progress": (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 14V8M7 14V4M11 14v-4M15 14V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  "Account role": (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3.5 15.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
};

// ── Not-a-customer full-page gate ─────────────────────────────────────────────
function NotCustomerGate() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    service: "",
  });

// Add this state
const [submitted, setSubmitted] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  console.log("Consultation request:", formData);

  // simulate API
  await new Promise((r) => setTimeout(r, 900));

  setSubmitted(true);

  // Optional auto close
  setTimeout(() => {
    setDialogOpen(false);
    setSubmitted(false);

    setFormData({
      name: "",
      phone: "",
      email: "",
      city: "",
      service: "",
    });
  }, 3500);
};

  return (
    <div className="portal-shell" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div className="portal-grid" aria-hidden />
      <div className="portal-glow" aria-hidden />

      <header className="topnav">
        <div className="nav-brand">
          <div className="nav-dot">P</div>
          <span className="nav-name">Prestoliv</span>
          <span className="nav-tag">Portal</span>
        </div>
      </header>

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "48px 24px",
      }}>
        {/* Icon */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: "var(--surface2, rgba(0,0,0,0.04))",
          border: "1px solid var(--border, rgba(0,0,0,0.08))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 600,
          margin: "0 0 10px",
          color: "var(--text1)",
        }}>
          You're not a customer yet
        </h1>

        {/* Sub */}
        <p style={{
          fontSize: 14,
          color: "var(--text3)",
          maxWidth: 320,
          lineHeight: 1.65,
          margin: "0 0 32px",
        }}>
          This portal is only accessible to active Prestoliv customers.
          Reach out and we'll get you set up right away.
        </p>

        {/* CTA — opens dialog */}
        <button
          onClick={() => setDialogOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 22px",
            borderRadius: 10,
            background: "var(--accent, #0f9e75)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.01em",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M1.5 3.5h13l-6.5 5.5L1.5 3.5z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M1.5 3.5v9h13v-9" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
          Contact us
        </button>

        {/* Hint */}
        <p style={{
          fontSize: 12,
          color: "var(--text3)",
          marginTop: 16,
          opacity: 0.7,
        }}>
          Already a customer? Make sure you're using the correct link.
        </p>
      </div>

      {/* Consultation Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            className="
              sm:max-w-[520px]
              border border-neutral-200
              bg-white
              shadow-2xl
              rounded-3xl
              p-0
              overflow-hidden
            "
          >
            {!submitted ? (
              <>
                {/* Top Gradient */}
                <div className="h-2 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

                <div className="p-8 bg-white">
                  <DialogHeader className="space-y-3 text-left">
                    <DialogTitle className="text-3xl font-semibold tracking-tight text-black">
                      Let’s Build Something Great
                    </DialogTitle>

                    <p className="text-sm leading-6 text-neutral-500">
                      Share your requirements with us and our team will connect with
                      you to discuss your project, timeline, and consultation details.
                    </p>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-5 pt-7">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-neutral-700">
                        Full Name
                      </Label>

                      <Input
                        id="name"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        className="
                          h-12
                          rounded-xl
                          border-neutral-200
                          bg-white
                          text-black
                          placeholder:text-neutral-400
                          focus-visible:ring-emerald-500
                        "
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-neutral-700">
                          Phone Number
                        </Label>

                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+91 XXXXX XXXXX"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          required
                          className="
                            h-12
                            rounded-xl
                            border-neutral-200
                            bg-white
                            text-black
                            placeholder:text-neutral-400
                            focus-visible:ring-emerald-500
                          "
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-neutral-700">
                          City / Town
                        </Label>

                        <Input
                          id="city"
                          placeholder="Mumbai"
                          value={formData.city}
                          onChange={(e) =>
                            setFormData({ ...formData, city: e.target.value })
                          }
                          required
                          className="
                            h-12
                            rounded-xl
                            border-neutral-200
                            bg-white
                            text-black
                            placeholder:text-neutral-400
                            focus-visible:ring-emerald-500
                          "
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-neutral-700">
                        Email Address
                      </Label>

                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="
                          h-12
                          rounded-xl
                          border-neutral-200
                          bg-white
                          text-black
                          placeholder:text-neutral-400
                          focus-visible:ring-emerald-500
                        "
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service" className="text-neutral-700">
                        Service Required
                      </Label>

                      <Select
                        value={formData.service}
                        onValueChange={(value) =>
                          setFormData({ ...formData, service: value })
                        }
                        required
                      >
                        <SelectTrigger
                          className="
                            h-12
                            rounded-xl
                            border-neutral-200
                            bg-white
                            text-black
                            focus:ring-emerald-500
                          "
                        >
                          <SelectValue placeholder="Select your service" />
                        </SelectTrigger>

                        <SelectContent className="rounded-xl border-neutral-200 bg-white">
                          <SelectItem value="residential">
                            Residential Construction
                          </SelectItem>

                          <SelectItem value="commercial">
                            Commercial Projects
                          </SelectItem>

                          <SelectItem value="renovation">
                            Renovation & Remodeling
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="submit"
                      className="
                        h-12
                        w-full
                        rounded-xl
                        bg-emerald-500
                        text-white
                        font-medium
                        transition-all
                        hover:bg-emerald-400
                        hover:scale-[1.01]
                        active:scale-[0.99]
                        shadow-lg shadow-emerald-500/20
                      "
                    >
                      Submit Enquiry
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="px-8 py-14 text-center bg-white">
                <div
                  className="
                    mx-auto mb-6
                    flex h-20 w-20 items-center justify-center
                    rounded-full
                    bg-emerald-50
                    border border-emerald-100
                  "
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <h2 className="text-2xl font-semibold text-black">
                  Thank You!
                </h2>

                <p className="mt-4 text-sm leading-7 text-neutral-500 max-w-sm mx-auto">
                  Your enquiry has been submitted successfully.
                  Someone from our team will reach out to you shortly to discuss
                  your requirements and next steps.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [notCustomer, setNotCustomer] = useState(false);
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
  const drawerProject = useMemo(
    () => projects.find((p) => p.id === projectDrawerId) ?? null,
    [projects, projectDrawerId]
  );
  const drawerMilestones = useMemo(
    () => (projectDrawerId ? milestones.filter((m) => m.project_id === projectDrawerId) : []),
    [milestones, projectDrawerId]
  );
  const drawerQueries = useMemo(
    () => (projectDrawerId ? queries.filter((q) => q.project_id === projectDrawerId) : []),
    [queries, projectDrawerId]
  );

  async function loadAll(targetUid: string) {
    setLoading(true);
    setError(null);
    setNotCustomer(false);
    try {
      const url = new URL("/api/at/bundle", window.location.origin);
      url.searchParams.set("uid", targetUid);
      if (atSecret) url.searchParams.set("secret", atSecret);
      const res = await fetch(url.toString());
      const json = await res.json();

      if (!res.ok) {
        // Any non-OK response (403, 404, 500, etc.) means the UID isn't a
        // valid customer — show the gate instead of a raw error banner.
        setNotCustomer(true);
        return;
      }

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { const u = uid.trim(); if (!u) return; loadAll(u); }, [uid]);

  /* Webflow / embed: localStorage + optional Webflow tab to sync query params */
  useEffect(() => {
    const u = uid.trim();
    if (!u || loading || error || notCustomer) return;

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

      // eslint-disable-next-line no-console
      console.log("✅ Synced user to Webflow");
    })();

    return () => { cancelled = true; };
  }, [loading, error, notCustomer, uid]);

  /* Realtime: replies + read + typing */
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

  /* Mark read while chat is open */
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

  /* Fallback poll while chat is open */
  useEffect(() => {
    const qid = selectedQueryId;
    const u = uid.trim();
    if (!qid || !u || !chatOpen) return;

    const iv = setInterval(async () => {
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

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [selectedQueryId, repliesByQueryId]);

  // ── Early return: not a customer ──────────────────────────────────────────
  if (notCustomer) return <NotCustomerGate />;
  // ─────────────────────────────────────────────────────────────────────────

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

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="portal-shell">
      <div className="portal-grid" aria-hidden />
      <div className="portal-glow" aria-hidden />
      {loading && <div className="loading-bar" />}

      {/* ── TOP NAV ────────────────────────────────── */}
      <header className="topnav">
        <div className="nav-brand">
          <div className="nav-dot">P</div>
          <span className="nav-name">Prestoliv</span>
          <span className="nav-tag">Portal</span>
        </div>
        <div className="nav-right">
          {profile && (
            <div className="nav-user-block">
              <div className="nav-user-name">{displayName}</div>
              <div className="nav-user-sub">{profile.email ?? profile.role ?? "customer"}</div>
            </div>
          )}
          <div className="nav-avatar" title={displayName}>{getInitials(displayName)}</div>
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

        <section className="hero page-hero" aria-label="Welcome">
          <div className="hero-inner page-hero-inner">
            <div>
              <p className="hero-greeting">Your workspace</p>
              <h1 className="hero-title">
                Welcome back, <span>{displayName}</span>
              </h1>
              <p className="hero-sub">
                Track project progress, review milestones, and chat with our team — all in one place.
              </p>
            </div>
            <p className="page-hero-date">{todayLabel}</p>
          </div>
        </section>

        <div className="stats">
          {[
            { l: "Projects", v: projects.length },
            { l: "Open queries", v: openQueries },
            { l: "Avg progress", v: formatPct(avgProgress) },
            { l: "Account role", v: profile?.role ?? "customer" },
          ].map((s) => (
            <div key={s.l} className="stat">
              <div className="stat-icon">{STAT_ICONS[s.l]}</div>
              <div className="stat-body">
                <div className="stat-l">{s.l}</div>
                <div className="stat-v">{s.v}</div>
              </div>
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

      {/* ── CHAT PANEL ───────────────────────────────── */}
      <div className={`chat-panel${chatOpen ? " open" : ""}`}>

        {/* Header */}
        <div className="chat-hdr">
          <div className="chat-hdr-av" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2.5 4.5h13a1 1 0 011 1v6a1 1 0 01-1 1H6l-3.5 2.5V5.5a1 1 0 011-1z" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
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

        {/* Thread body */}
        {selectedQuery ? (
          <div className="chat-body" ref={threadRef}>
            <div className="chat-body-spacer" />

            <div className="msg-row them">
              <div className="msg-av them">C</div>
              <div className="msg-col">
                <div className="msg-bbl">{selectedQuery.message}</div>
                <div className="msg-ts">Query opened</div>
              </div>
            </div>

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
        portalProject={drawerProject}
        portalMilestones={drawerMilestones}
        portalQueries={drawerQueries}
      />
    </div>
  );
}