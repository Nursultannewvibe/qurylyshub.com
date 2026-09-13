import { prisma } from "../db";
import { forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { notify, notifyCompany } from "./notifications";

// 5Б: паттерны телефона/мессенджеров
const PHONE_RE = /(\+?7|8)[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d/g;
const MESSENGER_RE = /(whatsapp|вотсап|ватсап|telegram|телеграм|тг\b|t\.me\/|wa\.me\/|@[a-z0-9_]{4,}|instagram|инста(грам)?\b)/gi;

export function detectContactLeak(text: string) {
  const phones = text.match(PHONE_RE) ?? [];
  const messengers = text.match(MESSENGER_RE) ?? [];
  return { leak: phones.length > 0 || messengers.length > 0, phones, messengers };
}

export function maskContacts(text: string) {
  return text.replace(PHONE_RE, (m) => m.replace(/\d/g, "•")).replace(MESSENGER_RE, "[скрыто]");
}

export async function getOrCreateThread(requestId: string, sellerCompanyId: string, userId: string) {
  const req = await prisma.request.findUnique({ where: { id: requestId }, include: { project: true, leads: { where: { company_id: sellerCompanyId } }, offers: { where: { company_id: sellerCompanyId } } } });
  if (!req) throw notFound("Заявка не найдена");
  const isBuyer = req.project.owner_id === userId || !!(await prisma.projectMember.findUnique({ where: { project_id_user_id: { project_id: req.project_id, user_id: userId } } }));
  const isSeller = !!(await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: sellerCompanyId } } }));
  if (!isBuyer && !isSeller) throw forbidden();
  const hasLead = req.leads.some((l) => l.status === "purchased");
  if (!hasLead && !req.offers.length) throw forbidden("Чат доступен после получения лида поставщиком");
  return prisma.thread.upsert({ where: { request_id_seller_id: { request_id: requestId, seller_id: sellerCompanyId } }, create: { request_id: requestId, buyer_id: req.project.owner_id, seller_id: sellerCompanyId }, update: {}, include: { messages: { orderBy: { created_at: "asc" }, include: { sender: { select: { id: true, name: true } } } }, request: { include: { category: true, project: true } } } });
}

/** До сделки контакты скрыты: номер/мессенджер маскируется, факт фиксируется в activity_log, отправителю — предупреждение. */
export async function sendMessage(threadId: string, userId: string, body: string, attachments: string[] = []) {
  const thread = await prisma.thread.findUnique({ where: { id: threadId }, include: { request: { include: { deals: true, project: true } } } });
  if (!thread) throw notFound();
  const isBuyer = thread.buyer_id === userId;
  const isSeller = !!(await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: thread.seller_id } } }));
  if (!isBuyer && !isSeller) throw forbidden();
  const dealExists = thread.request.deals.some((d) => d.seller_id === thread.seller_id);
  const det = detectContactLeak(body);
  const flagged = det.leak && !dealExists;
  const msg = await prisma.message.create({ data: { thread_id: threadId, sender_id: userId, body: flagged ? maskContacts(body) : body, attachments_json: attachments as never, flagged_contact_leak: flagged } });
  if (flagged) await logActivity({ actor_id: userId, entity_type: "message", entity_id: msg.id, action: "contact_leak_attempt", meta: { thread_id: threadId, phones: det.phones.length, messengers: det.messengers.length } });
  // уведомление второй стороне: критичное, если сделка уже выбрана (5Г)
  if (isBuyer) await notifyCompany(thread.seller_id, { type: "message.new", payload: { thread_id: threadId }, dedup_key: `msg:${threadId}:${Math.floor(Date.now() / 600000)}`, critical: dealExists });
  else await notify({ user_id: thread.buyer_id, type: "message.new", payload: { thread_id: threadId }, dedup_key: `msg:${threadId}:${Math.floor(Date.now() / 600000)}`, critical: dealExists });
  return { message: msg, warning: flagged ? "Обмен контактами до заключения сделки запрещён правилами платформы. Контакты скрыты, попытка зафиксирована." : null };
}

export async function threadsForUser(userId: string) {
  const memberships = await prisma.companyMember.findMany({ where: { user_id: userId } });
  return prisma.thread.findMany({ where: { OR: [{ buyer_id: userId }, { seller_id: { in: memberships.map((m) => m.company_id) } }] }, include: { request: { include: { category: true, project: { select: { name: true } } } }, messages: { orderBy: { created_at: "desc" }, take: 1 } }, orderBy: { created_at: "desc" } });
}
