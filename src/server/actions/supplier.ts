"use server";
import { requireSession, companyOf } from "../auth";
import { act, str, num, bool } from "./helpers";
import * as L from "../services/leads";
import * as O from "../services/offers";
import * as P from "../services/pitches";
import * as Pay from "../services/payments";
import * as Po from "../services/payouts";
import { prisma } from "../db";
import { logActivity } from "../activity";

export async function leadAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/leads", async () => {
    const id = str(fd, "lead_id"); const a = str(fd, "action");
    if (a === "purchase") { await L.purchaseLead(id, c.id, s.user.id); return "Лид куплен — можно отправить КП и написать в чат"; }
    if (a === "decline") { await L.declineLead(id, c.id, s.user.id); return "Лид отклонён"; }
    if (a === "dispute") { await L.openLeadDispute(id, c.id, s.user.id, str(fd, "reason")); return "Запрос на возврат лида отправлен диспетчеру"; }
  });
}

export async function offerAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s); const rid = str(fd, "request_id");
  await act(`/supplier/offers/new?request=${rid}`, async () => {
    if (str(fd, "action") === "decline") { await O.declineOffer(rid, c.id, s.user.id); return `/supplier/leads?ok=${encodeURIComponent("Вы отказались от участия")}`; }
    const items = [];
    for (let i = 0; i < 6; i++) { const name = str(fd, `m_name_${i}`); if (name) items.push({ name, qty: num(fd, `m_qty_${i}`) ?? 1, unit: str(fd, `m_unit_${i}`) || "шт", price: num(fd, `m_price_${i}`) ?? 0 }); }
    const r = await O.createOffer(c.id, s.user.id, rid, { offer_scope: str(fd, "offer_scope") as never, material_json: items, work_cost: num(fd, "work_cost") ?? 0, delivery_cost: num(fd, "delivery_cost") ?? 0, delivery_days: num(fd, "delivery_days"), execution_days: num(fd, "execution_days"), warranty: str(fd, "warranty") || null, matches_params: !bool(fd, "mismatch"), mismatch_notes: str(fd, "mismatch_notes") || null, valid_days: num(fd, "valid_days") ?? 14, template_id: str(fd, "template_id") || null, attachments_json: str(fd, "attachment") ? [str(fd, "attachment")] : [] });
    if (bool(fd, "save_template")) await O.saveOfferTemplate(c.id, (await prisma.request.findUniqueOrThrow({ where: { id: rid } })).category_id, str(fd, "template_name") || `Шаблон ${new Date().toLocaleDateString("ru-RU")}`, { offer_scope: str(fd, "offer_scope") as never, material_json: items, work_cost: num(fd, "work_cost") ?? 0, delivery_cost: num(fd, "delivery_cost") ?? 0, delivery_days: num(fd, "delivery_days"), execution_days: num(fd, "execution_days"), warranty: str(fd, "warranty") || null });
    return `/supplier/leads?ok=${encodeURIComponent(`КП v${r.offer.version} отправлено на ${r.offer.total} ₸${r.suspicious_cheap ? " (помечено «подозрительно дёшево»)" : ""}`)}`;
  });
}

export async function pitchAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/map", async () => { const p = await P.createPitch(c.id, s.user.id, { project_id: str(fd, "project_id"), category_id: str(fd, "category_id"), message: str(fd, "message"), price_estimate: num(fd, "price_estimate") }); return `Встречное предложение отправлено (действует до ${p.expires_at.toLocaleDateString("ru-RU")})`; });
}

export async function topUpAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/wallet", async () => { const p = await Pay.topUpWallet(s.user.id, c.id, Number(str(fd, "amount")), str(fd, "idempotency_key") || `topup:${c.id}:${Date.now()}`); return `Пополнение: ${p.status} (${p.provider}, ${p.provider_ref ?? p.last_error ?? ""})`; });
}
export async function payoutAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/wallet", async () => { const p = await Po.requestPayout(s.user.id, c.id, Number(str(fd, "amount")), str(fd, "bank_account") || undefined); return `Заявка на вывод ${p.amount} ₸ создана (pending)`; });
}
export async function companySettingsAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/settings", async () => {
    const cats = fd.getAll("categories").map(String);
    let polygon: number[][] | null = null;
    const raw = str(fd, "service_area_polygon");
    if (raw) { try { polygon = JSON.parse(raw); } catch { throw new Error("Полигон: ожидается JSON вида [[lat,lng],...]"); } }
    await prisma.company.update({ where: { id: c.id }, data: { description: str(fd, "description") || null, daily_lead_limit: num(fd, "daily_lead_limit") ?? 5, pitch_daily_limit: num(fd, "pitch_daily_limit") ?? 5, pitch_cooldown_days: num(fd, "pitch_cooldown_days") ?? 7, service_center_lat: num(fd, "service_center_lat"), service_center_lng: num(fd, "service_center_lng"), service_radius_km: num(fd, "service_radius_km"), service_area_polygon: polygon as never, categories_json: cats, bank_account: str(fd, "bank_account") || null, is_public: bool(fd, "is_public") } });
    await logActivity({ actor_id: s.user.id, entity_type: "company", entity_id: c.id, action: "settings_updated" });
    return "Настройки компании сохранены";
  });
}
export async function verificationUploadAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/settings", async () => { await prisma.verification.create({ data: { company_id: c.id, category_id: str(fd, "category_id") || null, doc_type: str(fd, "doc_type") as never, doc_url: str(fd, "doc_url") || null, valid_until: str(fd, "valid_until") ? new Date(str(fd, "valid_until")) : null } }); return "Документ отправлен на проверку (pending)"; });
}
export async function offerTemplateDeleteAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/settings", async () => { await prisma.offerTemplate.deleteMany({ where: { id: str(fd, "id"), company_id: c.id } }); return "Шаблон удалён"; });
}
