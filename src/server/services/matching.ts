import { Company, LeadOrigin, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { config } from "../config";
import { coversPoint } from "@/lib/geo";
import { logActivity } from "../activity";
import { notifyCompany, notify } from "./notifications";

export type CandidateReason = { company_id: string; name: string; included: boolean; reason: string; distance_km?: number; score?: number };

/**
 * Валидная (verified и не просроченная) лицензия компании на категорию. Единственная точка проверки —
 * используется матчингом, отправкой КП, рассылкой, сравнением и встречными предложениями.
 * Физлицо-исполнитель (legal_type=individual_contractor) не может иметь лицензию по определению → всегда false.
 */
export async function hasValidLicense(companyId: string, categoryId: string, kind: "license" | "attestation" = "license") {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { legal_type: true } });
  if (company?.legal_type === "individual_contractor") return false;
  const v = await prisma.verification.findFirst({ where: { company_id: companyId, category_id: categoryId, doc_type: kind, status: "verified", OR: [{ valid_until: null }, { valid_until: { gt: new Date() } }] } });
  return !!v;
}

/** Нагрузка за день: считаются лиды движка (matched/rematch/dispatcher). direct/broadcast — инициатива заказчика, в лимит не входят (см. README «Допущения»). */
export async function leadsToday(companyId: string) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return prisma.lead.count({ where: { company_id: companyId, created_at: { gte: start }, status: { not: "refunded" }, origin: { in: ["matched", "rematch", "dispatcher"] } } });
}

/**
 * 5А. Матчинг: фильтр (категория, гео, лицензия, soft-ban, уже получал) → ранжирование
 * (рейтинг → дистанция → on_time_pct, с учётом текущей нагрузки daily_lead_limit) → лимит получателей →
 * leads + уведомления → fallback (расширение радиуса → needs_dispatcher). Каждое решение — в activity_log.
 */
