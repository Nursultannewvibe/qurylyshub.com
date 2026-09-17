import { BoardTargetType } from "@prisma/client";
import { prisma } from "../db";
import { bad, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { notify } from "./notifications";
import { config } from "../config";

/** Список веток категории (и региона). Чтение публичное. */
export async function listPosts(categoryCode: string, regionCode?: string | null) {
  const category = await prisma.category.findUnique({ where: { code: categoryCode } });
  if (!category) throw notFound("Категория не найдена");
  const region = regionCode ? await prisma.region.findUnique({ where: { code: regionCode } }) : null;
  if (regionCode && !region) throw notFound("Регион не найден");
  const posts = await prisma.boardPost.findMany({ where: { category_id: category.id, ...(region ? { region_id: region.id } : {}) }, include: { author: { select: { name: true } }, company: { select: { name: true, public_slug: true, legal_type: true, verifications: { where: { status: "verified" }, select: { id: true } } } }, region: true, _count: { select: { replies: true } } }, orderBy: { created_at: "desc" }, take: 100 });
  return { category, region, posts };
}

export async function getPost(id: string) {
  const post = await prisma.boardPost.findUnique({ where: { id }, include: { category: true, region: true, author: { select: { name: true } }, company: { select: { name: true, public_slug: true, legal_type: true, verifications: { where: { status: "verified" }, select: { id: true } } } }, replies: { orderBy: { created_at: "asc" }, include: { author: { select: { name: true, company_members: { include: { company: { select: { name: true, public_slug: true, verifications: { where: { status: "verified" }, select: { id: true } } } } } } } } } } } });
  if (!post) throw notFound("Ветка не найдена");
  return post;
}

/** Анти-спам постов: тот же приём, что daily_lead_limit / pitch_daily_limit — считаем за календарный день и сравниваем с лимитом. */
async function assertPostLimits(userId: string, companyId: string | null) {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const byUser = await prisma.boardPost.count({ where: { author_id: userId, created_at: { gte: dayStart } } });
  if (byUser >= config.boardPostDailyLimit) throw conflict("board_post_daily_limit", `Дневной лимит постов исчерпан (${config.boardPostDailyLimit}). Попробуйте завтра.`);
  if (companyId) {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const byCompany = await prisma.boardPost.count({ where: { company_id: companyId, created_at: { gte: dayStart } } });
    if (byCompany >= company.board_post_daily_limit) throw conflict("board_post_daily_limit", `Дневной лимит постов компании исчерпан (${company.board_post_daily_limit})`);
  }
}

export async function createPost(userId: string, input: { category_id: string; region_id?: string | null; company_id?: string | null; title: string; body: string }) {
  if (!input.title.trim() || !input.body.trim()) throw bad("empty", "Заполните заголовок и текст");
  if (input.company_id) {
    const m = await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: input.company_id } } });
    if (!m) throw forbidden("Вы не сотрудник этой компании");
  }
  await assertPostLimits(userId, input.company_id ?? null);
  const post = await prisma.boardPost.create({ data: { category_id: input.category_id, region_id: input.region_id || null, company_id: input.company_id || null, author_id: userId, title: input.title.trim().slice(0, 200), body: input.body.trim().slice(0, 5000) } });
  await logActivity({ actor_id: userId, entity_type: "board_post", entity_id: post.id, action: "created", meta: { category_id: input.category_id, company_id: input.company_id ?? null } });
  return post;
}

export async function createReply(userId: string, postId: string, body: string) {
  if (!body.trim()) throw bad("empty", "Пустой ответ");
  const post = await prisma.boardPost.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Ветка не найдена");
  const reply = await prisma.boardReply.create({ data: { post_id: postId, author_id: userId, body: body.trim().slice(0, 5000) } });
  await logActivity({ actor_id: userId, entity_type: "board_reply", entity_id: reply.id, action: "created", meta: { post_id: postId } });
  if (post.author_id !== userId) await notify({ user_id: post.author_id, type: "board.reply", payload: { post_id: postId, title: post.title }, dedup_key: `board.reply:${postId}:${Math.floor(Date.now() / 3600000)}` });
  return reply;
}

/** Жалоба → очередь модерации админа (тот же поток «список → решение → статус», что у review_disputes). */
export async function reportTarget(userId: string, targetType: BoardTargetType, targetId: string, reason: string) {
  const exists = targetType === "post" ? await prisma.boardPost.findUnique({ where: { id: targetId } }) : await prisma.boardReply.findUnique({ where: { id: targetId } });
  if (!exists) throw notFound("Сообщение не найдено");
  const dup = await prisma.boardReport.findFirst({ where: { target_type: targetType, target_id: targetId, reported_by: userId, status: "open" } });
  if (dup) return dup;
  const r = await prisma.boardReport.create({ data: { target_type: targetType, target_id: targetId, reported_by: userId, reason: reason.trim().slice(0, 500) || "без причины" } });
  await logActivity({ actor_id: userId, entity_type: "board_report", entity_id: r.id, action: "opened", meta: { targetType, targetId } });
  const admins = await prisma.userRole.findMany({ where: { role: "admin" } });
  for (const a of admins) await notify({ user_id: a.user_id, type: "board.report", payload: { report_id: r.id }, dedup_key: `board.report:${r.id}` });
  return r;
}

/** Решение админа: resolved — сообщение удаляется; rejected — остаётся. */
export async function resolveReport(adminId: string, reportId: string, outcome: "resolved" | "rejected", resolution?: string) {
  const r = await prisma.boardReport.findUnique({ where: { id: reportId } });
  if (!r) throw notFound();
  if (r.status !== "open") throw conflict("bad_status", "Жалоба уже рассмотрена");
  if (outcome === "resolved") {
    if (r.target_type === "post") await prisma.boardPost.deleteMany({ where: { id: r.target_id } });
    else await prisma.boardReply.deleteMany({ where: { id: r.target_id } });
  }
  const upd = await prisma.boardReport.update({ where: { id: reportId }, data: { status: outcome, resolution: resolution ?? null, resolved_at: new Date() } });
  await logActivity({ actor_id: adminId, entity_type: "board_report", entity_id: reportId, action: outcome, meta: { target_type: r.target_type, target_id: r.target_id } });
  return upd;
}

export async function boardOverview() {
  const cats = await prisma.category.findMany({ orderBy: { order_index: "asc" }, include: { _count: { select: { board_posts: true } } } });
  const latest = await prisma.boardPost.findMany({ include: { category: true, region: true, _count: { select: { replies: true } } }, orderBy: { created_at: "desc" }, take: 10 });
  return { cats, latest };
}
