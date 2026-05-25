'use client';

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import {
  deleteCalculatorMaterial,
  fetchCalculatorMaterialsAdmin,
  fetchCalculatorSettings,
  saveCalculatorSettings,
  upsertCalculatorMaterial,
} from "@/lib/calculator/calculatorConfig";
import {
  CALCULATOR_ICON_KEYS,
  DEFAULT_CALCULATOR_SETTINGS,
  type CalculatorMaterialRow,
  type CalculatorSettings,
  type CalculatorUnit,
} from "@/lib/calculator/types";
import { isMissingTableError } from "@/lib/supabase/errors";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 " +
  "outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

const btnOutline =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 " +
  "hover:border-teal-200 hover:text-teal-700 hover:bg-teal-50 transition disabled:opacity-50";

const btnPrimary =
  "rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 " +
  "hover:shadow-md disabled:cursor-not-allowed";

const btnDanger =
  "rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 " +
  "hover:bg-red-50 transition disabled:opacity-50";

function emptyMaterial(sortOrder: number): CalculatorMaterialRow {
  return {
    id: "",
    label: "",
    icon_key: "package",
    factor: 0,
    unit: "",
    default_rate: 0,
    rate_label: "",
    color: "bg-brand",
    sort_order: sortOrder,
    enabled: true,
  };
}

export default function AdminCalculatorConfigPage() {
  const [materials, setMaterials] = useState<CalculatorMaterialRow[]>([]);
  const [settings, setSettings] = useState<CalculatorSettings>(DEFAULT_CALCULATOR_SETTINGS);
  const [draft, setDraft] = useState<CalculatorMaterialRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mats, cfg] = await Promise.all([
        fetchCalculatorMaterialsAdmin(),
        fetchCalculatorSettings(),
      ]);
      setMaterials(mats);
      setSettings(cfg);
    } catch (e) {
      const err = e as { message?: string; code?: string };
      if (isMissingTableError(err as Error, "calculator_materials")) {
        setError(
          "Calculator tables are not set up yet. Run migration 0021_calculator_config.sql in Supabase SQL Editor."
        );
      } else {
        setError(err.message ?? "Failed to load calculator configuration");
      }
      setMaterials([]);
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
      flash("Global settings saved");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const handleSaveMaterial = async () => {
    if (!draft) return;
    const id = draft.id.trim().toLowerCase().replace(/\s+/g, "_");
    if (!id || !draft.label.trim()) {
      setError("Material id and label are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertCalculatorMaterial({ ...draft, id });
      setDraft(null);
      await load();
      flash("Material saved");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete material "${id}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCalculatorMaterial(id);
      await load();
      flash("Material deleted");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const handleToggleEnabled = async (m: CalculatorMaterialRow) => {
    setBusy(true);
    setError(null);
    try {
      await upsertCalculatorMaterial({ ...m, enabled: !m.enabled });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <RequireAuth allowedRoles={["admin"]}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calculator Configurations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Control materials, rates, and global settings for the main website construction
            calculator at <span className="font-mono text-teal-700">/calculator</span>.
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

        {/* Global settings */}
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <p className="text-sm font-bold text-slate-800">Global settings</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Defaults and variance shown on the public calculator
            </p>
          </div>
          <div className="p-6 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, enabled: e.target.checked }))
                }
              />
              Calculator enabled on website
            </label>
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
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Low estimate variance (0–1)
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                High estimate variance (0–1)
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
            <div className="sm:col-span-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                sq m → sq ft conversion factor
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
          <div className="px-6 pb-6">
            <button
              type="button"
              disabled={busy || loading}
              className={btnPrimary}
              style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
              onClick={handleSaveSettings}
            >
              Save global settings
            </button>
          </div>
        </section>

        {/* Materials */}
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">Materials</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Quantity = area (sq ft) × factor; cost = quantity × rate
              </p>
            </div>
            <button
              type="button"
              className={btnOutline}
              disabled={busy || loading}
              onClick={() =>
                setDraft(emptyMaterial(materials.length + 1))
              }
            >
              + Add material
            </button>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : materials.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No materials configured.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {materials.map((m) => (
                <div
                  key={m.id}
                  className={`px-6 py-4 flex flex-wrap items-start justify-between gap-4 ${
                    !m.enabled ? "opacity-60 bg-slate-50/50" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">
                      {m.label}{" "}
                      <span className="text-xs font-mono text-slate-400">({m.id})</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      factor {m.factor} / sq ft · ₹{m.default_rate} {m.rate_label} · sort{" "}
                      {m.sort_order}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {m.unit} · {m.icon_key} · {m.color}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnOutline}
                      disabled={busy}
                      onClick={() => setDraft({ ...m })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={btnOutline}
                      disabled={busy}
                      onClick={() => handleToggleEnabled(m)}
                    >
                      {m.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className={btnDanger}
                      disabled={busy}
                      onClick={() => handleDelete(m.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Draft form */}
        {draft && (
          <section className="rounded-2xl border border-teal-100 bg-white shadow-md p-6 space-y-4">
            <p className="text-sm font-bold text-slate-800">
              {materials.some((x) => x.id === draft.id) ? "Edit material" : "New material"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Id (slug)</p>
                <input
                  className={inputCls}
                  value={draft.id}
                  disabled={materials.some((x) => x.id === draft.id && draft.id !== "")}
                  placeholder="e.g. bricks"
                  onChange={(e) => setDraft((d) => d && { ...d, id: e.target.value })}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Label</p>
                <input
                  className={inputCls}
                  value={draft.label}
                  onChange={(e) => setDraft((d) => d && { ...d, label: e.target.value })}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Factor / sq ft</p>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className={inputCls}
                  value={draft.factor}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, factor: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Default rate (INR)</p>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={draft.default_rate}
                  onChange={(e) =>
                    setDraft(
                      (d) => d && { ...d, default_rate: parseFloat(e.target.value) || 0 }
                    )
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Unit</p>
                <input
                  className={inputCls}
                  value={draft.unit}
                  placeholder="nos, bags, tonnes…"
                  onChange={(e) => setDraft((d) => d && { ...d, unit: e.target.value })}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Rate label</p>
                <input
                  className={inputCls}
                  value={draft.rate_label}
                  placeholder="per brick"
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, rate_label: e.target.value })
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Icon</p>
                <select
                  className={inputCls}
                  value={draft.icon_key}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, icon_key: e.target.value })
                  }
                >
                  {CALCULATOR_ICON_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Color (Tailwind)</p>
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
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
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
                onClick={handleSaveMaterial}
              >
                Save material
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
