import { promises as fs } from "fs";
import path from "path";
import { createServiceSupabaseClient } from "@/lib/supabase/serviceServer";

async function resolveRole(
  sb: ReturnType<typeof createServiceSupabaseClient>,
  uid: string
): Promise<string> {
  const { data: userRow } = await sb.from("users").select("role").eq("id", uid).maybeSingle();
  if (userRow?.role) return String(userRow.role).toLowerCase();
  const { data: profileRow } = await sb.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (profileRow?.role) return String(profileRow.role).toLowerCase();
  return "customer";
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length).trim();

  const sb = createServiceSupabaseClient();
  const { data: who, error: whoErr } = await sb.auth.getUser(accessToken);
  if (whoErr || !who?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const role = await resolveRole(sb, who.user.id);
  if (role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const candidates = [
    path.resolve(process.cwd(), "..", "swagger.yaml"),
    path.resolve(process.cwd(), "swagger.yaml"),
  ];

  for (const filePath of candidates) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return new Response(content, {
        status: 200,
        headers: {
          "content-type": "application/yaml; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch {
      // Try the next candidate path.
    }
  }

  return new Response("swagger.yaml not found", { status: 404 });
}

