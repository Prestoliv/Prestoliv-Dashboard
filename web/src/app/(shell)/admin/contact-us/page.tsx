'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import {
  exportContactUsToExcel,
  formatContactService,
  isContactUnseen,
  type ContactUsRow,
} from "@/lib/contactUs";
import { useContactUsNotifications } from "@/lib/contactUs/ContactUsNotifications";
import { isMissingTableError } from "@/lib/supabase/errors";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const btnOutline =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 " +
  "hover:border-teal-200 hover:text-teal-700 hover:bg-teal-50 transition disabled:opacity-50 disabled:cursor-not-allowed";

const btnPrimary =
  "rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 " +
  "hover:shadow-md disabled:cursor-not-allowed";

const btnDanger =
  "rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 " +
  "hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed";

export default function AdminContactUsPage() {
  const { refreshUnseen, adjustUnseen } = useContactUsNotifications();
  const [rows, setRows] = useState<ContactUsRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("contact_us")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      if (isMissingTableError(fetchError, "contact_us")) {
        setError(
          "The contact_us table is not set up yet. Run migrations 0017 and 0018 in Supabase SQL Editor."
        );
      } else {
        setError(fetchError.message);
      }
      setRows([]);
    } else {
      setRows((data ?? []) as ContactUsRow[]);
    }
    setLoading(false);
    await refreshUnseen();
  }, [refreshUnseen]);

  useEffect(() => {
    load();
  }, [load]);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0;
  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected]
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markSeen = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    const now = new Date().toISOString();
    const unseenIds = ids.filter((id) => {
      const row = rows.find((r) => r.id === id);
      return row && isContactUnseen(row);
    });

    const { error: updateError } = await supabase
      .from("contact_us")
      .update({ seen_at: now })
      .in("id", ids)
      .is("seen_at", null);

    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, seen_at: r.seen_at ?? now } : r))
    );
    adjustUnseen(-unseenIds.length);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    await refreshUnseen();
  };

  const deleteRows = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} submission(s)? This cannot be undone.`)) return;

    setBusy(true);
    const unseenCount = ids.filter((id) => {
      const row = rows.find((r) => r.id === id);
      return row && isContactUnseen(row);
    }).length;

    const { error: deleteError } = await supabase.from("contact_us").delete().in("id", ids);

    setBusy(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    adjustUnseen(-unseenCount);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    await refreshUnseen();
  };

  const markAllSeen = () => {
    const unseenIds = rows.filter(isContactUnseen).map((r) => r.id);
    return markSeen(unseenIds);
  };

  return (
    <RequireAuth allowedRoles={["admin"]}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Contact Us</h1>
              <p className="text-sm text-slate-500 mt-1">
                Consultation requests from the website. New entries show a toast and sidebar badge until marked seen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={load} disabled={loading || busy} className={btnOutline}>
                Refresh
              </button>
              <button
                type="button"
                disabled={rows.length === 0 || busy}
                className={btnOutline}
                onClick={() =>
                  exportContactUsToExcel(rows, `contact-us-all-${new Date().toISOString().slice(0, 10)}`)
                }
              >
                Export all (Excel)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center mr-1">
              Bulk
            </span>
            <button
              type="button"
              disabled={!someSelected || busy}
              className={btnOutline}
              onClick={() => markSeen([...selected])}
            >
              Mark selected seen
            </button>
            <button
              type="button"
              disabled={rows.every((r) => !isContactUnseen(r)) || busy}
              className={btnOutline}
              onClick={markAllSeen}
            >
              Mark all seen
            </button>
            <button
              type="button"
              disabled={!someSelected || busy}
              className={btnOutline}
              onClick={() =>
                exportContactUsToExcel(
                  selectedRows,
                  `contact-us-selected-${new Date().toISOString().slice(0, 10)}`
                )
              }
            >
              Export selected (Excel)
            </button>
            <button
              type="button"
              disabled={!someSelected || busy}
              className={btnDanger}
              onClick={() => deleteRows([...selected])}
            >
              Delete selected
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-8 text-sm text-slate-500">Loading submissions…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-sm text-slate-500">No consultation requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Select all"
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-16">
                      Status
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Submitted
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Name
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Phone
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Email
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      City
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Service
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const unseen = isContactUnseen(row);
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-slate-50 last:border-0 transition-colors ${
                          unseen ? "bg-teal-50/40 hover:bg-teal-50/70" : "hover:bg-slate-50/60"
                        }`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            aria-label={`Select ${row.name}`}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-3">
                          {unseen ? (
                            <span className="inline-flex rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                              New
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase">
                              Seen
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap tabular-nums">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{row.name}</td>
                        <td className="px-3 py-3 text-slate-700">
                          <a href={`tel:${row.phone}`} className="hover:text-teal-700">
                            {row.phone}
                          </a>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {row.email ? (
                            <a href={`mailto:${row.email}`} className="hover:text-teal-700">
                              {row.email}
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-700">{row.city}</td>
                        <td className="px-3 py-3 text-slate-700 max-w-xs">
                          {formatContactService(row)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {unseen && (
                              <button
                                type="button"
                                disabled={busy}
                                className={btnPrimary}
                                style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
                                onClick={() => markSeen([row.id])}
                              >
                                Seen
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              className={btnDanger}
                              onClick={() => deleteRows([row.id])}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
