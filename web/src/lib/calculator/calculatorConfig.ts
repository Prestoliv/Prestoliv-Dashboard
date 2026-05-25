'use client';

import { supabase } from "@/lib/supabase/client";
import {
  CALCULATOR_SETTINGS_KEY,
  DEFAULT_CALCULATOR_SETTINGS,
  type CalculatorMaterialRow,
  type CalculatorSettings,
  type CalculatorUnit,
} from "@/lib/calculator/types";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export function parseCalculatorSettings(value: unknown): CalculatorSettings {
  const o =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const unit = o.default_unit === "sqm" ? "sqm" : "sqft";
  return {
    enabled: o.enabled !== false,
    default_area: num(o.default_area, DEFAULT_CALCULATOR_SETTINGS.default_area),
    default_unit: unit as CalculatorUnit,
    low_variance_pct: num(
      o.low_variance_pct,
      DEFAULT_CALCULATOR_SETTINGS.low_variance_pct
    ),
    high_variance_pct: num(
      o.high_variance_pct,
      DEFAULT_CALCULATOR_SETTINGS.high_variance_pct
    ),
    sqm_to_sqft_factor: num(
      o.sqm_to_sqft_factor,
      DEFAULT_CALCULATOR_SETTINGS.sqm_to_sqft_factor
    ),
  };
}

export function rowToMaterial(row: Record<string, unknown>): CalculatorMaterialRow {
  return {
    id: String(row.id ?? ""),
    label: String(row.label ?? ""),
    icon_key: String(row.icon_key ?? "package"),
    factor: num(row.factor, 0),
    unit: String(row.unit ?? ""),
    default_rate: num(row.default_rate, 0),
    rate_label: String(row.rate_label ?? ""),
    color: String(row.color ?? "bg-brand"),
    sort_order: num(row.sort_order, 0),
    enabled: row.enabled !== false,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function fetchCalculatorMaterialsAdmin(): Promise<CalculatorMaterialRow[]> {
  const { data, error } = await supabase
    .from("calculator_materials")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => rowToMaterial(r));
}

export async function fetchCalculatorSettings(): Promise<CalculatorSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CALCULATOR_SETTINGS_KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data?.value) return { ...DEFAULT_CALCULATOR_SETTINGS };
  return parseCalculatorSettings(data.value);
}

export async function saveCalculatorSettings(
  settings: CalculatorSettings
): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: CALCULATOR_SETTINGS_KEY,
      value: settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw error;
}

export async function upsertCalculatorMaterial(
  material: CalculatorMaterialRow
): Promise<void> {
  const { error } = await supabase.from("calculator_materials").upsert(
    {
      id: material.id,
      label: material.label,
      icon_key: material.icon_key,
      factor: material.factor,
      unit: material.unit,
      default_rate: material.default_rate,
      rate_label: material.rate_label,
      color: material.color,
      sort_order: material.sort_order,
      enabled: material.enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function deleteCalculatorMaterial(id: string): Promise<void> {
  const { error } = await supabase.from("calculator_materials").delete().eq("id", id);
  if (error) throw error;
}
