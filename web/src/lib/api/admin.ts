'use client';

import { supabase } from "@/lib/supabase/client";
import type { Project } from "@/lib/domain";

// NOTE: Template/UserRow types for admin are defined as helpers in the UI. If you want
// stricter typing here, we can move admin types into `src/lib/domain.ts`.

export async function setUserRole(input: { userId: string; role: "pm" | "customer" }) {
  const { error } = await supabase.from("users").update({ role: input.role }).eq("id", input.userId);
  if (error) throw error;
}

export async function createProject(input: {
  name: string;
  customerId: string;
  pmId: string;
  status: Project["status"];
}) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name,
      customer_id: input.customerId,
      client_id: input.customerId,
      pm_id: input.pmId,
      status: input.status,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

