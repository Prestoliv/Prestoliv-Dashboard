'use client';

import { useEffect, useRef, useState } from "react";
import type { Query, QueryReply } from "@/lib/domain";

function formatRelativeTime(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return "just now";
    if (mins < 60)  return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7)   return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return iso; }
}

function ReceiptMarks({ read }: { read: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums" title={read ? "Seen" : "Delivered"}>
      <span className="text-[11px] leading-none opacity-90">✓</span>
      {read && <span className="text-[11px] leading-none -ml-1.5 opacity-90">✓</span>}
    </span>
  );
}

/* ── Message bubble ─────────────────────────────────────────────── */
function MessageBubble({
  reply, isMine, index, lastReadByPeerAt, showReceipts,
}: {
  reply: QueryReply; isMine: boolean; index: number;
  lastReadByPeerAt?: string | null;
  showReceipts?: boolean;
}) {
  const read =
    !!lastReadByPeerAt &&
    new Date(lastReadByPeerAt).getTime() >= new Date(reply.created_at).getTime() - 500;

  return (
    <div
      className={`flex gap-2.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}
      style={{
        animationName: "slideInMsg",
        animationDuration: "0.3s",
        animationTimingFunction: "cubic-bezier(0.4,0,0.2,1)",
        animationDelay: `${Math.min(index * 0.04, 0.25)}s`,
        animationFillMode: "both",
      }}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 self-end mb-1 ${
        isMine
          ? "bg-gradient-to-br from-teal-400 to-cyan-500 text-white"
          : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600"
      }`}>
        {isMine ? "Me" : "PM"}
      </div>

      {/* Bubble */}
      <div className={`group max-w-[78%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`
          relative rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isMine
            ? "rounded-br-sm text-white shadow-sm"
            : "rounded-bl-sm bg-slate-50 text-slate-800 border border-slate-100"
          }
        `}
          style={isMine ? { background: "linear-gradient(135deg,#0891b2,#0d9488)" } : {}}
        >
          <p className="whitespace-pre-wrap break-words">{reply.message}</p>
          {isMine && showReceipts && (
            <div className="flex justify-end mt-1">
              <span className={`text-[10px] ${isMine ? "text-white/80" : ""}`}>
                <ReceiptMarks read={read} />
              </span>
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-400 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          title={formatDateTime(reply.created_at)}>
          {formatRelativeTime(reply.created_at)}
        </span>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 h-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 160}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export function QueryThreadUI({
  query,
  replies,
  senderId,
  canReply,
  canClose,
  onSendReply,
  onClose,
  compact,
  lastReadByPeerAt,
  peerIsTyping,
  peerTypingLabel,
  onTypingActivity,
  showReceipts = true,
}: {
  query: Query;
  replies: QueryReply[];
  senderId: string;
  canReply: boolean;
  canClose: boolean;
  onSendReply: (message: string) => Promise<void> | void;
  onClose: () => Promise<void> | void;
  /** Tighter layout for floating widget / small panels */
  compact?: boolean;
  /** Peer read cursor: team last read (for customer) or customer last read (for team). Used for ✓✓. */
  lastReadByPeerAt?: string | null;
  peerIsTyping?: boolean;
  peerTypingLabel?: string;
  onTypingActivity?: (typing: boolean) => void;
  showReceipts?: boolean;
}) {
  const [message, setMessage]   = useState("");
  const [sending, setSending]   = useState(false);
  const [closing, setClosing]   = useState(false);
  const scrollRef               = useRef<HTMLDivElement>(null);
  const textRef                 = useRef<HTMLTextAreaElement>(null);
  const typingIdleRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isClosed = query.status === "closed";

  /* Auto-scroll to bottom on new replies */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies.length]);

  /* Auto-resize textarea + typing signal */
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    onTypingActivity?.(true);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    typingIdleRef.current = setTimeout(() => onTypingActivity?.(false), 2200);
  }

  const sorted = [...replies].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <>
      <style>{`
        @keyframes slideInMsg {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex flex-col" style={{ height: "100%", minHeight: compact ? 0 : 380 }}>

        {/* ── Query header card ── */}
        <div className={`rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 ${compact ? "mb-2" : "mb-4"}`}>
          <div className="flex items-start gap-3 justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Original Query</p>
              <p className="text-sm font-medium text-slate-800 leading-relaxed">{query.message}</p>
              <p className="text-[11px] text-slate-400 mt-1.5">{formatDateTime(query.created_at)}</p>
            </div>

            {canClose && !isClosed && (
              <button
                type="button"
                disabled={closing}
                onClick={async () => {
                  setClosing(true);
                  try { await onClose(); }
                  finally { setClosing(false); }
                }}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
                           px-3 py-1.5 text-[11px] font-semibold text-slate-600
                           hover:border-slate-300 hover:bg-slate-50 transition-all duration-150
                           disabled:opacity-50"
              >
                {closing ? (
                  <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin inline-block" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 6a5 5 0 1010 0A5 5 0 001 6z" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 8l4-4M8 8L4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                )}
                Close query
              </button>
            )}

            {isClosed && (
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 6a5 5 0 1010 0A5 5 0 001 6z" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Resolved
              </span>
            )}
          </div>
        </div>

        {/* ── Messages area ── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-4 px-1 py-2 min-h-[200px]"
          style={{
            maxHeight: compact ? 200 : 320,
            scrollbarWidth: "thin",
            scrollbarColor: "#e2e8f0 transparent",
          }}
        >
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="opacity-40">
                <path d="M4 6h24a2 2 0 012 2v14a2 2 0 01-2 2h-7l-5 5-5-5H4a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 13h16M8 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p className="text-sm">No replies yet</p>
              {canReply && !isClosed && (
                <p className="text-xs">Be the first to respond below</p>
              )}
            </div>
          ) : (
            sorted.map((r, i) => (
              <MessageBubble
                key={r.id}
                reply={r}
                isMine={r.sender_id === senderId}
                index={i}
                lastReadByPeerAt={lastReadByPeerAt}
                showReceipts={showReceipts}
              />
            ))
          )}
        </div>

        {peerIsTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-500 px-1 py-1.5 -mt-1 mb-1">
            <TypingDots />
            <span className="font-medium">{peerTypingLabel ?? "Someone"} is typing…</span>
          </div>
        )}

        {/* ── Reply composer ── */}
        {canReply && !isClosed && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = message.trim();
                if (!trimmed) return;
                setSending(true);
                try {
                  await onSendReply(trimmed);
                  setMessage("");
                  if (textRef.current) textRef.current.style.height = "auto";
                } finally { setSending(false); }
              }}
              className="flex items-end gap-2.5"
            >
              <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50
                              focus-within:border-teal-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100
                              transition-all duration-200 overflow-hidden">
                <textarea
                  ref={textRef}
                  value={message}
                  onChange={handleInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={1}
                  placeholder="Type a reply… "
                  className="w-full bg-transparent px-3.5 py-3 text-sm text-slate-800 placeholder-slate-400
                             resize-none outline-none block leading-relaxed"
                  style={{ minHeight: 44, maxHeight: 140 }}
                  disabled={sending}
                />
              </div>

              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-white
                           transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                style={{ background: "linear-gradient(135deg,#0891b2,#0d9488)" }}
              >
                {sending ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.5 2.5L1 7l5 2.5L9.5 15l4-12.5z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M6 9.5l3.5-3.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            </form>
            <p className="text-[10px] text-slate-400 mt-1.5 px-1">Shift+Enter for line break</p>
          </div>
        )}

        {isClosed && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">This query has been resolved and closed.</p>
          </div>
        )}
      </div>
    </>
  );
}