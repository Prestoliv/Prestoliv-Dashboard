export type CalculatorUnit = "sqft" | "sqm";

export type CalculatorMaterialRow = {
  id: string;
  label: string;
  icon_key: string;
  factor: number;
  unit: string;
  default_rate: number;
  rate_label: string;
  color: string;
  sort_order: number;
  enabled: boolean;
  updated_at?: string;
};

export type CalculatorSettings = {
  enabled: boolean;
  default_area: number;
  default_unit: CalculatorUnit;
  low_variance_pct: number;
  high_variance_pct: number;
  sqm_to_sqft_factor: number;
};

export const CALCULATOR_SETTINGS_KEY = "calculator_settings";

export const DEFAULT_CALCULATOR_SETTINGS: CalculatorSettings = {
  enabled: true,
  default_area: 1000,
  default_unit: "sqft",
  low_variance_pct: 0.1,
  high_variance_pct: 0.1,
  sqm_to_sqft_factor: 10.764,
};

export const CALCULATOR_ICON_KEYS = [
  "layout-grid",
  "layers",
  "package",
  "hammer",
  "calculator",
] as const;

export type CalculatorIconKey = (typeof CALCULATOR_ICON_KEYS)[number];
