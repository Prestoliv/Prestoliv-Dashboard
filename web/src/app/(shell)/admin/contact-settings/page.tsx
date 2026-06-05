'use client';

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import {
  buildWhatsAppUrl,
  DEFAULT_CONTACT_SETTINGS,
  fetchContactSettings,
  saveContactSettings,
  type ContactSettings,
} from "@/lib/contact/contactSettings";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 " +
  "outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

const btnPrimary =
  "rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 " +
  "hover:shadow-md disabled:cursor-not-allowed";

export default function AdminContactSettingsPage() {
  const [settings, setSettings] = useState<ContactSettings>(DEFAULT_CONTACT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await fetchContactSettings();
      setSettings(cfg);
    } catch (e) {
      setError((e as Error).message ?? "Failed to load contact settings");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    const digits = settings.whatsapp_number.replace(/\D/g, "");
    if (!digits) {
      setError("WhatsApp number is required (digits with country code, e.g. 919849078569)");
      return;
    }
    if (!settings.phone_e164.trim()) {
      setError("Phone (tel link) is required");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await saveContactSettings(settings);
      await load();
      flash("Contact settings saved — marketing site will pick this up within a few minutes");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const previewUrl = buildWhatsAppUrl(settings.whatsapp_number);

  return (
    <RequireAuth allowedRoles={["admin"]}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Website contact</h1>
          <p className="text-sm text-slate-500 mt-1">
            Phone and WhatsApp shown on{" "}
            <span className="font-mono text-teal-700">prestoliv.com</span> (footer, sticky
            button). Stored in Supabase{" "}
            <span className="font-mono text-slate-600">app_settings.contact_settings</span>.
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <p className="text-sm font-bold text-slate-800">WhatsApp</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Sticky chat button on all marketing pages
            </p>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="p-6 space-y-5">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.whatsapp_enabled}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, whatsapp_enabled: e.target.checked }))
                  }
                />
                Show WhatsApp sticky button on website
              </label>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  WhatsApp number (digits only, with country code)
                </p>
                <input
                  className={inputCls}
                  value={settings.whatsapp_number}
                  placeholder="919849078569"
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      whatsapp_number: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Preview link:{" "}
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-teal-700 hover:underline"
                  >
                    {previewUrl}
                  </a>
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <p className="text-sm font-bold text-slate-800">Footer phone</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Display label and click-to-call link in site footer
            </p>
          </div>

          {!loading && (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Display label
                </p>
                <input
                  className={inputCls}
                  value={settings.phone_display}
                  placeholder="+91 98490 78569"
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, phone_display: e.target.value }))
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tel link (E.164)
                </p>
                <input
                  className={inputCls}
                  value={settings.phone_e164}
                  placeholder="+919849078569"
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, phone_e164: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          <div className="px-6 pb-6">
            <button
              type="button"
              disabled={busy || loading}
              className={btnPrimary}
              style={{ background: "linear-gradient(135deg, #0891b2, #0d9488)" }}
              onClick={handleSave}
            >
              Save contact settings
            </button>
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}
