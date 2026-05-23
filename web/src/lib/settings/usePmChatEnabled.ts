'use client';

import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { fetchPmChatEnabled, PM_CHAT_SETTING_KEY, parsePmChatValue } from "@/lib/settings/appSettings";

export function usePmChatEnabled() {
  const [pmChatEnabled, setPmChatEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const enabled = await fetchPmChatEnabled();
        if (mounted) setPmChatEnabled(enabled);
      } catch {
        if (mounted) setPmChatEnabled(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    const channel = supabase
      .channel("app_settings:pm_chat_enabled")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=eq.${PM_CHAT_SETTING_KEY}`,
        },
        (payload: RealtimePostgresChangesPayload<{ key: string; value: unknown }>) => {
          const row = (payload.new ?? payload.old) as { value?: unknown } | null;
          if (!row) return;
          setPmChatEnabled(parsePmChatValue(row.value));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { pmChatEnabled, loading };
}
