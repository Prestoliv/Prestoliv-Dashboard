'use client';

import type { Milestone, Project, Query } from "@/lib/domain";
import { MilestoneProgressBar } from "@/components/MilestoneProgressBar";

function StatusPill({ status }: { status: string }) {
  const active = status === "active" || status === "open";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        active
          ? "bg-teal-50 text-teal-800 border border-teal-200"
          : "bg-slate-50 text-slate-600 border border-slate-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 ${active ? "bg-teal-600" : "bg-slate-400"}`} />
      {status}
    </span>
  );
}

export function PortalProjectPanel({
  project,
  milestones,
  queries,
}: {
  project: Project;
  milestones: Milestone[];
  queries: Query[];
}) {
  const avg =
    milestones.length > 0
      ? Math.round(
          milestones.reduce((s, m) => s + (m.percentage ?? 0), 0) / milestones.length
        )
      : 0;

  return (
    <div className="px-4 py-4 space-y-4 sm:px-5 sm:py-5 sm:space-y-5">
      <div className="border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
              {project.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Ref {project.id.slice(0, 8)}</p>
          </div>
          <StatusPill status={project.status} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Progress
            </p>
            <p className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{avg}%</p>
          </div>
          <div className="h-8 w-px bg-slate-200" aria-hidden />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Milestones
            </p>
            <p className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">
              {milestones.length}
            </p>
          </div>
          <div className="h-8 w-px bg-slate-200" aria-hidden />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Queries
            </p>
            <p className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">
              {queries.length}
            </p>
          </div>
        </div>
      </div>

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Milestone progress</h3>
          <p className="text-xs text-slate-500 mt-0.5">Overall completion by phase</p>
        </div>
        <div className="p-4">
          {milestones.length > 0 ? (
            <MilestoneProgressBar milestones={milestones} />
          ) : (
            <p className="text-sm text-slate-500">No milestones yet.</p>
          )}
        </div>
      </section>

      {milestones.length > 0 && (
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Milestones</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-slate-700 truncate">{m.title}</span>
                <span className="text-sm font-semibold text-teal-700 tabular-nums flex-shrink-0">
                  {m.percentage ?? 0}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Support queries</h3>
          <p className="text-xs text-slate-500 mt-0.5">Open a thread from the main page to chat</p>
        </div>
        {queries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">No queries for this project.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queries.map((q) => (
              <li key={q.id} className="px-4 py-3">
                <p className="text-sm text-slate-800 line-clamp-2">{q.message}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {q.status} · {new Date(q.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
