import { Prisma, ReviewAuthorRole } from "@prisma/client";
import { prisma } from "../db";
import { conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { config } from "../config";
import { getDeal } from "./deals";
import { notifyCompany, notify } from "./notifications";
import { llmProvider } from "../providers/llm";

/** 8. Отзыв привязан к deal_id; verified=true если автор — сторона сделки и сделка завершена в review_window_days. */
export async function createReview(userId: string, dealId: string, input: { rating: number; text?: string; photo_urls?: string[]; author_role?: ReviewAuthorRole }) {
  const { deal, isBuyer, isSupervisor } = await getDeal(dealId, userId);
  if (!isBuyer && !isSupervisor) throw forbidden("Отзыв оставляет заказчик или технадзор по сделке");
  if (deal.status !== "completed") throw conflict("deal_not_completed", "Отзыв возможен после завершения сделки");
  if (input.rating < 1 || input.rating > 5) throw conflict("rating", "Рейтинг 1..5");
  const withinWindow = !deal.completed_at || Date.now() - deal.completed_at.getTime() <= config.reviewWindowDays * 86400000;
  const weight = Math.min(3, 1 + Math.log10(Math.max(1, Number(deal.amount) / 100000))); // вес по сумме сделки
  // антинакрутка: несколько отзывов с одного пользователя за короткий срок на ту же компанию
  const recent = await prisma.review.count({ where: { author_id: userId, target_company_id: deal.seller_id, created_at: { gte: new Date(Date.now() - 7 * 86400000) } } });
  const review = await prisma.review.create({ data: { deal_id: dealId, author_id: userId, author_role: input.author_role ?? (isSupervisor && !isBuyer ? "supervisor" : "buyer"), target_company_id: deal.seller_id, rating: input.rating, text: input.text ?? null, photo_urls_json: (input.photo_urls ?? []) as never, verified: withinWindow, weight, flagged_suspicious: recent >= 2 } });
  if (input.photo_urls?.length) {
    const c = await prisma.company.findUniqueOrThrow({ where: { id: deal.seller_id } });
    await prisma.company.update({ where: { id: c.id }, data: { portfolio_json: [...((c.portfolio_json as unknown[]) ?? []), ...input.photo_urls.map((p) => ({ photo: p, title: deal.request?.project.name ?? "Покупка товара", from_review: review.id }))] as never } });
  }
  await logActivity({ actor_id: userId, entity_type: "review", entity_id: review.id, action: "created", meta: { verified: withinWindow, weight } });
  await notifyCompany(deal.seller_id, { type: "review.new", payload: { review_id: review.id, rating: input.rating } });
  return review;
}

/** Двусторонний рейтинг: исполнитель оценивает заказчика. */
export async function rateCounterparty(userId: string, dealId: string, rating: number, text?: string) {
  const { deal, isSeller, isBuyer } = await getDeal(dealId, userId);
  if (!isSeller && !isBuyer) throw forbidden();
  const target = isSeller ? { target_type: "user" as const, target_id: deal.buyer_id } : { target_type: "company" as const, target_id: deal.seller_id };
  return prisma.rating.upsert({ where: { deal_id_author_id_target_type_target_id: { deal_id: dealId, author_id: userId, ...target } }, create: { deal_id: dealId, author_id: userId, ...target, rating, text: text ?? null }, update: { rating, text: text ?? null } });
}

export async function respondToReview(userId: string, reviewId: string, text: string) {
  const r = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!r) throw notFound();
  const m = await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: r.target_company_id } } });
  if (!m) throw forbidden();
  const resp = await prisma.reviewResponse.create({ data: { review_id: reviewId, company_id: r.target_company_id, text } });
  await notify({ user_id: r.author_id, type: "review.response", payload: { review_id: reviewId } });
  return resp;
}

