import { readFile } from "fs/promises";
import path from "path";
import { config } from "@/server/config";
import { getSession } from "@/server/auth";
// Раздача локального хранилища (MVP). Файлы актов/проектов — только авторизованным.
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  if (parts.some((p) => p.includes(".."))) return new Response("bad path", { status: 400 });
  if (!(await getSession())) return new Response("unauthorized", { status: 401 });
  // старые ссылки /uploads/acts/<id>.html → документ из БД
  if (parts[0] === "acts" && parts[1]) return Response.redirect(new URL(`/acts/${parts[1].replace(/\.html$/, "")}`, _req.url), 302);
  try {
    const buf = await readFile(path.join(config.uploadDir, ...parts));
    const ext = path.extname(parts[parts.length - 1]).toLowerCase();
    const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : [".jpg", ".jpeg"].includes(ext) ? "image/jpeg" : "application/octet-stream";
    return new Response(buf, { headers: { "content-type": type } });
  } catch { return new Response("not found", { status: 404 }); }
}
