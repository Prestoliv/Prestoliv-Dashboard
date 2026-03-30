'use client';

import { supabase } from "@/lib/supabase/client";
import type { Media, Milestone, Project, Update } from "@/lib/domain";

export async function fetchProject(projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function fetchMilestones(projectId: string) {
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Milestone[];
}

export async function updateMilestonePercentages(input: { milestones: Array<{ id: string; percentage: number }> }) {
  await Promise.all(
    input.milestones.map((m) => supabase.from("milestones").update({ percentage: m.percentage }).eq("id", m.id))
  );
}

export async function fetchUpdates(projectId: string) {
  const { data, error } = await supabase
    .from("updates")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Update[];
}

export async function fetchMediaForProject(projectId: string) {
  const { data, error } = await supabase.from("media").select("*").eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []) as Media[];
}

