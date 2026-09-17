import { prisma } from "../db";
import { bad, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { notify, notifyCompany } from "./notifications";
import { config } from "../config";
import { createRequest } from "./requests";
import { hasValidLicense } from "./matching";

/** 4. Карта объектов для поставщика — только объекты в рамках его категорий, без адреса и контактов. */
export async function mapProjectsForCompany(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const catIds = (company.categories_json as string[]) ?? [];
  const cats = await prisma.category.findMany({ where: { id: { in: catIds } } });
  const objectTypes = new Set(cats.flatMap((c) => c.object_types_json as string[]));
  const projects = await prisma.project.findMany({ where: { open_to_pitches: true, status: "active", object_type: { in: [...objectTypes] } }, include: { requests: { select: { category_id: true, status: true } }, pitches: { where: { company_id: companyId }, orderBy: { created_at: "desc" }, take: 1 } }, orderBy: { created_at: "desc" } });
  return projects.map((p) => ({
    id: p.id, name: p.name, object_type: p.object_type, region: p.region, city: p.city, district: p.district, area: p.area, floors: p.floors, stage: p.stage,
    // точный адрес/владелец — только после отклика/выбора
    categories: cats.filter((c) => (c.object_types_json as string[]).includes(p.object_type)).map((c) => ({ id: c.id, name: c.name, has_open_request: p.requests.some((r) => r.category_id === c.id && ["published", "needs_dispatcher"].includes(r.status)) })),
    last_pitch: p.pitches[0] ?? null,
  }));
}

/** 5В сценарий + 5Д анти-спам: scope по категориям, pitch_daily_limit, cooldown на объект, expires_at. */
export async function createPitch(companyId: string, userId: string, input: { project_id: string; category_id: string; message: string; price_estimate?: number | null }) {
  const member = await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: companyId } } });
  if (!member) throw forbidden();
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (company.soft_banned_until && company.soft_banned_until > new Date()) throw forbidden("Компания под soft-ban");
  const project = await prisma.project.findUnique({ where: { id: input.project_id } });
  if (!project) throw notFound("Объект не найден");
  if (!project.open_to_pitches || project.status !== "active") throw forbidden("Объект закрыт для встречных предложений");
  const category = await prisma.category.findUniqueOrThrow({ where: { id: input.category_id } });
  if (!((company.categories_json as string[]) ?? []).includes(category.id)) throw forbidden(`Категория «${category.name}» вне scope компании`);
  if (!(category.object_types_json as string[]).includes(project.object_type)) throw bad("scope_object", "Категория не применима к типу объекта");
  if (category.required_license && !(await hasValidLicense(companyId, category.id))) throw forbidden(company.legal_type === "individual_contractor" ? `Категория «${category.name}» требует лицензию — физлицо-исполнитель не допускается` : `Категория «${category.name}» требует верифицированную лицензию`);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const today = await prisma.supplierPitch.count({ where: { company_id: companyId, created_at: { gte: dayStart } } });
  if (today >= company.pitch_daily_limit) throw conflict("pitch_daily_limit", `Дневной лимит встречных предложений исчерпан (${company.pitch_daily_limit})`);
  const since = new Date(Date.now() - company.pitch_cooldown_days * 86400000);
  const recent = await prisma.supplierPitch.findFirst({ where: { company_id: companyId, project_id: project.id, created_at: { gte: since }, status: { in: ["sent", "viewed", "expired"] } } });
  if (recent) throw conflict("pitch_cooldown", `Повторное предложение по этому объекту без ответа возможно не чаще раза в ${company.pitch_cooldown_days} дн.`);
  const pitch = await prisma.supplierPitch.create({ data: { company_id: companyId, project_id: project.id, category_id: category.id, message: input.message, price_estimate: input.price_estimate ?? null, expires_at: new Date(Date.now() + config.pitchExpiresDays * 86400000) } });
  await logActivity({ actor_id: userId, entity_type: "pitch", entity_id: pitch.id, action: "sent", meta: { project_id: project.id, category: category.code } });
  await notify({ user_id: project.owner_id, type: "pitch.received", payload: { pitch_id: pitch.id, project_id: project.id, company: company.name, category: category.name }, dedup_key: `pitch:${pitch.id}` });
  return pitch;
}

/** Ответ заказчика: accept → заявка (direct) этому поставщику + чат; decline → закрыто. */
export async function respondPitch(pitchId: string, userId: string, action: "accept" | "decline", values?: Record<string, unknown>) {
  const pitch = await prisma.supplierPitch.findUnique({ where: { id: pitchId }, include: { project: true, category: true } });
  if (!pitch) throw notFound();
  if (pitch.project.owner_id !== userId) throw forbidden();
  if (!["sent", "viewed"].includes(pitch.status)) throw conflict("bad_status", "Предложение уже обработано или истекло");
  if (action === "decline") {
    await prisma.supplierPitch.update({ where: { id: pitchId }, data: { status: "declined" } });
    await notifyCompany(pitch.company_id, { type: "pitch.declined", payload: { pitch_id: pitchId } });
    return { pitch, request: null };
  }
  const tpl = await prisma.requestTemplate.findFirstOrThrow({ where: { category_id: pitch.category_id, is_current: true }, include: { parameters: true } });
  // минимально валидные значения: обязательные поля из values, иначе — заглушка «уточнить в чате»
  const v: Record<string, unknown> = { ...(values ?? {}) };
  for (const p of tpl.parameters) if (p.required && (v[p.key] === undefined || v[p.key] === "")) v[p.key] = p.field_type === "number" ? 1 : p.field_type === "select" ? (p.options_json as string[])[0] : p.field_type === "boolean" ? false : "уточнить в чате";
  v._from_pitch = pitch.message;
  const { request } = await createRequest(userId, { project_id: pitch.project_id, category_id: pitch.category_id, values: v, mode: "direct", target_company_id: pitch.company_id });
  await prisma.supplierPitch.update({ where: { id: pitchId }, data: { status: "accepted" } });
  await notifyCompany(pitch.company_id, { type: "pitch.accepted", payload: { pitch_id: pitchId, request_id: request.id }, critical: true });
  return { pitch, request };
}

export async function expirePitches(now = new Date()) {
  const r = await prisma.supplierPitch.updateMany({ where: { status: { in: ["sent", "viewed"] }, expires_at: { lt: now } }, data: { status: "expired" } });
  return { expired: r.count };
}
