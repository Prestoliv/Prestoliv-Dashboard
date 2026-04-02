'use client';

import Link from "next/link";
import type { Project } from "@/lib/domain";

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active:    { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Active" },
  completed: { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500",    label: "Completed" },
  on_hold:   { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500",   label: "On Hold" },
  cancelled: { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400",     label: "Cancelled" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r   = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} stroke="#e2e8f0" strokeWidth="3" fill="none"/>
        <circle
          cx="22" cy="22" r={r}
          stroke="url(#progressGrad)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease-out" }}
        />
        <defs>
          <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0891b2"/>
            <stop offset="100%" stopColor="#0d9488"/>
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[11px] font-bold text-slate-700">{pct}%</span>
    </div>
  );
}

const cardClassName =
  "group block w-full rounded-2xl border border-slate-100 bg-white p-5 " +
  "hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/5 " +
  "transition-all duration-250 ease-out hover:-translate-y-0.5";

export function ProjectCard({
  project,
  progress,
  onOpen,
}: {
  project: Project;
  progress?: number;
  /** When set, opens this handler instead of navigating to the project page. */
  onOpen?: () => void;
}) {
  const pct =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : null;

  const body = (
    <>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 text-[15px] leading-snug truncate
                         group-hover:text-teal-700 transition-colors duration-200">
            {project.name}
          </h3>
          <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">
            #{project.id.slice(0, 8)}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Progress section */}
      {pct !== null ? (
        <div className="mt-4 flex items-center gap-3">
          <ProgressRing pct={pct} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Milestone Progress
            </p>
            {/* Bar track */}
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg,#0891b2,#0d9488)",
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1.5 w-full rounded-full bg-slate-100" />
          <p className="text-[11px] text-slate-400 whitespace-nowrap">No milestones</p>
        </div>
      )}

      {/* Footer arrow hint */}
      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-end">
        <span className="text-[11px] font-medium text-slate-400 group-hover:text-teal-600 transition-colors duration-200 flex items-center gap-1">
          View project
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="transition-transform duration-200 group-hover:translate-x-0.5">
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={`${cardClassName} text-left`}>
        {body}
      </button>
    );
  }

  return (
    <Link href={`/projects/${project.id}`} className={cardClassName}>
      {body}
    </Link>
  );
}