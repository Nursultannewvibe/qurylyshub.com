import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { bad, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { config } from "../config";
import { notify } from "./notifications";

/**
 * 5А.7 АТОМАРНОСТЬ ПОКУПКИ ЛИДА: строки lead и wallet блокируются SELECT ... FOR UPDATE внутри транзакции.
 * Две параллельные покупки одного лида: вторая ждёт снятия блокировки и видит status=purchased → conflict.
 * Идемпотентность списания — transactions.idempotency_key = lead:<id>.
 */
export async function purchaseLead(leadId: string, companyId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const [lead] = await tx.$queryRaw<{ id: string; status: string; company_id: string; request_id: string; price: Prisma.Decimal }[]>`SELECT id, status, company_id, request_id, price FROM leads WHERE id = ${leadId} FOR UPDATE`;
    if (!lead) throw notFound("Лид не найден");
    if (lead.company_id !== companyId) throw forbidden("Лид адресован другой компании");
    if (lead.status !== "offered") throw conflict("lead_not_available", `Лид уже в статусе ${lead.status}`);
    const req = await tx.request.findUniqueOrThrow({ where: { id: lead.request_id } });
    if (!["published", "needs_dispatcher"].includes(req.status)) throw conflict("request_closed", "Заявка уже закрыта");
    const [wallet] = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`SELECT id, balance FROM wallets WHERE company_id = ${companyId} FOR UPDATE`;
    if (!wallet) throw bad("no_wallet", "У компании нет кошелька");
    const price = new Prisma.Decimal(lead.price);
    if (new Prisma.Decimal(wallet.balance).lt(price)) throw bad("insufficient_funds", `Недостаточно средств: нужно ${price} ₸, на балансе ${wallet.balance} ₸`);
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: price } } });
    await tx.transaction.create({ data: { wallet_id: wallet.id, type: "lead_purchase", amount: price.neg(), idempotency_key: `lead:${leadId}`, status: "succeeded", meta_json: { lead_id: leadId, request_id: lead.request_id } } });
    const updated = await tx.lead.update({ where: { id: leadId }, data: { status: "purchased", purchased_at: new Date() } });
    await logActivity({ actor_id: userId, entity_type: "lead", entity_id: leadId, action: "purchased", meta: { price: price.toString() } }, tx);
    return updated;
  }, { isolationLevel: "ReadCommitted" });
}

/** 5В: явный отказ — заявка больше не показывается компании. */
export async function declineLead(leadId: string, companyId: string, userId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw notFound();
  if (lead.company_id !== companyId) throw forbidden();
  if (lead.status !== "offered") throw conflict("bad_status", "Отказаться можно только от непокупного лида");
  const updated = await prisma.lead.update({ where: { id: leadId }, data: { status: "declined" } });
  await logActivity({ actor_id: userId, entity_type: "lead", entity_id: leadId, action: "declined" });
  return updated;
}

export async function refundLead(leadId: string, reason: string, actorId?: string) {
  return prisma.$transaction(async (tx) => {
    const [lead] = await tx.$queryRaw<{ id: string; status: string; company_id: string; price: Prisma.Decimal }[]>`SELECT id, status, company_id, price FROM leads WHERE id = ${leadId} FOR UPDATE`;
    if (!lead || lead.status !== "purchased") return null;
    const price = new Prisma.Decimal(lead.price);
    if (price.gt(0)) {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { company_id: lead.company_id } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: price } } });
      await tx.transaction.create({ data: { wallet_id: wallet.id, type: "refund", amount: price, idempotency_key: `lead-refund:${leadId}`, status: "succeeded", meta_json: { lead_id: leadId, reason } } });
    }
    const updated = await tx.lead.update({ where: { id: leadId }, data: { status: "refunded" } });
    await logActivity({ actor_id: actorId ?? null, entity_type: "lead", entity_id: leadId, action: "refunded", meta: { reason } }, tx);
    return updated;
  });
}

/** 5А.8: автоматический возврат — 48ч без ответа заказчика (нет сообщений заказчика в треде и нет сделки). */
export async function autoRefundStaleLeads(now = new Date()) {
  const threshold = new Date(now.getTime() - config.leadAutoRefundHours * 3600000);
  const leads = await prisma.lead.findMany({ where: { status: "purchased", price: { gt: 0 }, purchased_at: { lt: threshold }, origin: { in: ["matched", "rematch", "dispatcher"] } }, include: { request: { include: { project: true, deals: true, threads: { include: { messages: true } } } } } });
  let refunded = 0;
  for (const l of leads) {
    const dealWithUs = l.request.deals.some((d) => d.seller_id === l.company_id);
    const thread = l.request.threads.find((t) => t.seller_id === l.company_id);
    const buyerReplied = thread?.messages.some((m) => m.sender_id === l.request.project.owner_id) ?? false;
    if (!dealWithUs && !buyerReplied) { await refundLead(l.id, "no_buyer_response_48h"); refunded++; }
  }
  return { refunded };
}

/** Спор по лиду (не дубль и не 48ч) — через disputes с категорией lead_refund, решает админ. */
export async function openLeadDispute(leadId: string, companyId: string, userId: string, reason: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { request: true } });
  if (!lead || lead.company_id !== companyId) throw forbidden();
  await logActivity({ actor_id: userId, entity_type: "lead", entity_id: leadId, action: "dispute_opened", meta: { reason } });
  const admins = await prisma.userRole.findMany({ where: { role: "admin" } });
  for (const a of admins) await notify({ user_id: a.user_id, type: "lead.dispute", payload: { lead_id: leadId, reason } });
  return { ok: true };
}

export async function supplierLeads(companyId: string) {
  return prisma.lead.findMany({ where: { company_id: companyId, status: { not: "declined" } }, include: { request: { include: { category: true, project: { select: { id: true, name: true, city: true, district: true, object_type: true, address: true, owner_id: true } }, offers: { where: { company_id: companyId } } } } }, orderBy: { created_at: "desc" } });
}
