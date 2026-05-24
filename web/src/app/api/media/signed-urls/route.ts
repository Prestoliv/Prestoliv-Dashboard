import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/serviceServer";
import type { SupabaseClient } from "@supabase/supabase-js";

type MediaInput = {
  id: string;
  url: string;
  project_id: string;
};

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}

async function resolveRole(sb: SupabaseClient, uid: string): Promise<string> {
  const { data: userRow } = await sb.from("users").select("role").eq("id", uid).maybeSingle();
  if (userRow?.role) return String(userRow.role).toLowerCase();
  const { data: profileRow } = await sb.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (profileRow?.role) return String(profileRow.role).toLowerCase();
  return "customer";
}

async function canAccessMedia(
  sb: SupabaseClient,
  uid: string,
  item: MediaInput,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true;

  const { data: project } = await sb
    .from("projects")
    .select("customer_id,pm_id")
    .eq("id", item.project_id)
    .maybeSingle();

  if (project) {
    if (String(project.customer_id) === uid) return true;
    if (project.pm_id && String(project.pm_id) === uid) return true;
  }

  const parts = item.url.split("/");
  const updatesIdx = parts.indexOf("updates");
  const updateId =
    updatesIdx >= 0 && parts[updatesIdx + 1] ? parts[updatesIdx + 1] : parts[3] ?? "";

  if (updateId) {
    const { data: byUpdate } = await sb
      .from("updates")
      .select("id")
      .eq("id", updateId)
      .eq("created_by", uid)
      .maybeSingle();
    if (byUpdate) return true;
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return unauthorized("Missing auth token");
    const accessToken = authHeader.slice("Bearer ".length).trim();

    const sb = createServiceSupabaseClient();

    const { data: who, error: whoErr } = await sb.auth.getUser(accessToken);
    if (whoErr || !who?.user?.id) return unauthorized("Invalid auth token");
    const uid = who.user.id;

    const { media } = (await req.json()) as { media?: MediaInput[] };
    const list = (media ?? []).filter((m) => m?.id && m?.url && m?.project_id);
    if (!list.length) return NextResponse.json({ signedByMediaId: {} });

    const role = await resolveRole(sb, uid);
    const isAdmin = role === "admin";
    const bucket = "project-media";
    const signedByMediaId: Record<string, string> = {};

    for (const item of list) {
      const allowed = await canAccessMedia(sb, uid, item, isAdmin);
      if (!allowed) continue;

      const { data } = await sb.storage.from(bucket).createSignedUrl(item.url, 60 * 60);
      if (data?.signedUrl) signedByMediaId[item.id] = data.signedUrl;
    }

    return NextResponse.json({ signedByMediaId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to sign URLs" },
      { status: 500 }
    );
  }
}
