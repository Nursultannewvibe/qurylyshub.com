import { prisma } from "@/server/db";
import { getSession } from "@/server/auth";
// Отдача файла из file_blobs по /f/<id>/<имя> (только авторизованным). Байты читаются из БД только здесь — при открытии файла.
export async function GET(_req: Request, ctx: { params: Promise<{ p: string[] }> }) {
  const { p } = await ctx.params;
  if (!(await getSession())) return new Response("Требуется вход", { status: 401 });
  const f = await prisma.fileBlob.findUnique({ where: { id: p[0] } });
  if (!f) return new Response("Файл не найден", { status: 404 });
  return new Response(new Uint8Array(f.data), { headers: { "content-type": f.mime, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, "cache-control": "private, max-age=3600" } });
}
