import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase URL (same project as NEXT_PUBLIC_SUPABASE_URL).
 * Next.js loads NEXT_PUBLIC_* for the server too; SUPABASE_URL is a common alias on hosts like Render.
 */
export function getSupabaseServerUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  );
}

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

export function createServiceSupabaseClient() {
  const url = getSupabaseServerUrl();
  const serviceKey = getSupabaseServiceRoleKey();

  if (!url) {
    throw new Error(
      "Missing Supabase URL on server. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in web/.env."
    );
  }
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to web/.env for local dev: Supabase Dashboard → Project Settings → API → service_role (secret). Required for /api/at/bundle — never commit this key or use it in the browser."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
