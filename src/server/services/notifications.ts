import { NotificationChannel } from "@prisma/client";
import { prisma } from "../db";
import { notificationProvider } from "../providers";
import { config } from "../config";

const CHANNEL_PRIORITY: NotificationChannel[] = ["push", "whatsapp", "sms", "email"];

export type NotifyInput = { user_id: string; type: string; payload?: Record<string, unknown>; dedup_key?: string; critical?: boolean };

function almatyHour(d = new Date()) {
  return parseInt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: config.timezone }).format(d), 10) % 24;
}

/** Возвращает момент окончания тихих часов (в UTC), если сейчас тихие часы; иначе null. */
export function quietHoursDeferUntil(start: number | null, end: number | null, now = new Date()): Date | null {
  if (start == null || end == null || start === end) return null;
  const h = almatyHour(now);
  const inQuiet = start < end ? h >= start && h < end : h >= start || h < end;
  if (!inQuiet) return null;
  const hoursUntilEnd = ((end - h + 24) % 24) || 24;
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + hoursUntilEnd);
  return d;
}

/** Digest: собираем до ближайших 09:00 или 18:00 по Алматы. */
export function digestDeferUntil(now = new Date()): Date {
  const h = almatyHour(now);
  const next = h < 9 ? 9 : h < 18 ? 18 : 33; // 33 = 09:00 следующего дня
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + (next - h));
  return d;
}

/**
 * 5Г. Одно событие → in_app всегда + максимум один внешний канал (дедупликация между каналами).
 * dedup_key: одно и то же событие не отправляется повторно в течение 24 ч.
 * Тихие часы и digest → deferred_until (кроме critical).
 */
export async function notify(input: NotifyInput) {
  const { user_id, type, payload = {}, dedup_key, critical = false } = input;
  if (dedup_key) {
    const dup = await prisma.notification.findFirst({ where: { user_id, dedup_key, created_at: { gte: new Date(Date.now() - 24 * 3600000) } } });
    if (dup) return { created: [], deduplicated: true as const };
  }
  const prefs = await prisma.notificationPreference.findMany({ where: { user_id } });
  const enabled = new Map(prefs.filter((p) => p.enabled).map((p) => [p.channel, p]));
  const created = [];
  // in_app — всегда (это и есть «входящие» в кабинете)
  created.push(await prisma.notification.create({ data: { user_id, type, channel: "in_app", payload_json: payload as never, dedup_key: dedup_key ?? null, sent_at: new Date() } }));
  const external = CHANNEL_PRIORITY.find((c) => enabled.has(c));
  if (external) {
    const pref = enabled.get(external)!;
    let deferred_until: Date | null = null;
    if (!critical) {
      deferred_until = quietHoursDeferUntil(pref.quiet_hours_start, pref.quiet_hours_end);
      if (pref.digest_mode) {
        const dd = digestDeferUntil();
        deferred_until = deferred_until && deferred_until > dd ? deferred_until : dd;
      }
    }
    let n = await prisma.notification.create({ data: { user_id, type, channel: external, payload_json: payload as never, dedup_key: dedup_key ?? null, deferred_until } });
    if (!deferred_until) { await deliver([n.id]); n = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } }); }
    created.push(n);
  }
  return { created, deduplicated: false as const };
}

async function deliver(ids: string[]) {
  const rows = await prisma.notification.findMany({ where: { id: { in: ids } }, include: { user: { include: { device_tokens: true } } } });
  if (!rows.length) return;
  const first = rows[0];
  await notificationProvider.send({
    user_id: first.user_id,
    channel: first.channel,
    type: rows.length === 1 ? first.type : "digest",
    payload: rows.length === 1 ? first.payload_json : { items: rows.map((r) => ({ type: r.type, payload: r.payload_json })) },
    device_tokens: first.user.device_tokens.map((d) => d.token),
    phone: first.user.phone,
  });
  const batch = rows.length > 1 ? `digest-${Date.now()}` : null;
  await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { sent_at: new Date(), digest_batch_id: batch } });
}

/** Джоб: доставка отложенных уведомлений (тихие часы/digest) — группируем по user+channel в один digest. */
export async function deliverDeferred(now = new Date()) {
  const due = await prisma.notification.findMany({ where: { sent_at: null, deferred_until: { lte: now } }, orderBy: { created_at: "asc" } });
  const groups = new Map<string, string[]>();
  for (const n of due) {
    const k = `${n.user_id}:${n.channel}`;
    groups.set(k, [...(groups.get(k) ?? []), n.id]);
  }
  for (const ids of groups.values()) await deliver(ids);
  return { delivered: due.length, batches: groups.size };
}

export async function notifyCompany(companyId: string, input: Omit<NotifyInput, "user_id">) {
  const members = await prisma.companyMember.findMany({ where: { company_id: companyId } });
  const out = [];
  for (const m of members) out.push(await notify({ ...input, user_id: m.user_id, dedup_key: input.dedup_key ? `${input.dedup_key}:${m.user_id}` : undefined }));
  return out;
}
