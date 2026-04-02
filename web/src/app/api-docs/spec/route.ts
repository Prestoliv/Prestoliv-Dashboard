import { promises as fs } from "fs";
import path from "path";

export async function GET() {
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

