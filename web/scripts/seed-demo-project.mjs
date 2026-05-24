/**
 * Seed demo customer + PM + active project with image/video media.
 *
 *   cd web && npm run seed:demo
 *
 * Requires web/.env or web/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   SEED_DEFAULT_PASSWORD  (default: PrestolivDemo2026!)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { requireSupabaseServiceEnv } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, "seed-assets");
const BUCKET = "project-media";

const CUSTOMER_EMAIL = "vivek@dzynd.co";
const PM_EMAIL = "sharun@prestoliv.com";
const PROJECT_NAME = "Vivek Residence — Interiors";
const DEFAULT_PASSWORD =
  process.env.SEED_DEFAULT_PASSWORD?.trim() || "PrestolivDemo2026!";

const SAMPLE_MP4_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const { url, serviceKey, loaded } = requireSupabaseServiceEnv();
if (loaded.length) console.log(`Using env from: ${loaded[0]}\n`);

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  const target = email.toLowerCase();
  let page = 1;
  while (page <= 20) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function upsertRole(userId, role, displayName, email) {
  const profileRow = {
    id: userId,
    email,
    role,
    name: displayName,
    full_name: displayName,
  };
  const { error: pErr } = await sb.from("profiles").upsert(profileRow, { onConflict: "id" });
  if (pErr) throw new Error(`profiles upsert (${email}): ${pErr.message}`);
  console.log(`  profiles: ${email} → ${role}`);
}

async function ensureUser(email, role, displayName) {
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: displayName, role },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created auth user: ${email}`);
  } else {
    console.log(`Found auth user: ${email}`);
    await sb.auth.admin.updateUserById(user.id, {
      password: DEFAULT_PASSWORD,
      user_metadata: { name: displayName, role },
    });
  }
  if (!user?.id) throw new Error(`No user id for ${email}`);
  await upsertRole(user.id, role, displayName, email);
  return user.id;
}

async function ensureSampleVideo() {
  mkdirSync(ASSETS_DIR, { recursive: true });
  const dest = resolve(ASSETS_DIR, "sample.mp4");
  if (existsSync(dest)) return readFileSync(dest);

  console.log("Downloading sample video…");
  const res = await fetch(SAMPLE_MP4_URL);
  if (!res.ok) throw new Error(`Failed to download sample video: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf;
}

function loadImageBuffers() {
  const logo = resolve(__dirname, "../public/logo.png");
  if (!existsSync(logo)) throw new Error("Missing web/public/logo.png");
  const buf = readFileSync(logo);
  return [
    { name: "site_progress_1.png", buffer: buf, mime: "image/png" },
    { name: "site_progress_2.png", buffer: buf, mime: "image/png" },
  ];
}

async function findExistingProject(customerId, pmId) {
  const { data, error } = await sb
    .from("projects")
    .select("id,name,status")
    .eq("customer_id", customerId)
    .eq("pm_id", pmId)
    .eq("name", PROJECT_NAME)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureProject(customerId, pmId) {
  let project = await findExistingProject(customerId, pmId);
  if (project) {
    console.log(`Using existing project: ${project.name} (${project.id})`);
    return project;
  }

  const { data, error } = await sb
    .from("projects")
    .insert({
      name: PROJECT_NAME,
      customer_id: customerId,
      client_id: customerId,
      pm_id: pmId,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  project = data;
  console.log(`Created project: ${project.name} (${project.id})`);

  const milestones = [
    { title: "Design & planning", percentage: 25 },
    { title: "Procurement", percentage: 50 },
    { title: "Installation", percentage: 75 },
  ];
  const { error: mErr } = await sb.from("milestones").insert(
    milestones.map((m) => ({
      project_id: project.id,
      title: m.title,
      percentage: m.percentage,
    }))
  );
  if (mErr) console.warn("milestones:", mErr.message);

  return project;
}

async function projectHasMedia(projectId) {
  const { count, error } = await sb
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function uploadMedia(projectId, updateId, pmId, files) {
  let idx = 0;
  for (const file of files) {
    const path = `projects/${projectId}/updates/${updateId}/${Date.now()}_${idx}_${file.name}`;
    idx += 1;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file.buffer, {
      contentType: file.mime,
      upsert: false,
    });
    if (upErr) throw upErr;

    const type = file.mime.startsWith("image/") ? "image" : "video";
    const { error: insErr } = await sb
      .from("media")
      .insert({ project_id: projectId, update_id: updateId, url: path, type });
    if (insErr) throw insErr;
    console.log(`  uploaded ${type}: ${file.name}`);
  }
}

async function seedUpdateWithMedia(projectId, pmId) {
  if (await projectHasMedia(projectId)) {
    console.log("Project already has media — skipping upload.");
    return;
  }

  const { data: update, error: upErr } = await sb
    .from("updates")
    .insert({
      project_id: projectId,
      created_by: pmId,
      text: "Weekly progress update — site photos and walkthrough video.",
    })
    .select("*")
    .single();
  if (upErr) throw upErr;

  const videoBuf = await ensureSampleVideo();
  const images = loadImageBuffers();
  const files = [
    ...images,
    { name: "site_walkthrough.mp4", buffer: videoBuf, mime: "video/mp4" },
  ];

  console.log("Uploading media…");
  await uploadMedia(projectId, update.id, pmId, files);
}

async function main() {
  console.log("Seeding demo users and project…\n");

  const customerId = await ensureUser(
    CUSTOMER_EMAIL,
    "customer",
    "Vivek (Dzynd)"
  );
  const pmId = await ensureUser(PM_EMAIL, "pm", "Sharun");

  const project = await ensureProject(customerId, pmId);
  await seedUpdateWithMedia(project.id, pmId);

  console.log("\n--- Done ---");
  console.log(`Customer : ${CUSTOMER_EMAIL}  (password: ${DEFAULT_PASSWORD})`);
  console.log(`PM       : ${PM_EMAIL}  (password: ${DEFAULT_PASSWORD})`);
  console.log(`Project  : ${PROJECT_NAME}`);
  console.log(`Status   : active`);
  console.log(`Project ID: ${project.id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