export async function disputeReview(userId: string, reviewId: string, reason: string) {
  const r = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!r) throw notFound();
  const m = await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: r.target_company_id } } });
  if (!m) throw forbidden();
  const d = await prisma.reviewDispute.create({ data: { review_id: reviewId, opened_by_company_id: r.target_company_id, reason } });
  await logActivity({ actor_id: userId, entity_type: "review_dispute", entity_id: d.id, action: "opened" });
  const admins = await prisma.userRole.findMany({ where: { role: "admin" } });
  for (const a of admins) await notify({ user_id: a.user_id, type: "review.dispute", payload: { review_dispute_id: d.id } });
  return d;
}

export async function resolveReviewDispute(adminId: string, disputeId: string, outcome: "resolved" | "rejected", hideReview = false) {
  const d = await prisma.reviewDispute.update({ where: { id: disputeId }, data: { status: outcome } });
  if (outcome === "resolved" && hideReview) await prisma.review.update({ where: { id: d.review_id }, data: { flagged_suspicious: true, verified: false } });
  await logActivity({ actor_id: adminId, entity_type: "review_dispute", entity_id: disputeId, action: outcome, meta: { hideReview } });
  return d;
}

/**
 * Пересчёт company_reputation (асинхронная плановая задача): взвешенный рейтинг с recency decay
 * (полураспад 365 дн.), только verified и не flagged; on_time_pct по милстоунам; AI-саммари только по проверяемым данным.
 */
export async function recalculateReputation(companyId?: string) {
  const companies = await prisma.company.findMany({ where: companyId ? { id: companyId } : { role: { in: ["supplier", "contractor"] } } });
  for (const c of companies) {
    const reviews = await prisma.review.findMany({ where: { target_company_id: c.id, verified: true, flagged_suspicious: false } });
    const now = Date.now();
    let wsum = 0, sum = 0;
    for (const r of reviews) { const age = (now - r.created_at.getTime()) / 86400000; const w = r.weight * Math.pow(0.5, age / 365); wsum += w; sum += w * r.rating; }
    const avg = wsum ? Math.round((sum / wsum) * 100) / 100 : 0;
    const deals = await prisma.deal.findMany({ where: { seller_id: c.id, status: { in: ["completed", "in_progress"] } }, include: { milestones: true } });
    const accepted = deals.flatMap((d) => d.milestones).filter((m) => m.accepted_at);
    const onTime = accepted.filter((m) => !m.due_date || m.accepted_at! <= m.due_date).length;
    const on_time_pct = accepted.length ? Math.round((onTime / accepted.length) * 1000) / 10 : 100;
    const disputes_open = await prisma.dispute.count({ where: { deal: { seller_id: c.id }, status: { in: ["open", "in_review"] } } });
    const disputes_closed = await prisma.dispute.count({ where: { deal: { seller_id: c.id }, status: { in: ["resolved", "rejected"] } } });
    let ai = { praise: null as string | null, complaints: null as string | null, incidents: null as string | null };
    if (reviews.length) {
      const corpus = reviews.map((r) => `[${r.rating}] ${r.text ?? ""}`).join("\n") + (disputes_closed ? `\nЗакрытых споров: ${disputes_closed}` : "");
      const res = (await llmProvider.completeJson("REVIEW_SUMMARY: сформируй JSON {praise, complaints, incidents} по отзывам (только факты из текста, без домыслов; на русском).", corpus)) as Partial<typeof ai>;
      ai = { praise: res.praise ?? null, complaints: res.complaints ?? null, incidents: res.incidents ?? null };
    }
    await prisma.companyReputation.upsert({ where: { company_id: c.id }, create: { company_id: c.id, avg_rating: avg, deals_count: deals.filter((d) => d.status === "completed").length, on_time_pct, disputes_open, disputes_closed, ai_summary_praise: ai.praise, ai_summary_complaints: ai.complaints, ai_summary_incidents: ai.incidents }, update: { avg_rating: avg, deals_count: deals.filter((d) => d.status === "completed").length, on_time_pct, disputes_open, disputes_closed, ai_summary_praise: ai.praise, ai_summary_complaints: ai.complaints, ai_summary_incidents: ai.incidents, updated_at: new Date() } });
    await prisma.company.update({ where: { id: c.id }, data: { rating: avg } });
  }
  return { recalculated: companies.length };
}
