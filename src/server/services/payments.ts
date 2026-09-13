import { Prisma, PaymentPurpose } from "@prisma/client";
import { prisma } from "../db";
import { getPaymentProvider } from "../providers";
import { config } from "../config";
import { logActivity } from "../activity";
import { bad, notFound } from "../errors";

export type PaymentInput = { payer_id: string; purpose: PaymentPurpose; amount: Prisma.Decimal; idempotency_key: string; deal_id?: string; lead_id?: string; milestone_id?: string; currency?: string; provider?: string };

/**
 * 9. Оплата «в один тап» с идемпотентностью: повторный вызов с тем же idempotency_key возвращает тот же Payment
 * и НЕ создаёт второго списания. При retryable-ошибке провайдера → retry_pending (джоб повторит через fallback).
 */
export async function createPayment(input: PaymentInput) {
  const existing = await prisma.payment.findUnique({ where: { idempotency_key: input.idempotency_key } });
  if (existing) return { payment: existing, idempotent_replay: true };
  const providerName = input.provider ?? config.paymentProvider;
  const payment = await prisma.payment.create({ data: { payer_id: input.payer_id, purpose: input.purpose, amount: input.amount, currency: input.currency ?? "KZT", provider: providerName, idempotency_key: input.idempotency_key, deal_id: input.deal_id ?? null, lead_id: input.lead_id ?? null, milestone_id: input.milestone_id ?? null, status: "pending" } });
  return { payment: await attemptCharge(payment.id, providerName), idempotent_replay: false };
}

export async function attemptCharge(paymentId: string, providerName: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.status === "succeeded") return p;
  const provider = getPaymentProvider(providerName);
  const res = await provider.charge({ amount: Number(p.amount), currency: p.currency, idempotency_key: p.idempotency_key, description: `${p.purpose}:${p.deal_id ?? p.lead_id ?? ""}` });
  const attempts = p.attempts + 1;
  if (res.ok) {
    const upd = await prisma.payment.update({ where: { id: paymentId }, data: { status: "succeeded", provider: provider.name, provider_ref: res.provider_ref, attempts, last_error: null } });
    await logActivity({ actor_id: p.payer_id, entity_type: "payment", entity_id: paymentId, action: "succeeded", meta: { provider: provider.name, ref: res.provider_ref, attempts } });
    await onPaymentSucceeded(upd.id);
    return upd;
  }
  const status = res.retryable && attempts < 3 ? "retry_pending" : "failed";
  const upd = await prisma.payment.update({ where: { id: paymentId }, data: { status, attempts, last_error: res.error, provider: provider.name } });
  await logActivity({ actor_id: p.payer_id, entity_type: "payment", entity_id: paymentId, action: status, meta: { error: res.error, attempts } });
  return upd;
}

/** Джоб: повтор retry_pending через fallback-провайдер. */
export async function retryPendingPayments() {
  const list = await prisma.payment.findMany({ where: { status: "retry_pending" } });
  let ok = 0;
  for (const p of list) {
    const fallback = p.attempts >= 1 && config.paymentFallbackProvider !== p.provider ? config.paymentFallbackProvider : p.provider;
    const r = await attemptCharge(p.id, fallback);
    if (r.status === "succeeded") ok++;
  }
  return { retried: list.length, succeeded: ok };
}

/** Вебхук провайдера (надёжная обработка: подпись, идемпотентность по provider_ref, неизвестные — 200 и лог). */
export async function handleWebhook(providerName: string, headers: Record<string, string | undefined>, rawBody: string) {
  const provider = getPaymentProvider(providerName);
  if (!provider.verifyWebhook(headers, rawBody)) throw bad("webhook_signature", "Неверная подпись вебхука");
  const body = JSON.parse(rawBody) as { idempotency_key?: string; provider_ref?: string; status: "succeeded" | "failed" };
  const p = body.idempotency_key ? await prisma.payment.findUnique({ where: { idempotency_key: body.idempotency_key } }) : body.provider_ref ? await prisma.payment.findFirst({ where: { provider_ref: body.provider_ref } }) : null;
  if (!p) { await logActivity({ entity_type: "webhook", entity_id: body.provider_ref ?? "?", action: "unknown_payment", meta: body }); return { handled: false }; }
  if (p.status === "succeeded") return { handled: true, replay: true }; // повтор вебхука — идемпотентно
  if (body.status === "succeeded") {
    await prisma.payment.update({ where: { id: p.id }, data: { status: "succeeded", provider_ref: body.provider_ref ?? p.provider_ref } });
    await onPaymentSucceeded(p.id);
  } else await prisma.payment.update({ where: { id: p.id }, data: { status: "failed", last_error: "webhook: failed" } });
  await logActivity({ entity_type: "payment", entity_id: p.id, action: `webhook.${body.status}` });
  return { handled: true };
}

