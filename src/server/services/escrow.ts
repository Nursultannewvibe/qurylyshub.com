import { Prisma } from "@prisma/client";
import { prisma, Tx } from "../db";
import { AppError, bad, conflict, forbidden, notFound } from "../errors";
import { escrowProvider } from "../providers";
import { logActivity } from "../activity";
import { createPayment } from "./payments";
import { getDeal } from "./deals";
import { notify, notifyCompany } from "./notifications";

/** Оплата милстоуна заказчиком (мок-провайдер, идемпотентно) → эскроу-холд. */
export async function payMilestone(userId: string, milestoneId: string, idempotencyKey?: string) {
  const m = await prisma.milestone.findUnique({ where: { id: milestoneId }, include: { deal: true } });
  if (!m) throw notFound("Милстоун не найден");
  const { isBuyer } = await getDeal(m.deal_id, userId);
  if (!isBuyer) throw forbidden("Оплачивает заказчик");
  if (m.status !== "pending") throw conflict("bad_status", `Милстоун уже в статусе ${m.status}`);
  const res = await createPayment({ payer_id: userId, purpose: "milestone", amount: m.amount, idempotency_key: idempotencyKey ?? `milestone:${milestoneId}`, deal_id: m.deal_id, milestone_id: milestoneId });
  return res;
}

export async function fundMilestoneFromPayment(paymentId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (!p.milestone_id || !p.deal_id) return;
  const already = await prisma.escrowHold.findFirst({ where: { milestone_id: p.milestone_id, status: "held" } });
  if (already) return already;
  const hold = await escrowProvider.hold({ deal_id: p.deal_id, milestone_id: p.milestone_id, amount: Number(p.amount) });
  const eh = await prisma.escrowHold.create({ data: { deal_id: p.deal_id, milestone_id: p.milestone_id, amount: p.amount, provider_ref: hold.provider_ref } });
  await prisma.milestone.update({ where: { id: p.milestone_id }, data: { status: "funded" } });
  await prisma.deal.update({ where: { id: p.deal_id }, data: { status: "in_progress" } });
  await logActivity({ actor_id: p.payer_id, entity_type: "escrow_hold", entity_id: eh.id, action: "held", meta: { amount: p.amount.toString(), provider_ref: hold.provider_ref } });
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: p.deal_id } });
  await notifyCompany(deal.seller_id, { type: "milestone.funded", payload: { deal_id: deal.id, milestone_id: p.milestone_id }, critical: true });
  return eh;
}

/** Исполнитель начал работы (влияет на cancel_policy) / сдал этап. */
export async function startWork(userId: string, dealId: string) {
  const { deal, isSeller } = await getDeal(dealId, userId);
  if (!isSeller) throw forbidden();
  await prisma.deal.update({ where: { id: dealId }, data: { work_started_at: deal.work_started_at ?? new Date() } });
  await prisma.milestone.updateMany({ where: { deal_id: dealId, status: "funded" }, data: { status: "in_progress" } });
  await logActivity({ actor_id: userId, entity_type: "deal", entity_id: dealId, action: "work_started" });
}

export async function submitMilestone(userId: string, milestoneId: string) {
  const m = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
  const { deal, isSeller } = await getDeal(m.deal_id, userId);
  if (!isSeller) throw forbidden();
  if (!["funded", "in_progress"].includes(m.status)) throw conflict("bad_status", "Этап не профондирован");
  await prisma.milestone.update({ where: { id: milestoneId }, data: { status: "submitted", submitted_at: new Date() } });
  if (!deal.work_started_at) await prisma.deal.update({ where: { id: deal.id }, data: { work_started_at: new Date() } });
  await notify({ user_id: deal.buyer_id, type: "milestone.submitted", payload: { deal_id: deal.id, milestone_id: milestoneId }, critical: true });
  await logActivity({ actor_id: userId, entity_type: "milestone", entity_id: milestoneId, action: "submitted" });
}

