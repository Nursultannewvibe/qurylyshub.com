import { prisma } from "@/server/db";
import { getSession } from "@/server/auth";
import { getDeal } from "@/server/services/deals";
// Документ акта из БД (content_html) — не зависит от файловой системы хостинга.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await getSession();
  if (!s) return new Response("Требуется вход", { status: 401 });
  const act = await prisma.act.findUnique({ where: { id: id.replace(/\.html$/, "") } });
  if (!act?.content_html) return new Response("Акт не найден", { status: 404 });
  try { await getDeal(act.deal_id, s.user.id); } catch { return new Response("Нет доступа", { status: 403 }); }
  return new Response(act.content_html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
