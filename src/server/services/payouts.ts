import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { bad, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { notifyCompany } from "./notifications";

/** Вывод средств: pending → approved → completed (или rejected с возвратом на кошелёк). Сумма резервируется сразу. */
export async function requestPayout(userId: string, companyId: string, amount: number, bankAccount?: string) {
  const member = await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: companyId } } });
  if (!member || member.permission === "estimator") throw forbidden();
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const account = bankAccount ?? company.bank_account;
  if (!account) throw bad("no_bank_account", "Не указан банковский счёт");
  const amt = new Prisma.Decimal(amount);
  if (amt.lte(0)) throw bad("amount", "Сумма должна быть больше 0");
  return prisma.$transaction(async (tx) => {
    const [w] = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`SELECT id, balance FROM wallets WHERE company_id = ${companyId} FOR UPDATE`;
    if (!w) throw notFound("Кошелёк не найден");
    if (new Prisma.Decimal(w.balance).lt(amt)) throw bad("insufficient_funds", `На балансе ${w.balance} ₸`);
    await tx.wallet.update({ where: { id: w.id }, data: { balance: { decrement: amt } } });
    const pr = await tx.payoutRequest.create({ data: { company_id: companyId, amount: amt, bank_account: account } });
    await tx.transaction.create({ data: { wallet_id: w.id, type: "payout", amount: amt.neg(), idempotency_key: `payout:${pr.id}`, status: "pending" } });
    await logActivity({ actor_id: userId, entity_type: "payout_request", entity_id: pr.id, action: "requested", meta: { amount: amt.toString() } }, tx);
    return pr;
  });
}

export async function processPayout(adminId: string, payoutId: string, action: "approve" | "complete" | "reject") {
  const pr = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!pr) throw notFound();
  const allowed: Record<string, string[]> = { approve: ["pending"], complete: ["approved"], reject: ["pending", "approved"] };
  if (!allowed[action].includes(pr.status)) throw conflict("bad_status", `Нельзя ${action} из статуса ${pr.status}`);
  const status = action === "approve" ? "approved" : action === "complete" ? "completed" : "rejected";
  const upd = await prisma.payoutRequest.update({ where: { id: payoutId }, data: { status, processed_at: status === "completed" || status === "rejected" ? new Date() : null } });
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { company_id: pr.company_id } });
  if (status === "completed") await prisma.transaction.updateMany({ where: { idempotency_key: `payout:${payoutId}` }, data: { status: "succeeded" } });
  if (status === "rejected") {
    await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: pr.amount } } });
    await prisma.transaction.updateMany({ where: { idempotency_key: `payout:${payoutId}` }, data: { status: "failed" } });
  }
  await logActivity({ actor_id: adminId, entity_type: "payout_request", entity_id: payoutId, action: status });
  await notifyCompany(pr.company_id, { type: `payout.${status}`, payload: { payout_id: payoutId, amount: pr.amount.toString() } });
  return upd;
}
