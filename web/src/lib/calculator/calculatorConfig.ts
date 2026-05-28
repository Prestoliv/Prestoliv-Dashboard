'use client';

import { supabase } from "@/lib/supabase/client";
import {
  CALCULATOR_SETTINGS_KEY,
  DEFAULT_CALCULATOR_SETTINGS,
  type CalculatorPackageRow,
  type CalculatorSettings,
  type CalculatorUnit,
} from "@/lib/calculator/types";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

export function parseCalculatorSettings(value: unknown): CalculatorSettings {
  const o =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const unit = o.default_unit === "sqm" ? "sqm" : "sqft";
  const d = DEFAULT_CALCULATOR_SETTINGS;

  return {
    enabled: o.enabled !== false,
    default_area: num(o.default_area, d.default_area),
    default_unit: unit as CalculatorUnit,
    sqm_to_sqft_factor: num(o.sqm_to_sqft_factor, d.sqm_to_sqft_factor),
    show_estimate_range: o.show_estimate_range === true,
    low_variance_pct: num(o.low_variance_pct, d.low_variance_pct),
    high_variance_pct: num(o.high_variance_pct, d.high_variance_pct),
    hero_eyebrow: str(o.hero_eyebrow, d.hero_eyebrow),
    hero_title: str(o.hero_title, d.hero_title),
    hero_subtitle: str(o.hero_subtitle, d.hero_subtitle),
    area_section_title: str(o.area_section_title, d.area_section_title),
    area_section_help: str(o.area_section_help, d.area_section_help),
    packages_section_title: str(o.packages_section_title, d.packages_section_title),
    packages_section_subtitle: str(
      o.packages_section_subtitle,
      d.packages_section_subtitle
    ),
    per_sqft_label: str(o.per_sqft_label, d.per_sqft_label),
    estimated_total_label: str(o.estimated_total_label, d.estimated_total_label),
    cta_eyebrow: str(o.cta_eyebrow, d.cta_eyebrow),
    cta_title: str(o.cta_title, d.cta_title),
    cta_subtitle: str(o.cta_subtitle, d.cta_subtitle),
    cta_button: str(o.cta_button, d.cta_button),
  };
}

export function rowToPackage(row: Record<string, unknown>): CalculatorPackageRow {
  return {
    id: String(row.id ?? ""),
    label: String(row.label ?? ""),
    description: String(row.description ?? ""),
    price_per_sqft: num(row.price_per_sqft, 0),
    badge: row.badge != null && String(row.badge).trim() ? String(row.badge) : null,
    highlight: row.highlight === true,
    color: String(row.color ?? "bg-brand"),
    sort_order: num(row.sort_order, 0),
    enabled: row.enabled !== false,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function fetchCalculatorPackagesAdmin(): Promise<CalculatorPackageRow[]> {
  const { data, error } = await supabase
    .from("calculator_packages")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => rowToPackage(r));
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

export async function upsertCalculatorPackage(
  pkg: CalculatorPackageRow
): Promise<void> {
  const { error } = await supabase.from("calculator_packages").upsert(
    {
      id: pkg.id,
      label: pkg.label,
      description: pkg.description,
      price_per_sqft: pkg.price_per_sqft,
      badge: pkg.badge,
      highlight: pkg.highlight,
      color: pkg.color,
      sort_order: pkg.sort_order,
      enabled: pkg.enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function deleteCalculatorPackage(id: string): Promise<void> {
  const { error } = await supabase.from("calculator_packages").delete().eq("id", id);
  if (error) throw error;
}
