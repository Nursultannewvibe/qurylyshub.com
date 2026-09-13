import { DisputeCategory } from "@prisma/client";
import { prisma } from "../db";
import { conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { getDeal } from "./deals";
import { notify, notifyCompany } from "./notifications";
import { releaseEscrow } from "./escrow";

/** Открытие спора: если указан milestone — связанные escrow_holds помечаются blocked_by_dispute_id. */
export async function openDispute(userId: string, dealId: string, input: { milestone_id?: string | null; reason: string; category?: DisputeCategory }) {
  const { deal, isBuyer, isSeller, isSupervisor, isAdmin } = await getDeal(dealId, userId);
  if (!isBuyer && !isSeller && !isSupervisor && !isAdmin) throw forbidden();
  if (input.milestone_id && !deal.milestones.some((m) => m.id === input.milestone_id)) throw notFound("Этап не относится к сделке");
  const d = await prisma.dispute.create({ data: { deal_id: dealId, milestone_id: input.milestone_id ?? null, opened_by: userId, reason: input.reason, category: input.category ?? "other" } });
  if (input.milestone_id) await prisma.escrowHold.updateMany({ where: { milestone_id: input.milestone_id, status: "held" }, data: { blocked_by_dispute_id: d.id } });
  await logActivity({ actor_id: userId, entity_type: "dispute", entity_id: d.id, action: "opened", meta: { deal_id: dealId, milestone_id: input.milestone_id ?? null, category: d.category } });
  await notify({ user_id: deal.buyer_id, type: "dispute.opened", payload: { dispute_id: d.id, deal_id: dealId }, critical: true });
  await notifyCompany(deal.seller_id, { type: "dispute.opened", payload: { dispute_id: d.id, deal_id: dealId }, critical: true });
  const admins = await prisma.userRole.findMany({ where: { role: "admin" } });
  for (const a of admins) await notify({ user_id: a.user_id, type: "dispute.opened", payload: { dispute_id: d.id } });
  return d;
}

export async function setDisputeInReview(adminId: string, disputeId: string) {
  const d = await prisma.dispute.update({ where: { id: disputeId }, data: { status: "in_review" } });
  await logActivity({ actor_id: adminId, entity_type: "dispute", entity_id: disputeId, action: "in_review" });
  return d;
}

/**
 * Решение спора админом: resolved/rejected снимает блокировку. Опционально сразу раскрыть эскроу
 * в пользу исполнителя (release_to_seller, с долей accepted_share 0..1) — остаток вернётся заказчику.
 */
export async function resolveDispute(adminId: string, disputeId: string, outcome: "resolved" | "rejected", resolution: string, opts: { release_to_seller?: boolean; accepted_share?: number } = {}) {
  const d = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!d) throw notFound();
  if (!["open", "in_review"].includes(d.status)) throw conflict("bad_status", "Спор уже закрыт");
  const upd = await prisma.dispute.update({ where: { id: disputeId }, data: { status: outcome, resolution, resolved_at: new Date() } });
  await prisma.escrowHold.updateMany({ where: { blocked_by_dispute_id: disputeId }, data: { blocked_by_dispute_id: null } });
  await logActivity({ actor_id: adminId, entity_type: "dispute", entity_id: disputeId, action: outcome, meta: { resolution, ...opts } });
  let release = null;
  if (opts.release_to_seller && d.milestone_id) {
    const m = await prisma.milestone.findUniqueOrThrow({ where: { id: d.milestone_id } });
    const share = Math.min(1, Math.max(0, opts.accepted_share ?? 1));
    release = await releaseEscrow(d.milestone_id, adminId, { release_amount: m.amount.mul(share).toDecimalPlaces(2), force_by_dispute: disputeId });
    await prisma.milestone.update({ where: { id: d.milestone_id }, data: { status: share < 1 ? "partially_accepted" : "accepted", accepted_amount: m.amount.mul(share).toDecimalPlaces(2), accepted_at: new Date() } });
  }
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: d.deal_id } });
  await notify({ user_id: deal.buyer_id, type: `dispute.${outcome}`, payload: { dispute_id: disputeId }, critical: true });
  await notifyCompany(deal.seller_id, { type: `dispute.${outcome}`, payload: { dispute_id: disputeId }, critical: true });
  return { dispute: upd, release };
}

/** warranty_claims — отдельный поток от споров (после акта/завершения). */
export async function openWarrantyClaim(userId: string, dealId: string, description: string, photoUrl?: string | null) {
  const { deal, isBuyer } = await getDeal(dealId, userId);
  if (!isBuyer) throw forbidden();
  const signedAct = deal.acts.some((a) => a.status === "signed");
  if (!signedAct && deal.status !== "completed") throw conflict("no_act", "Гарантийная претензия возможна после подписанного акта приёмки");
  const w = await prisma.warrantyClaim.create({ data: { deal_id: dealId, description, photo_url: photoUrl ?? null } });
  await notifyCompany(deal.seller_id, { type: "warranty.claim", payload: { claim_id: w.id, deal_id: dealId }, critical: true });
  await logActivity({ actor_id: userId, entity_type: "warranty_claim", entity_id: w.id, action: "opened" });
  return w;
}

export async function updateWarrantyClaim(userId: string, claimId: string, status: "in_progress" | "resolved" | "rejected") {
  const w = await prisma.warrantyClaim.findUniqueOrThrow({ where: { id: claimId } });
  const { isSeller, isAdmin } = await getDeal(w.deal_id, userId);
  if (!isSeller && !isAdmin) throw forbidden();
  const upd = await prisma.warrantyClaim.update({ where: { id: claimId }, data: { status, resolved_at: ["resolved", "rejected"].includes(status) ? new Date() : null } });
  await logActivity({ actor_id: userId, entity_type: "warranty_claim", entity_id: claimId, action: status });
  return upd;
}
