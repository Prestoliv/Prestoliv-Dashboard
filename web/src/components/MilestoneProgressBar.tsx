'use client';

import type { Milestone } from "@/lib/domain";

export function MilestoneProgressBar({ milestones }: { milestones: Milestone[] }) {
  const safeMilestones = milestones ?? [];
  const avg =
    safeMilestones.length > 0
      ? safeMilestones.reduce((acc, m) => acc + (m.percentage ?? 0), 0) / safeMilestones.length
      : 0;

  const overall = Math.max(0, Math.min(100, Math.round(avg)));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">Overall progress</div>
          <div className="text-xs text-slate-500">Average milestone completion</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-slate-900">{overall}%</div>
          <div className="text-xs text-slate-500">completed</div>
        </div>
      </div>

      <div className="mt-4 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${overall}%` }} />
      </div>

      {safeMilestones.length ? (
        <div className="mt-5 space-y-4">
          {safeMilestones.map((m) => {
            const pct = Math.max(0, Math.min(100, Math.round(m.percentage ?? 0)));
            return (
              <div key={m.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="font-medium text-slate-800">{m.title}</div>
                  <div className="text-xs text-slate-600">{pct}%</div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">No milestones yet.</div>
      )}
    </div>
  );
}

