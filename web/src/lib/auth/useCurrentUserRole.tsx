'use client';

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export function useCurrentUserRole() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadFromSession(session: Session | null) {
      if (!mounted) return;
      setLoading(true);
      try {
        if (!session?.user) {
          setUserId(null);
          setRole(null);
          setName(null);
          return;
        }

        setUserId(session.user.id);

        let row: { role?: string; name?: string | null } | null = null;
        const usersRes = await supabase
          .from("users")
          .select("role,name")
          .eq("id", session.user.id)
          .maybeSingle();
        if (!usersRes.error && usersRes.data) {
          row = usersRes.data;
        } else {
          const profilesRes = await supabase
            .from("profiles")
            .select("role,name,full_name")
            .eq("id", session.user.id)
            .maybeSingle();
          if (!profilesRes.error && profilesRes.data) {
            const p = profilesRes.data;
            row = { role: p.role, name: p.name ?? p.full_name ?? null };
          }
        }
        if (!mounted) return;

        setRole((row?.role as UserRole) ?? null);
        setName((row?.name as string | null) ?? null);
      } catch {
        // Swallow errors so UI doesn't crash.
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      void loadFromSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { loading, userId, role, name };
}

