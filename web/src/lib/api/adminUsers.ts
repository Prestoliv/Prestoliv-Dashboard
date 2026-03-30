"use client";

import { supabase } from "@/lib/supabase/client";
import type { UserRow } from "@/lib/domain";
import type { UserRole } from "@/lib/types";

/**
 * Admin lists PMs and customers. Prefer `profiles` (base table); fall back to `users` view.
 */
/** Roles that count as PM or customer in the admin UI (DB may use mixed case). */
const PM_CUSTOMER_ROLES = ["pm", "customer", "PM", "Customer", "Pm", "CUSTOMER"];

export async function fetchPmAndCustomersForAdmin(): Promise<{ data: UserRow[]; error: Error | null }> {
  const primary = await supabase
    .from("profiles")
    .select("id,name,role")
    .in("role", PM_CUSTOMER_ROLES)
    .order("id", { ascending: false });

  if (!primary.error && primary.data) {
    return { data: primary.data as UserRow[], error: null };
  }

  const fallback = await supabase
    .from("users")
    .select("id,name,role")
    .in("role", PM_CUSTOMER_ROLES)
    .order("id", { ascending: false });

  if (fallback.error) {
    return { data: [], error: new Error(fallback.error.message) };
  }
  return { data: (fallback.data ?? []) as UserRow[], error: null };
}

export async function updateProfileRole(userId: string, role: UserRole) {
  const r = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (!r.error) return r;
  return supabase.from("users").update({ role }).eq("id", userId);
}

export async function setPmNameAndRole(userId: string, name: string) {
  const r = await supabase.from("profiles").update({ role: "pm", name }).eq("id", userId);
  if (!r.error) return r;
  return supabase.from("users").update({ role: "pm", name }).eq("id", userId);
}