/** Активный спор по милстоуну блокирует раскрытие (9, ЖЁСТКОЕ ПРАВИЛО). */
export async function activeDisputeFor(milestoneId: string, tx: Tx | typeof prisma = prisma) {
  return tx.dispute.findFirst({ where: { milestone_id: milestoneId, status: { in: ["open", "in_review"] } } });
}

/** Чек-лист приёмки (10): критичные пункты (photo_required) должны быть отмечены И иметь фото. */
export async function checklistGate(milestoneId: string) {
  const m = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId }, include: { deal: { include: { request: true } }, checklist_results: { include: { item: true } } } });
  const items = m.deal.request ? await prisma.acceptanceChecklist.findMany({ where: { category_id: m.deal.request.category_id } }) : [];
  const missing: string[] = [];
  for (const it of items) {
    const r = m.checklist_results.find((x) => x.checklist_item_id === it.id);
    if (it.photo_required && (!r || !r.checked || !r.photo_url)) missing.push(it.item_text);
  }
  return { items, results: m.checklist_results, missing };
}

export async function setChecklistResult(userId: string, milestoneId: string, itemId: string, checked: boolean, photoUrl?: string | null) {
  const m = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
  const { isBuyer, isSupervisor, isAdmin } = await getDeal(m.deal_id, userId);
  if (!isBuyer && !isSupervisor && !isAdmin) throw forbidden("Чек-лист заполняет заказчик или технадзор");
  const item = await prisma.acceptanceChecklist.findUniqueOrThrow({ where: { id: itemId } });
  if (item.photo_required && checked && !photoUrl) throw bad("photo_required", `Пункт «${item.item_text}» критичный: требуется фото`);
  return prisma.checklistResult.upsert({ where: { milestone_id_checklist_item_id: { milestone_id: milestoneId, checklist_item_id: itemId } }, create: { milestone_id: milestoneId, checklist_item_id: itemId, checked, photo_url: photoUrl ?? null, checked_by: userId }, update: { checked, photo_url: photoUrl ?? null, checked_by: userId } });
}

/** Пеня за просрочку: penalty_pct_per_day × дней просрочки, не более 10% суммы этапа. */
export function computePenalty(m: { amount: Prisma.Decimal; due_date: Date | null }, pctPerDay: Prisma.Decimal, at = new Date()) {
  if (!m.due_date || at <= m.due_date) return new Prisma.Decimal(0);
  const days = Math.floor((at.getTime() - m.due_date.getTime()) / 86400000);
  const raw = new Prisma.Decimal(m.amount).mul(pctPerDay).div(100).mul(days);
  const cap = new Prisma.Decimal(m.amount).mul(0.1);
  return (raw.gt(cap) ? cap : raw).toDecimalPlaces(2);
}

/**
 * Приёмка этапа заказчиком: полная или ЧАСТИЧНАЯ (accepted_amount). Раскрытие эскроу:
 *  — заблокировано активным спором (409 escrow_blocked) — проверка внутри транзакции с FOR UPDATE на холде;
 *  — критичные пункты чек-листа требуют фото;
 *  — из раскрываемой суммы удерживается пеня (возврат заказчику) и комиссия платформы.
 */
