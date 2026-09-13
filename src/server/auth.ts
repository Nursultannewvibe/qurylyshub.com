import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomInt } from "crypto";
import { prisma } from "./db";
import { config } from "./config";
import { AppError, forbidden } from "./errors";
import { referralCode } from "@/lib/ids";
import { sendOtpSms } from "./providers";
import { logActivity } from "./activity";
import type { Role } from "@prisma/client";

const secret = new TextEncoder().encode(config.jwtSecret);
export const COOKIE = "qh_session";

export async function requestOtp(phone: string) {
  const p = normalizePhone(phone);
  const att = await prisma.otpAttempt.findUnique({ where: { phone: p } });
  if (att?.locked_until && att.locked_until > new Date()) throw new AppError("otp_locked", `Номер временно заблокирован до ${att.locked_until.toLocaleTimeString("ru-RU")} после ${config.otpMaxAttempts} неверных попыток`, 429, { locked_until: att.locked_until });
  const code = config.devOtpCode ?? String(randomInt(0, 999999)).padStart(6, "0");
  await prisma.otpCode.updateMany({ where: { phone: p, consumed: false }, data: { consumed: true } });
  await prisma.otpCode.create({ data: { phone: p, code, expires_at: new Date(Date.now() + 5 * 60000) } });
  await sendOtpSms(p, code);
  return { phone: p, dev_code: config.devOtpCode ? code : undefined };
}

/** 3А: после N неверных попыток — блокировка на M минут; сбрасывается при успехе или по истечении окна. */
export async function verifyOtp(phone: string, code: string, opts?: { name?: string; role?: Role; referral?: string }) {
  const p = normalizePhone(phone);
  const now = new Date();
  const att = await prisma.otpAttempt.upsert({ where: { phone: p }, create: { phone: p }, update: {} });
  if (att.locked_until && att.locked_until > now) throw new AppError("otp_locked", `Номер заблокирован до ${att.locked_until.toLocaleTimeString("ru-RU")}`, 429, { locked_until: att.locked_until });
  // окно истекло → сброс счётчика
  const windowExpired = att.last_attempt_at && now.getTime() - att.last_attempt_at.getTime() > config.otpLockMinutes * 60000;
  const currentCount = windowExpired ? 0 : att.attempt_count;

  const valid = await prisma.otpCode.findFirst({ where: { phone: p, consumed: false, expires_at: { gt: now } }, orderBy: { created_at: "desc" } });
  // DEV_OTP_CODE (только dev/mock): фиксированный код принимается и без предварительного requestOtp
  const ok = (!!valid && valid.code === code) || (config.devOtpCode != null && code === config.devOtpCode);
  if (!ok) {
    const attempt_count = currentCount + 1;
    const locked = attempt_count >= config.otpMaxAttempts;
    await prisma.otpAttempt.update({ where: { phone: p }, data: { attempt_count: locked ? 0 : attempt_count, last_attempt_at: now, locked_until: locked ? new Date(now.getTime() + config.otpLockMinutes * 60000) : null } });
    if (locked) {
      await logActivity({ entity_type: "otp", entity_id: p, action: "locked", meta: { attempts: attempt_count } });
      throw new AppError("otp_locked", `Слишком много неверных попыток. Номер заблокирован на ${config.otpLockMinutes} минут`, 429);
    }
    throw new AppError("otp_invalid", `Неверный код (попытка ${attempt_count} из ${config.otpMaxAttempts})`, 401, { attempts_left: config.otpMaxAttempts - attempt_count });
  }
  if (valid) await prisma.otpCode.update({ where: { id: valid.id }, data: { consumed: true } });
  await prisma.otpAttempt.update({ where: { phone: p }, data: { attempt_count: 0, locked_until: null, last_attempt_at: now } });

  let user = await prisma.user.findUnique({ where: { phone: p } });
  if (!user) {
    const referrer = opts?.referral ? await prisma.user.findUnique({ where: { referral_code: opts.referral } }) : null;
    user = await prisma.user.create({
      data: { phone: p, name: opts?.name ?? null, referral_code: referralCode(), referred_by: referrer?.id ?? null, roles: { create: { role: opts?.role ?? "buyer" } }, consents: { create: { consent_type: "personal_data" } }, notification_prefs: { create: [{ channel: "in_app" }, { channel: "push" }] } },
    });
    await logActivity({ actor_id: user.id, entity_type: "user", entity_id: user.id, action: "registered", meta: { referred_by: referrer?.id ?? null } });
  }
  if (user.status === "blocked") throw forbidden("Аккаунт заблокирован");
  const token = await issueToken(user.id, user.token_version);
  return { user, token };
}

export async function issueToken(userId: string, tokenVersion: number) {
  return new SignJWT({ tv: tokenVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(config.jwtTtl).sign(secret);
}

export async function logoutAllDevices(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { token_version: { increment: 1 } } });
  await prisma.deviceToken.deleteMany({ where: { user_id: userId } });
  await logActivity({ actor_id: userId, entity_type: "user", entity_id: userId, action: "logout_all" });
}

export type Session = { user: { id: string; phone: string; name: string | null; locale: "ru" | "kk"; roles: Role[]; companies: { id: string; name: string; role: string; permission: string }[] } };

export async function sessionFromToken(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const user = await prisma.user.findUnique({ where: { id: payload.sub! }, include: { roles: true, company_members: { include: { company: true } } } });
    if (!user || user.status === "blocked" || user.token_version !== payload.tv) return null;
    return { user: { id: user.id, phone: user.phone, name: user.name, locale: user.locale, roles: user.roles.map((r) => r.role), companies: user.company_members.map((m) => ({ id: m.company.id, name: m.company.name, role: m.company.role, permission: m.permission })) } };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return sessionFromToken(c.get(COOKIE)?.value);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AppError("unauthorized", "Требуется вход", 401);
  return s;
}

export function hasRole(s: Session, ...roles: Role[]) { return roles.some((r) => s.user.roles.includes(r)); }
export function requireRole(s: Session, ...roles: Role[]) { if (!hasRole(s, ...roles)) throw forbidden(`Требуется роль: ${roles.join("/")}`); }
/** Компания пользователя (первая с ролью поставщик/подрядчик или явная). */
export function companyOf(s: Session, companyId?: string | null) {
  const c = companyId ? s.user.companies.find((x) => x.id === companyId) : s.user.companies.find((x) => x.role !== "buyer") ?? s.user.companies[0];
  if (!c) throw forbidden("У пользователя нет компании");
  return c;
}

export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const d = digits.length === 10 ? "7" + digits : digits.startsWith("8") && digits.length === 11 ? "7" + digits.slice(1) : digits;
  if (d.length !== 11) throw new AppError("phone_invalid", "Неверный формат телефона", 400);
  return "+" + d;
}
