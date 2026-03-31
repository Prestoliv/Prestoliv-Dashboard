'use client';

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSWRCache } from "@/lib/cache/useSWRCache";
import type { UserRole } from "@/lib/types";

type ActivityLog = { id: string; user_id: string; action: string; created_at: string };

function formatRelativeTime(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 14) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function ActivityLogPanel({
  role,
  userId,
  className = "",
}: {
  role: UserRole | null;
  userId: string | null;
  className?: string;
}) {
  const [q, setQ] = useState("");

  const enabled = !!userId && role === "admin";
  const key = enabled ? `dashboard:activity_logs:${userId}` : "dashboard:activity_logs:disabled";

  const swr = useSWRCache<ActivityLog[]>({
    key,
    enabled,
    ttlMs: 15_000,
    fetcher: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
  });

  const filtered = useMemo(() => {
    const list = swr.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((l) => (l.action ?? "").toLowerCase().includes(needle));
  }, [swr.data, q]);

  return (
    <div className={`rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm ${className}`}>
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Activity Log</p>
          <p className="text-xs text-slate-400 mt-0.5">Last 50 audit events</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => swr.refresh()}
            disabled={!enabled || swr.loading}
            className="h-9 px-3 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600
                       hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
          >
            {swr.loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="p-5">
        {role !== "admin" ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-5">
            <p className="text-sm font-semibold text-slate-700">Logs are admin-only</p>
            <p className="text-xs text-slate-500 mt-1">
              Your database policy currently allows only admins to read `activity_logs`.
            </p>
          </div>
        ) : swr.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">Failed to load activity logs</p>
            <p className="text-xs text-red-700/80 mt-1 break-words">
              {swr.error instanceof Error ? swr.error.message : "Unknown error"}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search actions…"
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700
                           placeholder-slate-400 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                {filtered.length}/{(swr.data ?? []).length}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-6 text-center">
                <p className="text-sm font-semibold text-slate-700">No log entries yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Logs are created by triggers using `auth.uid()`. If you inserted data via SQL seed/service role,
                  there may be no user context to log.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filtered.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-teal-100 hover:bg-teal-50/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-700 leading-snug">{l.action}</p>
                      <time
                        className="text-[11px] text-slate-400 whitespace-nowrap"
                        title={new Date(l.created_at).toLocaleString()}
                      >
                        {formatRelativeTime(l.created_at)}
                      </time>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">
                      {l.user_id}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

