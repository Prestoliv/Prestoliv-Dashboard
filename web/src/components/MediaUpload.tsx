'use client';

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { MediaType } from "@/lib/types";
import type { Media } from "@/lib/domain";

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image";
  return "video";
}

export function MediaUpload({
  projectId,
  updateId,
  onUploaded,
  disabled,
}: {
  projectId: string;
  updateId: string;
  onUploaded?: (media: Media[]) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-900">Add media (optional)</div>
      <div className="text-sm text-slate-600 mt-1">
        Upload images/videos to the `project-media` bucket.
      </div>

      <div className="mt-3">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={disabled || uploading}
          onChange={async (e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            if (!files.length) return;
            setError(null);
            setUploading(true);
            try {
              const sessionRes = await supabase.auth.getSession();
              const accessToken = sessionRes.data.session?.access_token;
              if (!accessToken) throw new Error("Not authenticated");

              const form = new FormData();
              form.set("projectId", projectId);
              form.set("updateId", updateId);
              for (const file of files) form.append("files", file);

              const res = await fetch("/api/projects/upload-media", {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}` },
                body: form,
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json?.error ?? "Upload failed");

              const uploaded = (json?.media ?? []) as Media[];
              onUploaded?.(uploaded);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload failed");
            } finally {
              setUploading(false);
              if (e.target) e.target.value = "";
            }
          }}
          className="block w-full text-sm text-slate-600"
        />
      </div>

      {error ? (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          {error}
        </div>
      ) : null}

      {uploading ? <div className="mt-3 text-sm text-slate-600">Uploading...</div> : null}
    </div>
  );
}

