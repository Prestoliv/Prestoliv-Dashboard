/**
 * Empty the project-media Supabase Storage bucket (recursive).
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in web/.env.local
 *
 * Usage: cd web && npm run reset:storage
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUCKET = "project-media";

function loadEnvFile() {
  const envPath = resolve(__dirname, "../.env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile();

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** @param {string} prefix */
async function collectPaths(prefix = "") {
  const { data: items, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;

  /** @type {string[]} */
  const paths = [];

  for (const item of items ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    // Files have metadata.id; folder placeholders do not.
    if (item.id) {
      paths.push(path);
    } else {
      const nested = await collectPaths(path);
      paths.push(...nested);
    }
  }
  return paths;
}

async function main() {
  console.log(`Listing objects in bucket "${BUCKET}"…`);
  const paths = await collectPaths();
  if (paths.length === 0) {
    console.log("Bucket is already empty (or bucket does not exist).");
    return;
  }

  console.log(`Removing ${paths.length} file(s)…`);
  const batchSize = 100;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw error;
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
