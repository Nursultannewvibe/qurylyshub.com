"use server";
import { requireSession, requireRole } from "../auth";
import { act, str, num, bool } from "./helpers";
import { prisma } from "../db";
import * as A from "../services/admin";
import * as Po from "../services/payouts";
import * as R from "../services/reviews";
import * as L from "../services/leads";
import { JOBS } from "../jobs";
import { logActivity } from "../activity";
import { saveUpload, fileFrom } from "../services/uploads";

export async function notificationPrefsAction(fd: FormData) {
  const s = await requireSession();
  await act("/settings/notifications", async () => {
    for (const ch of ["in_app", "push", "sms", "whatsapp", "email"] as const) {
      await prisma.notificationPreference.upsert({ where: { user_id_channel: { user_id: s.user.id, channel: ch } }, create: { user_id: s.user.id, channel: ch, enabled: bool(fd, `${ch}_enabled`), digest_mode: bool(fd, `${ch}_digest`), quiet_hours_start: num(fd, `${ch}_qs`), quiet_hours_end: num(fd, `${ch}_qe`) }, update: { enabled: bool(fd, `${ch}_enabled`), digest_mode: bool(fd, `${ch}_digest`), quiet_hours_start: num(fd, `${ch}_qs`), quiet_hours_end: num(fd, `${ch}_qe`) } });
    }
    return "Предпочтения уведомлений сохранены";
  });
}
export async function markReadAction() { const s = await requireSession(); await prisma.notification.updateMany({ where: { user_id: s.user.id, read: false }, data: { read: true } }); await act("/notifications", async () => "Все прочитано"); }
export async function profileAction(fd: FormData) {
  const s = await requireSession();
  await act("/settings", async () => {
    const newPhone = str(fd, "phone");
    if (newPhone && newPhone !== s.user.phone) { await prisma.phoneChangeLog.create({ data: { user_id: s.user.id, old_phone: s.user.phone, new_phone: newPhone } }); await prisma.user.update({ where: { id: s.user.id }, data: { phone: newPhone } }); }
    await prisma.user.update({ where: { id: s.user.id }, data: { name: str(fd, "name") || null, alt_email: str(fd, "alt_email") || null, email: str(fd, "email") || null } });
    if (str(fd, "device_token")) await prisma.deviceToken.upsert({ where: { user_id_token: { user_id: s.user.id, token: str(fd, "device_token") } }, create: { user_id: s.user.id, token: str(fd, "device_token"), platform: str(fd, "platform") || "web" }, update: {} });
    return "Профиль сохранён";
  });
}
export async function registerCompanyAction(fd: FormData) {
  const s = await requireSession();
  await act("/settings", async () => {
    const { slugify } = await import("@/lib/ids");
    const role = str(fd, "role") as "supplier" | "contractor" | "buyer";
    if (!bool(fd, "consent")) throw new Error("Требуется согласие на обработку персональных данных");
    const legalType = str(fd, "legal_type");
    const isIndividual = legalType === "individual_contractor";
    if (isIndividual && role === "buyer") throw new Error("Физлицо-исполнитель — только поставщик или подрядчик");
    if (!isIndividual && !/^\d{12}$/.test(str(fd, "bin"))) throw new Error("Укажите БИН/ИИН — 12 цифр");
    const docFile = fileFrom(fd, "registration_doc");
    if (!isIndividual && !docFile && !str(fd, "registration_doc_url")) throw new Error("Приложите талон уведомления (ИП) или устав (ТОО)");
    const docUrl = docFile ? await saveUpload(docFile, "docs", s.user.id) : str(fd, "registration_doc_url");
    const c = await prisma.company.create({ data: { legal_type: legalType as never, name: str(fd, "name"), bin: isIndividual ? null : str(fd, "bin"), role, scale: isIndividual ? "individual" : ((str(fd, "scale") || "small") as never), public_slug: slugify(str(fd, "name")), region: str(fd, "region") || null, city: str(fd, "city") || null, registration_doc_url: docUrl || null, bank_account: str(fd, "bank_account") || null, tax_status: (str(fd, "tax_status") || "non_vat") as never, service_center_lat: num(fd, "lat"), service_center_lng: num(fd, "lng"), service_radius_km: num(fd, "radius") ?? 50, members: { create: { user_id: s.user.id, permission: "owner" } }, reputation: { create: {} }, wallet: role === "buyer" ? undefined : { create: {} }, verifications: isIndividual ? undefined : { create: { doc_type: "registration", doc_url: docUrl || null } } } });
    await prisma.consent.create({ data: { user_id: s.user.id, consent_type: "personal_data" } });
    const userRole = role === "buyer" ? "buyer" : role;
    await prisma.userRole.upsert({ where: { user_id_role: { user_id: s.user.id, role: userRole } }, create: { user_id: s.user.id, role: userRole }, update: {} });
    await logActivity({ actor_id: s.user.id, entity_type: "company", entity_id: c.id, action: "registered" });
    return isIndividual ? "Вы зарегистрированы как физлицо-исполнитель. Лицензируемые категории (электрика, газ, пожарная безопасность и т.п.) недоступны — для них нужны ИП/ТОО и лицензия." : "Компания зарегистрирована, документы на проверке";
  });
}
export async function adminAction(fd: FormData) {
  const s = await requireSession(); requireRole(s, "admin");
  await act("/admin", async () => {
    const a = str(fd, "action");
    if (a === "assign_lead") { await A.dispatcherAssignLead(s.user.id, str(fd, "request_id"), str(fd, "company_id"), num(fd, "price") ?? 0); return "Лид назначен"; }
    if (a === "verify") { await A.reviewVerification(s.user.id, str(fd, "verification_id"), str(fd, "status") as never, str(fd, "valid_until") ? new Date(str(fd, "valid_until")) : undefined); return "Верификация обновлена"; }
    if (a === "soft_ban") { await A.setSoftBan(s.user.id, str(fd, "company_id"), str(fd, "until") ? new Date(str(fd, "until")) : null, str(fd, "reason")); return str(fd, "until") ? "Soft-ban установлен" : "Soft-ban снят"; }
    if (a === "payout") { await Po.processPayout(s.user.id, str(fd, "payout_id"), str(fd, "op") as never); return "Выплата обработана"; }
    if (a === "dispute_review") { await A.dispatcherAssignLead; const { setDisputeInReview } = await import("../services/disputes"); await setDisputeInReview(s.user.id, str(fd, "dispute_id")); return "Спор взят на рассмотрение"; }
    if (a === "review_dispute") { await R.resolveReviewDispute(s.user.id, str(fd, "review_dispute_id"), str(fd, "outcome") as never, bool(fd, "hide")); return "Оспаривание отзыва решено"; }
    if (a === "refund_lead") { await L.refundLead(str(fd, "lead_id"), "dispute_resolved_by_admin", s.user.id); return "Лид возвращён"; }
    if (a === "board_report") { const { resolveReport } = await import("../services/board"); await resolveReport(s.user.id, str(fd, "report_id"), str(fd, "outcome") as never, str(fd, "resolution") || undefined); return "Жалоба рассмотрена"; }
    if (a === "job") { const r = await JOBS[str(fd, "job")].run(); return `Джоб ${str(fd, "job")}: ${JSON.stringify(r)}`; }
    if (a === "block_user") { await prisma.user.update({ where: { id: str(fd, "user_id") }, data: { status: str(fd, "status") as never } }); return "Статус пользователя изменён"; }
  });
}
