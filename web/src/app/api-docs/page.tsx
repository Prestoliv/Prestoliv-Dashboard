'use client';

import { useEffect } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase/client";

type SwaggerRequest = { headers?: Record<string, string> };

type SwaggerWindow = Window & {
  SwaggerUIBundle?: (config: {
    url: string;
    dom_id: string;
    presets?: unknown[];
    layout?: string;
    deepLinking?: boolean;
    requestInterceptor?: (req: SwaggerRequest) => SwaggerRequest;
  }) => void;
  SwaggerUIStandalonePreset?: unknown;
};

function ApiDocsUI() {
  useEffect(() => {
    let cancelled = false;
    const doc = window.document;

    const css = doc.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    doc.head.appendChild(css);

    const script = doc.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.async = true;
    script.onload = async () => {
      if (cancelled) return;
      const win = window as SwaggerWindow;
      if (!win.SwaggerUIBundle) return;

      const sessionRes = await supabase.auth.getSession();
      const accessToken = sessionRes.data.session?.access_token;
      if (cancelled || !accessToken) return;

      win.SwaggerUIBundle({
        url: "/api-docs/spec",
        dom_id: "#swagger-ui",
        deepLinking: true,
        layout: "BaseLayout",
        requestInterceptor: (req) => {
          req.headers = { ...req.headers, Authorization: `Bearer ${accessToken}` };
          return req;
        },
      });
    };
    doc.body.appendChild(script);

    return () => {
      cancelled = true;
      script.remove();
      css.remove();
    };
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div id="swagger-ui" />
    </main>
  );
}

export default function ApiDocsPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <ApiDocsUI />
    </RequireAuth>
  );
}

