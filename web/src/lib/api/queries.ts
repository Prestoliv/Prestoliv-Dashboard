'use client';

import { supabase } from "@/lib/supabase/client";
import type { Query, QueryReply } from "@/lib/domain";
import { isMissingTableError } from "@/lib/supabase/errors";

export async function raiseQuery(input: {
  projectId: string;
  createdBy: string;
  message: string;
}) {
  const { data, error } = await supabase
    .from("queries")
    .insert({
      project_id: input.projectId,
      created_by: input.createdBy,
      message: input.message,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Query;
}

export async function fetchQueriesForProject(projectId: string) {
  const { data, error } = await supabase
    .from("queries")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTableError(error, "queries")) return [];
    throw error;
  }
  return (data ?? []) as Query[];
}

export async function fetchRepliesForQuery(queryId: string) {
  const { data, error } = await supabase
    .from("query_replies")
    .select("*")
    .eq("query_id", queryId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTableError(error, "query_replies")) return [];
    throw error;
  }
  return (data ?? []) as QueryReply[];
}

export async function sendReply(input: { queryId: string; senderId: string; message: string }) {
  const { error } = await supabase.from("query_replies").insert({
    query_id: input.queryId,
    sender_id: input.senderId,
    message: input.message,
  });
  if (error) throw error;
}

export async function closeQuery(queryId: string) {
  const { error } = await supabase.from("queries").update({ status: "closed" }).eq("id", queryId);
  if (error) throw error;
}

