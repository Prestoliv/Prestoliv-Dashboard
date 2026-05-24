'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Milestone, Project } from "@/lib/domain";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectSideDrawer } from "@/components/ProjectSideDrawer";
import { RequireAuth } from "@/components/RequireAuth";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import { useSWRCache } from "@/lib/cache/useSWRCache";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "on_hold", label: "On hold" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 " +
  "placeholder-slate-400 outline-none shadow-sm transition " +
  "focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ProjectsInner() {
  const { loading, userId, role } = useCurrentUserRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [progressByProjectId, setProgressByProjectId] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sheetProjectId, setSheetProjectId] = useState<string | null>(null);

  const enabled = !loading && !!userId && !!role;
  const projectsKey = enabled ? `projects:list:${role}:${userId}` : "projects:list:anon";
  const progressKey = enabled ? `projects:progress:${role}:${userId}` : "projects:progress:anon";

  const projectsSWR = useSWRCache<Project[]>({
    key: projectsKey,
    enabled,
    ttlMs: 60_000,
    fetcher: async () => {
      const base = supabase.from("projects").select("*");
      let query;
      if (role === "admin") query = base.order("created_at", { ascending: false });
      else if (role === "pm") query = base.eq("pm_id", userId!).order("created_at", { ascending: false });
      else query = base.eq("customer_id", userId!).order("created_at", { ascending: false });
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
      for (const [pid, v] of Object.entries(accum)) {
        next[pid] = v.count ? v.sum / v.count : 0;
      }
      return next;
    },
  });

  useEffect(() => {
    if (projectsSWR.data) setProjects(projectsSWR.data);
  }, [projectsSWR.data]);

  useEffect(() => {
    if (progressSWR.data) setProgressByProjectId(progressSWR.data);
    else if (projectsSWR.data?.length === 0) setProgressByProjectId({});
  }, [progressSWR.data, projectsSWR.data]);

  useEffect(() => {
    const e = projectsSWR.error ?? progressSWR.error;
    if (!e) {
      setError(null);
      return;
    }
    setError(e instanceof Error ? e.message : "Failed to load projects");
  }, [projectsSWR.error, progressSWR.error]);

  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const id = p.id.toLowerCase();
      const status = (p.status ?? "").toLowerCase().replace("_", " ");
      return name.includes(q) || id.includes(q) || status.includes(q);
    });
  }, [projects, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const p of projects) {
      c[p.status] = (c[p.status] ?? 0) + 1;
    }
    return c;
  }, [projects]);

  const listLoading = loading || (projectsSWR.loading && !projectsSWR.data);

  return (
    <div className="relative min-h-full bg-[#f0f7f9]">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(14,116,144,.03) 1px,transparent 1px),
                            linear-gradient(90deg,rgba(14,116,144,.03) 1px,transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="shell-page space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1
              className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight leading-none"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Projects
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {projects.length} project{projects.length === 1 ? "" : "s"}
              {filtered.length !== projects.length
                ? ` · ${filtered.length} shown`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void projectsSWR.refresh();
              void progressSWR.refresh();
            }}
            disabled={listLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2
                       text-xs font-semibold text-slate-600 hover:bg-teal-50 hover:text-teal-600
                       hover:border-teal-200 transition-all disabled:opacity-50 self-start"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
              <IconSearch />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, status, or ID…"
              className={inputCls}
              aria-label="Search projects"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              const count = counts[f.key] ?? 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? "text-white shadow-md"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-700"
                  }`}
                  style={
                    active
                      ? { background: "linear-gradient(135deg, #0891b2, #0d9488)" }
                      : undefined
                  }
                >
                  {f.label}
                  <span className={`ml-1.5 ${active ? "text-white/80" : "text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {listLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
            <span className="text-sm font-medium">Loading projects…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-slate-500">
              {projects.length === 0 ? "No projects yet" : "No projects match your search"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {projects.length === 0
                ? "Projects assigned to you will appear here"
                : "Try a different search or status filter"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                progress={progressByProjectId[p.id]}
                onOpen={() => setSheetProjectId(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectSideDrawer
        projectId={sheetProjectId}
        open={sheetProjectId !== null}
        onClose={() => setSheetProjectId(null)}
      />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <RequireAuth>
      <ProjectsInner />
    </RequireAuth>
  );
}
