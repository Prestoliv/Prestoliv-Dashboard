'use client';

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Milestone, Project } from "@/lib/domain";
import { ProjectCard } from "@/components/ProjectCard";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import { RequireAuth } from "@/components/RequireAuth";
import Link from "next/link";

/* ── Icons ───────────────────────────────────────────────────────── */
const IconProject = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3.5" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5 3.5V2.5a1 1 0 011-1h4a1 1 0 011 1v1M5 8h3M5 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconActive = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.5 8.5l2 2 3-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconProgress = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="6.5" width="13" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="1.5" y="6.5" width="7" height="3" rx="1.5" fill="currentColor" opacity="0.35" />
    <path d="M4 4.5l4-3 4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAdmin = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.5L2 4v3.5c0 2.485 2.1 4.8 5 5.5 2.9-.7 5-3.015 5-5.5V4L7 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M5 7l1.5 1.5L9.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Stat card ───────────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
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

/* ── Inner dashboard ─────────────────────────────────────────────── */
function DashboardInner() {
  const { loading, userId, role } = useCurrentUserRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [progressByProjectId, setProgressByProjectId] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !userId || !role) return;

    let mounted = true;
    (async () => {
      setError(null);
      try {
        const base = supabase.from("projects").select("*");
        let query;
        if (role === "admin")       query = base.order("id", { ascending: false });
        else if (role === "pm")     query = base.eq("pm_id", userId).order("id", { ascending: false });
        else                        query = base.eq("customer_id", userId).order("id", { ascending: false });

        const { data, error: qErr } = await query;
        if (qErr) throw qErr;
        if (!mounted) return;

        const proj = (data ?? []) as Project[];
        setProjects(proj);

        if (proj.length) {
          const ids = proj.map((p) => p.id);
          const { data: msData, error: msErr } = await supabase
            .from("milestones")
            .select("project_id, percentage")
            .in("project_id", ids);
          if (msErr) throw msErr;

          const milestones = (msData ?? []) as Milestone[];
          const accum: Record<string, { sum: number; count: number }> = {};
          for (const m of milestones) {
            const bucket = accum[m.project_id] ?? { sum: 0, count: 0 };
            bucket.sum += m.percentage ?? 0;
            bucket.count += 1;
            accum[m.project_id] = bucket;
          }

          const nextProgress: Record<string, number> = {};
          for (const [pid, v] of Object.entries(accum)) {
            nextProgress[pid] = v.count ? v.sum / v.count : 0;
          }

          if (!mounted) return;
          setProgressByProjectId(nextProgress);
        } else {
          setProgressByProjectId({});
        }
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load projects");
      }
    })();

    return () => { mounted = false; };
  }, [loading, userId, role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f7f9] flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  const roleLabel =
    role === "pm" ? "Project Manager" : role === "customer" ? "Customer" : "Admin";

  const activeCount = projects.filter((p) => p.status === "active").length;
  const avgProgress =
    projects.length
      ? Math.round(
          Object.values(progressByProjectId).reduce((a, b) => a + b, 0) /
            projects.length
        )
      : 0;

  return (
    <div className="min-h-screen bg-[#f0f7f9]">
      {/* Subtle grid */}
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
              Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Signed in as {roleLabel}</p>
          </div>
          {role === "admin" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold
                         text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
            >
              <IconAdmin />
              Manage users &amp; projects
            </Link>
          )}
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
          <StatCard label="Total Projects"   value={projects.length} icon={<IconProject />} />
          <StatCard label="Active"           value={activeCount}     icon={<IconActive />} />
          <StatCard label="Avg. Progress"    value={`${avgProgress}%`} icon={<IconProgress />} />
        </div>

        {/* ── Project grid ── */}
        {!projects.length ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-8 text-sm text-slate-400 text-center">
            No projects found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} progress={progressByProjectId[p.id]} />
            ))}
          </div>
        )}

      </div>
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