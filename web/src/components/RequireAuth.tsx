'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export function RequireAuth({
  allowedRoles,
  children,
}: {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) {
          router.replace("/login");
          return;
        }

        const { data: roleRow, error: roleError } = await supabase
          .from("users")
          .select("role")
          .eq("id", data.user.id)
          .single();
        if (roleError) throw roleError;

        const r = (roleRow?.role as UserRole | null) ?? null;
        if (!mounted) return;

        setRole(r);
        if (allowedRoles && r && !allowedRoles.includes(r)) {
          router.replace("/dashboard");
        }
      } catch {
        // If something fails, treat as unauthenticated to avoid leaking data.
        router.replace("/login");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [allowedRoles, router]);

  if (loading) return <div className="p-6 text-slate-600">Loading...</div>;
  return <>{children}</>;
}

