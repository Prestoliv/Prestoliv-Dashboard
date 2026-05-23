'use client';

import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export const PM_CHAT_SETTING_KEY = "pm_chat_enabled";

export function parsePmChatValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const s = value.toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return true;
}

export async function fetchPmChatEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", PM_CHAT_SETTING_KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data) return true;
  return parsePmChatValue(data.value);
}

export async function setPmChatEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: PM_CHAT_SETTING_KEY,
      value: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw error;
}

export function canPmUseQueryChat(role: UserRole | null, pmChatEnabled: boolean): boolean {
  if (role === "admin") return true;
  if (role === "pm") return pmChatEnabled;
  return false;
}
