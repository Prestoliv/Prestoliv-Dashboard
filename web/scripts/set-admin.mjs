/**
 * Create or update the bootstrap admin account in Supabase Auth + profiles.
 *
 *   cd web && npm run set-admin
 *
 * Defaults: hello@prestoliv.com / Presto@123
 * Override: ADMIN_EMAIL, ADMIN_PASSWORD in web/.env
 */

import { createClient } from "@supabase/supabase-js";
import { requireSupabaseServiceEnv } from "./load-env.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() || "hello@prestoliv.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || "Presto@123";
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || "Prestoliv Admin";
const LEGACY_ADMIN_EMAIL = "admin@prestoliv.com";

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

async function upsertAdminProfile(userId) {
  const row = {
    id: userId,
    email: ADMIN_EMAIL,
    role: "admin",
    name: ADMIN_NAME,
    full_name: ADMIN_NAME,
  };
  const { error: pErr } = await sb.from("profiles").upsert(row, { onConflict: "id" });
  if (pErr) throw new Error(`profiles: ${pErr.message}`);
  const { error: uErr } = await sb
    .from("users")
    .upsert({ id: userId, role: "admin", name: ADMIN_NAME }, { onConflict: "id" });
  if (uErr) console.warn("users upsert (optional):", uErr.message);
}

async function main() {
  console.log(`Setting up admin: ${ADMIN_EMAIL}\n`);

  let user = await findUserByEmail(ADMIN_EMAIL);

  if (!user) {
    const legacy = await findUserByEmail(LEGACY_ADMIN_EMAIL);
    if (legacy) {
      console.log(`Migrating ${LEGACY_ADMIN_EMAIL} → ${ADMIN_EMAIL}`);
      const { data, error } = await sb.auth.admin.updateUserById(legacy.id, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { name: ADMIN_NAME, role: "admin" },
      });
      if (error) throw error;
      user = data.user;
    }
  }

  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: ADMIN_NAME, role: "admin" },
    });
    if (error) {
      throw new Error(
        `createUser failed: ${error.message}${error.status ? ` (${error.status})` : ""}. ` +
          `If an old admin exists, run migration 0020 or migrate email in Supabase Dashboard.`
      );
    }
    user = data.user;
    console.log("Created auth user.");
  } else {
    const { data, error } = await sb.auth.admin.updateUserById(user.id, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: ADMIN_NAME, role: "admin" },
    });
    if (error) throw error;
    user = data.user ?? user;
    console.log("Updated auth user (email/password/metadata).");
  }

  if (!user?.id) throw new Error("No user id returned");
  await upsertAdminProfile(user.id);

  console.log("\n--- Admin ready ---");
  console.log(`Email   : ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log("\nSign in at /login with these credentials.");
  console.log("Also run migration 0020_admin_bootstrap_hello_email.sql in Supabase if not applied yet.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
