'use client';

import { useState } from "react";
import type { Query, QueryReply } from "@/lib/domain";

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function QueryThreadUI({
  query,
  replies,
  senderId,
  canReply,
  canClose,
  onSendReply,
  onClose,
}: {
  query: Query;
  replies: QueryReply[];
  senderId: string;
  canReply: boolean;
  canClose: boolean;
  onSendReply: (message: string) => Promise<void> | void;
  onClose: () => Promise<void> | void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">Query</div>
          <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{query.message}</div>
          <div className="text-xs text-slate-500 mt-1">
            Created {formatDateTime(query.created_at)} • Status: {query.status}
          </div>
        </div>

        {canClose && query.status === "open" ? (
          <button
            type="button"
            onClick={async () => {
              await onClose();
            }}
            className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {replies.length ? (
          replies
            .slice()
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((r) => (
              <div key={r.id} className={r.sender_id === senderId ? "text-right" : "text-left"}>
                <div
                  className={
                    r.sender_id === senderId
                      ? "inline-block rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-950 max-w-[85%]"
                      : "inline-block rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 max-w-[85%]"
                  }
                >
                  <div className="whitespace-pre-wrap">{r.message}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{formatDateTime(r.created_at)}</div>
                </div>
              </div>
            ))
        ) : (
          <div className="text-sm text-slate-500">No replies yet.</div>
        )}
      </div>

      {canReply ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = message.trim();
            if (!trimmed) return;
            setSending(true);
            try {
              await onSendReply(trimmed);
              setMessage("");
            } finally {
              setSending(false);
            }
          }}
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

