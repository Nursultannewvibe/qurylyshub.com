import { OfferScope, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { AppError, bad, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { hasValidLicense } from "./matching";
import { notify } from "./notifications";

export type OfferInput = {
  offer_scope?: OfferScope;
  material_json?: { name: string; qty: number; unit: string; price: number }[];
  attachments_json?: string[];
  work_cost?: number;
  delivery_cost?: number;
  delivery_days?: number | null;
  execution_days?: number | null;
  warranty?: string | null;
  matches_params?: boolean;
  mismatch_notes?: string | null;
  valid_days?: number;
  template_id?: string | null;
};

const QTY_KEYS: Record<string, string> = { concrete: "volume_m3", windows: "count", roof: "area_m2", reno_tile: "area_m2", reno_electrical: "points", walls: "volume_m3" };

/** «Подозрительно дёшево» — сверка с price_reference по единице категории. */
export async function checkSuspiciousCheap(categoryCode: string, region: string, values: Record<string, unknown>, total: Prisma.Decimal) {
  const qtyKey = QTY_KEYS[categoryCode];
  const qty = qtyKey ? Number(values[qtyKey]) : NaN;
  if (!qty || Number.isNaN(qty)) return false;
  const cat = await prisma.category.findUnique({ where: { code: categoryCode } });
  if (!cat) return false;
  const ref = (await prisma.priceReference.findFirst({ where: { category_id: cat.id, region } })) ?? (await prisma.priceReference.findFirst({ where: { category_id: cat.id } }));
  if (!ref) return false;
  const perUnit = total.div(qty);
  return perUnit.lt(new Prisma.Decimal(ref.price_min).mul(0.7));
}

function computeTotals(input: OfferInput) {
  const material = (input.material_json ?? []).reduce((s, m) => s + Number(m.qty) * Number(m.price), 0);
  const scope = input.offer_scope ?? "material_and_work";
  const work = scope === "material_only" ? 0 : Number(input.work_cost ?? 0);
  const mat = scope === "install_only" ? 0 : material;
  const delivery = Number(input.delivery_cost ?? 0);
  return { material_cost: new Prisma.Decimal(mat), work_cost: new Prisma.Decimal(work), delivery_cost: new Prisma.Decimal(delivery), total: new Prisma.Decimal(mat + work + delivery), scope };
}

/**
 * 7. Создание/отправка КП. ЖЁСТКОЕ ПРАВИЛО ЛИЦЕНЗИИ — на бэкенде: без verified непросроченной verifications
 * на категорию с required_license отправка невозможна независимо от UI.
 */
export async function createOffer(companyId: string, userId: string, requestId: string, input: OfferInput, send = true) {
  const request = await prisma.request.findUnique({ where: { id: requestId }, include: { category: true, project: true, leads: { where: { company_id: companyId } } } });
  if (!request) throw notFound("Заявка не найдена");
  if (!["published", "needs_dispatcher"].includes(request.status)) throw conflict("request_closed", "Заявка закрыта");
  const lead = request.leads[0];
  if (!lead || lead.status !== "purchased") throw forbidden("Сначала нужно получить (купить) лид по этой заявке");
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (company.soft_banned_until && company.soft_banned_until > new Date()) throw forbidden("Компания под soft-ban до ручного разбора");
  if (request.category.required_license && !(await hasValidLicense(companyId, request.category_id))) {
    await logActivity({ actor_id: userId, entity_type: "offer", entity_id: requestId, action: "blocked.no_license", meta: { company_id: companyId, category: request.category.code, legal_type: company.legal_type } });
    throw new AppError("license_required", company.legal_type === "individual_contractor" ? `Категория «${request.category.name}» требует лицензию — физлицо-исполнитель не может работать в лицензируемых категориях. Зарегистрируйте ИП/ТОО и загрузите лицензию.` : `Категория «${request.category.name}» требует верифицированную лицензию. Отправка КП недоступна.`, 403);
  }
  if (request.category.required_attestation && !(await hasValidLicense(companyId, request.category_id, "attestation"))) throw new AppError("attestation_required", "Требуется аттестат", 403);

  let values: OfferInput = input;
  if (input.template_id) {
    const t = await prisma.offerTemplate.findUnique({ where: { id: input.template_id } });
    if (!t || t.company_id !== companyId) throw notFound("Шаблон КП не найден");
    values = { ...(t.template_values_json as OfferInput), ...input };
    await logActivity({ actor_id: userId, entity_type: "offer_template", entity_id: t.id, action: "used", meta: { request_id: requestId } });
  }
  const totals = computeTotals(values);
  if (totals.total.lte(0)) throw bad("total_zero", "Сумма КП должна быть больше нуля");
  const suspicious = await checkSuspiciousCheap(request.category.code, request.project.region, request.values_json as Record<string, unknown>, totals.total);
  const existing = await prisma.offer.findFirst({ where: { request_id: requestId, company_id: companyId, status: { in: ["draft", "sent"] } } });
  const data = {
    offer_scope: totals.scope, material_json: (values.material_json ?? []) as never, attachments_json: (values.attachments_json ?? []) as never,
    material_cost: totals.material_cost, work_cost: totals.work_cost, delivery_cost: totals.delivery_cost, total: totals.total,
    delivery_days: values.delivery_days ?? null, execution_days: values.execution_days ?? null, warranty: values.warranty ?? null,
    matches_params: values.matches_params ?? true, mismatch_notes: values.mismatch_notes ?? null, suspicious_cheap: suspicious,
    valid_until: new Date(Date.now() + (values.valid_days ?? 14) * 86400000), status: send ? ("sent" as const) : ("draft" as const),
  };
  let offer;
  if (existing) {
    // версионирование: новая версия поверх, предыдущее состояние — в activity_log
    await logActivity({ actor_id: userId, entity_type: "offer", entity_id: existing.id, action: "version_replaced", meta: { previous: { version: existing.version, total: existing.total.toString(), status: existing.status } } });
    offer = await prisma.offer.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } });
  } else {
    offer = await prisma.offer.create({ data: { request_id: requestId, company_id: companyId, ...data } });
  }
  await logActivity({ actor_id: userId, entity_type: "offer", entity_id: offer.id, action: send ? "sent" : "drafted", meta: { total: offer.total.toString(), version: offer.version, suspicious_cheap: suspicious } });
  if (send) {
    await notify({ user_id: request.project.owner_id, type: "offer.received", payload: { offer_id: offer.id, request_id: requestId, company: company.name, category: request.category.name }, dedup_key: `offer.received:${offer.id}:v${offer.version}` });
    // мягкое уведомление о бюджете (5): все КП выше budget_max
    if (request.project.budget_max) {
      const sent = await prisma.offer.findMany({ where: { request_id: requestId, status: "sent" } });
      if (sent.length && sent.every((o) => o.total.gt(request.project.budget_max!))) await notify({ user_id: request.project.owner_id, type: "offers.over_budget", payload: { request_id: requestId, budget_max: request.project.budget_max.toString() }, dedup_key: `over_budget:${requestId}` });
    }
  }
  return { offer, suspicious_cheap: suspicious };
}

