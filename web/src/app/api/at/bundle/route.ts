import { NextResponse } from "next/server";
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
    // In local/dev we allow without shared secret to unblock quickly.
    if (process.env.NODE_ENV !== "production") return;
    throw new Error("AT_SHARED_SECRET is not set on server.");
  }
  const url = new URL(req.url);
  const provided = req.headers.get("x-at-secret") || url.searchParams.get("secret") || "";
  if (provided !== secret) throw new Error("Unauthorized");
}

export async function GET(req: Request) {
  try {
    assertAllowed(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return unauthorized(msg);
  }

  const url = new URL(req.url);
  const uid = url.searchParams.get("uid") || "";
  if (!uid) return badRequest("Missing uid");

  let sb;
  try {
    sb = createServiceSupabaseClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase server not configured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("id,name,full_name,email,role")
      .eq("id", uid)
      .single();
    if (pErr) throw pErr;

    const { data: projects, error: prErr } = await sb
      .from("projects")
      .select("*")
      .or(`customer_id.eq.${uid},client_id.eq.${uid}`)
      .order("created_at", { ascending: false });
    if (prErr) throw prErr;

    const projectIds = (projects ?? []).map((p: any) => p.id).filter(Boolean);

    let milestones: any[] = [];
    let queries: any[] = [];
    let repliesByQueryId: Record<string, any[]> = {};

    if (projectIds.length) {
      const [msRes, qRes] = await Promise.all([
        sb.from("milestones").select("*").in("project_id", projectIds),
        sb.from("queries").select("*").in("project_id", projectIds).order("created_at", { ascending: false }),
      ]);
      if (msRes.error) throw msRes.error;
      if (qRes.error) throw qRes.error;
      milestones = (msRes.data ?? []) as any[];
      queries = (qRes.data ?? []) as any[];

      const qIds = queries.map((q: { id: string }) => q.id).filter(Boolean);
      if (qIds.length) {
        const { data: allReplies, error: repErr } = await sb
          .from("query_replies")
          .select("*")
          .in("query_id", qIds)
          .order("created_at", { ascending: true });
        if (!repErr && allReplies) {
          repliesByQueryId = {};
          for (const r of allReplies as { query_id: string }[]) {
            const id = r.query_id;
            if (!repliesByQueryId[id]) repliesByQueryId[id] = [];
            repliesByQueryId[id].push(r);
          }
        }
      }
    }

    return NextResponse.json({
      profile,
      projects: projects ?? [],
      milestones,
      queries,
      repliesByQueryId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

