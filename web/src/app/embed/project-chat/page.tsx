'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Ctx = {
  token_id: string;
  project_id: string;
  project_name: string;
  pm_id: string | null;
  pm_name: string | null;
};

type Msg = {
  id: string;
  created_at: string;
  sender_name: string;
  sender_email: string | null;
  message: string;
};

function useTokenFromUrl() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const u = new URL(window.location.href);
    setToken(u.searchParams.get("token"));
  }, []);
  return token;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function ProjectChatEmbedPage() {
  const token = useTokenFromUrl();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");

  async function loadAll(t: string) {
    setLoading(true);
    setError(null);
    try {
      const { data: cData, error: cErr } = await supabase.rpc("get_project_chat_context", { p_token: t });
      if (cErr) throw cErr;
      const row = (Array.isArray(cData) ? cData[0] : cData) as Ctx | undefined;
      if (!row?.project_id) throw new Error("Invalid chat link");
      setCtx(row);

      const { data: mData, error: mErr } = await supabase.rpc("list_project_chat_messages", { p_token: t, p_limit: 80 });
      if (mErr) throw mErr;
      setMessages((mData ?? []) as Msg[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat");
      setCtx(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  // Initial load + polling
  useEffect(() => {
    if (!token) return;
    loadAll(token);
    const iv = window.setInterval(() => loadAll(token), 5000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const title = useMemo(() => {
    if (!ctx) return "Project chat";
    return ctx.project_name ? `Chat • ${ctx.project_name}` : "Project chat";
  }, [ctx]);

  return (
    <div className="min-h-[520px] w-full bg-white">
      <div className="mx-auto max-w-md border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-br from-teal-50 to-cyan-50">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {ctx?.pm_name ? `PM: ${ctx.pm_name}` : "Send a message to the project team"}
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 border-b border-red-100 bg-red-50 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="p-4">
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center">
                <p className="text-sm font-semibold text-slate-700">No messages yet</p>
                <p className="text-xs text-slate-500 mt-1">Start the conversation below.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {m.sender_name}
                    </p>
                    <p className="text-[10px] text-slate-400 whitespace-nowrap" title={m.created_at}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                  <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Type your message…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              disabled={!token || sending || !name.trim() || !text.trim()}
              onClick={async () => {
                if (!token) return;
                setSending(true);
                setError(null);
                try {
                  const { error: sErr } = await supabase.rpc("send_project_chat_message", {
                    p_token: token,
                    p_sender_name: name.trim(),
                    p_sender_email: email.trim(),
                    p_message: text.trim(),
                  });
                  if (sErr) throw sErr;
                  setText("");
                  await loadAll(token);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to send");
                } finally {
                  setSending(false);
                }
              }}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
            >
              {sending ? "Sending…" : "Send message"}
            </button>

            <p className="text-[10px] text-slate-400 text-center">
              Embedded chat by Prestoliv
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

