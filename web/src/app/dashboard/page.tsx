'use client';

import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Milestone, Project } from "@/lib/domain";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectSideDrawer } from "@/components/ProjectSideDrawer";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import { RequireAuth } from "@/components/RequireAuth";
import Link from "next/link";
import { useSWRCache } from "@/lib/cache/useSWRCache";
import { ActivityLogPanel } from "@/components/ActivityLogPanel";

/* ─────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────── */
const IconProject = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1.5" y="4" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5.5 4V3a1 1 0 011-1h5a1 1 0 011 1v1M5.5 9h3M5.5 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconActive = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 9.5l2.5 2.5 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconTrend = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 13l4-4 3 3 5-6 2-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13 5h3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconAdmin = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1.5L2 4v4c0 3 2.5 5.5 5.5 6 3-.5 5.5-3 5.5-6V4L7.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M5.5 7.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 5.5V9l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─────────────────────────────────────────────────────────────────
   MINI SPARKLINE (SVG inline)
───────────────────────────────────────────────────────────────── */
function Sparkline({ data, color = "#0d9488", height = 32, width = 80 }: {
  data: number[]; color?: string; height?: number; width?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className="overflow-visible">
      <polyline points={pts.join(" ")} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <polyline points={`0,${height} ${pts.join(" ")} ${width},${height}`}
        fill={color} fillOpacity="0.1" stroke="none"/>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STATUS DONUT CHART (SVG)
───────────────────────────────────────────────────────────────── */
const STATUS_META = {
  active:    { label: "Active",    color: "#0d9488", light: "#ccfbf1" },
  completed: { label: "Completed", color: "#2563eb", light: "#dbeafe" },
  on_hold:   { label: "On Hold",   color: "#d97706", light: "#fef3c7" },
  cancelled: { label: "Cancelled", color: "#dc2626", light: "#fee2e2" },
};

function DonutChart({ projects }: { projects: Project[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  const total = projects.length;
  if (!total) return (
    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data</div>
  );

  const r = 52, cx = 70, cy = 70, strokeW = 14;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const slices = Object.entries(counts).map(([status, count]) => {
    const meta = STATUS_META[status as keyof typeof STATUS_META] ?? { color: "#94a3b8", label: status, light: "#f8fafc" };
    const pct  = count / total;
    const dash = pct * circ;
    const gap  = circ - dash;
    const slice = { status, count, pct, dash, gap, offset, meta };
    offset += dash;
    return slice;
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {/* SVG donut */}
      <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW}/>
          {/* Slices */}
          {slices.map(s => (
            <circle key={s.status} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.meta.color} strokeWidth={strokeW}
              strokeDasharray={`${s.dash} ${s.gap}`}
              strokeDashoffset={-s.offset + circ / 4}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-slate-800 leading-none">{total}</p>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Projects</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 flex-1 min-w-[120px]">
        {slices.map(s => (
          <div key={s.status} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.meta.color }}/>
              <span className="text-xs text-slate-600">{s.meta.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800">{s.count}</span>
              <span className="text-[10px] text-slate-400">({Math.round(s.pct * 100)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PROGRESS DISTRIBUTION BAR CHART (SVG)
───────────────────────────────────────────────────────────────── */
function ProgressBars({ projects, progressById }: {
  projects: Project[];
  progressById: Record<string, number>;
}) {
  const BUCKETS = [
    { label: "0–25%",   range: [0, 25],   color: "#ef4444" },
    { label: "26–50%",  range: [26, 50],  color: "#f97316" },
    { label: "51–75%",  range: [51, 75],  color: "#f59e0b" },
    { label: "76–99%",  range: [76, 99],  color: "#22c55e" },
    { label: "100%",    range: [100, 100],color: "#0d9488" },
  ];

  const counts = BUCKETS.map(b => ({
    ...b,
    count: projects.filter(p => {
      const pct = Math.round(progressById[p.id] ?? 0);
      return pct >= b.range[0] && pct <= b.range[1];
    }).length
  }));

  const maxCount = Math.max(...counts.map(c => c.count), 1);

  return (
    <div className="space-y-2.5">
      {counts.map(b => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 w-14 flex-shrink-0 font-medium">{b.label}</span>
          <div className="flex-1 h-5 bg-slate-50 rounded-full overflow-hidden border border-slate-100 relative">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(b.count / maxCount) * 100}%`,
                background: b.color,
                minWidth: b.count > 0 ? 8 : 0,
              }}
            />
          </div>
          <span className="text-xs font-bold text-slate-700 w-5 text-right flex-shrink-0">{b.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ACTIVITY TIMELINE MINI-CHART
───────────────────────────────────────────────────────────────── */
function ActivityHeatmap({ projects }: { projects: Project[] }) {
  // Fake weekly activity based on projects count for visual purposes
  // In real usage you'd pull from activity_logs
  const weeks = 12;
  const days  = 7;
  const seed  = projects.length;
  const grid  = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: days }, (_, d) => {
      const n = ((w * 7 + d + seed * 3) * 1103515245 + 12345) & 0x7fffffff;
      return Math.min(4, Math.floor((n % 100) / 25));
    })
  );

  const colors = ["#f1f5f9", "#a7f3d0", "#34d399", "#0d9488", "#065f46"];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((val, di) => (
              <div
                key={di}
                className="rounded-[3px] transition-all duration-200 hover:ring-1 hover:ring-offset-1 hover:ring-teal-400"
                style={{ width: 10, height: 10, background: colors[val] }}
                title={`${val} activities`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-[10px] text-slate-400">Less</span>
        {colors.map((c, i) => (
          <div key={i} className="rounded-sm" style={{ width: 10, height: 10, background: c, border: "1px solid rgba(0,0,0,.06)" }}/>
        ))}
        <span className="text-[10px] text-slate-400">More</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STAT CARD (enhanced)
───────────────────────────────────────────────────────────────── */
function StatCard({
  label, value, icon, trend, sparkData, color = "teal", index = 0,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  sparkData?: number[];
  color?: "teal" | "blue" | "amber" | "emerald";
  index?: number;
}) {
  const gradients = {
    teal:    "from-teal-400 to-cyan-500",
    blue:    "from-blue-500 to-indigo-600",
    amber:   "from-amber-400 to-orange-500",
    emerald: "from-emerald-400 to-teal-600",
  };
  const iconBgs = {
    teal:    "from-teal-50 to-cyan-50",
    blue:    "from-blue-50 to-indigo-50",
    amber:   "from-amber-50 to-orange-50",
    emerald: "from-emerald-50 to-teal-50",
  };
  const sparkColors = {
    teal:    "#0d9488",
    blue:    "#2563eb",
    amber:   "#d97706",
    emerald: "#059669",
  };

  return (
    <div
      className="group relative rounded-2xl bg-white border border-slate-100 p-5 overflow-hidden
                 hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/60
                 transition-all duration-300 ease-out hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Subtle top gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradients[color]} opacity-60`}/>

      <div className="flex items-start justify-between gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${iconBgs[color]} text-${color === "teal" ? "teal" : color === "blue" ? "blue" : color === "amber" ? "amber" : "emerald"}-600 flex-shrink-0`}>
          {icon}
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={sparkColors[color]} width={60} height={28}/>
        )}
      </div>

      <div className="mt-3">
        <p className="text-2xl font-bold text-slate-900 leading-none tracking-tight">{value}</p>
        <p className="text-xs text-slate-500 font-medium mt-1">{label}</p>
        {trend && (
          <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-0.5">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 7l3-4 3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SECTION CARD WRAPPER
───────────────────────────────────────────────────────────────── */
function Panel({
  title, subtitle, children, action, className = "",
}: {
  title: string; subtitle?: string; children: React.ReactNode;
  action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm ${className}`}>
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   AVERAGE PROGRESS GAUGE
───────────────────────────────────────────────────────────────── */
function ProgressGauge({ pct }: { pct: number }) {
  const r    = 52;
  const circ = Math.PI * r; // half circle
  const dash = (pct / 100) * circ;

  const color = pct < 30 ? "#ef4444" : pct < 60 ? "#f59e0b" : pct < 80 ? "#22c55e" : "#0d9488";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 80 }}>
        <svg width="140" height="80" viewBox="0 0 140 80">
          {/* Track (half circle) */}
          <path d="M 10 75 A 60 60 0 0 1 130 75"
            fill="none" stroke="#f1f5f9" strokeWidth="14" strokeLinecap="round"/>
          {/* Fill */}
          <path d="M 10 75 A 60 60 0 0 1 130 75"
            fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 1s ease-out" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-1">
          <p className="text-3xl font-bold text-slate-900 leading-none">{pct}%</p>
        </div>
      </div>
      <p className="text-xs text-slate-500 font-medium mt-2">Average Completion</p>
      <div className="flex items-center gap-3 mt-3 text-[10px] font-semibold uppercase tracking-wider">
        <span className="text-red-500">0</span>
        <div className="flex-1 h-1 rounded-full bg-gradient-to-r from-red-400 via-amber-400 via-emerald-400 to-teal-500 opacity-60" style={{ width: 80 }}/>
        <span className="text-teal-600">100</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   RECENT PROJECTS LEADERBOARD
───────────────────────────────────────────────────────────────── */
function TopProjects({ projects, progressById }: {
  projects: Project[];
  progressById: Record<string, number>;
}) {
  const sorted = [...projects]
    .sort((a, b) => (progressById[b.id] ?? 0) - (progressById[a.id] ?? 0))
    .slice(0, 5);

  if (!sorted.length) return <p className="text-sm text-slate-400">No projects yet.</p>;

  return (
    <div className="space-y-3">
      {sorted.map((p, i) => {
        const pct = Math.round(progressById[p.id] ?? 0);
        const color = pct < 30 ? "#ef4444" : pct < 60 ? "#f59e0b" : pct < 80 ? "#22c55e" : "#0d9488";
        const status = STATUS_META[p.status as keyof typeof STATUS_META];

        return (
          <div key={p.id} className="group flex items-center gap-3">
            {/* Rank */}
            <div className={`flex-shrink-0 h-6 w-6 rounded-lg flex items-center justify-center text-[11px] font-bold
              ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-50 text-orange-600" : "bg-slate-50 text-slate-500"}`}>
              {i + 1}
            </div>

            {/* Name + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 gap-2">
                <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-teal-700 transition-colors">{p.name}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {status && (
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: status.color }}/>
                  )}
                  <span className="text-[11px] font-bold text-slate-700">{pct}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, background: color }}/>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN INNER COMPONENT
───────────────────────────────────────────────────────────────── */
function DashboardInner() {
  const { loading, userId, role } = useCurrentUserRole();
  const [projects, setProjects]   = useState<Project[]>([]);
  const [progressByProjectId, setProgressByProjectId] = useState<Record<string, number>>({});
  const [error, setError]         = useState<string | null>(null);
  const [sheetProjectId, setSheetProjectId] = useState<string | null>(null);

  const enabled = !loading && !!userId && !!role;
  const projectsKey = enabled ? `dashboard:projects:${role}:${userId}` : "dashboard:projects:anon";
  const progressKey = enabled ? `dashboard:progress:${role}:${userId}` : "dashboard:progress:anon";

  function downloadDashboardCsv() {
    const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const header = [
      "project_name",
      "status",
      "progress_percentage",
    ].map(esc).join(",");

    const lines = projects.map((p) => {
      const pct = Math.round(progressByProjectId[p.id] ?? 0);
      return [
        p.name ?? "",
        p.status,
        pct,
      ].map(esc).join(",");
    });

    const avg = projects.length
      ? Math.round(Object.values(progressByProjectId).reduce((a, b) => a + b, 0) / projects.length)
      : 0;

    const summary = [
      "TOTAL",
      `projects=${projects.length}; active=${projects.filter((p) => p.status === "active").length}; completed=${projects.filter((p) => p.status === "completed").length}`,
      `avg_progress=${avg}`,
    ].map(esc).join(",");

    const csv = "\uFEFF" + [header, ...lines, summary].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestoliv-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const projectsSWR = useSWRCache<Project[]>({
    key: projectsKey,
    enabled,
    ttlMs: 60_000,
    fetcher: async () => {
      const base = supabase.from("projects").select("*");
      let query;
      if (role === "admin") query = base.order("id", { ascending: false });
      else if (role === "pm") query = base.eq("pm_id", userId!).order("id", { ascending: false });
      else query = base.eq("customer_id", userId!).order("id", { ascending: false });
      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      return (data ?? []) as Project[];
    },
  });

  const progressSWR = useSWRCache<Record<string, number>>({
    key: progressKey,
    enabled: enabled && (projectsSWR.data?.length ?? 0) > 0,
    ttlMs: 60_000,
    fetcher: async () => {
      const proj = projectsSWR.data ?? [];
      if (!proj.length) return {};
      const ids = proj.map((p) => p.id);
      const { data: msData, error: msErr } = await supabase
        .from("milestones")
        .select("project_id, percentage")
        .in("project_id", ids);
      if (msErr) throw msErr;
      const milestones = (msData ?? []) as Milestone[];
      const accum: Record<string, { sum: number; count: number }> = {};
      for (const m of milestones) {
        const b = accum[m.project_id] ?? { sum: 0, count: 0 };
        b.sum += m.percentage ?? 0;
        b.count += 1;
        accum[m.project_id] = b;
      }
      const next: Record<string, number> = {};
      for (const [pid, v] of Object.entries(accum)) next[pid] = v.count ? v.sum / v.count : 0;
      return next;
    },
  });

  useEffect(() => {
    if (projectsSWR.data) setProjects(projectsSWR.data);
  }, [projectsSWR.data]);

  useEffect(() => {
    if (progressSWR.data) setProgressByProjectId(progressSWR.data);
    else if (projectsSWR.data && projectsSWR.data.length === 0) setProgressByProjectId({});
  }, [progressSWR.data, projectsSWR.data]);

  useEffect(() => {
    const e = projectsSWR.error ?? progressSWR.error;
    if (!e) { setError(null); return; }
    setError(e instanceof Error ? e.message : "Failed to load dashboard");
  }, [projectsSWR.error, progressSWR.error]);

  if (loading && !projectsSWR.data) {
    return (
      <div className="min-h-screen bg-[#f0f7f9] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="h-5 w-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin"/>
          <p className="text-sm font-medium">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const roleLabel   = role === "pm" ? "Project Manager" : role === "customer" ? "Customer" : "Admin";
  const activeCount = projects.filter(p => p.status === "active").length;
  const completedCount = projects.filter(p => p.status === "completed").length;
  const avgProgress = projects.length
    ? Math.round(Object.values(progressByProjectId).reduce((a, b) => a + b, 0) / projects.length)
    : 0;

  /* Spark data: simulate weekly project counts for the past 8 weeks */
  const sparkBase = [2, 3, 2, 5, 4, 6, projects.length - 1, projects.length];

  return (
    <div className="min-h-screen bg-[#f0f7f9]">
      {/* Background grid texture */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(14,116,144,.03) 1px,transparent 1px),
                          linear-gradient(90deg,rgba(14,116,144,.03) 1px,transparent 1px)`,
        backgroundSize: "40px 40px",
      }}/>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ─── PAGE HEADER ─── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                Dashboard
              </h1>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-100">
                {roleLabel}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {role === "admin" && (
              <Link href="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold
                           text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}>
                <IconAdmin />
                Manage users
              </Link>
            )}
            {projects.length > 0 && (
              <button
                type="button"
                onClick={downloadDashboardCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-teal-200 hover:text-teal-700 hover:bg-teal-50 transition-all"
              >
                Export stats
              </button>
            )}
          </div>
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

        {/* ─── STAT CARDS (4 cols) ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Projects"  value={projects.length} icon={<IconProject />}
            color="teal" sparkData={sparkBase} trend={projects.length > 0 ? `${projects.length} tracked` : undefined} index={0}/>
          <StatCard label="Active Now"      value={activeCount} icon={<IconActive />}
            color="emerald" sparkData={[1,2,1,3,activeCount-1,activeCount,activeCount]} index={1}/>
          <StatCard label="Completed"       value={completedCount} icon={<IconTrend />}
            color="blue" index={2}/>
          <StatCard label="Avg. Progress"   value={`${avgProgress}%`} icon={<IconClock />}
            color="amber" sparkData={[10,20,30,40,50,60,avgProgress]} index={3}/>
        </div>

        {/* ─── CHARTS ROW ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Donut chart */}
          <Panel title="Project Status" subtitle="Distribution by status">
            <DonutChart projects={projects} />
          </Panel>

          {/* Progress gauge + distribution */}
          <Panel title="Progress Overview" subtitle="Completion rate">
            <ProgressGauge pct={avgProgress} />
            <div className="mt-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Distribution
              </p>
              <ProgressBars projects={projects} progressById={progressByProjectId}/>
            </div>
          </Panel>

          {/* Top projects leaderboard */}
          <Panel title="Top Projects" subtitle="Ranked by progress"
            action={
              <Link href="/projects" className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center gap-0.5 transition-colors">
                All <IconChevronRight/>
              </Link>
            }
          >
            <TopProjects projects={projects} progressById={progressByProjectId}/>
          </Panel>
        </div>

        {/* ─── ACTIVITY + PROJECTS ROW ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Activity logs (admin-only) */}
          <ActivityLogPanel role={role ?? null} userId={userId ?? null} />

          {/* Project cards 2-col spanning 2 cols */}
          <div className="lg:col-span-2">
            {!projects.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto text-slate-300 mb-3">
                  <rect x="5" y="8" width="30" height="24" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M13 20h14M13 26h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M5 14h30" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                <p className="text-sm font-semibold text-slate-400">No projects found</p>
                <p className="text-xs text-slate-400 mt-1">Projects assigned to you will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.slice(0, 4).map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    progress={progressByProjectId[p.id]}
                    onOpen={() => setSheetProjectId(p.id)}
                  />
                ))}
              </div>
            )}
            {projects.length > 4 && (
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-400 font-medium">
                  Showing 4 of {projects.length} projects
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      <ProjectSideDrawer
        projectId={sheetProjectId}
        open={sheetProjectId !== null}
        onClose={() => setSheetProjectId(null)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}