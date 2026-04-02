'use client';

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Media, Update } from "@/lib/domain";
import { supabase } from "@/lib/supabase/client";

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
function MediaTile({
  item,
  signedUrl,
  onPreview,
}: {
  item: Media;
  signedUrl?: string;
  onPreview?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  if (item.type === "image") {
    return (
      <>
        <div
          className="relative rounded-xl overflow-hidden bg-slate-100 cursor-zoom-in group"
          style={{ height: 160 }}
          onClick={() => {
            if (!signedUrl) return;
            onPreview?.();
          }}
        >
          {!loaded && <MediaSkeleton />}
          {signedUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt="Update media"
              className={`w-full h-full object-cover transition-all duration-300 will-change-transform group-hover:scale-110 ${loaded ? "opacity-100" : "opacity-0 absolute inset-0"}`}
              onLoad={() => setLoaded(true)}
            />
          )}
          {/* Hover "zoom" effect (kept inside the tile bounds) */}
          {signedUrl && (
            <div
              aria-hidden
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
              style={{
                backgroundImage: `url(${signedUrl})`,
                backgroundSize: "220% 220%",
                backgroundPosition: "center",
              }}
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

  const imageItems = useMemo(
    () => (mediaItems ?? []).filter((m) => m.type === "image"),
    [mediaItems]
  );

  // Only allow lightbox navigation across images we can actually render.
  const signedImageItems = useMemo(
    () => (imageItems ?? []).filter((m) => Boolean(signedUrls?.[m.id])),
    [imageItems, signedUrls]
  );

  const imageIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < signedImageItems.length; i += 1) map.set(signedImageItems[i].id, i);
    return map;
  }, [signedImageItems]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const activeImage = lightboxIndex == null ? null : signedImageItems[lightboxIndex] ?? null;
  const activeSignedUrl = activeImage ? signedUrls[activeImage.id] : undefined;

  useEffect(() => {
    if (lightboxIndex == null) return;
    if (lightboxIndex < 0 || lightboxIndex >= signedImageItems.length) {
      setLightboxIndex(signedImageItems.length ? 0 : null);
    }
  }, [signedImageItems.length, lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") setLightboxIndex((idx) => (idx == null ? idx : Math.max(0, idx - 1)));
      if (e.key === "ArrowRight") setLightboxIndex((idx) => (idx == null ? idx : Math.min(signedImageItems.length - 1, idx + 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, signedImageItems.length]);

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
              <MediaTile
                key={m.id}
                item={m}
                signedUrl={signedUrls[m.id]}
                onPreview={() => {
                  const idx = imageIndexById.get(m.id);
                  if (idx == null) return;
                  setLightboxIndex(idx);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Elevated lightbox (above drawer + floating button) ── */}
      {activeImage && activeSignedUrl && lightboxIndex != null &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setLightboxIndex(null)}
          >
            <div
              className="relative w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                aria-label="Close preview"
                onClick={() => setLightboxIndex(null)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeSignedUrl}
                alt={activeImage.url}
                className="w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl bg-black/5"
              />

              <div className="mt-3 text-center">
                <div className="text-sm font-bold text-white/95">
                  {(activeImage.url.split("/").pop() ?? "Image")}
                </div>
                {activeImage.created_at && (
                  <div className="text-xs text-white/75 mt-0.5">
                    Uploaded: {formatDateTime(activeImage.created_at)}
                  </div>
                )}

                {signedImageItems.length > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 disabled:hover:bg-white/10 transition"
                      disabled={lightboxIndex <= 0}
                      onClick={() => setLightboxIndex((idx) => (idx == null ? idx : Math.max(0, idx - 1)))}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-white/70">
                      {lightboxIndex + 1} / {signedImageItems.length}
                    </div>
                    <button
                      type="button"
                      className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 disabled:hover:bg-white/10 transition"
                      disabled={lightboxIndex >= signedImageItems.length - 1}
                      onClick={() => setLightboxIndex((idx) => (idx == null ? idx : Math.min(signedImageItems.length - 1, idx + 1)))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
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
      try {
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        if (!accessToken) return;

        const res = await fetch("/api/media/signed-urls", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            media: (media ?? []).map((m) => ({
              id: m.id,
              url: m.url,
              project_id: m.project_id,
            })),
          }),
        });

        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setSignedByMediaId((json?.signedByMediaId ?? {}) as Record<string, string>);
      } catch {
        // If signing fails, media tiles will just stay blank (no crash).
      }
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