/** Побочные эффекты успешной оплаты: пополнение кошелька / фондирование эскроу. */
async function onPaymentSucceeded(paymentId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.purpose === "milestone" && p.milestone_id) {
    const { fundMilestoneFromPayment } = await import("./escrow");
    await fundMilestoneFromPayment(p.id);
  }
}

/** Пополнение кошелька поставщика (для покупки лидов). */
export async function topUpWallet(userId: string, companyId: string, amount: number, idempotencyKey: string) {
  const wallet = await prisma.wallet.findUnique({ where: { company_id: companyId } });
  if (!wallet) throw notFound("Кошелёк не найден");
  const { payment, idempotent_replay } = await createPayment({ payer_id: userId, purpose: "lead", amount: new Prisma.Decimal(amount), idempotency_key: idempotencyKey });
  if (payment.status === "succeeded" && !idempotent_replay) {
    await prisma.$transaction([
      prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: payment.amount } } }),
      prisma.transaction.create({ data: { wallet_id: wallet.id, type: "credit", amount: payment.amount, provider: payment.provider, provider_ref: payment.provider_ref, idempotency_key: `topup:${payment.id}`, status: "succeeded" } }),
    ]);
  }
  return payment;
}

/** 9. Ежедневная сверка с провайдером: расхождения — в activity_log; reconciled_at проставляется. */
export async function reconcilePayments(days = 3) {
  const since = new Date(Date.now() - days * 86400000);
  const list = await prisma.payment.findMany({ where: { created_at: { gte: since }, status: { in: ["succeeded", "pending", "retry_pending"] }, provider_ref: { not: null } } });
  const mismatches: { payment_id: string; local: string; remote: string }[] = [];
  for (const p of list) {
    const remote = await getPaymentProvider(p.provider).fetchStatus(p.provider_ref!);
    const local = p.status === "succeeded" ? "succeeded" : "pending";
    if (remote !== "unknown" && remote !== local) mismatches.push({ payment_id: p.id, local: p.status, remote });
    await prisma.payment.update({ where: { id: p.id }, data: { reconciled_at: new Date() } });
  }
  await logActivity({ entity_type: "reconciliation", entity_id: new Date().toISOString().slice(0, 10), action: "run", meta: { checked: list.length, mismatches } });
  return { checked: list.length, mismatches };
}

/** Подписки: списание по next_billing_at. */
export async function billSubscriptions(now = new Date()) {
  const due = await prisma.subscription.findMany({ where: { status: { in: ["active", "past_due"] }, next_billing_at: { lte: now } }, include: { company: { include: { members: true } } } });
  let billed = 0;
  for (const s of due) {
    const payer = s.company.members[0]?.user_id;
    if (!payer) continue;
    const key = `sub:${s.id}:${s.next_billing_at!.toISOString().slice(0, 10)}`;
    const { payment } = await createPayment({ payer_id: payer, purpose: "subscription", amount: s.price, idempotency_key: key });
    if (payment.status === "succeeded") { await prisma.subscription.update({ where: { id: s.id }, data: { status: "active", next_billing_at: new Date(s.next_billing_at!.getTime() + 30 * 86400000) } }); billed++; }
    else await prisma.subscription.update({ where: { id: s.id }, data: { status: "past_due" } });
  }
  return { due: due.length, billed };
}
