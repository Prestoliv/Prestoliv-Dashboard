import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryReply } from "@/lib/domain";
import { createServiceSupabaseClient } from "@/lib/supabase/serviceServer";

export const QUERY_THREAD_CHANNEL_PREFIX = "query-thread";

export function queryThreadChannelName(queryId: string) {
  return `${QUERY_THREAD_CHANNEL_PREFIX}:${queryId}`;
}

export type QueryThreadReadPayload = {
  last_read_customer_at?: string | null;
  last_read_team_at?: string | null;
};

export type QueryThreadTypingPayload = {
  userId: string;
  typing: boolean;
};

function pickBroadcastPayload<T>(raw: unknown): T | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if ("payload" in o && o.payload && typeof o.payload === "object") {
    return o.payload as T;
  }
  return raw as T;
}

function pickReplyFromBroadcast(msg: unknown): QueryReply | undefined {
  const inner = pickBroadcastPayload<{ reply?: QueryReply }>(msg);
  if (inner && typeof inner === "object" && inner.reply && typeof inner.reply === "object" && "id" in inner.reply) {
    return inner.reply;
  }
  const flat = msg as { reply?: QueryReply };
  if (flat?.reply && typeof flat.reply === "object" && "id" in flat.reply) return flat.reply;
  return undefined;
}

/** Browser or server: send broadcast via Realtime REST (no subscribe required). */
export async function httpBroadcastQueryThread(
  supabase: SupabaseClient,
  queryId: string,
  event: "reply" | "read" | "typing",
  payload: Record<string, unknown>
) {
  const ch = supabase.channel(queryThreadChannelName(queryId));
  await ch.httpSend(event, payload);
}

/** Browser: subscribe to broadcast events (portal + dashboard typing / cross-role). */
export function subscribeQueryThreadBroadcast(
  supabase: SupabaseClient,
  queryId: string,
  handlers: {
    onReply?: (reply: QueryReply) => void;
    onRead?: (p: QueryThreadReadPayload) => void;
    onTyping?: (p: QueryThreadTypingPayload) => void;
  }
) {
  const name = queryThreadChannelName(queryId);
  const ch = supabase.channel(name);
  ch.on("broadcast", { event: "reply" }, (msg: unknown) => {
    const reply = pickReplyFromBroadcast(msg);
    if (reply) handlers.onReply?.(reply);
  })
    .on("broadcast", { event: "read" }, (msg: unknown) => {
      const p = pickBroadcastPayload<QueryThreadReadPayload>(msg);
      if (p && typeof p === "object") handlers.onRead?.(p);
    })
    .on("broadcast", { event: "typing" }, (msg: unknown) => {
      const p = pickBroadcastPayload<QueryThreadTypingPayload>(msg);
      if (p?.userId != null) handlers.onTyping?.(p);
    });

  ch.subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

/** Server-side broadcast (service role) for /api/at/* when the browser has no session. */
export async function broadcastQueryThreadFromServer(
  event: "reply" | "read" | "typing",
  queryId: string,
  payload: Record<string, unknown>
) {
  const sb = createServiceSupabaseClient();
  await httpBroadcastQueryThread(sb as unknown as SupabaseClient, queryId, event, payload);
}
