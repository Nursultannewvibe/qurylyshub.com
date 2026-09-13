import { Prisma, RequestMode } from "@prisma/client";
import { prisma } from "../db";
import { bad, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { assertProjectAccess, stageWarnings } from "./projects";
import { matchRequest, hasValidLicense } from "./matching";
import { notifyCompany, notify } from "./notifications";
import { config } from "../config";

export async function currentTemplate(categoryId: string) {
  const t = await prisma.requestTemplate.findFirst({ where: { category_id: categoryId, is_current: true }, include: { parameters: { orderBy: { order_index: "asc" } } } });
  if (!t) throw notFound("Шаблон для категории не найден");
  return t;
}

export function validateValues(params: { key: string; label: string; field_type: string; required: boolean; options_json: unknown }[], values: Record<string, unknown>) {
  const errors: string[] = [];
  for (const p of params) {
    const v = values[p.key];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (p.required && empty) errors.push(`«${p.label}» обязательно`);
    if (!empty && p.field_type === "number" && Number.isNaN(Number(v))) errors.push(`«${p.label}» должно быть числом`);
    if (!empty && p.field_type === "select" && Array.isArray(p.options_json) && !(p.options_json as string[]).includes(String(v))) errors.push(`«${p.label}»: недопустимое значение`);
  }
  return errors;
}

export type CreateRequestInput = { project_id: string; category_id: string; stage_id?: string | null; values: Record<string, unknown>; mode?: RequestMode; target_company_id?: string | null; ai_extracted?: unknown; publish?: boolean; expires_days?: number };

/** Создание заявки по текущей версии шаблона (6: версионирование — заявка запоминает template_version). */
export async function createRequest(userId: string, input: CreateRequestInput) {
  const project = await assertProjectAccess(input.project_id, userId);
  const category = await prisma.category.findUnique({ where: { id: input.category_id } });
  if (!category) throw notFound("Категория не найдена");
  const ot = category.object_types_json as string[];
  if (ot.length && !ot.includes(project.object_type)) throw bad("category_object_type", `Категория «${category.name}» не применима к типу объекта`);
  const tpl = await currentTemplate(category.id);
  const errors = validateValues(tpl.parameters, input.values);
  if (errors.length) throw bad("validation", errors.join("; "), errors);
  const mode = input.mode ?? "matched";
  if (mode === "direct" && !input.target_company_id) throw bad("target_required", "Для точечного запроса нужен получатель");
  const warnings = await stageWarnings(project.id, category.id, input.stage_id);
  const req = await prisma.request.create({
    data: { project_id: project.id, stage_id: input.stage_id ?? null, category_id: category.id, template_id: tpl.id, template_version: tpl.version, mode, values_json: input.values as never, ai_extracted_json: (input.ai_extracted ?? Prisma.JsonNull) as never, status: "draft", expires_at: new Date(Date.now() + (input.expires_days ?? 14) * 86400000) },
  });
  await logActivity({ actor_id: userId, entity_type: "request", entity_id: req.id, action: "created", meta: { mode, warnings, template_version: tpl.version } });
  let match: Awaited<ReturnType<typeof publishRequest>> | null = null;
  if (input.publish !== false) match = await publishRequest(req.id, userId, input.target_company_id);
  return { request: await prisma.request.findUniqueOrThrow({ where: { id: req.id } }), warnings, match };
}

export async function publishRequest(requestId: string, userId: string, targetCompanyId?: string | null) {
  const req = await prisma.request.findUniqueOrThrow({ where: { id: requestId }, include: { project: true, category: true } });
  await assertProjectAccess(req.project_id, userId);
  if (req.status !== "draft") throw bad("bad_status", "Заявка уже опубликована");
  await prisma.request.update({ where: { id: requestId }, data: { status: "published", published_at: new Date() } });
  if (req.mode === "direct") {
    const target = targetCompanyId ? await prisma.company.findUnique({ where: { id: targetCompanyId } }) : null;
    if (!target) throw notFound("Компания-получатель не найдена");
    if (!((target.categories_json as string[]) ?? []).includes(req.category_id)) throw bad("scope", "Компания не работает в этой категории");
    const lead = await prisma.lead.create({ data: { request_id: requestId, company_id: target.id, origin: "direct", price: 0, status: "purchased", purchased_at: new Date() } });
    await notifyCompany(target.id, { type: "request.direct", payload: { request_id: requestId, lead_id: lead.id, category: req.category.name, project: req.project.name, city: req.project.city }, dedup_key: `lead.new:${lead.id}` });
    await logActivity({ actor_id: userId, entity_type: "request", entity_id: requestId, action: "published.direct", meta: { target: target.id } });
    return { leads: [lead], reasons: [], radius_multiplier: 1 };
  }
  if (req.mode === "broadcast") return { leads: [], reasons: [], radius_multiplier: 1 }; // лиды создаёт batch-сервис
  return matchRequest(requestId, { actorId: userId });
}

/**
 * 5Б. МАССОВАЯ РАССЫЛКА: крупный заказчик фильтрует объекты и одной кнопкой создаёт заявки всем поставщикам категории.
 * Всем — но с проверкой лицензии, soft-ban и (мягко) зоны обслуживания ×2. Без лимита получателей.
 */
export async function broadcastRequests(userId: string, companyId: string, input: { category_id: string; project_ids: string[]; values: Record<string, unknown>; filter?: unknown }) {
  const member = await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: companyId } } });
  if (!member) throw forbidden("Не сотрудник компании");
  const category = await prisma.category.findUniqueOrThrow({ where: { id: input.category_id } });
  const batch = await prisma.requestBatch.create({ data: { created_by_company_id: companyId, category_id: category.id, filter_json: (input.filter ?? { project_ids: input.project_ids }) as never } });
  const suppliers = await prisma.company.findMany({ where: { role: { in: ["supplier", "contractor"] } } });
  const now = new Date();
  const eligible = [];
  for (const c of suppliers) {
    if (!((c.categories_json as string[]) ?? []).includes(category.id)) continue;
    if (c.soft_banned_until && c.soft_banned_until > now) continue;
    if (category.required_license && !(await hasValidLicense(c.id, category.id))) continue;
    eligible.push(c);
  }
  const results = [];
  for (const pid of input.project_ids) {
    const { request } = await createRequest(userId, { project_id: pid, category_id: category.id, values: input.values, mode: "broadcast", publish: true });
    await prisma.requestBatchItem.create({ data: { batch_id: batch.id, request_id: request.id } });
    const leads = [];
    for (const c of eligible) {
      const lead = await prisma.lead.create({ data: { request_id: request.id, company_id: c.id, origin: "broadcast", price: 0, status: "purchased", purchased_at: now } });
      leads.push(lead);
      await notifyCompany(c.id, { type: "request.broadcast", payload: { request_id: request.id, lead_id: lead.id, category: category.name, batch_id: batch.id }, dedup_key: `broadcast:${batch.id}` });
    }
    results.push({ request, leads: leads.length });
  }
  await logActivity({ actor_id: userId, entity_type: "request_batch", entity_id: batch.id, action: "broadcast", meta: { projects: input.project_ids.length, recipients: eligible.map((c) => c.id) } });
  return { batch, results, recipients: eligible.length };
}

