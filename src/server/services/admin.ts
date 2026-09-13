import { prisma } from "../db";
import { logActivity } from "../activity";
import { notFound, conflict } from "../errors";
import { notifyCompany } from "./notifications";
import { config } from "../config";
import { Prisma } from "@prisma/client";

/** Диспетчер вручную назначает лид компании (для needs_dispatcher). */
export async function dispatcherAssignLead(adminId: string, requestId: string, companyId: string, price = 0) {
  const req = await prisma.request.findUnique({ where: { id: requestId }, include: { category: true } });
  if (!req) throw notFound();
  const exists = await prisma.lead.findUnique({ where: { request_id_company_id: { request_id: requestId, company_id: companyId } } });
  if (exists && exists.status !== "declined") throw conflict("lead_exists", "Лид уже есть");
  const data = { origin: "dispatcher" as const, price: new Prisma.Decimal(price), status: price > 0 ? ("offered" as const) : ("purchased" as const), purchased_at: price > 0 ? null : new Date() };
  // диспетчер может переназначить лид компании, которая ранее отказалась (ручной разбор)
  const lead = exists ? await prisma.lead.update({ where: { id: exists.id }, data }) : await prisma.lead.create({ data: { request_id: requestId, company_id: companyId, ...data } });
  if (req.status === "needs_dispatcher") await prisma.request.update({ where: { id: requestId }, data: { status: "published" } });
  await logActivity({ actor_id: adminId, entity_type: "lead", entity_id: lead.id, action: "dispatcher_assigned", meta: { request_id: requestId } });
  await notifyCompany(companyId, { type: "lead.new", payload: { lead_id: lead.id, request_id: requestId, category: req.category.name } });
  return lead;
}

export async function setSoftBan(adminId: string, companyId: string, until: Date | null, reason?: string) {
  const c = await prisma.company.update({ where: { id: companyId }, data: { soft_banned_until: until, soft_ban_reason: until ? reason ?? null : null } });
  await logActivity({ actor_id: adminId, entity_type: "company", entity_id: companyId, action: until ? "soft_ban.set" : "soft_ban.lifted", meta: { until, reason } });
  return c;
}

/** 5В: автоматический soft-ban при превышении открытых споров / flagged_suspicious — до ручного разбора. */
export async function autoSoftBan(threshold = 3) {
  const companies = await prisma.company.findMany({ where: { role: { in: ["supplier", "contractor"] }, soft_banned_until: null } });
  let banned = 0;
  for (const c of companies) {
    const open = await prisma.dispute.count({ where: { deal: { seller_id: c.id }, status: { in: ["open", "in_review"] } } });
    const flagged = await prisma.deal.count({ where: { seller_id: c.id, flagged_suspicious: true } });
    if (open + flagged >= threshold) {
      await setSoftBan(null as unknown as string, c.id, new Date(Date.now() + 365 * 86400000), `auto: ${open} открытых споров, ${flagged} подозрительных сделок`);
      banned++;
    }
  }
  return { banned };
}

export async function reviewVerification(adminId: string, verificationId: string, status: "verified" | "rejected", validUntil?: Date | null) {
  const v = await prisma.verification.update({ where: { id: verificationId }, data: { status, valid_until: validUntil ?? undefined } });
  await logActivity({ actor_id: adminId, entity_type: "verification", entity_id: verificationId, action: status });
  await notifyCompany(v.company_id, { type: `verification.${status}`, payload: { verification_id: verificationId } });
  return v;
}

/** Напоминание об истечении лицензий (3). */
export async function remindExpiringLicenses(days = 30) {
  const soon = new Date(Date.now() + days * 86400000);
  const list = await prisma.verification.findMany({ where: { status: "verified", valid_until: { lte: soon, gte: new Date() } } });
  for (const v of list) await notifyCompany(v.company_id, { type: "verification.expiring", payload: { verification_id: v.id, valid_until: v.valid_until }, dedup_key: `lic.exp:${v.id}:${new Date().toISOString().slice(0, 10)}` });
  return { reminded: list.length };
}

export async function adminDashboard() {
  const [needsDispatcher, pendingVerifications, openDisputes, pendingPayouts, softBanned, retryPayments] = await Promise.all([
    prisma.request.findMany({ where: { status: "needs_dispatcher" }, include: { category: true, project: true } }),
    prisma.verification.findMany({ where: { status: "pending" }, include: { company: true } }),
    prisma.dispute.findMany({ where: { status: { in: ["open", "in_review"] } }, include: { deal: { include: { seller: true } } } }),
    prisma.payoutRequest.findMany({ where: { status: { in: ["pending", "approved"] } }, include: { company: true } }),
    prisma.company.findMany({ where: { soft_banned_until: { gt: new Date() } } }),
    prisma.payment.findMany({ where: { status: { in: ["retry_pending", "pending"] } } }),
  ]);
  return { needsDispatcher, pendingVerifications, openDisputes, pendingPayouts, softBanned, retryPayments, config: { leadPrice: config.leadPriceDefault } };
}
