import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/serviceServer";

const BodySchema = z.object({
  idToken: z.string().min(10).optional(),
  id_token: z.string().min(10).optional(),
});

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-webflow-secret");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

function unauthorized(msg = "Unauthorized") {
  return withCors(NextResponse.json({ error: msg }, { status: 401 }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  // Optional extra guard for public Webflow usage
  const shared = process.env.WEBFLOW_AUTH_SHARED_SECRET?.trim() || "";
  if (shared) {
    const provided = req.headers.get("x-webflow-secret")?.trim() || "";
    if (provided !== shared) return unauthorized("Invalid shared secret");
  }

  let token = "";

  // Allow passing token via Authorization header
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    token = auth.slice(7).trim();
  }

  // Or via JSON body
  if (!token) {
    try {
      const parsed = BodySchema.safeParse(await req.json());
      if (!parsed.success) {
        return withCors(NextResponse.json({ error: "Missing idToken" }, { status: 400 }));
      }
      token = (parsed.data.idToken || parsed.data.id_token || "").trim();
    } catch {
      return withCors(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
    }
  }

  if (!token) return withCors(NextResponse.json({ error: "Missing idToken" }, { status: 400 }));

  const audience =
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    "";

  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken: token,
      ...(audience ? { audience } : {}),
    });

    const payload = ticket.getPayload();
    if (!payload?.sub) return unauthorized("Invalid token payload");

    const googleUid = payload.sub;
    const email = (payload.email || "").toString();

    // If this Google user is also a Supabase Auth user, return the Supabase UID too.
    let supabaseUid: string | null = null;
    if (email) {
      try {
        const sb = createServiceSupabaseClient();
        // supabase-js GoTrue admin API doesn't always expose getUserByEmail in all versions;
        // list and match best-effort.
        const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (!error) {
          const match = (data?.users ?? []).find(
            (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
          );
          supabaseUid = match?.id ?? null;
        }
      } catch {
        // best-effort
      }
    }

    return withCors(
      NextResponse.json({
        google: {
          uid: googleUid,
          email: email || null,
          name: payload.name ?? null,
          picture: payload.picture ?? null,
          email_verified: payload.email_verified ?? null,
        },
        supabase: {
          uid: supabaseUid,
        },
      })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid token";
    return unauthorized(msg);
  }
}

