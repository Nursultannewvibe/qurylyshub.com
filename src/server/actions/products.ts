"use server";
import { requireSession, companyOf } from "../auth";
import { act, str, num, bool } from "./helpers";
import * as P from "../services/products";
import { saveUpload } from "../services/uploads";
import { prisma } from "../db";

/** Фото товара: тот же saveUpload, что у чек-листов/отзывов; лимит числа — до сохранения файлов. */
async function uploadPhotos(fd: FormData, ownerId: string, existing = 0) {
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  P.assertPhotoCount(existing + files.length);
  const urls: string[] = [];
  for (const f of files) urls.push(await saveUpload(f, "products", ownerId));
  return urls;
}

export async function createProductAction(fd: FormData) {
  const s = await requireSession(); const c = companyOf(s);
  await act("/supplier/products", async () => { const photos = await uploadPhotos(fd, s.user.id); await P.createProduct(s.user.id, c.id, { category_id: str(fd, "category_id"), name: str(fd, "name"), description: str(fd, "description") || null, unit: str(fd, "unit"), price: num(fd, "price") ?? 0, stock_qty: str(fd, "stock_qty") === "" ? null : num(fd, "stock_qty"), min_order_qty: num(fd, "min_order_qty") ?? 1, photos, delivery_days: num(fd, "delivery_days") }); return `Товар добавлен в каталог${photos.length ? ` (${photos.length} фото)` : ""}`; });
}
export async function updateProductAction(fd: FormData) {
  const s = await requireSession();
  await act("/supplier/products", async () => {
    const id = str(fd, "product_id"); const cur = await prisma.product.findUniqueOrThrow({ where: { id } });
    const remove = new Set(fd.getAll("remove_photo").map(String));
    const kept = ((cur.photos_json as string[]) ?? []).filter((u) => !remove.has(u));
    const added = await uploadPhotos(fd, s.user.id, kept.length);
    await P.updateProduct(s.user.id, id, { price: num(fd, "price") ?? undefined, stock_qty: str(fd, "stock_qty") === "" ? null : num(fd, "stock_qty"), is_active: bool(fd, "is_active"), photos: [...kept, ...added] }); return `Товар обновлён${remove.size ? `, удалено фото: ${remove.size}` : ""}${added.length ? `, добавлено фото: ${added.length}` : ""}`; });
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
