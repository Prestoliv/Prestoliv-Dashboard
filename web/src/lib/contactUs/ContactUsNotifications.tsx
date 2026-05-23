'use client';

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import type { ContactUsRow } from "@/lib/contactUs";
import type { UserRole } from "@/lib/types";

export type ContactUsToast = {
  id: string;
  name: string;
  createdAt: string;
};

type ContactUsNotificationsValue = {
  unseenCount: number;
  refreshUnseen: () => Promise<void>;
  adjustUnseen: (delta: number) => void;
};

const ContactUsNotificationsContext = createContext<ContactUsNotificationsValue | null>(null);

export function useContactUsNotifications() {
  const ctx = useContext(ContactUsNotificationsContext);
  if (!ctx) {
    throw new Error("useContactUsNotifications must be used within ContactUsNotificationsProvider");
  }
  return ctx;
}

export function useContactUsNotificationsOptional() {
  return useContext(ContactUsNotificationsContext);
}

function ContactUsToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ContactUsToast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-80 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-xl border border-teal-200 bg-white shadow-lg px-4 py-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">New contact request</p>
              <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">{toast.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {new Date(toast.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <Link
            href="/admin/contact-us"
            className="mt-2 inline-block text-xs font-semibold text-teal-700 hover:text-teal-900"
          >
            View in Contact Us →
          </Link>
        </div>
      ))}
    </div>
  );
}

export function ContactUsNotificationsProvider({
  role,
  children,
}: {
  role: UserRole | null;
  children: ReactNode;
}) {
  const isAdmin = role === "admin";
  const [unseenCount, setUnseenCount] = useState(0);
  const [toasts, setToasts] = useState<ContactUsToast[]>([]);

  const refreshUnseen = useCallback(async () => {
    if (!isAdmin) {
      setUnseenCount(0);
      return;
    }
    const { count, error } = await supabase
      .from("contact_us")
      .select("id", { count: "exact", head: true })
      .is("seen_at", null);

    if (!error && count != null) {
      setUnseenCount(count);
    }
  }, [isAdmin]);

  const adjustUnseen = useCallback((delta: number) => {
    setUnseenCount((c) => Math.max(0, c + delta));
  }, []);

  const pushToast = useCallback((row: Pick<ContactUsRow, "id" | "name" | "created_at">) => {
    setToasts((prev) => {
      if (prev.some((t) => t.id === row.id)) return prev;
      return [
        { id: row.id, name: row.name, createdAt: row.created_at },
        ...prev,
      ].slice(0, 5);
    });
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== row.id));
    }, 8000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    refreshUnseen();
  }, [refreshUnseen]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("contact_us:admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_us" },
        (payload) => {
          const row = payload.new as ContactUsRow;
          setUnseenCount((c) => c + 1);
          pushToast(row);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contact_us" },
        () => {
          refreshUnseen();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "contact_us" },
        () => {
          refreshUnseen();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, pushToast, refreshUnseen]);

  const value = useMemo(
    () => ({ unseenCount, refreshUnseen, adjustUnseen }),
    [unseenCount, refreshUnseen, adjustUnseen]
  );

  return (
    <ContactUsNotificationsContext.Provider value={value}>
      {children}
      {isAdmin && (
        <ContactUsToastStack toasts={toasts} onDismiss={dismissToast} />
      )}
    </ContactUsNotificationsContext.Provider>
  );
}
