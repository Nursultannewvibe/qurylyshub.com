"use server";
import { requireSession, companyOf } from "../auth";
import { act, str, num, bool } from "./helpers";
import * as P from "../services/products";

export async function createProductAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/products", async () => { await P.createProduct(s.user.id, c.id, { category_id: str(fd, "category_id"), name: str(fd, "name"), description: str(fd, "description") || null, unit: str(fd, "unit"), price: num(fd, "price") ?? 0, stock_qty: str(fd, "stock_qty") === "" ? null : num(fd, "stock_qty"), min_order_qty: num(fd, "min_order_qty") ?? 1 }); return "Товар добавлен в каталог"; });
}
export async function updateProductAction(fd: FormData) {
  const s = await requireSession();
  await act("/supplier/products", async () => { await P.updateProduct(s.user.id, str(fd, "product_id"), { price: num(fd, "price") ?? undefined, stock_qty: str(fd, "stock_qty") === "" ? null : num(fd, "stock_qty"), is_active: bool(fd, "is_active") }); return "Товар обновлён"; });
}
export async function buyProductAction(fd: FormData) {
  const s = await requireSession(); const slug = str(fd, "slug");
  await act(`/catalog/${slug}`, async () => { const d = await P.purchaseProduct(s.user.id, str(fd, "product_id"), Number(str(fd, "qty"))); return `/deals/${d.id}?ok=${encodeURIComponent("Заказ создан — оплатите, чтобы продавец начал отгрузку")}`; });
}
export async function payProductAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { const r = await P.payProductDeal(s.user.id, did); return `Оплата: ${r.payment.status}${r.idempotent_replay ? " (повтор — списания не было)" : ""}`; });
}
export async function receivedAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { await P.confirmReceived(s.user.id, did); return "Получение подтверждено — покупка завершена, можно оставить отзыв"; });
}
