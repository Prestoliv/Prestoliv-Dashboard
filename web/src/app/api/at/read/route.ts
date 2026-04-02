import { NextResponse } from "next/server";
import { broadcastQueryThreadFromServer } from "@/lib/realtime/queryThreadRealtime";
import { createServiceSupabaseClient } from "@/lib/supabase/serviceServer";

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function assertAllowed(req: Request) {
  const secret = process.env.AT_SHARED_SECRET ?? "";
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return;
    throw new Error("AT_SHARED_SECRET is not set on server.");
  }
  const url = new URL(req.url);
  const provided = req.headers.get("x-at-secret") || url.searchParams.get("secret") || "";
  if (provided !== secret) throw new Error("Unauthorized");
}

export async function POST(req: Request) {
  try {
    assertAllowed(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(msg);
  }

  let body: { uid?: string; queryId?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const uid = (body.uid ?? "").trim();
  const queryId = (body.queryId ?? "").trim();
  if (!uid) return badRequest("Missing uid");
  if (!queryId) return badRequest("Missing queryId");

  let sb;
  try {
    sb = createServiceSupabaseClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase server not configured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    const { data: qrow, error: qErr } = await sb
      .from("queries")
      .select("id,project_id")
      .eq("id", queryId)
      .single();
    if (qErr || !qrow) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    const { data: project, error: pErr } = await sb
      .from("projects")
      .select("*")
      .eq("id", qrow.project_id)
      .single();
    if (pErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const allowed =
      (project as { customer_id?: string }).customer_id === uid ||
      (project as { client_id?: string }).client_id === uid;
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: updated, error: upErr } = await sb
      .from("queries")
      .update({ last_read_customer_at: new Date().toISOString() })
      .eq("id", queryId)
      .select("last_read_customer_at, last_read_team_at")
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    try {
      await broadcastQueryThreadFromServer("read", queryId, {
        last_read_customer_at: updated?.last_read_customer_at ?? null,
        last_read_team_at: updated?.last_read_team_at ?? null,
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ query: updated });
  } catch (e) {
    const msg =
      typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: unknown }).message)
        : e instanceof Error
          ? e.message
          : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
