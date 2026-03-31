'use client';

import { useEffect, useMemo, useState } from "react";
import type { Media, Update } from "@/lib/domain";
import { supabase, projectMediaBucket } from "@/lib/supabase/client";

function formatRelativeTime(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return "Just now";
    if (mins < 60)  return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7)   return `${days} day${days !== 1 ? "s" : ""} ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return iso; }
}

/* ── Media skeleton ──────────────────────────────────────────────── */
function MediaSkeleton() {
  return (
    <div className="rounded-xl bg-slate-100 animate-pulse flex items-center justify-center" style={{ height: 160 }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-slate-300">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

/* ── Media tile ──────────────────────────────────────────────────── */
function MediaTile({ item, signedUrl }: { item: Media; signedUrl?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  if (item.type === "image") {
    return (
      <>
        <div
          className="relative rounded-xl overflow-hidden bg-slate-100 cursor-zoom-in group"
          style={{ height: 160 }}
          onClick={() => signedUrl && setLightbox(true)}
        >
          {!loaded && <MediaSkeleton />}
          {signedUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt="Update media"
              className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.02] ${loaded ? "opacity-100" : "opacity-0 absolute inset-0"}`}
              onLoad={() => setLoaded(true)}
            />
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40 rounded-full p-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v3M10 2h3a1 1 0 011 1v3M2 10v3a1 1 0 001 1h3M10 14h3a1 1 0 001-1v-3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {lightbox && signedUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setLightbox(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signedUrl} alt="Full size" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
            <button
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              onClick={() => setLightbox(false)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="col-span-2 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
      {signedUrl ? (
        <video src={signedUrl} controls className="w-full max-h-80 bg-black" />
      ) : (
        <div className="rounded-xl bg-slate-100 animate-pulse flex items-center justify-center" style={{ height: 120 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-slate-300">
            <path d="M15 10l5-3v10l-5-3V10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <rect x="2" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
      )}
    </div>
  );
}

/* ── Update card ──────────────────────────────────────────────────── */
function UpdateCard({ update, mediaItems, signedUrls }: {
  update: Update;
  mediaItems: Media[];
  signedUrls: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const isLong = update.text.length > 280;
  const truncated = isLong && !expanded;

  return (
    <article className="rounded-2xl border border-slate-100 bg-white overflow-hidden
                        hover:border-slate-200 transition-colors duration-200">
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-3 border-b border-slate-50">
        {/* PM avatar */}
        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
          style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}>
          PM
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Project Update</p>
            <time
              title={formatDateTime(update.created_at)}
              className="text-[11px] text-slate-400 whitespace-nowrap"
            >
              {formatRelativeTime(update.created_at)}
            </time>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(update.created_at)}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <div className={`relative overflow-hidden transition-all duration-300 ${truncated ? "" : ""}`}
          style={truncated ? { maxHeight: "4.5rem" } : {}}>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {update.text}
          </p>
          {truncated && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
          )}
        </div>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="mt-2 text-[12px] font-medium text-teal-600 hover:text-teal-700 transition-colors"
          >
            {expanded ? "Show less ↑" : "Read more ↓"}
          </button>
        )}

        {/* Media grid */}
        {mediaItems.length > 0 && (
          <div className={`mt-4 grid gap-2 ${mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {mediaItems.map(m => (
              <MediaTile key={m.id} item={m} signedUrl={signedUrls[m.id]} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Main export ──────────────────────────────────────────────────── */
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
      const entries: [string, string][] = [];
      for (const item of media ?? []) {
        if (!item.url) continue;
        try {
          const { data } = await supabase.storage.from(bucket).createSignedUrl(item.url, 60 * 60);
          if (data?.signedUrl) entries.push([item.id, data.signedUrl]);
        } catch { /* skip */ }
      }
      if (cancelled) return;
      setSignedByMediaId(prev => {
        const next = { ...prev };
        for (const [id, url] of entries) next[id] = url;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [media]);

  const sorted = [...updates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-slate-200">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-slate-300 mb-3">
          <rect x="5" y="8" width="30" height="24" rx="4" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 16h16M12 22h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M5 13h30" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <p className="text-sm font-medium text-slate-400">No updates yet</p>
        <p className="text-xs text-slate-400 mt-1">Updates will appear here once posted</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map(u => (
        <UpdateCard
          key={u.id}
          update={u}
          mediaItems={mediaByUpdateId.get(u.id) ?? []}
          signedUrls={signedByMediaId}
        />
      ))}
    </div>
  );
}