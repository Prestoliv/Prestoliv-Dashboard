import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(WEB_ROOT, "..");

/** @type {string[]} */
export const ENV_FILE_CANDIDATES = [
  resolve(WEB_ROOT, ".env.local"),
  resolve(WEB_ROOT, ".env"),
  resolve(REPO_ROOT, ".env.local"),
  resolve(REPO_ROOT, ".env"),
];

function parseEnvFile(filePath) {
  const text = readFileSync(filePath, "utf8");
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

/** Load first existing env files (later files do not override earlier keys). */
export function loadEnvFiles() {
  /** @type {string[]} */
  const loaded = [];
  for (const filePath of ENV_FILE_CANDIDATES) {
    if (!existsSync(filePath)) continue;
    parseEnvFile(filePath);
    loaded.push(filePath);
  }
  return loaded;
}

export function requireSupabaseServiceEnv() {
  const loaded = loadEnvFiles();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (url && serviceKey) {
    return { url, serviceKey, loaded };
  }

  const tried =
    loaded.length > 0
      ? loaded.map((p) => `  - ${p} (loaded)`).join("\n")
      : ENV_FILE_CANDIDATES.map((p) => `  - ${p}`).join("\n");

  console.error(
    "Missing Supabase credentials.\n\n" +
      "Add these to web/.env or web/.env.local:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret\n\n" +
      "Get values from: Supabase Dashboard → Project Settings → API\n" +
      "  - Project URL → NEXT_PUBLIC_SUPABASE_URL\n" +
      "  - service_role (secret) → SUPABASE_SERVICE_ROLE_KEY\n\n" +
      "Quick setup:\n" +
      "  cp web/.env.example web/.env\n" +
      "  # then edit web/.env with your keys\n\n" +
      "Env files checked:\n" +
      tried
  );
  process.exit(1);
}
