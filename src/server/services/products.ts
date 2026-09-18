import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { bad, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "../activity";
import { resolveCommission, getDeal } from "./deals";
import { createPayment } from "./payments";
import { notify, notifyCompany } from "./notifications";
import { config } from "../config";

/** Лимит числа фото у товара (размер файла проверяет saveUpload по общим константам загрузки). */
export function assertPhotoCount(n: number) {
  if (n > config.productPhotosMax) throw bad("photos_limit", `У товара может быть не больше ${config.productPhotosMax} фото (выбрано ${n})`);
}

export type ProductInput = { category_id: string; name: string; description?: string | null; unit?: string; price: number; stock_qty?: number | null; min_order_qty?: number; photos?: string[]; is_active?: boolean };

async function assertMember(userId: string, companyId: string) {
  const m = await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: companyId } } });
  if (!m || m.permission === "estimator") throw forbidden("Товарами управляет владелец или менеджер компании");
}

export async function createProduct(userId: string, companyId: string, input: ProductInput) {
  await assertMember(userId, companyId);
  if (!input.name.trim()) throw bad("name", "Укажите название");
  if (!(input.price > 0)) throw bad("price", "Цена должна быть больше 0");
  assertPhotoCount(input.photos?.length ?? 0);
  const p = await prisma.product.create({ data: { company_id: companyId, category_id: input.category_id, name: input.name.trim(), description: input.description ?? null, unit: input.unit || "шт", price: new Prisma.Decimal(input.price), stock_qty: input.stock_qty ?? null, min_order_qty: Math.max(1, input.min_order_qty ?? 1), photos_json: (input.photos ?? []) as never, is_active: input.is_active ?? true } });
  await logActivity({ actor_id: userId, entity_type: "product", entity_id: p.id, action: "created" });
  return p;
}

export async function updateProduct(userId: string, productId: string, patch: Partial<ProductInput>) {
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p) throw notFound("Товар не найден");
  await assertMember(userId, p.company_id);
  if (patch.photos) assertPhotoCount(patch.photos.length);
  const upd = await prisma.product.update({ where: { id: productId }, data: { ...(patch.photos ? { photos_json: patch.photos as never } : {}), ...(patch.name != null ? { name: patch.name } : {}), ...(patch.price != null ? { price: new Prisma.Decimal(patch.price) } : {}), ...("stock_qty" in patch ? { stock_qty: patch.stock_qty ?? null } : {}), ...(patch.is_active != null ? { is_active: patch.is_active } : {}), ...(patch.description !== undefined ? { description: patch.description } : {}), ...(patch.min_order_qty != null ? { min_order_qty: patch.min_order_qty } : {}) } });
  await logActivity({ actor_id: userId, entity_type: "product", entity_id: productId, action: "updated", meta: patch });
  return upd;
}

/**
 * Покупка товара: сделка deal_type=product_purchase без заявки/КП/эскроу. Сумма = price × qty,
 * комиссия — resolveCommission по commission_tiers (тот же код, что у сделок-услуг).
 * Остаток списывается атомарно: SELECT … FOR UPDATE на строке товара (как при покупке лида).
 */
