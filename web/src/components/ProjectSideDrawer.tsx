'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ProjectDetailView } from "@/components/ProjectDetailView";

export function ProjectSideDrawer({
  projectId,
  open,
  onClose,
  readOnly = false,
}: {
  projectId: string | null;
  open: boolean;
  onClose: () => void;
  /** Portal mode: view-only (no "open full page", no edit/create actions). */
  readOnly?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !projectId) return;
    setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open || !projectId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
        aria-label="Close project details"
        onClick={onClose}
      />

      <div
        className={`relative flex h-full w-full max-w-[min(100vw,640px)] flex-col border-l border-slate-200/80 bg-[#f0f7f9] shadow-2xl transition-transform duration-300 ease-out sm:max-w-xl lg:max-w-2xl xl:max-w-3xl ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/95 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project</p>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <Link
                href={`/projects/${projectId}`}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
              >
                Open full page
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ProjectDetailView
            key={projectId}
            projectId={projectId}
            variant="drawer"
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
