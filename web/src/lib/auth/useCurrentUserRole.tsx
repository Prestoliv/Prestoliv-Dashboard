'use client';

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export function useCurrentUserRole() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;

        if (!data.user) {
          setUserId(null);
          setRole(null);
          setName(null);
          return;
        }

        setUserId(data.user.id);

        const { data: row, error: roleError } = await supabase
          .from("users")
          .select("role,name")
          .eq("id", data.user.id)
          .single();
        if (roleError) throw roleError;
        if (!mounted) return;

        setRole((row?.role as UserRole) ?? null);
        setName((row?.name as string | null) ?? null);
      } catch {
        // Swallow errors so UI doesn't crash.
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { loading, userId, role, name };
}

