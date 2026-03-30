'use client';

import { useEffect } from "react";

type SwaggerWindow = Window & {
  SwaggerUIBundle?: (config: {
    url: string;
    dom_id: string;
    presets?: unknown[];
    layout?: string;
    deepLinking?: boolean;
  }) => void;
  SwaggerUIStandalonePreset?: unknown;
};

export default function ApiDocsPage() {
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
    script.onload = () => {
      if (cancelled) return;
      const win = window as SwaggerWindow;
      if (!win.SwaggerUIBundle) return;

      win.SwaggerUIBundle({
        url: "/api-docs/spec",
        dom_id: "#swagger-ui",
        deepLinking: true,
        layout: "BaseLayout",
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

