'use client';

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Avoid throwing during `next build` when env vars aren't injected yet.
if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

function createMissingSupabaseStub() {
  const err = new Error(
    "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );

  // Proxy allows arbitrary chained calls (e.g. `supabase.from(...).select(...)`) without
  // crashing during import/build, while still failing loudly when used at runtime.
  const stub: any = new Proxy(function stubFn() {}, {
    get() {
      return stub;
    },
    apply() {
      throw err;
    },
  });

  return stub;
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : createMissingSupabaseStub();

export function projectMediaBucket() {
  return "project-media";
}

