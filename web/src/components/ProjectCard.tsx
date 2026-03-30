'use client';

import Link from "next/link";
import type { Project } from "@/lib/domain";
import { StatusBadge } from "./ui/Badge";

export function ProjectCard({
  project,
  progress,
}: {
  project: Project;
  progress?: number;
}) {
  const pct =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-xl border border-slate-200 bg-white hover:border-slate-300 p-4 transition shadow-sm hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">{project.name}</div>
          <div className="text-xs text-slate-500 mt-1">ID: {project.id}</div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {pct !== null ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Milestone progress</span>
            <span className="font-medium text-slate-900">{pct}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </Link>
  );
}

