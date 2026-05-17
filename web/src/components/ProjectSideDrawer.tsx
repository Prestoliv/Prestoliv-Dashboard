'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Milestone, Project, Query } from "@/lib/domain";
import { ProjectDetailView } from "@/components/ProjectDetailView";
import { PortalProjectPanel } from "@/components/PortalProjectPanel";

export function ProjectSideDrawer({
  projectId,
  open,
  onClose,
  readOnly = false,
  portalProject,
  portalMilestones,
  portalQueries,
}: {
  projectId: string | null;
  open: boolean;
  onClose: () => void;
  /** Portal mode: view-only (no "open full page", no edit/create actions). */
  readOnly?: boolean;
  /** When set, renders portal panel from preloaded bundle data (no Supabase auth). */
  portalProject?: Project | null;
  portalMilestones?: Milestone[];
  portalQueries?: Query[];
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const usePortalPanel = readOnly;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(true), 16);
    return () => window.clearTimeout(id);
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
    <div
      className="fixed inset-0 z-[200] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-drawer-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        aria-label="Close project details"
        onClick={onClose}
      />

      <aside
        className="relative flex h-full w-full max-w-full flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5 sm:py-4">
          <div>
            <p
              id="project-drawer-title"
              className="text-[10px] font-semibold uppercase tracking-widest text-teal-700"
            >
              Project
            </p>
            <p className="mt-0.5 truncate text-base font-semibold text-slate-900">
              {portalProject?.name ?? "Project details"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <Link
                href={`/projects/${projectId}`}
                className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800"
              >
                Full page
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50">
          {usePortalPanel ? (
            portalProject ? (
              <PortalProjectPanel
                project={portalProject}
                milestones={portalMilestones ?? []}
                queries={portalQueries ?? []}
              />
            ) : (
              <p className="p-6 text-sm text-slate-500">Project not found.</p>
            )
          ) : (
            <ProjectDetailView
              key={projectId}
              projectId={projectId}
              variant="drawer"
              readOnly={readOnly}
            />
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
