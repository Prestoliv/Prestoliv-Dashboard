export type CalculatorUnit = "sqft" | "sqm";

export type CalculatorPackageRow = {
  id: string;
  label: string;
  description: string;
  price_per_sqft: number;
  badge: string | null;
  highlight: boolean;
  color: string;
  sort_order: number;
  enabled: boolean;
  updated_at?: string;
};

export type CalculatorSettings = {
  enabled: boolean;
  default_area: number;
  default_unit: CalculatorUnit;
  sqm_to_sqft_factor: number;
  show_estimate_range: boolean;
  low_variance_pct: number;
  high_variance_pct: number;
  hero_eyebrow: string;
  hero_title: string;
  hero_subtitle: string;
  area_section_title: string;
  area_section_help: string;
  packages_section_title: string;
  packages_section_subtitle: string;
  per_sqft_label: string;
  estimated_total_label: string;
  cta_eyebrow: string;
  cta_title: string;
  cta_subtitle: string;
  cta_button: string;
};

export const CALCULATOR_SETTINGS_KEY = "calculator_settings";

export const DEFAULT_CALCULATOR_SETTINGS: CalculatorSettings = {
  enabled: true,
  default_area: 1500,
  default_unit: "sqft",
  sqm_to_sqft_factor: 10.764,
  show_estimate_range: false,
  low_variance_pct: 0.05,
  high_variance_pct: 0.05,
  hero_eyebrow: "Construction Cost Calculator",
  hero_title: "Estimate your home construction cost",
  hero_subtitle:
    "Enter your built-up area and compare package rates — get an instant total with no hidden breakdowns.",
  area_section_title: "Built-up area",
  area_section_help:
    "Super built-up area of your home in square feet or square metres.",
  packages_section_title: "Choose a package",
  packages_section_subtitle:
    "All-inclusive construction rate per square foot. Total updates as you change area.",
  per_sqft_label: "per sq ft",
  estimated_total_label: "Estimated construction cost",
  cta_eyebrow: "Ready to build?",
  cta_title: "Get a fixed-price quote for your home",
  cta_subtitle:
    "Our team will assess your site and share a transparent, detailed proposal.",
  cta_button: "Book a Free Consultation",
};

export function computePackageTotal(sqft: number, pricePerSqft: number): number {
  return Math.round(sqft * pricePerSqft);
}

export function toSqft(
  area: number,
  unit: CalculatorUnit,
  sqmToSqftFactor: number
): number {
  return unit === "sqft" ? area : area * sqmToSqftFactor;
}
