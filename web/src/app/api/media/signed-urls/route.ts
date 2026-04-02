import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/serviceServer";

type MediaInput = {
  id: string;
  url: string;
  project_id: string;
};

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
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

    // Determine role once (best-effort; we still authorize by membership/created_by below).
    const { data: userRow } = await sb.from("users").select("role").eq("id", uid).single();
    const role = String(userRow?.role ?? "customer");

    const bucket = "project-media";
    const signedByMediaId: Record<string, string> = {};

    const isAdmin = role === "admin";

    // Sign each requested media path.
    for (const item of list) {
      if (isAdmin) {
        const { data } = await sb.storage.from(bucket).createSignedUrl(item.url, 60 * 60);
        if (data?.signedUrl) signedByMediaId[item.id] = data.signedUrl;
        continue;
      }

      // Parse update id from the storage path: projects/<project_id>/updates/<update_id>/<file>
      const parts = item.url.split("/");
      const updatesIdx = parts.indexOf("updates");
      const updateId =
        updatesIdx >= 0 && parts[updatesIdx + 1] ? parts[updatesIdx + 1] : parts[3] ?? "";

      let canByUpdate = false;
      if (updateId) {
        const { data: byUpdate } = await sb
          .from("updates")
          .select("id")
          .eq("id", updateId)
          .eq("created_by", uid)
          .maybeSingle();
        canByUpdate = Boolean(byUpdate);
      }

      if (canByUpdate) {
        const { data } = await sb.storage.from(bucket).createSignedUrl(item.url, 60 * 60);
        if (data?.signedUrl) signedByMediaId[item.id] = data.signedUrl;
        continue;
      }

      // Customer membership: allow if they own the project.
      const { data: okProjectRow } = await sb
        .from("projects")
        .select("id")
        .eq("id", item.project_id)
        .eq("customer_id", uid)
        .maybeSingle();

      if (!okProjectRow) continue;

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