export async function cancelRequest(requestId: string, userId: string, reason: string) {
  const req = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
  await assertProjectAccess(req.project_id, userId);
  await prisma.request.update({ where: { id: requestId }, data: { status: "cancelled" } });
  await prisma.offer.updateMany({ where: { request_id: requestId, status: "sent" }, data: { status: "expired" } });
  // 5А.8: явный дубль → автоматический возврат купленных лидов
  if (reason === "duplicate") {
    const { refundLead } = await import("./leads");
    const leads = await prisma.lead.findMany({ where: { request_id: requestId, status: "purchased" } });
    for (const l of leads) await refundLead(l.id, "request_duplicate");
  }
  await logActivity({ actor_id: userId, entity_type: "request", entity_id: requestId, action: "cancelled", meta: { reason } });
}

/** Экраны заказчика: ВХОДЯЩИЕ (offers + pitches) и ИСХОДЯЩИЕ (requests: кому ушли, кто ответил). */
export async function buyerInbox(userId: string) {
  const projects = await prisma.project.findMany({ where: { OR: [{ owner_id: userId }, { members: { some: { user_id: userId } } }] }, select: { id: true } });
  const pids = projects.map((p) => p.id);
  const offers = await prisma.offer.findMany({ where: { request: { project_id: { in: pids } }, status: { in: ["sent", "accepted", "not_selected", "expired"] } }, include: { company: { include: { reputation: true } }, request: { include: { category: true, project: true } } }, orderBy: { created_at: "desc" } });
  const pitches = await prisma.supplierPitch.findMany({ where: { project_id: { in: pids } }, include: { company: { include: { reputation: true } }, category: true, project: true }, orderBy: { created_at: "desc" } });
  return { offers, pitches };
}