export async function acceptMilestone(userId: string, milestoneId: string, opts: { accepted_amount?: number; skip_checklist?: boolean } = {}) {
  const m = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId }, include: { deal: { include: { seller: true } } } });
  const { isBuyer, isAdmin } = await getDeal(m.deal_id, userId);
  if (!isBuyer && !isAdmin) throw forbidden("Принимает заказчик");
  if (!["submitted", "in_progress", "funded"].includes(m.status)) throw conflict("bad_status", `Этап в статусе ${m.status}`);
  const blocking = await activeDisputeFor(milestoneId);
  if (blocking) {
    const hold = await prisma.escrowHold.findFirst({ where: { milestone_id: milestoneId, status: "held" } });
    await logActivity({ actor_id: userId, entity_type: "escrow_hold", entity_id: hold?.id ?? milestoneId, action: "release_blocked", meta: { dispute_id: blocking.id, via: "acceptMilestone" } });
  }
  if (blocking) throw new AppError("escrow_blocked", `Принять этап нельзя: по нему открыт спор. Дождитесь решения администратора.`, 409, { dispute_id: blocking.id });
  if (!opts.skip_checklist) {
    const gate = await checklistGate(milestoneId);
    if (gate.missing.length) throw new AppError("checklist_photo_required", `Критичные пункты без фото: ${gate.missing.join("; ")}`, 400, gate.missing);
  }
  const accepted = opts.accepted_amount != null ? new Prisma.Decimal(opts.accepted_amount) : new Prisma.Decimal(m.amount);
  if (accepted.lte(0) || accepted.gt(m.amount)) throw bad("accepted_amount", "accepted_amount вне диапазона");
  const partial = accepted.lt(m.amount);
  const penalty = computePenalty(m, m.deal.penalty_pct_per_day);
  const result = await releaseEscrow(milestoneId, userId, { release_amount: accepted, penalty });
  await prisma.milestone.update({ where: { id: milestoneId }, data: { status: partial ? "partially_accepted" : "accepted", accepted_amount: accepted, accepted_at: new Date() } });
  if (penalty.gt(0)) await prisma.deal.update({ where: { id: m.deal_id }, data: { penalty_amount: { increment: penalty } } });
  const rest = await prisma.milestone.count({ where: { deal_id: m.deal_id, status: { notIn: ["accepted", "partially_accepted"] } } });
  if (rest === 0) await prisma.deal.update({ where: { id: m.deal_id }, data: { status: "completed", completed_at: new Date() } });
  const { generateAct } = await import("./acts");
  const act = await generateAct(m.deal_id, milestoneId, "acceptance", userId);
  await notifyCompany(m.deal.seller_id, { type: partial ? "milestone.partially_accepted" : "milestone.accepted", payload: { milestone_id: milestoneId, accepted: accepted.toString(), penalty: penalty.toString(), act_id: act.id }, critical: true });
  return { ...result, partial, accepted, penalty, act };
}

/**
 * Раскрытие эскроу. ЕДИНСТВЕННАЯ точка перевода held → released; вызывается из acceptMilestone,
 * из решения спора и из API /api/escrow/[id]/release — везде та же проверка активного спора.
 */
export async function releaseEscrow(milestoneId: string, actorId: string, opts: { release_amount?: Prisma.Decimal; penalty?: Prisma.Decimal; force_by_dispute?: string } = {}) {
  try {
    return await releaseEscrowTx(milestoneId, actorId, opts);
  } catch (e) {
    // фиксация попытки раскрытия при активном споре — вне откатываемой транзакции
    if (e instanceof AppError && e.code === "escrow_blocked") await logActivity({ actor_id: actorId, entity_type: "escrow_hold", entity_id: (e.details as { hold_id: string }).hold_id, action: "release_blocked", meta: e.details });
    throw e;
  }
}

