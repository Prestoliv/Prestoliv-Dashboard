'use client';

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import {
  deleteCalculatorPackage,
  fetchCalculatorPackagesAdmin,
  fetchCalculatorSettings,
  saveCalculatorSettings,
  upsertCalculatorPackage,
} from "@/lib/calculator/calculatorConfig";
import {
  computePackageTotal,
  DEFAULT_CALCULATOR_SETTINGS,
  type CalculatorPackageRow,
  type CalculatorSettings,
  type CalculatorUnit,
} from "@/lib/calculator/types";
import { isMissingTableError } from "@/lib/supabase/errors";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 " +
  "outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

const textareaCls = inputCls + " min-h-[72px] resize-y";

const btnOutline =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 " +
  "hover:border-teal-200 hover:text-teal-700 hover:bg-teal-50 transition disabled:opacity-50";

const btnPrimary =
  "rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 " +
  "hover:shadow-md disabled:cursor-not-allowed";

const btnDanger =
  "rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 " +
  "hover:bg-red-50 transition disabled:opacity-50";

function emptyPackage(sortOrder: number): CalculatorPackageRow {
  return {
    id: "",
    label: "",
    description: "",
    price_per_sqft: 1900,
    badge: null,
    highlight: false,
    color: "bg-brand",
    sort_order: sortOrder,
    enabled: true,
  };
}

