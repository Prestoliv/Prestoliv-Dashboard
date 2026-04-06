'use client';

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function hasOAuthCallbackInUrl(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash;
  const q = window.location.search;
  return (
    h.includes("access_token") ||
    h.includes("error") ||
    q.includes("code=")
  );
}

/**
 * OAuth often returns tokens in the URL hash (implicit grant). `@supabase/ssr` uses
 * `flowType: "pkce"`, which *rejects* implicit hash URLs — so we parse the hash with a
 * short-lived implicit client, then copy the session onto the shared cookie client.
 */
export default function OAuthProfileBridgePage() {
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in…");
  const navigated = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function go(uid: string) {
      if (navigated.current) return;
      navigated.current = true;
      router.replace(`/at/profile?uid=${encodeURIComponent(uid)}`);
    }

    async function run() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      if (!url || !anon) {
        setStatus("Missing Supabase configuration.");
        return;
      }

      const incoming = hasOAuthCallbackInUrl();
      const hasImplicitHash =
        typeof window !== "undefined" &&
        (window.location.hash.includes("access_token") || window.location.hash.includes("error"));

      // 1) Implicit grant in hash — requires flowType "implicit" (not the SSR client's pkce)
      if (hasImplicitHash) {
        const { createClient } = await import("@supabase/supabase-js");
        const parseClient = createClient(url, anon, {
          auth: {
            flowType: "implicit",
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: true,
            storageKey: "sb-implicit-callback-parse",
          },
        });

        const { data: parsed, error: parseErr } = await parseClient.auth.getSession();
        if (cancelled) return;

        if (parseErr) {
          setStatus(parseErr.message);
          return;
        }

        if (parsed.session?.user) {
          const { supabase } = await import("@/lib/supabase/client");
          const { error: setErr } = await supabase.auth.setSession({
            access_token: parsed.session.access_token,
            refresh_token: parsed.session.refresh_token,
          });
          if (cancelled) return;
          if (setErr) {
            setStatus(setErr.message);
            return;
          }
          go(parsed.session.user.id);
          return;
        }
      }

      // 2) PKCE (?code=) or existing cookie session — shared client
      const { supabase } = await import("@/lib/supabase/client");
      const { data: existing, error: sessErr } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessErr) {
        setStatus(sessErr.message);
        return;
      }

      const id = existing.session?.user?.id;
      if (id) {
        go(id);
        return;
      }

      if (!incoming) {
        setStatus("Redirecting…");
        router.replace("/login");
        return;
      }

      setStatus("Could not complete sign-in. Try again from the login page.");
    }

    void run();

    const t = window.setTimeout(() => {
      if (cancelled || navigated.current) return;
      void run();
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3 px-4"
      style={{ background: "#f0f7f9", color: "#0c4a5e" }}
    >
      <p className="text-sm font-medium">{status}</p>
    </div>
  );
}
