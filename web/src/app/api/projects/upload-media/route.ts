import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/serviceServer";
import type { Media } from "@/lib/domain";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}

function detectMediaType(mime: string): "image" | "video" {
  if (mime?.startsWith("image/")) return "image";
  return "video";
}

function sanitizeFileName(name: string) {
  // Keep it simple: remove directory parts and spaces.
  return name.split(/[/\\]/).pop()?.replace(/\s+/g, "_") || "upload";
}

export async function POST(req: Request) {
  // No auth in this route: we rely on service role + project-level checks via inserted rows.
  // The caller is expected to be admin/pm; we validate the uploader by reading auth user id.
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return unauthorized("Missing auth token");
  }
  const accessToken = authHeader.slice("Bearer ".length).trim();

  let sb;
  try {
    sb = createServiceSupabaseClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Supabase not configured" },
      { status: 503 }
    );
  }

  // Validate user: we need their uid to apply ownership checks in RLS-bypassed mode.
  const { data: who, error: whoErr } = await sb.auth.getUser(accessToken);
  if (whoErr || !who?.user?.id) {
    return unauthorized("Invalid auth token");
  }
  const uid = who.user.id;

  const form = await req.formData();
  const projectId = String(form.get("projectId") ?? "").trim();
  const updateId = String(form.get("updateId") ?? "").trim();
  const files = form.getAll("files");
  if (!projectId) return badRequest("Missing projectId");
  if (!updateId) return badRequest("Missing updateId");
  if (!files.length) return badRequest("Missing files");

  // Hardcode bucket name to avoid importing client-only modules in server routes.
  const bucket = "project-media";
  const uploaded: Media[] = [];

  // Verify update belongs to this project/updateId for safety.
  const { data: updateRow, error: upErr } = await sb
    .from("updates")
    .select("id,project_id,created_by")
    .eq("id", updateId)
    .single();
  if (upErr || !updateRow) return badRequest("Update not found");
  if (String(updateRow.project_id) !== projectId) return badRequest("Project mismatch");

  // Only allow: admins/pm OR the user who created the update.
  // (We don't call user_has_role() to avoid DB dependency.)
  const { data: userRow } = await sb
    .from("users")
    .select("id,role")
    .eq("id", uid)
    .single();
  const role = String(userRow?.role ?? "customer");
  const can = role === "admin" || role === "pm" || String(updateRow.created_by) === uid;
  if (!can) return unauthorized("Forbidden");

  // Upload each file then insert into public.media.
  let idx = 0;
  for (const f of files) {
    const file = f as unknown as File;
    const mime = file?.type ?? "application/octet-stream";
    const type = detectMediaType(mime);
    const fileName = sanitizeFileName(file?.name ?? `upload_${idx}`);
    const path = `projects/${projectId}/updates/${updateId}/${Date.now()}_${idx}_${fileName}`;
    idx += 1;

    const { error: upUploadErr } = await sb.storage
      .from(bucket)
      .upload(path, file, {
        contentType: mime || undefined,
        upsert: false,
      });
    if (upUploadErr) throw upUploadErr;

    const { data: mediaRow, error: mediaInsErr } = await sb
      .from("media")
      .insert({
        project_id: projectId,
        update_id: updateId,
        url: path,
        type,
      })
      .select("*")
      .single();
    if (mediaInsErr) throw mediaInsErr;
    uploaded.push(mediaRow as Media);
  }

  return NextResponse.json({ media: uploaded });
}