export async function matchRequest(requestId: string, opts: { origin?: LeadOrigin; radiusMultiplier?: number; limit?: number; actorId?: string | null } = {}) {
  const origin = opts.origin ?? "matched";
  const limit = opts.limit ?? config.matchMaxRecipients;
  const request = await prisma.request.findUniqueOrThrow({ where: { id: requestId }, include: { project: true, category: true, leads: true } });
  const { project, category } = request;
  const point = project.geo_lat != null && project.geo_lng != null ? { lat: project.geo_lat, lng: project.geo_lng } : null;
  const multiplier = opts.radiusMultiplier ?? (request.radius_expanded ? config.fallbackRadiusMultiplier : 1);

  const companies = await prisma.company.findMany({ where: { role: { in: ["supplier", "contractor"] } }, include: { reputation: true } });
  const already = new Set(request.leads.map((l) => l.company_id));
  const reasons: CandidateReason[] = [];
  const scored: { c: Company; score: number; distance: number }[] = [];
  const now = new Date();

  for (const c of companies) {
    const cats = (c.categories_json as string[]) ?? [];
    if (!cats.includes(category.id)) continue; // не показываем в объяснимости тысячи нерелевантных компаний
    const push = (included: boolean, reason: string, extra: Partial<CandidateReason> = {}) => reasons.push({ company_id: c.id, name: c.name, included, reason, ...extra });
    if (already.has(c.id)) { push(false, "уже получал лид по этой заявке (или отказался)"); continue; }
    if (c.soft_banned_until && c.soft_banned_until > now) { push(false, `soft-ban до ${c.soft_banned_until.toISOString()}`); continue; }
    let distance = 0;
    if (point) {
      const cov = coversPoint({ polygon: c.service_area_polygon as number[][] | null, centerLat: c.service_center_lat, centerLng: c.service_center_lng, radiusKm: c.service_radius_km }, point, multiplier);
      distance = cov.distanceKm;
      const hasArea = c.service_center_lat != null || Array.isArray(c.service_area_polygon);
      if (hasArea && !cov.covered) { push(false, `объект вне зоны обслуживания (${cov.distanceKm.toFixed(0)} км, множитель радиуса ${multiplier})`, { distance_km: cov.distanceKm }); continue; }
    }
    if (category.required_license && !(await hasValidLicense(c.id, category.id))) { push(false, c.legal_type === "individual_contractor" ? "категория требует лицензию: физлицо-исполнитель не допускается" : "категория требует лицензию: нет verified/непросроченной"); continue; }
    if (category.required_attestation && !(await hasValidLicense(c.id, category.id, "attestation"))) { push(false, "категория требует аттестат"); continue; }
    const today = await leadsToday(c.id);
    if (today >= c.daily_lead_limit) { push(false, `достигнут daily_lead_limit (${today}/${c.daily_lead_limit})`); continue; }
    const rep = c.reputation;
    const load = today / Math.max(1, c.daily_lead_limit);
    const score = (rep?.avg_rating ?? 0) * 10 - distance * 0.1 + (rep?.on_time_pct ?? 100) * 0.05 - load * 5;
    scored.push({ c, score, distance });
    push(true, "кандидат", { distance_km: distance, score: Math.round(score * 100) / 100 });
  }

  scored.sort((a, b) => b.score - a.score || a.distance - b.distance);
  const chosen = scored.slice(0, limit);
  const cut = scored.slice(limit);
  for (const s of cut) { const r = reasons.find((x) => x.company_id === s.c.id); if (r) { r.included = false; r.reason = `не вошёл в лимит получателей (${limit})`; } }

  const created = [];
  for (const s of chosen) {
    const lead = await prisma.lead.create({ data: { request_id: requestId, company_id: s.c.id, origin, price: new Prisma.Decimal(config.leadPriceDefault) } });
    created.push(lead);
    await notifyCompany(s.c.id, { type: "lead.new", payload: { lead_id: lead.id, request_id: requestId, category: category.name, city: project.city, district: project.district }, dedup_key: `lead.new:${lead.id}` });
  }
  await logActivity({ actor_id: opts.actorId ?? null, entity_type: "request", entity_id: requestId, action: `match.${origin}`, meta: { radius_multiplier: multiplier, candidates: reasons, created_leads: created.length } });

  // FALLBACK (5А.6)
  if (created.length === 0 && origin === "matched") {
    if (!request.radius_expanded) {
      await prisma.request.update({ where: { id: requestId }, data: { radius_expanded: true } });
      await logActivity({ entity_type: "request", entity_id: requestId, action: "match.fallback.expand_radius", meta: { multiplier: config.fallbackRadiusMultiplier } });
      return matchRequest(requestId, { ...opts, radiusMultiplier: config.fallbackRadiusMultiplier });
    }
    await prisma.request.update({ where: { id: requestId }, data: { status: "needs_dispatcher" } });
    await logActivity({ entity_type: "request", entity_id: requestId, action: "match.fallback.needs_dispatcher" });
    const admins = await prisma.userRole.findMany({ where: { role: "admin" } });
    for (const a of admins) await notify({ user_id: a.user_id, type: "request.needs_dispatcher", payload: { request_id: requestId, category: category.name, city: project.city }, dedup_key: `needs_dispatcher:${requestId}` });
  }
  return { leads: created, reasons, radius_multiplier: multiplier };
}

/** 5А.10 REMATCH: раз в час — новые подходящие поставщики для published/needs_dispatcher заявок. */
export async function rematchAll() {
  const requests = await prisma.request.findMany({ where: { status: { in: ["published", "needs_dispatcher"] }, mode: "matched", OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] } });
  let created = 0;
  for (const r of requests) {
    const res = await matchRequest(r.id, { origin: "rematch" });
    created += res.leads.length;
    if (res.leads.length && r.status === "needs_dispatcher") await prisma.request.update({ where: { id: r.id }, data: { status: "published" } });
  }
  return { requests: requests.length, created };
}
