import { DealItemPortion, Prisma } from "@prisma/client";
import { prisma, Tx } from "../db";
import { bad, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { assertProjectAccess } from "./projects";
import { notify, notifyCompany } from "./notifications";

/** 9. Комиссия по скользящей шкале commission_tiers (данные, не код). */
export async function resolveCommission(amount: Prisma.Decimal, tx: Tx | typeof prisma = prisma) {
  const tiers = await tx.commissionTier.findMany({ orderBy: { min_amount: "asc" } });
  const tier = tiers.find((t) => amount.gte(t.min_amount) && (t.max_amount == null || amount.lt(t.max_amount))) ?? tiers[tiers.length - 1];
  if (!tier) throw bad("no_tiers", "Не настроены commission_tiers");
  const percent = new Prisma.Decimal(tier.percent);
  return { percent, amount: amount.mul(percent).div(100).toDecimalPlaces(2) };
}

export type Selection = { offer_id: string; portions?: DealItemPortion[] };

function portionAmount(o: { material_cost: Prisma.Decimal; work_cost: Prisma.Decimal; delivery_cost: Prisma.Decimal }, p: DealItemPortion) {
  return p === "material" ? o.material_cost : p === "install" ? o.work_cost : o.delivery_cost;
}

/**
 * Создание сделки из одного или нескольких КП (7: РАЗДЕЛЁННЫЙ ВЫБОР через deal_items).
 * Решение: одна Deal = один продавец (эскроу и комиссия считаются на продавца); при выборе портов из КП
 * разных компаний создаётся по сделке на каждую. Остальные КП со статусом sent → not_selected + уведомление
 * проигравшим без цены победителя. Заявка → closed.
 */
export async function createDeals(userId: string, requestId: string, selections: Selection[]) {
  const req = await prisma.request.findUnique({ where: { id: requestId }, include: { project: true, offers: true, category: true } });
  if (!req) throw notFound("Заявка не найдена");
  await assertProjectAccess(req.project_id, userId);
  if (!["published", "needs_dispatcher"].includes(req.status)) throw conflict("request_closed", "Заявка уже закрыта");
  if (!selections.length) throw bad("no_selection", "Не выбрано ни одного КП");
  const now = new Date();
  const chosen = selections.map((s) => {
    const o = req.offers.find((x) => x.id === s.offer_id);
    if (!o) throw notFound("КП не найдено");
    if (o.status !== "sent") throw conflict("offer_not_sent", `КП ${o.id} в статусе ${o.status}`);
    if (o.valid_until && o.valid_until < now) throw conflict("offer_expired", "Срок действия КП истёк");
    const portions = s.portions?.length ? s.portions : (["material", "install", "delivery"] as DealItemPortion[]).filter((p) => portionAmount(o, p).gt(0));
    for (const p of portions) if (portionAmount(o, p).lte(0)) throw bad("portion_empty", `В КП нет части «${p}»`);
    return { o, portions };
  });
  // одна часть не может быть куплена дважды у разных поставщиков
  const seen = new Set<DealItemPortion>();
  for (const c of chosen) for (const p of c.portions) { if (seen.has(p)) throw bad("portion_dup", `Часть «${p}» выбрана более одного раза`); seen.add(p); }

  const deals = await prisma.$transaction(async (tx) => {
    const bySeller = new Map<string, typeof chosen>();
    for (const c of chosen) bySeller.set(c.o.company_id, [...(bySeller.get(c.o.company_id) ?? []), c]);
    const created = [];
    const buyerCompany = req.project.company_id ?? null;
    for (const [sellerId, parts] of bySeller) {
      const amount = parts.reduce((s, c) => s.add(c.portions.reduce((a, p) => a.add(portionAmount(c.o, p)), new Prisma.Decimal(0))), new Prisma.Decimal(0));
      const commission = await resolveCommission(amount, tx);
      const deal = await tx.deal.create({ data: { request_id: requestId, offer_id: parts[0].o.id, buyer_id: userId, buyer_company_id: buyerCompany, seller_id: sellerId, amount, commission_percent: commission.percent, commission_amount: commission.amount, status: "awaiting_payment" } });
      for (const c of parts) for (const p of c.portions) await tx.dealItem.create({ data: { deal_id: deal.id, offer_id: c.o.id, portion: p, amount: portionAmount(c.o, p) } });
      // Милстоуны: материал+доставка отдельно от работ (если есть оба), иначе один на 100%
      const matDel = parts.reduce((s, c) => s.add(c.portions.filter((p) => p !== "install").reduce((a, p) => a.add(portionAmount(c.o, p)), new Prisma.Decimal(0))), new Prisma.Decimal(0));
      const work = amount.sub(matDel);
      const ms: { name: string; amount: Prisma.Decimal }[] = [];
      if (matDel.gt(0)) ms.push({ name: "Материалы и доставка", amount: matDel });
      if (work.gt(0)) ms.push({ name: "Работы / монтаж", amount: work });
      const execDays = Math.max(...parts.map((c) => (c.o.delivery_days ?? 0) + (c.o.execution_days ?? 0)), 7);
      for (const [i, m] of ms.entries()) await tx.milestone.create({ data: { deal_id: deal.id, name: m.name, order_index: i, amount: m.amount, due_date: new Date(now.getTime() + execDays * 86400000) } });
      for (const c of parts) await tx.offer.update({ where: { id: c.o.id }, data: { status: "accepted" } });
      await tx.thread.upsert({ where: { request_id_seller_id: { request_id: requestId, seller_id: sellerId } }, create: { request_id: requestId, buyer_id: userId, seller_id: sellerId }, update: {} });
      await logActivity({ actor_id: userId, entity_type: "deal", entity_id: deal.id, action: "created", meta: { amount: amount.toString(), commission_percent: commission.percent.toString(), commission_amount: commission.amount.toString(), items: parts.map((c) => ({ offer_id: c.o.id, portions: c.portions })) } }, tx);
      created.push(deal);
    }
    // СТАТУС ПРОИГРАВШЕГО (7): все остальные sent → not_selected
    const acceptedIds = chosen.map((c) => c.o.id);
    await tx.offer.updateMany({ where: { request_id: requestId, status: "sent", id: { notIn: acceptedIds } }, data: { status: "not_selected" } });
    await tx.request.update({ where: { id: requestId }, data: { status: "closed" } });
    return created;
  });

  const losers = req.offers.filter((o) => o.status === "sent" && !chosen.some((c) => c.o.id === o.id));
  for (const l of losers) await notifyCompany(l.company_id, { type: "offer.not_selected", payload: { offer_id: l.id, request_id: requestId, category: req.category.name }, dedup_key: `not_selected:${l.id}` }); // без цены победителя
  for (const d of deals) await notifyCompany(d.seller_id, { type: "deal.created", payload: { deal_id: d.id, amount: d.amount.toString() }, critical: true });
  await notify({ user_id: userId, type: "deal.created", payload: { deal_ids: deals.map((d) => d.id) } });
  return deals;
}

export async function getDeal(dealId: string, userId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { request: { include: { category: true, project: true } }, product: true, seller: { include: { members: true } }, items: { include: { offer: true } }, milestones: { orderBy: { order_index: "asc" }, include: { escrow_holds: true, checklist_results: { include: { item: true } }, disputes: true } }, escrow_holds: true, acts: true, disputes: true, warranty_claims: true, payments: true, reviews: true } });
  if (!deal) throw notFound("Сделка не найдена");
  const roles = await prisma.userRole.findMany({ where: { user_id: userId } });
  const isAdmin = roles.some((r) => r.role === "admin");
  const isSupervisor = roles.some((r) => r.role === "supervisor");
  const isSeller = deal.seller.members.some((m) => m.user_id === userId);
  const isBuyer = deal.buyer_id === userId || (deal.buyer_company_id ? !!(await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: deal.buyer_company_id } } })) : false);
  if (!isAdmin && !isSeller && !isBuyer && !isSupervisor) throw forbidden("Нет доступа к сделке");
  return { deal, isBuyer, isSeller, isAdmin, isSupervisor };
}

export async function listDealsForUser(userId: string) {
  const memberships = await prisma.companyMember.findMany({ where: { user_id: userId } });
  const cids = memberships.map((m) => m.company_id);
  return prisma.deal.findMany({ where: { OR: [{ buyer_id: userId }, { seller_id: { in: cids } }, { buyer_company_id: { in: cids } }] }, include: { request: { include: { category: true, project: true } }, seller: true, milestones: true }, orderBy: { created_at: "desc" } });
}