export async function declineOffer(offerIdOrRequestId: string, companyId: string, userId: string) {
  let offer = await prisma.offer.findFirst({ where: { id: offerIdOrRequestId, company_id: companyId } });
  if (!offer) {
    const req = await prisma.request.findUnique({ where: { id: offerIdOrRequestId } });
    if (!req) throw notFound();
    const tpl = await prisma.requestTemplate.findFirstOrThrow({ where: { category_id: req.category_id } });
    void tpl;
    offer = await prisma.offer.create({ data: { request_id: req.id, company_id: companyId, total: 0, status: "declined" } });
  } else {
    offer = await prisma.offer.update({ where: { id: offer.id }, data: { status: "declined" } });
  }
  await logActivity({ actor_id: userId, entity_type: "offer", entity_id: offer.id, action: "declined" });
  return offer;
}

/** Таблица сравнения (7): Позиция | Материал | Работа | Доставка | Срок | Гарантия | ИТОГО | Соответствие | Рейтинг | Лицензия. */
export async function compareOffers(requestId: string) {
  const req = await prisma.request.findUniqueOrThrow({ where: { id: requestId }, include: { category: true, offers: { where: { status: { in: ["sent", "accepted", "not_selected", "expired"] } }, include: { company: { include: { reputation: true } } }, orderBy: { total: "asc" } } } });
  const rows = [];
  for (const o of req.offers) {
    const licensed = req.category.required_license ? await hasValidLicense(o.company_id, req.category_id) : null;
    rows.push({
      offer_id: o.id, company_id: o.company_id, company: o.company.name, slug: o.company.public_slug, status: o.status, scope: o.offer_scope, version: o.version,
      material: o.material_cost, work: o.work_cost, delivery: o.delivery_cost, days: (o.delivery_days ?? 0) + (o.execution_days ?? 0), delivery_days: o.delivery_days, execution_days: o.execution_days,
      warranty: o.warranty, total: o.total, matches_params: o.matches_params, mismatch_notes: o.mismatch_notes, rating: o.company.reputation?.avg_rating ?? 0, deals: o.company.reputation?.deals_count ?? 0,
      licensed, suspicious_cheap: o.suspicious_cheap, valid_until: o.valid_until, items: o.material_json as { name: string; qty: number; unit: string; price: number }[],
    });
  }
  return { request: req, rows };
}

export async function saveOfferTemplate(companyId: string, categoryId: string, name: string, values: OfferInput) {
  return prisma.offerTemplate.create({ data: { company_id: companyId, category_id: categoryId, name, template_values_json: values as never } });
}