function formatInr(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

type CopyField = {
  key: keyof CalculatorSettings;
  label: string;
  multiline?: boolean;
};

const COPY_FIELDS: CopyField[] = [
  { key: "hero_eyebrow", label: "Hero eyebrow" },
  { key: "hero_title", label: "Hero title" },
  { key: "hero_subtitle", label: "Hero subtitle", multiline: true },
  { key: "area_section_title", label: "Area section title" },
  { key: "area_section_help", label: "Area section help", multiline: true },
  { key: "packages_section_title", label: "Packages section title" },
  { key: "packages_section_subtitle", label: "Packages section subtitle", multiline: true },
  { key: "per_sqft_label", label: "Per sq ft label (e.g. per sq ft)" },
  { key: "estimated_total_label", label: "Estimated total label" },
  { key: "cta_eyebrow", label: "CTA eyebrow" },
  { key: "cta_title", label: "CTA title" },
  { key: "cta_subtitle", label: "CTA subtitle", multiline: true },
  { key: "cta_button", label: "CTA button text" },
];

export default function AdminCalculatorConfigPage() {
  const [packages, setPackages] = useState<CalculatorPackageRow[]>([]);
  const [settings, setSettings] = useState<CalculatorSettings>(DEFAULT_CALCULATOR_SETTINGS);
  const [draft, setDraft] = useState<CalculatorPackageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgs, cfg] = await Promise.all([
        fetchCalculatorPackagesAdmin(),
        fetchCalculatorSettings(),
      ]);
      setPackages(pkgs);
      setSettings(cfg);
    } catch (e) {
      const err = e as { message?: string; code?: string };
      if (isMissingTableError(err as Error, "calculator_packages")) {
        setError(
          "Calculator packages table is not set up yet. Run migration 0022_calculator_packages.sql in Supabase SQL Editor."
        );
      } else {
        setError(err.message ?? "Failed to load calculator configuration");
      }
      setPackages([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveSettings = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveCalculatorSettings(settings);
      flash("Calculator settings saved");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const handleSavePackage = async () => {
    if (!draft) return;
    const id = draft.id.trim().toLowerCase().replace(/\s+/g, "_");
    if (!id || !draft.label.trim()) {
      setError("Package id and name are required");
      return;
    }
    if (draft.price_per_sqft <= 0) {
      setError("Price per sq ft must be greater than zero");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertCalculatorPackage({ ...draft, id });
      setDraft(null);
      await load();
      flash("Package saved");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete package "${id}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCalculatorPackage(id);
      await load();
      flash("Package deleted");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const handleToggleEnabled = async (p: CalculatorPackageRow) => {
    setBusy(true);
    setError(null);
    try {
      await upsertCalculatorPackage({ ...p, enabled: !p.enabled });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const previewSqft =
    settings.default_unit === "sqft"
      ? settings.default_area
      : settings.default_area * settings.sqm_to_sqft_factor;

  return (
    <RequireAuth allowedRoles={["admin"]}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cost Calculator</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure construction packages (₹/sq ft), page copy, and defaults for the public
            calculator at <span className="font-mono text-teal-700">/calculator</span>.
            Totals are area × package rate — no material breakdown.
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Global + copy */}
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <p className="text-sm font-bold text-slate-800">General & page copy</p>
            <p className="text-xs text-slate-400 mt-0.5">
              All labels and headings on the public calculator are editable here
            </p>
          </div>
          <div className="p-6 space-y-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, enabled: e.target.checked }))
                }
              />
              Calculator enabled on website
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Default area
                </p>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={settings.default_area}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      default_area: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Default unit
                </p>
                <select
                  className={inputCls}
                  value={settings.default_unit}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      default_unit: e.target.value as CalculatorUnit,
                    }))
                  }
                >
                  <option value="sqft">sq ft</option>
                  <option value="sqm">sq m</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  sq m → sq ft factor
                </p>
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  className={inputCls}
                  value={settings.sqm_to_sqft_factor}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      sqm_to_sqft_factor: parseFloat(e.target.value) || 10.764,
                    }))
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.show_estimate_range}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, show_estimate_range: e.target.checked }))
                }
              />
              Show low / high estimate range (optional band around total)
            </label>

            {settings.show_estimate_range && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Low variance (0–1)
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    className={inputCls}
                    value={settings.low_variance_pct}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        low_variance_pct: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    High variance (0–1)
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    className={inputCls}
                    value={settings.high_variance_pct}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        high_variance_pct: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                Page text
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {COPY_FIELDS.map(({ key, label, multiline }) => (
                  <div key={key} className={multiline ? "sm:col-span-2" : ""}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {label}
                    </p>
                    {multiline ? (
                      <textarea
                        className={textareaCls}
                        value={settings[key] as string}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, [key]: e.target.value }))
                        }
                      />
                    ) : (
                      <input
                        className={inputCls}
                        value={settings[key] as string}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, [key]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="px-6 pb-6">
            <button
              type="button"
              disabled={busy || loading}
              className={btnPrimary}
              style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
              onClick={handleSaveSettings}
            >
              Save settings & copy
            </button>
          </div>
        </section>

        {/* Packages */}
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">Construction packages</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Total cost = built-up area (sq ft) × price per sq ft. Typical market range:
                ₹1,900–₹2,600/sq ft.
              </p>
            </div>
            <button
              type="button"
              className={btnOutline}
              disabled={busy || loading}
              onClick={() => setDraft(emptyPackage(packages.length + 1))}
            >
              + Add package
            </button>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : packages.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No packages configured.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {packages.map((p) => (
                <div
                  key={p.id}
                  className={`px-6 py-4 flex flex-wrap items-start justify-between gap-4 ${
                    !p.enabled ? "opacity-60 bg-slate-50/50" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
                      <p className="font-semibold text-slate-800">{p.label}</p>
                      {p.badge && (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-700">
                          {p.badge}
                        </span>
                      )}
                      {p.highlight && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                          Highlighted
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-400">({p.id})</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      ₹{p.price_per_sqft.toLocaleString("en-IN")} / sq ft · preview at default
                      area: {formatInr(computePackageTotal(previewSqft, p.price_per_sqft))}
                    </p>
                    {p.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnOutline}
                      disabled={busy}
                      onClick={() => setDraft({ ...p })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={btnOutline}
                      disabled={busy}
                      onClick={() => handleToggleEnabled(p)}
                    >
                      {p.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className={btnDanger}
                      disabled={busy}
                      onClick={() => handleDelete(p.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {draft && (
          <section className="rounded-2xl border border-teal-100 bg-white shadow-md p-6 space-y-4">
            <p className="text-sm font-bold text-slate-800">
              {packages.some((x) => x.id === draft.id) ? "Edit package" : "New package"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Id (slug)</p>
                <input
                  className={inputCls}
                  value={draft.id}
                  disabled={packages.some((x) => x.id === draft.id && draft.id !== "")}
                  placeholder="e.g. classic"
                  onChange={(e) => setDraft((d) => d && { ...d, id: e.target.value })}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Name</p>
                <input
                  className={inputCls}
                  value={draft.label}
                  onChange={(e) => setDraft((d) => d && { ...d, label: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Description
                </p>
                <textarea
                  className={textareaCls}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, description: e.target.value })
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Price per sq ft (INR)
                </p>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={draft.price_per_sqft}
                  onChange={(e) =>
                    setDraft(
                      (d) =>
                        d && { ...d, price_per_sqft: parseFloat(e.target.value) || 0 }
                    )
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Badge (optional)
                </p>
                <input
                  className={inputCls}
                  value={draft.badge ?? ""}
                  placeholder="e.g. Most popular"
                  onChange={(e) =>
                    setDraft((d) =>
                      d && { ...d, badge: e.target.value.trim() || null }
                    )
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Accent color (Tailwind bg-*)
                </p>
                <input
                  className={inputCls}
                  value={draft.color}
                  placeholder="bg-brand"
                  onChange={(e) => setDraft((d) => d && { ...d, color: e.target.value })}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sort order</p>
                <input
                  type="number"
                  className={inputCls}
                  value={draft.sort_order}
                  onChange={(e) =>
                    setDraft(
                      (d) => d && { ...d, sort_order: parseInt(e.target.value, 10) || 0 }
                    )
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.highlight}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, highlight: e.target.checked })
                  }
                />
                Highlight on website (default selection)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, enabled: e.target.checked })
                  }
                />
                Visible on website
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                className={btnPrimary}
                style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
                onClick={handleSavePackage}
              >
                Save package
              </button>
              <button type="button" className={btnOutline} onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </RequireAuth>
  );
}
