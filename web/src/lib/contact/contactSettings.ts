'use client';

import { supabase } from "@/lib/supabase/client";

export const CONTACT_SETTINGS_KEY = "contact_settings";

export type ContactSettings = {
  whatsapp_number: string;
  phone_e164: string;
  phone_display: string;
  whatsapp_enabled: boolean;
};

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  whatsapp_number: "919849078569",
  phone_e164: "+919849078569",
  phone_display: "+91 98490 78569",
  whatsapp_enabled: true,
};

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function parseContactSettings(value: unknown): ContactSettings {
  const o =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const d = DEFAULT_CONTACT_SETTINGS;

  const whatsappNumber = digitsOnly(
    str(o.whatsapp_number ?? o.whatsappNumber, d.whatsapp_number)
  );
  const phoneE164 = str(o.phone_e164 ?? o.phoneE164, d.phone_e164);
  const phoneDigits = digitsOnly(phoneE164);

  return {
    whatsapp_number: whatsappNumber || d.whatsapp_number,
    phone_e164: phoneDigits ? `+${phoneDigits}` : d.phone_e164,
    phone_display: str(o.phone_display ?? o.phoneDisplay, d.phone_display),
    whatsapp_enabled: o.whatsapp_enabled !== false && o.whatsappEnabled !== false,
  };
}

export function buildWhatsAppUrl(whatsappNumber: string): string {
  const digits =
    digitsOnly(whatsappNumber) || DEFAULT_CONTACT_SETTINGS.whatsapp_number;
  return `https://wa.me/${digits}`;
}

export async function fetchContactSettings(): Promise<ContactSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CONTACT_SETTINGS_KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data?.value) return { ...DEFAULT_CONTACT_SETTINGS };
  return parseContactSettings(data.value);
}

export async function saveContactSettings(
  settings: ContactSettings
): Promise<void> {
  const normalized: ContactSettings = {
    whatsapp_number: digitsOnly(settings.whatsapp_number) || DEFAULT_CONTACT_SETTINGS.whatsapp_number,
    phone_e164: settings.phone_e164.trim().startsWith("+")
      ? `+${digitsOnly(settings.phone_e164)}`
      : `+${digitsOnly(settings.phone_e164)}`,
    phone_display: settings.phone_display.trim() || DEFAULT_CONTACT_SETTINGS.phone_display,
    whatsapp_enabled: settings.whatsapp_enabled,
  };

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: CONTACT_SETTINGS_KEY,
      value: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw error;
}
