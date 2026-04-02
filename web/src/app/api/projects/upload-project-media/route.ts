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
  return name.split(/[/\\]/).pop()?.replace(/\s+/g, "_") || "upload";
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return unauthorized("Missing auth token");
    }
    const accessToken = authHeader.slice("Bearer ".length).trim();

    const sb = createServiceSupabaseClient();

    const { data: who, error: whoErr } = await sb.auth.getUser(accessToken);
    if (whoErr || !who?.user?.id) return unauthorized("Invalid auth token");
    const uid = who.user.id;

    const form = await req.formData();
    const projectId = String(form.get("projectId") ?? "").trim();
    const files = form.getAll("files");
    const updateText = String(form.get("updateText") ?? "").trim() || "Media attachment";

    if (!projectId) return badRequest("Missing projectId");
    if (!files.length) return badRequest("Missing files");

    // Authorization: allow admins, or PM assigned to this project.
    const { data: userRow, error: uErr } = await sb
      .from("users")
      .select("id,role")
      .eq("id", uid)
      .single();
    if (uErr) return badRequest("User not found");
    const role = String(userRow?.role ?? "customer");

    const { data: project, error: pErr } = await sb
      .from("projects")
      .select("id,pm_id")
      .eq("id", projectId)
      .single();
    if (pErr || !project) return badRequest("Project not found");

    const allowed =
      role === "admin" ||
      (role === "pm" && String((project as any).pm_id) === uid);
    if (!allowed) return unauthorized("Forbidden");

    // Create an update row first (so media can attach to updates).
    const { data: createdUpdate, error: upErr } = await sb
      .from("updates")
      .insert({ project_id: projectId, created_by: uid, text: updateText })
      .select("*")
      .single();
    if (upErr || !createdUpdate) {
      return NextResponse.json({ error: upErr?.message ?? "Failed to create update" }, { status: 500 });
    }

    const bucket = "project-media";
    const updateId = createdUpdate.id as string;

    const uploaded: Media[] = [];
    let idx = 0;
    for (const f of files) {
      const file = f as unknown as File;
      const mime = file?.type ?? "application/octet-stream";
      const type = detectMediaType(mime);
      const fileName = sanitizeFileName(file?.name ?? `upload_${idx}`);
      const path = `projects/${projectId}/updates/${updateId}/${Date.now()}_${idx}_${fileName}`;
      idx += 1;

      const { error: storageErr } = await sb.storage
        .from(bucket)
        .upload(path, file, {
          contentType: mime || undefined,
          upsert: false,
        });
      if (storageErr) throw storageErr;

      const { data: mediaRow, error: mediaErr } = await sb
        .from("media")
        .insert({ project_id: projectId, update_id: updateId, url: path, type })
        .select("*")
        .single();
      if (mediaErr) throw mediaErr;
      if (mediaRow) uploaded.push(mediaRow as Media);
    }

    return NextResponse.json({ media: uploaded });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

