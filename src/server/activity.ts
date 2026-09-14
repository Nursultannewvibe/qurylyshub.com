import { createHash } from "crypto";
import { prisma, Tx } from "./db";

/**
 * activity_log — append-only (роль приложения не имеет UPDATE/DELETE).
 * previous_hash → hash образуют цепочку: подмена/удаление записи ломает проверку verifyChain().
 */
export async function logActivity(
  input: { actor_id?: string | null; entity_type: string; entity_id: string; action: string; meta?: unknown },
  tx: Tx | typeof prisma = prisma,
) {
  const last = await tx.activityLog.findFirst({ orderBy: { created_at: "desc" }, select: { hash: true } });
  const previous_hash = last?.hash ?? null;
  const payload = JSON.stringify({ ...input, previous_hash });
  const hash = createHash("sha256").update(payload).digest("hex");
  return tx.activityLog.create({
    data: {
      actor_id: input.actor_id ?? null,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action: input.action,
      meta_json: (input.meta ?? null) as never,
      previous_hash,
      hash,
    },
  });
}

/**
 * Проверка целостности ссылок: каждая запись через previous_hash ссылается на существующую запись (или null у первой).
 * Удаление/подмена записи ломает ссылку. Порядок вставки при параллельных запросах не важен (форки допустимы);
 * неизменяемость самих записей обеспечивается правами БД (роль приложения без UPDATE/DELETE).
 */
export async function verifyChain(limit = 5000): Promise<{ ok: boolean; checked: number; brokenAt?: string }> {
  const rows = await prisma.activityLog.findMany({ orderBy: { created_at: "desc" }, take: limit, select: { id: true, hash: true, previous_hash: true } });
  const hashes = new Set(rows.map((r) => r.hash));
  const truncated = rows.length >= limit;
  for (const r of rows) if (r.previous_hash && !hashes.has(r.previous_hash) && !truncated) return { ok: false, checked: rows.length, brokenAt: r.id };
  return { ok: true, checked: rows.length };
}