async function releaseEscrowTx(milestoneId: string, actorId: string, opts: { release_amount?: Prisma.Decimal; penalty?: Prisma.Decimal; force_by_dispute?: string }) {
  return prisma.$transaction(async (tx) => {
    const [hold] = await tx.$queryRaw<{ id: string; amount: Prisma.Decimal; status: string; deal_id: string; blocked_by_dispute_id: string | null }[]>`SELECT id, amount, status, deal_id, blocked_by_dispute_id FROM escrow_holds WHERE milestone_id = ${milestoneId} AND status = 'held' FOR UPDATE`;
    if (!hold) throw conflict("no_hold", "Нет удержанных средств по этапу");
    const dispute = await activeDisputeFor(milestoneId, tx);
    if (dispute && dispute.id !== opts.force_by_dispute) {
      throw new AppError("escrow_blocked", `Деньги из эскроу нельзя перевести: по этому этапу открыт спор (${dispute.status === "open" ? "ожидает рассмотрения" : "на рассмотрении"}). Дождитесь решения администратора.`, 409, { dispute_id: dispute.id, hold_id: hold.id });
    }
    const deal = await tx.deal.findUniqueOrThrow({ where: { id: hold.deal_id }, include: { seller: true } });
    const total = new Prisma.Decimal(hold.amount);
    const release = opts.release_amount ?? total;
    const penalty = opts.penalty ?? new Prisma.Decimal(0);
    const toSeller = release.sub(penalty);
    if (toSeller.lt(0)) throw bad("penalty_exceeds", "Пеня превышает сумму раскрытия");
    const commission = toSeller.mul(deal.commission_percent).div(100).toDecimalPlaces(2);
    const net = toSeller.sub(commission);
    const refund = total.sub(release).add(penalty); // невыплаченный остаток + пеня → заказчику
    const wallet = await tx.wallet.upsert({ where: { company_id: deal.seller_id }, create: { company_id: deal.seller_id }, update: {} });
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: net } } });
    await tx.transaction.create({ data: { wallet_id: wallet.id, type: "release", amount: net, idempotency_key: `release:${hold.id}`, status: "succeeded", meta_json: { milestone_id: milestoneId, gross: toSeller.toString(), fiscal_esf_required: deal.seller.tax_status === "vat_payer" } } });
    await tx.transaction.create({ data: { wallet_id: wallet.id, type: "commission", amount: commission.neg(), idempotency_key: `commission:${hold.id}`, status: "succeeded", meta_json: { percent: deal.commission_percent.toString() } } });
    await escrowProvider.release({ provider_ref: hold.id, amount: Number(toSeller) });
    if (refund.gt(0)) await escrowProvider.refund({ provider_ref: hold.id, amount: Number(refund) });
    const updated = await tx.escrowHold.update({ where: { id: hold.id }, data: { status: "released", released_at: new Date(), blocked_by_dispute_id: null } });
    await logActivity({ actor_id: actorId, entity_type: "escrow_hold", entity_id: hold.id, action: "released", meta: { release: release.toString(), penalty: penalty.toString(), commission: commission.toString(), net: net.toString(), refund_to_buyer: refund.toString() } }, tx);
    return { hold: updated, net, commission, refund, penalty };
  });
}

/** Отмена сделки по cancel_policy: до начала работ — полный возврат, после — 50% удержанных средств исполнителю. */
export async function cancelDeal(userId: string, dealId: string, reason: string) {
  const { deal, isBuyer, isAdmin } = await getDeal(dealId, userId);
  if (!isBuyer && !isAdmin) throw forbidden();
  if (["completed", "cancelled"].includes(deal.status)) throw conflict("bad_status", "Сделка уже завершена");
  const started = !!deal.work_started_at;
  for (const h of deal.escrow_holds.filter((h) => h.status === "held")) {
    const dispute = await activeDisputeFor(h.milestone_id);
    if (dispute) throw new AppError("escrow_blocked", "Есть активный спор — сначала решите его", 409);
    if (!started || deal.cancel_policy === "full_refund_before_start" && !started) {
      await prisma.escrowHold.update({ where: { id: h.id }, data: { status: "refunded", released_at: new Date() } });
      await escrowProvider.refund({ provider_ref: h.id, amount: Number(h.amount) });
    } else {
      await releaseEscrow(h.milestone_id, userId, { release_amount: new Prisma.Decimal(h.amount).mul(0.5).toDecimalPlaces(2) });
    }
  }
  await prisma.deal.update({ where: { id: dealId }, data: { status: "cancelled", cancelled_at: new Date() } });
  await logActivity({ actor_id: userId, entity_type: "deal", entity_id: dealId, action: "cancelled", meta: { reason, work_started: started } });
  await notifyCompany(deal.seller_id, { type: "deal.cancelled", payload: { deal_id: dealId, reason }, critical: true });
}