export async function purchaseProduct(userId: string, productId: string, qty: number) {
  if (!Number.isInteger(qty) || qty <= 0) throw bad("qty", "Количество должно быть целым числом больше 0");
  const memberships = await prisma.companyMember.findMany({ where: { user_id: userId } });
  const deal = await prisma.$transaction(async (tx) => {
    const [p] = await tx.$queryRaw<{ id: string; company_id: string; name: string; price: Prisma.Decimal; stock_qty: number | null; min_order_qty: number; is_active: boolean }[]>`SELECT id, company_id, name, price, stock_qty, min_order_qty, is_active FROM products WHERE id = ${productId} FOR UPDATE`;
    if (!p) throw notFound("Товар не найден");
    if (!p.is_active) throw conflict("inactive", "Товар снят с продажи");
    if (memberships.some((m) => m.company_id === p.company_id)) throw forbidden("Нельзя купить товар у собственной компании");
    if (qty < p.min_order_qty) throw bad("min_order", `Минимальный заказ — ${p.min_order_qty}`);
    if (p.stock_qty != null && p.stock_qty < qty) throw conflict("out_of_stock", p.stock_qty === 0 ? "Товар закончился" : `На складе только ${p.stock_qty}`);
    if (p.stock_qty != null) await tx.product.update({ where: { id: p.id }, data: { stock_qty: { decrement: qty } } });
    const amount = new Prisma.Decimal(p.price).mul(qty).toDecimalPlaces(2);
    const commission = await resolveCommission(amount, tx);
    const d = await tx.deal.create({ data: { deal_type: "product_purchase", product_id: p.id, product_qty: qty, buyer_id: userId, seller_id: p.company_id, amount, commission_percent: commission.percent, commission_amount: commission.amount, status: "created", cancel_policy: "full_refund_before_start" } });
    await logActivity({ actor_id: userId, entity_type: "deal", entity_id: d.id, action: "product_purchase.created", meta: { product_id: p.id, qty, amount: amount.toString(), commission_percent: commission.percent.toString() } }, tx);
    return d;
  }, { isolationLevel: "ReadCommitted" });
  await notifyCompany(deal.seller_id, { type: "product.ordered", payload: { deal_id: deal.id, qty }, critical: true });
  return deal;
}

/** created → paid: оплата тем же createPayment (идемпотентно), без эскроу. */
export async function payProductDeal(userId: string, dealId: string, idempotencyKey?: string) {
  const { deal, isBuyer } = await getDeal(dealId, userId);
  if (deal.deal_type !== "product_purchase") throw bad("deal_type", "Не товарная сделка");
  if (!isBuyer) throw forbidden("Оплачивает покупатель");
  if (deal.status !== "created") throw conflict("bad_status", `Сделка в статусе ${deal.status}`);
  const res = await createPayment({ payer_id: userId, purpose: "product", amount: deal.amount, idempotency_key: idempotencyKey ?? `product:${dealId}`, deal_id: dealId });
  if (res.payment.status === "succeeded") {
    await prisma.deal.update({ where: { id: dealId }, data: { status: "paid" } });
    await notifyCompany(deal.seller_id, { type: "product.paid", payload: { deal_id: dealId }, critical: true });
  }
  return res;
}

/** paid → received (покупатель подтверждает получение) → completed (деньги продавцу за вычетом комиссии). */
export async function confirmReceived(userId: string, dealId: string) {
  const { deal, isBuyer } = await getDeal(dealId, userId);
  if (!isBuyer) throw forbidden("Получение подтверждает покупатель");
  if (deal.status !== "paid") throw conflict("bad_status", "Сначала должна пройти оплата");
  await prisma.$transaction(async (tx) => {
    await tx.deal.update({ where: { id: dealId }, data: { status: "received" } });
    const net = deal.amount.sub(deal.commission_amount);
    const wallet = await tx.wallet.upsert({ where: { company_id: deal.seller_id }, create: { company_id: deal.seller_id }, update: {} });
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: net } } });
    await tx.transaction.create({ data: { wallet_id: wallet.id, type: "credit", amount: net, idempotency_key: `product-sale:${dealId}`, status: "succeeded", meta_json: { deal_id: dealId, gross: deal.amount.toString() } } });
    await tx.transaction.create({ data: { wallet_id: wallet.id, type: "commission", amount: deal.commission_amount.neg(), idempotency_key: `product-commission:${dealId}`, status: "succeeded", meta_json: { percent: deal.commission_percent.toString() } } });
    await tx.deal.update({ where: { id: dealId }, data: { status: "completed", completed_at: new Date() } });
    await logActivity({ actor_id: userId, entity_type: "deal", entity_id: dealId, action: "product_purchase.completed", meta: { net: net.toString(), commission: deal.commission_amount.toString() } }, tx);
  });
  await notifyCompany(deal.seller_id, { type: "product.received", payload: { deal_id: dealId } });
  await notify({ user_id: userId, type: "product.completed", payload: { deal_id: dealId } });
}
