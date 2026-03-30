'use client';

import { useEffect, useMemo, useState } from "react";
import type { Media, Update } from "@/lib/domain";
import { supabase, projectMediaBucket } from "@/lib/supabase/client";

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function UpdateFeed({
  updates,
  media,
}: {
  updates: Update[];
  media: Media[];
}) {
  const [signedByMediaId, setSignedByMediaId] = useState<Record<string, string>>({});

  const mediaByUpdateId = useMemo(() => {
    const map = new Map<string, Media[]>();
    for (const item of media ?? []) {
      if (!item.update_id) continue;
      const arr = map.get(item.update_id) ?? [];
      arr.push(item);
      map.set(item.update_id, arr);
    }
    return map;
  }, [media]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bucket = projectMediaBucket();
      const entries: Array<[string, string]> = [];

      for (const item of media ?? []) {
        if (!item.url) continue;
        try {
          const { data } = await supabase.storage.from(bucket).createSignedUrl(item.url, 60 * 60);
          if (data?.signedUrl) entries.push([item.id, data.signedUrl]);
        } catch {
          // ignore per-file errors
        }
      }

      if (cancelled) return;
      setSignedByMediaId((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) next[id] = url;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [media]);

  const sorted = [...updates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (!sorted.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No updates yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map((u) => {
        const items = mediaByUpdateId.get(u.id) ?? [];
        return (
          <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold text-slate-900">Update</div>
              <div className="text-xs text-slate-500">{formatDateTime(u.created_at)}</div>
            </div>

            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{u.text}</div>

            {items.length ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {items.map((m) => {
                  const signedUrl = signedByMediaId[m.id];
                  const key = `${m.id}-${m.url}`;
                  if (m.type === "image") {
                    return (
                      <div key={key} className="rounded-md border border-slate-200 overflow-hidden bg-slate-50">
                        {signedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={signedUrl} alt="Update media" className="w-full h-40 object-cover" />
                        ) : (
                          <div className="p-3 text-xs text-slate-500">Loading media...</div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={key}
                      className="rounded-md border border-slate-200 overflow-hidden bg-slate-50 col-span-2"
                    >
                      {signedUrl ? (
                        <video src={signedUrl} controls className="w-full max-h-96" />
                      ) : (
                        <div className="p-3 text-xs text-slate-500">Loading video...</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