export async function buyerOutbox(userId: string) {
  const projects = await prisma.project.findMany({ where: { OR: [{ owner_id: userId }, { members: { some: { user_id: userId } } }] }, select: { id: true } });
  return prisma.request.findMany({ where: { project_id: { in: projects.map((p) => p.id) } }, include: { category: true, project: true, leads: { include: { company: true } }, offers: { select: { id: true, company_id: true, status: true, total: true } } }, orderBy: { created_at: "desc" } });
}

/** Напоминание заказчику о непринятых КП (7). */
export async function remindPendingOffers() {
  const threshold = new Date(Date.now() - config.offerReminderDays * 86400000);
  const reqs = await prisma.request.findMany({ where: { status: "published", offers: { some: { status: "sent", created_at: { lte: threshold } } } }, include: { project: true, offers: { where: { status: "sent" } } } });
  let sent = 0;
  for (const r of reqs) {
    const res = await notify({ user_id: r.project.owner_id, type: "offers.reminder", payload: { request_id: r.id, offers: r.offers.length }, dedup_key: `offers.reminder:${r.id}:${new Date().toISOString().slice(0, 10)}` });
    if (!res.deduplicated) sent++;
  }
  return { sent };
}

/** Истечение заявок/КП. */
export async function expireStale() {
  const now = new Date();
  const r = await prisma.request.updateMany({ where: { status: "published", expires_at: { lt: now } }, data: { status: "expired" } });
  const o = await prisma.offer.updateMany({ where: { status: "sent", valid_until: { lt: now } }, data: { status: "expired" } });
  return { requests: r.count, offers: o.count };
}

/** 6. ВЕРСИОНИРОВАНИЕ: изменение состава параметров создаёт новую версию шаблона; старые заявки привязаны к своей версии. */
export async function createTemplateVersion(categoryId: string, params: { key: string; label: string; field_type: "number" | "text" | "select" | "multiselect" | "boolean" | "file"; required?: boolean; options?: string[]; unit?: string; hint?: string }[], actorId?: string) {
  const current = await currentTemplate(categoryId);
  const next = await prisma.$transaction(async (tx) => {
    await tx.requestTemplate.update({ where: { id: current.id }, data: { is_current: false } });
    return tx.requestTemplate.create({ data: { category_id: categoryId, name: current.name, version: current.version + 1, is_current: true, parameters: { create: params.map((p, i) => ({ key: p.key, label: p.label, field_type: p.field_type, required: !!p.required, options_json: p.options ? p.options : Prisma.JsonNull, unit: p.unit ?? null, hint: p.hint ?? null, order_index: i })) } } });
  });
  await logActivity({ actor_id: actorId ?? null, entity_type: "request_template", entity_id: next.id, action: "new_version", meta: { from: current.version, to: next.version } });
  return next;
}
