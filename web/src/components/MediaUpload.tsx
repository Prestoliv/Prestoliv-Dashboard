'use client';

import { useMemo, useState } from "react";
import { supabase, projectMediaBucket } from "@/lib/supabase/client";
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

  const bucket = useMemo(() => projectMediaBucket(), []);

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
              const uploaded: Media[] = [];
              for (const file of files) {
                const type = detectMediaType(file);
                const fileName = file.name.replace(/\s+/g, "_");
                const path = `projects/${projectId}/updates/${updateId}/${Date.now()}_${fileName}`;

                const { error: uploadError } = await supabase.storage
                  .from(bucket)
                  .upload(path, file, {
                    contentType: file.type || undefined,
                    upsert: false,
                  });
                if (uploadError) throw uploadError;

                const { data: inserted, error: insertError } = await supabase
                  .from("media")
                  .insert({
                    project_id: projectId,
                    update_id: updateId,
                    url: path,
                    type,
                  })
                  .select("*")
                  .single();

                if (insertError) throw insertError;
                uploaded.push(inserted as unknown as Media);
              }

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

