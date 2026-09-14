// Демо-режим: быстрое переключение между тестовыми аккаунтами без ввода телефона/OTP.
// Включается ТОЛЬКО при DEMO_MODE=1 или заданном DEV_OTP_CODE; проверка — здесь (бэкенд), а не в UI.
import { prisma } from "./db";
import { config } from "./config";
import { AppError, forbidden } from "./errors";
import { issueToken } from "./auth";
import { logActivity } from "./activity";

export const DEMO_ACCOUNTS = [
  { phone: "+77010000001", name: "Айдар", role: "Частный заказчик", hint: "дом в Каскелене, сделки, эскроу" },
  { phone: "+77010000002", name: "Данияр · BI Construct", role: "Крупный заказчик", hint: "ЖК из 2 корпусов, массовая рассылка" },
  { phone: "+77010000003", name: "Окна Алматы", role: "Поставщик", hint: "окна, карта объектов, кошелёк" },
  { phone: "+77010000004", name: "БетонСервис", role: "Поставщик", hint: "бетон, зона Боралдай" },
  { phone: "+77010000005", name: "КровляМастер", role: "Подрядчик", hint: "крыша, электроснабжение (лицензия)" },
  { phone: "+77010000008", name: "РемСтрой", role: "Подрядчик", hint: "ремонт квартир" },
  { phone: "+77010000009", name: "ЭлектроМонтаж", role: "Подрядчик без лицензии", hint: "лицензия на проверке — заявки по электрике не приходят" },
  { phone: "+77010000006", name: "Марат", role: "Технадзор", hint: "чек-листы, заключения" },
  { phone: "+77010000007", name: "Диспетчер", role: "Админ", hint: "споры, верификации, джобы" },
] as const;

export function isDemoMode() {
  return process.env.DEMO_MODE === "1" || config.devOtpCode != null;
}

/** Переключение на тестовый аккаунт. Вне демо-режима — 403 независимо от того, кто и откуда дёргает. */
export async function demoSwitch(phone: string, opts: { actorId?: string | null; ip?: string | null; userAgent?: string | null } = {}) {
  if (!isDemoMode()) throw forbidden("Демо-режим выключен: переключение ролей недоступно");
  const account = DEMO_ACCOUNTS.find((a) => a.phone === phone);
  if (!account) throw new AppError("not_demo_account", "Этот номер не входит в список тестовых аккаунтов", 400);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) throw new AppError("not_seeded", "Тестовый аккаунт не найден в базе — выполните npm run db:seed", 404);
  if (user.status === "blocked") throw forbidden("Аккаунт заблокирован");
  const token = await issueToken(user.id, user.token_version);
  await logActivity({ actor_id: opts.actorId ?? null, entity_type: "user", entity_id: user.id, action: "dev_role_switch", meta: { from_user_id: opts.actorId ?? null, to_phone: phone, to_role: account.role, ip: opts.ip ?? null, user_agent: opts.userAgent?.slice(0, 120) ?? null } });
  return { user, token, account };
}
